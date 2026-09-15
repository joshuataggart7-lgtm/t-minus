// The launch sequence: which phases apply, which documents each phase needs,
// which reviews are triggered, and what puts the clock on hold.
// Phase order and planned days come from phase_plan; review citations and
// planned days come from review_rules. Nothing regulatory is invented here
// beyond the phase citation labels.

import { matchStrategy, type RefData } from "@/lib/intake";
import { overrideValue } from "@/lib/center-config";
import { jofocVariant, triggeredDocs } from "@/lib/scenario";
import {
import { HQ_TEMPLATE_KEYS, NO_DANDF_NOTE } from "@/lib/templates-hq";
  acquisitionProfile,
  exceptionLabel,
  fssOrderCitation,
  isOrderProfile,
  vehicleOf,
} from "@/lib/vehicles";

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

/** The acquisition type written out for people, never the internal code. */
export function acquisitionTypeWords(acq: AcqRow) {
  const contract = String((acq as Record<string, unknown>)["contract_type"] ?? "").trim();
  const contractWords = /ffp|firm[- ]fixed/i.test(contract)
    ? "Commercial FFP"
    : contract
      ? `Commercial ${contract}`
      : "Commercial";
  const method = String((acq as Record<string, unknown>)["acquisition_method"] ?? "");
  const methodWords = /13\.5/.test(method)
    ? "FAR 13.5"
    : /13/.test(method)
      ? "FAR 13"
      : /15/.test(method)
        ? "FAR 15"
        : /8\.4/.test(method)
          ? "FAR 8.4"
          : /12/.test(method)
            ? "FAR 12"
            : "FAR 13.5";
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
  Intake: "NF 1707; NFS 1807.7201 (Acquisition Forecast affirmation)",
  "Market Research": "RFO FAR 10.001; NFS CG 1810.12",
  JOFOC: "RFO FAR 6.104-2 Table 6-1; NFS CG 1806.16",
  Synopsis: "RFO FAR 5.203; FAR 12.603 (combined synopsis/solicitation)",
  "Fair Opportunity": "FAR 16.505(b)(1); FAR 8.405 for a schedule order",
  "Solicitation/Quote": "FAR 12.603; NFS CG 1804.11 (NCMS is the system of record)",
  "Technical Evaluation": "FAR 13.106-2 (evaluation of quotations)",
  "Price Reasonableness": "FAR 12.204(b)(1); FAR 13.106-3",
  "Responsibility Check": "FAR 9.104-1; FAR 9.105-2; FAR 52.204-7 (SAM)",
  "Go/No-go Poll": "NFS 1801.770 legal review; Center policy for the review chain",
  Award: "FAR 13.302-3; NFS CG 1804.11 (award written in NCMS)",
  "FPDS-NG Report": "FAR 4.604 (contract action reporting)",
  Administration: "FAR Part 42; FAR 4.801 (contract file)",
  Closeout: "FAR 4.804 (closeout of contract files)",
};

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

/** Micro-purchase threshold, above which the NF 1787 is coordinated. */
const MICRO_PURCHASE = 10_000;
/** Value at which the NF 1787A becomes the market research document of record. */
const MRR_THRESHOLD = 2_000_000;
/** Simplified acquisition threshold, above which a sole-source proposal needs a TER. */
const SIMPLIFIED_ACQUISITION_THRESHOLD = 350_000;

