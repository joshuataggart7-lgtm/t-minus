// Scenario answers taken at intake, and the trigger table that turns them into
// document rows in the launch sequence.
//
// A row appears only where the record triggers it, and it is Required only
// where the cited regulation or OP memo makes the document mandatory for that
// record. Everything else is Offered: an offered row never blocks a phase exit
// and never appears in the header line.
//
// The citation, label, phase and state of every row live in the
// scenario_trigger_config table so an HQ user can edit them. The condition that
// switches a row on is evaluated here from the record.

export type ScenarioAnswers = {
  /** a. Vehicle */
  vehicle: "new" | "idiq_award" | "idiq_order" | "bpa" | "gsa_fss" | "other_agency";
  idiq_single_award: boolean;
  parent_contract_number: string;
  /** b. Funding and servicing */
  funding: "nasa" | "reimbursable" | "assisted";
  reimbursable_authority: "economy_act" | "other";
  agreement_number: string;
  /** c. Countries */
  vendor_country: string;
  place_country: string;
  /** d. Deliverable */
  deliverable: "services" | "supplies" | "construction" | "rd";
  end_products_domestic: "yes" | "no" | "unknown";
  /** e. Contract type and commerciality */
  contract_type: string;
  commercial: boolean;
  /** g–o */
  combines_requirements: boolean;
  gfp: boolean;
  oci_advisory: boolean;
  oci_systems_engineering: boolean;
  oci_proprietary_data: boolean;
  oci_incumbent: boolean;
  urgency: boolean;
  urgency_need_arose: string;
  set_aside_type: string;
  precontract_costs: boolean;
  cba: "yes" | "no" | "unknown";
  subcontracting_plan_applies: boolean;
  subcontracting_possibilities: boolean;
  approved_plan_exists: boolean;
  approved_plan_changes: boolean;
  /** Choices the contracting officer makes later in the file. */
  exclude_source: boolean;
  award_term_or_award_fee: boolean;
  mod_needs_proposal: boolean;
  ratification_requested: boolean;
};

export const SCENARIO_DEFAULTS: ScenarioAnswers = {
  vehicle: "new",
  idiq_single_award: false,
  parent_contract_number: "",
  funding: "nasa",
  reimbursable_authority: "economy_act",
  agreement_number: "",
  vendor_country: "United States",
  place_country: "United States",
  deliverable: "services",
  end_products_domestic: "yes",
  contract_type: "FFP",
  commercial: true,
  combines_requirements: false,
  gfp: false,
  oci_advisory: false,
  oci_systems_engineering: false,
  oci_proprietary_data: false,
  oci_incumbent: false,
  urgency: false,
  urgency_need_arose: "",
  set_aside_type: "",
  precontract_costs: false,
  cba: "unknown",
  subcontracting_plan_applies: false,
  subcontracting_possibilities: true,
  approved_plan_exists: false,
  approved_plan_changes: false,
  exclude_source: false,
  award_term_or_award_fee: false,
  mod_needs_proposal: false,
  ratification_requested: false,
};

/** The scenario answers on a record, with every unanswered question defaulted. */
export function scenarioOf(acq: Record<string, unknown> | null | undefined): ScenarioAnswers {
  const raw = (acq?.["scenario"] ?? {}) as Partial<ScenarioAnswers> | null;
  const stored = raw && typeof raw === "object" ? raw : {};
  const merged = { ...SCENARIO_DEFAULTS, ...stored } as ScenarioAnswers;
  // The record's own fields lead where the question repeats one of them.
  const recordType = String(acq?.["contract_type"] ?? "").trim();
  if (recordType) merged.contract_type = recordType;
  const setAside = String(acq?.["set_aside"] ?? "").trim();
  if (setAside && !stored.set_aside_type) merged.set_aside_type = setAside;
  return merged;
}

