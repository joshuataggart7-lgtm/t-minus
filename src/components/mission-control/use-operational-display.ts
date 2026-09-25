import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import { attachedKeys, savedDocKeys } from "@/lib/hold";
import type { RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow } from "@/lib/launch-sequence";
import { computeMetrics, holdSince, type MissionRow } from "@/lib/metrics";
import { deriveOverviewAcquisitionState, overviewCountdownView } from "./operational-state";
import { explainWorkReadiness } from "./readiness";

export function useOperationalDisplay(enabled: boolean) {
  const query = useQuery({
    queryKey: ["files"],
    enabled,
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

  const byId = useMemo(() => {
    const out = new Map<string, {
      phase: string;
      clockMode: "hold" | "running" | "forecast" | "launched" | "not started";
      readiness: "GO" | "WATCH" | "HOLD" | "LAUNCHED";
      countdown: ReturnType<typeof overviewCountdownView>;
      holdReason: string | null;
    }>();
    if (!query.data) return out;
    const ref: RefData = {
      thresholds: query.data.thresholds.map((row) => ({
        name: row.name,
        value: row.value === null ? null : Number(row.value),
        citation: row.citation,
        note: row.note,
      })),
      overrides: query.data.overrides as unknown as CenterOverrideRow[],
      phasePlan: query.data.plan.map((row) => ({
        acquisition_type: row.acquisition_type,
        phase: row.phase,
        planned_days: row.planned_days,
      })),
      strategies: query.data.strategies.map((row) => ({
        psl: row.psl,
        name: row.name,
        buying_location: row.buying_location,
        mandatory_vehicles: row.mandatory_vehicles,
        required_coordination: row.required_coordination,
      })),
    };
    for (const acq of query.data.acqs) {
      const operational = deriveOverviewAcquisitionState(acq, query.data.log);
      const metric = computeMetrics(operational.acquisition, {
        attachedKeys: attachedKeys(query.data.attachments, acq.acquisition_id),
        savedKeys: savedDocKeys(query.data.documents, query.data.templates, acq.acquisition_id),
        roster: query.data.users,
        plan: query.data.plan,
        rules: query.data.rules,
        polls: query.data.polls,
        ref,
        mission: query.data.missions.find((row) => row.mission_id === acq.mission_id) ?? null,
        holdSince: holdSince(acq.acquisition_id, query.data.log),
        awardDate: operational.actualAwardDate,
      });
      const readiness = explainWorkReadiness(metric).state;
      const countdown = overviewCountdownView(metric);
      const clockMode = countdown.mode === "hold" || countdown.mode === "forecast" || countdown.mode === "launched"
        ? countdown.mode
        : countdown.mode === "not-started" || countdown.mode === "stopped"
          ? "not started"
          : "running";
      out.set(acq.acquisition_id, {
        phase: String(operational.acquisition.current_phase ?? metric.currentPhase ?? "Not recorded"),
        clockMode,
        readiness,
        countdown,
        holdReason: metric.hold?.reason ?? null,
      });
    }
    return out;
  }, [query.data]);

  return { byId, isLoading: query.isLoading };
}