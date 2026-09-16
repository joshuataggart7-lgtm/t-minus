// Vehicles, orders and modifications.
//
// NCMS stays the system of record for the SF 30, the SF 1449 and the order
// document. T-Minus carries the facts, the authority and the clause change,
// and hands over a packet.

import { scenarioOf } from "@/lib/scenario";

export type Awardee = { name: string; uei: string };

/** What a parent IDIQ, BPA or schedule vehicle carries on its record. */
export type VehicleProfile = {
  award_type: "single" | "multiple";
  ceiling: number | null;
  minimum_guarantee: number | null;
  ordering_start: string | null;
  ordering_end: string | null;
  /** order types the vehicle allows */
  order_types: string[];
  /** fair opportunity under FAR 16.505(b), or the exception the CO relies on */
  fair_opportunity: "competed" | FairOpportunityException;
  clause_set: string;
  awardees: Awardee[];
};

export const VEHICLE_DEFAULTS: VehicleProfile = {
  award_type: "multiple",
  ceiling: null,
  minimum_guarantee: null,
  ordering_start: null,
  ordering_end: null,
  order_types: ["FFP"],
  fair_opportunity: "competed",
  clause_set: "",
  awardees: [],
};

export function vehicleOf(acq: Record<string, unknown> | null | undefined): VehicleProfile {
  const raw = (acq?.["vehicle"] ?? {}) as Partial<VehicleProfile>;
  return { ...VEHICLE_DEFAULTS, ...raw };
}

// ------------------------------------------------------------- profile

export type AcquisitionProfile =
  | "new_contract"
  | "idiq_parent"
  | "order_under_idiq"
  | "bpa"
  | "fss_order";

/** Which phase plan a file runs on, taken from the vehicle answered at intake. */
export function acquisitionProfile(acq: Record<string, unknown> | null | undefined): AcquisitionProfile {
  const vehicle = scenarioOf(acq ?? {}).vehicle;
  if (vehicle === "idiq_award") return "idiq_parent";
  if (vehicle === "idiq_order") return "order_under_idiq";
  if (vehicle === "bpa") return "bpa";
  if (vehicle === "gsa_fss") return "fss_order";
  return "new_contract";
}

export function isOrderProfile(p: AcquisitionProfile): boolean {
  return p === "order_under_idiq" || p === "fss_order";
}

// --------------------------------------------- fair opportunity exceptions

export type FairOpportunityException =
  | "urgency"
  | "only_one_capable"
  | "logical_follow_on"
  | "minimum_guarantee"
  | "statutory"
  | "brand_name";

export const FAIR_OPPORTUNITY_EXCEPTIONS: { key: FairOpportunityException; label: string; citation: string }[] = [
  { key: "urgency", label: "Urgent need", citation: "FAR 16.505(b)(2)(i)(A)" },
  { key: "only_one_capable", label: "Only one awardee is capable", citation: "FAR 16.505(b)(2)(i)(B)" },
  { key: "logical_follow_on", label: "Logical follow-on", citation: "FAR 16.505(b)(2)(i)(C)" },
  { key: "minimum_guarantee", label: "Minimum guarantee", citation: "FAR 16.505(b)(2)(i)(D)" },
  { key: "statutory", label: "Statutory authority", citation: "FAR 16.505(b)(2)(ii)" },
  { key: "brand_name", label: "Brand name", citation: "FAR 16.505(a)(4)" },
];

export function exceptionLabel(
  key: string,
): { key: FairOpportunityException; label: string; citation: string } | null {
  return FAIR_OPPORTUNITY_EXCEPTIONS.find((e) => e.key === key) ?? null;
}

/** The fair opportunity rule for a GSA schedule order, by value. */
export function fssOrderCitation(value: number, sat = 350_000): string {
  return value <= sat ? "FAR 8.405-1" : "FAR 8.405-2";
}

// --------------------------------------------------------- modifications

export type ModType =
  | "administrative"
  | "funding"
  | "option_exercise"
  | "change_order"
  | "supplemental"
  | "termination";

export type ModificationRow = {
  mod_id: string;
  acquisition_id: string;
  mod_number: string;
  mod_type: string;
  sf30_13a: boolean;
  sf30_13b: boolean;
  sf30_13c: boolean;
  sf30_13d: boolean;
  authority_text: string | null;
  description: string | null;
  value_change: number | string | null;
  period_change_end: string | null;
  funds_line: string | null;
  clause_delta: unknown;
  state: string;
  created_at: string;
};

/**
 * SF 30 block 13 by modification type. 13A is the contract-change authority,
 * 13B the administrative change, 13C the supplemental agreement, 13D other.
 */
