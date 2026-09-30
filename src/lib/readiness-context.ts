// The one readiness context every screen uses for the official GO / WATCH /
// HOLD mark: real missing evidence, phase-plan planned_days for gate aging
// (centerAgingDays null) and the fixed 30-day watch window. Pure; no fetching.

import {
  DEFAULT_WATCH_WINDOW_DAYS,
  type ReadinessContext,
} from "@/components/mission-control/readiness";
import { docRowKey, docSatisfied, generatorKey, type AcqRow } from "@/lib/launch-sequence";
import type { AcqMetrics } from "@/lib/metrics";

export type ReadinessKeys = {
  acq: AcqRow;
  attachedKeys?: Set<string>;
  savedKeys?: Set<string>;
};

/** Required rows in the current phase that the record shows as not satisfied. */
export function currentMissingEvidence(
  metric: AcqMetrics,
  acq: AcqRow,
  attachedKeys?: Set<string>,
  savedKeys?: Set<string>,
): string[] {
  const current = metric.phases.find((p) => p.status === "current");
  return (current?.docs ?? [])
    .filter(
      (d) =>
        !d.optional &&
        (d.field || generatorKey(d)) &&
        docSatisfied(d, acq, attachedKeys ? attachedKeys.has(docRowKey(d)) : undefined, savedKeys) === false,
    )
    .map((d) => d.label);
}

export function buildReadinessContext({
  metric,
  acq,
  attachedKeys,
  savedKeys,
  today,
}: ReadinessKeys & { metric: AcqMetrics; today: string }): ReadinessContext {
  return {
    missingEvidence: currentMissingEvidence(metric, acq, attachedKeys, savedKeys),
    centerAgingDays: null,
    watchWindowDays: DEFAULT_WATCH_WINDOW_DAYS,
    today,
  };
}