/** f. Period of performance length in days, computed from the dates on record. */
export function performanceDays(acq: Record<string, unknown> | null | undefined): number | null {
  const start = String(acq?.["period_of_performance_start"] ?? "").slice(0, 10);
  const end = String(acq?.["period_of_performance_end"] ?? "").slice(0, 10);
  if (!start || !end) return null;
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86_400_000);
}

/** True where the period or ordering period runs beyond five years. */
export function overFiveYears(acq: Record<string, unknown> | null | undefined): boolean {
  const days = performanceDays(acq);
  return days !== null && days > 1826;
}

/** PSC and NAICS codes carried on the AbilityOne procurement list. */
const ABILITYONE_CODES = ["7510", "8415", "7930", "S201", "S208", "561720", "561740"];

export type TriggerState = "required" | "offered";

export type TriggerDoc = {
  doc_key: string;
  label: string;
  citation: string;
  phase: string;
  state: TriggerState;
  templateKey?: string;
  formKey?: string;
  /** NF 1098 tab an attached external copy is filed under. */
  tab?: string;
  note?: string;
  /** A row handed to a system outside T-Minus, still required on the file. */
  handoff?: boolean;
  /** Replaces the standard justification rather than adding a row. */
  replacesJofoc?: boolean;
};

export type TriggerDef = {
  key: string;
  condition: string;
  when: (c: ScenarioContext) => boolean;
  docs: TriggerDoc[];
};

export type ScenarioContext = {
  acq: Record<string, unknown>;
  s: ScenarioAnswers;
  value: number;
  method: string;
  competition: string;
  sole: boolean;
  competed: boolean;
  oci: boolean;
  type: string;
};

export function scenarioContext(acq: Record<string, unknown>): ScenarioContext {
  const s = scenarioOf(acq);
  const competition = String(acq["competition"] ?? "");
  const sole = /sole|limited source|brand name/i.test(competition);
  return {
    acq,
    s,
    value: Number(acq["estimated_value"] ?? 0) || 0,
    method: String(acq["acquisition_method"] ?? ""),
    competition,
    sole,
    competed: !sole,
    oci: s.oci_advisory || s.oci_systems_engineering || s.oci_proprietary_data || s.oci_incumbent,
    type: (s.contract_type || "").toUpperCase(),
  };
}

const far15 = (c: ScenarioContext) => /\b15\b|part 15/i.test(c.method);
const isCost = (c: ScenarioContext) => /^CP/.test(c.type);
const notDomestic = (c: ScenarioContext) =>
  c.s.deliverable === "supplies" && c.s.end_products_domestic !== "yes";
const outsideUS = (c: ScenarioContext) =>
  !/united states|^us$|^usa$/i.test(c.s.vendor_country.trim()) ||
  !/united states|^us$|^usa$/i.test(c.s.place_country.trim());

