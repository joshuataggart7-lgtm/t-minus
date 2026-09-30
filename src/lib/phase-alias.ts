/**
 * Stored phase names the phase plan spells differently. Display and
 * phase-lookup reads only; the stored value is never rewritten.
 */
export function phaseAlias<T extends string | null | undefined>(phase: T): T | string {
  if (typeof phase === "string" && phase.trim().toLowerCase() === "solicitation") return "Solicitation/Quote";
  return phase;
}
