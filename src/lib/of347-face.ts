/**
 * The face of an OF 347 order: which schedule lines print and what the grand
 * total is. One source of truth so the preview and the AcroForm export agree.
 *
 * Nothing here invents a quantity or a price. A commercial firm fixed price
 * file that the SF 1449 prints as a single lot at the award face prints the
 * same way here, so the sum of the printed lines equals the grand total and
 * equals the SF 1449 total. Otherwise the grand total is the sum of the priced
 * lines actually printed.
 */

import type { FormClin, FormCtx } from "@/lib/nf1787";
import { isStreamlined } from "@/lib/format-scaffold";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** One row per line item number, first by print order. */
export function dedupeClins(rows: FormClin[]): FormClin[] {
  const seen = new Set<string>();
  const out: FormClin[] = [];
  for (const r of rows) {
    const key = str(r.clinNumber).toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(r);
  }
  return out;
}

export type Of347Face = {
  /** The distinct schedule lines, in print order. */
  rows: FormClin[];
  /** True when the order prints as a single lot at the award face. */
  lot: boolean;
  /** The grand total, or null when the record does not support one. */
  total: number | null;
};

/**
 * The lines and the total the order prints. When the file is a commercial
 * streamlined buy with a face price, one lot line carries that price so the
 * order reconciles with the SF 1449.
 */
export function of347Face(ctx: FormCtx): Of347Face {
  const a = ctx.acq;
  const rows = dedupeClins(Array.isArray(ctx.clins) ? ctx.clins : []);
  const facePrice = Number(a["proposed_price"]) || Number(a["award_amount"]) || 0;
  const priced = rows
    .map((r) => r.extendedPrice)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const lineTotal = priced.length ? priced.reduce((x, y) => x + y, 0) : null;

  if (isStreamlined(a) && facePrice > 0) {
    // The estimate rows behind the file do not change the face of the order:
    // one lot at the award amount, so the printed lines sum to the total.
    const reconciles = lineTotal !== null && Math.abs(lineTotal - facePrice) < 0.5 && priced.length === rows.length;
    if (!reconciles) return { rows, lot: true, total: facePrice };
    return { rows, lot: false, total: lineTotal };
  }

  return { rows, lot: false, total: lineTotal };
}
