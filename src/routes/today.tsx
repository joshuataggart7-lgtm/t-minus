import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { McPageHeader, DataTable, StatusChip, type StatusTone } from "@/components/ui-mc";
import { dueView, phasePosition, phasePositionText } from "@/lib/file-timeline";
import { formatDate } from "@/lib/metrics";
import { useRole } from "@/components/role-context";
import { useDeskData, daysSince, daysUntil, type DeskCard } from "@/lib/desk-data";
import { urgencyRank } from "@/lib/metrics";
import { awardConfidence } from "@/lib/confidence";
import { RowKeysHint, useRowKeysContainer } from "@/components/row-keys";
import { PilotKnownGapsLine } from "@/components/pilot-known-gaps";
import { LaunchCountdownCompact, countdownView } from "@/components/launch-countdown";
import { missionReadinessClass, type MissionReadiness } from "@/components/mission-control/primitives";
import { explainWorkReadiness } from "@/components/mission-control/readiness";
import { dayWord } from "@/lib/pluralize";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — T-Minus" },
      {
        name: "description",
        content: "What is waiting on you, what is waiting on someone else, reviews due, and the three things to do next.",
      },
      { property: "og:title", content: "Today — T-Minus" },
      {
        property: "og:description",
        content: "What is waiting on you, reviews due, and the three things to do next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodayPage,
});

