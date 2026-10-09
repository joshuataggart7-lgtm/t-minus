// The launch sequence: which phases apply, which documents each phase needs,
// which reviews are triggered, and what puts the clock on hold.
// Phase order and planned days come from phase_plan; review citations and
// planned days come from review_rules. Nothing regulatory is invented here
// beyond the phase citation labels.

import { matchStrategy, type RefData } from "@/lib/intake";
import { phaseAlias, REVIEW_PHASE } from "@/lib/phase-alias";
import { DECISION_LABEL, decisionOutcome, normalizeDecision, reviewKindFor, isDecided, PHASE_EXIT_RULE, type ReviewDecision, type ReviewKind, type ReviewOutcome } from "@/lib/review-decisions";
import { overrideValue } from "@/lib/center-config";
import { jofocVariant, scenarioContext, scenarioOf, triggeredDocs } from "@/lib/scenario";
import { NF1787_CITATION, nf1787Trigger } from "@/lib/nf1787-trigger";
import { HQ_TEMPLATE_KEYS, NO_DANDF_NOTE } from "@/lib/templates-hq";
import { HQ4_TEMPLATE_KEYS } from "@/lib/templates-hq4";
import { HQ5_PHASES, HQ5_TEMPLATE_KEYS } from "@/lib/templates-hq5";
import { HQ6_PHASES, HQ6_TEMPLATE_KEYS } from "@/lib/templates-hq6";
import { HQ6B_PHASES, HQ6B_TEMPLATE_KEYS } from "@/lib/templates-hq6b";
import { HQ6C_PHASES, HQ6C_TEMPLATE_KEYS } from "@/lib/templates-hq6c";
import {
  acquisitionProfile,
  exceptionLabel,
  fssOrderCitation,
  isOrderProfile,
  vehicleOf,
} from "@/lib/vehicles";
import { igceCite, isCommercialSimplifiedMethod, simplifiedPriceCite } from "@/lib/rfo-simplified-cites";
import { dateCT } from "@/lib/calendar-date";
import {
  isCostType,
  isFar13Method,
  isLetterContract,
  isRatification,
  newContractPlanKey,
  simplifiedSoleSourceKind,
  TM_ORDER_PLAN,
  type NewContractFacts,
} from "@/lib/phase-plan-key";
import { MICRO_PURCHASE_THRESHOLD, MICRO_PURCHASE_THRESHOLD_NAME } from "@/lib/micro-purchase";
import { certifiedDataBasis, CERTIFIED_FAR_TEXT_NAME, CERTIFIED_STATUTE_NAME } from "@/lib/certified-data";

export type AcqRow = Record<string, unknown> & {
  acquisition_id: string;
  competition?: string | null;
  acquisition_method?: string | null;
  contract_type?: string | null;
  estimated_value?: number | string | null;
  includes_it?: boolean | null;
  hardware_deliverable?: boolean | null;
  igce_attached?: boolean | null;
  sow_attached?: boolean | null;
  funds_certified?: boolean | null;
  acquisition_forecast_verified?: boolean | null;
  jofoc_authority_citation?: string | null;
  enterprise_psl_check?: string | null;
  set_aside?: string | null;
  current_phase?: string | null;
  clock_state?: string | null;
  regulatory_baseline_date?: string | null;
  target_award_date?: string | null;
  co_name?: string | null;
  nf1707_answers?: Record<string, unknown> | null;
  title?: string | null;
  description_of_requirement?: string | null;
  center_code?: string | null;
  mission_id?: string | null;
  need_date?: string | null;
  naics_code?: string | null;
  psc_code?: string | null;
  place_of_performance?: string | null;
  period_of_performance_start?: string | null;
  period_of_performance_end?: string | null;
  hold_reason?: string | null;
  hold_owner?: string | null;
  status?: string | null;
  vendor_legal_name?: string | null;
};

export type PhasePlanRow = {
  acquisition_type: string | null;
  phase: string | null;
  planned_days: number | null;
  order: number | null;
  note: string | null;
};

export type ReviewRuleRow = {
  rule_id: string;
  reviewer_role: string;
  trigger: string | null;
  citation: string | null;
  planned_days: number | null;
  note: string | null;
};

export type PollRow = {
  poll_id: string;
  acquisition_id: string | null;
  phase: string | null;
  reviewer_role: string | null;
  reviewer_name: string | null;
  vote: string | null;
  reason: string | null;
  due_date: string | null;
};

/** Boolean or text columns on the record that stand in for an attachment. */
export type DocField =
  | "igce_attached"
  | "sow_attached"
  | "funds_certified"
  | "acquisition_forecast_verified"
  | "jofoc_authority_citation"
  | "proposed_price";

export type RequiredDoc = {
  label: string;
  citation: string;
  field?: DocField;
  /** what it links to when there is no toggle */
  link?: "templates" | "checks" | "packet" | "form";
  /** template opened for this file, rather than the templates library */
  templateKey?: string;
  /** generated form opened for this file */
  formKey?: string;
  /**
   * False when a regulation, NFS text, Companion Guide entry, PCD or
   * Enterprise Procurement Strategy requires the document at this value or
   * condition. Optional documents are offered, never required.
   */
  optional?: boolean;
  note?: string;
  /** stable key for a row switched on by the scenario trigger table */
  docKey?: string;
  /** NF 1098 tab an external copy is filed under */
  tab?: string;
  /** the template is still planned: the row takes an external copy only */
  attachOnly?: boolean;
  /** the document of record is produced outside T-Minus */
  handoff?: boolean;
  /** due after award: never holds the file before award */
  dueAfterAward?: boolean;
  /**
   * The justification and approval may be made after award (unusual and
   * compelling urgency, RFO FAR 6.103-2(d)): neither the row nor its phase
   * reviews block award.
   */
  mayFollowAward?: boolean;
};

/** The facts a new contract's plan key reads (see phase-plan-key.ts). */
export function newContractFacts(acq: AcqRow): NewContractFacts {
  const row = acq as Record<string, unknown>;
  return {
    competition: acq.competition,
    method: row["acquisition_method"],
    commercial: isCommercialBuy(acq),
    value: acq.estimated_value ?? null,
    contractType: acq.contract_type,
    ratification: isRatification(row),
    letterContract: isLetterContract(row),
  };
}

/** A time-and-materials or labor-hour contract type on the record. */
export function isTmOrLaborHour(acq?: AcqRow | null): boolean {
  const t = String(acq?.contract_type ?? "").trim();
  return /^(T&M|TM|LH|LABOR)/i.test(t) || /labor[- ]hour|time[- ]and[- ]materials?/i.test(t);
}

export function acquisitionType(acq: AcqRow, plan?: { acquisition_type: string | null }[] | null) {
  // A vehicle answered at intake decides the phase plan: a parent IDIQ, an
  // order under one, a BPA, or a schedule order each run their own sequence.
  const profile = acquisitionProfile(acq as Record<string, unknown>);
  // A T&M or labor-hour order runs the T&M order plan, which carries the
  // Market Research phase its determination and findings sits in.
  if (profile === "order_under_idiq" && isTmOrLaborHour(acq) && (!plan || plan.some((p) => p.acquisition_type === TM_ORDER_PLAN)))
    return TM_ORDER_PLAN;
  if (profile !== "new_contract") return profile;
  // New contracts: ratification, letter contract, sole source, negotiated
  // (cost or not), simplified, commercial (see phase-plan-key.ts).
  return newContractPlanKey(newContractFacts(acq), plan);
}

/**
 * The award path a file's rows follow. Orders, BPAs and letter contracts carry
 * their own instruments; otherwise a commercial buy uses the SF 1449 (RFO FAR
 * 12.204(c)(1)), a noncommercial FAR Part 13 buy the OF 347 (RFO FAR
 * 13.203(c)), and a negotiated noncommercial buy the OF 307, SF 26 or SF 33
 * (RFO FAR 15.207-1(b)(1)).
 */
export type AwardPath = "order" | "bpa" | "letter_contract" | "commercial" | "simplified" | "negotiated";

export function awardPath(acq?: AcqRow | null): AwardPath {
  const row = (acq ?? {}) as Record<string, unknown>;
  const profile = acquisitionProfile(row);
  if (isOrderProfile(profile)) return "order";
  if (profile === "bpa") return "bpa";
  if (isLetterContract(row)) return "letter_contract";
  if (isCommercialBuy(acq)) return "commercial";
  if (isFar13Method(row["acquisition_method"])) return "simplified";
  return "negotiated";
}

/**
 * A sole-source new contract at or below the SAT under simplified or commercial
 * rules: its JOFOC phase holds the single-source D&F (RFO FAR 13.101(b)) or
 * the only-one-source documentation (RFO FAR 12.102(a)), not a Part 6
 * justification (RFO FAR 6.001(a)).
 */
export function simplifiedSoleSource(acq?: AcqRow | null): "noncommercial" | "commercial" | null {
  const path = awardPath(acq);
  if (path !== "simplified" && path !== "commercial") return null;
  return simplifiedSoleSourceKind((acq ?? null) as Record<string, unknown> | null, path === "commercial");
}

/**
 * The name a stored phase key is shown under on this file. The JOFOC step on a
 * simplified sole source is the single-source D&F (RFO FAR 13.101(b)) or the
 * only-one-source documentation (RFO FAR 12.102(a)); the key stays "JOFOC".
 */
export function stepLabel(phase: string | null | undefined, acq?: AcqRow | null): string {
  const p = String(phase ?? "");
  if (p === "JOFOC") return simplifiedSoleLabel(acq).label ?? p;
  return p;
}

/** Display name for the JOFOC phase on a simplified sole-source file; the phase key stays "JOFOC". */
function simplifiedSoleLabel(acq?: AcqRow | null): { label?: string } {
  const kind = simplifiedSoleSource(acq);
  if (kind === "noncommercial") return { label: "Single-source D&F" };
  if (kind === "commercial") return { label: "Only-one-source documentation" };
  return {};
}

/**
 * The statutory authority a justification records (RFO FAR 6.104-1(a)(4)),
 * matching the file's reason: unusual and compelling urgency (RFO FAR 6.103-2),
 * an 8(a) sole source above $30 million (RFO FAR 6.103-5(e); RFO FAR
 * 19.208-2(a)(1)), a commercial simplified file over the SAT under RFO FAR
 * 12.201-1 (41 U.S.C. 1901, RFO FAR 12.102(b) Table 12-1), none at or below
 * the SAT (RFO FAR 6.001(a); RFO FAR 12.102(a)), otherwise only one
 * responsible source (RFO FAR 6.103-1).
 * A value already on the record is kept.
 */
