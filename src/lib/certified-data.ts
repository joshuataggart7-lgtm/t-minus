/**
 * Which certified cost or pricing data threshold applies to a file.
 *
 * 10 U.S.C. 3702(a)(1)(A), as amended by Pub. L. 119-60 sec. 1804(c), sets
 * $10,000,000 for prime contracts entered into after June 30, 2026; NASA is
 * covered through 10 U.S.C. 3063(6) and 3064(a). RFO FAR 15.403-3(a) still
 * reads $2.5 million. The award date decides which figure the file reads: the
 * target award date on the record, else a forecast award date when the caller
 * has one, else today.
 */

export const CERTIFIED_FAR_TEXT_NAME = "Certified cost or pricing data (FAR text)";
export const CERTIFIED_STATUTE_NAME = "Certified cost or pricing data (statute, contracts after June 30, 2026)";
export const CERTIFIED_FAR_TEXT_DEFAULT = 2_500_000;
export const CERTIFIED_STATUTE_DEFAULT = 10_000_000;
export const CERTIFIED_FAR_TEXT_CITE = "RFO FAR 15.403-3(a)";
export const CERTIFIED_STATUTE_CITE = "10 U.S.C. 3702(a)(1)(A)";
/** Contracts entered into after this date read the statute figure. */
export const CERTIFIED_STATUTE_CUTOFF = "2026-06-30";

/** The label shown wherever the threshold is displayed. */
export const CERTIFIED_DATA_LABEL =
  "Certified cost or pricing data: required above $10,000,000 for NASA prime contracts entered into after June 30, 2026 (10 U.S.C. 3702(a)(1)(A)). RFO FAR 15.403-3(a) still reads $2.5 million; older contracts keep the threshold in the contract.";

export const CERTIFIED_MODIFICATION_NOTE =
  "Modifications keep the threshold stated in the contract.";

export const CERTIFIED_NO_DEVIATION_NOTE = "NASA has not issued a deviation as of Oct 7, 2026.";

type ThresholdLike = { name: string | null; value: number | string | null };

export type CertifiedDataBasis = {
  /** The figure the file reads. */
  threshold: number;
  rule: "statute" | "far_text";
  cite: string;
  /** The date that decided the rule. */
  awardDate: string;
  dateSource: "target" | "forecast" | "today";
  /** Informational, never holding: shown for $2.5M to $10M actions under the statute. */
  gapNote: string | null;
};

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function isoDay(v: unknown): string | null {
  const s = String(v ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function certifiedDataBasis(
  acq: Record<string, unknown> | null | undefined,
  thresholds?: ThresholdLike[] | null,
  options?: { forecastAwardDate?: string | null; today?: string; farText?: number | null; statute?: number | null },
): CertifiedDataBasis {
  const row = acq ?? {};
  const find = (name: string) => {
    const t = (thresholds ?? []).find((r) => (r.name ?? "").toLowerCase() === name.toLowerCase());
    const n = t?.value === null || t?.value === undefined ? NaN : Number(t.value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const farText = options?.farText ?? find(CERTIFIED_FAR_TEXT_NAME) ?? CERTIFIED_FAR_TEXT_DEFAULT;
  const statute = options?.statute ?? find(CERTIFIED_STATUTE_NAME) ?? CERTIFIED_STATUTE_DEFAULT;

  const target = isoDay(row["target_award_date"]);
  const forecast = isoDay(options?.forecastAwardDate ?? row["__forecast_award_date"]);
  const today = options?.today ?? localToday();
  const awardDate = target ?? forecast ?? today;
  const dateSource: CertifiedDataBasis["dateSource"] = target ? "target" : forecast ? "forecast" : "today";

  if (awardDate > CERTIFIED_STATUTE_CUTOFF) {
    const value = Number(row["estimated_value"] ?? NaN);
    const inGap = Number.isFinite(value) && value >= farText && value <= statute;
    return {
      threshold: statute,
      rule: "statute",
      cite: CERTIFIED_STATUTE_CITE,
      awardDate,
      dateSource,
      gapNote: inGap
        ? `Certified cost or pricing data is not required by statute for this award: ${money(value)} is at or above the ${money(farText)} in ${CERTIFIED_FAR_TEXT_CITE} but not above ${money(statute)} (${CERTIFIED_STATUTE_CITE}, prime contracts entered into after June 30, 2026). Requiring it takes a written HCA determination (10 U.S.C. 3704; RFO FAR 15.403-3(e)). ${CERTIFIED_NO_DEVIATION_NOTE} ${CERTIFIED_MODIFICATION_NOTE}`
        : null,
    };
  }
  return { threshold: farText, rule: "far_text", cite: CERTIFIED_FAR_TEXT_CITE, awardDate, dateSource, gapNote: null };
}

/** One line naming the threshold this file reads and why. */
export function certifiedDataBasisLine(basis: CertifiedDataBasis): string {
  const when =
    basis.dateSource === "today"
      ? "no award date is recorded, so today is used"
      : `${basis.dateSource === "target" ? "target" : "forecast"} award date ${basis.awardDate}`;
  return basis.rule === "statute"
    ? `${money(basis.threshold)} (${basis.cite}, contracts entered into after June 30, 2026; ${when}). ${CERTIFIED_MODIFICATION_NOTE}`
    : `${money(basis.threshold)} (${basis.cite} text, contracts entered into on or before June 30, 2026; ${when}). ${CERTIFIED_MODIFICATION_NOTE}`;
}
