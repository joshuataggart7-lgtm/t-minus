// The launch sequence: which phases apply, which documents each phase needs,
// which reviews are triggered, and what puts the clock on hold.
// Phase order and planned days come from phase_plan; review citations and
// planned days come from review_rules. Nothing regulatory is invented here
// beyond the phase citation labels.

import { matchStrategy, type RefData } from "@/lib/intake";
import { phaseAlias } from "@/lib/phase-alias";
import { overrideValue } from "@/lib/center-config";
import { jofocVariant, scenarioContext, triggeredDocs } from "@/lib/scenario";
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
import { igceCite, simplifiedPriceCite } from "@/lib/rfo-simplified-cites";
import { dateCT } from "@/lib/calendar-date";

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
};

export function acquisitionType(acq: AcqRow) {
  // A vehicle answered at intake decides the phase plan: a parent IDIQ, an
  // order under one, a BPA, or a schedule order each run their own sequence.
  const profile = acquisitionProfile(acq as Record<string, unknown>);
  if (profile !== "new_contract") return profile;
  return /sole/i.test(String(acq.competition ?? ""))
    ? "commercial_ffp_13_5_sole_source"
    : "commercial_ffp_13_5_competed";
}

/** True when the record itself says the buy is commercial. */
export function isCommercialBuy(acq?: AcqRow | null): boolean {
  const row = (acq ?? {}) as Record<string, unknown>;
  const method = String(row["acquisition_method"] ?? "");
  if (/13\.5|\b12\b/.test(method)) return true;
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
  const methodWords = /13\.5/.test(method)
    ? "RFO FAR 12.201-1"
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
  "Go/No-go Poll": "Center policy for the review chain",
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
    "Check the vendor in SAM: registration, exclusions, and integrity records. Signing the SF 1449 is the determination.",
  "Go/No-go Poll": "Each required reviewer votes Go or No-go by name. A No-go needs a reason.",
  Award: "Award in NCMS from the handoff packet, then mark the file Launched.",
  "FPDS-NG Report": "Report the action so the public record matches the file.",
  Administration: "Run the contract: deliveries, invoices, and past performance.",
  Closeout: "Close the file when everything is delivered, paid, and filed.",
};

/** Micro-purchase threshold, used for the RFO FAR 19.104-1(b)(1) set-aside advisory. */
const MICRO_PURCHASE = 10_000;
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

