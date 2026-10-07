import { countdownView, type CountdownView } from "@/components/launch-countdown";
import { phaseAlias } from "@/lib/phase-alias";
import { dateCT } from "@/lib/calendar-date";
import type { AcqRow } from "@/lib/launch-sequence";
import type { AcqMetrics } from "@/lib/metrics";

type LaunchEvent = {
  acquisition_id: string | null;
  action: string | null;
  logged_at: string | null;
  field?: string | null;
  new_value?: string | null;
};

/**
 * The America/Chicago day each phase was entered, read from the recorded phase
 * changes (audit rows on current_phase, written when a phase is exited). Keys
 * are lower-case phase names; a phase entered more than once keeps the latest
 * entry. Empty when the file has no recorded phase change.
 */
export function phaseEntryDates(acquisitionId: string, log: LaunchEvent[]): Record<string, string> {
  const out: Record<string, string> = {};
  const rows = log
    .filter(
      (r) =>
        r.acquisition_id === acquisitionId &&
        r.logged_at &&
        (r.field === "current_phase" || /^Phase exited: /.test(r.action ?? "")),
    )
    .sort((a, b) => String(a.logged_at).localeCompare(String(b.logged_at)));
  for (const r of rows) {
    let next = r.field === "current_phase" ? (r.new_value ?? null) : null;
    if (!next) {
      const m = /\u2192\s*(.+)$/.exec(r.action ?? "");
      next = m ? m[1]! : null;
    }
    const day = dateCT(String(r.logged_at));
    if (next && next.trim() && day) out[String(phaseAlias(next.trim())).toLowerCase()] = day;
  }
  return out;
}

export type OverviewAcquisitionState = {
  acquisition: AcqRow;
  actualAwardDate: string | null;
  isAwarded: boolean;
};

function recordedAwardDate(acquisitionId: string, log: LaunchEvent[]) {
  const event = log
    .filter((row) => row.acquisition_id === acquisitionId && row.action === "Launched" && row.logged_at)
    .sort((a, b) => String(b.logged_at).localeCompare(String(a.logged_at)))[0];
  const date = event?.logged_at ? (dateCT(String(event.logged_at)) ?? "") : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/**
 * The Executive Overview's single operational state source. A recorded launch
 * event is the only fact that advances a file into post-award state.
 */
export function deriveOverviewAcquisitionState(acq: AcqRow, log: LaunchEvent[]): OverviewAcquisitionState {
  const actualAwardDate = recordedAwardDate(acq.acquisition_id, log);
  const isAwarded = actualAwardDate !== null;
  const recordedClock = String(acq.clock_state ?? "running").toLowerCase();
  const recordedPhase = String(acq.current_phase ?? "");
  const isPostAwardPhase = recordedPhase === "Administration" || recordedPhase === "Closeout";

  return {
    actualAwardDate,
    isAwarded,
    acquisition: {
      ...acq,
      clock_state: isAwarded ? "launched" : recordedClock === "launched" ? "running" : recordedClock,
      current_phase: isAwarded
        ? (isPostAwardPhase ? recordedPhase : "Administration")
        : (isPostAwardPhase ? "Award" : (phaseAlias(acq.current_phase) ?? null)),
      // Derived only, never written back: the recorded day each phase began.
      __phase_entered_at: phaseEntryDates(acq.acquisition_id, log),
    },
  };
}

/** T+ is reserved for a recorded actual award. */
export function overviewCountdownView(metric: AcqMetrics): CountdownView {
  return countdownView(metric);
}