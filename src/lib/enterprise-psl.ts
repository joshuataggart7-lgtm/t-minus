/**
 * Enterprise PSL check above the simplified acquisition threshold (advisory).
 *
 * Everything here is read from the record and the seeded tables:
 *   - thresholds row "Simplified acquisition threshold" supplies the SAT value
 *   - acquisition_facts.estimated_value and .enterprise_psl_check supply the file facts
 *   - enterprise_strategies supplies read-only reference rows
 *
 * Nothing here holds a file or blocks a phase exit, and it never claims the
 * file sits inside a PSL unless the recorded check on the file says so.
 */
import { supabase } from "@/integrations/supabase/client";

export type EnterpriseStrategyRow = {
  psl: string;
  name: string | null;
  buying_location: string | null;
  mandatory_vehicles: string | null;
  required_coordination: string | null;
  applies: string | null;
};

export type SatThreshold = {
  value: number | null;
  citation: string | null;
  note: string | null;
};

/** The seeded SAT row. No dollar figure is hard-coded here. */
export async function loadSatThreshold(): Promise<SatThreshold | null> {
  const { data, error } = await supabase
    .from("thresholds")
    .select("name, value, citation, note")
    .ilike("name", "Simplified acquisition threshold")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    value: data.value === null || data.value === undefined ? null : Number(data.value),
    citation: (data.citation as string | null) ?? null,
    note: (data.note as string | null) ?? null,
  };
}

export async function loadEnterpriseStrategies(): Promise<EnterpriseStrategyRow[]> {
  const { data, error } = await supabase
    .from("enterprise_strategies")
    .select("psl, name, buying_location, mandatory_vehicles, required_coordination, applies")
    .order("psl", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EnterpriseStrategyRow[];
}

export type PslAdvisoryState =
  | "no-sat-row"
  | "value-not-recorded"
  | "at-or-below-sat"
  | "above-sat-recorded"
  | "above-sat-not-recorded";

export type PslAdvisory = {
  state: PslAdvisoryState;
  headline: string;
  detail: string;
  /** The text recorded on the file, when present. Never invented. */
  recordedCheck: string | null;
  /** True when reference rows may be listed as read-only context. */
  showReference: boolean;
};

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Not recorded";
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function enterprisePslAdvisory(
  acq: Record<string, unknown> | null | undefined,
  sat: SatThreshold | null,
): PslAdvisory {
  const recordedRaw = acq?.["enterprise_psl_check"];
  const recordedCheck = typeof recordedRaw === "string" && recordedRaw.trim() ? recordedRaw.trim() : null;
  const rawValue = acq?.["estimated_value"];
  const estimated =
    rawValue === null || rawValue === undefined || rawValue === "" ? null : Number(rawValue);

  if (!sat || sat.value === null) {
    return {
      state: "no-sat-row",
      headline: "The simplified acquisition threshold row is not loaded.",
      detail:
        "Without the seeded threshold row, the above-SAT enterprise PSL check is not evaluated here.",
      recordedCheck,
      showReference: false,
    };
  }

  if (estimated === null || Number.isNaN(estimated)) {
    return {
      state: "value-not-recorded",
      headline: "Estimated value not recorded — PSL above-SAT check not evaluated.",
      detail: `The seeded simplified acquisition threshold is ${formatUsd(sat.value)}${
        sat.citation ? ` (${sat.citation})` : ""
      }.`,
      recordedCheck,
      showReference: false,
    };
  }

  if (estimated <= sat.value) {
    return {
      state: "at-or-below-sat",
      headline: `Enterprise PSL coordination for above-SAT buys does not apply at ${formatUsd(estimated)}.`,
      detail: `The seeded simplified acquisition threshold is ${formatUsd(sat.value)}${
        sat.citation ? ` (${sat.citation})` : ""
      }. This value is at or below it.`,
      recordedCheck,
      showReference: false,
    };
  }

  if (recordedCheck) {
    return {
      state: "above-sat-recorded",
      headline: `Estimated value ${formatUsd(estimated)} is above the simplified acquisition threshold of ${formatUsd(sat.value)}.`,
      detail: "The enterprise PSL check recorded on this file reads as shown below.",
      recordedCheck,
      showReference: true,
    };
  }

  return {
    state: "above-sat-not-recorded",
    headline: `Estimated value ${formatUsd(estimated)} is above the simplified acquisition threshold of ${formatUsd(sat.value)}.`,
    detail: "No enterprise PSL check is recorded on this file.",
    recordedCheck: null,
    showReference: true,
  };
}

/** Rows whose "applies" text already says above the simplified acquisition threshold. */
export function aboveSatStrategies(rows: EnterpriseStrategyRow[]): EnterpriseStrategyRow[] {
  return rows.filter((r) => (r.applies ?? "").toLowerCase().includes("simplified acquisition threshold"));
}
