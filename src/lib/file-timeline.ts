// One source of truth for how far along a file is and how long it is planned
// to take. The requester card, and later the Files list and Today, read these
// so one file reads the same everywhere (finish_line_plan F6):
//
// - Phase position: the file's launch sequence, AcqMetrics.phases, built by
//   buildSequence(). The file page builds the same list for its launch
//   sequence ("All N phases", "Phase X of N").
// - Countdown: countdownView(metrics), the same view the file page clock uses.
// - Planned time to award: plannedDaysForType(), the phase plan days summed in
//   order through the last pre-award phase. Calendar days, never months.
//
// The level-of-effort estimator's months and its stage grouping are a separate
// planning model. Screens that show them say "stages" and "estimate".

import { acquisitionType, phaseDone, phaseLabel, type AcqRow, type PhasePlanRow, type PhaseView } from "@/lib/launch-sequence";
import { plannedDaysForType } from "@/lib/successor";
import { calendarDaysBetween, todayCT } from "@/lib/calendar-date";
import { estimate, inputsFromAcq, type StoredEstimate } from "@/lib/estimator";

export type PhasePosition = {
  /** 1-based number of the current phase, or null when no phase is current. */
  number: number | null;
  total: number;
  /** Current phase display name, when one is current. */
  name: string | null;
  completed: number;
  /** Every phase is complete. */
  allComplete: boolean;
};

export function phasePosition(phases: PhaseView[]): PhasePosition {
  const index = phases.findIndex((p) => p.status === "current");
  const completed = phases.filter(phaseDone).length;
  const current = index >= 0 ? phases[index] : undefined;
  return {
    number: index >= 0 ? index + 1 : null,
    total: phases.length,
    name: current ? phaseLabel(current) : null,
    completed,
    allComplete: phases.length > 0 && completed === phases.length,
  };
}

/** "Phase 6 of 14" style wording, matching the file page. */
export function phasePositionText(pos: PhasePosition): string {
  if (pos.total === 0) return "No phase plan for this file";
  if (pos.number !== null) return `Phase ${pos.number} of ${pos.total}`;
  if (pos.allComplete) return `All ${pos.total} phases complete`;
  return `${pos.total} phases, not started`;
}

/** Planned calendar days from intake to award in the phase plan for this file's type. 0 when no plan. */
export function plannedDaysToAward(acq: AcqRow | Record<string, unknown>, plan: PhasePlanRow[]): number {
  return plannedDaysForType(acquisitionType(acq as unknown as AcqRow, plan), plan);
}

// Same cutoff successor.plannedDaysForType uses: the plan runs through the last
// pre-award phase (Award, or the FPDS-NG report that closes the award).
const PRE_AWARD_LAST = new Set(["Award", "FPDS-NG Report"]);

/** Phase names from intake to award in the phase plan for one acquisition type, in plan order. */
export function phasesToAwardForType(type: string, plan: PhasePlanRow[]): string[] {
  const rows = plan
    .filter((p) => p.acquisition_type === type && p.phase)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const last = rows.reduce((index, row, i) => (PRE_AWARD_LAST.has(String(row.phase)) ? i : index), -1);
  return rows.filter((_, i) => last < 0 || i <= last).map((p) => String(p.phase));
}

export type PlanToAward = { type: string; phases: string[]; plannedDays: number };

/**
 * The phase plan to award for a record, or for intake facts shaped like one
 * (the Intake page passes the row it would save). The requester card, the
 * Files list, Intake and the request confirmation all read this.
 */
export function planToAward(acq: AcqRow | Record<string, unknown>, plan: PhasePlanRow[]): PlanToAward {
  const type = acquisitionType(acq as unknown as AcqRow, plan);
  return { type, phases: phasesToAwardForType(type, plan), plannedDays: plannedDaysForType(type, plan) };
}

export type HoursEstimate = { total: number; co: number; cs: number; source: "intake" | "current" };

/**
 * Contracting hours for a file: the estimate saved with the intake when there
 * is one, otherwise the current estimate worked the way the estimator works it.
 * Hours only; days and phases come from planToAward above.
 */
