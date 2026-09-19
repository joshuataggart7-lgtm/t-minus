/**
 * Soft Walk sample locks.
 *
 * The demonstration files (Sample 1, Sample 2 and the administration sample
 * A-2026-0090) carry a known contracting officer and a known commercial,
 * streamlined format. Where a live row is blank, these locks keep the sample
 * path honest instead of printing a gap on an official face. No other file is
 * touched: a record without an officer stays blank and is flagged.
 */

const norm = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim().toUpperCase();

/** Sample 1, Sample 2 and the administration sample, with their aliases. */
const SAMPLE_OFFICER_IDS = new Set([
  "A-2027-0101",
  "A-2027-0102",
  "A-2026-0090",
  "BF-80SAMPLE2026C0001",
  "BF-80SAMPLE2026C0002",
  "80SAMPLE2026C0001",
  "80SAMPLE2026C0002",
  "80ARC26D0090",
]);

/** Sample 3 keeps its own officer; never overwritten. */
const RIVERA_IDS = new Set(["A-2027-0103", "BF-80SAMPLE2026C0003", "80SAMPLE2026C0003"]);

/** Sample 1 and Sample 2 are commercial, streamlined SF 1449 files. */
const SAMPLE_COMMERCIAL_IDS = new Set([
  "A-2027-0101",
  "A-2027-0102",
  "BF-80SAMPLE2026C0001",
  "BF-80SAMPLE2026C0002",
  "80SAMPLE2026C0001",
  "80SAMPLE2026C0002",
]);

const SOFT_WALK_OFFICER = "Joshua Taggart";

const idsOf = (a: Record<string, unknown> | null | undefined): string[] =>
  a
    ? [a["acquisition_id"], a["id"], a["contract_number"], a["parent_contract_number"]].map(norm)
    : [];

/**
 * The officer to print. The record comes first, then the resolved officer the
 * caller carried, then the Soft Walk sample lock. Anything else stays blank.
 */
export function resolveOfficerName(
  acq: Record<string, unknown> | null | undefined,
  fallback?: unknown,
): string {
  const recorded = norm(acq?.["co_name"]) ? String(acq?.["co_name"]).trim() : "";
  if (recorded) return recorded;
  const carried = fallback === null || fallback === undefined ? "" : String(fallback).trim();
  if (carried) return carried;
  const ids = idsOf(acq);
  if (ids.some((id) => RIVERA_IDS.has(id))) return "";
  if (ids.some((id) => SAMPLE_OFFICER_IDS.has(id))) return SOFT_WALK_OFFICER;
  return "";
}

/** True where the file is a Soft Walk commercial sample. */
export function isSoftWalkCommercialSample(
  acq: Record<string, unknown> | null | undefined,
): boolean {
  return idsOf(acq).some((id) => SAMPLE_COMMERCIAL_IDS.has(id));
}
