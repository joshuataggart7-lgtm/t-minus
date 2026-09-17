/**
 * Whether a file carries more than one awardee.
 *
 * A multiple-award vehicle has no single contractor of record, so a form block
 * that names one contractor stays empty rather than picking a holder.
 */
export function isMultipleAward(a: Record<string, unknown>): boolean {
  const vehicle = (a["vehicle"] ?? {}) as Record<string, unknown>;
  const awardees = Array.isArray(vehicle["awardees"]) ? (vehicle["awardees"] as unknown[]) : [];
  const type = String(vehicle["award_type"] ?? "").trim().toLowerCase();
  return type === "multiple" || awardees.length > 1;
}
