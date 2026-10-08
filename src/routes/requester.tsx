import { createFileRoute, Link } from "@tanstack/react-router";
import { STORED_LAUNCH_NOTE } from "@/components/mission-control/operational-state";
import { useMemo } from "react";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { useDeskData, daysSince, type DeskCard } from "@/lib/desk-data";
import { phaseCitation, phaseLabel, type PhaseView } from "@/lib/launch-sequence";
import { awardConfidence } from "@/lib/confidence";
import { RequesterLoe } from "@/components/requester-loe";
import { explainWorkReadiness } from "@/components/mission-control/readiness";
import { fileStatusLine } from "@/components/mission-control/file-status";
import { countdownView, type CountdownView } from "@/components/launch-countdown";
import { dayWord } from "@/lib/pluralize";
import { calendarDaysBetween } from "@/lib/calendar-date";
import { formatDate } from "@/lib/metrics";
import { isPostAward, owedRows } from "@/lib/requester-owed";
import { dueView, phasePosition, phasePositionText, plannedDaysToAward } from "@/lib/file-timeline";
import { McPageHeader, StatusChip, WithDetailsPanel, DetailsSection, DetailsList, CiteChip, type StatusTone } from "@/components/ui-mc";

/** The two files walked in the demo, used only as a soft fallback view. */
const SAMPLE_IDS = ["A-2027-0101", "A-2027-0102"];