export function jofocAuthorityFor(acq?: AcqRow | null): string {
  const row = (acq ?? {}) as Record<string, unknown>;
  const recorded = String(row["jofoc_authority_citation"] ?? "").trim();
  if (recorded && recorded !== "RFO FAR 6.301(a)(1)") return recorded;
  const variant = acq ? jofocVariant(row) : null;
  if (variant?.doc_key === "jofoc-urgency" || variant?.templateKey === "jofoc-urgency")
    return "10 U.S.C. 3204(a)(2) as implemented by RFO FAR 6.103-2 (unusual and compelling urgency)";
  if (variant?.templateKey === "jofoc-8a-over-30m")
    return "10 U.S.C. 3204(a)(5) as implemented by RFO FAR 6.103-5 (authorized or required by statute)";
  // At or below the SAT a simplified or commercial sole source carries no Part 6
  // justification (RFO FAR 6.001(a); RFO FAR 12.102(a)), so no Part 6 authority.
  if (simplifiedSoleSource(acq)) return "";
  if (commercialSimplifiedOverSat(acq)) return COMMERCIAL_SIMPLIFIED_AUTHORITY;
  return "10 U.S.C. 3204(a)(1) as implemented by RFO FAR 6.103-1 (only one responsible source)";
}

/** Table 12-1 authority for a commercial sole source over the SAT on simplified procedures. */
export const COMMERCIAL_SIMPLIFIED_AUTHORITY = "41 U.S.C. 1901 (RFO FAR 12.102(b), Table 12-1)";

/**
 * A commercial sole source over the SAT and at or below $9 million on the
 * simplified procedures at RFO FAR 12.201-1. It needs a written justification
 * approved as in RFO FAR 6.104, citing 41 U.S.C. 1901 (RFO FAR 12.102(b),
 * Table 12-1), not a Part 6 authority at RFO FAR 6.103.
 */
export function commercialSimplifiedOverSat(acq?: AcqRow | null): boolean {
  const row = (acq ?? {}) as Record<string, unknown>;
  if (!/sole/i.test(String(row["competition"] ?? ""))) return false;
  if (!isCommercialBuy(acq) || !/12\.201-1/.test(String(row["acquisition_method"] ?? ""))) return false;
  const value = Number(row["estimated_value"] ?? NaN);
  return Number.isFinite(value) && value > SIMPLIFIED_ACQUISITION_THRESHOLD && value <= 9_000_000;
}

/** The award instrument named on the signature and award rows. */
function awardInstrument(path: AwardPath): string {
  switch (path) {
    case "order":
      return "order";
    case "bpa":
      return "blanket purchase agreement";
    case "letter_contract":
      return "letter contract";
    case "simplified":
      return "OF 347";
    case "negotiated":
      return "award document (OF 307, SF 26 or SF 33)";
    default:
      return "SF 1449";
  }
}

/** True when the record itself says the buy is commercial. */
export function isCommercialBuy(acq?: AcqRow | null): boolean {
  const row = (acq ?? {}) as Record<string, unknown>;
  const method = String(row["acquisition_method"] ?? "");
  if (/13\.5|12\.201-1|\b12\b/.test(method)) return true;
  if (/\b15\b|\b13\b(?!\.5)/.test(method)) return false;
  const scenario = row["scenario"];
  const commercialFlag =
    scenario !== null && typeof scenario === "object"
      ? (scenario as Record<string, unknown>)["commercial"]
      : undefined;
  if (typeof commercialFlag === "boolean") return commercialFlag;
  return /commercial/i.test(String(row["commercial_determination"] ?? ""));
}

/** The acquisition type written out for people, never the internal code. */
export function acquisitionTypeWords(acq: AcqRow) {
  const contract = String((acq as Record<string, unknown>)["contract_type"] ?? "").trim();
  const commercial = isCommercialBuy(acq);
  const typeWords = /ffp|firm[- ]fixed/i.test(contract) ? "FFP" : contract;
  const contractWords = commercial
    ? `Commercial ${typeWords}`.trim()
    : typeWords || "Non-commercial";
  const method = String((acq as Record<string, unknown>)["acquisition_method"] ?? "");
  const row = acq as Record<string, unknown>;
  const methodWords = isRatification(row) && /1\.405/.test(method)
    ? "RFO FAR 1.405 (ratification)"
    : isLetterContract(row)
    ? "RFO FAR 16.603 (letter contract)"
    : isCommercialSimplifiedMethod(method)
    ? "RFO FAR 12.201-1"
    : /\b16\b/.test(method) && isOrderProfile(acquisitionProfile(row))
    ? "RFO FAR subpart 16.5"
    : /13/.test(method)
      ? "RFO FAR Part 13"
      : /15/.test(method)
        ? "RFO FAR Part 15"
        : /8\.4/.test(method)
          ? "RFO FAR subpart 8.4"
          : /12/.test(method)
            ? "RFO FAR Part 12"
            : commercial
              ? "RFO FAR 12.201-1"
              : "RFO FAR Part 15";
  const competition = String(acq.competition ?? "");
  const compWords = /sole/i.test(competition)
    ? "sole source"
    : /brand/i.test(competition)
      ? "brand name"
      : /limited/i.test(competition)
        ? "limited sources"
        : "competed";
  return `${contractWords}, ${methodWords}, ${compWords}`;
}

export const PHASE_CITATIONS: Record<string, string> = {
  Intake: "NF 1707; NFS CG 1807.711(a)",
  "Market Research": "RFO FAR 10.001; NFS CG 1810.12",
  JOFOC: "RFO FAR 6.104-2 Table 6-1; NFS CG 1806.16",
  Synopsis: "RFO FAR 5.201; RFO FAR 12.202(b) (combined synopsis/solicitation)",
  "Fair Opportunity": "RFO FAR 16.507-2(a); RFO FAR 8.401(b); GSAR subpart 538.71 for a schedule order",
  "Solicitation/Quote": "RFO FAR 12.202(b); NFS CG 1804.11(b) (NCMS is the system of record)",
  "Technical Evaluation": "RFO FAR 12.203 (evaluation of quotations)",
  "Price Reasonableness": "RFO FAR 12.204(a) (price reasonableness); RFO FAR 13.203(a) on a noncommercial simplified file",
  "Responsibility Check": "RFO FAR 9.104-1; RFO FAR 9.105-2; RFO FAR 52.204-7 (SAM)",
  [REVIEW_PHASE]: "Center policy for the review chain",
  Award: "RFO FAR 12.204 (award); RFO FAR 13.203 on a noncommercial simplified file; NFS CG 1804.11(b) (award written in NCMS)",
  "FPDS-NG Report": "RFO FAR 4.301 (contract action reporting)",
  Administration: "RFO FAR Part 42; RFO FAR 4.101 (contract file)",
  Closeout: "RFO FAR 4.308 (contract closeout)",
};

/** Commercial Part 12 simplified citations. A FAR 13.5 or Part 12 commercial
 *  buy runs under the commercial simplified procedures and their ceiling, not
 *  under Part 15 and not on the simplified acquisition threshold story. */
const COMMERCIAL_PHASE_CITATIONS: Record<string, string> = {
  "Solicitation/Quote":
    "RFO FAR 12.202(b); RFO FAR 12.201-1 (commercial simplified procedures); NFS CG 1804.11(b) (NCMS is the system of record)",
  "Technical Evaluation": "RFO FAR 12.203 (evaluation of quotations)",
  "Price Reasonableness": "RFO FAR 12.204(a) (price reasonableness)",
  Award:
    "RFO FAR 12.201-1 (commercial simplified procedures, within the commercial simplified ceiling); NFS CG 1804.11(b) (award written in NCMS)",
};

/** Negotiated Part 15 citations, used where the simplified ones do not apply. */
const PART_15_PHASE_CITATIONS: Record<string, string> = {
  Synopsis: "RFO FAR 5.101 (presolicitation notice)",
  "Solicitation/Quote": "RFO FAR 15.102 (structuring a request for proposals); NFS CG 1804.11(b) (NCMS is the system of record)",
  "Technical Evaluation": "RFO FAR 15.202 (evaluating competitive proposals)",
  "Price Reasonableness": "RFO FAR 15.404-1(b) (price analysis techniques); RFO FAR 15.408-2(a) (price negotiation memorandum)",
  Award: "RFO FAR 15.207-1 (award to successful offeror); NFS CG 1804.11(b) (award written in NCMS)",
};

/** The citation a phase carries on this record's path. */
export function phaseCitation(phase: string, acq?: AcqRow | null): string {
  const method = String(((acq ?? {}) as Record<string, unknown>)["acquisition_method"] ?? "");
  const negotiated = /15/.test(method) || (!/13|12|8\.4/.test(method) && !isCommercialBuy(acq));
  // A sole-source notice is a notice of intent, never a combined
  // synopsis/solicitation, so FAR 12.603 has no part in it.
  const soleSource = /sole|brand/i.test(String(((acq ?? {}) as Record<string, unknown>)["competition"] ?? ""));
  // A letter contract is awarded first and definitized after (RFO FAR 16.603-2(c)).
  if (isLetterContract((acq ?? {}) as Record<string, unknown>)) {
    if (phase === "Award") return "RFO FAR 16.603-2(c) (letter contract with a definitization schedule); NFS CG 1804.11(b) (award written in NCMS)";
    if (phase === "Price Reasonableness") return "RFO FAR 16.603-2(c) (definitization); RFO FAR 15.408-2(a) (price negotiation memorandum)";
  }
  if (phase === "JOFOC") {
    const simplifiedSole = simplifiedSoleSource(acq);
    if (simplifiedSole === "noncommercial")
      return "RFO FAR 13.101(b) (single-source determination and findings); RFO FAR 6.001(a) (Part 6 does not apply)";
    if (simplifiedSole === "commercial") return "RFO FAR 12.102(a) (document the only-one-source decision at or below the SAT)";
    if (commercialSimplifiedOverSat(acq))
      return "RFO FAR 12.102(b) (justification and approval as in RFO FAR 6.104 above the SAT); RFO FAR 6.104-2 Table 6-1; NFS CG 1806.16";
    return "RFO FAR 6.104; RFO FAR 6.104-2 Table 6-1; NFS CG 1806.15(a); NFS CG 1806.16";
  }
  if (soleSource && phase === "Synopsis") return "RFO FAR 5.101(c)(4)(vii) (notice of intent to sole source)";
  // A sole source never runs a combined synopsis/solicitation, so the
  // commercial FAR 12.603 citation has no part in its Solicitation/Quote row.
  if (soleSource && phase === "Solicitation/Quote")
    return "RFO FAR 5.101(c)(4)(vii) (notice of intent to sole source); NFS CG 1804.11(b) (NCMS is the system of record)";
  if (negotiated && PART_15_PHASE_CITATIONS[phase]) return PART_15_PHASE_CITATIONS[phase]!;
  if (!negotiated && isCommercialBuy(acq) && COMMERCIAL_PHASE_CITATIONS[phase])
    return COMMERCIAL_PHASE_CITATIONS[phase]!;
  return PHASE_CITATIONS[phase] ?? "";
}

