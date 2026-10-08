/**
 * Micro-purchase threshold, RFO FAR 2.101: $15,000. The thresholds table row
 * "Micro-purchase threshold" is the source of record; pages that load that row
 * read it, and every other reader uses this one fallback so no code path
 * carries its own figure.
 */
export const MICRO_PURCHASE_THRESHOLD = 15_000;
export const MICRO_PURCHASE_THRESHOLD_NAME = "Micro-purchase threshold";
