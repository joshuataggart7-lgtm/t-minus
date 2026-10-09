/**
 * Which seeded phase plan a new contract (not a vehicle order) runs on.
 *
 * - A ratification of an unauthorized commitment runs the ratification plan
 *   (RFO FAR 1.405; NFS CG 1801.43(b)).
 * - A letter contract runs the letter_contract plan, which puts Price
 *   Reasonableness after award as the definitization window (RFO FAR
 *   16.603-2(c): 180 days or 40 percent of the work, whichever comes first).
 * - Noncommercial sole source outside simplified procedures (a negotiated
 *   FAR Part 15 buy with a Part 6 justification) runs noncommercial_sole_source,
 *   or noncommercial_sole_source_cost on a cost-reimbursement type.
 * - Other sole source stays on the shared sole-source plan; its rows follow the
 *   file's path (commercial, simplified or negotiated) in launch-sequence.ts.
 * - Competed, noncommercial FAR Part 15 buys run noncommercial_far15_competed,
 *   or noncommercial_far15_competed_cost on a cost-reimbursement type.
 * - Competed, noncommercial FAR Part 13 buys at or below the simplified
 *   acquisition threshold run simplified_competed.
 * - Everything else keeps the commercial competed plan.
 * When a plan's rows are missing, the next plan down is used, as before.
 */

export const COMMERCIAL_COMPETED_PLAN = "commercial_ffp_13_5_competed";
export const COMMERCIAL_SOLE_SOURCE_PLAN = "commercial_ffp_13_5_sole_source";
export const NONCOMMERCIAL_FAR15_COMPETED_PLAN = "noncommercial_far15_competed";
export const NONCOMMERCIAL_FAR15_COMPETED_COST_PLAN = "noncommercial_far15_competed_cost";
export const NONCOMMERCIAL_SOLE_SOURCE_PLAN = "noncommercial_sole_source";
export const NONCOMMERCIAL_SOLE_SOURCE_COST_PLAN = "noncommercial_sole_source_cost";
export const SIMPLIFIED_COMPETED_PLAN = "simplified_competed";
export const LETTER_CONTRACT_PLAN = "letter_contract";
export const RATIFICATION_PLAN = "ratification";
export const TM_ORDER_PLAN = "tm_order_under_idiq";

/** Simplified acquisition threshold (RFO FAR 2.101), used when no threshold row is passed. */
const SAT_DEFAULT = 350_000;

/** The method text names FAR Part 15 and not a commercial route (Part 12, 12.201-1, 13.5). */
export function isNoncommercialFar15Method(method: unknown): boolean {
  const m = String(method ?? "");
  if (/13\.5|12\.201-1|\b12\b/.test(m)) return false;
  return /\b15\b/.test(m);
}

/** The method text names FAR Part 13 simplified procedures and not FAR 13.5. */
export function isFar13Method(method: unknown): boolean {
  const m = String(method ?? "");
  if (/13\.5|12\.201-1|\b12\b/.test(m)) return false;
  return /\b13\b/.test(m);
}

/**
 * A sole-source buy at or below the SAT that needs no Part 6 justification:
 * Part 6 does not apply to simplified acquisition procedures (RFO FAR
 * 6.001(a)); a noncommercial one rests on a determination and findings that
 * only one source is reasonably available (RFO FAR 13.101(b)), and a
 * commercial one on documenting that decision and its basis (RFO FAR
 * 12.102(a)). Pass whether the buy is commercial.
 */
export function simplifiedSoleSourceKind(
  row: Record<string, unknown> | null | undefined,
  commercial: boolean,
): "noncommercial" | "commercial" | null {
  if (!row) return null;
  if (!/sole/i.test(String(row["competition"] ?? ""))) return null;
  if (isRatification(row) || isLetterContract(row)) return null;
  const value = Number(row["estimated_value"] ?? NaN);
  if (!Number.isFinite(value) || value <= 0 || value > SAT_DEFAULT) return null;
  if (commercial) return "commercial";
  if (isFar13Method(row["acquisition_method"])) return "noncommercial";
  return null;
}

/** A cost-reimbursement contract type (CPFF, CPIF, CPAF, cost, cost-sharing). */
export function isCostType(contractType: unknown): boolean {
  const t = String(contractType ?? "").trim();
  return /^CP/i.test(t) || /^cost\b|cost[- ]reimburse|cost[- ]plus|cost[- ]sharing/i.test(t);
}

type ScenarioLike = Record<string, unknown> | null | undefined;

function scenarioFlag(scenario: ScenarioLike, key: string): boolean {
  return Boolean(scenario && typeof scenario === "object" && (scenario as Record<string, unknown>)[key] === true);
}