/** The seeded trigger table. Every row carries its own citation and state. */
export const TRIGGERS: TriggerDef[] = [
  {
    key: "value-10m",
    condition: "Estimated value at or above $10,000,000",
    when: (c) => c.value >= 10_000_000,
    docs: [
      { doc_key: "written-acquisition-plan", label: "Written acquisition plan", citation: "NFS CG 1807.11", phase: "Intake", state: "required", tab: "005" },
      { doc_key: "psm-signature-page", label: "PSM signature page", citation: "NFS CG 1807.11", phase: "Intake", state: "offered", tab: "005" },
      { doc_key: "rdt-request-appointment", label: "RDT request and appointment letters", citation: "NFS CG 1807.11", phase: "Intake", state: "offered", tab: "005" },
      { doc_key: "psm-executive-presentation", label: "PSM executive presentation", citation: "NFS CG 1807.11", phase: "Intake", state: "offered", tab: "005" },
      { doc_key: "asm-not-conducted", label: "ASM not conducted memorandum", citation: "NFS CG 1807.11", phase: "Intake", state: "offered", tab: "005" },
    ],
  },
  {
    key: "approved-plan-changes",
    condition: "An approved acquisition plan or PSM exists and this action changes it",
    when: (c) => c.s.approved_plan_exists && c.s.approved_plan_changes,
    docs: [
      { doc_key: "psm-addendum", label: "Addendum to the approved PSM or written acquisition plan", citation: "NFS CG 1807.11", phase: "Intake", state: "required", tab: "005" },
    ],
  },
  {
    key: "incentive-award-fee-type",
    condition: "Contract type CPIF, CPAF, FPAF or FPI",
    when: (c) => ["CPIF", "CPAF", "FPAF", "FPI"].includes(c.type),
    docs: [
      { doc_key: "contract-type-dandf", label: "Determination and findings for the contract type", citation: "FAR 16.301-3; FAR 16.401", phase: "Market Research", state: "required", tab: "010" },
    ],
  },
  {
    key: "tm-lh-type",
    condition: "Contract type T&M or labor-hour",
    when: (c) => /^(T&M|TM|LABOR)/.test(c.type) || /labor.hour|time and material/i.test(c.s.contract_type),
    docs: [
      {
        doc_key: "tm-lh-dandf",
        label: "Time-and-materials or labor-hour determination and findings",
        citation: "FAR 12.207(b); FAR 16.601(d)",
        phase: "Market Research",
        state: "required",
        templateKey: "commercial-tm-lh-determination",
        tab: "010",
      },
    ],
  },
  {
    key: "over-five-years",
    condition: "Period of performance or ordering period longer than five years",
    when: (c) => overFiveYears(c.acq),
    docs: [
      { doc_key: "pop-over-five-years", label: "Period or ordering period over five years determination and findings", citation: "NFS CG 1817.204", phase: "Market Research", state: "required", tab: "010" },
      { doc_key: "pop-deviation", label: "FAR period of performance deviation", citation: "FAR 1.404", phase: "Market Research", state: "offered", tab: "010" },
    ],
  },
  {
    key: "single-award-idiq",
    condition: "Single-award IDIQ above $150,000,000",
    when: (c) => c.s.vehicle === "idiq_award" && c.s.idiq_single_award && c.value > 150_000_000,
    docs: [
      { doc_key: "single-award-idiq-dandf", label: "Single-award IDIQ determination and findings", citation: "FAR 16.504(c)(1)(ii)(D)", phase: "Market Research", state: "required", tab: "010" },
    ],
  },
  {
    key: "consolidation",
    condition: "Combines requirements that were previously separate contracts",
    when: (c) => c.s.combines_requirements,
    docs: [
      {
        doc_key: "consolidation-dandf",
        label: "Consolidation determination and findings",
        citation: "FAR 7.107-2",
        phase: "Market Research",
        state: "required",
        templateKey: "consolidation-determination",
        tab: "010",
      },
      { doc_key: "small-business-consolidation-letter", label: "Letter to small businesses of intent to consolidate or bundle", citation: "FAR 7.107", phase: "Market Research", state: "offered", tab: "010" },
      { doc_key: "sba-followon-notification", label: "Notification to SBA of a follow-on consolidated or bundled requirement", citation: "FAR 7.107", phase: "Market Research", state: "offered", tab: "010" },
    ],
  },
  {
    key: "bundling",
    condition: "Combines requirements at or below the consolidation dollar level",
    when: (c) => c.s.combines_requirements && c.value <= 2_000_000,
    docs: [
      {
        doc_key: "bundling-dandf",
        label: "Bundled requirements determination and findings",
        citation: "FAR 7.107-3",
        phase: "Market Research",
        state: "required",
        templateKey: "bundling-determination",
        tab: "010",
      },
    ],
  },
  {
    key: "interagency",
    condition: "Another agency funds NASA, or NASA buys through another agency",
    when: (c) => c.s.funding === "reimbursable" || c.s.funding === "assisted",
    docs: [
      {
        doc_key: "economy-act-dandf",
        label: "Economy Act determination and findings",
        citation: "FAR 17.502-2(c)",
        phase: "Market Research",
        state: "required",
        templateKey: "economy-act-determination",
        tab: "010",
      },
      {
        doc_key: "interagency-agreement-handoff",
        label: "Interagency agreement handoff: FS 7600A and 7600B",
        citation: "FAR 17.502-2(c)",
        phase: "Market Research",
        state: "required",
        handoff: true,
        tab: "010",
        note: "The agreement is written and signed in G-Invoicing, outside T-Minus. Attach the signed copy here.",
      },
      { doc_key: "provisional-cost-increase", label: "Request for a provisional increase in the estimated cost", citation: "FAR 17.502-2(c)", phase: "Market Research", state: "offered", tab: "010" },
    ],
  },
  {
    key: "foreign",
    condition: "Vendor country or place of performance outside the United States",
    when: (c) => outsideUS(c),
    docs: [
      { doc_key: "foreign-contract-request", label: "Request to award a foreign contract", citation: "NFS 1825", phase: "Market Research", state: "required", tab: "010" },
      { doc_key: "duty-free-certificate", label: "Duty free certificate", citation: "FAR 25.903", phase: "Market Research", state: "offered", tab: "010" },
    ],
  },
  {
    key: "buy-american",
    condition: "Supplies with an end product that is not domestic",
    when: (c) => notDomestic(c),
    docs: [
      { doc_key: "buy-american-nonavailability", label: "Buy American Act nonavailability determination", citation: "FAR 25.103", phase: "Market Research", state: "required", tab: "010" },
    ],
  },
  {
    key: "noncommercial",
    condition: "Commerciality determination: not commercial",
    when: (c) => !c.s.commercial,
    docs: [
      { doc_key: "noncommercial-request", label: "Request to solicit a non-commercial product or service", citation: "OP memorandum of the template date", phase: "Market Research", state: "required", tab: "010" },
    ],
  },
  {
    key: "abilityone",
    condition: "PSC or NAICS on the AbilityOne procurement list",
    when: (c) =>
      ABILITYONE_CODES.includes(String(c.acq["psc_code"] ?? "").trim()) ||
      ABILITYONE_CODES.includes(String(c.acq["naics_code"] ?? "").trim()),
    docs: [
      { doc_key: "abilityone-coordination", label: "AbilityOne coordination", citation: "FAR 8.7", phase: "Market Research", state: "required", tab: "010" },
    ],
  },
  {
    key: "npa-7m",
    condition: "Estimated value at or above $7,000,000",
    when: (c) => c.value >= 7_000_000 && c.value < 30_000_000,
    docs: [
      { doc_key: "npa-notification", label: "NASA notification of procurement action", citation: "NFS CG 1805.31", phase: "Intake", state: "required", tab: "005" },
    ],
  },
  {
    key: "anosca-30m",
    condition: "Estimated value at or above $30,000,000",
    when: (c) => c.value >= 30_000_000,
    docs: [
      { doc_key: "anosca", label: "ANOSCA announcement", citation: "NFS CG 1805.32", phase: "Intake", state: "required", tab: "005" },
    ],
  },
  {
    key: "subcontracting-waiver",
    condition: "A subcontracting plan applies and no subcontracting possibilities exist",
    when: (c) => c.s.subcontracting_plan_applies && !c.s.subcontracting_possibilities,
    docs: [
      { doc_key: "subcontracting-plan-waiver", label: "Determination to waive the subcontracting plan", citation: "FAR 19.705-2", phase: "Market Research", state: "required", tab: "010" },
    ],
  },
  {
    key: "oci",
    condition: "Any organizational conflict of interest answer is yes",
    when: (c) => c.oci,
    docs: [
      { doc_key: "oci-determination", label: "OCI determination memorandum and checklist", citation: "FAR 9.5", phase: "Market Research", state: "required", tab: "010" },
      { doc_key: "limitation-future-contracting", label: "Limitation of future contracting memorandum", citation: "FAR 9.507-2", phase: "Market Research", state: "offered", tab: "010" },
      { doc_key: "section-l-oci-notice", label: "Section L notice of potential OCI", citation: "FAR 9.504", phase: "Solicitation/Quote", state: "offered", tab: "020" },
      { doc_key: "oci-plan-drd", label: "OCI plan data requirement", citation: "FAR 9.504", phase: "Solicitation/Quote", state: "offered", tab: "020" },
    ],
  },
  {
    key: "urgency",
    condition: "Unusual and compelling urgency",
    when: (c) => c.s.urgency,
    docs: [
      {
        doc_key: "jofoc-urgency",
        label: "Justification for other than full and open competition, unusual and compelling urgency",
        citation: "FAR 6.302-2; RFO FAR 6.104-2",
        phase: "JOFOC",
        state: "required",
        templateKey: "jofoc",
        replacesJofoc: true,
        tab: "015",
      },
      { doc_key: "uca-letter-contract", label: "Undefinitized contract action or letter contract justification", citation: "FAR 16.603-3", phase: "Solicitation/Quote", state: "offered", tab: "020" },
    ],
  },
  {
    key: "8a-sole-source-30m",
    condition: "8(a) sole source above $30,000,000",
    when: (c) => /8\(a\)/i.test(c.s.set_aside_type) && c.sole && c.value > 30_000_000,
    docs: [
      {
        doc_key: "jofoc-8a",
        label: "Justification for other than full and open competition, 8(a) sole source",
        citation: "FAR 19.808-1; RFO FAR 6.104-2",
        phase: "JOFOC",
        state: "required",
        templateKey: "jofoc",
        replacesJofoc: true,
        tab: "015",
      },
    ],
  },
  {
    key: "precontract-costs",
    condition: "Precontract costs requested",
    when: (c) => c.s.precontract_costs,
    docs: [
      { doc_key: "precontract-costs-approval", label: "Precontract costs approval memorandum and authorization letter", citation: "FAR 31.205-32", phase: "Solicitation/Quote", state: "required", tab: "020" },
    ],
  },
  {
    key: "exclude-source",
    condition: "The contracting officer chooses to exclude a source",
    when: (c) => c.s.exclude_source,
    docs: [
      { doc_key: "exclude-source-dandf", label: "Authority to exclude a source determination and findings", citation: "FAR 6.202", phase: "Market Research", state: "required", tab: "010" },
    ],
  },
  {
    key: "gsa-sole-source",
    condition: "GSA Federal Supply Schedule order, sole source",
    when: (c) => c.s.vehicle === "gsa_fss" && c.sole,
    docs: [
      { doc_key: "limited-sources-justification", label: "Limited sources justification", citation: "FAR 8.405-6", phase: "JOFOC", state: "required", tab: "015" },
    ],
  },
  {
    key: "gfp",
    condition: "Government-furnished property is provided",
    when: (c) => c.s.gfp,
    docs: [
      { doc_key: "gfp-determination", label: "Contracting officer determination to provide government property", citation: "FAR 45.102", phase: "Solicitation/Quote", state: "required", tab: "020" },
    ],
  },
  {
    key: "far15-competed",
    condition: "FAR Part 15, competed",
    when: (c) => far15(c) && c.competed,
    docs: [
      { doc_key: "seb-set-appointment", label: "SEB or SET membership appointment memorandum", citation: "NFS 1815.370", phase: "Solicitation/Quote", state: "offered", tab: "020" },
      { doc_key: "ssa-appointment", label: "SSA appointment letter", citation: "NFS 1815.303", phase: "Solicitation/Quote", state: "offered", tab: "020" },
      { doc_key: "drfp-cover-letter", label: "Draft RFP cover letter", citation: "FAR 15.201", phase: "Solicitation/Quote", state: "offered", tab: "020" },
      { doc_key: "final-rfp-cover-letter", label: "Final RFP cover letter", citation: "FAR 15.203", phase: "Solicitation/Quote", state: "offered", tab: "020" },
      { doc_key: "blackout-notice", label: "Blackout notice", citation: "NFS 1815.201", phase: "Solicitation/Quote", state: "offered", tab: "020" },
      { doc_key: "electronic-posting-checklist", label: "Electronic document posting checklist", citation: "FAR 5.102", phase: "Solicitation/Quote", state: "offered", tab: "020" },
      { doc_key: "self-clearance-template", label: "Self-clearance template", citation: "NFS CG 1801.6", phase: "Solicitation/Quote", state: "offered", tab: "020" },
      { doc_key: "ppm", label: "Preliminary planning memorandum before negotiation", citation: "FAR 15.406-1", phase: "Price Reasonableness", state: "required", tab: "030" },
    ],
  },
  {
    key: "far15-sole-source",
    condition: "FAR Part 15, sole source",
    when: (c) => far15(c) && c.sole,
    docs: [
      { doc_key: "rfp-noncompetitive", label: "RFP for a non-competitive new award", citation: "FAR 15.203", phase: "Solicitation/Quote", state: "offered", tab: "020" },
    ],
  },
  {
    key: "existing-contract-mod",
    condition: "An existing contract and a modification needing a proposal",
    when: (c) => c.s.mod_needs_proposal,
    docs: [
      { doc_key: "rfp-existing-contract", label: "RFP for an existing contract", citation: "FAR 43.204", phase: "Administration", state: "offered", tab: "060" },
    ],
  },
  {
    key: "cba",
    condition: "A collective bargaining agreement covers the incumbent workforce",
    when: (c) => c.s.cba === "yes",
    docs: [
      { doc_key: "cba-notification", label: "Notification to interested parties under collective bargaining agreements", citation: "FAR 22.1010", phase: "Solicitation/Quote", state: "required", tab: "020" },
    ],
  },
  {
    key: "competed-award-notices",
    condition: "Any competed award",
    when: (c) => c.competed,
    docs: [
      {
        doc_key: "postaward-notification-letters",
        label: "Postaward notification letters to the successful and unsuccessful offerors",
        citation: "FAR 15.503",
        phase: "Award",
        state: "required",
        tab: "050",
      },
    ],
  },
  {
    key: "set-aside-preaward",
    condition: "A set-aside acquisition",
    when: (c) => Boolean((c.s.set_aside_type || "").trim()) && !/none|full and open/i.test(c.s.set_aside_type),
    docs: [
      { doc_key: "preaward-apparent-successful", label: "Preaward notification to the apparent successful offeror", citation: "FAR 19.302", phase: "Award", state: "required", tab: "050" },
    ],
  },
  {
    key: "over-sat-postaward-conference",
    condition: "Estimated value over the simplified acquisition threshold",
    when: (c) => c.value > 350_000,
    docs: [
      { doc_key: "postaward-conference-report", label: "Postaward conference report", citation: "FAR 42.503-3", phase: "Administration", state: "offered", tab: "060" },
    ],
  },
  {
    key: "award-term-or-fee",
    condition: "A contract type with award term or award fee",
    when: (c) => c.s.award_term_or_award_fee || ["CPAF", "FPAF"].includes(c.type),
    docs: [
      { doc_key: "award-term-determination", label: "Award term determination", citation: "NFS 1816.4", phase: "Administration", state: "required", tab: "060" },
      { doc_key: "peb-appointment", label: "Performance evaluation board appointment", citation: "NFS 1816.4", phase: "Administration", state: "required", tab: "060" },
      { doc_key: "fdo-appointment", label: "Fee determination official appointment", citation: "NFS 1816.4", phase: "Administration", state: "required", tab: "060" },
    ],
  },
  {
    key: "cost-type-administration",
    condition: "A cost-reimbursement contract type",
    when: (c) => isCost(c),
    docs: [
      { doc_key: "nf-533-analysis", label: "NF 533 monthly analysis", citation: "NFS 1842.7201", phase: "Administration", state: "offered", tab: "060" },
      { doc_key: "voucher-review-checklist", label: "Voucher review checklist", citation: "FAR 42.803", phase: "Administration", state: "offered", tab: "060" },
    ],
  },
  {
    key: "subcontract-consent",
    condition: "FAR 52.244-2 in the clause packet",
    when: (c) => {
      const clauses = c.acq["contract_clauses"];
      const list = Array.isArray(clauses) ? clauses.map((x) => String(x)) : [];
      return list.some((x) => x.includes("52.244-2")) || isCost(c);
    },
    docs: [
      { doc_key: "subcontract-consent-review", label: "Subcontract consent review", citation: "FAR 44.201-1", phase: "Administration", state: "offered", tab: "060" },
    ],
  },
  {
    key: "ratification",
    condition: "A ratification is requested",
    when: (c) => c.s.ratification_requested,
    docs: [
      { doc_key: "ratification", label: "Ratification of an unauthorized commitment", citation: "FAR 1.602-3", phase: "Intake", state: "required", tab: "005" },
    ],
  },
];