export const PHASE_GUIDANCE: Record<string, string> = {
  Intake: "Confirm the requirement, the money, and the mission date. The clock starts here.",
  "Market Research":
    "Find out who can do this work and at what price. Write down what you found and where you looked.",
  JOFOC:
    "Only for a sole source. Write the justification, cite the authority, and route it for the approval its dollar tier calls for.",
  Synopsis: "Post the notice so the market can see it. Commercial buys may combine notice and solicitation.",
  "Fair Opportunity":
    "Give every awardee under the vehicle a fair opportunity to be considered, or record the exception the contracting officer relies on.",
  "Solicitation/Quote":
    "Build the solicitation in NCMS. T-Minus hands over the facts, the clause list, and the attachments.",
  "Technical Evaluation": "Judge each quote against the stated criteria. Record who evaluated and why.",
  "Price Reasonableness":
    "Write the price negotiation memorandum. It is the determination of record; no separate price memo is made.",
  "Responsibility Check":
    "Check the vendor in SAM: registration, exclusions, and integrity records. Signing the award is the determination.",
  [REVIEW_PHASE]: `Each required reviewer records a formal decision by name: Approve or Disapprove for an approval, Concur or Nonconcur for a concurrence, Legally sufficient or Not legally sufficient for legal review. ${PHASE_EXIT_RULE}`,
  Award: "Award in NCMS from the handoff packet, then mark the file Launched.",
  "FPDS-NG Report": "Report the action so the public record matches the file.",
  Administration: "Run the contract: deliveries, invoices, and past performance.",
  Closeout: "Close the file when everything is delivered, paid, and filed.",
};

/** Micro-purchase threshold (RFO FAR 2.101), used for the RFO FAR 19.104-1(b)(1) set-aside advisory. */
const MICRO_PURCHASE = MICRO_PURCHASE_THRESHOLD;
/** Value at which the NF 1787A becomes the market research document of record. */
const MRR_THRESHOLD = 2_000_000;
/** Simplified acquisition threshold, above which a sole-source proposal needs a TER. */
const SIMPLIFIED_ACQUISITION_THRESHOLD = 350_000;

/**
 * The NASA technical evaluation report is mandatory only for a sole-source
 * proposal above the simplified acquisition threshold. On a competed
 * simplified acquisition the RFO FAR 13.202 evaluation of quotations is the
 * requirement and the report is offered. The launch sequence, the contract
 * file index, and the template banner all read this one rule.
 */
export function isTerRequired(acq?: AcqRow): boolean {
  const value = Number(acq?.estimated_value ?? 0);
  const sole = /sole|limited source|brand name/i.test(
    `${acq?.competition ?? ""} ${acq?.acquisition_method ?? ""}`,
  );
  return sole && value > SIMPLIFIED_ACQUISITION_THRESHOLD;
}

/** Templates T-Minus writes itself today; every other trigger row is attach-only. */
const LIVE_TEMPLATE_KEYS = new Set([
  "jofoc",
  "consolidation-determination",
  "bundling-determination",
  "economy-act-determination",
  "commercial-tm-lh-determination",
  ...HQ_TEMPLATE_KEYS,
  ...HQ4_TEMPLATE_KEYS,
  ...HQ5_TEMPLATE_KEYS,
  ...HQ6_TEMPLATE_KEYS,
  ...HQ6B_TEMPLATE_KEYS,
  ...HQ6C_TEMPLATE_KEYS,
]);

/**
 * The phase a trigger row lands in on this plan. A Market Research or JOFOC
 * row whose phase the plan does not have (an order plan, the letter contract
 * or ratification plan) moves to Fair Opportunity when the plan has it, and to
 * Intake otherwise, so a required row never drops out of the sequence.
 */
export function triggerPhaseOnPlan(phase: string, planPhases?: readonly string[] | null): string {
  if (!planPhases || !planPhases.length || planPhases.includes(phase)) return phase;
  if (phase === "Market Research" || phase === "JOFOC")
    return planPhases.includes("Fair Opportunity") ? "Fair Opportunity" : "Intake";
  return phase;
}

/** Rows the scenario answers switch on for this phase. */
function scenarioRows(phase: string, acq?: AcqRow, planPhases?: readonly string[] | null): RequiredDoc[] {
  if (!acq) return [];
  return triggeredDocs(acq as Record<string, unknown>)
    .filter((d) => triggerPhaseOnPlan(d.phase, planPhases) === phase && !d.replacesJofoc)
    .map((d) => {
      const templateKey = d.templateKeyFor
        ? d.templateKeyFor(scenarioContext(acq as Record<string, unknown>))
        : (d.templateKey ?? null);
      const live = templateKey ? LIVE_TEMPLATE_KEYS.has(templateKey) : false;
      const row: RequiredDoc = {
        label: d.label,
        citation: d.citation,
        docKey: d.doc_key,
        ...(d.tab ? { tab: d.tab } : {}),
        ...(d.state === "offered" ? { optional: true } : {}),
        ...(d.note ? { note: d.note } : {}),
        ...(d.handoff ? { handoff: true } : {}),
        ...(d.dueAfterAward ? { dueAfterAward: true } : {}),
      };
      if (d.doc_key === "contract-type-dandf" && !templateKey) {
        // CPFF carries no determination of its own; the row says so.
        row.note = NO_DANDF_NOTE;
      }
      if (live && templateKey) {
        row.templateKey = templateKey;
        row.link = "templates";
      } else {
        row.attachOnly = true;
      }
      return row;
    });
}

/**
 * The rows for one phase. Pass the plan's phase names so a trigger row whose
 * phase the plan lacks lands where the plan can show it (triggerPhaseOnPlan).
 */
export function requiredDocs(phase: string, acq?: AcqRow, planPhases?: readonly string[] | null): RequiredDoc[] {
  const base = baseDocs(phase, acq);
  const extra = scenarioRows(phase, acq, planPhases);
  const variant = acq ? jofocVariant(acq as Record<string, unknown>) : null;
  // A scenario trigger row and a base row can name the same document (the BPA
  // annual review). One row per docKey: the trigger row, which carries the
  // template, replaces the base row.
  const extraKeys = new Set(extra.map((d) => d.docKey).filter(Boolean));
  const merged = extra.length ? [...base.filter((d) => !d.docKey || !extraKeys.has(d.docKey)), ...extra] : base;
  if (variant && phase === "JOFOC" && !simplifiedSoleSource(acq)) {
    return merged.map((d) =>
      d.templateKey === "jofoc"
        ? {
            ...d,
            label: variant.label,
            citation: variant.citation,
            ...(variant.templateKey ? { templateKey: variant.templateKey } : {}),
            // RFO FAR 6.103-2(d): under unusual and compelling urgency the
            // justification and approval may be made after award when making
            // it first would unreasonably delay the acquisition. It is posted
            // within 30 days after award (RFO FAR 6.301(b)(1)).
            ...(variant.doc_key === "jofoc-urgency"
              ? {
                  dueAfterAward: true,
                  mayFollowAward: true,
                  note: "May be made after award when making it first would unreasonably delay the acquisition (RFO FAR 6.103-2(d)). Post it within 30 days after award (RFO FAR 6.301(b)(1)).",
                }
              : {}),
          }
        : d,
    );
  }
  return [...merged, ...ceilingRows(phase, acq)];
}

