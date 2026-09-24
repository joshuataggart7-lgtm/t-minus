import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { MissionReadinessChip, missionReadinessClass } from "@/components/mission-control/primitives";
import { explainWorkReadiness } from "@/components/mission-control/readiness";
import { deriveOverviewAcquisitionState, overviewCountdownView } from "@/components/mission-control/operational-state";
import { LaunchCountdownCompact } from "@/components/launch-countdown";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import { formatMoney, type RefData } from "@/lib/intake";
import type { StoredEstimate } from "@/lib/estimator";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow } from "@/lib/launch-sequence";
import { attachedKeys, savedDocKeys } from "@/lib/hold";
import { computeMetrics, holdSince, type MissionRow } from "@/lib/metrics";

/** The same summary the requester saw when the clock started. */
function estimateLine(est: StoredEstimate | null) {
  if (!est) return "—";
  return `About ${est.months_to_award} months, ${est.phases.length} phases, ${est.hours_total.toLocaleString("en-US")} hours`;
}

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "Files — T-Minus" },
      { name: "description", content: "Every acquisition file, its clock line, and its days to award." },
      { property: "og:title", content: "Files — T-Minus" },
      { property: "og:description", content: "Every acquisition file, its clock line, and its days to award." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FilesPage,
});

function FilesPage() {
  const { authState, hasAnyRole } = useRole();
  const q = useQuery({
    queryKey: ["files"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [acqs, missions, plan, rules, polls, log, users, attachments, documents, templates, overrides, thresholds, strategies] = await Promise.all([
        supabase.from("acquisition_facts").select("*").order("acquisition_id"),
        supabase.from("missions").select("*"),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("review_rules").select("*"),
        supabase.from("polls").select("*"),
        supabase.from("audit_log").select("acquisition_id,action,actor,logged_at,phase").order("logged_at", { ascending: false }).limit(500),
        supabase.from("users").select("name,title,center_code"),
        supabase.from("document_attachments").select("acquisition_id,doc_key"),
        supabase.from("documents").select("acquisition_id,template_id"),
        supabase.from("templates").select("template_id,name"),
        supabase.from("center_overrides").select("*"),
        supabase.from("thresholds").select("*"),
        supabase.from("enterprise_strategies").select("*"),
      ]);
      return {
        acqs: (acqs.data ?? []) as unknown as AcqRow[],
        missions: (missions.data ?? []) as MissionRow[],
        plan: (plan.data ?? []) as PhasePlanRow[],
        rules: (rules.data ?? []) as ReviewRuleRow[],
        polls: (polls.data ?? []) as PollRow[],
        log: log.data ?? [],
        users: users.data ?? [],
        attachments: attachments.data ?? [],
        documents: documents.data ?? [],
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

  const rows = useMemo(() => {
    if (!q.data) return [];
    return q.data.acqs.map((acq) => {
      const operational = deriveOverviewAcquisitionState(acq, q.data.log);
      const mission = q.data.missions.find((row) => row.mission_id === acq.mission_id) ?? null;
      const metric = computeMetrics(operational.acquisition, {
        attachedKeys: attachedKeys(q.data.attachments, acq.acquisition_id),
        savedKeys: savedDocKeys(q.data.documents, q.data.templates, acq.acquisition_id),
        roster: q.data.users,
        plan: q.data.plan,
        rules: q.data.rules,
        polls: q.data.polls,
        ref,
        mission,
        holdSince: holdSince(acq.acquisition_id, q.data.log),
        awardDate: operational.actualAwardDate,
      });
      return { acq, operational: operational.acquisition, metric, readiness: explainWorkReadiness(metric).state };
    });
  }, [q.data, ref]);

  return (
    <AppShell>
      <PageHeader title="Files" lead="Every acquisition file, its phase, and its days to award." />
      {hasAnyRole(["specialist", "requester", "hq"]) ? (
        <Link to="/intake" className="mb-6 inline-block rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground">
          Start an intake
        </Link>
      ) : null}
      {q.isLoading ? <LoadingNote what="the files" /> : null}
      {q.isError ? <ErrorNote message="The file list did not load. Refresh the page; if it fails again, open Seed status to confirm the records loaded." /> : null}

      {rows.length ? (
        <div className="mc-work-table-wrap">
          <table className="w-full min-w-[68rem] border border-border bg-background text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-2">Acquisition</th>
                <th scope="col" className="p-2">Title</th>
                <th scope="col" className="p-2">Center</th>
                <th scope="col" className="p-2">Estimated value</th>
                <th scope="col" className="p-2">Phase</th>
                <th scope="col" className="p-2">Readiness</th>
                <th scope="col" className="p-2">Award clock</th>
                <th scope="col" className="p-2">Estimate at intake</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ acq, operational, metric, readiness }) => (
                <tr key={acq.acquisition_id} className={`mc-work-table-row ${missionReadinessClass(readiness, "is")} border-b border-border align-top last:border-0`}>
                  <td className="p-2">
                    <Link to="/files/$acquisitionId" params={{ acquisitionId: acq.acquisition_id }} className="text-primary hover:text-primary-hover">
                      {acq.acquisition_id}
                    </Link>
                  </td>
                  <td className="p-2 break-words">
                    {String(acq.title ?? "—")}
                    {acq.source_tag === "backfilled" ? (
                      <span className="mt-1 block text-[13px] text-muted-foreground">
                        Backfilled{acq.contract_number ? ` · contract ${acq.contract_number}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2">{String(acq.center_code ?? "—")}</td>
                  <td className="p-2" data-numeric>{acq.estimated_value ? formatMoney(Number(acq.estimated_value)) : "—"}</td>
                  <td className="p-2">{String(operational.current_phase ?? "—")}</td>
                  <td className="p-2"><MissionReadinessChip state={readiness} /></td>
                  <td className="p-2" data-numeric><LaunchCountdownCompact view={overviewCountdownView(metric)} /></td>
                  <td className="p-2">{estimateLine(acq.intake_estimate as StoredEstimate | null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : q.isLoading || q.isError ? null : (
        <EmptyState sentence="No files are on the clock yet." action={
          <Link to="/intake" className="inline-block rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground">Start an intake</Link>
        } />
      )}
    </AppShell>
  );
}