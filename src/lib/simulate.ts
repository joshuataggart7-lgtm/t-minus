/**
 * Policy impact simulator.
 *
 * Nothing here changes a record. It re-runs the same review rules and phase
 * plan the engine already uses, once against the values loaded today and once
 * against a proposed value, and reports the difference in planned days.
 *
 * Planned days for a file are the phase plan days for its acquisition type
 * plus the planned days of every review rule that applies to it. A threshold
 * or a review trigger changes which reviews apply, so the difference is the
 * planned days of the review steps that appear or disappear.
 */

import { reviewApplies, type AcqRow, type PhasePlanRow, type ReviewRuleRow } from "@/lib/launch-sequence";
import type { RefData } from "@/lib/intake";
import type { CenterOverrideRow } from "@/lib/center-config";

export type SimChange = {
  kind: "threshold" | "review_trigger";
  /** Threshold name, or reviewer role for a review trigger. */
  target: string;
  value: number;
};

export type SimFile = {
  acquisition_id: string;
  title: string;
  center_code: string | null;
  estimated_value: number | null;
  daysNow: number;
  daysThen: number;
  /** Positive when the file clears sooner. */
  daysSooner: number;
  added: string[];
  removed: string[];
};

export type SimResult = {
  headline: string;
  method: string;
  filesConsidered: number;
  filesAffected: SimFile[];
  totalDaysSooner: number;
  totalDaysLater: number;
};

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Files still working toward award. Launched and scrubbed files do not move. */
export function isActive(acq: AcqRow): boolean {
  const state = String(acq.clock_state ?? "").toLowerCase();
  const status = String(acq.status ?? "").toLowerCase();
  return !/launch|scrub/.test(state) && !/launch|scrub/.test(status);
}

function phaseDays(acq: AcqRow, plan: PhasePlanRow[]): number {
  const type = /sole/i.test(String(acq.competition ?? ""))
    ? "commercial_ffp_13_5_sole_source"
    : "commercial_ffp_13_5_competed";
  const rows = plan
    .filter((p) => p.acquisition_type === type && p.phase)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let total = 0;
  for (const r of rows) {
    total += r.planned_days ?? 0;
    if ((r.phase ?? "").toLowerCase() === "award") break;
  }
  return total;
}

/** The reference data as it would read if the proposed value were in effect. */
export function applyChange(ref: RefData, centers: string[], change: SimChange): RefData {
  if (change.kind === "threshold") {
    const name = change.target.trim().toLowerCase();
    const thresholds = ref.thresholds.map((t) =>
      (t.name ?? "").trim().toLowerCase() === name ? { ...t, value: change.value } : t,
    );
    return { ...ref, thresholds };
  }
  // A proposed review trigger is modelled as if every Center carried it.
  const rows: CenterOverrideRow[] = centers.map((code, i) => ({
    override_id: `simulated-${i}`,
    center_code: code,
    kind: "review_trigger",
    target: change.target,
    value: change.value,
    note: "Simulated; nothing is written",
    citation: null,
    effective_date: "1900-01-01",
    superseded_date: null,
    set_by: null,
  }));
  // The simulated rows come first so they win over what is loaded today.
  const others = (ref.overrides ?? []).filter(
    (o) => !(o.kind === "review_trigger" && (o.target ?? "").toLowerCase() === change.target.toLowerCase()),
  );
  return { ...ref, overrides: [...rows, ...others] };
}

function applicableReviews(acq: AcqRow, rules: ReviewRuleRow[], ref: RefData) {
  return rules.filter((r) => reviewApplies(r, acq, ref));
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "not recorded";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function simulate(
  acqs: AcqRow[],
  rules: ReviewRuleRow[],
  plan: PhasePlanRow[],
  ref: RefData,
  change: SimChange,
): SimResult {
  const active = acqs.filter(isActive);
  const centers = Array.from(
    new Set(active.map((a) => (a['center_code'] as string | null) ?? "").filter(Boolean)),
  ) as string[];
  const then = applyChange(ref, centers, change);

  const files: SimFile[] = [];
  for (const acq of active) {
    const base = phaseDays(acq, plan);
    const now = applicableReviews(acq, rules, ref);
    const after = applicableReviews(acq, rules, then);
    const daysNow = base + now.reduce((s, r) => s + (r.planned_days ?? 0), 0);
    const daysThen = base + after.reduce((s, r) => s + (r.planned_days ?? 0), 0);
    if (daysNow === daysThen) continue;
    const nowRoles = new Set(now.map((r) => r.reviewer_role));
    const afterRoles = new Set(after.map((r) => r.reviewer_role));
    files.push({
      acquisition_id: acq.acquisition_id,
      title: String(acq.title ?? ""),
      center_code: (acq['center_code'] as string | null) ?? null,
      estimated_value: acq.estimated_value === null || acq.estimated_value === undefined
        ? null
        : num(acq.estimated_value),
      daysNow,
      daysThen,
      daysSooner: daysNow - daysThen,
      added: after.filter((r) => !nowRoles.has(r.reviewer_role)).map((r) => r.reviewer_role),
      removed: now.filter((r) => !afterRoles.has(r.reviewer_role)).map((r) => r.reviewer_role),
    });
  }

  files.sort((a, b) => b.daysSooner - a.daysSooner || a.acquisition_id.localeCompare(b.acquisition_id));
  const sooner = files.filter((f) => f.daysSooner > 0);
  const later = files.filter((f) => f.daysSooner < 0);
  const totalSooner = sooner.reduce((s, f) => s + f.daysSooner, 0);
  const totalLater = later.reduce((s, f) => s - f.daysSooner, 0);

  const label =
    change.kind === "threshold"
      ? `${change.target} were ${money(change.value)}`
      : `the ${change.target.toLowerCase()} trigger were ${money(change.value)}`;

  let headline: string;
  if (!files.length) {
    headline = `If ${label}, no active file moves.`;
  } else if (sooner.length && later.length) {
    headline =
      `If ${label}, ${sooner.length} ${sooner.length === 1 ? "file clears" : "files clear"} ` +
      `${totalSooner} days sooner and ${later.length} ${later.length === 1 ? "file takes" : "files take"} ` +
      `${totalLater} days longer.`;
  } else if (sooner.length) {
    headline =
      `If ${label}, ${sooner.length} ${sooner.length === 1 ? "file clears" : "files clear"} ` +
      `${totalSooner} days sooner.`;
  } else {
    headline =
      `If ${label}, ${later.length} ${later.length === 1 ? "file takes" : "files take"} ` +
      `${totalLater} days longer.`;
  }

  return {
    headline,
    method:
      "Planned days are the phase plan days through award for the acquisition type plus the planned " +
      "days of every review rule that applies. Only active files are counted; launched and scrubbed " +
      "files are left out. Nothing is written.",
    filesConsidered: active.length,
    filesAffected: files,
    totalDaysSooner: totalSooner,
    totalDaysLater: totalLater,
  };
}