/** The time-and-materials or labor-hour ceiling price recorded on the file, in dollars. */
export function tmCeilingPrice(acq?: AcqRow | null): number {
  const raw = String(scenarioOf((acq ?? null) as Record<string, unknown> | null).tm_ceiling_price ?? "").replace(/[$,\s]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Ceiling price rows on a time-and-materials or labor-hour contract or order.
 * The contract or order must include a ceiling price that the contractor
 * exceeds at its own risk (RFO FAR 12.104(b)(1)(ii) commercial; RFO FAR
 * 16.601-3(c) noncommercial). Any increase needs a best-interest
 * determination (RFO FAR 12.104(b)(2); RFO FAR 16.601-5).
 */
function ceilingRows(phase: string, acq?: AcqRow): RequiredDoc[] {
  if (!acq || !isTmOrLaborHour(acq)) return [];
  const commercial = isCommercialBuy(acq);
  if (phase === "Award") {
    const ceiling = tmCeilingPrice(acq);
    return [
      {
        label: "Ceiling price in the contract or order",
        citation: commercial ? "RFO FAR 12.104(b)(1)(ii)" : "RFO FAR 16.601-3(c)",
        docKey: "tm-ceiling-price",
        attachOnly: true,
        note: ceiling
          ? `Ceiling price recorded on the file: $${ceiling.toLocaleString("en-US")}. The contractor exceeds it at its own risk.`
          : "Record the ceiling price on the file, or attach the page of the contract or order that states it. The contractor exceeds it at its own risk.",
      },
    ];
  }
  if (phase === "Administration")
    return [
      {
        label: "Ceiling price increase determination (best interest of the Government)",
        citation: commercial ? "RFO FAR 12.104(b)(2); RFO FAR 16.601-5" : "RFO FAR 16.601-5",
        docKey: "tm-ceiling-increase",
        optional: true,
        attachOnly: true,
        note: "Only before an increase to the ceiling price: analyze pricing and other relevant factors, document the decision in the file, and follow part 6, part 8 or 16.507-6 when the change modifies the general scope (RFO FAR 16.601-5).",
      },
    ];
  return [];
}

/** Firm-fixed-price and nothing else on the record (no hybrid type). */
export function isFirmFixedPriceOnly(acq?: AcqRow): boolean {
  const type = String(acq?.contract_type ?? "").trim();
  const hybrid = String((acq as Record<string, unknown> | undefined)?.["hybrid_contract_type"] ?? "").trim();
  return /^(ffp|firm[- ]fixed[- ]price)$/i.test(type) && !hybrid;
}

/** The record carries at least one option period (post-award schedule). */
export function hasOptionPeriods(acq?: AcqRow): boolean {
  const post = (acq as Record<string, unknown> | undefined)?.["post_award"] as
    | { option_periods?: unknown; options?: unknown }
    | null
    | undefined;
  const list = post?.option_periods ?? post?.options;
  return Array.isArray(list) && list.length > 0;
}

/** The fair opportunity procedure the order value falls under (RFO FAR 16.507-1, -3, -4, -5). */
function fairOpportunityTier(value: number): { citation: string; note: string } {
  if (value <= MICRO_PURCHASE)
    return { citation: "RFO FAR 16.507-1", note: "Order value at or below the micro-purchase threshold: RFO FAR 16.507-1." };
  if (value <= SIMPLIFIED_ACQUISITION_THRESHOLD)
    return { citation: "RFO FAR 16.507-3", note: "Order value above the micro-purchase threshold but not above the SAT: RFO FAR 16.507-3." };
  if (value <= 7_500_000)
    return { citation: "RFO FAR 16.507-4", note: "Order value above the SAT but not above $7.5 million: RFO FAR 16.507-4." };
  return { citation: "RFO FAR 16.507-5", note: "Order value above $7.5 million: RFO FAR 16.507-5." };
}

function addDaysISO(iso: string, days: number): string | null {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/** The definitization window on a letter contract (RFO FAR 16.603-2(c)). */
function definitizationNote(acq?: AcqRow): string {
  const base =
    "Definitize within 180 days after the date of the letter contract or before 40 percent of the work is complete, whichever comes first (RFO FAR 16.603-2(c)).";
  const award = String(acq?.target_award_date ?? "").slice(0, 10);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(award) ? addDaysISO(award, 180) : null;
  return due ? `${base} From the target award date of ${award}, 180 days is ${due}.` : base;
}

/**
 * Routing notes for a new buy at or below the SAT. The NSSC is NASA's sole
 * purchasing activity at or below the SAT except for the listed cases (NFS CG
 * 1812.41(a), (b)); under the micro-purchase threshold the purchase card is
 * used to the maximum extent practicable (NFS CG 1812.42(a)). Offered notes,
 * never holding.
 */
function simplifiedRoutingRows(acq?: AcqRow): RequiredDoc[] {
  if (!acq) return [];
  const row = acq as Record<string, unknown>;
  const value = Number(acq.estimated_value ?? NaN);
  if (!Number.isFinite(value) || value <= 0 || value > SIMPLIFIED_ACQUISITION_THRESHOLD) return [];
  if (acquisitionProfile(row) !== "new_contract" || isRatification(row) || isLetterContract(row)) return [];
  const s = scenarioOf(row);
  // NFS CG 1812.41(a)(4) interagency agreements and (a)(5) construction stay at the center.
  if (s.funding !== "nasa" || s.deliverable === "construction") return [];
  if (value <= MICRO_PURCHASE)
    return [
      {
        label: "Purchase card for a micro-purchase",
        citation: "NFS CG 1812.42(a)",
        optional: true,
        note: "The NASA purchase card must be used for micro-purchase threshold transactions to the maximum extent practicable (NFS CG 1812.42(a)).",
      },
    ];
  return [
    {
      label: "NSSC routing through the Simplified Acquisition Customer Portal",
      citation: "NFS CG 1812.41(a), (b)",
      optional: true,
      note: "At or below the SAT the NSSC is NASA's sole purchasing activity unless an exception in NFS CG 1812.41(a)(1)-(7) applies; the requiring activity submits the request in the Simplified Acquisition Customer Portal (NFS CG 1812.41(b)).",
    },
  ];
}

function baseDocs(phase: string, acq?: AcqRow): RequiredDoc[] {
  switch (phase) {
    case "Intake":
      return [
        {
          label: "NF 1707 intake, Acquisition Forecast affirmed",
          citation: "NFS CG 1807.711(a); NFS CG 1807.703(a) (forecast, above the SAT)",
          field: "acquisition_forecast_verified",
        },
        {
          label: "Independent government cost estimate (IGCE)",
          citation: igceCite(String(acq?.acquisition_method ?? ""), Number(acq?.estimated_value ?? 0)),
          field: "igce_attached",
        },
        {
          label: "Statement of work or performance work statement",
          citation: "RFO FAR 11.102(a)(2)(i); RFO FAR 37.101-1(a) and 37.102-1(a) (services, PWS)",
          field: "sow_attached",
        },
        ...simplifiedRoutingRows(acq),
      ];
    case "Market Research": {
      // An order plan with a Market Research phase (the T&M order plan) uses it
      // for the T&M determination and findings only; the order's NF 1787 row
      // sits on Fair Opportunity.
      if (isOrderProfile(acquisitionProfile(acq as Record<string, unknown>))) return [];
      const value = Number(acq?.estimated_value ?? 0);
      // NFS CG 1810.12(c): the NF 1787A documents market research on a
      // procurement exceeding $2,000,000 and goes with the NF 1787; below that
      // it is optional.
      const mrrRequired = value > MRR_THRESHOLD;
      const sb = nf1787Trigger((acq ?? {}) as Record<string, unknown>, { micro: MICRO_PURCHASE });
      return [
        {
          label: "Market research memorandum",
          citation: "RFO FAR 10.001",
          link: "templates",
          templateKey: "market-research-memo",
          ...(mrrRequired
            ? { optional: true, note: "At this value the NF 1787A is the market research document of record." }
            : { note: "At $2,000,000 or less this memorandum is the market research document of record." }),
        },
        {
          label: mrrRequired ? "NF 1787A market research report" : "NF 1787A market research report (offered)",
          citation: mrrRequired ? "NFS CG 1810.12(c)(1)" : "NFS CG 1810.12(c)(2)",
          link: "form",
          formKey: "nf-1787a",
          optional: !mrrRequired,
          note: mrrRequired
            ? "Required over $2,000,000; it accompanies the NF 1787 when one is required (Companion Guide guidance)."
            : "Optional at $2,000,000 or less; the memorandum is the document of record.",
        },
        {
          label: sb.required
            ? "NF 1787 small business coordination"
            : "NF 1787 small business coordination (Offered, Center practice)",
          citation: NF1787_CITATION,
          link: "form",
          formKey: "nf-1787",
          optional: !sb.required,
          note: `${sb.reason} Companion Guide guidance, not regulation.${sb.advisory ? ` ${sb.advisory}` : ""}`,
        },
        ...(sb.pcr
          ? [
              {
                label: "SBA PCR review: proposed acquisition package 30 days before the solicitation",
                citation: sb.pcr.citation,
                docKey: "sba-pcr-package",
                tab: "010",
                attachOnly: true,
                note: sb.pcr.text,
              } as RequiredDoc,
            ]
          : []),
      ];
    }
    case "JOFOC": {
      const simplifiedSole = simplifiedSoleSource(acq);
      if (simplifiedSole === "noncommercial")
        return [
          {
            label: "Single-source determination and findings (only one source reasonably available)",
            citation: "RFO FAR 13.101(b); RFO FAR subpart 1.5",
            // Same row key as the JOFOC row, read from the attached D&F. No
            // record field: the JOFOC attach path writes a Part 6 cite there.
            docKey: "jofoc_authority_citation",
            attachOnly: true,
            templateKey: "single-source-dandf",
            link: "templates",
            note: "Part 6 does not apply to simplified acquisition procedures (RFO FAR 6.001(a)). Generate the D&F from the record, or attach the signed copy.",
          },
        ];
      if (simplifiedSole === "commercial")
        return [
          {
            label: "Only-one-source documentation",
            citation: "RFO FAR 12.102(a)",
            docKey: "jofoc_authority_citation",
            attachOnly: true,
            templateKey: "only-one-source-record",
            link: "templates",
            note: "At or below the SAT, document the decision that only one source is available and the basis for it (RFO FAR 12.102(a)). No Part 6 justification and approval is needed.",
          },
        ];
      return [
        {
          label: "Justification for other than full and open competition",
          citation: commercialSimplifiedOverSat(acq)
            ? "RFO FAR 12.102(b); RFO FAR 6.104-1; RFO FAR 6.104-2"
            : "RFO FAR 6.104-1; RFO FAR 6.104-2; NFS CG 1806.15(a)",
          field: "jofoc_authority_citation",
          link: "templates",
          templateKey: "jofoc",
        },
      ];
    }
    case "Synopsis": {
      const sole = /sole/i.test(String(acq?.competition ?? ""));
      return [
        sole
          ? {
              label: "Notice of intent to sole source",
              citation: "RFO FAR 5.101(c)(4)(vii)",
              link: "templates",
              templateKey: "sam-notice",
              note: "Allow at least 15 days for responses unless an exception applies.",
            }
          : awardPath(acq) === "simplified" || awardPath(acq) === "negotiated"
            ? {
                // A noncommercial buy has no combined notice: the
                // presolicitation notice goes up first (RFO FAR 5.101).
                label: "Presolicitation notice",
                citation: "RFO FAR 5.101",
                link: "templates",
                templateKey: "sam-notice",
                note:
                  Number(acq?.estimated_value ?? 0) > SIMPLIFIED_ACQUISITION_THRESHOLD
                    ? "Post at least 15 days before the solicitation is issued (RFO FAR 5.101(d), Table 5-2)."
                    : "Post at least 15 days before the solicitation is issued (RFO FAR 5.101(d), Table 5-2), unless the solicitation is posted in the GPE and allows electronic offers (RFO FAR 5.101(b)(1)(i)).",
              }
            : {
                label: "Combined synopsis/solicitation notice",
                citation: "RFO FAR 5.201; RFO FAR 12.202(b)",
                link: "templates",
                templateKey: "sam-notice",
              },
      ];
    }
    case "Solicitation/Quote": {
      const sole = /sole/i.test(String(acq?.competition ?? ""));
      return [
        { label: "NCMS handoff packet", citation: "NFS CG 1804.11(b)", link: "packet" },
        { label: "Funds certified for the period", citation: "31 U.S.C. 1502", field: "funds_certified" },
        ...(sole
          ? [
              {
                label: "Proposed price from the intended source",
                citation:
                  awardPath(acq) === "letter_contract"
                    ? "RFO FAR 16.603-2(c)"
                    : /\b15\b/.test(String(acq?.acquisition_method ?? "")) || awardPath(acq) === "negotiated"
                      ? "RFO FAR 15.201(c)(3)"
                      : simplifiedPriceCite(String(acq?.acquisition_method ?? "")),
                field: "proposed_price",
                note: "Record the price the single source proposed and the date it was received; the technical evaluation report and the price negotiation memorandum read it from here.",
                // On a letter contract the price proposal follows the
                // definitization schedule after award (RFO FAR 16.603-2(c)).
                ...(isLetterContract(acq as Record<string, unknown>)
                  ? {
                      dueAfterAward: true,
                      note: "On a letter contract the price proposal is due on the definitization schedule (RFO FAR 16.603-2(c)); record it here when it arrives.",
                    }
                  : {}),
              } as RequiredDoc,
            ]
          : []),
      ];
    }
    case "Technical Evaluation": {
      // The TER is mandatory only for a sole-source proposal above the SAT.
      // On a competed FAR 13.5 buy the RFO FAR 13.202 evaluation of quotations
      // is the requirement and the TER is offered.
      const terRequired = isTerRequired(acq);
      const path = awardPath(acq);
      // A competed negotiated buy evaluates proposals, not quotations (RFO
      // FAR 15.202); NASA source evaluation boards and teams report under
      // NFS CG 1815.27. The technical evaluation report carries that finding.
      if (!terRequired && path === "negotiated")
        return [
          {
            label: "Evaluation of proposals (SEB or SET report)",
            citation: "RFO FAR 15.202; NFS CG 1815.27",
            link: "templates",
            templateKey: "technical-evaluation-report",
            note: "Evaluate each proposal against the factors and subfactors in the solicitation and record the findings for the source selection authority.",
          },
        ];
      const evalCite = path === "simplified" ? "RFO FAR 13.202" : "RFO FAR 12.203";
      return [
        {
          label: terRequired
            ? "NASA technical evaluation report"
            : "NASA technical evaluation report (offered)",
          citation: terRequired ? "NFS CG 1815.45(b)" : evalCite,
          link: "templates",
          templateKey: "technical-evaluation-report",
          optional: !terRequired,
          note: terRequired
            ? "Required for a sole-source proposal above the simplified acquisition threshold."
            : "Offered on a competed simplified acquisition; the evaluation of quotations below is the requirement.",
        },
        ...(terRequired
          ? []
          : [
              {
                label: "Evaluation of quotations record",
                citation: evalCite,
                link: "templates",
                templateKey: "evaluation-of-quotations",
                note: "Judge each quote against the stated criteria and record who evaluated and why.",
              } as RequiredDoc,
            ]),
      ];
    }
    case "Fair Opportunity": {
      const profile = acquisitionProfile(acq as Record<string, unknown>);
      const value = Number(acq?.estimated_value ?? 0);
      const vehicle = vehicleOf(acq as Record<string, unknown>);
      const exception =
        vehicle.fair_opportunity === "competed" ? null : exceptionLabel(String(vehicle.fair_opportunity));
      const schedule = profile === "fss_order";
      const tier = fairOpportunityTier(value);
      const rows: RequiredDoc[] = [
        {
          label: schedule
            ? "Record of the schedule ordering procedures followed"
            : "Fair opportunity record: every awardee considered",
          citation: schedule ? fssOrderCitation(value) : `RFO FAR 16.507-2(a); ${tier.citation}`,
          docKey: "fair-opportunity-record",
          tab: "010",
          attachOnly: true,
          // With an exception recorded, the exception justification below is
          // the record; no awardee-by-awardee consideration is required.
          ...(exception && !schedule ? { optional: true } : {}),
          note: schedule
            ? "The ordering procedure follows the order value."
            : exception
              ? `Not required: the contracting officer relies on the ${exception.label.toLowerCase()} exception (${exception.citation}), documented in the justification below. ${tier.note}`
              : `Record how each awardee under the vehicle was given a fair opportunity to be considered. ${tier.note}`,
        },
      ];
      if (exception) {
        rows.push(
          exception.key === "brand_name"
            ? {
                label: "Fair opportunity exception: brand name justification",
                citation: exception.citation,
                link: "templates",
                templateKey: "fair-opportunity-brand-name",
              }
            : {
                label: `Fair opportunity exception: ${exception.label.toLowerCase()} justification`,
                citation: exception.citation,
                docKey: `fair-opportunity-${exception.key}`,
                tab: "010",
                attachOnly: true,
              },
        );
      }
      if (schedule && /sole|limited|brand/i.test(String(acq?.competition ?? ""))) {
        rows.push({
          label: "Limited sources justification",
          citation: "RFO FAR 8.401(b); GSAR subpart 538.71",
          docKey: "limited-sources-justification",
          tab: "010",
          attachOnly: true,
        });
      }
      // Small business coordination on an order follows NFS CG 1819.11(a):
      // required over $2,000,000 when not set aside, unless the order is under
      // a single-award vehicle or another listed exception applies.
      const sb = nf1787Trigger((acq ?? {}) as Record<string, unknown>, { micro: MICRO_PURCHASE });
      rows.push({
        label: sb.required
          ? "NF 1787 small business coordination"
          : "NF 1787 small business coordination (Offered, Center practice)",
        citation: NF1787_CITATION,
        link: "form",
        formKey: "nf-1787",
        optional: !sb.required,
        note: `${sb.reason} Companion Guide guidance, not regulation.${sb.advisory ? ` ${sb.advisory}` : ""}`,
      });
      return rows;
    }
    case "Price Reasonableness": {
      const path = awardPath(acq);
      if (path === "letter_contract")
        return [
          {
            label: "Price negotiation memorandum (PNM) for the definitized contract",
            citation: "RFO FAR 15.408-2(a); RFO FAR 16.603-2(c)",
            link: "templates",
            templateKey: "pnm",
            note: definitizationNote(acq),
          },
        ];
      const citation =
        path === "order"
          ? "RFO FAR 16.506(f)"
          : path === "negotiated"
            ? "RFO FAR 15.408-2(a)"
            : path === "simplified"
              ? "RFO FAR 13.203(a)"
              : "RFO FAR 12.204(a)";
      return [
        {
          label: "Price negotiation memorandum (PNM)",
          citation,
          link: "templates",
          templateKey: "pnm",
          note: path === "order"
            ? "The contracting officer determines the order price fair and reasonable under RFO FAR 16.506(f). The PNM is the determination of record."
            : "The PNM is the price reasonableness determination of record. No separate determination is generated.",
        },
      ];
    }
    case "Responsibility Check":
      return [
        {
          label: "SAM.gov entity registration and exclusion results",
          citation: "RFO FAR 9.104-1; RFO FAR 9.405(e); RFO FAR 52.204-7",
          link: "checks",
          note: "Review the exclusion records in SAM after quotes or proposals are received, and again immediately before award (RFO FAR 9.405(e)(1), (4)).",
        },
        {
          label: "Integrity records count (FAPIIS)",
          citation: "RFO FAR 9.104-6",
          link: "checks",
        },
        {
          label: `Contracting officer's signature on the ${awardInstrument(awardPath(acq))}`,
          citation: "RFO FAR 9.105-2(a)(1)",
          link: "packet",
          note: `The contracting officer's signature on the ${awardInstrument(awardPath(acq))} is the affirmative responsibility determination (RFO FAR 9.105-2(a)(1)). A separate memorandum is generated only on a finding of nonresponsibility.`,
        },
      ];
    case REVIEW_PHASE:
      return [{ label: "A recorded decision from every required reviewer", citation: "Center policy" }];
    case "Award": {
      const profile = acquisitionProfile(acq as Record<string, unknown>);
      if (isOrderProfile(profile))
        return [
          {
            label: "NCMS handoff packet in order form",
            citation: "NFS CG 1804.11(b)",
            link: "packet",
            note: "The order document of record is written in NCMS from this packet.",
          },
          {
            label: "Order document signed (written in NCMS)",
            citation: profile === "fss_order" ? "RFO FAR 8.401(b); GSAR subpart 538.71" : "RFO FAR 16.506",
            link: "packet",
          },
        ];
      if (profile === "bpa")
        return [
          { label: "NCMS handoff packet", citation: "NFS CG 1804.11(b)", link: "packet" },
          { label: "Blanket purchase agreement signed (written in NCMS)", citation: "RFO FAR 12.201-1(e)(3)(iv)", link: "packet" },
        ];
      const path = awardPath(acq);
      const award: RequiredDoc =
        path === "letter_contract"
          ? {
              label: "Letter contract with the definitization schedule (written in NCMS)",
              citation: "RFO FAR 16.603-2(c)",
              link: "packet",
              note: "The schedule provides for definitization within 180 days after the date of the letter contract or before 40 percent of the work is complete, whichever comes first (RFO FAR 16.603-2(c)).",
            }
          : path === "negotiated"
            ? { label: "Award document: OF 307, SF 26 or SF 33 (written in NCMS)", citation: "RFO FAR 15.207-1(b)(1)", link: "packet" }
            : path === "simplified"
              ? { label: "OF 347 purchase order (written in NCMS)", citation: "RFO FAR 13.203(c)", link: "packet" }
              : { label: "SF 1449 award document (written in NCMS)", citation: "RFO FAR 12.204(c)(1)", link: "packet" };
      return [{ label: "NCMS handoff packet", citation: "NFS CG 1804.11(b)", link: "packet" }, award];
    }
    case "FPDS-NG Report":
      return [{ label: "FPDS-NG contract action report", citation: "RFO FAR 4.301" }];
    case "Administration":
      return [
        {
          label: "CPARS past performance evaluation",
          citation: "RFO FAR 42.1102(a), (b)(1)",
          link: "templates",
          templateKey: "cpars-input",
          // RFO FAR 42.1102(b)(1): evaluations are required for each contract
          // and order above the SAT; at or below it the row is offered.
          ...(Number(acq?.estimated_value ?? 0) > 0 && Number(acq?.estimated_value ?? 0) <= SIMPLIFIED_ACQUISITION_THRESHOLD
            ? {
                optional: true,
                note: "Offered: past performance evaluations are required for contracts and orders above the simplified acquisition threshold (RFO FAR 42.1102(b)(1)).",
              }
            : {}),
        },
        // RFO FAR 1.404(b): a COR is assigned on every contract or order other
        // than firm-fixed-price; on a firm-fixed-price one the CO may assign one.
        isFirmFixedPriceOnly(acq)
          ? {
              label: "COR appointment letter",
              citation: "RFO FAR 1.404(b); NFS CG 1801.42(b) (NF 1634)",
              link: "templates" as const,
              templateKey: "cor-appointment",
              optional: true,
              note: "Firm-fixed-price on the record: the contracting officer may assign a COR but is not required to (RFO FAR 1.404(b)).",
            }
          : {
              label: "COR appointment letter",
              citation: "RFO FAR 1.404(b); NFS CG 1801.42(b) (NF 1634)",
              link: "templates" as const,
              templateKey: "cor-appointment",
            },
        // Option rows appear only where the record carries option periods.
        ...(hasOptionPeriods(acq)
          ? [
              {
                label: "Option exercise: preliminary notice to the contractor",
                citation: "RFO FAR 17.204-1(b)(1)",
                link: "templates" as const,
                templateKey: "option-exercise-notification",
                optional: true,
                note: "The record carries option periods.",
              },
              {
                label: "Option exercise: determination to exercise",
                citation: "RFO FAR 17.204-1(b)",
                link: "templates" as const,
                templateKey: "option-exercise-determination",
                optional: true,
                note: "The record carries option periods.",
              },
            ]
          : []),
        ...(acquisitionProfile(acq as Record<string, unknown>) === "bpa"
          ? [
              {
                label: "Annual review of the blanket purchase agreement",
                citation: "RFO FAR 12.201-1(e)(3)(v)",
                docKey: "bpa-annual-review",
                tab: "110",
                attachOnly: true,
                note: "Review the agreement at least once a year: prices, sources, and whether it is still advantageous.",
              } as RequiredDoc,
            ]
          : []),
        {
          label: "SF 30 modification handoff packet",
          citation: "RFO FAR 43.401; NFS CG 1804.11(b)",
          link: "packet",
          note: "The modification of record is written in NCMS. T-Minus hands over the facts and the clause delta.",
        },
      ];
    case "Closeout":
      return [
        {
          label: "Closeout Transfer Checklist",
          citation: "RFO FAR 4.308-1",
          link: "templates",
          templateKey: "closeout-checklist",
        },
        {
          label: "Closeout record: deobligation, final invoice, release of claims, property",
          citation: "RFO FAR 4.308-1(a)",
          docKey: "closeout-record",
          tab: "120",
          note: isCostType(acq?.contract_type)
            ? "Entered on the closeout panel of this file; the checklist reads those values. A contract requiring settlement of indirect cost rates is closed within 36 months of the month the contracting officer receives evidence of physical completion (RFO FAR 4.308-2(b), Table 4-2(3))."
            : "Entered on the closeout panel of this file; the checklist reads those values.",
        },
        { label: "Contract file complete and retained", citation: "RFO FAR 4.101; RFO FAR 4.309" },
      ];
    default:
      return [];
  }
}

/** The key an attachment is stored under for a required-document row. */
export function docRowKey(doc: RequiredDoc): string {
  return doc.docKey ?? doc.field ?? doc.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * The generator key for a row T-Minus writes itself: the template or the form
 * that produces the document. A row with a generator is satisfied by a saved
 * version, never by an upload of something the app writes.
 */
export function generatorKey(doc: RequiredDoc): string | null {
  return doc.templateKey ?? doc.formKey ?? null;
}

export function docSatisfied(
  doc: RequiredDoc,
  acq: AcqRow,
  hasFile?: boolean,
  savedKeys?: Set<string>,
): boolean | null {
  // A document the app generates reads from its saved versions. An external
  // copy attached against the same row counts too.
  const generator = generatorKey(doc);
  if (generator) {
    if (!savedKeys) return hasFile ? true : null;
    return savedKeys.has(generator) || Boolean(hasFile);
  }
  // The T&M or labor-hour ceiling price reads from the record or from an
  // attached page of the contract that states it.
  if (doc.docKey === "tm-ceiling-price") {
    if (tmCeilingPrice(acq) > 0 || hasFile === true) return true;
    return hasFile === undefined ? null : false;
  }
  // A row whose template is still planned, or whose document of record is
  // produced elsewhere, reads from the external copy attached against it.
  if (doc.attachOnly) return hasFile === undefined ? null : hasFile;
  if (!doc.field) return null;
  // The proposed price is a value on the record, not a file. It reads from the
  // record whatever the attachment state is.
  if (doc.field === "proposed_price") return Number(acq['proposed_price'] ?? 0) > 0;
  // Funds certified is a certification on the record under 31 U.S.C. 1502, not
  // a stored file. It reads from the record whatever the attachment state is,
  // and accepts the answer however the record carries it.
  if (doc.field === "funds_certified") {
    const raw: unknown = acq['funds_certified'];
    return raw === true || /^(true|yes|1)$/i.test(String(raw ?? ""));
  }
  // A stored file is the only thing that makes a row read Attached. When the
  // caller knows whether a file exists, that answer decides.
  if (hasFile !== undefined) return hasFile;
  const v = acq[doc.field];
  if (doc.field === "jofoc_authority_citation") return Boolean(String(v ?? "").trim());
  // A null value means the record has never carried this answer, which is not
  // the same as a document that was removed. Only an explicit false holds.
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

// ------------------------------------------------------------------ reviews

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function answeredYes(acq: AcqRow, needle: RegExp) {
  const answers = acq.nf1707_answers;
  if (!answers || typeof answers !== "object") return false;
  // The seeded answers hold the section code in the key ("S5V") or inside the
  // recorded answer text ("S5Vn2 YES: ..."), so both are checked.
  return Object.entries(answers as Record<string, unknown>).some(
    ([k, v]) =>
      (needle.test(k) || needle.test(String(v))) &&
      (v === "1" || v === true || /yes/i.test(String(v))),
  );
}

/** Evaluate a review_rules row against the record. Citation, days, and the
 *  trigger text always come from the row, never from here. */
export function reviewApplies(rule: ReviewRuleRow, acq: AcqRow, ref: RefData): boolean {
  const role = rule.reviewer_role.toLowerCase();
  const value = num(acq.estimated_value);
  const center = (acq['center_code'] ?? null) as string | null;
  // A Center configuration row, when one is in effect, replaces the value the
  // rule would otherwise read from the thresholds table.
  const ovThr = (name: string) => overrideValue(ref.overrides, center, "threshold", name);
  const thr = (name: string) =>
    ovThr(name) ??
    ref.thresholds.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase())?.value ??
    null;
  const trigger = overrideValue(ref.overrides, center, "review_trigger", rule.reviewer_role);
  const sat = thr("Simplified acquisition threshold") ?? 350_000;
  const micro = thr(MICRO_PURCHASE_THRESHOLD_NAME) ?? MICRO_PURCHASE_THRESHOLD;
  // The award date picks the figure: the statute's $10,000,000 for contracts
  // entered into after June 30, 2026, else the RFO FAR 15.403-3(a) $2.5 million.
  const certifiedBasis = certifiedDataBasis(acq as Record<string, unknown>, ref.thresholds, {
    farText: thr(CERTIFIED_FAR_TEXT_NAME),
    statute: thr(CERTIFIED_STATUTE_NAME),
  });
  const certified = certifiedBasis.threshold;
  const jofoc = Boolean(String(acq.jofoc_authority_citation ?? "").trim());

  if (role.startsWith("legal review")) return jofoc || value >= (trigger ?? sat);
  if (role.startsWith("pricing review"))
    return /cost/i.test(String(acq.contract_type ?? "")) ||
      (trigger !== null && trigger !== undefined
        ? value >= trigger
        : certifiedBasis.rule === "statute"
          ? value > certified
          : value >= certified);
  // Small business coordination follows NFS CG 1819.11(a): over $2,000,000
  // and not set aside, an out-of-scope modification, or bundling or
  // consolidation, less the (a)(2) exceptions. A Center trigger, when one is
  // configured, replaces it.
  if (role.startsWith("small business"))
    return trigger !== null && trigger !== undefined
      ? value > trigger
      : nf1787Trigger(acq as Record<string, unknown>, { micro }).required;
  if (role.startsWith("procurement strategy meeting")) return value > (trigger ?? 10_000_000);
  if (role.includes("notification of procurement action"))
    return value >= (trigger ?? 7_000_000) && value < 30_000_000;
  if (role.startsWith("anosca")) return value >= (trigger ?? 30_000_000);
  if (role.startsWith("cio authorization")) return Boolean(acq.includes_it);
  if (role.startsWith("public announcement")) return value >= 7_000_000 && /8\(a\)/i.test(String(acq.set_aside ?? ""));
  if (role.startsWith("enterprise strategy"))
    return (
      value > sat &&
      Boolean(matchStrategy(ref, `${acq.title ?? ""} ${acq.description_of_requirement ?? ""}`))
    );
  if (role.startsWith("flight operations")) return /A-102\.7/i.test(String(acq.enterprise_psl_check ?? ""));
  if (role.startsWith("aviation safety")) return answeredYes(acq, /S5Vn2/i);
  if (role.startsWith("section 508")) return Boolean(acq.includes_it);
  if (role.startsWith("quality assurance")) return Boolean(acq.hardware_deliverable);
  if (role.startsWith("sources sought")) return value >= 50_000_000;
  return false;
}

/** Phases that require a recorded decision from reviewers. */
export const REVIEW_PHASES = ["JOFOC", REVIEW_PHASE] as const;

/** Short plain word for a reviewer role, used in hold text: "legal", "pricing". */
export function shortRole(role: string): string {
  const head = role.split(/\(|,|\//)[0] ?? role;
  return head.replace(/review|coordination|authorization|meeting/gi, "").trim().toLowerCase() || role.toLowerCase();
}

/** The role name the JOFOC approving official votes under. */
export const JOFOC_APPROVER_ROLE = "JOFOC approving official";

/**
 * The approval level RFO FAR 6.104-2 Table 6-1 sets for this file's value, and the
 * office that holds it. The dollar tiers come from the thresholds table.
 */
export function jofocApprovalTier(
  acq: AcqRow,
  ref: RefData,
): { tierLabel: string; title: string } {
  const thr = (name: string, fallback: number) =>
    ref.thresholds.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase())?.value ?? fallback;
  const co = thr("JOFOC approval tier: contracting officer certification", 900_000);
  const ca = thr("JOFOC approval tier: competition advocate", 20_000_000);
  const hca = thr("JOFOC approval tier: head of contracting activity (NASA)", 150_000_000);
  const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;
  const value = num(acq.estimated_value);
  if (value <= co) return { tierLabel: `Up to ${dollars(co)}`, title: "Contracting Officer" };
  if (value <= ca)
    return { tierLabel: `Over ${dollars(co)} to ${dollars(ca)}`, title: "Competition Advocate" };
  if (value <= hca)
    return { tierLabel: `Over ${dollars(ca)} to ${dollars(hca)}`, title: "Head of Contracting Activity" };
  return { tierLabel: `Over ${dollars(hca)}`, title: "Senior Procurement Executive" };
}

/** True on a sole-source file that carries a JOFOC authority. */
function hasJofoc(acq: AcqRow): boolean {
  return (
    /sole/i.test(String(acq.competition ?? "")) &&
    Boolean(String(acq.jofoc_authority_citation ?? "").trim())
  );
}

/** Which review rules apply to a given phase of this acquisition. */
export function reviewRulesForPhase(
  phase: string,
  acq: AcqRow,
  rules: ReviewRuleRow[],
  ref: RefData,
): ReviewRuleRow[] {
  const applicable = rules.filter((r) => reviewApplies(r, acq, ref));
  if (phase === "JOFOC") return applicable.filter((r) => /^legal review/i.test(r.reviewer_role));
  if (phase === REVIEW_PHASE) {
    if (!hasJofoc(acq)) return applicable;
    // A sole-source file carries the JOFOC approving official as a reviewer.
    // The office comes from the Center routing table entry for the JOFOC,
    // which points at the RFO FAR 6.104-2 Table 6-1 level for the value.
    const tier = jofocApprovalTier(acq, ref);
    return [
      ...applicable,
      {
        rule_id: "jofoc-approving-official",
        reviewer_role: JOFOC_APPROVER_ROLE,
        trigger: "Sole source with a justification on the file",
        citation: "RFO FAR 6.104-2 Table 6-1",
        planned_days: null,
        note: `${tier.tierLabel}: ${tier.title}.`,
      },
    ];
  }
  return [];
}

/** Which phase a template's document belongs to. */
export function phaseForTemplate(templateKey: string): string {
  if (templateKey === "jofoc") return "JOFOC";
  if (templateKey === "nf-1707") return "Intake";
  if (templateKey === "sam-notice") return "Synopsis";
  if (
    templateKey === "tech-eval" ||
    templateKey === "technical-evaluation-report" ||
    templateKey === "evaluation-of-quotations"
  )
    return "Technical Evaluation";
  if (templateKey === "nonresponsibility") return "Responsibility Check";
  if (templateKey === "pnm") return "Price Reasonableness";
  if (
    templateKey === "commerciality" ||
    templateKey === "fair-opportunity-brand-name" ||
    templateKey === "consolidation-determination" ||
    templateKey === "bundling-determination" ||
    templateKey === "economy-act-determination" ||
    templateKey === "commercial-tm-lh-determination"
  )
    return "Market Research";
  if (templateKey === "written-acquisition-plan" || templateKey === "psm-executive-presentation" ||
    templateKey === "psm-signature-page" || templateKey === "psm-addendum" ||
    templateKey === "asm-not-conducted" || templateKey === "rdt-request-appointment")
    return "Intake";
  if (HQ_TEMPLATE_KEYS.includes(templateKey)) return "Market Research";
  if (templateKey === "npa-notification") return "Intake";
  if (templateKey === "jofoc-8a-over-30m" || templateKey === "jofoc-urgency" || templateKey === "limited-sources-justification")
    return "JOFOC";
  if (
    templateKey === "gfp-determination" ||
    templateKey === "uca-letter-contract" ||
    templateKey === "precontract-costs-approval"
  )
    return "Solicitation/Quote";
  if (HQ5_PHASES[templateKey]) return HQ5_PHASES[templateKey] as string;
  if (HQ6_PHASES[templateKey]) return HQ6_PHASES[templateKey] as string;
  if (HQ6B_PHASES[templateKey]) return HQ6B_PHASES[templateKey] as string;
  if (HQ6C_PHASES[templateKey]) return HQ6C_PHASES[templateKey] as string;
  if (HQ4_TEMPLATE_KEYS.includes(templateKey)) return "Market Research";
  if (templateKey === "option-justification") return "Solicitation/Quote";
  if (templateKey === "option-exercise-determination" || templateKey === "option-exercise-notification")
    return "Administration";
  if (templateKey === "cor-appointment" || templateKey === "cor-cancellation" || templateKey === "cpars-input")
    return "Administration";
  if (templateKey === "closeout-checklist") return "Closeout";
  // A memorandum for record belongs to the file, not to a phase.
  if (templateKey === "memorandum-for-record") return "Intake";
  return REVIEW_PHASE;
}

export type BoardEntry = {
  poll_id: string | null;
  phase: string;
  reviewer_role: string;
  reviewer_name: string;
  /** Outcome class of the recorded decision: favorable, unfavorable or pending. */
  vote: ReviewOutcome;
  /** The formal decision, read from the stored value (legacy go/no-go included). */
  decision: ReviewDecision | null;
  /** Review type: legal, small business, approval or concurrence. */
  kind: ReviewKind;
  reason: string | null;
  due_date: string | null;
  planned_days: number | null;
  citation: string | null;
  trigger: string | null;
  note: string | null;
};

export type ReviewerPerson = { name: string; title?: string | null; center_code?: string | null };

/**
 * The office that holds each review. A review belongs to a role, never to a
 * person by default; the person is whoever holds that role at the Center.
 */
export function reviewerTitleForRole(role: string): string {
  const r = role.toLowerCase();
  if (/legal|counsel/.test(r)) return "Center Chief Counsel";
  if (/small business/.test(r)) return "Center Small Business Specialist";
  if (/flight operations|aviation/.test(r)) return "Flight Operations Office";
  if (/enterprise strategy/.test(r)) return "OP enterprise strategy owner";
  if (/pricing/.test(r)) return "Center Pricing Officer";
  if (/quality/.test(r)) return "Center Quality Assurance Officer";
  if (/508|cio|ocio|it authorization|security/.test(r)) return "Center Chief Information Officer";
  if (/anosca|npa|announcement|notification|sources sought/.test(r)) return "Center Procurement Officer";
  if (/procurement strategy|acquisition plan/.test(r)) return "Center Procurement Officer";
  return role;
}

/**
 * The person holding a review, looked up by role from the Center's reviewer
 * table. When nobody holds the role the row names the role, never a person who
 * happens to be a reviewer elsewhere.
 */
export function reviewerNameForRole(
  role: string,
  center: string | null = null,
  roster: ReviewerPerson[] = [],
): string {
  const title = reviewerTitleForRole(role).toLowerCase();
  const match = (p: ReviewerPerson) => (p.title ?? "").trim().toLowerCase() === title;
  const atCenter = roster.find((p) => match(p) && (p.center_code ?? "") === (center ?? ""));
  const anywhere = atCenter ?? roster.find((p) => match(p) && (p.center_code ?? "") === "HQ");
  return anywhere?.name ?? `Unassigned, role: ${reviewerTitleForRole(role)}`;
}

/** The person holding a given title at this Center, when the roster has one. */
function reviewerNameForTitle(
  title: string,
  center: string | null,
  roster: ReviewerPerson[],
): string | null {
  const want = title.trim().toLowerCase();
  const match = (p: ReviewerPerson) => (p.title ?? "").trim().toLowerCase() === want;
  const atCenter = roster.find((p) => match(p) && (p.center_code ?? "") === (center ?? ""));
  return (atCenter ?? roster.find((p) => match(p) && (p.center_code ?? "") === "HQ"))?.name ?? null;
}

export function pollBoard(
  acq: AcqRow,
  rules: ReviewRuleRow[],
  polls: PollRow[],
  ref: RefData,
  dueDate: string | null,
  phase: string = REVIEW_PHASE,
  roster: ReviewerPerson[] = [],
): BoardEntry[] {
  const forPhase = polls.filter((p) => phaseAlias(p.phase ?? REVIEW_PHASE) === phase);
  const center = (acq['center_code'] ?? null) as string | null;
  return reviewRulesForPhase(phase, acq, rules, ref).map((r) => {
    const sameRole = (p: PollRow) =>
      (p.reviewer_role ?? "").toLowerCase() === r.reviewer_role.toLowerCase();
    // A legal decision already recorded at the justification stands on the
    // reviews and approvals board rather than being asked for twice.
    const carried =
      phase === REVIEW_PHASE && /^legal review/i.test(r.reviewer_role)
        ? polls.find((p) => sameRole(p) && isDecided(p.vote))
        : undefined;
    const row = forPhase.find(sameRole) ?? carried;
    const kind = reviewKindFor(r.reviewer_role);
    const decision = normalizeDecision(row?.vote, kind);
    const vote = decisionOutcome(decision);
    // The role decides the person. A name stored on a cast vote stands, because
    // that person actually voted; an unvoted row always reads from the roster.
    const tier = r.reviewer_role === JOFOC_APPROVER_ROLE ? jofocApprovalTier(acq, ref) : null;
    const byRole = tier
      ? (tier.title === "Contracting Officer" ? String(acq['co_name'] ?? "").trim() : "") ||
        reviewerNameForTitle(tier.title, center, roster) ||
        tier.title
      : reviewerNameForRole(r.reviewer_role, center, roster);
    const voted = vote !== "pending";
    return {
      poll_id: row?.poll_id ?? null,
      phase,
      reviewer_role: r.reviewer_role,
      reviewer_name: (voted ? row?.reviewer_name : null) ?? byRole,
      vote,
      decision,
      kind,
      reason: row?.reason ?? null,
      due_date: row?.due_date ?? dueDate,
      planned_days: r.planned_days,
      citation: reviewCitationForDisplay(r.reviewer_role, r.citation),
      trigger: r.trigger,
      note: r.note,
    };
  });
}

// ------------------------------------------------------------------ sequence

export type PhaseView = {
  phase: string;
  planned_days: number;
  order: number;
  status: "complete" | "current" | "upcoming";
  actual_days: number | null;
  docs: RequiredDoc[];
  citation: string;
  guidance: string;
  needsPoll: boolean;
  /**
   * Display name where it differs from the stored phase name. On a letter
   * contract the Price Reasonableness phase after Award is the definitization
   * window (RFO FAR 16.603-2(c)). The stored name stays in phase.
   */
  label?: string;
  /**
   * Before award, the rows in this phase whose justification and approval may
   * be made after award (urgency, RFO FAR 6.103-2(d)). Neither these rows nor
   * this phase's reviews block exit or award.
   */
  followsAward?: string[];
  /**
   * On a phase the file has moved past: the required rows still unmet. Such a
   * phase never reads Complete; it reads Required item open until they are met.
   */
  openRequired?: string[];
};

/** True when a phase is past and every required row in it is met. */
export const phaseDone = (p: Pick<PhaseView, "status" | "openRequired">): boolean =>
  p.status === "complete" && !(p.openRequired && p.openRequired.length);

/** The state word for a phase: Complete, Required item open, In work or Not started. */
export const phaseStateWord = (p: Pick<PhaseView, "status" | "openRequired">): string =>
  p.status === "complete"
    ? phaseDone(p)
      ? "Complete"
      : "Required item open"
    : p.status === "current"
      ? "In work"
      : "Not started";

/** The JOFOC step's plain guidance, matched to the document this file needs. */
export function jofocGuidance(acq?: AcqRow | null): string {
  const kind = simplifiedSoleSource(acq);
  if (kind === "noncommercial")
    return "Sole source at or under the simplified acquisition threshold on simplified procedures. Write the determination and findings that only one source is reasonably available. No Part 6 justification and approval applies.";
  if (kind === "commercial")
    return "Commercial sole source at or under the simplified acquisition threshold. Document that only one source is available and the basis for it. No Part 6 justification and approval applies.";
  if (commercialSimplifiedOverSat(acq))
    return "Commercial sole source over the simplified acquisition threshold on simplified procedures. Write the justification, cite 41 U.S.C. 1901, and route it for the approval its dollar tier calls for.";
  return PHASE_GUIDANCE["JOFOC"] ?? "";
}

/** The name a phase is shown under; the stored name when no display name is set. */
export const phaseLabel = (p: Pick<PhaseView, "phase" | "label">): string => p.label ?? p.phase;

/**
 * Days the phase has run past its planned days, or null when it has not (or
 * its start is not recorded). The rail, the file page action line and the
 * launch sequence "(N over)" all read this one number.
 */
export function phaseOverrunDays(p: Pick<PhaseView, "actual_days" | "planned_days">): number | null {
  if (p.actual_days === null) return null;
  const over = p.actual_days - p.planned_days;
  return over > 0 ? over : null;
}

export function buildSequence(
  acq: AcqRow,
  plan: PhasePlanRow[],
  todayISO: string,
  daysBetween: (a: string, b: string) => number,
  /**
   * What the caller knows about documents: which rows have a stored file and
   * which generated documents have a saved version. A phase behind the current
   * one reads In work while one of its required documents is still missing.
   */
  known?: { attachedKeys?: Set<string> | undefined; savedKeys?: Set<string> | undefined },
): PhaseView[] {
  const type = acquisitionType(acq, plan);
  const rows = plan
    .filter((p) => p.acquisition_type === type && p.phase)
    .map((p) => ({ ...p, phase: phaseAlias(p.phase) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const currentIndex = rows.findIndex(
    (r) => (r.phase ?? "").toLowerCase() === String(phaseAlias(acq.current_phase) ?? "").toLowerCase(),
  );
  const baseline = acq.regulatory_baseline_date ?? null;
  const elapsed = baseline ? Math.max(0, daysBetween(baseline, todayISO)) : null;
  // The recorded day each phase began (from the phase-exit audit rows, see
  // phaseEntryDates). Where the file has any recorded phase change, phase days
  // are measured from those real dates, and the first phase starts on the day
  // the file was created. A file with no recorded change keeps the
  // baseline-anchored estimate for its current phase, and no completed phase is
  // ever given a made-up duration.
  const enteredRaw = (acq as Record<string, unknown>)["__phase_entered_at"];
  const entered: Record<string, string> =
    enteredRaw && typeof enteredRaw === "object" ? (enteredRaw as Record<string, string>) : {};
  const recordedPhases = Object.keys(entered).length > 0;
  const createdRaw = (acq as Record<string, unknown>)["created_at"];
  const createdDay = typeof createdRaw === "string" && createdRaw ? dateCT(createdRaw) : null;
  const startOf = (i: number): string | null => {
    const name = String(rows[i]?.phase ?? "").toLowerCase();
    if (entered[name]) return entered[name]!;
    return i === 0 && recordedPhases ? createdDay : null;
  };

  const clockNow = String(acq.clock_state ?? "").toLowerCase();
  const unmet = (docs: RequiredDoc[]): RequiredDoc[] => {
    if (!known) return [];
    return docs.filter((d) => {
      if (d.optional) return false;
      if (d.dueAfterAward && clockNow !== "launched") return false;
      if (d.mayFollowAward && clockNow !== "launched") return false;
      if (generatorKey(d) && !d.field && !known.savedKeys) return false;
      const hasFile = known.attachedKeys ? known.attachedKeys.has(docRowKey(d)) : undefined;
      return docSatisfied(d, acq, hasFile, known.savedKeys) === false;
    });
  };
  const unfinished = (_phase: string, docs: RequiredDoc[]) => unmet(docs).length > 0;

  const planPhases = rows.map((r) => r.phase as string);
  const docsFor = rows.map((r) => requiredDocs(r.phase as string, acq, planPhases));

  // A phase is exited only when every required row in it is saved or attached.
  // Where an earlier phase is still short a document, the file sits in that
  // phase: the later phases have not started and their clocks do not run.
  // Drafting a later document early is allowed; the order is enforced here.
  const earliestOpen = rows.findIndex((r, i) => unfinished(r.phase as string, docsFor[i] ?? []));

  // Only a launched clock, which the operational normalizer sets only from a
  // Launched audit row, is past award. A scrubbed file keeps its recorded phase.
  const clockState = String(acq.clock_state ?? "").toLowerCase();
  const postAward = clockState === "launched";
  const indexOfPhase = (name: string) =>
    rows.findIndex((r) => (r.phase ?? "").toLowerCase() === name.toLowerCase());

  let effectiveIndex: number;
  if (postAward) {
    const adminIndex = indexOfPhase("Administration");
    const closeoutIndex = indexOfPhase("Closeout");
    const awardIndex = indexOfPhase("Award");
    // A phase the plan places after Award (the definitization window on a
    // letter contract, RFO FAR 16.603-2(c)) is a post-award phase too.
    const afterAward = awardIndex >= 0 && currentIndex > awardIndex;
    if (currentIndex >= 0 && (afterAward || currentIndex === closeoutIndex || currentIndex >= adminIndex)) {
      effectiveIndex = currentIndex;
    } else {
      effectiveIndex = adminIndex >= 0 ? adminIndex : closeoutIndex >= 0 ? closeoutIndex : currentIndex;
    }
  } else {
    // The recorded phase on the file is the single source of truth while the
    // clock runs. An earlier phase still short a document is shown honestly in
    // the sequence, but it never pulls the current marker backwards: every desk
    // (Work Queue, Overview, Today, file header) must read the same phase the
    // file itself reads.
    effectiveIndex = currentIndex >= 0 ? currentIndex : earliestOpen;
  }


  let cumulative = 0;
  return rows.map((r, i) => {
    const planned = r.planned_days ?? 0;
    const before = cumulative;
    cumulative += planned;
    const phaseName = r.phase as string;
    const docs = docsFor[i] ?? [];
    const status: PhaseView["status"] =
      effectiveIndex < 0
        ? "upcoming"
        : i < effectiveIndex
          ? "complete"
          : i === effectiveIndex
            ? "current"
            : "upcoming";
    let actual: number | null = null;
    if (status === "complete") {
      // Only real recorded dates: the day this phase began to the day the next began.
      const start = startOf(i);
      const end = startOf(i + 1);
      actual = start && end ? Math.max(0, daysBetween(start, end)) : null;
    }
    if (status === "current") {
      const start = startOf(i);
      if (start) actual = Math.max(0, daysBetween(start, todayISO));
      else if (!recordedPhases && elapsed !== null) actual = Math.max(0, elapsed - before);
    }
    const phase = phaseName;
    const awardAt = rows.findIndex((row) => String(row.phase ?? "").toLowerCase() === "award");
    const definitization =
      phase === "Price Reasonableness" && awardAt >= 0 && i > awardAt && isLetterContract(acq as Record<string, unknown>);
    const followsAward = clockNow !== "launched" ? docs.filter((d) => d.mayFollowAward).map((d) => d.label) : [];
    const openRequired = status === "complete" ? unmet(docs).map((d) => d.label) : [];
    return {
      phase,
      ...(definitization ? { label: "Definitization (price reasonableness)" } : {}),
      ...(phase === "JOFOC" ? simplifiedSoleLabel(acq) : {}),
      ...(followsAward.length ? { followsAward } : {}),
      ...(openRequired.length ? { openRequired } : {}),
      planned_days: planned,
      order: r.order ?? i + 1,
      status,
      actual_days: actual,
      docs,
      citation: phaseCitation(phase, acq),
      guidance: phase === "JOFOC" ? jofocGuidance(acq) : (PHASE_GUIDANCE[phase] ?? ""),
      needsPoll: phase === REVIEW_PHASE,
    };
  });
}

// --------------------------------------------------------------------- hold

export type HoldCause = { reason: string; owner: string; doc?: { phase: string; label: string } } | null;

/**
 * The cause holding this file, recomputed from the record every time.
 *
 * When the caller knows which documents have a stored file, that set decides
 * whether a row counts as attached, so a hold reason never survives the file
 * that cleared it.
 */
export function computeHold(
  acq: AcqRow,
  phases: PhaseView[],
  board: BoardEntry[],
  attachedKeys?: Set<string>,
  savedKeys?: Set<string>,
): HoldCause {
  const owner = acq.co_name ? `Contracting officer: ${acq.co_name}` : "Contracting officer";
  const currentIndex = phases.findIndex((p) => p.status === "current");
  const throughCurrent = currentIndex < 0 ? phases : phases.slice(0, currentIndex + 1);

  for (const p of throughCurrent) {
    for (const d of p.docs) {
      if (d.optional) continue;
      // A row due after award (a justification posting, an urgency
      // justification made after award) never holds the file before award.
      if (d.dueAfterAward && String(acq.clock_state ?? "").toLowerCase() !== "launched") continue;
      // A row the app generates only holds the file where the record already
      // carried that answer; an unwritten optional draft never places a hold.
      if (generatorKey(d) && !d.field) continue;
      const hasFile = attachedKeys ? attachedKeys.has(docRowKey(d)) : undefined;
      if (docSatisfied(d, acq, hasFile, savedKeys) === false)
        return { reason: `${phaseLabel(p)}: ${d.label} is missing`, owner, doc: { phase: p.phase, label: d.label } };
    }
  }

  // Disapprove, Not legally sufficient or Nonconcur holds the file at once,
  // whichever review phase it came from.
  const nogo = board.find((b) => b.vote === "unfavorable");
  if (nogo)
    return {
      reason: `${nogo.decision ? DECISION_LABEL[nogo.decision] : "Nonconcur"}: ${shortRole(nogo.reviewer_role)}${nogo.reason ? `: ${nogo.reason}` : ""}`,
      owner: `${nogo.reviewer_name} (${nogo.reviewer_role})`,
    };

  // A decision still open when its phase has been left holds the file too.
  const indexOf = (phase: string) => phases.findIndex((p) => p.phase === phase);
  const pending = board.find((b) => {
    const i = indexOf(b.phase);
    // Reviews of a justification that may follow award (RFO FAR 6.103-2(d)) do not hold the file before award.
    if (i >= 0 && phases[i]?.followsAward?.length) return false;
    return b.vote === "pending" && i >= 0 && currentIndex > i;
  });
  if (pending)
    return {
      reason: `${stepLabel(pending.phase, acq)}: ${pending.reviewer_role} has not recorded a decision`,
      owner: `${pending.reviewer_name} (${pending.reviewer_role})`,
    };
  return null;
}

// ------------------------------------------------------------- NCMS packet

/** Commercial simplified-procedures clause set. Numbers only; the status,
 *  date, and disposition are read from the clauses table. RFO FAR 52.212-5 is
 *  Reserved and is never included, and so are the other numbers Reserved in
 *  RFO FAR Part 52. */
export const PACKET_CLAUSE_NUMBERS = [
  "52.204-7",
  "52.204-13",
  "52.209-6",
  "52.212-1",
  "52.212-4",
  "52.219-6",
  "52.222-3",
  "52.232-33",
  "52.233-3",
  "52.233-4",
  "52.247-34",
  "1852.203-70",
  "1852.240-76",
  "1852.245-70",
];

export const NCMS_CHECKLIST = [
  "Create the solicitation or award in NCMS from these facts.",
  "Insert the clause list below, with fill-ins, in the SF 1449 streamlined format.",
  "Attach the SOW or PWS, the IGCE, and the evaluation criteria.",
  "Enter the funding line and the requisition number.",
  "Route for the signatures NCMS requires; NCMS holds the document of record.",
];

export function buildPacket(
  acq: AcqRow,
  clauses: { clause_number: string | null; title: string | null; ucf_section: string | null; source: string | null; status: string | null; effective_date: string | null; fill_ins: unknown }[],
  phases: PhaseView[],
  board: BoardEntry[],
) {
  return {
    generated: new Date().toISOString(),
    note: "T-Minus handoff packet. NCMS is the contract writing system of record (NFS CG 1804.11(b)). This packet is not the solicitation or the contract.",
    clause_policy_note: "RFO FAR 52.212-5 is Reserved under the RFO / PCD 26-03B; commercial clause content is prescribed via FAR Tables 12-2 and 12-3 and each clause's own prescription. Offeror reps/certs are made in SAM (with RFO FAR 52.204-7), not by packing RFO FAR 52.212-3. Neither 52.212-3 nor 52.212-5 is recommended, offered, or apply-able.",
    acquisition: acq,
    clauses,
    checklist: NCMS_CHECKLIST,
    record_to_date: phases.map((p) => ({
      phase: p.phase,
      status: p.status,
      planned_days: p.planned_days,
      actual_days: p.actual_days,
      required_documents: p.docs
        .filter((d) => !d.optional)
        .map((d) => `${d.label} (${d.citation})`),
      offered_documents: p.docs.filter((d) => d.optional).map((d) => `${d.label} (${d.citation})`),
    })),
    reviews: board,
  };
}

/**
 * A seeded review row's citation as the board shows it. Retired NFS numbers
 * (1819.202-70, struck by PCD 25-48A, and 1801.770, not in the interim NFS or
 * the Companion Guide) are dropped, and a Center review-chain row is labeled
 * as Center practice rather than a regulatory requirement.
 */
export function reviewCitationForDisplay(role: string, citation: string | null | undefined): string {
  const raw = String(citation ?? "");
  let c = raw
    .replace(/NFS 1819\.202-70;?\s*/g, "")
    .replace(/NFS 1801\.770 \(legal review\);?\s*/g, "")
    .replace(/NFS CG 1819\.11(?!\()/g, "NFS CG 1819.11(a) (Companion Guide guidance)")
    .trim();
  if (/^small business/i.test(role)) c = `Center review chain, not a regulatory requirement${c ? `; ${c}` : ""}`;
  return c || raw;
}
