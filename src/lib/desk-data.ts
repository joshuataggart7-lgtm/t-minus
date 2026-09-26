// Shared read for the three role desks: Requester portal, Reviewer inbox and
// CO Today. Every figure is recomputed from the record with the same helpers
// the Work Queue and the file page use. Nothing new is stored.

import { calendarDaysBetween, todayCT } from "@/lib/calendar-date";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadLaunchEvents } from "@/lib/launch-events";
import { deriveOverviewAcquisitionState } from "@/components/mission-control/operational-state";
import type { CenterOverrideRow } from "@/lib/center-config";
import type { RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow, RequiredDoc } from "@/lib/launch-sequence";
import { generatorKey } from "@/lib/launch-sequence";
import { attachedKeys as keysFrom, savedDocKeys } from "@/lib/hold";
import { historyFrom, type HistoryFile } from "@/lib/confidence";
import {
  computeMetrics,
  holdSince,
  type AcqMetrics,
  type MissionRow,
} from "@/lib/metrics";

export type DeskCard = {
  m: AcqMetrics;
  mission: string;
  owner: string;
  requester: string;
  attachedKeys: Set<string>;
};

export type DeskData = {
  cards: DeskCard[];
  plan: PhasePlanRow[];
  /** launched files with their recorded award dates, for the confidence range */
  history: HistoryFile[];
  polls: PollRow[];
  centers: { center_code: string; aging_threshold_days?: number | null }[];
  modTasks: {
    acquisition_id: string;
    clause_number: string;
    change_kind: string;
    status: string;
    deadline_date: string | null;
  }[];
};

