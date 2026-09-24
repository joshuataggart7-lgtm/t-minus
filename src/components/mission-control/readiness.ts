import type { AcqMetrics } from "@/lib/metrics";

/**
 * Rule-driven readiness for the Executive Overview. Every trigger is a
 * plain comparison against recorded facts. No scores, no percentages.
 */
export type ReadinessState = "GO" | "WATCH" | "HOLD" | "LAUNCHED";

export type ReadinessTrigger = {
  code:
    | "hold"
    | "launched"
    | "award-window"
    | "award-overdue"
    | "reviewer-outstanding"
    | "approval-pending"
    | "doc-incomplete"
    | "gate-aging"
    | "schedule-impact";
  text: string;
};

export type ReadinessExplanation = {
  state: ReadinessState;
  triggers: ReadinessTrigger[];
  missingEvidence: string[];
  gateAgeDays: number | null;
  agingThresholdDays: number | null;
  blockedDays: number | null;
  nextAction: string;
  nextOwner: string;
  targetAward: string | null;
  targetAtRisk: boolean;
};

export type ReadinessContext = {
  missingEvidence: string[];
  /** Center aging threshold in days; falls back to the phase plan's planned days. */
  centerAgingDays: number | null;
  watchWindowDays: number;
  today: string;
};

export const DEFAULT_WATCH_WINDOW_DAYS = 30;

/** Rules shown to leadership, including the ones the record cannot evaluate yet. */
export const WATCH_RULES: { label: string; evaluated: boolean }[] = [
  { label: "Target award within the watch window", evaluated: true },
  { label: "Target award date passed without a recorded award", evaluated: true },
  { label: "Reviewer vote outstanding in the current phase", evaluated: true },
  { label: "Approval pending in the current phase", evaluated: true },
  { label: "Required document incomplete in the current phase", evaluated: true },
  { label: "Days in gate over the aging threshold", evaluated: true },
  { label: "Forecast award misses the mission date", evaluated: true },
  { label: "Unresolved question (not tracked in the record yet)", evaluated: false },
];

const APPROVAL_ROLE = /approv|contracting officer|procurement officer|source selection|board|\bpeb\b|head of contracting/i;

function daysBetweenIso(from: string, to: string) {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export function explainReadiness(metric: AcqMetrics, ctx: ReadinessContext): ReadinessExplanation {
  const target = metric.acq.target_award_date ? String(metric.acq.target_award_date).slice(0, 10) : null;
  const current = metric.phases.find((p) => p.status === "current") ?? null;
  const gateAgeDays = current?.actual_days ?? null;
  const agingThresholdDays = ctx.centerAgingDays ?? current?.planned_days ?? null;
  const blockedDays =
    metric.clockState === "hold" && metric.blockerSince
      ? Math.max(0, daysBetweenIso(metric.blockerSince, ctx.today) ?? 0)
      : null;
  const nextOwner =
    metric.blockerOwner?.trim() || String(metric.acq.co_name ?? "").trim() || "Not recorded";
  const nextAction = metric.nextAction?.trim() || "Not recorded";
  const targetAtRisk =
    !metric.awardDate &&
    !!target &&
    ((daysBetweenIso(ctx.today, target) ?? 1) < 0 ||
      (!!metric.forecastAwardDate && metric.forecastAwardDate.slice(0, 10) > target));

  const base = {
    missingEvidence: ctx.missingEvidence,
    gateAgeDays,
    agingThresholdDays,
    blockedDays,
    nextAction,
    nextOwner,
    targetAward: target,
    targetAtRisk,
  };

  if (metric.awardDate) {
    return {
      ...base,
      state: "LAUNCHED",
      triggers: [{ code: "launched", text: `Award recorded ${metric.awardDate}` }],
    };
  }

  if (metric.clockState === "hold" || metric.hold) {
    return {
      ...base,
      state: "HOLD",
      triggers: [
        {
          code: "hold",
          text: metric.hold?.reason ?? String(metric.acq.hold_reason ?? "").trim() ?? "Hold reason not recorded",
        },
      ],
    };
  }

  const triggers: ReadinessTrigger[] = [];
  if (target) {
    const d = daysBetweenIso(ctx.today, target);
    if (d !== null && d < 0) {
      triggers.push({ code: "award-overdue", text: `Target award passed ${Math.abs(d)} days ago` });
    } else if (d !== null && d <= ctx.watchWindowDays) {
      triggers.push({
        code: "award-window",
        text: `Target award in ${d} days (window ${ctx.watchWindowDays})`,
      });
    }
  }
  for (const b of metric.board.filter((entry) => entry.vote === "pending")) {
    const who = b.reviewer_name?.trim() || "Not recorded";
    if (APPROVAL_ROLE.test(b.reviewer_role)) {
      triggers.push({ code: "approval-pending", text: `Approval pending: ${b.reviewer_role} (${who})` });
    } else {
      triggers.push({ code: "reviewer-outstanding", text: `Reviewer vote outstanding: ${b.reviewer_role} (${who})` });
    }
  }
  if (ctx.missingEvidence.length) {
    triggers.push({
      code: "doc-incomplete",
      text: `Required document incomplete: ${ctx.missingEvidence.join(", ")}`,
    });
  }
  if (gateAgeDays !== null && agingThresholdDays !== null && gateAgeDays > agingThresholdDays) {
    triggers.push({
      code: "gate-aging",
      text: `${gateAgeDays} days in ${current?.phase ?? "gate"}; threshold ${agingThresholdDays}`,
    });
  }
  if (metric.scheduleImpactDays !== null && metric.scheduleImpactDays < 0) {
    triggers.push({
      code: "schedule-impact",
      text: `Forecast misses the mission date by ${Math.abs(metric.scheduleImpactDays)} days`,
    });
  }

  return { ...base, state: triggers.length ? "WATCH" : "GO", triggers };
}

/** HOLD queue order: overdue target award, then nearest target award, then longest blocked. */
export function sortHoldQueue<T extends { readiness: ReadinessExplanation }>(rows: T[], today: string) {
  const key = (r: T) => {
    const d = r.readiness.targetAward ? daysBetweenIso(today, r.readiness.targetAward) : null;
    return { overdue: d !== null && d < 0 ? 0 : 1, d: d ?? Number.MAX_SAFE_INTEGER, blocked: r.readiness.blockedDays ?? -1 };
  };
  return [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka.overdue - kb.overdue || ka.d - kb.d || kb.blocked - ka.blocked;
  });
}
