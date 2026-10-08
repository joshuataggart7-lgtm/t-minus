import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { McPageHeader, DataTable, StatusChip, type DataColumn, type StatusTone } from "@/components/ui-mc";
import { contractingHours, phasePosition, phasePositionText, planToAward } from "@/lib/file-timeline";
import { useRole } from "@/components/role-context";
import { missionReadinessClass, type MissionReadiness } from "@/components/mission-control/primitives";
import { explainWorkReadiness } from "@/components/mission-control/readiness";
import { deriveOverviewAcquisitionState, overviewCountdownView } from "@/components/mission-control/operational-state";
import { LaunchCountdownCompact } from "@/components/launch-countdown";
import { supabase } from "@/integrations/supabase/client";
import { loadLaunchEvents, loadStateAuditRows } from "@/lib/launch-events";
import type { CenterOverrideRow } from "@/lib/center-config";
import { formatMoney, type RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow } from "@/lib/launch-sequence";
import { attachedKeys, savedDocKeys } from "@/lib/hold";
import { loadAttachmentKeyRows, loadDocumentKeyRows } from "@/lib/evidence-rows";
import { computeMetrics, holdSince, type MissionRow } from "@/lib/metrics";
import { methodDisplayLabel } from "@/lib/rfo-simplified-cites";

const READINESS_TONE: Record<MissionReadiness, StatusTone> = { GO: "ontrack", WATCH: "attention", HOLD: "atrisk", LAUNCHED: "launched" };

/** Hours line for the Files list, from the shared helper in lib/file-timeline.ts. */
function hoursLine(acq: Record<string, unknown>, plan: PhasePlanRow[]) {
  const h = contractingHours(acq, plan);
  if (!h) return "No hours estimate yet";
  return `${h.total.toLocaleString("en-US")} contracting hours, ${h.source === "intake" ? "estimate at intake" : "current estimate"}`;
}

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "Files · T-Minus" },
      { name: "description", content: "Every acquisition file, its clock line, and its days to award." },
      { property: "og:title", content: "Files · T-Minus" },
      { property: "og:description", content: "Every acquisition file, its clock line, and its days to award." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FilesPage,
});

