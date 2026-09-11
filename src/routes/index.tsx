import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
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
import {
  callout,
  computeMetrics,
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

function num(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : String(n);
}

function StatusWordTag({ status }: { status: AcqMetrics["status"] }) {
  return (
    <StatusMark color={statusColor(status)} className="text-[15px] leading-[22px]">
      {status}
    </StatusMark>
  );
}


function ExecutiveOverview() {
  const { role, authState } = useRole();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"acquisitions" | "enterprise">("acquisitions");

  useEffect(() => {
    if (role !== "executive" && role !== "hq") {
      navigate({ to: "/work-queue", replace: true });
    }
  }, [role, navigate]);

  const q = useQuery({
    queryKey: ["executive-overview"],
    enabled: authState === "signed-in",
    refetchInterval: 5000,
    queryFn: async () => {
      const [missions, acqs, plan, rules, thresholds, strategies, polls, log, watchRows, refs] = await Promise.all([
        supabase.from("missions").select("*").order("priority"),
        supabase.from("acquisition_facts").select("*").order("acquisition_id"),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("review_rules").select("*"),
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
      return {
        missions: (missions.data ?? []) as MissionRow[],
        acqs: (acqs.data ?? []) as unknown as AcqRow[],
        plan: (plan.data ?? []) as PhasePlanRow[],
        rules: (rules.data ?? []) as ReviewRuleRow[],
        thresholds: thresholds.data ?? [],
        strategies: strategies.data ?? [],
        polls: (polls.data ?? []) as PollRow[],
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
        plan: q.data.plan,
        rules: q.data.rules,
        polls: q.data.polls,
        ref,
        mission: q.data.missions.find((m) => m.mission_id === acq.mission_id) ?? null,
        holdSince: holdSince(acq.acquisition_id, q.data.log),
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

  return (
    <AppShell wide>
      <PageHeader title="Executive Overview" lead="T-Minus turns acquisition time into mission readiness." />

      {q.isError ? (
        <ErrorNote message="The overview did not load. Refresh the page; if it fails again, open Seed status to confirm the records loaded." />
      ) : null}

      <section aria-label="Mission clock" className="mb-10 rounded-lg bg-panel px-5 py-6 text-panel-foreground sm:px-8 sm:py-7">
        <p className="text-[13px] text-panel-muted">Priority projects on the clock</p>
        {q.isLoading ? (
          <p role="status" className="mt-4 text-panel-muted">
            Loading the priority projects.
          </p>
        ) : missionRows.length === 0 ? (
          <p className="mt-4 text-panel-muted">No priority projects are loaded yet.</p>
        ) : (

          <ul className="mt-5 divide-y divide-panel-muted/30">
            {missionRows.map(({ mission, driver }) => (
              <li key={mission.mission_id} className="py-5">
                <Link
                  to="/files/$acquisitionId"
                  params={{ acquisitionId: driver.acq.acquisition_id }}
                  className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-panel-foreground"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto_minmax(0,1.2fr)]">
                    <div>
                      <p className="text-[18px] leading-6 font-medium">{mission.name}</p>
                      <p className="mt-1 text-[13px] text-panel-muted">
                        {mission.milestone ?? "Milestone"} · {formatDate(mission.milestone_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[15px]">{driver.currentPhase ?? "Not started"}</p>
                      <p className="mt-1 text-[13px] text-panel-muted">
                        Next decision: {driver.nextDecision}
                      </p>
                    </div>
                    <div>
                      <p className="clock-figure" data-numeric>
                        {num(driver.daysToNextDecision)}
                      </p>
                      <p className="mt-1 text-[13px] text-panel-muted">Days to decision</p>
                    </div>
                    <div>
                      <p className="clock-figure" data-numeric>
                        {num(driver.daysToAward)}
                      </p>
                      <p className="mt-1 text-[13px] text-panel-muted">Days to award</p>
                    </div>
                    <div>
                      <p
                        className="inline-block border-l-2 pl-2 text-[18px] leading-6"
                        style={{ borderColor: statusColor(driver.status) }}
                      >
                        {driver.status}
                      </p>
                      <p className="mt-2 text-[13px] text-panel-muted">
                        Blocker: {driver.blocker}
                        {driver.blockerOwner ? ` · owner ${driver.blockerOwner}` : ""}
                      </p>
                      <p className="mt-1 text-[13px] text-panel-muted" data-numeric>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="What leadership needs to know now" className="mb-10">
        <h2 className="section-title text-[18px] leading-6 font-medium">What leadership needs to know now</h2>
        {callouts.length === 0 ? (
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
        {(["acquisitions", "enterprise"] as const).map((t) => (
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
            {t === "acquisitions" ? "Acquisitions" : "Enterprise"}
          </button>
        ))}
      </div>

      {tab === "acquisitions" ? (
        <ClockBoard metrics={metrics} plan={q.data?.plan ?? []} />
      ) : (
        <EnterpriseTab metrics={metrics} missionRows={missionRows} log={q.data?.log ?? []} polls={q.data?.polls ?? []} rules={q.data?.rules ?? []} />
      )}
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

function quarterStart(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1)).toISOString().slice(0, 10);
}

function ClockBoard({ metrics, plan }: { metrics: AcqMetrics[]; plan: PhasePlanRow[] }) {
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

  return (
    <div>
      <h2 className="text-[18px] leading-6 font-medium">Enterprise</h2>
      <p className="mt-1 max-w-[80ch] text-muted-foreground">
        The ORBIT prototype with fictional data. Its workforce tabs are unchanged. Executive summary,
        project status, and recurring actions read live from T-Minus.
      </p>
      <iframe
        ref={frame}
        title="ORBIT prototype"
        src="/orbit-prototype.html"
        className="mt-6 h-[1200px] w-full rounded-lg border border-border bg-background"
      />
    </div>
  );
}
