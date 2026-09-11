// The successor clock. A launched file with a period of performance end has a
// date by which the follow-on acquisition must start: the end date less the
// pre-award planned days for that acquisition type plus a transition allowance.

import { addDays, daysBetween, todayISO } from "@/lib/intake";
import { acquisitionType, type AcqRow, type PhasePlanRow } from "@/lib/launch-sequence";

export type SuccessorRow = {
  acq: AcqRow;
  /** total planned days for this acquisition type, from phase_plan */
  plannedDays: number;
  /** the date the successor acquisition must start */
  startBy: string;
  /** negative once the date has passed */
  daysUntilStart: number;
  /** the file that names this one as the acquisition it replaces */
  successorId: string | null;
  /** the date has passed and no successor file is linked */
  overdue: boolean;
};

export const SUCCESSOR_TRANSITION_DAYS = 30;
const PRE_AWARD_LAST_PHASES = new Set(["Award", "FPDS-NG Report"]);

/** Summed planned days for an acquisition type. */
export function plannedDaysForType(type: string, plan: PhasePlanRow[]) {
  const rows = plan
    .filter((p) => p.acquisition_type === type && p.phase)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const last = rows.reduce((index, row, i) => PRE_AWARD_LAST_PHASES.has(String(row.phase)) ? i : index, -1);
  return rows
    .filter((_, i) => last < 0 || i <= last)
    .reduce((sum, p) => sum + (p.planned_days ?? 0), 0);
}

/** Every launched file with a period of performance end, newest deadline last. */
export function successorRows(
  acqs: AcqRow[],
  plan: PhasePlanRow[],
  today = todayISO(),
): SuccessorRow[] {
  const linked = new Map<string, string>();
  for (const a of acqs) {
    const of = a['successor_of'] ? String(a['successor_of']) : null;
    if (of) linked.set(of, a.acquisition_id);
  }

  return acqs
    .filter(
      (a) =>
        String(a.clock_state ?? "") === "launched" &&
        !!a.period_of_performance_end,
    )
    .map((acq) => {
      const plannedDays = plannedDaysForType(acquisitionType(acq), plan);
      const end = String(acq.period_of_performance_end);
      const startBy = addDays(end, -(plannedDays + SUCCESSOR_TRANSITION_DAYS));
      const successorId = linked.get(acq.acquisition_id) ?? null;
      const daysUntilStart = daysBetween(today, startBy);
      return {
        acq,
        plannedDays,
        startBy,
        daysUntilStart,
        successorId,
        overdue: daysUntilStart < 0 && !successorId,
      };
    })
    .sort((a, b) => a.startBy.localeCompare(b.startBy));
}

/** The successor line for one file, or null when the file has no end date. */
export function successorFor(
  acquisitionId: string,
  acqs: AcqRow[],
  plan: PhasePlanRow[],
  today = todayISO(),
): SuccessorRow | null {
  return successorRows(acqs, plan, today).find((r) => r.acq.acquisition_id === acquisitionId) ?? null;
}
