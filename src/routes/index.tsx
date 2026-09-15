import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadModTasks, modsByCenter } from "@/lib/clause-impact";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { ExclusionsSweepPanel } from "@/components/exclusions-sweep-panel";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import { daysBetween, todayISO, type RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow } from "@/lib/launch-sequence";
import {
  itemsFromRefs,
  itemsFromWatchRows,
  loadRegRefs,
  loadWatchRows,
  sortNewestFirst,
  withinDays,
} from "@/lib/watch";
import { SmallBusinessPanel } from "@/components/small-business-panel";
import { CentersTab, type CenterDocumentRow, type CenterTemplateRow } from "@/components/centers-tab";
import { successorRows } from "@/lib/successor";
import { agingItems, agingByCenter, type CenterRow, type UserRow } from "@/lib/aging";
import type { ThresholdRow } from "@/lib/small-business";
import {
  callout,
  computeMetrics,
  awardDateFor,
  formatDate,
  holdSince,
  missionDriver,
  statusColor,
  urgencyRank,
  type AcqMetrics,
  type MissionRow,
} from "@/lib/metrics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Executive Overview — T-Minus" },
      {
        name: "description",
        content:
          "T-Minus turns acquisition time into mission readiness: phase, next decision, days to award, and the blocker for every priority project.",
      },
      { property: "og:title", content: "Executive Overview — T-Minus" },
      {
        property: "og:description",
        content: "Mission readiness, next decision, and days to award for every priority project.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExecutiveOverview,
});


function StatusWordTag({ status }: { status: AcqMetrics["status"] }) {
  return (
    <StatusMark color={statusColor(status)} className="text-[15px] leading-[22px]">
      {status}
    </StatusMark>
  );
}


