import { countdownView, type CountdownView } from "@/components/launch-countdown";
import type { AcqRow } from "@/lib/launch-sequence";
import type { AcqMetrics } from "@/lib/metrics";

type LaunchEvent = {
  acquisition_id: string | null;
  action: string | null;
  logged_at: string | null;
};

export type OverviewAcquisitionState = {
  acquisition: AcqRow;
  actualAwardDate: string | null;
  isAwarded: boolean;
};

function recordedAwardDate(acquisitionId: string, log: LaunchEvent[]) {
  const event = log
    .filter((row) => row.acquisition_id === acquisitionId && row.action === "Launched" && row.logged_at)
    .sort((a, b) => String(b.logged_at).localeCompare(String(a.logged_at)))[0];
  const date = event?.logged_at ? String(event.logged_at).slice(0, 10) : "";
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
        : (isPostAwardPhase ? "Award" : (acq.current_phase ?? null)),
    },
  };
}

/** T+ is reserved for a recorded actual award. Every pre-award face remains T−. */
export function overviewCountdownView(metric: AcqMetrics): CountdownView {
  const view = countdownView(metric);
  if (view.mode !== "overdue") return view;
  return {
    ...view,
    prefix: "T−",
    badge: "OVERDUE",
    caption: "days past the target award date",
  };
}