/**
 * Days to award, with a confidence range.
 *
 * Three figures, all read from the record and never invented:
 *   - calendar days to the target award date (computed elsewhere, shown as is),
 *   - planned working days for this acquisition type, from phase_plan, and
 *   - the spread of actual days taken by prior files of the same profile.
 *
 * A prior file counts only when it is launched and carries both a recorded
 * clock start and a recorded award date. With fewer than three such files the
 * range is withheld and the line says so.
 */

import { dateCT } from "@/lib/calendar-date";
import { daysBetween } from "@/lib/intake";
import { acquisitionType, type AcqRow, type PhasePlanRow } from "@/lib/launch-sequence";
import { plannedDaysForType } from "@/lib/successor";

export const MIN_HISTORY = 3;

/** Weekends removed from a run of calendar days, five days in every seven. */
export function workingDaysIn(calendarDays: number) {
  if (!Number.isFinite(calendarDays) || calendarDays <= 0) return 0;
  return Math.round((calendarDays * 5) / 7);
}

export type AwardConfidence = {
  /** planned calendar days to award for this acquisition type */
  plannedDays: number;
  /** the same run with weekends removed */
  plannedWorkingDays: number;
  /** how many prior files the range is drawn from */
  peerCount: number;
  /** the Center the peer files come from, or null when the set is agency-wide */
  peerCenter: string | null;
  low: number | null;
  high: number | null;
  median: number | null;
  /** one plain sentence for the clock line */
  sentence: string;
};

export type HistoryFile = {
  acq: AcqRow;
  /** the recorded award date for that file */
  awardDate: string | null;
};

function actualDays(h: HistoryFile): number | null {
  const start = (h.acq.regulatory_baseline_date as string | null) ?? null;
  const end = h.awardDate;
  if (!start || !end) return null;
  const n = daysBetween(start, end);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The planned days and the honest history range for one file. */
export function awardConfidence(
  acq: AcqRow,
  history: HistoryFile[],
  plan: PhasePlanRow[],
): AwardConfidence {
  const type = acquisitionType(acq);
  const plannedDays = plannedDaysForType(type, plan);
  const plannedWorkingDays = workingDaysIn(plannedDays);

  const sameProfile = history.filter(
    (h) =>
      h.acq.acquisition_id !== acq.acquisition_id &&
      h.awardDate !== null &&
      acquisitionType(h.acq) === type,
  );

  const center = acq.center_code ? String(acq.center_code) : null;
  const atCenter = center ? sameProfile.filter((h) => h.acq.center_code === center) : [];
  const useCenter = atCenter.length >= MIN_HISTORY;
  const set = useCenter ? atCenter : sameProfile;

  const days = set
    .map(actualDays)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const plannedPart =
    plannedDays > 0
      ? `${plannedDays} planned calendar days, about ${plannedWorkingDays} working days`
      : "no planned run recorded for this acquisition type";

  if (days.length < MIN_HISTORY) {
    return {
      plannedDays,
      plannedWorkingDays,
      peerCount: days.length,
      peerCenter: useCenter ? center : null,
      low: null,
      high: null,
      median: null,
      sentence: `${plannedPart}; confidence range not yet enough history.`,
    };
  }

  const low = days[0]!;
  const high = days[days.length - 1]!;
  const mid = days.length % 2
    ? days[(days.length - 1) / 2]!
    : Math.round((days[days.length / 2 - 1]! + days[days.length / 2]!) / 2);
  const where = useCenter && center ? `at ${center}` : "across T-Minus files";

  return {
    plannedDays,
    plannedWorkingDays,
    peerCount: days.length,
    peerCenter: useCenter ? center : null,
    low,
    high,
    median: mid,
    sentence:
      `${plannedPart}; files like this ${where} have taken ${low} to ${high} days ` +
      `(${days.length} prior file${days.length === 1 ? "" : "s"}, median ${mid}).`,
  };
}

/** Award dates keyed by file, taken from the recorded launch events. */
export function awardDatesFromLog(
  log: { acquisition_id: string | null; action: string | null; logged_at: string | null }[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of log) {
    if (!row.acquisition_id || row.action !== "Launched" || !row.logged_at) continue;
    const day = dateCT(String(row.logged_at));
    const seen = out.get(row.acquisition_id);
    if (!seen || day < seen) out.set(row.acquisition_id, day);
  }
  return out;
}

/** History rows from a set of records plus the recorded launch events. */
export function historyFrom(
  acqs: AcqRow[],
  log: { acquisition_id: string | null; action: string | null; logged_at: string | null }[],
): HistoryFile[] {
  const dates = awardDatesFromLog(log);
  return acqs.map((a) => ({
    acq: a,
    awardDate: dates.get(a.acquisition_id) ?? null,
  }));
}
