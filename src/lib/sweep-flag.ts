/**
 * Vendor exclusion flag, read from recorded checks.
 *
 * The nightly sweep never changes a clock. Where it finds an exclusion record
 * it leaves a flag for the contracting officer. A newer check on the same UEI
 * that shows no active exclusion clears the flag, so no one has to undo it.
 */

export type SweepCheckRow = {
  check_type: string | null;
  checked_at: string | null;
  vendor_uei: string | null;
  response_json: unknown;
};

export type ExclusionFlag = {
  uei: string;
  label: string;
  sourceLabel: string;
  checkedAt: string | null;
  why: string;
};

function normalized(row: SweepCheckRow): Record<string, unknown> {
  const envelope = (row.response_json ?? {}) as Record<string, unknown>;
  return (envelope["normalized"] ?? {}) as Record<string, unknown>;
}

function clean(row: SweepCheckRow): boolean {
  const norm = normalized(row);
  if ("excluded" in norm) return norm["excluded"] === false;
  const body = JSON.stringify(row.response_json ?? "");
  return /no active exclusion/i.test(body);
}

/** The open exclusion flag on a file, or null when there is none. */
export function exclusionFlagFrom(rows: SweepCheckRow[]): ExclusionFlag | null {
  const ordered = [...rows].sort((a, b) => (b.checked_at ?? "").localeCompare(a.checked_at ?? ""));
  const flagged = ordered.find((r) => {
    const norm = normalized(r);
    return norm["excluded"] === true && Boolean(norm["flaggedForReview"] ?? true);
  });
  if (!flagged) return null;
  const uei = String(flagged.vendor_uei ?? normalized(flagged)["uei"] ?? "");
  const cleared = ordered.some(
    (r) =>
      r.vendor_uei === flagged.vendor_uei &&
      (r.checked_at ?? "") > (flagged.checked_at ?? "") &&
      clean(r),
  );
  if (cleared) return null;
  const norm = normalized(flagged);
  const label = String(norm["exclusionLabel"] ?? "Exclusion record found");
  const sourceLabel = String(norm["sourceLabel"] ?? "Recorded check");
  return {
    uei,
    label,
    sourceLabel,
    checkedAt: flagged.checked_at,
    why: `${label} for UEI ${uei}. Source: ${sourceLabel}.`,
  };
}