export function ExecutiveOverview() {
  const { authState } = useRole();
  const [tab, setTab] = useState<"acquisitions" | "centers" | "enterprise">("acquisitions");

  const q = useQuery({
    queryKey: ["executive-overview"],
    enabled: authState === "signed-in",
    refetchInterval: 5000,
    queryFn: async () => {
      const [missions, acqs, plan, rules, overrides, thresholds, strategies, polls, log, watchRows, refs] = await Promise.all([
        supabase.from("missions").select("*").order("priority"),
        supabase.from("acquisition_facts").select("*").order("acquisition_id"),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("review_rules").select("*"),
        supabase.from("center_overrides").select("*"),
        supabase.from("thresholds").select("*"),
        supabase.from("enterprise_strategies").select("*"),
        supabase.from("polls").select("*"),
        supabase
          .from("audit_log")
          .select("acquisition_id,action,actor,logged_at,phase")
          .order("logged_at", { ascending: false })
          .limit(500),
        loadWatchRows(),
        loadRegRefs(),
      ]);
      const [centers, users, documents, templateRows] = await Promise.all([
        supabase.from("centers").select("center_code,center_name,aging_threshold_days"),
        supabase.from("users").select("name,role,title,center_code,supervisor_name,supervisor_email"),
        supabase.from("documents").select("acquisition_id,template_id,saved_at,version"),
        supabase.from("templates").select("template_id,name,hq_revision_date"),
      ]);
      return {
        missions: (missions.data ?? []) as MissionRow[],
        acqs: (acqs.data ?? []) as unknown as AcqRow[],
        plan: (plan.data ?? []) as PhasePlanRow[],
        rules: (rules.data ?? []) as ReviewRuleRow[],
        overrides: overrides.data ?? [],
        thresholds: thresholds.data ?? [],
        strategies: strategies.data ?? [],
        polls: (polls.data ?? []) as PollRow[],
        centers: (centers.data ?? []) as unknown as CenterRow[],
        users: (users.data ?? []) as unknown as UserRow[],
        documents: (documents.data ?? []) as unknown as CenterDocumentRow[],
        templates: (templateRows.data ?? []) as unknown as CenterTemplateRow[],
        log: log.data ?? [],
        watch: sortNewestFirst([...itemsFromWatchRows(watchRows), ...itemsFromRefs(refs)]),
      };
    },
  });

  const ref: RefData = useMemo(
    () => ({
      thresholds: (q.data?.thresholds ?? []).map((t) => ({
        name: t.name,
        value: t.value === null ? null : Number(t.value),
        citation: t.citation,
        note: t.note,
      })),
      overrides: (q.data?.overrides ?? []) as unknown as CenterOverrideRow[],
      phasePlan: (q.data?.plan ?? []).map((p) => ({
        acquisition_type: p.acquisition_type,
        phase: p.phase,
        planned_days: p.planned_days,
      })),
      strategies: (q.data?.strategies ?? []).map((s) => ({
        psl: s.psl,
        name: s.name,
        buying_location: s.buying_location,
        mandatory_vehicles: s.mandatory_vehicles,
        required_coordination: s.required_coordination,
      })),
    }),
    [q.data],
  );

  const metrics: AcqMetrics[] = useMemo(() => {
    if (!q.data) return [];
    return q.data.acqs.map((acq) =>
      computeMetrics(acq, {
        roster: q.data.people ?? [],
        plan: q.data.plan,
        rules: q.data.rules,
        polls: q.data.polls,
        ref,
        mission: q.data.missions.find((m) => m.mission_id === acq.mission_id) ?? null,
        holdSince: holdSince(acq.acquisition_id, q.data.log),
        awardDate: awardDateFor(acq.acquisition_id, q.data.log, acq.target_award_date ?? null),
      }),
    );
  }, [q.data, ref]);

  const missionRows = useMemo(() => {
    if (!q.data) return [];
    return [...q.data.missions]
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .map((mission) => ({
        mission,
        driver: missionDriver(metrics.filter((m) => m.acq.mission_id === mission.mission_id)),
      }))
      .filter((r) => r.driver) as { mission: MissionRow; driver: AcqMetrics }[];
  }, [q.data, metrics]);

  const callouts = useMemo(
    () =>
      missionRows
        .filter((r) => r.driver.status !== "On Track")
        .sort((a, b) => urgencyRank(a.driver) - urgencyRank(b.driver))
        .map((r) => ({ id: r.mission.mission_id, acq: r.driver.acq.acquisition_id, text: callout(r.driver, r.mission) })),
    [missionRows],
  );

  // Stamped when this page loads, so a reader knows how fresh the figures are.
  const [computedAt, setComputedAt] = useState("");
  useEffect(() => {
    setComputedAt(new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
  }, []);

  const summary = useMemo(() => {
    const today = todayISO();
    const qStart = quarterStart(today);
    const count = (s: AcqMetrics["status"]) => metrics.filter((m) => m.status === s).length;
    const launchedThisQuarter = metrics.filter(
      (m) =>
        m.clockState === "launched" &&
        m.awardDate &&
        m.awardDate >= qStart &&
        m.awardDate <= today,
    ).length;
    return [
      { label: "At Risk", count: count("At Risk"), color: "var(--atrisk)" },
      { label: "Needs Attention", count: count("Needs Attention"), color: "var(--attention)" },
      { label: "On Track", count: count("On Track"), color: "var(--ontrack)" },
      { label: "Launched this quarter", count: launchedThisQuarter, color: "var(--panel-muted)" },
    ];
  }, [metrics]);


  return (
    <AppShell wide>
      <PageHeader title="Executive Overview" lead="T-Minus turns acquisition time into mission readiness." />

      {q.isError ? (
        <ErrorNote message="The overview did not load. Refresh the page; if it fails again, open Seed status to confirm the records loaded." />
      ) : null}

      <section
        aria-label="Mission clock"
        className="mb-8 w-full rounded-lg bg-panel px-5 py-4 text-panel-foreground sm:px-8 sm:py-5"
      >
        <p className="text-[13px] text-panel-muted">Priority projects on the clock</p>
        {q.isLoading ? (
          <p role="status" className="mt-4 text-panel-muted">
            Loading the priority projects.
          </p>
        ) : missionRows.length === 0 ? (
          <p className="mt-4 text-panel-muted">No priority projects are loaded yet.</p>
        ) : (
          <>
            <ul
              aria-label="Status summary"
              className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-panel-muted/30 pb-3"
            >
              <li className="text-[13px] text-panel-muted">Across {metrics.length} acquisitions</li>
              {summary.map((s) => (
                <li key={s.label} className="flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 shrink-0 translate-y-[-1px] rounded-[2px]"
                    style={{ background: s.color }}
                  />
                  <span className="text-[18px] leading-6 font-semibold" data-numeric>
                    {s.count}
                  </span>
                  <span className="text-[13px] text-panel-muted">{s.label}</span>
                </li>
              ))}
            </ul>

            <ul className="mt-2 divide-y divide-panel-muted/30">
              {missionRows.map(({ mission, driver }) => (
                <MissionClockRow key={mission.mission_id} mission={mission} driver={driver} />
              ))}
            </ul>
          </>
        )}
      </section>

      {computedAt ? (
        <p className="-mt-6 mb-8 text-[13px] text-muted-foreground" data-numeric>
          Computed at {computedAt}
        </p>
      ) : null}

      <section aria-label="What leadership needs to know now" className="mb-10">
        <h2 className="section-title text-[18px] leading-6 font-medium">What leadership needs to know now</h2>
        {q.isLoading ? (
          <LoadingNote what="the leadership callouts" />
        ) : callouts.length === 0 ? (
          <p className="mt-3 text-muted-foreground">Every priority project is On Track.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {callouts.map((c) => (
              <li key={c.id}>
                <Link
                  to="/files/$acquisitionId"
                  params={{ acquisitionId: c.acq }}
                  className="block max-w-[80ch] border-l-2 py-1 pl-3 text-[15px] leading-[22px] text-foreground"
                  style={{ borderColor: "var(--atrisk)" }}
                >
                  {c.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WatchCard items={q.data?.watch ?? []} />

      <div role="tablist" aria-label="Overview detail" className="mb-6 flex gap-6 border-b border-border">
        {(["acquisitions", "centers", "enterprise"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "-mb-px border-b-2 border-primary px-1 pb-2 text-[15px] font-medium text-foreground"
                : "-mb-px border-b-2 border-transparent px-1 pb-2 text-[15px] text-muted-foreground hover:text-foreground"
            }
          >
            {t === "acquisitions" ? "Acquisitions" : t === "centers" ? "Centers" : "Enterprise"}
          </button>
        ))}
      </div>

      {tab === "acquisitions" ? (
        <ClockBoard
          metrics={metrics}
          plan={q.data?.plan ?? []}
          thresholds={ref.thresholds}
          polls={q.data?.polls ?? []}
          centers={q.data?.centers ?? []}
          users={q.data?.users ?? []}
        />
      ) : tab === "centers" ? (
        <CentersTab
          metrics={metrics}
          polls={q.data?.polls ?? []}
          centers={q.data?.centers ?? []}
          users={q.data?.users ?? []}
          documents={q.data?.documents ?? []}
          templates={q.data?.templates ?? []}
        />
      ) : (
        <EnterpriseTab metrics={metrics} missionRows={missionRows} log={q.data?.log ?? []} polls={q.data?.polls ?? []} rules={q.data?.rules ?? []} />
      )}
    </AppShell>
  );
}

/** Colour of the rule and word on the navy panel, paired with the status word. */
function panelStatusColor(status: AcqMetrics["status"]) {
  if (status === "Launched") return "var(--panel-muted)";
  return statusColor(status);
}

/** Short, always-fitting wording for a blocker or next decision. */
function shortReason(text: string) {
  // Drop parentheticals and section prefixes; they never fit on one line.
  const t = String(text ?? "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^[A-Za-z ]+:\s*/, "")
    .trim();

  const vote = /^(.+?)\s+has not voted$/i.exec(t);
  if (vote) return `Awaiting ${vote[1]!.trim().split(/\s+/)[0]!.toLowerCase()} review`;

  const missing = /^(.+?)\s+is missing$/i.exec(t);
  if (missing) return `${abbreviate(missing[1]!)} missing`;

  const exit = /^Exit\s+(.+)$/i.exec(t);
  if (exit) return `Exit ${exit[1]}`;

  return t.length > 24 ? `${abbreviate(t)}` : t;
}

/** Three or more words become initials, the way COs write them. */
function abbreviate(label: string) {
  const words = label.trim().split(/\s+/);
  if (label.length <= 22) return label;
  const useful = words.filter((w) => !/^(of|the|and|for|a|an|to)$/i.test(w));
  if (useful.length >= 3) return useful.map((w) => w[0]!.toUpperCase()).join("");
  return `${label.slice(0, 21)}…`;
}

/** One priority project on the Mission Clock. Kept under 110px tall. */
function MissionClockRow({ mission, driver }: { mission: MissionRow; driver: AcqMetrics }) {
  const [expanded, setExpanded] = useState(false);
  const color = panelStatusColor(driver.status);
  const atRisk = driver.status === "At Risk";

  const holdDays = driver.blockerSince ? Math.max(0, daysBetween(driver.blockerSince, todayISO())) : null;
  const onTrack = driver.status === "On Track";
  const fullLine = onTrack
    ? `Next: ${driver.nextDecision}`
    : [driver.blocker, driver.blockerOwner ?? null, holdDays === null ? null : `${holdDays} days`]
        .filter(Boolean)
        .join(" · ");
  const shortLine = onTrack
    ? `Next: ${shortReason(driver.nextDecision)}`
    : [
        shortReason(driver.blocker),
        driver.blockerOwner
          ? String(driver.blockerOwner)
              .replace(/\s*\([^)]*\)/g, "")
              .replace(/^[A-Za-z /]+:\s*/, "")
              .trim()
          : null,
        holdDays === null ? null : `${holdDays}d`,
      ]
        .filter(Boolean)
        .join(" · ");

  const decision =
    driver.daysToNextDecision === null
      ? null
      : driver.daysToNextDecision < 0
        ? { text: `${Math.abs(driver.daysToNextDecision)} days overdue`, overdue: true }
        : { text: String(driver.daysToNextDecision), overdue: false };

  return (
    <li className="border-l-4 py-1.5 pl-4" style={{ borderLeftColor: color }}>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_auto_auto_minmax(0,1.4fr)]">
        <div className="min-w-0">
          <Link
            to="/files/$acquisitionId"
            params={{ acquisitionId: driver.acq.acquisition_id }}
             className="block rounded text-[18px] leading-6 font-medium text-panel-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-panel-foreground"
          >
            {mission.name}
          </Link>
           <p className="mt-0.5 text-[13px] leading-[18px] text-panel-muted">
            {mission.milestone ?? "Milestone"} · Mission date {formatDate(mission.milestone_date)}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[15px] leading-[22px]">{driver.currentPhase ?? "Not started"}</p>
          <p className="mt-0.5 text-[13px] leading-[18px] text-panel-muted">
            {driver.nextAction}
          </p>
        </div>

        <div>
          {decision === null ? (
            <p className="text-[15px] leading-[22px] text-panel-muted">Clock not started</p>
          ) : (
            <p
              className={decision.overdue ? "text-[18px] leading-6 font-semibold" : "clock-figure"}
              style={decision.overdue ? { color } : undefined}
              data-numeric
            >
              {decision.text}
            </p>
          )}
          <p className="mt-0.5 text-[13px] leading-[18px] text-panel-muted">Days to decision</p>
        </div>

        <div>
           {driver.clockState === "launched" ? (
             <p className="clock-figure" data-numeric>{driver.daysSinceAward ?? 0}</p>
           ) : driver.clockState === "scrubbed" ? (
             <p className="text-[15px] leading-[22px] text-panel-muted">Clock stopped</p>
           ) : driver.daysToAward === null ? (
            <p className="text-[15px] leading-[22px] text-panel-muted">Clock not started</p>
          ) : driver.daysToAward < 0 ? (
            <p className="text-[18px] leading-6 font-semibold" style={{ color }} data-numeric>
              {Math.abs(driver.daysToAward)} days overdue
            </p>
          ) : (
            <p className="clock-figure" data-numeric>
              {driver.daysToAward}
            </p>
          )}
          <p className="mt-0.5 text-[13px] leading-[18px] text-panel-muted">
            {driver.clockState === "launched" ? `Days since award · ${formatDate(driver.awardDate)}` : "Days to award"}
          </p>
        </div>

        <div className="min-w-0">
          <p
            className="text-[18px] leading-6 font-semibold"
            style={atRisk ? { color: "var(--atrisk)" } : undefined}
          >
            {driver.status}
          </p>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            title={fullLine}
            className={
              expanded
                ? "mt-0.5 block w-full text-left text-[13px] leading-[18px] text-panel-muted"
                 : "mt-0.5 block w-full text-left text-[13px] leading-[18px] text-panel-muted"
            }
          >
            {expanded ? fullLine : shortLine}
          </button>
          <p className="mt-0.5 break-words text-[13px] leading-[18px] text-panel-muted" data-numeric>
            {driver.status === "Launched"
              ? `${Math.abs(driver.timeSavedDays)} days ${driver.timeSavedDays >= 0 ? "ahead of" : "behind"} plan`
              : driver.scheduleImpactDays === null
                ? "Schedule impact unknown"
                : driver.scheduleImpactDays >= 0
                  ? `${driver.scheduleImpactDays} days of margin to the mission date`
                  : `${Math.abs(driver.scheduleImpactDays)} days past the mission date`}
          </p>
        </div>
      </div>
    </li>
  );
}

function WatchCard({ items }: { items: ReturnType<typeof sortNewestFirst> }) {
  const recent = items.filter((i) => withinDays(i, 14));
  return (
    <section aria-label="Watch" className="mb-10 max-w-[80ch] border-t border-border pt-4">
      <h2 className="section-title text-[18px] leading-6 font-medium">Watch</h2>
      <p className="mt-2 text-[15px] leading-[22px]" data-numeric>
        {recent.length} new item{recent.length === 1 ? "" : "s"} in the last 14 days.{" "}
        <Link to="/watch" className="text-primary underline">
          Open Watch
        </Link>
      </p>
    </section>
  );
}

/** Aging holds and pending polls, counted by Center. */
function AgingPanel({
  acqs,
  polls,
  centers,
  users,
}: {
  acqs: AcqRow[];
  polls: PollRow[];
  centers: CenterRow[];
  users: UserRow[];
}) {
  const rows = useMemo(() => agingByCenter(agingItems(acqs, polls, centers, users)), [acqs, polls, centers, users]);
  const total = rows.reduce((n, r) => n + r.holds + r.polls, 0);

  return (
    <>
      <h3 className="mt-10 text-[18px] leading-6 font-medium">Aging holds and pending polls</h3>
      <p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
        A hold or an unanswered Go/No-go poll is aging once it passes the number of days the Center
        sets. Each aging item raises an entry in the digest for the owner's supervisor.
      </p>
      <p className="mt-3 text-[28px] leading-[34px] font-semibold" data-numeric>
        {total}
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">Aging items across all Centers</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-muted-foreground">Nothing is past its Center window.</p>
      ) : (
        <table className="mt-3 w-full max-w-[720px] border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Center</th>
              <th scope="col" className="p-2">Aging holds</th>
              <th scope="col" className="p-2">Aging polls</th>
              <th scope="col" className="p-2">Aging after</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.centerCode} className="border-b border-border last:border-0">
                <td className="p-2">{r.centerCode}</td>
                <td className="p-2" data-numeric>{r.holds}</td>
                <td className="p-2" data-numeric>{r.polls}</td>
                <td className="p-2" data-numeric>{r.thresholdDays} days</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-[13px]">
        <Link to="/escalations" className="text-primary underline">
          Open the escalation digest
        </Link>
      </p>
    </>
  );
}

/** Launched files and the date their replacement has to start. */
function SuccessorPanel({ acqs, plan }: { acqs: AcqRow[]; plan: PhasePlanRow[] }) {
  const rows = useMemo(() => successorRows(acqs, plan), [acqs, plan]);
  const flagged = rows.filter((r) => r.overdue);

  return (
    <>
      <h3 className="mt-10 text-[18px] leading-6 font-medium">Successor clock</h3>
      <p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
        Method: the period of performance end date less the summed planned days in the phase plan for
        that acquisition type, plus a 30-day transition allowance. A file is flagged once that date has passed with no successor file
        linked to it.
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No launched file records a period of performance end.</p>
      ) : (
        <>
          <p className="mt-3 text-[28px] leading-[34px] font-semibold" data-numeric>
            {flagged.length}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Launched files past their successor start date with nothing linked
          </p>
          <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-2">Acquisition</th>
                <th scope="col" className="p-2">Period of performance ends</th>
                <th scope="col" className="p-2">Planned days</th>
                <th scope="col" className="p-2">Successor must start by</th>
                <th scope="col" className="p-2">Successor file</th>
                <th scope="col" className="p-2">Standing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.acq.acquisition_id} className="border-b border-border last:border-0">
                  <td className="p-2">
                    <Link
                      to="/files/$acquisitionId"
                      params={{ acquisitionId: r.acq.acquisition_id }}
                      className="text-primary underline"
                    >
                      {r.acq.acquisition_id}
                    </Link>
                  </td>
                  <td className="p-2">{formatDate(String(r.acq.period_of_performance_end))}</td>
                  <td className="p-2" data-numeric>
                    {r.plannedDays} + 30 transition
                  </td>
                  <td className="p-2">{formatDate(r.startBy)}</td>
                  <td className="p-2">
                    {r.successorId ? (
                      <Link
                        to="/files/$acquisitionId"
                        params={{ acquisitionId: r.successorId }}
                        className="text-primary underline"
                      >
                        {r.successorId}
                      </Link>
                    ) : (
                      "None linked"
                    )}
                  </td>
                  <td className="p-2">
                    {r.overdue ? (
                      <StatusMark color="var(--atrisk)" className="text-[13px] leading-[18px]">
                        {`Successor overdue by ${Math.abs(r.daysUntilStart)} days`}
                      </StatusMark>
                    ) : r.successorId ? (
                      <StatusMark color="var(--ontrack)" className="text-[13px] leading-[18px]">
                        Successor linked
                      </StatusMark>
                    ) : (
                      <StatusMark color="var(--ontrack)" className="text-[13px] leading-[18px]">
                        {`Starts in ${r.daysUntilStart} days`}
                      </StatusMark>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

function quarterStart(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1)).toISOString().slice(0, 10);
}

function ClockBoard({
  metrics,
  plan,
  thresholds,
  polls,
  centers,
  users,
}: {
  metrics: AcqMetrics[];
  plan: PhasePlanRow[];
  thresholds: ThresholdRow[];
  polls: PollRow[];
  centers: CenterRow[];
  users: UserRow[];
}) {
  const today = todayISO();
  const qStart = quarterStart(today);

  const running = metrics.filter((m) => m.clockState === "running").length;
  const onHold = metrics.filter((m) => m.clockState === "hold");
  const launchedThisQuarterRows = metrics.filter(
    (m) =>
      m.clockState === "launched" &&
      m.acq.target_award_date &&
      String(m.acq.target_award_date) >= qStart &&
      String(m.acq.target_award_date) <= today,
  );
  const launchedThisQuarter = launchedThisQuarterRows.length;

  const daysReturned = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const m of launchedThisQuarterRows) {
      const center = String(m.acq.center_code ?? "Unassigned");
      map.set(center, (map.get(center) ?? 0) + m.timeSavedDays);
      total += m.timeSavedDays;
    }
    return { byCenter: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])), total };
  }, [launchedThisQuarterRows]);
  const scrubbed = metrics.filter((m) => m.clockState === "scrubbed").length;

  const modTasksQ = useQuery({ queryKey: ["clause-mod-tasks"], queryFn: loadModTasks });
  const modCounts = modsByCenter(modTasksQ.data ?? []);

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of onHold) {
      const reason = m.hold?.reason ?? String(m.acq.hold_reason ?? "Reason not recorded");
      const key = reason.split("—")[0]!.trim();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [onHold]);

  const longestHolds = useMemo(
    () =>
      [...onHold]
        .map((m) => ({
          m,
          days: m.blockerSince ? Math.max(0, daysBetween(m.blockerSince, today)) : 0,
        }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 10),
    [onHold, today],
  );

  const leadByPhase = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number; n: number }>();
    for (const m of metrics) {
      for (const p of m.phases) {
        if (p.actual_days === null) continue;
        const row = map.get(p.phase) ?? { planned: 0, actual: 0, n: 0 };
        row.planned += p.planned_days;
        row.actual += p.actual_days;
        row.n += 1;
        map.set(p.phase, row);
      }
    }
    const order = new Map(plan.map((p) => [p.phase ?? "", p.order ?? 0]));
    return [...map.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
  }, [metrics, plan]);

  const maxHold = Math.max(1, ...byReason.map(([, n]) => n));

  return (
    <div>
      <h2 className="text-[18px] leading-6 font-medium">Acquisitions</h2>
      <p className="mt-1 text-muted-foreground">Every number on this page is computed from the work itself.</p>

      <div className="mt-6 grid gap-8 sm:grid-cols-4">
        {[
          ["Running", running],
          ["On hold", onHold.length],
          ["Launched this quarter", launchedThisQuarter],
          ["Scrubbed", scrubbed],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-[28px] leading-[34px] font-semibold" data-numeric>
              {value as number}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">{label as string}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-10 text-[18px] leading-6 font-medium">Days returned to missions</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Method: planned days minus actual days across completed phases, summed over files launched this quarter, by Center.
      </p>
      {daysReturned.byCenter.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No file has launched this quarter.</p>
      ) : (
        <div className="mt-3 max-w-[70ch]">
          <p className="text-[28px] leading-[34px] font-semibold" data-numeric>
            {daysReturned.total}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">Days returned to missions this quarter</p>
          <ul className="mt-3 space-y-1 border-t border-border pt-3">
            {daysReturned.byCenter.map(([center, days]) => (
              <li key={center} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[13px] leading-[18px]">
                <span>{center}</span>
                <span data-numeric>
                  {Math.abs(days)} {days >= 0 ? "ahead of" : "behind"} plan
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="mt-10 text-[18px] leading-6 font-medium">Clause change mods, done against due</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Modifications required by a clause change, by Center.{" "}
        <Link to="/clause-changes" className="text-primary">
          Open the clause change impact list
        </Link>
        .
      </p>
      {modCounts.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No clause change mod task has been created.</p>
      ) : (
        <ul className="mt-3 max-w-[70ch] space-y-1 border-t border-border pt-3">
          {modCounts.map((c) => (
            <li key={c.center} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[13px] leading-[18px]">
              <span>{c.center}</span>
              <span data-numeric>
                {c.done} done of {c.due} due
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-10 text-[18px] leading-6 font-medium">Holds by reason</h3>
      {byReason.length === 0 ? (
        <p className="mt-2 text-muted-foreground">Nothing is on hold.</p>
      ) : (
        <ul className="mt-3 max-w-[70ch] space-y-2">
          {byReason.map(([reason, n]) => (
            <li key={reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div>
                <p className="text-[13px] leading-[18px]">{reason}</p>
                <div
                  className="mt-1 h-2 rounded"
                  style={{ width: `${(n / maxHold) * 100}%`, backgroundColor: "var(--atrisk)" }}
                  role="img"
                  aria-label={`${n} on hold for ${reason}`}
                />
              </div>
              <span className="text-[13px]" data-numeric>
                {n}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-10 text-[18px] leading-6 font-medium">The ten longest current holds</h3>
      {longestHolds.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No file is on hold today.</p>
      ) : (
        <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Acquisition</th>
              <th scope="col" className="p-2">Reason</th>
              <th scope="col" className="p-2">Responsible role</th>
              <th scope="col" className="p-2">Days on hold</th>
            </tr>
          </thead>
          <tbody>
            {longestHolds.map(({ m, days }) => (
              <tr key={m.acq.acquisition_id} className="border-b border-border last:border-0">
                <td className="p-2">
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: m.acq.acquisition_id }}
                    className="text-primary underline"
                  >
                    {m.acq.acquisition_id}
                  </Link>
                </td>
                <td className="p-2">{m.hold?.reason ?? String(m.acq.hold_reason ?? "—")}</td>
                <td className="p-2">{m.blockerOwner ?? String(m.acq.hold_owner ?? "—")}</td>
                <td className="p-2" data-numeric>
                  {days}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-10 text-[18px] leading-6 font-medium">Lead time by phase against the phase plan</h3>
      {leadByPhase.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No phase has recorded time yet.</p>
      ) : (
        <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Phase</th>
              <th scope="col" className="p-2">Files measured</th>
              <th scope="col" className="p-2">Planned days</th>
              <th scope="col" className="p-2">Actual days</th>
              <th scope="col" className="p-2">Against plan</th>
            </tr>
          </thead>
          <tbody>
            {leadByPhase.map(([phase, r]) => {
              const delta = r.planned - r.actual;
              return (
                <tr key={phase} className="border-b border-border last:border-0">
                  <td className="p-2">{phase}</td>
                  <td className="p-2" data-numeric>
                    {r.n}
                  </td>
                  <td className="p-2" data-numeric>
                    {r.planned}
                  </td>
                  <td className="p-2" data-numeric>
                    {r.actual}
                  </td>
                  <td className="p-2" data-numeric>
                    {delta === 0 ? "On plan" : `${Math.abs(delta)} days ${delta > 0 ? "ahead of" : "behind"} plan`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <AgingPanel acqs={metrics.map((m) => m.acq)} polls={polls} centers={centers} users={users} />
      <SuccessorPanel acqs={metrics.map((m) => m.acq)} plan={plan} />

      <SmallBusinessPanel acqs={metrics.map((m) => m.acq)} thresholds={thresholds} />

      <ExclusionsSweepPanel />
    </div>
  );
}

function EnterpriseTab({
  metrics,
  missionRows,
  log,
  polls,
  rules,
}: {
  metrics: AcqMetrics[];
  missionRows: { mission: MissionRow; driver: AcqMetrics }[];
  log: { acquisition_id: string | null; action: string | null; logged_at: string | null }[];
  polls: PollRow[];
  rules: ReviewRuleRow[];
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  const payload = useMemo(() => {
    const citation = (role: string) =>
      rules.find((r) => r.reviewer_role.toLowerCase() === role.toLowerCase())?.citation ?? null;
    return {
      summary: {
        running: metrics.filter((m) => m.clockState === "running").length,
        hold: metrics.filter((m) => m.clockState === "hold").length,
        launched: metrics.filter((m) => m.clockState === "launched").length,
        pending_votes: polls.filter((p) => (p.vote ?? "pending") === "pending").length,
        nogo_votes: polls.filter((p) => p.vote === "no-go").length,
        audit_entries: log.length,
      },
      projects: missionRows.map(({ mission, driver }) => ({
        mission: mission.name,
        acquisition_id: driver.acq.acquisition_id,
        title: String(driver.acq.title ?? ""),
        phase: driver.currentPhase,
        next_decision: driver.nextDecision,
        days_to_award: driver.daysToAward,
        status: driver.status,
      })),
      acquisitions: metrics.map((m) => ({
        acquisition_id: m.acq.acquisition_id,
        title: String(m.acq.title ?? ""),
        center_code: String(m.acq.center_code ?? ""),
        phase: m.currentPhase,
        blocker: m.blocker,
        blocker_owner: m.blockerOwner,
        days_to_award: m.daysToAward,
        status: m.status,
      })),
      recurring: polls.map((p) => ({
        acquisition_id: p.acquisition_id,
        phase: p.phase,
        reviewer_role: p.reviewer_role ?? "",
        reviewer_name: p.reviewer_name ?? "Not yet assigned",
        due_date: p.due_date,
        vote: p.vote ?? "pending",
        citation: citation(p.reviewer_role ?? ""),
      })),
    };
  }, [metrics, missionRows, log, polls, rules]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "tminus:ready") setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage({ type: "tminus:live", payload }, "*");
  }, [ready, payload]);

  const sample = metrics.find((m) => m.acq.acquisition_id === "A-2027-0101");

  return (
    <div>
      <h2 className="text-[18px] leading-6 font-medium">Enterprise</h2>
      <p className="mt-1 max-w-[80ch] text-muted-foreground">
        The ORBIT prototype with fictional data. Its workforce tabs are unchanged. Executive summary,
        project status, and recurring actions read live from T-Minus.
      </p>

      <section className="mt-6 rounded-lg border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-medium">Microsoft Teams bot</h3>
            <p className="mt-1 max-w-[80ch] text-[13px] leading-5 text-muted-foreground">
              A production Teams bot so mission leaders ask T-Minus in the flow of work.
              Mention the bot with a PR number and it answers with the file&apos;s clock line,
              status, owner, and a link to the file. It reads the same data as the Executive
              Overview; nothing is stored in Teams.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border px-3 py-1 text-[12px] font-medium text-muted-foreground">
            Planned
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-canvas p-4">
          <p className="text-[12px] font-medium text-muted-foreground">Mock transcript</p>
          <div className="mt-3 space-y-3 text-[13px] leading-5">
            <p className="text-foreground">
              <span className="font-medium">You</span>
              <br />
              @T-Minus where is PR 4200999101
            </p>
            <p className="text-foreground">
              <span className="font-medium">T-Minus</span>
              <br />
              PR 4200999101 is A-2027-0101, Commercial Aviation Services: Arctic snow depth
              flights, spring 2027 campaign. Center ARC, owner J. Rivera (fictional CO).
              {sample ? (
                <>
                  {" "}
                  Status: {sample.status}. Phase: {sample.currentPhase}.{" "}
                  {sample.daysToAward !== null && sample.daysToAward >= 0
                    ? `${sample.daysToAward} days to award.`
                    : sample.daysToAward !== null && sample.daysToAward < 0
                      ? `${Math.abs(sample.daysToAward)} days overdue to award.`
                      : "Clock not started."}
                  {sample.blocker ? ` Blocker: ${sample.blocker}.` : ""}
                </>
              ) : (
                <> Status: On Track. Phase: Market Research.</>
              )}{" "}
              Open the file: /files/A-2027-0101.
            </p>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Sample uses fictional acquisition A-2027-0101. The production bot would answer
            for any PR the caller can see under the same role-based access.
          </p>
        </div>
      </section>

      <iframe
        ref={frame}
        title="ORBIT prototype"
        src="/orbit-prototype.html"
        className="mt-6 h-[1200px] w-full rounded-lg border border-border bg-background"
      />
    </div>
  );
}