export function contractingHours(acq: AcqRow | Record<string, unknown>, plan: PhasePlanRow[]): HoursEstimate | null {
  const stored = (acq as Record<string, unknown>)["intake_estimate"] as StoredEstimate | null | undefined;
  if (stored && typeof stored.hours_total === "number") {
    return { total: stored.hours_total, co: stored.hours_co, cs: stored.hours_cs, source: "intake" };
  }
  try {
    const live = estimate(inputsFromAcq(acq as never), {
      thresholds: [],
      overrides: [],
      strategies: [],
      phasePlan: plan.map((p) => ({ acquisition_type: p.acquisition_type, phase: p.phase, planned_days: p.planned_days })),
    });
    return { total: live.hours.total, co: live.hours.co, cs: live.hours.cs, source: "current" };
  } catch {
    return null;
  }
}

export type DueView = { iso: string; days: number; overdue: boolean; text: string; dateText: string };

function dueDateText(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * A phase-plan due date read against today's date at render, the same whole
 * calendar days (Central time) the desk uses. A past date reads "Overdue by N
 * days" so a stale plan date never looks current.
 */
export function dueView(value: string | null | undefined): DueView | null {
  if (!value) return null;
  const iso = value.slice(0, 10);
  const days = calendarDaysBetween(todayCT(), iso);
  if (Number.isNaN(days)) return null;
  const dateText = dueDateText(iso);
  if (days < 0) {
    const n = Math.abs(days);
    return { iso, days, overdue: true, dateText, text: `Overdue by ${n} ${n === 1 ? "day" : "days"}` };
  }
  if (days === 0) return { iso, days, overdue: false, dateText, text: "Due today" };
  return { iso, days, overdue: false, dateText, text: `Due ${dateText}` };
}

const UNFAVORABLE_SHORT = /^(No-go|Nonconcur|Disapprove|Not legally sufficient):\s*([^:]+?)(?::\s|$)/i;

/**
 * A short name for a hold, for the places that point at the full reason
 * (the hero tiles, the clock and the rail). The hold panel shows the reason
 * in full. "Nonconcur: Small business: <reason>" reads "Small business
 * nonconcur"; any other reason keeps its first sentence, cut at a word.
 */
/**
 * The hold alert line. A stored hold reason reads "Decision: role: reason", and
 * the reviewer's reason often opens with the same decision word ("Nonconcur:
 * small business: Nonconcur with ..."). The alert names the role once and the
 * decision once: "Small business: Nonconcur with ...". Display only; the stored
 * reason and the review card's written reason are unchanged.
 */
export function holdAlertText(reason: string | null | undefined): string {
  const text = String(reason ?? "").trim();
  const m = /^(No-go|Nonconcur|Disapprove|Not legally sufficient):\s*([^:]+?):\s+([\s\S]+)$/i.exec(text);
  if (!m) return text;
  const decision = (m[1] ?? "").trim();
  const roleRaw = (m[2] ?? "").trim();
  const rest = (m[3] ?? "").trim();
  if (!roleRaw || !rest) return text;
  const role = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1);
  const startsWithDecision = rest.toLowerCase().startsWith(decision.toLowerCase());
  return startsWithDecision ? `${role}: ${rest}` : `${role}: ${decision}. ${rest}`;
}

export function holdShortLabel(reason: string | null | undefined, max = 60): string {
  const text = String(reason ?? "").trim();
  if (!text) return "";
  const m = UNFAVORABLE_SHORT.exec(text);
  if (m) {
    const decision = m[1] ?? "";
    const role = (m[2] ?? "").trim();
    return decision.includes(" ") ? `${role}: ${decision.toLowerCase()}` : `${role} ${decision.toLowerCase()}`;
  }
  const first = (text.split(/(?<=[.;])\s/)[0] ?? text).replace(/[.;]$/, "");
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > 20 ? cut.slice(0, at) : cut).replace(/[,:]$/, "")}…`;
}