function FilesPage() {
  const { authState, hasAnyRole, readOnly } = useRole();
  const q = useQuery({
    queryKey: ["files"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [acqs, missions, plan, rules, polls, log, users, attachments, documents, templates, overrides, thresholds, strategies, launches] = await Promise.all([
        supabase.from("acquisition_facts").select("*").order("acquisition_id"),
        supabase.from("missions").select("*"),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("review_rules").select("*"),
        supabase.from("polls").select("*"),
        loadStateAuditRows(),
        supabase.from("users").select("name,title,center_code"),
        loadAttachmentKeyRows(),
        loadDocumentKeyRows(),
        supabase.from("templates").select("template_id,name"),
        supabase.from("center_overrides").select("*"),
        supabase.from("thresholds").select("*"),
        supabase.from("enterprise_strategies").select("*"),
        loadLaunchEvents(),
      ]);
      return {
        acqs: (acqs.data ?? []) as unknown as AcqRow[],
        missions: (missions.data ?? []) as MissionRow[],
        plan: (plan.data ?? []) as PhasePlanRow[],
        rules: (rules.data ?? []) as ReviewRuleRow[],
        polls: (polls.data ?? []) as PollRow[],
        stateLog: log,
        launches,
        users: users.data ?? [],
        attachments,
        documents: documents as { acquisition_id: string | null; template_id: string | null }[],
        templates: templates.data ?? [],
        overrides: overrides.data ?? [],
        thresholds: thresholds.data ?? [],
        strategies: strategies.data ?? [],
      };
    },
  });

  const ref: RefData = useMemo(() => ({
    thresholds: (q.data?.thresholds ?? []).map((row) => ({
      name: row.name,
      value: row.value === null ? null : Number(row.value),
      citation: row.citation,
      note: row.note,
    })),
    overrides: (q.data?.overrides ?? []) as unknown as CenterOverrideRow[],
    phasePlan: (q.data?.plan ?? []).map((row) => ({
      acquisition_type: row.acquisition_type,
      phase: row.phase,
      planned_days: row.planned_days,
    })),
    strategies: (q.data?.strategies ?? []).map((row) => ({
      psl: row.psl,
      name: row.name,
      buying_location: row.buying_location,
      mandatory_vehicles: row.mandatory_vehicles,
      required_coordination: row.required_coordination,
    })),
  }), [q.data]);

  const [showScrubbed, setShowScrubbed] = useState(false);
  const rows = useMemo(() => {
    if (!q.data) return [];
    return q.data.acqs.map((acq) => {
      const operational = deriveOverviewAcquisitionState(acq, [...q.data.stateLog, ...q.data.launches]);
      const mission = q.data.missions.find((row) => row.mission_id === acq.mission_id) ?? null;
      const keys = {
        acq: operational.acquisition,
        attachedKeys: attachedKeys(q.data.attachments, acq.acquisition_id),
        savedKeys: savedDocKeys(q.data.documents, q.data.templates, acq.acquisition_id),
      };
      const metric = computeMetrics(operational.acquisition, {
        attachedKeys: keys.attachedKeys,
        savedKeys: keys.savedKeys,
        roster: q.data.users,
        plan: q.data.plan,
        rules: q.data.rules,
        polls: q.data.polls,
        ref,
        mission,
        holdSince: holdSince(acq, q.data.stateLog),
        awardDate: operational.actualAwardDate,
      });
      const readiness = explainWorkReadiness(metric, keys);
      const position = phasePosition(metric.phases);
      const plan = planToAward(operational.acquisition, q.data.plan);
      return { acq, operational: operational.acquisition, metric, mission, readiness, position, plan };
    });
  }, [q.data, ref]);

  // Scrubbed files stay in the record but sit behind a toggle.
  const isScrubbed = (row: (typeof rows)[number]) =>
    row.acq.clock_state === "scrubbed" || row.operational.clock_state === "scrubbed";
  const scrubbedCount = rows.filter(isScrubbed).length;
  const [stateFilter, setStateFilter] = useState<MissionReadiness | "ALL">("ALL");
  const [find, setFind] = useState("");
  const live = rows.filter((row) => !isScrubbed(row));
  const counts = (["GO", "WATCH", "HOLD", "LAUNCHED"] as MissionReadiness[]).map((state) => ({
    state,
    n: live.filter((row) => row.readiness.state === state).length,
  }));
  const needle = find.trim().toLowerCase();
  const visibleRows = (showScrubbed ? rows : live)
    .filter((row) => stateFilter === "ALL" || (!isScrubbed(row) && row.readiness.state === stateFilter))
    .filter((row) =>
      !needle
        ? true
        : [row.acq.acquisition_id, row.acq.title, row.mission?.name, row.acq.co_name, row.acq.center_code]
            .map((v) => String(v ?? "").toLowerCase())
            .some((v) => v.includes(needle)),
    );
  const canStart = hasAnyRole(["specialist", "requester", "hq"]) && !readOnly;

  type Row = (typeof rows)[number];
  const columns: DataColumn<Row>[] = [
    {
      key: "file",
      header: "Acquisition",
      rowHeader: true,
      width: "24%",
      cell: ({ acq }) => {
        const copyOf = String(acq['source_tag'] ?? "").startsWith("Copy of") ? String(acq['source_tag']) : null;
        return (
          <div className="mc-files-file">
            <Link to="/files/$acquisitionId" params={{ acquisitionId: acq.acquisition_id }} className="mc-files-link">
              <span className="mc-files-id" data-numeric>{acq.acquisition_id}</span>
              <span className="mc-files-title">{String(acq.title ?? acq.acquisition_id)}</span>
            </Link>
            {copyOf ? <span className="mc-files-meta">{copyOf}</span> : null}
            {acq['source_tag'] === "backfilled" ? (
              <span className="mc-files-meta">Backfilled{acq['contract_number'] ? ` · contract ${acq['contract_number']}` : ""}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      mobileLabel: "Status",
      cell: (row) =>
        isScrubbed(row) ? (
          <div>
            <StatusChip label="Scrubbed" tone="neutral" />
            <span className="mc-files-meta">{String(row.acq.hold_reason ?? "").trim() || "Reason not recorded"}</span>
          </div>
        ) : (
          <div>
            <StatusChip label={row.readiness.state} tone={READINESS_TONE[row.readiness.state]} />
            <span className="mc-files-meta" data-numeric>{phasePositionText(row.position)}</span>
            <span className="mc-files-strong">{row.position.name ?? String(row.operational.current_phase ?? "Not recorded")}</span>
          </div>
        ),
    },
    {
      key: "t",
      header: "T±",
      mobileLabel: "Countdown",
      nowrap: true,
      cell: (row) =>
        isScrubbed(row) ? (
          <span className="mc-files-meta">No countdown</span>
        ) : (
          <LaunchCountdownCompact view={overviewCountdownView(row.metric)} hideBadge={overviewCountdownView(row.metric).mode === "hold"} />
        ),
    },
    {
      key: "plan",
      header: "Plan to award",
      mobileLabel: "Plan to award",
      width: "15%",
      cell: ({ acq, plan }) => (
        <div>
          <span className="mc-files-strong" data-numeric>
            {plan.plannedDays ? `${plan.plannedDays} planned days` : "No phase plan"}
          </span>
          {plan.phases.length ? <span className="mc-files-meta" data-numeric>{plan.phases.length} phases to award</span> : null}
          <span className="mc-files-meta" data-numeric>{hoursLine(acq as Record<string, unknown>, q.data?.plan ?? [])}</span>
        </div>
      ),
    },
    {
      key: "buy",
      header: "Value and method",
      mobileLabel: "Value and method",
      width: "16%",
      cell: ({ acq, mission }) => (
        <div>
          <span className="mc-files-strong" data-numeric>
            {acq.estimated_value ? `IGCE ${formatMoney(Number(acq.estimated_value))}` : "IGCE not recorded"}
          </span>
          <span className="mc-files-meta">{methodDisplayLabel(String(acq.acquisition_method ?? "Not recorded"))}</span>
          <span className="mc-files-meta">
            {mission?.name ?? "No mission linked"} · {String(acq.center_code ?? "Not recorded")}
          </span>
        </div>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      mobileLabel: "Owner",
      cell: ({ acq }) => String(acq.co_name ?? "").trim() || <span className="mc-files-meta">Not recorded</span>,
    },
    {
      key: "next",
      header: "Next action",
      mobileLabel: "Next action",
      width: "15%",
      cell: (row) => (isScrubbed(row) ? <span className="mc-files-meta">None</span> : row.readiness.nextAction),
    },
  ];

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Acquisition files"
        title="Files"
        lead="Every acquisition file with its phase, countdown, and planned days to award. Days and phases come from the same phase plan the file page uses."
        actions={
          canStart ? (
            <Link to="/intake" className="mc-req-button">
              Start an intake
            </Link>
          ) : null
        }
      />
      {q.isLoading ? <LoadingNote what="the files" layout="table" /> : null}
      {q.isError ? <ErrorNote message="The file list did not load. Refresh the page. If it still fails, tell the T-Minus team." /> : null}

      {rows.length ? (
        <>
          <div className="mc-files-tools">
            <div className="mc-files-filters" role="group" aria-label="Show files by status">
              <button type="button" aria-pressed={stateFilter === "ALL"} onClick={() => setStateFilter("ALL")} className="mc-files-filter">
                All <span data-numeric>{live.length}</span>
              </button>
              {counts.map(({ state, n }) => (
                <button
                  key={state}
                  type="button"
                  aria-pressed={stateFilter === state}
                  onClick={() => setStateFilter(state)}
                  disabled={n === 0}
                  className={`mc-files-filter ${missionReadinessClass(state, "is")}`}
                >
                  {state} <span data-numeric>{n}</span>
                </button>
              ))}
            </div>
            <label className="mc-files-find">
              <span className="sr-only">Find a file</span>
              <input
                type="search"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="Find by ID, title, mission or owner"
                className="mc-input"
              />
            </label>
            {scrubbedCount ? (
              <button
                type="button"
                onClick={() => setShowScrubbed((v) => !v)}
                aria-pressed={showScrubbed}
                className="mc-files-scrubbed"
              >
                {showScrubbed ? `Hide scrubbed (${scrubbedCount})` : `Show scrubbed (${scrubbedCount})`}
              </button>
            ) : null}
          </div>
          <p className="mc-files-count" aria-live="polite" data-numeric>
            {visibleRows.length} {visibleRows.length === 1 ? "file" : "files"} shown
          </p>
          <DataTable
            label="Acquisition files"
            columns={columns}
            rows={visibleRows}
            rowKey={(row) => row.acq.acquisition_id}
            rowClassName={(row) => `mc-work-table-row ${isScrubbed(row) ? "is-scrubbed" : missionReadinessClass(row.readiness.state, "is")}`}
            empty="No file matches. Clear the search or pick another status."
            stackOnMobile
            className="mc-files-table"
          />
        </>
      ) : q.isLoading || q.isError ? null : (
        <EmptyState sentence="No files are on the clock yet." action={
          <Link to="/intake" className="inline-block rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground">{readOnly ? "See the intake form" : "Start an intake"}</Link>
        } />
      )}
    </AppShell>
  );
}
