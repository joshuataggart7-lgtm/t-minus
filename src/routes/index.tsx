import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadModTasks, modsByCenter } from "@/lib/clause-impact";
import { AppShell, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
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
import {
  CentersTab,
  type CenterDocumentRow,
  type CenterTemplateRow,
} from "@/components/centers-tab";
import { successorRows } from "@/lib/successor";
import { agingItems, agingByCenter, type CenterRow, type UserRow } from "@/lib/aging";
import type { ThresholdRow } from "@/lib/small-business";
import { attachedKeys as keysFrom, savedDocKeys } from "@/lib/hold";
import {
  computeMetrics,
  awardDateFor,
  formatDate,
  holdSince,
  missionDriver,
  type AcqMetrics,
  type MissionRow,
} from "@/lib/metrics";
import { PortfolioHero } from "@/components/mission-control/portfolio-hero";
import { PhaseDistribution } from "@/components/mission-control/phase-distribution";
import { AttentionSeverityList } from "@/components/mission-control/attention-severity-list";
import { DaysReturned } from "@/components/mission-control/days-returned";
import { MissionMasthead } from "@/components/mission-control/mission-masthead";

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

export function ExecutiveOverview() {
  const { authState } = useRole();
  const [tab, setTab] = useState<"acquisitions" | "centers" | "enterprise">("acquisitions");

  const q = useQuery({
    queryKey: ["executive-overview"],
    enabled: authState === "signed-in",
    refetchInterval: 5000,
    queryFn: async () => {
      const [
        missions,
        acqs,
        plan,
        rules,
        overrides,
        thresholds,
        strategies,
        polls,
        log,
        watchRows,
        refs,
      ] = await Promise.all([
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
        supabase
          .from("users")
          .select("name,role,title,center_code,supervisor_name,supervisor_email"),
        supabase.from("documents").select("acquisition_id,template_id,saved_at,version"),
        supabase.from("templates").select("template_id,name,hq_revision_date"),
      ]);
      const attachments = await supabase
        .from("document_attachments")
        .select("acquisition_id,doc_key");
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
        attachments: attachments.data ?? [],
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
        attachedKeys: keysFrom(q.data.attachments ?? [], acq.acquisition_id),
        savedKeys: savedDocKeys(q.data.documents ?? [], q.data.templates ?? [], acq.acquisition_id),
        roster: q.data.users ?? [],
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

  const latestEvents = useMemo(() => {
    const events: Record<string, { action: string; loggedAt: string }> = {};
    for (const row of q.data?.log ?? []) {
      const acquisitionId = String(row.acquisition_id ?? "");
      if (!acquisitionId || events[acquisitionId]) continue;
      events[acquisitionId] = {
        action: String(row.action ?? "Activity recorded"),
        loggedAt: String(row.logged_at ?? ""),
      };
    }
    return events;
  }, [q.data?.log]);

  // Stamped when this page loads, so a reader knows how fresh the figures are.
  const [computedAt, setComputedAt] = useState("");
  useEffect(() => {
    setComputedAt(
      new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    );
  }, []);

  return (
    <AppShell wide>
      <MissionMasthead />

      {q.isError ? (
        <ErrorNote message="The overview did not load. Refresh the page; if it fails again, open Seed status to confirm the records loaded." />
      ) : null}

      <section aria-label="Mission clock" className="mb-8 w-full">
        <h2 className="sr-only">Mission clock</h2>
        {q.isLoading ? (
          <p role="status" className="text-muted-foreground">
            Loading the priority projects.
          </p>
        ) : missionRows.length === 0 ? (
          <p className="text-muted-foreground">No priority projects are loaded yet.</p>
        ) : (
          <PortfolioHero
            metrics={metrics}
            missions={q.data?.missions ?? []}
            latestEvents={latestEvents}
          />
        )}
      </section>

      <div className="mc-overview-environment mc-grid">
        {computedAt ? (
          <div className="mc-refresh-line" data-numeric>
            <span className="mc-scan-pulse" aria-hidden="true" />
            Portfolio scan refreshed {computedAt}
          </div>
        ) : null}

        <div className="grid gap-px border-b border-mc-line bg-mc-line lg:grid-cols-[0.8fr_1.2fr]">
          <PhaseDistribution metrics={metrics} />
          <DaysReturned metrics={metrics} />
        </div>
        <AttentionSeverityList metrics={metrics} missions={q.data?.missions ?? []} />

        <div className="mc-watch-wrap">
          <WatchCard items={q.data?.watch ?? []} />
        </div>

        <div role="tablist" aria-label="Overview detail" className="mc-tabs">
          {(["acquisitions", "centers", "enterprise"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={tab === t ? "mc-tab mc-tab-active" : "mc-tab"}
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
          <EnterpriseTab
            metrics={metrics}
            missionRows={missionRows}
            log={q.data?.log ?? []}
            polls={q.data?.polls ?? []}
            rules={q.data?.rules ?? []}
          />
        )}
      </div>
    </AppShell>
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
  const rows = useMemo(
    () => agingByCenter(agingItems(acqs, polls, centers, users)),
    [acqs, polls, centers, users],
  );
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
              <th scope="col" className="p-2">
                Center
              </th>
              <th scope="col" className="p-2">
                Aging holds
              </th>
              <th scope="col" className="p-2">
                Aging polls
              </th>
              <th scope="col" className="p-2">
                Aging after
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.centerCode} className="border-b border-border last:border-0">
                <td className="p-2">{r.centerCode}</td>
                <td className="p-2" data-numeric>
                  {r.holds}
                </td>
                <td className="p-2" data-numeric>
                  {r.polls}
                </td>
                <td className="p-2" data-numeric>
                  {r.thresholdDays} days
                </td>
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
        Method: the period of performance end date less the summed planned days in the phase plan
        for that acquisition type, plus a 30-day transition allowance. A file is flagged once that
        date has passed with no successor file linked to it. Advisory only — it never places a hold,
        and no successor file is created automatically.
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-muted-foreground">
          No launched file records a period of performance end.
        </p>
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
                <th scope="col" className="p-2">
                  Acquisition
                </th>
                <th scope="col" className="p-2">
                  Period of performance ends
                </th>
                <th scope="col" className="p-2">
                  Planned days
                </th>
                <th scope="col" className="p-2">
                  Successor must start by
                </th>
                <th scope="col" className="p-2">
                  Successor file
                </th>
                <th scope="col" className="p-2">
                  Standing
                </th>
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
      <p className="mt-1 text-muted-foreground">
        Every number on this page is computed from the work itself.
      </p>

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

      <h3 className="mt-10 text-[18px] leading-6 font-medium">
        Clause change mods, done against due
      </h3>
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
            <li
              key={c.center}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[13px] leading-[18px]"
            >
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
              <th scope="col" className="p-2">
                Acquisition
              </th>
              <th scope="col" className="p-2">
                Reason
              </th>
              <th scope="col" className="p-2">
                Responsible role
              </th>
              <th scope="col" className="p-2">
                Days on hold
              </th>
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

      <h3 className="mt-10 text-[18px] leading-6 font-medium">
        Lead time by phase against the phase plan
      </h3>
      {leadByPhase.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No phase has recorded time yet.</p>
      ) : (
        <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">
                Phase
              </th>
              <th scope="col" className="p-2">
                Files measured
              </th>
              <th scope="col" className="p-2">
                Planned days
              </th>
              <th scope="col" className="p-2">
                Actual days
              </th>
              <th scope="col" className="p-2">
                Against plan
              </th>
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
                    {delta === 0
                      ? "On plan"
                      : `${Math.abs(delta)} days ${delta > 0 ? "ahead of" : "behind"} plan`}
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
        The ORBIT prototype with fictional data. Its workforce tabs are unchanged. Executive
        summary, project status, and recurring actions read live from T-Minus.
      </p>

      <section className="mt-6 rounded-lg border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-medium">Microsoft Teams bot</h3>
            <p className="mt-1 max-w-[80ch] text-[13px] leading-5 text-muted-foreground">
              A production Teams bot so mission leaders ask T-Minus in the flow of work. Mention the
              bot with a PR number and it answers with the file&apos;s clock line, status, owner,
              and a link to the file. It reads the same data as the Executive Overview; nothing is
              stored in Teams.
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
              PR 4200999101 is A-2027-0101, {sample?.acq.title ??
                "Commercial Aviation Services"}. Center {sample?.acq.center_code ?? "ARC"}, owner{" "}
              {String(
                (sample?.acq as Record<string, unknown> | undefined)?.["co_name"] ?? "",
              ).trim() || "not recorded"}
              .
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
            Sample uses fictional acquisition A-2027-0101. The production bot would answer for any
            PR the caller can see under the same role-based access.
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
