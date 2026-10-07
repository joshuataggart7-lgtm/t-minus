// One status story for the file page summary card. The chip, the reason line,
// the clock and the action line all read these values, so they cannot
// disagree. Display only: readiness and countdown logic are unchanged.

import { countdownText, type CountdownView } from "@/components/launch-countdown";
import { phaseOverrunDays, type PhaseView } from "@/lib/launch-sequence";
import type { ReadinessExplanation, ReadinessState } from "./readiness";

export type FileStatusLine = {
  state: ReadinessState;
  /** HOLD: the hold reason. WATCH: the first trigger's text. GO: null. */
  reason: string | null;
  clock: string;
  /** Days the current phase is past its planned days, from phaseOverrunDays(). */
  overrunDays: number | null;
};

export function fileStatusLine(
  readiness: ReadinessExplanation,
  view: CountdownView,
  phase: PhaseView | null,
): FileStatusLine {
  const reason =
    readiness.state === "HOLD" || readiness.state === "WATCH"
      ? readiness.triggers[0]?.text?.trim() || null
      : null;
  return {
    state: readiness.state,
    reason,
    clock: countdownText(view),
    overrunDays: phase && phase.status === "current" ? phaseOverrunDays(phase) : null,
  };
}
