/**
 * Center configuration: per-Center overrides of a threshold value or of a
 * review rule's dollar trigger, each with an effective date. Nothing is
 * hard-coded here; an override is a row and the engine reads the row that is
 * in effect today. Legal and pricing triggers are Center-configurable and
 * carry the words "Center policy" (NFS Companion Guide, guidance tier).
 */

export type OverrideKind = "threshold" | "review_trigger";

export type CenterOverrideRow = {
  override_id: string;
  center_code: string;
  kind: string;
  target: string;
  value: number | string | null;
  note: string | null;
  citation: string | null;
  effective_date: string;
  superseded_date: string | null;
  set_by: string | null;
};

export const CENTER_POLICY_NOTE = "Center policy";

/** Today's date where the user is, not in UTC (an evening CT export is still today). */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The override in effect for this Center, kind, and target today, if any. */
export function effectiveOverride(
  rows: CenterOverrideRow[] | undefined,
  centerCode: string | null | undefined,
  kind: OverrideKind,
  target: string | null | undefined,
  today = todayISO(),
): CenterOverrideRow | null {
  if (!rows || !centerCode || !target) return null;
  const t = target.trim().toLowerCase();
  const inEffect = rows.filter(
    (r) =>
      r.center_code === centerCode &&
      r.kind === kind &&
      (r.target ?? "").trim().toLowerCase() === t &&
      r.effective_date <= today &&
      (!r.superseded_date || r.superseded_date > today),
  );
  // Latest effective date wins when a Center has stacked revisions.
  inEffect.sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  return inEffect[0] ?? null;
}

export function overrideValue(
  rows: CenterOverrideRow[] | undefined,
  centerCode: string | null | undefined,
  kind: OverrideKind,
  target: string | null | undefined,
  today = todayISO(),
): number | null {
  const row = effectiveOverride(rows, centerCode, kind, target, today);
  if (!row || row.value === null) return null;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : null;
}