/** Rows the scenario answers switch on for this phase. */
function scenarioRows(phase: string, acq?: AcqRow): RequiredDoc[] {
  if (!acq) return [];
  return triggeredDocs(acq as Record<string, unknown>)
    .filter((d) => d.phase === phase && !d.replacesJofoc)
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

export function requiredDocs(phase: string, acq?: AcqRow): RequiredDoc[] {
  const base = baseDocs(phase, acq);
  const extra = scenarioRows(phase, acq);
  const variant = acq ? jofocVariant(acq as Record<string, unknown>) : null;
  const merged = extra.length ? [...base, ...extra] : base;
  if (variant && phase === "JOFOC") {
    return merged.map((d) =>
      d.templateKey === "jofoc"
        ? {
            ...d,
            label: variant.label,
            citation: variant.citation,
            ...(variant.templateKey ? { templateKey: variant.templateKey } : {}),
          }
        : d,
    );
  }
  return merged;
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
      ];
    case "Market Research": {
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
    case "JOFOC":
      return [
        {
          label: "Justification for other than full and open competition",
          citation: "RFO FAR 6.104-2",
          field: "jofoc_authority_citation",
          link: "templates",
          templateKey: "jofoc",
        },
      ];
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
                citation: /\b15\b/.test(String(acq?.acquisition_method ?? "")) ? "RFO FAR 15.201(c)(3)" : simplifiedPriceCite(String(acq?.acquisition_method ?? "")),
                field: "proposed_price",
                note: "Record the price the single source proposed and the date it was received; the technical evaluation report and the price negotiation memorandum read it from here.",
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
      return [
        {
          label: terRequired
            ? "NASA technical evaluation report"
            : "NASA technical evaluation report (offered)",
          citation: terRequired ? "NFS CG 1815.45(b)" : "RFO FAR 12.203",
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
                citation: "RFO FAR 12.203",
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
      const rows: RequiredDoc[] = [
        {
          label: schedule
            ? "Record of the schedule ordering procedures followed"
            : "Fair opportunity record: every awardee considered",
          citation: schedule ? fssOrderCitation(value) : "RFO FAR 16.507-2(a)",
          docKey: "fair-opportunity-record",
          tab: "010",
          attachOnly: true,
          note: schedule
            ? "The ordering procedure follows the order value."
            : "Record how each awardee under the vehicle was given a fair opportunity to be considered.",
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
      const order = isOrderProfile(acquisitionProfile(acq as Record<string, unknown>));
      return [
        {
          label: "Price negotiation memorandum (PNM)",
          citation: order ? "RFO FAR 16.506(f)" : "RFO FAR 12.204(a)",
          link: "templates",
          templateKey: "pnm",
          note: order
            ? "The contracting officer determines the order price fair and reasonable under RFO FAR 16.506(f). The PNM is the determination of record."
            : "The PNM is the price reasonableness determination of record. No separate determination is generated.",
        },
      ];
    }
    case "Responsibility Check":
      return [
        {
          label: "SAM.gov entity registration and exclusion results",
          citation: "RFO FAR 9.104-1; RFO FAR 52.204-7",
          link: "checks",
        },
        {
          label: "Integrity records count (FAPIIS)",
          citation: "RFO FAR 9.104-6",
          link: "checks",
        },
        {
          label: "SF 1449 signature",
          citation: "RFO FAR 9.105-2",
          link: "packet",
          note: "The contracting officer's signature on the SF 1449 is the affirmative responsibility determination. A separate memorandum is generated only on a finding of nonresponsibility.",
        },
      ];
    case "Go/No-go Poll":
      return [{ label: "Recorded votes from every required reviewer", citation: "Center policy" }];
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
      return [
        { label: "NCMS handoff packet", citation: "NFS CG 1804.11(b)", link: "packet" },
        { label: "SF 1449 award document (written in NCMS)", citation: "RFO FAR 12.204(c)(1)", link: "packet" },
      ];
    }
    case "FPDS-NG Report":
      return [{ label: "FPDS-NG contract action report", citation: "RFO FAR 4.301" }];
    case "Administration":
      return [
        {
          label: "CPARS past performance evaluation",
          citation: "RFO FAR Part 42",
          link: "templates",
          templateKey: "cpars-input",
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
          note: "Entered on the closeout panel of this file; the checklist reads those values.",
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
  const micro = thr("Micro-purchase threshold") ?? 15_000;
  const certified = thr("Certified cost or pricing data (FAR text)") ?? 2_500_000;
  const jofoc = Boolean(String(acq.jofoc_authority_citation ?? "").trim());

  if (role.startsWith("legal review")) return jofoc || value >= (trigger ?? sat);
  if (role.startsWith("pricing review"))
    return /cost/i.test(String(acq.contract_type ?? "")) || value >= (trigger ?? certified);
  if (role.startsWith("small business")) return value > (trigger ?? micro);
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

/** Phases that require a recorded Go/No-go from reviewers. */
export const REVIEW_PHASES = ["JOFOC", "Go/No-go Poll"] as const;

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
  if (phase === "Go/No-go Poll") {
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
  return "Go/No-go Poll";
}

export type BoardEntry = {
  poll_id: string | null;
  phase: string;
  reviewer_role: string;
  reviewer_name: string;
  vote: "go" | "no-go" | "pending";
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
  phase = "Go/No-go Poll",
  roster: ReviewerPerson[] = [],
): BoardEntry[] {
  const forPhase = polls.filter((p) => (p.phase ?? "Go/No-go Poll") === phase);
  const center = (acq['center_code'] ?? null) as string | null;
  return reviewRulesForPhase(phase, acq, rules, ref).map((r) => {
    const sameRole = (p: PollRow) =>
      (p.reviewer_role ?? "").toLowerCase() === r.reviewer_role.toLowerCase();
    // A legal vote already recorded at the justification stands on the
    // go/no-go board rather than being asked for twice.
    const carried =
      phase === "Go/No-go Poll" && /^legal review/i.test(r.reviewer_role)
        ? polls.find((p) => sameRole(p) && (p.vote === "go" || p.vote === "no-go"))
        : undefined;
    const row = forPhase.find(sameRole) ?? carried;
    const vote = (row?.vote ?? "pending") as BoardEntry["vote"];
    // The role decides the person. A name stored on a cast vote stands, because
    // that person actually voted; an unvoted row always reads from the roster.
    const tier = r.reviewer_role === JOFOC_APPROVER_ROLE ? jofocApprovalTier(acq, ref) : null;
    const byRole = tier
      ? (tier.title === "Contracting Officer" ? String(acq['co_name'] ?? "").trim() : "") ||
        reviewerNameForTitle(tier.title, center, roster) ||
        tier.title
      : reviewerNameForRole(r.reviewer_role, center, roster);
    const voted = vote === "go" || vote === "no-go";
    return {
      poll_id: row?.poll_id ?? null,
      phase,
      reviewer_role: r.reviewer_role,
      reviewer_name: (voted ? row?.reviewer_name : null) ?? byRole,
      vote: vote === "go" || vote === "no-go" ? vote : "pending",
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
};

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
  const type = acquisitionType(acq);
  const rows = plan
    .filter((p) => p.acquisition_type === type && p.phase)
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

  const unfinished = (phase: string, docs: RequiredDoc[]) => {
    if (!known) return false;
    return docs.some((d) => {
      if (d.optional) return false;
      if (generatorKey(d) && !d.field && !known.savedKeys) return false;
      const hasFile = known.attachedKeys ? known.attachedKeys.has(docRowKey(d)) : undefined;
      return docSatisfied(d, acq, hasFile, known.savedKeys) === false;
    });
  };

  const docsFor = rows.map((r) => requiredDocs(r.phase as string, acq));

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
    if (currentIndex >= 0 && (currentIndex === closeoutIndex || currentIndex >= adminIndex)) {
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
    return {
      phase,
      planned_days: planned,
      order: r.order ?? i + 1,
      status,
      actual_days: actual,
      docs,
      citation: phaseCitation(phase, acq),
      guidance: PHASE_GUIDANCE[phase] ?? "",
      needsPoll: phase === "Go/No-go Poll",
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
      // A row the app generates only holds the file where the record already
      // carried that answer; an unwritten optional draft never places a hold.
      if (generatorKey(d) && !d.field) continue;
      const hasFile = attachedKeys ? attachedKeys.has(docRowKey(d)) : undefined;
      if (docSatisfied(d, acq, hasFile, savedKeys) === false)
        return { reason: `${p.phase}: ${d.label} is missing`, owner, doc: { phase: p.phase, label: d.label } };
    }
  }

  // A No-go holds the file at once, whichever review phase it came from.
  const nogo = board.find((b) => b.vote === "no-go");
  if (nogo)
    return {
      reason: `No-go: ${shortRole(nogo.reviewer_role)}${nogo.reason ? ` — ${nogo.reason}` : ""}`,
      owner: `${nogo.reviewer_name} (${nogo.reviewer_role})`,
    };

  // A vote still pending when its phase has been left holds the file too.
  const indexOf = (phase: string) => phases.findIndex((p) => p.phase === phase);
  const pending = board.find((b) => {
    const i = indexOf(b.phase);
    return b.vote === "pending" && i >= 0 && currentIndex > i;
  });
  if (pending)
    return {
      reason: `${pending.phase}: ${pending.reviewer_role} has not voted`,
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