export const MOD_TYPES: {
  key: ModType;
  label: string;
  block: "13A" | "13B" | "13C" | "13D";
  authority: string;
}[] = [
  { key: "administrative", label: "Administrative change", block: "13B", authority: "FAR 43.101 administrative change" },
  { key: "funding", label: "Funding modification", block: "13D", authority: "Mutual agreement of the parties; funds added under the contract terms" },
  { key: "option_exercise", label: "Option exercise", block: "13D", authority: "FAR 17.207; the option clause of the contract" },
  { key: "change_order", label: "Change order", block: "13A", authority: "FAR 43.201; the Changes clause of the contract" },
  { key: "supplemental", label: "Bilateral supplemental agreement", block: "13C", authority: "FAR 43.103(a) supplemental agreement, mutual agreement of the parties" },
  { key: "termination", label: "Termination", block: "13D", authority: "FAR 49; the Termination clause of the contract" },
];

export function modTypeInfo(type: string) {
  return MOD_TYPES.find((m) => m.key === type) ?? MOD_TYPES[0]!;
}

export function sf30Blocks(type: string): { sf30_13a: boolean; sf30_13b: boolean; sf30_13c: boolean; sf30_13d: boolean } {
  const block = modTypeInfo(type).block;
  return {
    sf30_13a: block === "13A",
    sf30_13b: block === "13B",
    sf30_13c: block === "13C",
    sf30_13d: block === "13D",
  };
}

export type ModRow = { label: string; citation: string; state: "required" | "offered"; templateKey?: string };

/**
 * The rows a modification carries. A change order or bilateral supplemental
 * agreement above the simplified acquisition threshold needs a price
 * negotiation memorandum; a modification that adds work outside the scope of
 * the contract needs a justification.
 */
/** Reads the out-of-scope flag stored on the modification's clause_delta. */
export function modOutOfScope(mod: { clause_delta?: unknown }): boolean {
  const delta = Array.isArray(mod.clause_delta) ? (mod.clause_delta as unknown[]) : [];
  return delta.some((d) => {
    if (!d || typeof d !== "object") return false;
    const rec = d as Record<string, unknown>;
    return rec["key"] === "out_of_scope" && rec["value"] === true;
  });
}

export function modRows(
  mod: { mod_type: string; value_change?: number | string | null; clause_delta?: unknown },
  opts: { method: string; sat?: number; outOfScope?: boolean },
): ModRow[] {
  const outOfScope = opts.outOfScope ?? modOutOfScope(mod);
  const sat = opts.sat ?? 350_000;
  const simplified = /13/.test(opts.method);
  const value = Math.abs(Number(mod.value_change ?? 0));
  const rows: ModRow[] = [];
  if (mod.mod_type === "option_exercise") {
    rows.push(
      { label: "Preliminary notice of intent to exercise the option", citation: "FAR 17.207(a)", state: "required", templateKey: "option-exercise-notification" },
      { label: "Determination to exercise the option", citation: "FAR 17.207(c) and (d)", state: "required", templateKey: "option-exercise-determination" },
    );
  }
  if ((mod.mod_type === "change_order" || mod.mod_type === "supplemental") && value > sat) {
    rows.push({
      label: "Price negotiation memorandum for the modification",
      citation: simplified ? "FAR 13.106-3" : "FAR 15.406-3",
      state: "required",
      templateKey: "pnm",
    });
  }
  if (outOfScope) {
    rows.push({
      label: "Justification for other than full and open competition, out-of-scope modification",
      citation: "FAR 6.104",
      state: "required",
      templateKey: "jofoc",
    });
  }
  rows.push({ label: "FPDS-NG modification report", citation: "FAR 4.604", state: "required" });
  rows.push({ label: "SF 30 handoff packet for NCMS", citation: "FAR 43.301; NFS 1804.171", state: "required" });
  return rows;
}

// -------------------------------------------------------------- closeout

export type CloseoutRecord = {
  deobligation_amount: number | null;
  deobligation_date: string | null;
  final_invoice_date: string | null;
  release_of_claims: boolean;
  property_cleared: boolean;
  final_payment_date: string | null;
};

export const CLOSEOUT_DEFAULTS: CloseoutRecord = {
  deobligation_amount: null,
  deobligation_date: null,
  final_invoice_date: null,
  release_of_claims: false,
  property_cleared: false,
  final_payment_date: null,
};

export function closeoutOf(acq: Record<string, unknown> | null | undefined): CloseoutRecord {
  const raw = (acq?.["closeout"] ?? {}) as Partial<CloseoutRecord>;
  return { ...CLOSEOUT_DEFAULTS, ...raw };
}

/** FAR 4.805: files are retained six years after final payment. */
export function retentionDate(finalPayment: string | null): string | null {
  if (!finalPayment) return null;
  const d = new Date(`${finalPayment}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() + 6);
  return d.toISOString().slice(0, 10);
}