export const Route = createFileRoute("/requester")({
  head: () => ({
    meta: [
      { title: "Requester portal — T-Minus" },
      {
        name: "description",
        content: "Your requests: what you owe, how long the file has been waiting, and what happens next.",
      },
      { property: "og:title", content: "Requester portal — T-Minus" },
      {
        property: "og:description",
        content: "Your requests: what you owe, how long the file has been waiting, and what happens next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequesterPortal,
});

/** Plain words beside the readiness word, which stays the same word the file page shows. */
const READINESS_WORDS: Record<string, string> = {
  GO: "On track",
  WATCH: "Being watched",
  HOLD: "On hold",
  LAUNCHED: "Awarded",
};

const BADGE_TONE: Record<string, StatusTone> = {
  AWARDED: "launched",
  OVERDUE: "atrisk",
  HOLD: "atrisk",
  FORECAST: "neutral",
};

/** One sentence under the countdown, naming the date it counts to. */
function whenSentence(view: CountdownView, c: DeskCard): string {
  const target = c.m.acq.target_award_date ? String(c.m.acq.target_award_date) : null;
  switch (view.mode) {
    case "launched":
      return c.m.awardDate ? `Awarded ${formatDate(c.m.awardDate)}.` : "Awarded.";
    case "running":
      return `Target award date ${formatDate(target)}.`;
    case "overdue":
      return `The target award date was ${formatDate(target)}.`;
    case "forecast":
      return view.pastTarget
        ? `The forecast award date was ${formatDate(c.m.forecastAwardDate)}. No target date is on file.`
        : `Forecast award ${formatDate(c.m.forecastAwardDate)}. No target date is on file yet.`;
    case "hold":
      return target
        ? `The clock is on hold. Target award date ${formatDate(target)}.`
        : c.m.forecastAwardDate
          ? `The clock is on hold. Forecast award ${formatDate(c.m.forecastAwardDate)}.`
          : "The clock is on hold.";
    default:
      return view.caption.endsWith(".") ? view.caption : `${view.caption}.`;
  }
}

function PhaseTrack({ phases, label }: { phases: PhaseView[]; label: string }) {
  if (phases.length === 0) return null;
  return (
    <div className="mc-req-track" role="img" aria-label={label}>
      {phases.map((p) => (
        <span key={`${p.order}-${p.phase}`} className={`is-${p.status}`} title={`${phaseLabel(p)}: ${p.status}`} />
      ))}
    </div>
  );
}

function RequesterPortal() {
  const { authState, user, roles } = useRole();
  const { desk, isLoading, isError } = useDeskData(authState === "signed-in");

  // Soft fallbacks only. Nothing here changes the record: the requester of
  // record on the samples is left exactly as seeded.
  const { mine, fallback } = useMemo(() => {
    if (!desk) return { mine: [] as DeskCard[], fallback: "none" as "none" | "all" | "samples" };
    const me = user.name.toLowerCase();
    const own = desk.cards.filter((c) => c.requester.toLowerCase() === me);
    if (own.length > 0) return { mine: own, fallback: "none" as const };
    // An administrator named on no request sees every prototype file instead.
    if (roles.includes("administrator")) return { mine: desk.cards, fallback: "all" as const };
    // A signed-in requester or specialist named on no request sees the two demo
    // files, so the portal is never a dead end during the pilot.
    if (roles.includes("requester") || roles.includes("specialist")) {
      const samples = desk.cards.filter((c) => SAMPLE_IDS.includes(c.m.acq.acquisition_id));
      if (samples.length > 0) return { mine: samples, fallback: "samples" as const };
    }
    return { mine: own, fallback: "none" as const };
  }, [desk, user.name, roles]);

  // Everything the cards show, worked out once per file.
  const rows = useMemo(
    () =>
      mine.map((c) => {
        const acq = c.m.acq as Record<string, unknown>;
        const id = c.m.acq.acquisition_id;
        const owed = owedRows(c);
        const missing = owed.filter((o) => !o.present).length;
        const openDays = daysSince((acq['created_at'] as string | null) ?? null);
        // Same fallback the Today page "Days held" uses.
        const holdDays = daysSince(((acq['hold_started_at'] as string | null) ?? c.m.blockerSince) ?? null);
        // An awarded file owes the requester nothing (lib/requester-owed.ts).
        const postAward = isPostAward(c);
        const conf = desk ? awardConfidence(c.m.acq, desk.history, desk.plan) : null;
        const explanation = explainWorkReadiness(c.m, { acq: c.m.acq, attachedKeys: c.attachedKeys, savedKeys: c.savedKeys });
        const readiness = explanation.state;
        // Same countdown the file page clock shows (lib/file-timeline.ts notes the sources).
        const view = countdownView(c.m);
        const position = phasePosition(c.m.phases);
        const currentPhaseView = c.m.phases.find((p) => p.status === "current") ?? null;
        const status = fileStatusLine(explanation, view, currentPhaseView);
        const plannedDays = plannedDaysToAward(c.m.acq, desk?.plan ?? []);
        const waitingOnMe =
          c.m.clockState === "hold" &&
          (c.m.blockerOwner ?? "").toLowerCase().includes(user.name.split(" ")[1]?.toLowerCase() ?? "@@");
        return { c, acq, id, owed, missing, openDays, holdDays, postAward, conf, readiness, view, position, status, plannedDays, waitingOnMe };
      }),
    [mine, desk, user.name],
  );

  const toDo = rows.filter((r) => !r.postAward && (r.missing > 0 || r.waitingOnMe));
  const awarded = rows.filter((r) => r.view.mode === "launched").length;
  const nextAward = rows
    .filter((r) => r.view.mode !== "launched")
    .map((r) => ({ r, date: (r.c.m.acq.target_award_date ? String(r.c.m.acq.target_award_date) : null) ?? r.c.m.forecastAwardDate }))
    .filter((x): x is { r: (typeof rows)[number]; date: string } => Boolean(x.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const officers = Array.from(new Set(rows.map((r) => r.c.owner).filter(Boolean)));

  const panel = (
    <>
      <DetailsSection title="At a glance">
        <DetailsList
          items={[
            { term: "Requests", value: <span data-numeric>{rows.length}</span> },
            { term: "Need something from you", value: <span data-numeric>{toDo.length}</span> },
            { term: "Awarded", value: <span data-numeric>{awarded}</span> },
          ]}
        />
      </DetailsSection>
      <DetailsSection title="Next expected award">
        {nextAward ? (
          <div className="mc-req-next-award">
            <p className="mc-req-next-award-date" data-numeric>{formatDate(nextAward.date)}</p>
            <a href={`#req-${nextAward.r.id}`} className="mc-req-next-award-file">
              <span className="mc-req-id" data-numeric>{nextAward.r.id}</span>
              <span>{String(nextAward.r.acq['title'] ?? nextAward.r.id)}</span>
            </a>
            <p className="mc-req-meta">{nextAward.r.view.mode === "forecast" ? "Forecast; no target date on file yet." : "Target award date on the record."}</p>
          </div>
        ) : (
          <p className="mc-req-panel-text">No open request has a date yet.</p>
        )}
      </DetailsSection>
      {officers.length > 0 ? (
        <DetailsSection title={officers.length === 1 ? "Your contracting officer" : "Your contracting officers"}>
          <ul className="mc-req-panel-list">
            {officers.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </DetailsSection>
      ) : null}
      <DetailsSection title="How dates are counted">
        <p className="mc-req-panel-text">
          The countdown and the phase count come from the same launch sequence the file page uses, so a request
          reads the same here and on its file. Planned days are calendar days in the phase plan for the buy's type,
          from intake to award.
        </p>
      </DetailsSection>
      <DetailsSection title="Something new to buy?">
        <p className="mc-req-panel-text">Start an intake. Nothing is stored until you start the clock.</p>
        <Link to="/intake" className="mc-req-button mt-3">
          Start an intake
        </Link>
      </DetailsSection>
    </>
  );

  return (
    <AppShell kit>
      <McPageHeader
        title="Requester portal"
        lead={`Your requests, ${user.name}: when each should be awarded, what the contracting office still needs from you, and what happens next.`}
        actions={
          <Link to="/intake" className="mc-req-button">
            Start an intake
          </Link>
        }
      />

      {isLoading ? (
        <LoadingNote what="your requests" layout="cards" />
      ) : isError ? (
        <ErrorNote message="Your requests did not load. Refresh the page. If it still fails, tell the T-Minus team." />
      ) : mine.length === 0 ? (
        <EmptyState
          sentence="No file on this prototype lists you as the requester."
          action={
            <Link to="/intake" className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground">
              Start an intake
            </Link>
          }
        />
      ) : (
        <WithDetailsPanel panel={panel} panelLabel="Your requests at a glance">
          <div className="space-y-6">
            {fallback === "all" ? (
              <p className="mc-req-fallback">
                No file lists {user.name} as the requester, so all prototype files are shown. The requester of
                record is shown on each file.
              </p>
            ) : fallback === "samples" ? (
              <p className="mc-req-fallback">
                These are demo files; you are not the requester of record. The requester of record is shown on each file.
              </p>
            ) : null}

            <section className="mc-req-todo" aria-labelledby="req-todo-title">
              <h2 id="req-todo-title" className="mc-req-h">Your to-do</h2>
              {toDo.length === 0 ? (
                <p className="mc-req-todo-clear">Nothing is waiting on you right now.</p>
              ) : (
                <ul className="mc-req-todo-list">
                  {toDo.map((r) => (
                    <li key={r.id}>
                      <span className="mc-req-todo-id" data-numeric>{r.id}</span>
                      <span className="mc-req-todo-title">{String(r.acq['title'] ?? r.id)}</span>
                      <span className="mc-req-todo-what">
                        {[
                          r.waitingOnMe ? "On hold waiting on your organization" : null,
                          r.owed.some((o) => !o.present)
                            ? `Needed from you: ${r.owed.filter((o) => !o.present).map((o) => o.label).join(", ")}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(". ")}
                      </span>
                      <a href={`#req-${r.id}`} className="mc-req-todo-go" aria-label={`Go to ${r.id}`}>
                        Go to request
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {rows.map((r) => {
              const { c, acq, id, owed, missing, view } = r;
              const titleId = `req-${id}-title`;
              const word = READINESS_WORDS[r.readiness] ?? r.readiness;
              const positionText = phasePositionText(r.position);
              const onHold = c.m.clockState === "hold" || r.readiness === "HOLD";
              return (
                <article key={id} id={`req-${id}`} aria-labelledby={titleId} className={`mc-req-card is-${r.readiness.toLowerCase()}`}>
                  <header className="mc-req-card-head">
                    <div className="min-w-0">
                      <p className="mc-req-id" data-numeric>{id}</p>
                      <h2 id={titleId} className="mc-req-title">
                        <Link to="/files/$acquisitionId" params={{ acquisitionId: id }}>
                          {String(acq['title'] ?? id)}
                        </Link>
                      </h2>
                      {/* Same copy tag as Files: a copied sample names the file it came from. */}
                      {String(acq['source_tag'] ?? "").startsWith("Copy of") ? (
                        <p className="mc-req-meta">{String(acq['source_tag'])}</p>
                      ) : null}
                    </div>
                    <div className="mc-req-state">
                      <StatusChip label={r.readiness} className="is-lg" />
                      <span className="mc-req-state-word">{word}</span>
                    </div>
                  </header>
                  {(c.m.acq as Record<string, unknown>)['__stored_launched'] ? (
                    <p className="mc-req-meta mt-2">{STORED_LAUNCH_NOTE}</p>
                  ) : null}

                  <div className="mc-req-body">
                    <div className="mc-req-cols">
                      <section className="mc-req-col" aria-label="When">
                        <h3 className="mc-req-h">When</h3>
                        <div className="mc-req-count" data-numeric>
                          {view.days === null ? (
                            <span className="mc-req-count-num is-muted">{view.mode === "stopped" ? "Stopped" : "Not started"}</span>
                          ) : (
                            <>
                              <span className={`mc-req-count-num is-${view.tone}`}>
                                {view.prefix ?? ""}
                                {view.days}
                              </span>
                              <span className="mc-req-count-unit">
                                {view.pastTarget ? `${dayWord(view.days)} past target` : dayWord(view.days)}
                              </span>
                            </>
                          )}
                          {view.badge ? <StatusChip label={view.badge} tone={BADGE_TONE[view.badge] ?? "neutral"} /> : null}
                        </div>
                        <p className="mc-req-text">{whenSentence(view, c)}</p>

                        <p className="mc-req-text mt-4">
                          <span className="font-medium" data-numeric>{positionText}</span>
                          {r.position.name ? `: ${r.position.name}` : ""}
                        </p>
                        <PhaseTrack
                          phases={c.m.phases}
                          label={`${positionText}${r.position.name ? `, ${r.position.name}` : ""}. ${r.position.completed} of ${r.position.total} phases complete.`}
                        />
                        <dl className="mc-req-facts">
                          <div>
                            <dt>Planned time to award</dt>
                            <dd data-numeric>{r.plannedDays > 0 ? `${r.plannedDays} calendar days` : "No phase plan for this type"}</dd>
                          </div>
                          <div>
                            {r.c.m.awardDate ? (
                              <>
                                <dt>Took</dt>
                                <dd data-numeric>
                                  {(() => {
                                    const created = (r.acq['created_at'] as string | null) ?? null;
                                    const took = created ? calendarDaysBetween(created.slice(0, 10), String(r.c.m.awardDate).slice(0, 10)) : NaN;
                                    return Number.isNaN(took) || took < 0
                                      ? `Awarded on ${formatDate(String(r.c.m.awardDate))}`
                                      : `${took} ${dayWord(took)} from intake to award`;
                                  })()}
                                </dd>
                              </>
                            ) : (
                              <>
                                <dt>Open for</dt>
                                <dd data-numeric>{r.openDays === null ? "Start not recorded" : `${r.openDays} ${dayWord(r.openDays)}`}</dd>
                              </>
                            )}
                          </div>
                          {onHold ? (
                            <div>
                              <dt>On hold for</dt>
                              <dd data-numeric>{r.holdDays === null ? "Start not recorded" : `${r.holdDays} ${dayWord(r.holdDays)}`}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </section>

                      <section className="mc-req-col" aria-label="What you owe">
                        <h3 className="mc-req-h">What you owe</h3>
                        {r.postAward ? (
                          <>
                            <p className="mc-req-done">Nothing. This request is awarded.</p>
                            <p className="mc-req-meta mt-2">
                              The contracting office runs the contract from here. Questions go to {c.owner}.
                            </p>
                          </>
                        ) : (
                          <>
                            {r.waitingOnMe ? (
                              <p className="mc-req-callout is-attention">This file is on hold waiting on your organization.</p>
                            ) : null}
                            <ul className="mc-req-owed">
                              {owed.map((o) => (
                                <li key={o.label}>
                                  <span className="min-w-0">
                                    <span className="mc-req-owed-label">{o.label}</span>
                                    <span className="mc-req-meta">{o.note}</span>
                                  </span>
                                  <StatusChip label={o.present ? "On file" : "Needed"} tone={o.present ? "ontrack" : "attention"} />
                                </li>
                              ))}
                            </ul>
                            <p className="mc-req-text mt-2" data-numeric>
                              {missing ? `${missing} of ${owed.length} still needed from you.` : "Nothing outstanding from you."}
                            </p>
                          </>
                        )}
                        <Link
                          to="/forms/$formKey/$acquisitionId"
                          params={{ formKey: "nf-1707", acquisitionId: id }}
                          className="mc-req-link"
                        >
                          Open the NF 1707 intake
                        </Link>
                      </section>

                      <section className="mc-req-col mc-req-next" aria-label="What happens next">
                        <h3 className="mc-req-h">What happens next</h3>
                        <p className="mc-req-lead">{c.m.nextAction}</p>
                        {c.m.hold ? (
                          <p className="mc-req-callout is-atrisk">
                            On hold: {c.m.hold.reason}. Owner {c.m.hold.owner}.
                          </p>
                        ) : r.status.reason ? (
                          <p className="mc-req-callout is-attention">Why it is flagged: {r.status.reason}</p>
                        ) : null}
                        <p className="mc-req-text mt-2">
                          Next step: {c.m.nextDecision}.
                          {(() => {
                            const due = dueView(c.m.nextDecisionDate);
                            if (!due) return null;
                            return due.overdue ? (
                              <>
                                {" "}Planned for {due.dateText} in the phase plan.{" "}
                                <span className="mc-due is-overdue" data-numeric>{due.text}</span>
                              </>
                            ) : (
                              <>
                                {" "}Planned by {due.dateText} in the phase plan,{" "}
                                {due.days === 0 ? "today" : `${due.days} ${dayWord(due.days)} from now`}.
                              </>
                            );
                          })()}
                        </p>
                        <dl className="mc-req-facts">
                          <div>
                            <dt>Contracting officer</dt>
                            <dd>{c.owner}</dd>
                          </div>
                          <div>
                            <dt>Mission</dt>
                            <dd>{c.mission}</dd>
                          </div>
                          <div>
                            <dt>Rules for this phase</dt>
                            <dd>
                              <CiteChip cite={phaseCitation(c.m.currentPhase ?? "", c.m.acq)} label="Phase authority" />
                            </dd>
                          </div>
                        </dl>
                      </section>
                    </div>

                    <details className="mc-req-co">
                      <summary>
                        <span className="mc-req-co-title">How the contracting office plans this</span>
                        <span className="mc-req-meta">Contracting officer workload: hours, stages and what drives them</span>
                      </summary>
                      <div className="mc-req-co-body">
                        <RequesterLoe acq={acq} plan={desk?.plan ?? []} confidence={r.conf} missingCount={missing} />
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        </WithDetailsPanel>
      )}
    </AppShell>
  );
}