// ------------------------------------------------------------ configuration

export type TriggerConfigRow = {
  trigger_key: string;
  doc_key: string;
  label: string;
  citation: string;
  phase: string;
  state: string;
  enabled: boolean;
  note: string | null;
};

let configByKey = new Map<string, TriggerConfigRow>();

/** Apply the HQ-edited configuration rows read from the database. */
export function setTriggerConfig(rows: TriggerConfigRow[]) {
  configByKey = new Map(rows.map((r) => [`${r.trigger_key}|${r.doc_key}`, r]));
}

/** The seed rows for the configuration table, as the trigger table is built. */
export function triggerConfigSeed(): (TriggerConfigRow & { condition_label: string; sort_order: number })[] {
  const rows: (TriggerConfigRow & { condition_label: string; sort_order: number })[] = [];
  let order = 0;
  for (const t of TRIGGERS) {
    for (const d of t.docs) {
      order += 1;
      rows.push({
        trigger_key: t.key,
        doc_key: d.doc_key,
        condition_label: t.condition,
        label: d.label,
        citation: d.citation,
        phase: d.phase,
        state: d.state,
        enabled: true,
        note: d.note ?? null,
        sort_order: order,
      });
    }
  }
  return rows;
}

function configured(triggerKey: string, doc: TriggerDoc): TriggerDoc | null {
  const row = configByKey.get(`${triggerKey}|${doc.doc_key}`);
  if (!row) return doc;
  if (!row.enabled) return null;
  return {
    ...doc,
    label: row.label || doc.label,
    citation: row.citation || doc.citation,
    phase: row.phase || doc.phase,
    state: row.state === "offered" ? "offered" : "required",
    ...(row.note ? { note: row.note } : {}),
  };
}