/**
 * The NASA technical evaluation report is mandatory only for a sole-source
 * proposal above the simplified acquisition threshold. On a competed
 * simplified acquisition the FAR 13.106-2 evaluation of quotations is the
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
      d.templateKey === "jofoc" ? { ...d, label: variant.label, citation: variant.citation } : d,
    );
  }
  return merged;
}

function baseDocs(phase: string, acq?: AcqRow): RequiredDoc[] {
  switch (phase) {
    case "Intake":
      return [
        {
          label: "NF 1707 intake, Acquisition Forecast affirmed",
          citation: "NFS 1807.7201",
          field: "acquisition_forecast_verified",
        },
        {
          label: "Independent government cost estimate (IGCE)",
          citation: /13/.test(String(acq?.acquisition_method ?? "")) ? "FAR 13.106-3" : "FAR 15.404-1",
          field: "igce_attached",
        },
        {
          label: "Statement of work or performance work statement",
          citation: "FAR 11.101",
          field: "sow_attached",
        },
      ];
    case "Market Research": {
      const value = Number(acq?.estimated_value ?? 0);
      const mrrRequired = value >= MRR_THRESHOLD;
      return [
        {
          label: "Market research memorandum",
          citation: "RFO FAR 10.001",
          link: "templates",
          templateKey: "market-research-memo",
          ...(mrrRequired
            ? { optional: true, note: "At this value the NF 1787A is the market research document of record." }
            : { note: "Below $2,000,000 this memorandum is the market research document of record." }),
        },
        {
          label: mrrRequired ? "NF 1787A market research report" : "NF 1787A market research report (offered)",
          citation: "NFS CG 1810.12(c)",
          link: "form",
          formKey: "nf-1787a",
          optional: !mrrRequired,
          note: mrrRequired
            ? "Required at an estimated value of $2,000,000 or more."
            : "Offered below $2,000,000; the memorandum is the document of record.",
        },
        {
          label: "NF 1787 small business coordination",
          citation: "NFS 1819.202-70",
          link: "form",
          formKey: "nf-1787",
          optional: value <= MICRO_PURCHASE,
          note:
            value <= MICRO_PURCHASE
              ? "Offered at or below the micro-purchase threshold."
              : "Required above the micro-purchase threshold, with the exceptions in the threshold table.",
        },
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
              citation: "RFO FAR 5.203; RFO FAR 6.104",
              link: "templates",
              templateKey: "sam-notice",
              note: "Allow at least 15 days for responses unless an exception applies.",
            }
          : {
              label: "Combined synopsis/solicitation notice",
              citation: "RFO FAR 5.203; FAR 12.603",
              link: "templates",
              templateKey: "sam-notice",
            },
      ];
    }
    case "Solicitation/Quote": {
      const sole = /sole/i.test(String(acq?.competition ?? ""));
      return [
        { label: "NCMS handoff packet", citation: "NFS CG 1804.11", link: "packet" },
        { label: "Funds certified for the period", citation: "31 U.S.C. 1502", field: "funds_certified" },
        ...(sole
          ? [
              {
                label: "Proposed price from the intended source",
                citation: "FAR 13.106-3(a)",
                field: "proposed_price",
                note: "Record the price the single source proposed and the date it was received; the technical evaluation report and the price negotiation memorandum read it from here.",
              } as RequiredDoc,
            ]
          : []),
      ];
    }
    case "Technical Evaluation": {
      // The TER is mandatory only for a sole-source proposal above the SAT.
      // On a competed FAR 13.5 buy the FAR 13.106-2 evaluation of quotations
      // is the requirement and the TER is offered.
      const terRequired = isTerRequired(acq);
      return [
        {
          label: terRequired
            ? "NASA technical evaluation report"
            : "NASA technical evaluation report (offered)",
          citation: terRequired ? "NFS CG 1815.45(b)" : "FAR 13.106-2",
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
                citation: "FAR 13.106-2",
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
          citation: schedule ? fssOrderCitation(value) : "FAR 16.505(b)(1)",
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
          citation: "FAR 8.405-6",
          docKey: "limited-sources-justification",
          tab: "010",
          attachOnly: true,
        });
      }
      // Small business coordination is not a vehicle question: it applies to an
      // order above the micro-purchase threshold unless the parent vehicle was
      // itself set aside.
      const parentSetAside = Boolean(String(acq?.set_aside ?? "").trim());
      rows.push({
        label: "NF 1787 small business coordination",
        citation: "NFS 1819.202-70",
        link: "form",
        formKey: "nf-1787",
        optional: value <= MICRO_PURCHASE || parentSetAside,
        note: parentSetAside
          ? "Offered: the parent vehicle was set aside, so the order carries the set-aside."
          : value <= MICRO_PURCHASE
            ? "Offered at or below the micro-purchase threshold."
            : "Required on an order above the micro-purchase threshold.",
      });
      return rows;
    }
    case "Price Reasonableness": {
      const order = isOrderProfile(acquisitionProfile(acq as Record<string, unknown>));
      return [
        {
          label: "Price negotiation memorandum (PNM)",
          citation: order ? "FAR 16.505(b)(3)" : "FAR 12.204(b)(1)",
          link: "templates",
          templateKey: "pnm",
          note: order
            ? "The contracting officer determines the order price fair and reasonable under FAR 16.505(b)(3). The PNM is the determination of record."
            : "The PNM is the price reasonableness determination of record. No separate determination is generated.",
        },
      ];
    }
    case "Responsibility Check":
      return [
        {
          label: "SAM.gov entity registration and exclusion results",
          citation: "FAR 9.104-1; FAR 52.204-7",
          link: "checks",
        },
        {
          label: "Integrity records count (FAPIIS)",
          citation: "FAR 9.104-6",
          link: "checks",
        },
        {
          label: "SF 1449 signature",
          citation: "FAR 9.105-2",
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
            citation: "NFS CG 1804.11",
            link: "packet",
            note: "The order document of record is written in NCMS from this packet.",
          },
          {
            label: "Order document signed (written in NCMS)",
            citation: profile === "fss_order" ? "FAR 8.405-3" : "FAR 16.505(a)",
            link: "packet",
          },
        ];
      if (profile === "bpa")
        return [
          { label: "NCMS handoff packet", citation: "NFS CG 1804.11", link: "packet" },
          { label: "Blanket purchase agreement signed (written in NCMS)", citation: "FAR 13.303-3", link: "packet" },
        ];
      return [
        { label: "NCMS handoff packet", citation: "NFS CG 1804.11", link: "packet" },
        { label: "SF 1449 award document (written in NCMS)", citation: "FAR 12.204", link: "packet" },
      ];
    }
    case "FPDS-NG Report":
      return [{ label: "FPDS-NG contract action report", citation: "FAR 4.604" }];
    case "Administration":
      return [
        {
          label: "CPARS past performance evaluation",
          citation: "RFO FAR Part 42",
          link: "templates",
          templateKey: "cpars-input",
        },
        {
          label: "COR appointment letter",
          citation: "FAR 1.602-2(d)",
          link: "templates",
          templateKey: "cor-appointment",
        },
        {
          label: "Option exercise: preliminary notice to the contractor",
          citation: "FAR 17.207(a)",
          link: "templates",
          templateKey: "option-exercise-notification",
          optional: true,
          note: "Applies when the contract includes option line items.",
        },
        {
          label: "Option exercise: determination to exercise",
          citation: "FAR 17.207(c)",
          link: "templates",
          templateKey: "option-exercise-determination",
          optional: true,
          note: "Applies when the contract includes option line items.",
        },
        ...(acquisitionProfile(acq as Record<string, unknown>) === "bpa"
          ? [
              {
                label: "Annual review of the blanket purchase agreement",
                citation: "FAR 13.303-6(b)",
                docKey: "bpa-annual-review",
                tab: "110",
                attachOnly: true,
                note: "Review the agreement at least once a year: prices, sources, and whether it is still advantageous.",
              } as RequiredDoc,
            ]
          : []),
        {
          label: "SF 30 modification handoff packet",
          citation: "FAR 43.301; NFS CG 1804.11",
          link: "packet",
          note: "The modification of record is written in NCMS. T-Minus hands over the facts and the clause delta.",
        },
      ];
    case "Closeout":
      return [
        {
          label: "Closeout Transfer Checklist",
          citation: "FAR 4.804-5",
          link: "templates",
          templateKey: "closeout-checklist",
        },
        {
          label: "Closeout record: deobligation, final invoice, release of claims, property",
          citation: "FAR 4.804-5(a)",
          docKey: "closeout-record",
          tab: "120",
          note: "Entered on the closeout panel of this file; the checklist reads those values.",
        },
        { label: "Contract file complete and retained", citation: "FAR 4.801; FAR 4.805" },
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
  if (role.startsWith("aviation safety")) return answeredYes(acq, /S5V/i);
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
 * The approval level FAR 6.104-2 Table 6-1 sets for this file's value, and the
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
    // which points at the FAR 6.104-2 Table 6-1 level for the value.
    const tier = jofocApprovalTier(acq, ref);
    return [
      ...applicable,
      {
        rule_id: "jofoc-approving-official",
        reviewer_role: JOFOC_APPROVER_ROLE,
        trigger: "Sole source with a justification on the file",
        citation: "FAR 6.104-2 Table 6-1",
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
      citation: r.citation,
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
    (r) => (r.phase ?? "").toLowerCase() === String(acq.current_phase ?? "").toLowerCase(),
  );
  const baseline = acq.regulatory_baseline_date ?? null;
  const elapsed = baseline ? Math.max(0, daysBetween(baseline, todayISO)) : null;

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
  const effectiveIndex =
    earliestOpen >= 0 && (currentIndex < 0 || earliestOpen < currentIndex) ? earliestOpen : currentIndex;

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
    if (status === "complete") actual = planned;
    if (status === "current" && elapsed !== null) actual = Math.max(0, elapsed - before);
    const phase = phaseName;
    return {
      phase,
      planned_days: planned,
      order: r.order ?? i + 1,
      status,
      actual_days: actual,
      docs,
      citation: PHASE_CITATIONS[phase] ?? "",
      guidance: PHASE_GUIDANCE[phase] ?? "",
      needsPoll: phase === "Go/No-go Poll",
    };
  });
}

// --------------------------------------------------------------------- hold

export type HoldCause = { reason: string; owner: string } | null;

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
        return { reason: `${p.phase}: ${d.label} is missing`, owner };
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
 *  date, and disposition are read from the clauses table. FAR 52.212-5 is
 *  Reserved and is never included. */
export const PACKET_CLAUSE_NUMBERS = [
  "52.204-7",
  "52.204-13",
  "52.204-24",
  "52.209-6",
  "52.212-1",
  "52.212-3",
  "52.212-4",
  "52.219-6",
  "52.222-3",
  "52.222-21",
  "52.222-26",
  "52.223-18",
  "52.225-13",
  "52.232-33",
  "52.233-3",
  "52.233-4",
  "52.247-34",
  "1852.203-70",
  "1852.204-76",
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
    note: "T-Minus handoff packet. NCMS is the contract writing system of record (NFS CG 1804.11). This packet is not the solicitation or the contract.",
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
