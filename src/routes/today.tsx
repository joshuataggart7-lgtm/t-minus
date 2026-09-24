import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { useDeskData, daysSince, daysUntil, type DeskCard } from "@/lib/desk-data";
import { urgencyRank } from "@/lib/metrics";
import { awardConfidence } from "@/lib/confidence";
import { RowKeysHint, useRowKeysContainer } from "@/components/row-keys";
import { PilotKnownGapsLine } from "@/components/pilot-known-gaps";
import { LaunchCountdownCompact, countdownView } from "@/components/launch-countdown";
import { MissionReadinessChip, missionReadinessClass } from "@/components/mission-control/primitives";
import { explainWorkReadiness } from "@/components/mission-control/readiness";

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

function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6 first:border-0 first:pt-0">
      <h2 className="text-[18px] leading-6 font-medium">{title}</h2>
      {lead ? <p className="mt-1 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">{lead}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TodayPage() {
  const { authState, user, roles } = useRole();
  const { desk, isLoading, isError } = useDeskData(authState === "signed-in");
  const rowsRef = useRowKeysContainer<HTMLUListElement>();

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

  return (
    <AppShell>
      <PageHeader
        title="Today"
        lead={`What is waiting on ${user.name}, what is waiting on someone else, and the three things to do next.`}
      />

      {isLoading ? (
        <LoadingNote what="your day" />
      ) : isError ? (
        <ErrorNote message="Today did not load. Refresh the page; if it fails again, open Seed status to confirm the records loaded." />
      ) : (
        <div className="max-w-[80ch] space-y-8 lg:max-w-none">
          {isAdmin ? (
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {ownsMine
                ? `All prototype files are shown, with the files that list ${user.name} as contracting officer first. The owner of record is shown on each file.`
                : `No file lists ${user.name} as the contracting officer, so all prototype files are shown. The owner of record is shown on each file.`}
            </p>
          ) : !ownsMine ? (
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {isRequesterFallback
                ? "Showing files where you are the requester of record."
                : `No file lists ${user.name} as the contracting officer, so ${
                    isAdminAll ? "all prototype files are shown" : `files at ${user.center_code} are shown`
                  }. The owner of record is shown on each file.`}
            </p>
          ) : null}

          <Section title="Waiting on me" lead="Files where the next step belongs to the contracting officer.">
            {waitingOnMe.length === 0 ? (
              <EmptyState sentence="Nothing is waiting on you right now." />
            ) : (
              <>
                <RowKeysHint />
                <ul ref={rowsRef} className="mt-3 divide-y divide-border border-y border-border">
                  {waitingOnMe.map((c) => {
                    const readiness = explainWorkReadiness(c.m).state;
                    return (
                    <li
                      key={c.m.acq.acquisition_id}
                      data-row-nav
                      tabIndex={0}
                      className={`mc-work-strip ${missionReadinessClass(readiness, "is")} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                        <p className="text-[15px]">
                          <FileLink card={c} />{" "}
                          <span className="text-muted-foreground" data-numeric>
                            {c.m.acq.acquisition_id}
                          </span>
                        </p>
                        <MissionReadinessChip state={readiness} />
                      </div>
                      <p className="text-[13px] leading-[18px] text-muted-foreground">
                        {c.m.currentPhase ?? "Not started"} · {c.m.nextAction}
                      </p>
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
              </>
            )}
          </Section>

          <Section title="Waiting on someone else" lead="Who owns the next step, and how long they have held it.">
            {waitingOnOthers.length === 0 ? (
              <EmptyState sentence="No file is waiting on anyone else." />
            ) : (
              <div className="mc-work-table-wrap">
              <table className="w-full table-fixed border border-border bg-background text-[13px] leading-[18px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-2">Acquisition</th>
                    <th scope="col" className="p-2">Waiting on</th>
                    <th scope="col" className="p-2">Reason</th>
                    <th scope="col" className="p-2">Days held</th>
                  </tr>
                </thead>
                <tbody>
                  {waitingOnOthers.map((c) => {
                    const started =
                      ((c.m.acq as Record<string, unknown>)['hold_started_at'] as string | null) ??
                      c.m.blockerSince;
                    return (
                      <tr key={c.m.acq.acquisition_id} className="border-b border-border last:border-0">
                        <td className="p-2">
                          <FileLink card={c} />
                        </td>
                         <td className="p-2 break-words">{c.m.blockerOwner ?? "Not named"}</td>
                         <td className="p-2 break-words">{c.m.blocker}</td>
                        <td className="p-2" data-numeric>
                          {daysSince(started) ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
               </table>
               </div>
            )}
          </Section>

          <Section title="Reviews due" lead="Open Go/No-go polls on your files.">
            {reviewsDue.length === 0 ? (
              <EmptyState sentence="No poll is open on your files." />
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {reviewsDue.map((p) => {
                  const due = daysUntil(p.due_date);
                  return (
                    <li key={p.poll_id} className="py-3 text-[15px]">
                      <Link
                        to="/files/$acquisitionId"
                        params={{ acquisitionId: p.acquisition_id ?? "" }}
                        className="text-primary hover:text-primary-hover"
                      >
                        {p.acquisition_id}
                      </Link>{" "}
                      — {p.reviewer_role} · {p.reviewer_name ?? "not named"}
                      <span className="block text-[13px] text-muted-foreground" data-numeric>
                        {p.phase} ·{" "}
                        {p.due_date
                          ? due !== null && due < 0
                            ? `due ${p.due_date}, ${Math.abs(due)} days past due`
                            : `due ${p.due_date}, ${due} days left`
                          : "no due date recorded"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            title="Regulation changes touching my files"
            lead="Clause change tasks recorded against your files. Nothing here is inferred."
          >
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
              <ul className="divide-y divide-border border-y border-border">
                {regChanges.map((t, i) => (
                  <li key={`${t.acquisition_id}-${t.clause_number}-${i}`} className="py-3 text-[15px]">
                    <Link
                      to="/files/$acquisitionId"
                      params={{ acquisitionId: t.acquisition_id }}
                      className="text-primary hover:text-primary-hover"
                    >
                      {t.acquisition_id}
                    </Link>{" "}
                    — {t.clause_number} · {t.change_kind}
                    <span className="block text-[13px] text-muted-foreground">
                      {t.status}
                      {t.deadline_date ? ` · deadline ${t.deadline_date}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Three things to do next"
            lead="Ranked by the same urgency the Overview uses. Planned days come from the phase plan; the range is what prior files of the same profile actually took."
          >
            {topThree.length === 0 ? (
              <EmptyState sentence="No open file needs a next step." />
            ) : (
              <ol className="space-y-3">
                {topThree.map((c, i) => {
                  const readiness = explainWorkReadiness(c.m).state;
                  return (
                  <li key={c.m.acq.acquisition_id} className={`mc-work-strip mc-work-strip-compact ${missionReadinessClass(readiness, "is")} text-[15px] leading-[22px]`}>
                    <MissionReadinessChip state={readiness} className="float-right ml-3" />
                    <span className="text-muted-foreground" data-numeric>
                      {i + 1}.
                    </span>{" "}
                    {c.m.nextAction} — <FileLink card={c} />
                    <span className="block text-[13px] leading-[18px] text-muted-foreground" data-numeric>
                      <LaunchCountdownCompact view={countdownView(c.m)} className="mr-2" />
                      {desk
                        ? awardConfidence(c.m.acq, desk.history, desk.plan).sentence
                        : ""}
                    </span>
                  </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </div>
      )}
      <PilotKnownGapsLine className="mt-10" />
    </AppShell>
  );
}