/** Every document row this record triggers, in the order of the trigger table. */
export function triggeredDocs(acq: Record<string, unknown>): TriggerDoc[] {
  const context = scenarioContext(acq);
  const out: TriggerDoc[] = [];
  const seen = new Set<string>();
  for (const t of TRIGGERS) {
    let applies = false;
    try {
      applies = t.when(context);
    } catch {
      applies = false;
    }
    if (!applies) continue;
    for (const d of t.docs) {
      const row = configured(t.key, d);
      if (!row || seen.has(row.doc_key)) continue;
      seen.add(row.doc_key);
      out.push(row);
    }
  }
  // The postaward notice citation follows the method the award is made under.
  const simplified = /\b13\b/.test(context.method);
  for (const d of out) {
    if (d.doc_key === "postaward-notification-letters" && simplified)
      d.citation = "FAR 13.106-3(d)";
  }
  // A consolidation determination and a bundling determination never both
  // stand: the value decides which one the record needs.
  if (out.some((d) => d.doc_key === "bundling-dandf"))
    return out.filter((d) => d.doc_key !== "consolidation-dandf");
  return out;
}

/** The justification variant this record uses in place of the standard JOFOC. */
export function jofocVariant(acq: Record<string, unknown>): TriggerDoc | null {
  return triggeredDocs(acq).find((d) => d.replacesJofoc) ?? null;
}
