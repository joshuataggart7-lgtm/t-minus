import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/actor";
import type { ResearchFinding } from "@/lib/research-findings";

/**
 * Market research evidence engine.
 *
 * Runs only on the contracting officer's click. Every source, query, date and
 * result count is written to the research log on the file, and the drafted
 * values are stored as findings carrying their source and date until the
 * contracting officer confirms them.
 */

const runSchema = z.object({ acquisitionId: z.string().trim().min(1).max(40) });

export type ResearchLogEntry = {
  source: string;
  query: string;
  resultCount: number | null;
  outcome: string;
  ranAt: string;
};

export type ResearchRunView = {
  runId: string;
  acquisitionId: string;
  naics: string;
  stateCode: string | null;
  ranAt: string;
  log: ResearchLogEntry[];
  findings: ResearchFinding[];
  smallBusinessCount: number;
  ruleOfTwoMet: boolean;
  suggestedSetAside: string;
  entityCount: number;
  noticeCount: number;
  awardCount: number;
};

export const runMarketResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => runSchema.parse(input))
  .handler(async ({ data, context }): Promise<ResearchRunView> => {
    const me = await requireRole(context, ["specialist", "reviewer", "hq"], "Market research is run by the contracting, reviewer and HQ roles.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runEngine, draftFindings } = await import("@/lib/market-research.server");

    const acq = await supabaseAdmin
      .from("acquisition_facts")
      .select("*")
      .eq("acquisition_id", data.acquisitionId)
      .maybeSingle();
    if (acq.error) throw new Error(acq.error.message);
    if (!acq.data) throw new Error("The acquisition was not found.");
    const record = acq.data as Record<string, unknown>;
    const naics = String(record["naics_code"] ?? "").trim();
    if (!naics) throw new Error("This record has no NAICS code, so the research cannot run. Add one on the intake.");

    // Run public-source searches before creating the database run. A slow or
    // interrupted provider call must not leave an empty run that hides the
    // last completed research log.
    const runId = crypto.randomUUID();
    const result = await runEngine({ runId, acq: record, supabaseAdmin });

    const run = await supabaseAdmin
      .from("research_runs")
      .insert({
        run_id: runId,
        acquisition_id: data.acquisitionId,
        naics_code: naics,
        psc_code: String(record["psc_code"] ?? "") || null,
        acquisition_method: String(record["acquisition_method"] ?? "") || null,
        state_code: result.stateCode,
        ran_by: me.name,
        ran_at: result.ranAt,
      })
      .select("run_id,ran_at")
      .single();
    if (run.error) throw new Error(run.error.message);

    const logRows = result.log.map((entry) => ({
      run_id: run.data.run_id,
      acquisition_id: data.acquisitionId,
      source: entry.source,
      query: entry.query,
      result_count: entry.resultCount,
      outcome: entry.outcome,
      ran_at: result.ranAt,
    }));
    if (!logRows.length) {
      await supabaseAdmin.from("research_runs").delete().eq("run_id", run.data.run_id);
      throw new Error("The research completed without a source log, so the run was not saved.");
    }
    const { error: logError } = await supabaseAdmin.from("research_log").insert(logRows);
    if (logError) {
      await supabaseAdmin.from("research_runs").delete().eq("run_id", run.data.run_id);
      throw new Error(logError.message);
    }

    const drafted = draftFindings(result, record);
    for (const f of drafted) {
      const { error } = await supabaseAdmin.from("research_findings").upsert(
        {
          run_id: run.data.run_id,
          acquisition_id: data.acquisitionId,
          target: f.target,
          label: f.label,
          value: f.value,
          source: f.source,
          source_date: f.sourceDate,
          confirmed: false,
          confirmed_by: null,
          confirmed_at: null,
        },
        { onConflict: "acquisition_id,target" },
      );
      if (error) throw new Error(error.message);
    }

    // A run replaces the previous run's values on the file: any finding left
    // behind by an earlier run is removed, so documents read this run only.
    const { error: staleError } = await supabaseAdmin
      .from("research_findings")
      .delete()
      .eq("acquisition_id", data.acquisitionId)
      .neq("run_id", run.data.run_id);
    if (staleError) throw new Error(staleError.message);

    const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
      acquisition_id: data.acquisitionId,
      actor: me.name,
      action: "Market research run",
      field: `NAICS ${naics}${result.stateCode ? ` · ${result.stateCode}` : ""}`,
      old_value: null,
      new_value: `${result.log.length} sources searched · ${drafted.length} values drafted`,
      reason: "Market research evidence engine, public sources only.",
      phase: "Market Research",
      logged_at: result.ranAt,
    });
    if (auditError) throw new Error(auditError.message);

    return {
      runId: run.data.run_id,
      acquisitionId: data.acquisitionId,
      naics,
      stateCode: result.stateCode,
      ranAt: result.ranAt,
      log: result.log.map((l) => ({ ...l, ranAt: result.ranAt })),
      findings: drafted.map((f) => ({
        target: f.target,
        label: f.label,
        value: f.value,
        source: f.source,
        sourceDate: f.sourceDate,
        confirmed: false,
        confirmedBy: null,
      })),
      smallBusinessCount: result.smallBusinessCount,
      ruleOfTwoMet: result.ruleOfTwoMet,
      suggestedSetAside: result.ruleOfTwoMet
        ? "Total small business set-aside"
        : "No set-aside; proceed unrestricted and document the market research",
      entityCount: new Set([...result.stateEntities, ...result.nationalEntities].map((e) => e.uei)).size,
      noticeCount: result.notices.length,
      awardCount: result.awards.length,
    };
  });

