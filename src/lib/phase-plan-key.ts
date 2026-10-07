/**
 * Which seeded phase plan a new contract (not a vehicle order) runs on.
 *
 * Competed, noncommercial FAR Part 15 buys run noncommercial_far15_competed.
 * Sole-source FAR 15 stays on the commercial sole-source plan until a
 * noncommercial sole-source plan exists. Commercial and simplified buys are
 * unchanged. When the new plan's rows are missing, the commercial plan is used.
 */

export const COMMERCIAL_COMPETED_PLAN = "commercial_ffp_13_5_competed";
export const COMMERCIAL_SOLE_SOURCE_PLAN = "commercial_ffp_13_5_sole_source";
export const NONCOMMERCIAL_FAR15_COMPETED_PLAN = "noncommercial_far15_competed";

/** The method text names FAR Part 15 and not a commercial route (Part 12, 12.201-1, 13.5). */
export function isNoncommercialFar15Method(method: unknown): boolean {
  const m = String(method ?? "");
  if (/13\.5|12\.201-1|\b12\b/.test(m)) return false;
  return /\b15\b/.test(m);
}

export function newContractPlanKey(
  facts: { competition: unknown; method: unknown; commercial?: boolean },
  plan?: { acquisition_type: string | null }[] | null,
): string {
  if (/sole/i.test(String(facts.competition ?? ""))) return COMMERCIAL_SOLE_SOURCE_PLAN;
  const far15 = facts.commercial !== true && isNoncommercialFar15Method(facts.method);
  if (far15 && (!plan || plan.some((p) => p.acquisition_type === NONCOMMERCIAL_FAR15_COMPETED_PLAN)))
    return NONCOMMERCIAL_FAR15_COMPETED_PLAN;
  return COMMERCIAL_COMPETED_PLAN;
}
