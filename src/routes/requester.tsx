import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { useDeskData, daysSince, type DeskCard } from "@/lib/desk-data";
import { phaseCitation } from "@/lib/launch-sequence";
import { statusColor } from "@/lib/metrics";
import { awardConfidence } from "@/lib/confidence";
import { RequesterLoe } from "@/components/requester-loe";

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

type Owed = { label: string; present: boolean; note: string };

/** What the requester owes, read from the record only. Nothing is invented. */
function owedRows(card: DeskCard): Owed[] {
  const acq = card.m.acq as Record<string, unknown>;
  const answers = acq['nf1707_answers'];
  const answered =
    answers && typeof answers === "object" ? Object.keys(answers as Record<string, unknown>).length : 0;
  const attached = card.attachedKeys;
  return [
    {
      label: "Purchase request number",
      present: Boolean(acq['pr_number']),
      note: acq['pr_number'] ? String(acq['pr_number']) : "Not on the record yet.",
    },
    {
      label: "NF 1707 intake answers",
      present: answered > 0,
      note: answered > 0 ? `${answered} answers recorded.` : "No answers recorded yet.",
    },
    {
      label: "Statement of work",
      present: Boolean(acq['sow_attached']) || attached.has("sow"),
      note: "Recorded on the file by the requesting organization.",
    },
    {
      label: "Independent government cost estimate",
      present: Boolean(acq['igce_attached']) || attached.has("igce"),
      note: "Recorded on the file by the requesting organization.",
    },
  ];
}