const readSchema = z.object({ acquisitionId: z.string().trim().min(1).max(40) });

export const readMarketResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => readSchema.parse(input))
  .handler(async ({ data, context }) => {
    const findings = await context.supabase
      .from("research_findings")
      .select("target,label,value,source,source_date,confirmed,confirmed_by")
      .eq("acquisition_id", data.acquisitionId);
    if (findings.error) throw new Error(findings.error.message);
    // The file shows the most recent run; earlier runs stay as history.
    const runs = await context.supabase
      .from("research_runs")
      .select("run_id,ran_at")
      .eq("acquisition_id", data.acquisitionId)
      .order("ran_at", { ascending: false })
      .limit(20);
    if (runs.error) throw new Error(runs.error.message);
    const runList = runs.data ?? [];
    const log = await context.supabase
      .from("research_log")
      .select("run_id,source,query,result_count,outcome,ran_at")
      .eq("acquisition_id", data.acquisitionId)
      .order("ran_at", { ascending: false })
      .limit(400);
    if (log.error) throw new Error(log.error.message);
    const rows = (log.data ?? []).map((l) => ({
      runId: l.run_id as string,
      source: l.source,
      query: l.query,
      resultCount: l.result_count,
      outcome: l.outcome,
      ranAt: l.ran_at,
    }));
    const runIdsWithLogs = new Set(rows.map((row) => row.runId));
    const completedRuns = runList.filter((run) => runIdsWithLogs.has(run.run_id));
    const latestRunId = completedRuns[0]?.run_id ?? null;
    return {
      latestRanAt: completedRuns[0]?.ran_at ?? null,
      latestIncompleteRanAt:
        runList[0] && !runIdsWithLogs.has(runList[0].run_id) ? runList[0].ran_at : null,
      previousRuns: completedRuns.slice(1).map((r) => ({
        runId: r.run_id as string,
        ranAt: r.ran_at as string,
        log: rows.filter((l) => l.runId === r.run_id).map(({ runId: _runId, ...rest }) => rest) as ResearchLogEntry[],
      })),
      findings: (findings.data ?? []).map((f) => ({
        target: f.target,
        label: f.label,
        value: f.value,
        source: f.source,
        sourceDate: f.source_date,
        confirmed: f.confirmed,
        confirmedBy: f.confirmed_by,
      })) as ResearchFinding[],
      log: rows
        .filter((l) => (latestRunId ? l.runId === latestRunId : true))
        .map(({ runId: _runId, ...rest }) => rest) as ResearchLogEntry[],
    };
  });

const confirmSchema = z.object({
  acquisitionId: z.string().trim().min(1).max(40),
  targets: z.array(z.string().trim().min(1).max(80)).min(1).max(40),
});

export const confirmResearchFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmSchema.parse(input))
  .handler(async ({ data, context }) => {
    const me = await requireRole(context, ["specialist", "hq"], "Only the contracting officer or specialist confirms a researched value.");
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("research_findings")
      .update({ confirmed: true, confirmed_by: me.name, confirmed_at: now })
      .eq("acquisition_id", data.acquisitionId)
      .in("target", data.targets);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
      acquisition_id: data.acquisitionId,
      actor: me.name,
      action: "Research finding confirmed",
      field: data.targets.join(", "),
      old_value: "from public data",
      new_value: "confirmed by the contracting officer",
      reason: "Confirmed on the market research evidence engine.",
      phase: "Market Research",
      logged_at: now,
    });
    if (auditError) throw new Error(auditError.message);
    return { confirmed: data.targets, confirmedBy: me.name };
  });
