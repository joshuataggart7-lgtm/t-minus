/** Acquisition Forecast entry, NFS 1807.72.
 *
 *  Every intake above the simplified acquisition threshold produces a forecast
 *  entry as a byproduct of the record: nothing is retyped and nothing is
 *  invented. The threshold value is read from the thresholds table, never
 *  hard-coded. The value bands are the ranges the forecast is published in;
 *  they are recorded in BUILD_NOTES.md.
 */

export const FORECAST_CITATION = "NFS 1807.72";

export type ForecastAcq = {
  acquisition_id: string;
  title?: string | null;
  estimated_value?: number | string | null;
  naics_code?: string | null;
  psc_code?: string | null;
  competition?: string | null;
  set_aside?: string | null;
  place_of_performance?: string | null;
  place_of_performance_standardized?: string | null;
  target_award_date?: string | null;
  need_date?: string | null;
  center_code?: string | null;
  acquisition_forecast_verified?: boolean | null;
};

export type ForecastEntry = {
  acquisition_id: string;
  center_code: string;
  title: string;
  value_range: string;
  naics_code: string;
  psc_code: string;
  anticipated_award_date: string;
  competition: string;
  set_aside: string;
  place_of_performance: string;
};

type ThresholdRow = { name: string; value?: number | string | null; citation?: string | null; superseded_date?: string | null };

/** The simplified acquisition threshold, from the thresholds table. */
export function satValue(thresholds: ThresholdRow[]): { value: number; citation: string } | null {
  const row = thresholds.find(
    (t) => /^simplified acquisition threshold$/i.test((t.name ?? "").trim()) && !t.superseded_date,
  );
  const value = row?.value == null ? null : Number(row.value);
  if (value === null || !Number.isFinite(value)) return null;
  return { value, citation: row?.citation ?? FORECAST_CITATION };
}

/** Published value bands for the forecast. */
const BANDS: { max: number | null; label: string }[] = [
  { max: 1_000_000, label: "$350,000 to $1 million" },
  { max: 5_000_000, label: "$1 million to $5 million" },
  { max: 10_000_000, label: "$5 million to $10 million" },
  { max: 50_000_000, label: "$10 million to $50 million" },
  { max: 100_000_000, label: "$50 million to $100 million" },
  { max: null, label: "Over $100 million" },
];

export function valueRange(value: number): string {
  for (const b of BANDS) if (b.max === null || value <= b.max) return b.label;
  return BANDS[BANDS.length - 1]!.label;
}

/** Above the simplified acquisition threshold, so a forecast entry is required. */
export function forecastRequired(acq: ForecastAcq, thresholds: ThresholdRow[]): boolean {
  const sat = satValue(thresholds);
  const value = acq.estimated_value == null ? null : Number(acq.estimated_value);
  if (!sat || value === null || !Number.isFinite(value)) return false;
  return value > sat.value;
}

export function forecastEntry(acq: ForecastAcq, thresholds: ThresholdRow[]): ForecastEntry | null {
  if (!forecastRequired(acq, thresholds)) return null;
  const value = Number(acq.estimated_value);
  return {
    acquisition_id: acq.acquisition_id,
    center_code: acq.center_code ?? "Not recorded",
    title: acq.title ?? "Not recorded",
    value_range: valueRange(value),
    naics_code: acq.naics_code ?? "Not recorded",
    psc_code: acq.psc_code ?? "Not recorded",
    anticipated_award_date: acq.target_award_date ?? acq.need_date ?? "Not recorded",
    competition: acq.competition ?? "Not recorded",
    set_aside: acq.set_aside ?? "None",
    place_of_performance:
      acq.place_of_performance_standardized ?? acq.place_of_performance ?? "Not recorded",
  };
}

const COLUMNS: { key: keyof ForecastEntry; header: string }[] = [
  { key: "acquisition_id", header: "Acquisition ID" },
  { key: "center_code", header: "Center" },
  { key: "title", header: "Title" },
  { key: "value_range", header: "Estimated value range" },
  { key: "naics_code", header: "NAICS code" },
  { key: "psc_code", header: "Product or service code" },
  { key: "anticipated_award_date", header: "Anticipated award date" },
  { key: "competition", header: "Competition" },
  { key: "set_aside", header: "Set-aside" },
  { key: "place_of_performance", header: "Place of performance" },
];

function cell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** The forecast's own CSV format: one header row, one row per entry. */
export function forecastCsv(entries: ForecastEntry[]): string {
  const lines = [COLUMNS.map((c) => cell(c.header)).join(",")];
  for (const e of entries) lines.push(COLUMNS.map((c) => cell(String(e[c.key] ?? ""))).join(","));
  return lines.join("\n");
}

export const FORECAST_FIELDS = COLUMNS;
