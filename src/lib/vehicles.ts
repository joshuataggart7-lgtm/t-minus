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
 * SF 30 block 13 by modification type. Block 13 names the authority already in
 * the instrument, or the administrative form cite. It never carries paperwork
 * citations: a price negotiation memorandum or a justification is a document
 * the change may trigger, not the authority for the change.
 *
 * Form use RFO 43.401; modification types RFO 43.203. Administrative changes
 * take the form cite at FAR 43.103(b). NASA Interim NFS 1843 is not general
 * block 13 text and the NFS Companion Guide is process only, so neither is
 * printed in the block 13 blank.
 */
export const MOD_TYPES: {
  key: ModType;
  label: string;
  block: "13A" | "13B" | "13C" | "13D";
  /** Plain description of where the authority comes from. */
  authority: string;
}[] = [
  { key: "administrative", label: "Administrative change", block: "13B", authority: "FAR 43.103(b) administrative change" },
  { key: "funding", label: "Funding modification", block: "13D", authority: "The clause of the contract that authorizes the change" },
  { key: "option_exercise", label: "Option exercise", block: "13D", authority: "The option clause of the contract" },
  { key: "change_order", label: "Change order", block: "13A", authority: "The Changes clause of the contract" },
  { key: "supplemental", label: "Bilateral supplemental agreement", block: "13C", authority: "The covering clause of the contract" },
  { key: "termination", label: "Termination", block: "13D", authority: "The Termination clause of the contract" },
];

export function modTypeInfo(type: string) {
  return MOD_TYPES.find((m) => m.key === type) ?? MOD_TYPES[0]!;
}

/** Printed when the instrument clause cannot be read from the record. */
export const AUTHORITY_PENDING = "authority from record / RFO-pending";

/** A commercial file carries FAR 52.212-4 Changes, not the 52.243 series. */
export function isCommercialInstrument(acq: Record<string, unknown> | null | undefined): boolean {
  const method = String(acq?.["acquisition_method"] ?? "");
  const format = String(acq?.["contract_format"] ?? "");
  return /commercial/i.test(method) || /12/.test(method.replace(/[^0-9]/g, " ")) || /1449/.test(format);
}

/**
 * The block 13 authority text for one modification, read from the instrument.
 * Where the covering clause cannot be read from the record, the placeholder is
 * printed rather than a citation nobody can stand behind.
 */
export function modAuthorityText(
  type: string,
  acq: Record<string, unknown> | null | undefined,
  opts?: { instrumentClauses?: string[] },
): string {
  const commercial = isCommercialInstrument(acq);
  const clauses = (opts?.instrumentClauses ?? []).map((c) => c.trim());
  const has = (n: string) => clauses.some((c) => c.startsWith(n));
  const profile = acquisitionProfile(acq);
  const ordered = profile === "order_under_idiq" || profile === "fss_order";

  switch (type) {
    case "administrative":
      // The only block 13 entry that is a form cite rather than a clause.
      return "FAR 43.103(b), administrative change signed by the contracting officer alone";
    case "change_order":
      if (commercial) return "FAR 52.212-4(c) Changes, the Changes clause of this contract";
      if (has("52.243")) return `${clauses.find((c) => c.startsWith("52.243"))} Changes, as awarded in this contract`;
      return `The Changes clause of the contract as awarded (${AUTHORITY_PENDING})`;
    case "option_exercise": {
      const option = clauses.find((c) => c.startsWith("52.217"));
      if (option) return `${option}, the option clause of this contract`;
      return `The option clause of the contract as awarded (${AUTHORITY_PENDING})`;
    }
    case "termination":
      if (commercial) return "FAR 52.212-4(l) or (m), the termination clause of this contract, as applicable";
      return `The termination clause of the contract as awarded (${AUTHORITY_PENDING})`;
    case "funding":
      if (ordered) return `The clause of the parent vehicle or order that authorizes the change, within scope (${AUTHORITY_PENDING})`;
      return `The clause of the contract that authorizes the added funds (${AUTHORITY_PENDING})`;
    case "supplemental":
    default:
      if (ordered) return `The covering clause of the parent vehicle or order; last resort mutual agreement of the parties (${AUTHORITY_PENDING})`;
      return `The covering clause of this contract; last resort mutual agreement of the parties (${AUTHORITY_PENDING})`;
  }
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

// ------------------------------------------------- closeout autopilot (W3.2)

export type CloseoutItem = { label: string; citation: string; done: boolean; note?: string };

/**
 * The closeout checklist reads from the record. Nothing here writes anywhere
 * outside T-Minus, and nothing is marked complete that the record does not
 * already show.
 */
export function closeoutChecklist(
  record: CloseoutRecord,
  opts: { cparsRecorded: boolean },
): CloseoutItem[] {
  return [
    {
      label: "Final invoice received",
      citation: "FAR 4.804-5(b)",
      done: Boolean(record.final_invoice_date),
      ...(record.final_invoice_date ? { note: `Received ${record.final_invoice_date}.` } : {}),
    },
    {
      label: "Final payment recorded",
      citation: "FAR 4.804-5(b)",
      done: Boolean(record.final_payment_date),
      ...(record.final_payment_date ? { note: `Paid ${record.final_payment_date}.` } : {}),
    },
    {
      label: "Final CPARS evaluation entered",
      citation: "FAR 42.1502(a)",
      done: opts.cparsRecorded,
    },
    {
      label: "Government property cleared",
      citation: "FAR 4.804-5(a)(12)",
      done: Boolean(record.property_cleared),
    },
    {
      label: "Release of claims received",
      citation: "FAR 4.804-5(a)(14)",
      done: Boolean(record.release_of_claims),
    },
    {
      label: "Excess funds deobligated",
      citation: "FAR 4.804-5(a)(15)",
      done: Boolean(record.deobligation_date),
      ...(record.deobligation_date ? { note: `Deobligated ${record.deobligation_date}.` } : {}),
    },
  ];
}

/** A file is ready for transfer when every checklist item reads done. */
export function closeoutReady(items: CloseoutItem[]): boolean {
  return items.length > 0 && items.every((i) => i.done);
}

/** Memorandum to file: what closeout still owes, in plain sentences. */
export function closeoutMemo(
  acquisitionId: string,
  items: CloseoutItem[],
  record: CloseoutRecord,
): string {
  const open = items.filter((i) => !i.done);
  const retention = retentionDate(record.final_payment_date);
  const lines = [
    `Memorandum to file: closeout status, ${acquisitionId}.`,
    "",
    record.final_payment_date
      ? `Final payment is recorded as ${record.final_payment_date}.`
      : "Final payment is not recorded yet, so the retention clock has not started.",
    retention
      ? `The contract file is retained until ${retention}, six years after final payment (FAR 4.805).`
      : "The retention date computes once the final payment date is on the record (FAR 4.805).",
    "",
    open.length === 0
      ? "Every closeout item reads complete on the record. The file is ready for transfer."
      : "The following closeout items are still open:",
    ...open.map((i) => `- ${i.label} (${i.citation})`),
    "",
    "This memorandum is generated from the T-Minus record. T-Minus does not write to any external system.",
  ];
  return lines.join("\n");
}
