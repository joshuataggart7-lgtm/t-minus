/**
 * Current RFO citations for simplified-procedure price, documentation and
 * evaluation work, chosen from the stored acquisition method without ever
 * rewriting it.
 *
 * - Commercial simplified procedures (stored as "FAR 13.5 ..." or Part 12):
 *   RFO FAR 12.201-1, with price reasonableness at RFO FAR 12.204(a), file
 *   documentation at RFO FAR 12.204(b)(1) and the basis for award at RFO FAR
 *   12.203(b).
 * - Noncommercial simplified procedures (stored as "RFO FAR Part 13 ..." without 13.5):
 *   RFO FAR Part 13, with price reasonableness at RFO FAR 13.203(a), file
 *   documentation at RFO FAR 13.203(b) and evaluation at RFO FAR 13.202.
 *
 * The RFO has no FAR 13.106 or FAR 13.5; these replace those classic cites.
 */

/** True when the stored method names classic RFO FAR Part 13 but not FAR 13.5. */
export function isNoncommercialSimplifiedMethod(method: string | null | undefined): boolean {
  const m = String(method ?? "");
  return /\b13\b(?!\.5)/.test(m) && !/13\.5/.test(m);
}

/** Price reasonableness on a simplified file. */
export function simplifiedPriceCite(method: string | null | undefined): string {
  return isNoncommercialSimplifiedMethod(method) ? "RFO FAR 13.203(a)" : "RFO FAR 12.204(a)";
}

/** Contract file documentation of the procedures used and quotations received. */
export function simplifiedDocCite(method: string | null | undefined): string {
  return isNoncommercialSimplifiedMethod(method) ? "RFO FAR 13.203(b)" : "RFO FAR 12.204(b)(1)";
}

/** Basis for award stated to quoters in the solicitation. */
export function simplifiedFactorsCite(method: string | null | undefined): string {
  return isNoncommercialSimplifiedMethod(method) ? "RFO FAR 13.202" : "RFO FAR 12.203(b)";
}

/**
 * Display label for a stored method value. A stored "FAR 13.5" method reads as
 * the current RFO provision for commercial simplified procedures; the stored
 * value itself is left as it is. A bare "RFO FAR Part 13" or "RFO FAR Part 15" reads as the RFO
 * part of the same number (Part 13, simplified procedures for noncommercial
 * acquisitions; Part 15, contracting by negotiation).
 */
export function methodDisplayLabel(method: string | null | undefined): string {
  const m = String(method ?? "");
  return m
    .replace(/\bFAR 13\.5\b/g, "RFO FAR 12.201-1")
    .replace(/(^|[^.\w])FAR (13|15)(?![.\d])/g, "$1RFO FAR Part $2");
}

/**
 * Dollar value above which NFS CG 1807.11(e) expects a written acquisition
 * plan (at or below $10 million, Center procedures apply unless RFO FAR 7.102(d)
 * conditions do).
 */
export const WRITTEN_ACQUISITION_PLAN_THRESHOLD = 10_000_000;

/**
 * IGCE citation for a file. Simplified buys keep the simplified price cite.
 * Other buys rest on RFO FAR 15.404-1(b)(5) (comparison of proposed prices with
 * independent Government cost estimates); where a written acquisition plan
 * applies, NFS CG 1807.14(b)(3) also requires the plan's cost/price element to
 * provide the IGCE.
 */
export function igceCite(method: string | null | undefined, value: number): string {
  // Only the written acquisition plan rule actually requires an IGCE. Elsewhere
  // the IGCE on the file is T-Minus/Center practice, and the cite named is the
  // price rule it supports, not a requirement for the estimate itself.
  if (/13/.test(String(method ?? ""))) return `T-Minus/Center practice; supports ${simplifiedPriceCite(method)}`;
  return value > WRITTEN_ACQUISITION_PLAN_THRESHOLD
    ? "NFS CG 1807.14(b)(3); RFO FAR 15.404-1(b)(5)"
    : "T-Minus/Center practice; supports RFO FAR 15.404-1(b)(5)";
}