function RequesterPortal() {
  const { authState, user, roles } = useRole();
  const { desk, isLoading, isError } = useDeskData(authState === "signed-in");

  const mine = useMemo(() => {
    if (!desk) return [];
    const me = user.name.toLowerCase();
    const own = desk.cards.filter((c) => c.requester.toLowerCase() === me);
    // An administrator named on no request sees every prototype file instead.
    if (own.length === 0 && roles.includes("administrator")) return desk.cards;
    return own;
  }, [desk, user.name, roles]);

  const showingAll = useMemo(
    () => Boolean(desk) && mine.length > 0 && !desk!.cards.some((c) => c.requester.toLowerCase() === user.name.toLowerCase()),
    [desk, mine, user.name],
  );

  return (
    <AppShell>
      <PageHeader
        title="Requester portal"
        lead={`Requests recorded under ${user.name}. Each panel reads from the record on the file.`}
      />

      {isLoading ? (
        <LoadingNote what="your requests" />
      ) : isError ? (
        <ErrorNote message="Your requests did not load. Refresh the page; if it fails again, open Seed status to confirm the records loaded." />
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
        <div className="space-y-10">
          {showingAll ? (
            <p className="max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">
              No file lists {user.name} as the requester, so all prototype files are shown. The requester of
              record is shown on each file.
            </p>
          ) : null}
          {mine.map((c) => {
            const acq = c.m.acq as Record<string, unknown>;
            const id = c.m.acq.acquisition_id;
            const owed = owedRows(c);
            const missing = owed.filter((o) => !o.present).length;
            const openDays = daysSince((acq['created_at'] as string | null) ?? null);
            const holdDays = daysSince((acq['hold_started_at'] as string | null) ?? null);
            const waitingOnMe =
              c.m.clockState === "hold" &&
              (c.m.blockerOwner ?? "").toLowerCase().includes(user.name.split(" ")[1]?.toLowerCase() ?? "@@");
            return (
              <section key={id} aria-label={String(acq['title'] ?? id)} className="border-t border-border pt-6 first:border-0 first:pt-0">
                <h2 className="text-[18px] leading-6 font-medium">
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: id }}
                    className="text-primary hover:text-primary-hover"
                  >
                    {String(acq['title'] ?? id)}
                  </Link>
                </h2>

                <div className="mt-4 grid gap-8 lg:grid-cols-2">
                  <div>
                    <h3 className="text-[15px] font-medium">Your file</h3>
                    <dl className="mt-2 grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1 text-[15px] leading-[22px]">
                      <dt className="text-muted-foreground">Acquisition</dt>
                      <dd data-numeric>{id}</dd>
                      <dt className="text-muted-foreground">Contracting officer</dt>
                      <dd>{c.owner}</dd>
                      <dt className="text-muted-foreground">Current phase</dt>
                      <dd>{c.m.currentPhase ?? "Not started"}</dd>
                      <dt className="text-muted-foreground">Clock</dt>
                      <dd>
                        <StatusMark color={statusColor(c.m.status)}>
                          {c.m.clockState === "hold"
                            ? "On hold"
                            : c.m.clockState === "launched"
                              ? "Launched"
                              : "Running"}
                          {" · "}
                          {c.m.status}
                        </StatusMark>
                      </dd>
                      <dt className="text-muted-foreground">Mission</dt>
                      <dd>{c.mission}</dd>
                    </dl>
                    <p className="mt-3 text-[13px] leading-[18px] text-muted-foreground">
                      Phase authority: {phaseCitation(c.m.currentPhase ?? "", c.m.acq)}.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-[15px] font-medium">What you owe</h3>
                    <ul className="mt-2 divide-y divide-border border-y border-border">
                      {owed.map((o) => (
                        <li key={o.label} className="flex items-baseline justify-between gap-4 py-2 text-[15px]">
                          <span>
                            {o.label}
                            <span className="block text-[13px] text-muted-foreground">{o.note}</span>
                          </span>
                          <StatusMark color={o.present ? "var(--ontrack)" : "var(--attention)"}>
                            {o.present ? "Present" : "Missing"}
                          </StatusMark>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[13px] text-muted-foreground" data-numeric>
                      {missing} of {owed.length} items still missing.
                    </p>
                    <Link
                      to="/intake/$acquisitionId"
                      params={{ acquisitionId: id }}
                      className="mt-3 inline-block text-[15px] text-primary hover:text-primary-hover"
                    >
                      Open the NF 1707 intake
                    </Link>
                  </div>

                  <div>
                    <h3 className="text-[15px] font-medium">Days costing</h3>
                    <dl className="mt-2 grid grid-cols-[minmax(0,14rem)_1fr] gap-x-4 gap-y-1 text-[15px] leading-[22px]">
                      <dt className="text-muted-foreground">Days since the file opened</dt>
                      <dd data-numeric>{openDays ?? "—"}</dd>
                      <dt className="text-muted-foreground">Days on hold</dt>
                      <dd data-numeric>{c.m.clockState === "hold" ? (holdDays ?? "—") : "Not on hold"}</dd>
                      <dt className="text-muted-foreground">Days to award</dt>
                      <dd data-numeric>
                        {c.m.clockState === "launched"
                          ? `Launched ${c.m.daysSinceAward ?? 0} days ago`
                          : (c.m.daysToAward ?? "Clock not started")}
                      </dd>
                    </dl>
                    <p className="mt-2 text-[13px] leading-[18px] text-muted-foreground">
                      {waitingOnMe
                        ? "This file is waiting on the requesting organization."
                        : "Counted from the dates on the record, not from an estimate."}
                    </p>
                    {desk ? (
                      <p className="mt-2 max-w-[70ch] text-[13px] leading-[18px] text-muted-foreground">
                        {awardConfidence(c.m.acq, desk.history, desk.plan).sentence}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-[15px] font-medium">What happens next</h3>
                    <p className="mt-2 max-w-[70ch] text-[15px] leading-[22px]">{c.m.nextAction}</p>
                    {c.m.hold ? (
                      <p className="mt-2 max-w-[70ch] border-l-2 pl-3 text-[15px]" style={{ borderColor: "var(--atrisk)" }}>
                        On hold: {c.m.hold.reason}. Owner {c.m.hold.owner}.
                      </p>
                    ) : null}
                    <p className="mt-2 text-[13px] leading-[18px] text-muted-foreground">
                      Next decision: {c.m.nextDecision}
                      {c.m.nextDecisionDate ? ` by ${c.m.nextDecisionDate}` : ""}.
                    </p>
                  </div>
                </div>

                <div className="mt-8 border-t border-border pt-6">
                  <RequesterLoe
                    acq={acq}
                    plan={desk?.plan ?? []}
                    awardRange={null}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