/** One read that every desk shares, so the three pages stay consistent. */
export function useDeskData(enabled: boolean) {
  const q = useQuery({
    queryKey: ["desk-data"],
    enabled,
    refetchInterval: 10000,
    queryFn: async () => {
      const [missions, acqs, plan, rules, overrides, thresholds, strategies, polls, log, users, centers, launches] =
        await Promise.all([
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
          supabase.from("users").select("name,title,center_code"),
          supabase.from("centers").select("center_code,aging_threshold_days"),
          loadLaunchEvents(),
        ]);
      const [attachments, documents, templateRows, modTasks] = await Promise.all([
        supabase.from("document_attachments").select("acquisition_id,doc_key"),
        supabase.from("documents").select("acquisition_id,template_id"),
        supabase.from("templates").select("template_id,name"),
        supabase
          .from("clause_mod_tasks")
          .select("acquisition_id,clause_number,change_kind,status,deadline_date")
          .neq("status", "Complete"),
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
        attachments: attachments.data ?? [],
        documents: documents.data ?? [],
        templates: templateRows.data ?? [],
        modTasks: (modTasks.data ?? []) as DeskData["modTasks"],
        log: log.data ?? [],
        launches,
        users: (users.data ?? []) as { name: string; title: string | null; center_code: string | null }[],
        centers: (centers.data ?? []) as DeskData["centers"],
      };
    },
  });

  const data: DeskData | null = useMemo(() => {
    const d = q.data;
    if (!d) return null;
    const ref: RefData = {
      thresholds: d.thresholds.map((t) => ({
        name: t.name,
        value: t.value === null ? null : Number(t.value),
        citation: t.citation,
        note: t.note,
      })),
      overrides: d.overrides as unknown as CenterOverrideRow[],
      phasePlan: d.plan.map((p) => ({
        acquisition_type: p.acquisition_type,
        phase: p.phase,
        planned_days: p.planned_days,
      })),
      strategies: d.strategies.map((s) => ({
        psl: s.psl,
        name: s.name,
        buying_location: s.buying_location,
        mandatory_vehicles: s.mandatory_vehicles,
        required_coordination: s.required_coordination,
      })),
    };
    const cards: DeskCard[] = d.acqs
      .filter((a) => String(a.clock_state ?? "") !== "scrubbed")
      .map((acq) => {
        const mission = d.missions.find((m) => m.mission_id === acq.mission_id) ?? null;
        const attachedKeys = keysFrom(d.attachments, acq.acquisition_id);
        const operational = deriveOverviewAcquisitionState(acq, [...d.log, ...d.launches]);
        const m = computeMetrics(operational.acquisition, {
          attachedKeys,
          savedKeys: savedDocKeys(d.documents, d.templates, acq.acquisition_id),
          roster: d.users,
          plan: d.plan,
          rules: d.rules,
          polls: d.polls,
          ref,
          mission,
          holdSince: holdSince(acq.acquisition_id, d.log),
          awardDate: operational.actualAwardDate,
        });
        return {
          m,
          attachedKeys,
          mission: mission?.name ?? "No mission linked",
          owner: String(acq.co_name ?? "Unassigned"),
          requester: String(acq['requester_name'] ?? ""),
        };
      });
    return {
      cards,
      polls: d.polls,
      centers: d.centers,
      modTasks: d.modTasks,
      plan: d.plan,
      history: historyFrom(d.acqs, d.launches),
    };
  }, [q.data]);

  return { ...q, desk: data };
}

/** Whole days between an ISO date or timestamp and today, never negative. */
export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const then = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/** Whole days until an ISO date. Negative means the date has passed. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const days = calendarDaysBetween(todayCT(), value.slice(0, 10));
  return Number.isNaN(days) ? null : days;
}

/**
 * The one document a reviewer should read for a poll phase: the first required
 * document of that phase that T-Minus writes itself. Optional rows are never
 * the one thing to read.
 */
export function heroDocForPhase(
  m: AcqMetrics,
  phase: string,
): { doc: RequiredDoc; key: string; kind: "template" | "form" } | null {
  const index = m.phases.findIndex((p) => p.phase.toLowerCase() === phase.toLowerCase());
  if (index < 0) return null;
  const pick = (docs: RequiredDoc[]) => {
    for (const doc of docs) {
      if (doc.optional) continue;
      const key = generatorKey(doc);
      if (!key) continue;
      return { doc, key, kind: (doc.templateKey ? "template" : "form") as "template" | "form" };
    }
    return null;
  };
  // The poll phase itself first. A review phase records votes rather than a
  // document, so the document under review is the last one the file produced
  // before the poll opened.
  const own = pick(m.phases[index]?.docs ?? []);
  if (own) return own;
  for (let i = index - 1; i >= 0; i -= 1) {
    const earlier = pick(m.phases[i]?.docs ?? []);
    if (earlier) return earlier;
  }
  return null;
}

export type HeroDoc = {
  doc: RequiredDoc;
  key: string;
  /** "file" means the row is an attachment flag with no generator to open. */
  kind: "template" | "form" | "file";
};

/**
 * The one document that belongs to a given reviewer's office, searched across
 * every phase of the file rather than only the poll phase. Falls back to the
 * phase document when the office has no document of its own on the record.
 */
export function heroDocForReviewer(
  m: AcqMetrics,
  reviewerRole: string,
  phase: string,
): HeroDoc | null {
  const role = (reviewerRole ?? "").toLowerCase();
  const all: RequiredDoc[] = m.phases.flatMap((p) => p.docs ?? []);
  const wrap = (doc: RequiredDoc | undefined): HeroDoc | null => {
    if (!doc) return null;
    const key = generatorKey(doc);
    if (!key) return { doc, key: "", kind: "file" };
    return { doc, key, kind: doc.templateKey ? "template" : "form" };
  };
  const byForm = (formKey: string) => all.find((d) => d.formKey === formKey);
  const byTemplate = (templateKey: string) => all.find((d) => d.templateKey === templateKey);
  const sow = () =>
    all.find((d) => d.field === "sow_attached" || d.label.toLowerCase().startsWith("statement of work"));

  let pick: RequiredDoc | undefined;
  if (role.includes("small business")) pick = byForm("nf-1787");
  else if (role.includes("flight operations") || role.includes("aviation")) pick = sow();
  else if (role.includes("legal"))
    pick =
      byTemplate("jofoc") ??
      all.find((d) => d.label.toLowerCase().includes("justification"));
  else if (role.includes("pricing") || role.includes("price")) pick = byTemplate("pnm");

  const chosen = wrap(pick);
  if (chosen) return chosen;
  return heroDocForPhase(m, phase);
}

/** Does a pending poll belong to this reviewer by name or by the office they hold? */
export function pollMatchesReviewer(
  poll: PollRow,
  persona: { name: string; title?: string | null },
): boolean {
  const name = (poll.reviewer_name ?? "").toLowerCase();
  const role = (poll.reviewer_role ?? "").toLowerCase();
  const personName = persona.name.toLowerCase();
  const title = (persona.title ?? "").toLowerCase();
  if (name && personName && name === personName) return true;
  if (title && title !== "reviewer" && role.includes(title)) return true;
  return false;
}