function plain(name: string): string {
  return name.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function surname(name: string): string {
  const parts = plain(name).split(" ");
  return parts[parts.length - 1] ?? "";
}

/** The same person, written either as the full name or just the surname. */
function samePerson(owner: string, me: string): boolean {
  const a = plain(owner);
  const b = plain(me);
  if (!a || !b) return false;
  return a === b || surname(owner) === surname(me);
}

function FileLink({ card }: { card: DeskCard }) {
  const id = card.m.acq.acquisition_id;
  return (
    <Link
      to="/files/$acquisitionId"
      params={{ acquisitionId: id }}
      className="text-primary hover:text-primary-hover"
    >
      {String((card.m.acq as Record<string, unknown>)['title'] ?? id)}
    </Link>
  );
}

const READINESS_TONE: Record<MissionReadiness, StatusTone> = { GO: "ontrack", WATCH: "attention", HOLD: "atrisk", LAUNCHED: "launched" };

function Section({
  title,
  lead,
  id,
  count,
  children,
}: {
  title: string;
  lead?: string;
  id?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mc-today-section" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="mc-today-section-head">
        <h2 id={id ? `${id}-h` : undefined}>
          {title}
          {count !== undefined ? <span className="mc-today-count" data-numeric>{count}</span> : null}
        </h2>
        {lead ? <p>{lead}</p> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TodayPage() {
  const { authState, user, roles } = useRole();
  const { desk, isLoading, isError } = useDeskData(authState === "signed-in");
  const rowsRef = useRowKeysContainer<HTMLUListElement>();

  // Print opens the collapsible sections so the handout is whole.
  useEffect(() => {
    const onBeforePrint = () => {
      document.querySelectorAll<HTMLDetailsElement>("details[data-mission-nav-collapsible]").forEach((d) => {
        d.open = true;
      });
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  const isAdmin = roles.includes("administrator");

  const mine = useMemo(() => {
    if (!desk) return [];
    const owned = desk.cards.filter((c) => samePerson(c.owner, user.name));
    // An administrator keeps sight of every prototype file, with the files they
    // own as contracting officer read first.
    if (isAdmin) {
      const rest = desk.cards.filter((c) => !owned.includes(c));
      return [...owned, ...rest];
    }
    if (owned.length > 0) return owned;
    // A requester who owns no files as CO still sees the files they asked for.
    if (roles.includes("requester")) {
      const mine2 = desk.cards.filter((c) => c.requester.toLowerCase() === user.name.toLowerCase());
      if (mine2.length > 0) return mine2;
    }
    // Any other account with no files of its own sees the Center's files, and
    // every prototype file when the Center holds none, so the page is never bare.
    const atCenter = desk.cards.filter((c) => c.m.acq.center_code === user.center_code);
    return atCenter.length > 0 ? atCenter : desk.cards;
  }, [desk, user.name, user.center_code, roles, isAdmin]);

  const ownsMine = useMemo(() => {
    if (!desk) return true;
    return desk.cards.some((c) => samePerson(c.owner, user.name));
  }, [desk, user.name]);

  const isRequesterFallback = useMemo(() => {
    if (!desk || ownsMine || !roles.includes("requester")) return false;
    return desk.cards.some((c) => c.requester.toLowerCase() === user.name.toLowerCase());
  }, [desk, ownsMine, roles, user.name]);

  const isAdminAll = isAdmin;
  const listedCenters = useMemo(
    () => Array.from(new Set(mine.map((c) => c.m.acq.center_code).filter((code): code is string => Boolean(code)))),
    [mine],
  );
  const fallbackScope = listedCenters.length === 1 ? `files at ${listedCenters[0]} are shown` : "all prototype files are shown";

  const live = useMemo(
    () => mine.filter((c) => c.m.clockState !== "launched" && c.m.clockState !== "scrubbed"),
    [mine],
  );

  const waitingOnMe = useMemo(
    () =>
      live.filter((c) => {
        // Writing or attaching a required document is the officer's own work,
        // whoever the blocker names.
        const action = c.m.nextAction ?? "";
        if (/^(write|attach)\b/i.test(action)) return true;
        if (/ is missing$/i.test(c.m.blocker ?? "")) return true;
        const owner = (c.m.blockerOwner ?? "").toLowerCase();
        if (!owner) return c.m.clockState !== "hold";
        return (
          owner.includes("contracting") ||
          owner.includes(surname(user.name)) ||
          samePerson(c.m.blockerOwner ?? "", user.name) ||
          samePerson(c.owner, user.name)
        );
      }),
    [live, user.name],
  );

  const waitingOnOthers = useMemo(
    () => live.filter((c) => !waitingOnMe.includes(c)),
    [live, waitingOnMe],
  );

  const reviewsDue = useMemo(() => {
    if (!desk) return [];
    const ids = new Set(mine.map((c) => c.m.acq.acquisition_id));
    return desk.polls
      .filter((p) => (p.vote ?? "pending") === "pending" && p.acquisition_id && ids.has(p.acquisition_id))
      .sort((a, b) => String(a.due_date ?? "9999").localeCompare(String(b.due_date ?? "9999")));
  }, [desk, mine]);

  const regChanges = useMemo(() => {
    if (!desk) return [];
    const ids = new Set(mine.map((c) => c.m.acq.acquisition_id));
    return desk.modTasks.filter((t) => ids.has(t.acquisition_id));
  }, [desk, mine]);

  const topThree = useMemo(
    () => [...live].sort((a, b) => urgencyRank(a.m) - urgencyRank(b.m)).slice(0, 3),
    [live],
  );

  const pastTarget = live.filter((c) => countdownView(c.m).mode === "overdue").length;
  const stepsOverdue = waitingOnMe.filter((c) => dueView(c.m.nextDecisionDate)?.overdue).length;
  const reviewsThisWeek = reviewsDue.filter((p) => {
    const due = daysUntil(p.due_date);
    return due !== null && due <= 7;
  }).length;
  const scopeNote = isAdmin
    ? ownsMine
      ? `All prototype files are shown, with the files that list ${user.name} as contracting officer first. The owner of record is shown on each file.`
      : `No file lists ${user.name} as the contracting officer, so all prototype files are shown. The owner of record is shown on each file.`
    : !ownsMine
      ? isRequesterFallback
        ? "Showing files where you are the requester of record."
        : `No file lists ${user.name} as the contracting officer, so ${isAdminAll ? "all prototype files are shown" : fallbackScope}. The owner of record is shown on each file.`
      : undefined;

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow={formatDate(new Date().toISOString().slice(0, 10))}
        title="Today"
        lead={`What is waiting on ${user.name}, what is waiting on someone else, and the three things to do next.`}
      />

      {isLoading ? (
        <LoadingNote what="your day" layout="table" />
      ) : isError ? (
        <ErrorNote message="Today did not load. Refresh the page. If it still fails, tell the T-Minus team." />
      ) : (
        <>
          {scopeNote ? <p className="mc-today-scope">{scopeNote}</p> : null}
          <nav className="mc-today-stats" aria-label="Your day in numbers">
            <a href="#today-mine" className="mc-today-stat is-mine">
              <span className="mc-today-stat-value" data-numeric>{waitingOnMe.length}</span>
              <span className="mc-today-stat-label">
                Waiting on me
                {stepsOverdue ? <span className="mc-due is-overdue ml-2" data-numeric>{stepsOverdue} overdue</span> : null}
              </span>
            </a>
            <a href="#today-others" className="mc-today-stat">
              <span className="mc-today-stat-value" data-numeric>{waitingOnOthers.length}</span>
              <span className="mc-today-stat-label">Waiting on someone else</span>
            </a>
            <a href="#today-reviews" className="mc-today-stat">
              <span className="mc-today-stat-value" data-numeric>{reviewsThisWeek}</span>
              <span className="mc-today-stat-label">Reviews due in 7 days or late</span>
            </a>
            <div className={`mc-today-stat${pastTarget ? " is-late" : ""}`}>
              <span className="mc-today-stat-value" data-numeric>{pastTarget}</span>
              <span className="mc-today-stat-label">My open files past target</span>
            </div>
          </nav>

          <div className="mc-today-grid">
            <div className="mc-today-main">
              <Section id="today-mine" title="Waiting on me" count={waitingOnMe.length} lead="Files where the next step belongs to the contracting officer.">
                {waitingOnMe.length === 0 ? (
                  <EmptyState sentence="Nothing is waiting on you right now." />
                ) : (
                  <>
                    <div className="mc-today-strip-head" aria-hidden="true">
                      <span>File</span>
                      <span>T±</span>
                      <span>Next action</span>
                      <span>Owner and due</span>
                      <span>Status</span>
                    </div>
                    <ul ref={rowsRef} className="mc-today-strips">
                      {waitingOnMe.map((c) => {
                        const readiness = explainWorkReadiness(c.m, { acq: c.m.acq, attachedKeys: c.attachedKeys, savedKeys: c.savedKeys }).state;
                        const view = countdownView(c.m);
                        const pos = phasePosition(c.m.phases);
                        const due = dueView(c.m.nextDecisionDate);
                        return (
                          <li
                            key={c.m.acq.acquisition_id}
                            data-row-nav
                            tabIndex={0}
                            className={`mc-work-strip mc-today-strip ${missionReadinessClass(readiness, "is")} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                          >
                            <div className="mc-today-strip-file">
                              <span className="mc-today-strip-title"><FileLink card={c} /></span>
                              <span className="mc-today-meta" data-numeric>
                                {c.m.acq.acquisition_id} · {phasePositionText(pos)}
                                {pos.name ? `, ${pos.name}` : ""}
                              </span>
                            </div>
                            <div className="mc-today-strip-t" data-numeric>
                              <LaunchCountdownCompact view={view} hideBadge={view.mode === "hold"} />
                            </div>
                            <div className="mc-today-strip-next">
                              <span className="mc-today-cell-label">Next action</span>
                              {c.m.nextAction}
                            </div>
                            <div className="mc-today-strip-owner">
                              <span className="mc-today-cell-label">Owner and due</span>
                              <span>{c.owner || "Not recorded"}</span>
                              {due ? (
                                due.overdue ? (
                                  <span className="mc-due is-overdue" data-numeric title={`Planned for ${due.dateText} in the phase plan`}>
                                    {due.text}
                                  </span>
                                ) : (
                                  <span className="mc-today-meta" data-numeric>{due.text}</span>
                                )
                              ) : (
                                <span className="mc-today-meta">No date planned</span>
                              )}
                            </div>
                            <div className="mc-today-strip-chip">
                              <StatusChip label={readiness} tone={READINESS_TONE[readiness]} />
                            </div>
                            <Link
                              to="/files/$acquisitionId"
                              params={{ acquisitionId: c.m.acq.acquisition_id }}
                              hash="launch-sequence"
                              data-row-action="exit"
                              className="sr-only"
                            >
                              Open the launch sequence for {c.m.acq.acquisition_id}
                            </Link>
                            {/^write\b/i.test(c.m.nextAction ?? "") ? (
                              <Link
                                to="/files/$acquisitionId"
                                params={{ acquisitionId: c.m.acq.acquisition_id }}
                                data-row-action="write"
                                className="sr-only"
                              >
                                {c.m.nextAction} on {c.m.acq.acquisition_id}
                              </Link>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    <RowKeysHint className="mt-3" />
                  </>
                )}
              </Section>

              <Section id="today-others" title="Waiting on someone else" count={waitingOnOthers.length} lead="Who owns the next step, and how long they have held it.">
                {waitingOnOthers.length === 0 ? (
                  <EmptyState sentence="No file is waiting on anyone else." />
                ) : (
                  <DataTable
                    label="Files waiting on someone else"
                    rows={waitingOnOthers}
                    rowKey={(c) => c.m.acq.acquisition_id}
                    stackOnMobile
                    columns={[
                      {
                        key: "file",
                        header: "Acquisition",
                        rowHeader: true,
                        width: "34%",
                        cell: (c) => (
                          <span className="grid">
                            <FileLink card={c} />
                            <span className="mc-today-meta" data-numeric>{c.m.acq.acquisition_id}</span>
                          </span>
                        ),
                      },
                      { key: "who", header: "Waiting on", mobileLabel: "Waiting on", cell: (c) => c.m.blockerOwner ?? "Not named" },
                      { key: "why", header: "Reason", mobileLabel: "Reason", cell: (c) => c.m.blocker },
                      {
                        key: "days",
                        header: "Days held",
                        mobileLabel: "Days held",
                        numeric: true,
                        nowrap: true,
                        cell: (c) => {
                          const started = ((c.m.acq as Record<string, unknown>)['hold_started_at'] as string | null) ?? c.m.blockerSince;
                          const d = daysSince(started);
                          return d === null ? <span className="mc-today-meta">Not recorded</span> : d;
                        },
                      },
                    ]}
                  />
                )}
              </Section>
            </div>

            <div className="mc-today-side">
              <Section
                id="today-next"
                title="Three things to do next"
                lead="Ranked by the same urgency the Overview uses. The range is what prior files of the same profile actually took."
              >
                {topThree.length === 0 ? (
                  <EmptyState sentence="No open file needs a next step." />
                ) : (
                  <ol className="mc-today-next">
                    {topThree.map((c, i) => {
                      const readiness = explainWorkReadiness(c.m, { acq: c.m.acq, attachedKeys: c.attachedKeys, savedKeys: c.savedKeys }).state;
                      const view = countdownView(c.m);
                      return (
                        <li key={c.m.acq.acquisition_id} className={`mc-work-strip mc-work-strip-compact ${missionReadinessClass(readiness, "is")}`}>
                          <span className="mc-today-next-n" data-numeric aria-hidden="true">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="mc-today-next-action">{c.m.nextAction}</p>
                            <p className="mc-today-strip-title"><FileLink card={c} /></p>
                            <p className="mc-today-meta" data-numeric>
                              {view.mode === "overdue" ? (
                                <span className="mr-2">{`${view.days} ${dayWord(view.days)} past target · OVERDUE`}</span>
                              ) : (
                                <LaunchCountdownCompact view={view} className="mr-2" />
                              )}
                              {desk ? awardConfidence(c.m.acq, desk.history, desk.plan).sentence : ""}
                            </p>
                          </div>
                          <StatusChip label={readiness} tone={READINESS_TONE[readiness]} />
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Section>

              <Section id="today-reviews" title="Reviews due" count={reviewsDue.length} lead="Open reviews and approvals on your files.">
                {reviewsDue.length === 0 ? (
                  <EmptyState sentence="No review is open on your files." />
                ) : (
                  <ul className="mc-today-list">
                    {reviewsDue.map((p) => {
                      const due = daysUntil(p.due_date);
                      const late = due !== null && due < 0;
                      return (
                        <li key={p.poll_id}>
                          <div className="min-w-0">
                            <Link
                              to="/files/$acquisitionId"
                              params={{ acquisitionId: p.acquisition_id ?? "" }}
                              className="mc-today-list-id"
                            >
                              {p.acquisition_id}
                            </Link>
                            <span className="mc-today-list-main">
                              {p.reviewer_role} · {p.reviewer_name ?? "not named"}
                            </span>
                            <span className="mc-today-meta" data-numeric>
                              {p.phase} ·{" "}
                              {p.due_date
                                ? late
                                  ? `due ${p.due_date}, ${Math.abs(due)} ${dayWord(Math.abs(due))} past due`
                                  : `due ${p.due_date}, ${due} ${dayWord(due)} left`
                                : "no due date recorded"}
                            </span>
                          </div>
                          {late ? <StatusChip label="Past due" tone="atrisk" /> : due !== null && due <= 7 ? <StatusChip label="This week" tone="attention" /> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>

              <details className="mc-nav-section-collapsible mc-today-regs" data-mission-nav-collapsible>
                <summary>
                  <span>Regulation changes touching my files</span>
                  <span className="mc-nav-section-summary">{regChanges.length} recorded</span>
                  <span className="mc-nav-section-toggle" aria-hidden="true" />
                </summary>
                <div className="mc-nav-section-content">
                  <p className="mc-today-meta mb-3">Clause change tasks recorded against your files. Nothing here is inferred.</p>
                  {regChanges.length === 0 ? (
                    <EmptyState
                      sentence="No clause change task is recorded against your files."
                      action={
                        <Link to="/clause-changes" className="text-[15px] text-primary hover:text-primary-hover">
                          Open Clause changes
                        </Link>
                      }
                    />
                  ) : (
                    <ul className="mc-today-list">
                      {regChanges.map((t, i) => (
                        <li key={`${t.acquisition_id}-${t.clause_number}-${i}`}>
                          <div className="min-w-0">
                            <Link
                              to="/files/$acquisitionId"
                              params={{ acquisitionId: t.acquisition_id }}
                              className="mc-today-list-id"
                            >
                              {t.acquisition_id}
                            </Link>
                            <span className="mc-today-list-main">
                              {t.clause_number} · {t.change_kind}
                            </span>
                            <span className="mc-today-meta">
                              {t.status}
                              {t.deadline_date ? ` · deadline ${t.deadline_date}` : ""}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            </div>
          </div>
        </>
      )}
      <PilotKnownGapsLine className="mt-10" />
    </AppShell>
  );
}
