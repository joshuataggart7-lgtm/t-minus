/** The review phase. Formerly stored as "Go/No-go Poll"; NFS CG 1806.16 and the CG
 *  front matter speak of "reviews, concurrences, and approvals". */
export const REVIEW_PHASE = "Reviews and approvals";
export const LEGACY_REVIEW_PHASE = "Go/No-go Poll";

/**
 * Stored phase names the phase plan spells differently. Display and
 * phase-lookup reads only; the stored value is never rewritten.
 */
export function phaseAlias<T extends string | null | undefined>(phase: T): T | string {
  if (typeof phase === "string" && phase.trim().toLowerCase() === "solicitation") return "Solicitation/Quote";
  if (typeof phase === "string" && phase.trim().toLowerCase() === LEGACY_REVIEW_PHASE.toLowerCase()) return REVIEW_PHASE;
  return phase;
}

/** Every stored spelling of a phase, for database filters that must match old rows too. */
export function storedPhaseNames(phase: string): string[] {
  if (phase === REVIEW_PHASE) return [REVIEW_PHASE, LEGACY_REVIEW_PHASE];
  if (phase === "Solicitation/Quote") return ["Solicitation/Quote", "Solicitation"];
  return [phase];
}