/** A ratification of an unauthorized commitment is requested on the record. */
export function isRatification(row: Record<string, unknown> | null | undefined): boolean {
  return scenarioFlag(row?.["scenario"] as ScenarioLike, "ratification_requested");
}

/** The record is a letter contract (undefinitized, RFO FAR 16.603). */
export function isLetterContract(row: Record<string, unknown> | null | undefined): boolean {
  const scenario = row?.["scenario"] as ScenarioLike;
  if (scenarioFlag(scenario, "letter_contract")) return true;
  if (scenario && typeof scenario === "object" && (scenario as Record<string, unknown>)["vehicle"] === "letter_contract") return true;
  return /letter contract/i.test(String(row?.["acquisition_method"] ?? ""));
}

export type NewContractFacts = {
  competition: unknown;
  method: unknown;
  commercial?: boolean;
  value?: unknown;
  contractType?: unknown;
  ratification?: boolean;
  letterContract?: boolean;
  sat?: number | null;
};

export function newContractPlanKey(
  facts: NewContractFacts,
  plan?: { acquisition_type: string | null }[] | null,
): string {
  const has = (key: string) => !plan || plan.some((p) => p.acquisition_type === key);
  if (facts.ratification && has(RATIFICATION_PLAN)) return RATIFICATION_PLAN;
  if (facts.letterContract && has(LETTER_CONTRACT_PLAN)) return LETTER_CONTRACT_PLAN;
  const value = Number(facts.value ?? NaN);
  const sat = facts.sat ?? SAT_DEFAULT;
  const withinSat = !Number.isFinite(value) || value <= sat;
  if (/sole/i.test(String(facts.competition ?? ""))) {
    const noncommercial =
      facts.commercial === false || (facts.commercial !== true && isNoncommercialFar15Method(facts.method));
    const simplified = isFar13Method(facts.method) && withinSat;
    if (noncommercial && !simplified) {
      if (isCostType(facts.contractType) && has(NONCOMMERCIAL_SOLE_SOURCE_COST_PLAN))
        return NONCOMMERCIAL_SOLE_SOURCE_COST_PLAN;
      if (has(NONCOMMERCIAL_SOLE_SOURCE_PLAN)) return NONCOMMERCIAL_SOLE_SOURCE_PLAN;
    }
    return COMMERCIAL_SOLE_SOURCE_PLAN;
  }
  const far15 = facts.commercial !== true && isNoncommercialFar15Method(facts.method);
  if (far15) {
    if (isCostType(facts.contractType) && has(NONCOMMERCIAL_FAR15_COMPETED_COST_PLAN))
      return NONCOMMERCIAL_FAR15_COMPETED_COST_PLAN;
    if (has(NONCOMMERCIAL_FAR15_COMPETED_PLAN)) return NONCOMMERCIAL_FAR15_COMPETED_PLAN;
  }
  if (facts.commercial !== true && isFar13Method(facts.method) && withinSat && facts.value !== undefined && has(SIMPLIFIED_COMPETED_PLAN))
    return SIMPLIFIED_COMPETED_PLAN;
  return COMMERCIAL_COMPETED_PLAN;
}

/** Plain words for a stored plan key. Display only. The key itself is unchanged. */
const PLAN_LABEL: Record<string, string> = {
  [COMMERCIAL_COMPETED_PLAN]: "Commercial FFP, competed (RFO FAR 12.201-1)",
  [COMMERCIAL_SOLE_SOURCE_PLAN]: "Commercial or simplified FFP, sole source",
  [NONCOMMERCIAL_FAR15_COMPETED_PLAN]: "Noncommercial, competed under FAR Part 15",
  [NONCOMMERCIAL_FAR15_COMPETED_COST_PLAN]: "Noncommercial cost, competed under FAR Part 15",
  [NONCOMMERCIAL_SOLE_SOURCE_PLAN]: "Noncommercial sole source",
  [NONCOMMERCIAL_SOLE_SOURCE_COST_PLAN]: "Noncommercial sole source, cost",
  [SIMPLIFIED_COMPETED_PLAN]: "Simplified, competed",
  [LETTER_CONTRACT_PLAN]: "Letter contract",
  [RATIFICATION_PLAN]: "Ratification of an unauthorized commitment",
  [TM_ORDER_PLAN]: "Time-and-materials order under an IDIQ",
};

export function acquisitionTypeLabel(key: string | null | undefined): string {
  const raw = String(key ?? "").trim();
  if (!raw) return "";
  if (PLAN_LABEL[raw]) return PLAN_LABEL[raw];
  const words = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
