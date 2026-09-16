/**
 * T-Minus template engine.
 *
 * A template is a set of sections whose fields bind to acquisition_facts or to
 * document-specific values. Sections and fields can show or hide by rule,
 * required fields are validated, and each template carries a version badge
 * (governing citation, tier, HQ revision date).
 */

import { CLOSEOUT_CHECKLIST } from "@/lib/post-award";
import { renderPdf, type PdfBlock } from "@/lib/pdf-out";
import { HQ_TEMPLATES } from "@/lib/templates-hq";
import { HQ4_TEMPLATES } from "@/lib/templates-hq4";
import { HQ5_TEMPLATES } from "@/lib/templates-hq5";
import { HQ6_TEMPLATES } from "@/lib/templates-hq6";
import { HQ6B_TEMPLATES } from "@/lib/templates-hq6b";
import { HQ6C_TEMPLATES } from "@/lib/templates-hq6c";

export type FieldKind = "text" | "textarea" | "date" | "money" | "select" | "readonly";

export type Values = Record<string, string>;

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  /** Column on acquisition_facts this field is pre-filled from. */
  bind?: string;
  options?: string[];
  required?: boolean;
  /**
   * Required before the phase can be exited, not to save a version. The phase
   * lists it; the save never blocks on it and the export prints a blank line.
   */
  requiredAtExit?: boolean;
  /** Value the field carries before anyone types in it. */
  default?: string;
  help?: string;
  /** A warning that depends on what has been answered elsewhere on the form. */
  helpFor?: (v: Values) => string | undefined;
  showIf?: (v: Values) => boolean;
};

export type SectionDef = {
  id: string;
  title: string;
  citation?: string;
  /** Citation that depends on the record's acquisition method. */
  citationFor?: (v: Values) => string;
  tier?: "binding" | "guidance";
  standingText?: string;
  fields: FieldDef[];
  showIf?: (v: Values) => boolean;
  /** Back-up material: shown collapsed on the form, printed in full. */
  collapsed?: boolean;
};

/** The citation printed for a section on this record. */
export function sectionCitation(s: SectionDef, v: Values): string | undefined {
  return s.citationFor ? s.citationFor(v) : s.citation;
}

/** The citation printed on the template badge for this record. */
export function badgeCitation(def: { badge: { citation: string; citationFor?: (v: Values) => string } }, v: Values): string {
  return def.badge.citationFor ? def.badge.citationFor(v) : def.badge.citation;
}

/** True when the values carry a FAR 13, FAR 13.5 or FAR Part 12 method. */
export function simplifiedValues(v: Values): boolean {
  const method = v["__method"] ?? "";
  if (/part\s*15|15\.\d/i.test(method) && !/13\.5|13\b|simplified/i.test(method)) return false;
  return /13\.5|\b13\b|\b12\b|simplified|commercial/i.test(method);
}

export type TemplateDef = {
  key: string;
  /** Name as it appears in the templates table. */
  name: string;
  tab: string;
  badge: {
    citation: string;
    /** Citation that depends on the record's acquisition method. */
    citationFor?: (v: Values) => string;
    tier: "binding" | "guidance";
    revision: string;
    /** Machine-readable HQ revision date, used to spot newer guidance. */
    effective?: string;
    note?: string;
    corrections?: string[];
  };
  lead: string;
  /**
   * Printed form. "memo" and "dandf" use the NF 1858 memorandum page; "dandf"
   * prints Findings, then Determination, then the signature page. "plan" is a
   * multi-section report or chart package.
   */
  layout?: "memo" | "dandf" | "plan";
  sections: SectionDef[];
  /** Optional signature page selected by estimated value. */
  signature?: (estimatedValue: number | null, thresholds: ThresholdRow[]) => SignatureBlock;
};

export type ThresholdRow = {
  name: string;
  value: number | null;
  citation: string | null;
  tier: string | null;
  effective_date: string | null;
  note: string | null;
};

export type SignatureBlock = { tierLabel: string; citation: string; blocks: string[]; note?: string | undefined };

const thresholdValue = (rows: ThresholdRow[], name: string, fallback: number) =>
  Number(rows.find((t) => t.name === name)?.value ?? fallback);

// ------------------------------------------------------------------ NF 1707
const nf1707: TemplateDef = {
  key: "nf-1707",
  name: "NASA Form 1707 (intake)",
  tab: "—",
  badge: {
    citation: "NF 1707, Special Approvals and Affirmations of Requisitions",
    tier: "binding",
    revision: "current NF 1707 pending",
    note: "Built from the intake fields while the current NF 1707 is pending.",
  },
  lead: "Printable view of the intake as submitted.",
  sections: [
    {
      id: "header",
      title: "Header",
      citation: "NF 1707",
      tier: "binding",
      fields: [
        { key: "center_code", label: "Center", kind: "text", bind: "center_code", required: true },
        { key: "pr_number", label: "Requisition number", kind: "text", bind: "pr_number" },
        { key: "requester_name", label: "Requester", kind: "text", bind: "requester_name", required: true },
        { key: "requester_org_code", label: "Requesting organization", kind: "text", bind: "requester_org_code" },
        { key: "title", label: "Brief description", kind: "text", bind: "title", required: true },
        {
          key: "description_of_requirement",
          label: "Description of requirement",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
        {
          key: "acquisition_forecast_verified",
          label: "Acquisition Forecast verified",
          kind: "readonly",
          bind: "acquisition_forecast_verified",
        },
      ],
    },
    {
      id: "tminus",
      title: "T-Minus fields",
      citation: "T-Minus record",
      tier: "guidance",
      fields: [
        { key: "mission_id", label: "Mission supported", kind: "text", bind: "mission_id", required: true },
        { key: "need_date", label: "Mission need date", kind: "date", bind: "need_date", required: true },
        { key: "estimated_value", label: "Estimated value", kind: "money", bind: "estimated_value", required: true },
        { key: "naics_code", label: "NAICS", kind: "text", bind: "naics_code" },
        { key: "psc_code", label: "PSC", kind: "text", bind: "psc_code" },
        { key: "contract_type", label: "Contract type", kind: "text", bind: "contract_type", required: true },
        { key: "acquisition_method", label: "Acquisition method", kind: "text", bind: "acquisition_method" },
        { key: "competition", label: "Competition", kind: "text", bind: "competition" },
        { key: "set_aside", label: "Set-aside", kind: "text", bind: "set_aside" },
        {
          key: "period_of_performance_start",
          label: "Period of performance start",
          kind: "date",
          bind: "period_of_performance_start",
        },
        {
          key: "period_of_performance_end",
          label: "Period of performance end",
          kind: "date",
          bind: "period_of_performance_end",
        },
        { key: "place_of_performance", label: "Place of performance", kind: "text", bind: "place_of_performance" },
        { key: "igce_attached", label: "IGCE attached", kind: "readonly", bind: "igce_attached" },
        { key: "sow_attached", label: "SOW or PWS attached", kind: "readonly", bind: "sow_attached" },
      ],
    },
    {
      id: "approvals",
      title: "Special approvals and affirmations",
      citation: "NF 1707 Sections 1 through 12",
      tier: "binding",
      fields: [
        {
          key: "approvals_summary",
          label: "Answers recorded on the intake",
          kind: "textarea",
          help: "Filled from the answers stored on the record. Edit only to add a clarification.",
        },
      ],
    },
  ],
};

// ------------------------------------------------------------------ JOFOC
const isUrgency = (v: Values) => (v["authority"] ?? "").includes("6.103-2");
const isFollowOn = (v: Values) => (v["authority"] ?? "").includes("6.103-1");

const jofoc: TemplateDef = {
  key: "jofoc",
  name: "Justification for Other than Full and Open Competition (JOFOC)",
  tab: "015",
  badge: {
    citation: "FAR 6.103, FAR 6.104-1, NFS CG 1806.1, NFS CG 1806.15(a)",
    tier: "binding",
    revision: "HQ 04/2026 revision, effective 4/27/2026",
    effective: "2026-04-27",
    note: "HQ 04/2026 revision; three citation corrections applied by T-Minus; reported to PGPD.",
    corrections: [
      "FAR 6.1030 to FAR 6.103",
      "six areas to eleven items at FAR 6.104-1(a)(1) through (a)(11)",
      "Subpart 5.2 and 'synopsized' to Subpart 5.1 and 'publicized.'",
    ],
  },
  lead: "Eleven items at FAR 6.104-1(a)(1) through (a)(11).",
  sections: [
    {
      id: "header",
      title: "Header",
      citation: "FAR 6.103",
      tier: "binding",
      standingText:
        "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION. Justification for other than full and open competition, prepared under FAR 6.103.",
      fields: [
        { key: "center_code", label: "Center name and acronym", kind: "text", bind: "center_code", required: true },
        {
          key: "solicitation_name",
          label: "Solicitation or contract name and number",
          kind: "text",
          bind: "pr_number",
          required: true,
        },
        { key: "program_name", label: "Program or project name", kind: "text", bind: "mission_id", required: true },
        { key: "acquisition_id", label: "Acquisition identifier", kind: "readonly", bind: "acquisition_id" },
      ],
    },
    {
      id: "item1",
      title: "1. Identification of the agency and the contracting activity",
      citation: "FAR 6.104-1(a)(1)",
      tier: "binding",
      standingText:
        "This document is a justification for other than full and open competition prepared by the National Aeronautics and Space Administration (NASA) at the buying location named below. The procuring agency is NASA and the contracting activity is that buying location.",
      fields: [{ key: "buying_location", label: "Buying location", kind: "text", bind: "center_code", required: true }],
    },
    {
      id: "item2",
      title: "2. Nature and description of the action being approved",
      citation: "FAR 6.104-1(a)(2)",
      tier: "binding",
      fields: [
        {
          key: "action_type",
          label: "Action type",
          kind: "select",
          required: true,
          options: ["Sole-source contract", "New work modification to contract", "Extension to contract"],
        },
        { key: "contract_number", label: "Contract number, if any", kind: "text" },
        { key: "contractor_name", label: "Contractor name", kind: "text", bind: "vendor_legal_name", required: true },
        {
          key: "action_description",
          label: "Description of the action",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
          help: "For extensions, include contract number, title, period of performance, and other pertinent information.",
        },
      ],
    },
    {
      id: "item3",
      title: "3. Description of the supplies or services required, including the estimated value",
      citation: "FAR 6.104-1(a)(3)",
      tier: "binding",
      fields: [
        {
          key: "requirement_description",
          label: "Supplies or services",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
        { key: "mission_supported", label: "Mission supported", kind: "text", bind: "mission_id", required: true },
        { key: "pop_start", label: "Period of performance start", kind: "date", bind: "period_of_performance_start" },
        { key: "pop_end", label: "Period of performance end", kind: "date", bind: "period_of_performance_end" },
        { key: "estimated_value", label: "Estimated value", kind: "money", bind: "estimated_value", required: true },
      ],
    },
    {
      id: "item4",
      title: "4. Statutory authority permitting other than full and open competition",
      citation: "FAR 6.104-1(a)(4)",
      tier: "binding",
      fields: [
        {
          key: "authority",
          label: "Statutory authority",
          kind: "select",
          bind: "jofoc_authority_citation",
          required: true,
          options: [
            "10 U.S.C. 3204(a)(1) as implemented by FAR 6.103-1 (only one responsible source)",
            "10 U.S.C. 3204(a)(2) as implemented by FAR 6.103-2 (unusual and compelling urgency)",
            "10 U.S.C. 3204(a)(3) as implemented by FAR 6.103-3 (industrial mobilization; expert services)",
            "10 U.S.C. 3204(a)(4) as implemented by FAR 6.103-4 (international agreement)",
            "10 U.S.C. 3204(a)(5) as implemented by FAR 6.103-5 (authorized or required by statute)",
            "10 U.S.C. 3204(a)(6) as implemented by FAR 6.103-6 (national security)",
            "10 U.S.C. 3204(a)(7) as implemented by FAR 6.103-7 (public interest)",
            "41 U.S.C. 1901 (FAR 12.102 procedures; only one responsible source basis under RFO FAR 6.103-1)",
            "41 U.S.C. 1903 (FAR 12.102 procedures; only one responsible source basis under RFO FAR 6.103-1)",
          ],
          help: "If the rationale is that only one responsible source can meet the need, cite 10 U.S.C. 3204(a)(1) as implemented by FAR 6.103-1, or, on a FAR 12.102 or FAR 13.5 commercial simplified file, the 41 U.S.C. 1901 or 1903 option that names that basis. Item 5 must then document the only-one-responsible-source rationale.",
          helpFor: (v) =>
            (v["action_type"] ?? "").startsWith("Sole-source") &&
            (v["authority"] ?? "") !== "" &&
            !/6\.103-1|only one responsible source/i.test(v["authority"] ?? "")
              ? "This is recorded as a sole-source action, but the authority selected is not the only-one-responsible-source basis. Confirm the authority matches the rationale in item 5, or change one of them."
              : undefined,
        },
      ],
    },
    {
      id: "item5",
      title: "5. Demonstration that the authority cited applies",
      citation: "FAR 6.104-1(a)(5)",
      tier: "binding",
      fields: [
        {
          key: "authority_rationale",
          label: "Rationale for the authority",
          kind: "textarea",
          required: true,
          help: "Substantiate why the contractor is the only responsible source or how the acquisition meets the authority: limited rights in data, proprietary processes, specialized labor skills, exclusive knowledge or equipment, unique capabilities, previous work.",
        },
        {
          key: "urgency_harm",
          label: "Harm to the Government if the action is not executed",
          kind: "textarea",
          required: true,
          showIf: isUrgency,
          help: "Required when FAR 6.103-2 is cited.",
        },
        {
          key: "urgency_not_delay",
          label: "Statement that the urgency was not created by delay in processing",
          kind: "textarea",
          required: true,
          showIf: isUrgency,
        },
      ],
    },
    {
      id: "item6",
      title: "6. Efforts to solicit offers from as many potential sources as practicable",
      citation: "FAR 6.104-1(a)(6), publicized under FAR Subpart 5.1",
      tier: "binding",
      fields: [
        {
          key: "notice_status",
          label: "Notice on this file",
          kind: "readonly",
          showIf: (v) => !isUrgency(v),
          help: "Read from the notice of intent to sole source on this file. A saved notice reads as a draft until a publication date is entered below.",
        },
        {
          key: "notice_date",
          label: "Date the notice was published to the Government Point of Entry",
          kind: "date",
          // Saving a notice is not publishing it: this date is entered when
          // the notice is published. Required to exit the Synopsis phase, not
          // to save a version.
          requiredAtExit: true,
          showIf: (v) => !isUrgency(v),
        },
        {
          key: "notice_exemption",
          label: "FAR 5.101(b)(1) exemption and the extent competition was limited",
          kind: "textarea",
          required: true,
          showIf: isUrgency,
          help: "Unusual and compelling urgency precludes competition; explain the extent maximum practicable competition was obtained, NFS CG 1806.12(a).",
        },
      ],
    },
    {
      id: "item7",
      title: "7. Determination that the anticipated cost will be fair and reasonable",
      citation: "FAR 6.104-1(a)(7)",
      citationFor: (v) =>
        `FAR 6.104-1(a)(7); price analysis under ${simplifiedValues(v) ? "FAR 13.106-3 and FAR 12.209" : "FAR 15.404-1"}`,
      tier: "binding",
      standingText:
        "The Contracting Officer's signature on this document indicates that the Contracting Officer has determined that the anticipated cost to the Government will be fair and reasonable. The contractor must submit a proposal to be evaluated and negotiated by the Government. Prior to execution of the contractual instrument a proposal analysis will be performed to ensure the final agreed-to price is fair and reasonable.",
      fields: [
        {
          key: "price_analysis_plan",
          label: "Planned price or proposal analysis, under the citation for this file",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "item8",
      title: "8. Market research conducted and the results",
      citation: "FAR 6.104-1(a)(8), FAR Part 10",
      tier: "binding",
      fields: [
        {
          key: "market_research",
          label: "Market research and results, or the reasons it was not conducted",
          kind: "textarea",
          required: true,
          help: "Reliance on the FAR 5.101 notice alone is not sufficient.",
        },
      ],
    },
    {
      id: "item9",
      title: "9. Other facts supporting the use of other than full and open competition",
      citation: "FAR 6.104-1(a)(9)",
      tier: "binding",
      fields: [
        { key: "other_facts", label: "Other facts, or none", kind: "textarea", default: "None" },
        {
          key: "duplicated_cost",
          label: "Estimated cost of duplicated work and how it was derived",
          kind: "textarea",
          required: true,
          showIf: isFollowOn,
          help: "Required when FAR 6.103-1(c)(2) is cited for a follow-on acquisition.",
        },
        {
          key: "injury_chronology",
          label: "Quantified injury and chronology of events",
          kind: "textarea",
          required: true,
          showIf: isUrgency,
          help: "NFS CG 1806.12(a): quantify the serious injury with its basis, any probable personal injury or loss of life, and the chronology that caused the urgency.",
        },
        {
          key: "extension_statements",
          label: "Three statements for extending existing services",
          kind: "textarea",
          showIf: (v) => isUrgency(v) && (v["action_type"] ?? "").startsWith("Extension"),
          required: true,
          help: "NFS CG 1806.12(b): the successor acquisition was started early enough, the circumstances that prevented timely award, and why no other source could compete for the interim requirement.",
        },
      ],
    },
    {
      id: "item10",
      title: "10. Sources that expressed an interest in writing",
      citation: "FAR 6.104-1(a)(10), notice publicized under FAR Subpart 5.1",
      tier: "binding",
      fields: [
        {
          key: "interested_sources",
          label: "Posting and closing dates, sources, responses and their disposition",
          kind: "textarea",
          // Fills from the saved notice; required to exit Synopsis, not to save.
          requiredAtExit: true,
          help: "If a notice was not required, describe the exception and why it applies.",
        },
      ],
    },
    {
      id: "item11",
      title: "11. Actions to remove barriers to competition",
      citation: "FAR 6.104-1(a)(11)",
      tier: "binding",
      fields: [
        {
          key: "barriers",
          label: "Actions the agency may take before any subsequent acquisition",
          kind: "textarea",
          required: true,
          help: "Default: The Agency will continue to examine the market in the future for alternative solutions or new sources before executing any subsequent acquisitions for the same requirements.",
        },
      ],
    },
  ],
  signature: (estimatedValue, thresholds) => {
    const co = thresholdValue(thresholds, "JOFOC approval tier: contracting officer certification", 900000);
    const ca = thresholdValue(thresholds, "JOFOC approval tier: competition advocate", 20000000);
    const hca = thresholdValue(thresholds, "JOFOC approval tier: head of contracting activity (NASA)", 150000000);
    const value = estimatedValue ?? 0;
    const base = [
      "Technical Representative certification: I certify that the facts presented in this justification are accurate and complete.",
      "Contracting Officer certification: I hereby certify that the above justification is accurate and complete to the best of my knowledge and belief.",
    ];
    const citation = "FAR 6.104-2 Table 6-1";
    const note =
      thresholds.find((t) => t.name.startsWith("JOFOC approval tier: contracting officer"))?.note ?? undefined;
    if (value <= co) return { tierLabel: `Up to ${money(co)}`, citation, blocks: base, note };
    if (value <= ca)
      return {
        tierLabel: `Over ${money(co)} to ${money(ca)}`,
        citation,
        blocks: [...base, "Competition Advocate approval."],
        note,
      };
    if (value <= hca)
      return {
        tierLabel: `Over ${money(ca)} to ${money(hca)}`,
        citation,
        blocks: [
          ...base,
          "Competition Advocate concurrence.",
          "HQ Office of General Counsel: required when NOJMO, ESDMD, or SOMD actions require HCA approval.",
          "Head of Contracting Activity approval.",
        ],
        note,
      };
    return {
      tierLabel: `Over ${money(hca)}, and all class justifications`,
      citation,
      blocks: [
        ...base,
        "Competition Advocate concurrence.",
        "Head of Contracting Activity.",
        "HQ Office of General Counsel.",
        "Agency Competition Advocate.",
        "Senior Procurement Executive approval.",
      ],
      note,
    };
  },
};

// ------------------------------------------ NASA Technical Evaluation Report
const ter: TemplateDef = {
  key: "technical-evaluation-report",
  name: "NASA Technical Evaluation Report",
  tab: "054",
  badge: {
    citation: "FAR 15.404-4, FAR 15.404-9(c)(4)(ii), NFS CG 1815.45(b)",
    tier: "guidance",
    revision: "HQ revision 07/2026, effective 7/30/2026",
    effective: "2026-07-30",
    note: "Mandatory above the simplified acquisition threshold for a sole-source proposal; optional at or below it.",
  },
  lead: "Items 1 through 7 are standard. Section 8 is tailored; mark anything that does not apply as N/A.",
  sections: [
    {
      id: "header",
      title: "Memorandum header",
      citation: "NFS CG 1815.45(b)",
      tier: "guidance",
      fields: [
        { key: "memo_date", label: "Date", kind: "date", required: true },
        { key: "office_name", label: "Reply to attention of (NASA office name)", kind: "text", required: true },
        { key: "to_co", label: "To: contracting officer and organizational code", kind: "text", bind: "co_name", required: true },
        { key: "from_evaluator", label: "From: technical evaluator and organizational code", kind: "text", required: true },
        { key: "subject", label: "Subject: title of acquisition and proposal date", kind: "text", bind: "title", required: true },
      ],
    },
    {
      id: "proposal",
      title: "Proposal under evaluation",
      citation: "FAR 15.404-4",
      tier: "binding",
      standingText:
        "The contractor, the estimate and the proposed price are read from the acquisition record.",
      fields: [
        { key: "contractor_name", label: "Contractor", kind: "text", bind: "sam_legal_name", required: true },
        { key: "contractor_uei", label: "Unique Entity Identifier (UEI)", kind: "text", bind: "sam_uei" },
        { key: "requirement_title", label: "Requirement", kind: "text", bind: "title", required: true },
        { key: "igce_amount", label: "Independent government cost estimate (IGCE)", kind: "money", bind: "igce_amount" },
        { key: "proposed_price", label: "Proposed price", kind: "money", bind: "quoted_price" },
        { key: "proposal_received", label: "Date the proposal was received", kind: "date", bind: "proposal_received" },
      ],
    },
    {
      id: "item1",
      title: "1. Technical requirement and background",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [
        {
          key: "background",
          label: "Requirement, changes, and impact",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
      ],
    },
    {
      id: "item2",
      title: "2. Technical evaluation team members",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [{ key: "team", label: "Names, organizations, and the lead evaluator", kind: "textarea", required: true }],
    },
    {
      id: "item3",
      title: "3. Fact-finding",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [{ key: "fact_finding", label: "When, where, who attended, and any revisions", kind: "textarea", required: true }],
    },
    {
      id: "item4",
      title: "4. Ground rules and assumptions",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [{ key: "ground_rules", label: "Reasonableness and any differences of opinion", kind: "textarea", required: true }],
    },
    {
      id: "item5",
      title: "5. Data requirements documents (DRDs)",
      citation: "NFS 1852 DRD program",
      tier: "guidance",
      fields: [{ key: "drds", label: "Acceptability of proposed DRD changes, or N/A", kind: "textarea", required: true }],
    },
    {
      id: "item6",
      title: "6. Government furnished property and information",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [
        {
          key: "gfp",
          label: "Quantity, item serial number, need date, owner, and the Government's ability to provide it, or N/A",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "item7",
      title: "7. Overall acceptability of the technical proposal",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [
        {
          key: "acceptability",
          label: "Acceptable or unacceptable for negotiations",
          kind: "select",
          required: true,
          options: ["Acceptable for negotiations", "Unacceptable for negotiations"],
        },
        { key: "acceptability_basis", label: "Basis, including proposal methodology", kind: "textarea", required: true },
        {
          key: "ae_six_percent",
          label: "Architect-engineering 6 percent limit: where reductions are being taken",
          kind: "textarea",
          help: "FAR 15.404-9(c)(4)(ii). Complete only for architect-engineering services for public works or utilities.",
        },
      ],
    },
    {
      id: "item8",
      title: "8. Evaluation of resources",
      citation: "FAR 15.404-4",
      tier: "binding",
      standingText: "Mark any part that does not apply as N/A. Do not delete it; N/A shows it was reviewed.",
      fields: [
        { key: "res_labor", label: "a. Direct labor: hours, skill mix, and schedule", kind: "textarea", required: true },
        { key: "res_material", label: "b. Material: quantity, type, and necessity", kind: "textarea", required: true },
        { key: "res_travel", label: "c. Travel", kind: "textarea", required: true },
        { key: "res_subcontracts", label: "d. Subcontractor effort", kind: "textarea", required: true },
        { key: "res_tooling", label: "e. Special tooling and test equipment", kind: "textarea", required: true },
        { key: "res_odc", label: "f. Other direct costs, training, consultants, and IWTs", kind: "textarea", required: true },
      ],
    },
  ],
};

// ------------------------------------------- Nonresponsibility determination
// Generated only when the Responsibility Check finding is nonresponsibility.
// When the finding is responsible, the contracting officer's signature on the
// SF 1449 is the affirmative determination and no memorandum exists.
const nonresponsibility: TemplateDef = {
  key: "nonresponsibility",
  name: "Determination of Responsibility Nonresponsibility",
  tab: "0045",
  badge: {
    citation: "FAR 9.104-1; FAR 9.105-2(a)",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2026-05-18",
    note: "Written only on a finding of nonresponsibility. An affirmative determination is made by the contracting officer's signature on the SF 1449.",
  },
  lead: "Determination of nonresponsibility, pre-filled from the record and the SAM.gov entity check.",
  sections: [
    {
      id: "header",
      title: "Acquisition and vendor",
      citation: "FAR 9.105-2(a)",
      tier: "binding",
      fields: [
        { key: "acquisition_id", label: "Acquisition", kind: "readonly", bind: "acquisition_id" },
        { key: "title", label: "Requirement", kind: "text", bind: "title", required: true },
        { key: "center_code", label: "Center", kind: "text", bind: "center_code" },
        { key: "estimated_value", label: "Estimated value", kind: "money", bind: "estimated_value" },
        { key: "vendor_legal_name", label: "Vendor legal name", kind: "text", bind: "sam_legal_name", required: true },
        { key: "vendor_uei", label: "Unique Entity Identifier (UEI)", kind: "text", bind: "sam_uei", required: true },
        { key: "vendor_cage", label: "CAGE code", kind: "text", bind: "sam_cage" },
      ],
    },
    {
      id: "sam",
      title: "SAM.gov entity check of record",
      citation: "FAR 52.204-7; FAR 9.104-6",
      tier: "binding",
      standingText:
        "These values are read from the entity check stored on this acquisition. Re-run the check on the Checks page if they are out of date.",
      fields: [
        { key: "sam_registration", label: "Registration status", kind: "readonly", bind: "sam_registration_status" },
        { key: "sam_expiration", label: "Registration expires", kind: "readonly", bind: "sam_registration_expiration" },
        { key: "sam_exclusions", label: "Exclusion result", kind: "readonly", bind: "sam_exclusion_flag" },
        { key: "sam_integrity", label: "Integrity records count (FAPIIS)", kind: "readonly", bind: "sam_integrity_count" },
        { key: "sam_checked_at", label: "Check taken", kind: "readonly", bind: "sam_checked_at" },
      ],
    },
    {
      id: "factors",
      title: "Standards of responsibility (FAR 9.104-1)",
      citation: "FAR 9.104-1(a) through (g)",
      tier: "binding",
      standingText: "Address every factor. Mark a factor N/A only where it cannot apply to this requirement.",
      fields: [
        {
          key: "f_financial",
          label: "a. Adequate financial resources, or the ability to obtain them",
          kind: "textarea",
          required: true,
        },
        {
          key: "f_schedule",
          label: "b. Ability to meet the delivery or performance schedule",
          kind: "textarea",
          required: true,
        },
        { key: "f_performance", label: "c. Satisfactory performance record", kind: "textarea", required: true },
        { key: "f_integrity", label: "d. Satisfactory record of integrity and business ethics", kind: "textarea", required: true },
        {
          key: "f_organization",
          label: "e. Necessary organization, experience, accounting and operational controls, and skills",
          kind: "textarea",
          required: true,
        },
        {
          key: "f_equipment",
          label: "f. Necessary production, construction, and technical equipment and facilities",
          kind: "textarea",
          required: true,
        },
        { key: "f_eligibility", label: "g. Otherwise qualified and eligible to receive an award", kind: "textarea", required: true },
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 9.105-2(a)(1)",
      tier: "binding",
      fields: [
        {
          key: "basis",
          label: "Basis for the determination, with the information relied on",
          kind: "textarea",
          required: true,
          help: "FAR 9.105-2(a)(1): the determination states the basis and is signed by the contracting officer.",
        },
        {
          key: "sba_referral",
          label: "Small business: referred to the Small Business Administration for a Certificate of Competency",
          kind: "select",
          options: ["Yes, referred under FAR 19.602-1", "No, the vendor is not a small business", "No, the finding is not one of the referable factors"],
          required: true,
        },
        {
          key: "statement",
          label: "Determination statement",
          kind: "textarea",
          required: true,
          help: "Plain statement that the prospective contractor is nonresponsible for this acquisition.",
        },
        { key: "determined_on", label: "Date of determination", kind: "date", required: true },
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting officer",
    citation: "FAR 9.105-2(a)(1)",
    blocks: ["Contracting officer", "Date"],
    note: "Signed by the contracting officer and placed in the contract file (FAR 9.105-2(b); FAR 4.801).",
  }),
};

// ------------------------------------------- Price Negotiation Memorandum
// The PNM records the price reasonableness the contracting officer reaches
// under RFO FAR 12.204(a); FAR 13.106-3 applies where simplified procedures do.
const pnm: TemplateDef = {
  key: "pnm",
  name: "Price Negotiation Memorandum (PNM)",
  tab: "065",
  badge: {
    citation: "RFO FAR 12.204(a); FAR 13.106-3(b)(3) simplified, FAR 15.406-3 part 15",
    citationFor: (v) =>
      simplifiedValues(v)
        ? "RFO FAR 12.204(a); FAR 13.106-3(b)(3)"
        : "FAR 15.406-3",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2026-04-07",
    note: "This memorandum records the price reasonableness finding under RFO FAR 12.204(a). No separate price reasonableness determination is generated.",
  },
  lead: "Price negotiation memorandum, pre-filled from the record, the IGCE, and the quote.",
  sections: [
    {
      id: "header",
      title: "Acquisition and vendor",
      citation: "FAR 13.106-3(b)(3) simplified, FAR 15.406-3(a)(1) part 15",
      citationFor: (v) => (simplifiedValues(v) ? "FAR 13.106-3(b)(3)" : "FAR 15.406-3(a)(1)"),
      tier: "binding",
      fields: [
        { key: "acquisition_id", label: "Acquisition", kind: "readonly", bind: "acquisition_id" },
        { key: "title", label: "Requirement", kind: "text", bind: "title", required: true },
        { key: "center_code", label: "Center", kind: "text", bind: "center_code" },
        { key: "pr_number", label: "Requisition number", kind: "text", bind: "pr_number" },
        { key: "naics_code", label: "NAICS", kind: "text", bind: "naics_code" },
        { key: "psc_code", label: "PSC", kind: "text", bind: "psc_code" },
        { key: "contract_type", label: "Contract type", kind: "text", bind: "contract_type", required: true },
        { key: "competition", label: "Extent of competition", kind: "text", bind: "competition" },
        { key: "vendor_legal_name", label: "Vendor legal name", kind: "text", bind: "sam_legal_name", required: true },
        { key: "vendor_uei", label: "Unique Entity Identifier (UEI)", kind: "text", bind: "sam_uei" },
        { key: "vendor_cage", label: "CAGE code", kind: "text", bind: "sam_cage" },
      ],
    },
    {
      id: "pricing",
      title: "Government estimate and quoted price",
      citation: "FAR 13.106-3(b)(3) simplified, FAR 15.406-3(a)(7) part 15",
      citationFor: (v) => (simplifiedValues(v) ? "FAR 13.106-3(b)(3)" : "FAR 15.406-3(a)(7)"),
      tier: "binding",
      standingText:
        "The independent government cost estimate and the quote of record are the starting point for the analysis.",
      fields: [
        { key: "igce_amount", label: "Independent government cost estimate (IGCE)", kind: "money", bind: "igce_amount", required: true },
        { key: "igce_attached", label: "IGCE attached to the file", kind: "readonly", bind: "igce_attached" },
        { key: "igce_basis", label: "Basis of the IGCE", kind: "textarea", required: true },
        { key: "quoted_price", label: "Quoted price", kind: "money", bind: "quoted_price", required: true },
        { key: "estimated_value", label: "Estimated value of record", kind: "readonly", bind: "estimated_value" },
        { key: "negotiated_price", label: "Negotiated price", kind: "money", required: true },
        {
          key: "price_variance",
          label: "Difference from the IGCE, and why",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "comparables",
      title: "Comparable prior awards",
      citation: "FAR 13.106-3(a)(2)(ii); FAR 15.404-1(b)(2)(ii)",
      citationFor: (v) => (simplifiedValues(v) ? "FAR 13.106-3(a)(2)(ii)" : "FAR 15.404-1(b)(2)(ii)"),
      tier: "binding",
      standingText:
        "Run comparables to pull prior awards for this NAICS and PSC between half and double the estimated value. Prior awards support the comparison; they do not replace the contracting officer's judgment.",
      fields: [
        {
          key: "comparables_summary",
          label: "Comparable awards relied on",
          kind: "textarea",
          required: true,
          help: "Filled by the comparables table below. Edit it to state what the comparison shows.",
        },
      ],
    },
    {
      id: "analysis",
      title: "Price analysis and negotiation",
      citation: "FAR 13.106-3(b)(3) simplified, FAR 15.406-3(a)(7) through (a)(11) part 15",
      citationFor: (v) => (simplifiedValues(v) ? "FAR 13.106-3(a); FAR 13.106-3(b)(3)" : "FAR 15.406-3(a)(7) through (a)(11)"),
      tier: "binding",
      fields: [
        {
          key: "technique",
          label: "Price analysis technique used",
          kind: "select",
          required: true,
          options: [
            "Comparison of proposed prices received in response to the solicitation",
            "Comparison with prior prices paid for the same or similar items",
            "Comparison with the independent government cost estimate",
            "Comparison with published price lists or market prices",
            "Analysis of data other than certified cost or pricing data",
          ],
        },
        { key: "negotiation_summary", label: "Summary of the negotiation, including concessions", kind: "textarea", required: true },
        {
          key: "cost_pricing_data",
          label: "Certified cost or pricing data",
          kind: "select",
          required: true,
          options: [
            "Not required; commercial products or services (FAR 15.403-1(b)(3))",
            "Not required; adequate price competition",
            "Required and obtained",
          ],
        },
      ],
    },
    {
      id: "determination",
      title: "Determination of price reasonableness",
      citation: "RFO FAR 12.204(a); FAR 13.106-3",
      tier: "binding",
      standingText:
        "The contracting officer records the price reasonableness finding here under RFO FAR 12.204(a). No separate price reasonableness determination is written.",
      fields: [
        {
          key: "determination",
          label: "Determination statement",
          kind: "textarea",
          required: true,
          help: "Plain statement that the negotiated price is fair and reasonable, and the basis for it.",
        },
        { key: "determined_on", label: "Date of determination", kind: "date", required: true },
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting officer",
    citation: "FAR 13.106-3(b)(3)",
    blocks: ["Contracting officer", "Date"],
    note: "Signed by the contracting officer and placed in the contract file (FAR 4.801).",
  }),
};

// ------------------------------------------------ Determinations library (E2)
const coSignature = (citation: string, note?: string) => (): SignatureBlock => ({
  tierLabel: "Contracting officer",
  citation,
  blocks: ["Contracting officer", "Date"],
  note: note ?? "Signed and placed in the contract file (FAR 4.801).",
});

const acquisitionHeader = (): SectionDef => ({
  id: "header",
  title: "Acquisition",
  citation: "T-Minus record",
  tier: "guidance",
  fields: [
    { key: "acquisition_id", label: "Acquisition", kind: "readonly", bind: "acquisition_id" },
    { key: "title", label: "Requirement", kind: "text", bind: "title", required: true },
    { key: "center_code", label: "Center", kind: "text", bind: "center_code" },
    { key: "pr_number", label: "Requisition number", kind: "text", bind: "pr_number" },
    { key: "mission_id", label: "Mission supported", kind: "text", bind: "mission_id" },
    { key: "estimated_value", label: "Estimated value", kind: "money", bind: "estimated_value" },
    { key: "naics_code", label: "NAICS", kind: "text", bind: "naics_code" },
    { key: "psc_code", label: "PSC", kind: "text", bind: "psc_code" },
    { key: "contract_type", label: "Contract type", kind: "text", bind: "contract_type" },
    { key: "competition", label: "Extent of competition", kind: "text", bind: "competition" },
    { key: "co_name", label: "Contracting officer", kind: "text", bind: "co_name" },
  ],
});

// 1. Commerciality Determination and Findings
const commerciality: TemplateDef = {
  key: "commerciality",
  name: "Commerciality Determination and Findings",
  tab: "N/A",
  badge: {
    citation: "FAR 2.101; FAR 10.002(e); FAR 12.102",
    tier: "binding",
    revision: "T-Minus form; no HQ template issued",
    note: "No HQ template exists for this determination in the NF 1098 list; the form follows FAR 2.101 and FAR 10.002(e).",
  },
  lead: "Determination that the requirement is a commercial product or service, with the market research findings behind it.",
  sections: [
    acquisitionHeader(),
    {
      id: "requirement",
      title: "Requirement",
      citation: "FAR 10.002(b)",
      tier: "binding",
      fields: [
        {
          key: "requirement_description",
          label: "Description of the requirement",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
        {
          key: "commercial_determination",
          label: "Determination of record on the acquisition",
          kind: "readonly",
          bind: "commercial_determination",
        },
      ],
    },
    {
      id: "category",
      title: "Category determined",
      citation: "FAR 2.101 definitions",
      tier: "binding",
      fields: [
        {
          key: "category",
          label: "Category",
          kind: "select",
          required: true,
          options: [
            "Commercial product (FAR 2.101 'commercial product')",
            "Commercial service (FAR 2.101 'commercial service')",
            "Commercially available off-the-shelf item (FAR 2.101 'COTS')",
            "Service offered and sold competitively at catalog or market prices (FAR 2.101(6))",
            "Not commercial",
          ],
        },
        {
          key: "cots_basis",
          label: "Basis for the COTS conclusion",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["category"] ?? "").includes("COTS"),
        },
        {
          key: "catalog_basis",
          label: "Catalog or market price evidence, and the terms sold to the general public",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["category"] ?? "").includes("catalog"),
        },
        {
          key: "noncommercial_basis",
          label: "Why the requirement is not commercial, and the procedures to be used instead",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["category"] ?? "") === "Not commercial",
          help: "A noncommercial conclusion moves the acquisition off FAR Part 12 procedures.",
        },
      ],
    },
    {
      id: "findings",
      title: "Findings",
      citation: "FAR 10.002(e); FAR 12.102",
      tier: "binding",
      standingText: "Market research supports the determination; the file records the research and its results.",
      fields: [
        { key: "market_research", label: "Market research conducted and the results", kind: "textarea", required: true },
        { key: "customary_practice", label: "Customary commercial practice and any tailoring", kind: "textarea", required: true },
        {
          key: "procedures",
          label: "Procedures to be used",
          kind: "select",
          required: true,
          options: [
            "FAR Part 12 with FAR 13.5 simplified procedures",
            "FAR Part 12 with FAR Part 15 procedures",
            "FAR Part 12 with FAR Part 13 simplified acquisition procedures",
            "Not applicable; the requirement is not commercial",
          ],
        },
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 12.102",
      tier: "binding",
      fields: [
        { key: "determination", label: "Determination statement", kind: "textarea", required: true },
        { key: "determined_on", label: "Date of determination", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 12.102"),
};

// 2. Fair Opportunity Exception - Brand Name Justification (tab 072)
const fairOpportunity: TemplateDef = {
  key: "fair-opportunity-brand-name",
  name: "Fair Opportunity Exception - Brand Name Justification",
  tab: "072",
  badge: {
    citation: "FAR 16.505(b)(2); FAR 11.105; FAR 8.405-6",
    tier: "guidance",
    revision: "HQ 04/2026 revision, effective 4/10/2026",
    effective: "2026-04-10",
    note: "Fair opportunity exception for an order, and the brand name justification where a brand name is specified.",
  },
  lead: "Exception to fair opportunity, or the justification for specifying a brand name.",
  sections: [
    acquisitionHeader(),
    {
      id: "vehicle",
      title: "Order and vehicle",
      citation: "FAR 16.505(b)(2)",
      tier: "binding",
      fields: [
        { key: "vehicle", label: "Contract or schedule the order is placed against", kind: "text", required: true },
        { key: "contractor_name", label: "Proposed contractor", kind: "text", bind: "vendor_legal_name" },
        { key: "order_value", label: "Order value", kind: "money", bind: "estimated_value", required: true },
        { key: "pop_start", label: "Period of performance start", kind: "date", bind: "period_of_performance_start" },
        { key: "pop_end", label: "Period of performance end", kind: "date", bind: "period_of_performance_end" },
      ],
    },
    {
      id: "exception",
      title: "Exception relied on",
      citation: "FAR 16.505(b)(2)(i)",
      tier: "binding",
      fields: [
        {
          key: "exception",
          label: "Exception",
          kind: "select",
          required: true,
          options: [
            "Urgency, FAR 16.505(b)(2)(i)(A)",
            "Only one capable source, FAR 16.505(b)(2)(i)(B)",
            "Logical follow-on, FAR 16.505(b)(2)(i)(C)",
            "Minimum guarantee, FAR 16.505(b)(2)(i)(D)",
            "Required by statute, FAR 16.505(b)(2)(i)(E)",
            "Brand name only; fair opportunity given, FAR 11.105",
          ],
        },
        { key: "exception_rationale", label: "Why the exception applies", kind: "textarea", required: true },
        {
          key: "urgency_harm",
          label: "Harm to the Government from delay",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["exception"] ?? "").startsWith("Urgency"),
        },
        {
          key: "follow_on_basis",
          label: "Original order, its competition, and why this is a logical follow-on",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["exception"] ?? "").startsWith("Logical follow-on"),
        },
      ],
    },
    {
      id: "brand",
      title: "Brand name justification",
      citation: "FAR 11.105; FAR 8.405-6(b)",
      tier: "binding",
      showIf: (v) => (v["brand_name_required"] ?? "") === "Yes",
      fields: [
        { key: "brand_item", label: "Brand name item or service specified", kind: "text", required: true },
        {
          key: "salient_characteristics",
          label: "Essential characteristics that only the brand name meets",
          kind: "textarea",
          required: true,
        },
        {
          key: "no_equal",
          label: "Why an 'or equal' product will not meet the need",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "flags",
      title: "Brand name",
      citation: "FAR 11.105",
      tier: "binding",
      fields: [
        {
          key: "brand_name_required",
          label: "Does this order specify a brand name?",
          kind: "select",
          required: true,
          options: ["Yes", "No"],
        },
      ],
    },
    {
      id: "price",
      title: "Price and posting",
      citation: "FAR 16.505(b)(2)(ii)(D); FAR 5.301",
      tier: "binding",
      fields: [
        { key: "price_basis", label: "Determination that the price is fair and reasonable", kind: "textarea", required: true },
        { key: "posting", label: "Public posting of the justification, or the reason none is required", kind: "textarea", required: true },
        { key: "determined_on", label: "Date", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 16.505(b)(2)(ii)(D)"),
};

// 3a. Option Justification (tab 024)
const optionJustification: TemplateDef = {
  key: "option-justification",
  name: "Option Justification",
  tab: "024",
  badge: {
    citation: "FAR 17.205(a); FAR 17.202",
    tier: "guidance",
    revision: "HQ 07/2026 revision, effective 7/21/2026",
    effective: "2026-07-21",
    note: "Written before the solicitation includes options.",
  },
  lead: "Justification for including options in the solicitation.",
  sections: [
    acquisitionHeader(),
    {
      id: "options",
      title: "Options proposed",
      citation: "FAR 17.202",
      tier: "binding",
      fields: [
        { key: "option_description", label: "Quantities or periods proposed as options", kind: "textarea", required: true },
        { key: "base_period", label: "Base period", kind: "text", required: true },
        { key: "option_periods", label: "Number of option periods", kind: "text", required: true },
        { key: "total_value", label: "Total value including options", kind: "money", required: true },
      ],
    },
    {
      id: "basis",
      title: "Basis for the options",
      citation: "FAR 17.202(a) and (b)",
      tier: "binding",
      fields: [
        { key: "government_interest", label: "How options are in the Government's interest", kind: "textarea", required: true },
        { key: "need_foreseeable", label: "Foreseeable requirement and funding outlook", kind: "textarea", required: true },
        {
          key: "not_used",
          label: "Confirmation the options are not used to avoid competition or to induce below-cost offers",
          kind: "textarea",
          required: true,
          help: "FAR 17.202(c) bars options where the contractor would be given an unfair advantage.",
        },
      ],
    },
    {
      id: "determination",
      title: "Justification",
      citation: "FAR 17.205(a)",
      tier: "binding",
      fields: [
        { key: "determination", label: "Justification statement", kind: "textarea", required: true },
        { key: "determined_on", label: "Date", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 17.205(a)"),
};

// 3b. Option Exercise Determination (tab 24)
const optionExercise: TemplateDef = {
  key: "option-exercise-determination",
  name: "Option Exercise Determination",
  tab: "24",
  badge: {
    citation: "FAR 17.207(c) and (d); FAR 17.207(f)",
    tier: "binding",
    revision: "HQ 07/2026 revision, effective 7/21/2026",
    effective: "2026-07-21",
    note: "Written before the option is exercised. The preliminary notification to the contractor (tab 072) precedes it.",
  },
  lead: "Determination that exercising the option is the most advantageous method of fulfilling the need.",
  sections: [
    acquisitionHeader(),
    {
      id: "option",
      title: "Option being exercised",
      citation: "FAR 17.207(a)",
      tier: "binding",
      fields: [
        { key: "contract_number", label: "Contract or order number", kind: "text", required: true },
        { key: "contractor_name", label: "Contractor", kind: "text", bind: "vendor_legal_name", required: true },
        { key: "option_period", label: "Option period or quantity being exercised", kind: "text", required: true },
        { key: "option_value", label: "Value of the option", kind: "money", required: true },
        { key: "new_pop_end", label: "New period of performance end", kind: "date", required: true },
      ],
    },
    {
      id: "findings",
      title: "Findings",
      citation: "FAR 17.207(c) and (d)",
      tier: "binding",
      fields: [
        { key: "funds_available", label: "Funds are available", kind: "textarea", required: true },
        { key: "still_needed", label: "The requirement covered by the option still exists", kind: "textarea", required: true },
        {
          key: "method",
          label: "Basis that the option is the most advantageous method",
          kind: "select",
          required: true,
          options: [
            "Informal analysis of prices or an examination of the market, FAR 17.207(d)(1)",
            "A new solicitation failed to produce a better price or a more advantageous offer, FAR 17.207(d)(2)",
            "The time between award and exercise is short and the market is stable, FAR 17.207(d)(3)",
          ],
        },
        { key: "method_basis", label: "Support for that basis", kind: "textarea", required: true },
        { key: "price_reasonable", label: "The option price is fair and reasonable", kind: "textarea", required: true },
        {
          key: "synopsis",
          label: "Synopsis of the option, or the exception relied on",
          kind: "textarea",
          required: true,
          help: "FAR 17.207(f): the option was synopsized under FAR Part 5 unless an exception applies.",
        },
      ],
    },
    {
      id: "notice",
      title: "Preliminary notification to the contractor",
      citation: "FAR 17.207(a); NF 1098 tab 072",
      tier: "binding",
      fields: [
        { key: "notice_sent", label: "Preliminary notification sent", kind: "select", required: true, options: ["Yes", "No"] },
        { key: "notice_date", label: "Date of the preliminary notification", kind: "date", required: true, showIf: (v) => (v["notice_sent"] ?? "") === "Yes" },
        {
          key: "notice_reason",
          label: "Why no preliminary notification was sent",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["notice_sent"] ?? "") === "No",
        },
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 17.207(c)",
      tier: "binding",
      fields: [
        { key: "determination", label: "Determination statement", kind: "textarea", required: true },
        { key: "determined_on", label: "Date", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 17.207(c)"),
};

// 3c. Option Exercise Contractor Preliminary Notification (tab 072)
const optionNotification: TemplateDef = {
  key: "option-exercise-notification",
  name: "Option Exercise Contractor Preliminary Notification",
  tab: "072",
  badge: {
    citation: "FAR 17.207(a)",
    tier: "guidance",
    revision: "HQ 07/2026 revision, effective 7/21/2026",
    effective: "2026-07-21",
    note: "Preliminary written notice of the Government's intent to exercise an option. It does not commit the Government.",
  },
  lead: "Preliminary notice to the contractor of the intent to exercise an option.",
  sections: [
    acquisitionHeader(),
    {
      id: "letter",
      title: "Notice",
      citation: "FAR 17.207(a)",
      tier: "binding",
      standingText:
        "This notice is preliminary and does not obligate the Government to exercise the option or to place any order.",
      fields: [
        { key: "contract_number", label: "Contract or order number", kind: "text", required: true },
        { key: "contractor_name", label: "Contractor", kind: "text", bind: "vendor_legal_name", required: true },
        { key: "contractor_address", label: "Contractor address", kind: "textarea" },
        { key: "option_period", label: "Option period or quantity", kind: "text", required: true },
        { key: "intended_date", label: "Date the option is expected to be exercised", kind: "date", required: true },
        { key: "clause", label: "Option clause relied on", kind: "text", required: true, help: "For example FAR 52.217-9." },
        { key: "co_name", label: "Contracting officer", kind: "text", bind: "co_name", required: true },
        { key: "notice_date", label: "Date of this notice", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 17.207(a)", "Signed by the contracting officer and placed in the contract file (FAR 4.801)."),
};

// 4a/4b. Consolidation and bundling determinations (tab 002)
const consolidationSections = (kind: "consolidation" | "bundling"): SectionDef[] => [
  acquisitionHeader(),
  {
    id: "requirement",
    title: "Requirements being combined",
    citation: kind === "consolidation" ? "FAR 7.107-2" : "FAR 7.107-3",
    tier: "binding",
    fields: [
      { key: "requirement_description", label: "Requirements proposed for combination", kind: "textarea", bind: "description_of_requirement", required: true },
      { key: "prior_contracts", label: "Prior contracts, their values, and the small businesses performing them", kind: "textarea", required: true },
      { key: "total_value", label: "Total value of the combined requirement", kind: "money", bind: "estimated_value", required: true },
      { key: "set_aside", label: "Set-aside of record", kind: "readonly", bind: "set_aside" },
    ],
  },
  {
    id: "market",
    title: "Market research and alternatives",
    citation: "FAR 7.107-1(b); FAR Part 10",
    tier: "binding",
    fields: [
      { key: "market_research", label: "Market research and its results", kind: "textarea", required: true },
      { key: "alternatives", label: "Alternative approaches considered, with less impact on small business", kind: "textarea", required: true },
      { key: "sba_coordination", label: "Coordination with the small business specialist and the SBA PCR", kind: "textarea", required: true },
    ],
  },
  kind === "consolidation"
    ? {
        id: "benefits",
        title: "Measurably substantial benefits",
        citation: "FAR 7.107-2(b) and (c)",
        tier: "binding",
        standingText:
          "Benefits must be quantified: cost savings or price reduction, quality improvements, reduced acquisition cycle times, better terms and conditions, or other benefits.",
        fields: [
          { key: "benefit_cost", label: "Cost savings or price reduction, quantified", kind: "textarea", required: true },
          { key: "benefit_quality", label: "Quality improvements", kind: "textarea", required: true },
          { key: "benefit_cycle", label: "Reduced acquisition cycle time", kind: "textarea", required: true },
          { key: "benefit_other", label: "Other benefits, or none", kind: "textarea", required: true },
          {
            key: "benefit_threshold",
            label: "Benefit test met",
            kind: "select",
            required: true,
            options: [
              "Benefits equal or exceed 10 percent of the estimated contract value where that value is $94 million or less",
              "Benefits equal or exceed 5 percent of the estimated contract value or $9.4 million, whichever is greater, where that value exceeds $94 million",
              "Benefits are not measurably substantial; the consolidation will not proceed",
            ],
          },
        ],
      }
    : {
        id: "benefits",
        title: "Measurably substantial benefits of bundling",
        citation: "FAR 7.107-3(d) and (e)",
        tier: "binding",
        fields: [
          { key: "benefit_cost", label: "Cost savings or price reduction, quantified", kind: "textarea", required: true },
          { key: "benefit_quality", label: "Quality improvements", kind: "textarea", required: true },
          { key: "benefit_cycle", label: "Reduced acquisition cycle time", kind: "textarea", required: true },
          { key: "benefit_other", label: "Better terms and conditions, or other benefits", kind: "textarea", required: true },
          {
            key: "benefit_threshold",
            label: "Benefit test met",
            kind: "select",
            required: true,
            options: [
              "Benefits equal or exceed 10 percent of the estimated contract value where that value is $94 million or less",
              "Benefits equal or exceed 5 percent of the estimated contract value or $9.4 million, whichever is greater, where that value exceeds $94 million",
              "Substantial bundling; the additional content at FAR 7.107-4 is included below",
            ],
          },
          {
            key: "substantial_bundling",
            label: "Substantial bundling content: specific benefits, alternative strategies, and impediments",
            kind: "textarea",
            required: true,
            showIf: (v) => (v["benefit_threshold"] ?? "").startsWith("Substantial bundling"),
            help: "FAR 7.107-4 applies to substantial bundling.",
          },
        ],
      },
  {
    id: "mitigation",
    title: "Small business impact and mitigation",
    citation: "FAR 7.107-1(c); FAR 7.107-5",
    tier: "binding",
    fields: [
      { key: "impact", label: "Impact on small business participation", kind: "textarea", required: true },
      { key: "mitigation", label: "Actions to maximize small business participation, including subcontracting", kind: "textarea", required: true },
      { key: "notification", label: "Notification to affected small businesses and to the SBA", kind: "textarea", required: true },
    ],
  },
  {
    id: "determination",
    title: "Determination",
    citation: kind === "consolidation" ? "FAR 7.107-2(a)" : "FAR 7.107-3(a)",
    tier: "binding",
    fields: [
      { key: "determination", label: "Determination statement", kind: "textarea", required: true },
      { key: "determined_on", label: "Date", kind: "date", required: true },
    ],
  },
];

const consolidation: TemplateDef = {
  key: "consolidation-determination",
  name: "Determination and Findings for Consolidation of Requirements",
  tab: "002",
  badge: {
    citation: "FAR 7.107-1; FAR 7.107-2; 15 U.S.C. 657q",
    tier: "binding",
    revision: "HQ 04/2026 revision, effective 4/21/2026",
    effective: "2026-04-21",
    note: "Required where the total value of a consolidated requirement exceeds $2 million.",
  },
  lead: "Determination that consolidating these requirements is necessary and justified.",
  sections: consolidationSections("consolidation"),
  signature: coSignature("FAR 7.107-1(a); senior procurement executive approval where required"),
};

const bundling: TemplateDef = {
  key: "bundling-determination",
  name: "Determination and Findings for Bundled Requirements",
  tab: "002",
  badge: {
    citation: "FAR 7.107-1; FAR 7.107-3; FAR 7.107-4",
    tier: "binding",
    revision: "HQ 04/2026 revision, effective 4/21/2026",
    effective: "2026-04-21",
    note: "Bundling requires measurably substantial benefits; substantial bundling adds the FAR 7.107-4 content.",
  },
  lead: "Determination that bundling these requirements is necessary and justified.",
  sections: consolidationSections("bundling"),
  signature: coSignature("FAR 7.107-1(a); approval at the level required by FAR 7.107-3"),
};

// 5. Determination and Findings Interagency Acquisitions Economy Act (tab 003)
const economyAct: TemplateDef = {
  key: "economy-act-determination",
  name: "Determination and Findings Interagency Acquisitions Economy Act",
  tab: "003",
  badge: {
    citation: "FAR 17.502-2(c); 31 U.S.C. 1535",
    tier: "binding",
    revision: "HQ 04/2026 revision, effective 4/21/2026",
    effective: "2026-04-21",
    note: "Each Economy Act order is supported by a determination and findings signed before the order is placed.",
  },
  lead: "Determination supporting an Economy Act order to another agency.",
  sections: [
    acquisitionHeader(),
    {
      id: "order",
      title: "Order",
      citation: "FAR 17.502-2(b)",
      tier: "binding",
      fields: [
        { key: "servicing_agency", label: "Servicing agency and office", kind: "text", required: true },
        { key: "requesting_office", label: "Requesting NASA office", kind: "text", bind: "requester_org_code", required: true },
        { key: "supplies_services", label: "Supplies or services ordered", kind: "textarea", bind: "description_of_requirement", required: true },
        { key: "order_amount", label: "Amount of the order", kind: "money", bind: "estimated_value", required: true },
        { key: "pop_start", label: "Period of performance start", kind: "date", bind: "period_of_performance_start" },
        { key: "pop_end", label: "Period of performance end", kind: "date", bind: "period_of_performance_end" },
      ],
    },
    {
      id: "findings",
      title: "Findings",
      citation: "FAR 17.502-2(c)(1) and (c)(2)",
      tier: "binding",
      fields: [
        { key: "funds_available", label: "Funds are available", kind: "textarea", required: true },
        { key: "best_interest", label: "The order is in the best interest of the Government", kind: "textarea", required: true },
        {
          key: "capability",
          label: "The servicing agency is able to provide or obtain the supplies or services by contract",
          kind: "textarea",
          required: true,
        },
        {
          key: "not_more_conveniently",
          label: "The supplies or services cannot be obtained as conveniently or economically by contracting directly with a private source",
          kind: "textarea",
          required: true,
        },
        {
          key: "assisted",
          label: "Type of interagency acquisition",
          kind: "select",
          required: true,
          options: ["Direct acquisition", "Assisted acquisition"],
        },
        {
          key: "agreement",
          label: "Interagency agreement covering roles, responsibilities, and funding",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["assisted"] ?? "") === "Assisted acquisition",
          help: "FAR 17.502-1(b)(1) requires a written interagency agreement for assisted acquisitions.",
        },
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 17.502-2(c)",
      tier: "binding",
      fields: [
        { key: "determination", label: "Determination statement", kind: "textarea", required: true },
        { key: "determined_on", label: "Date", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 17.502-2(c)(2)", "Approved by the contracting officer of the requesting agency, or a higher official as required."),
};

// 6. D&F Commercial Time and Materials or Labor Hour Contract / Order (tab 003)
const commercialTmLh: TemplateDef = {
  key: "commercial-tm-lh-determination",
  name: "Determination and Findings Commercial Time and Materials or Labor Hour Contract / Order",
  tab: "003",
  badge: {
    citation: "FAR 12.207(b); FAR 16.601(d)",
    tier: "binding",
    revision: "HQ 04/2026 revision, effective 4/20/2026",
    effective: "2026-04-20",
    note: "A commercial time-and-materials or labor-hour contract may be used only for the services at FAR 12.207(b)(1) and only with this determination.",
  },
  lead: "Determination supporting a commercial time-and-materials or labor-hour contract or order.",
  sections: [
    acquisitionHeader(),
    {
      id: "contract",
      title: "Contract type proposed",
      citation: "FAR 12.207(b)(1)",
      tier: "binding",
      fields: [
        {
          key: "type",
          label: "Type proposed",
          kind: "select",
          required: true,
          options: ["Time-and-materials", "Labor-hour"],
        },
        {
          key: "service_category",
          label: "Service category",
          kind: "select",
          required: true,
          options: [
            "Commercial services acquired for support of a commercial product, FAR 12.207(b)(1)(i)",
            "Emergency repair services, FAR 12.207(b)(1)(ii)(A)",
            "Any other commercial service acquired under FAR 12.207(b)(1)(ii)(B)",
          ],
        },
        { key: "ceiling_price", label: "Ceiling price", kind: "money", required: true, help: "FAR 12.207(b)(2): the contract must contain a ceiling price the contractor exceeds at its own risk." },
        { key: "service_description", label: "Services to be performed", kind: "textarea", bind: "description_of_requirement", required: true },
      ],
    },
    {
      id: "findings",
      title: "Findings",
      citation: "FAR 12.207(b)(1)(ii)(B) and (b)(1)(ii)(C); FAR 16.601(d)",
      tier: "binding",
      fields: [
        {
          key: "no_other_type",
          label: "Why no other contract type is suitable",
          kind: "textarea",
          required: true,
        },
        {
          key: "cannot_estimate",
          label: "Why the extent or duration of the work cannot be estimated with any reasonable degree of confidence",
          kind: "textarea",
          required: true,
        },
        {
          key: "market_research",
          label: "Market research supporting the type and the labor categories and rates",
          kind: "textarea",
          required: true,
        },
        {
          key: "competition_basis",
          label: "Basis on which the price was determined fair and reasonable",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["service_category"] ?? "").includes("(b)(1)(ii)(B)"),
          help: "FAR 12.207(b)(1)(ii)(B) applies where the service is acquired under a competed solicitation or under FAR 8.4 or 16.5 procedures.",
        },
        {
          key: "surveillance",
          label: "Government surveillance plan giving reasonable assurance of efficient methods and effective cost controls",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 12.207(b)(1)(ii)(C)",
      tier: "binding",
      fields: [
        { key: "determination", label: "Determination statement", kind: "textarea", required: true },
        { key: "determined_on", label: "Date", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 12.207(b)(1)(ii)(C)", "Executed by the contracting officer before the contract or order is awarded, and placed in the contract file (FAR 4.801)."),
};

// -------------------------------------------------- Post-award forms (E3)

const corAppointment: TemplateDef = {
  key: "cor-appointment",
  name: "Recommendation for Appointment of COR or Alternate COR",
  tab: "074",
  badge: {
    citation: "FAR 1.602-2(d); NFS 1801.670; NFS CG 1842.2",
    tier: "binding",
    revision: "HQ 05/2026 revision, effective 5/22/2026",
    effective: "2026-05-22",
    note: "The contracting officer appoints the representative in writing and states the limits of the delegation.",
  },
  lead: "Recommendation and appointment of a contracting officer's representative.",
  sections: [
    acquisitionHeader(),
    {
      id: "appointee",
      title: "Person recommended",
      citation: "FAR 1.602-2(d)(1)",
      tier: "binding",
      fields: [
        { key: "cor_name", label: "Name", kind: "text", bind: "cor_name", required: true },
        {
          key: "cor_type",
          label: "Appointment",
          kind: "select",
          required: true,
          options: ["Contracting officer's representative", "Alternate contracting officer's representative"],
        },
        { key: "cor_org", label: "Organization code", kind: "text", required: true },
        { key: "cor_email", label: "Email", kind: "text", required: true },
        { key: "cor_phone", label: "Telephone", kind: "text" },
        { key: "contract_number", label: "Contract or order number", kind: "text", required: true },
        { key: "effective_date", label: "Effective date of the appointment", kind: "date", required: true },
      ],
    },
    {
      id: "qualifications",
      title: "Qualifications",
      citation: "FAR 1.602-2(d)(2); NFS CG 1842.2",
      tier: "binding",
      fields: [
        { key: "training", label: "FAC-COR certification level and training completed", kind: "textarea", required: true },
        { key: "experience", label: "Technical experience relevant to this requirement", kind: "textarea", required: true },
        {
          key: "coi",
          label: "No conflict of interest exists",
          kind: "select",
          required: true,
          options: ["No conflict of interest identified", "A conflict was identified and resolved as described below"],
        },
        {
          key: "coi_detail",
          label: "Conflict identified and how it was resolved",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["coi"] ?? "").startsWith("A conflict"),
        },
      ],
    },
    {
      id: "authority",
      title: "Scope of the delegation",
      citation: "FAR 1.602-2(d)(3) and (d)(5)",
      tier: "binding",
      standingText:
        "The representative may not make any commitment or change that affects price, quality, quantity, delivery, or other terms. Only the contracting officer may change the contract.",
      fields: [
        { key: "duties", label: "Duties delegated", kind: "textarea", required: true },
        { key: "limits", label: "Limits on the delegation", kind: "textarea", required: true },
        { key: "file_copy", label: "Copy furnished to the contractor and filed in the contract file", kind: "textarea", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 1.602-2(d)", "Signed by the contracting officer; a copy goes to the representative and the contractor."),
};

const corCancellation: TemplateDef = {
  key: "cor-cancellation",
  name: "Contracting Officers Representative (COR)-Alternate COR Cancellation Memorandum",
  tab: "074",
  badge: {
    citation: "FAR 1.602-2(d); NFS CG 1842.2",
    tier: "binding",
    revision: "HQ 05/2026 revision, effective 5/22/2026",
    effective: "2026-05-22",
    note: "Cancels an appointment made under FAR 1.602-2(d). The contractor is notified.",
  },
  lead: "Cancellation of a contracting officer's representative appointment.",
  sections: [
    acquisitionHeader(),
    {
      id: "cancel",
      title: "Appointment being cancelled",
      citation: "FAR 1.602-2(d)",
      tier: "binding",
      fields: [
        { key: "cor_name", label: "Name of the representative", kind: "text", bind: "cor_name", required: true },
        {
          key: "cor_type",
          label: "Appointment cancelled",
          kind: "select",
          required: true,
          options: ["Contracting officer's representative", "Alternate contracting officer's representative"],
        },
        { key: "contract_number", label: "Contract or order number", kind: "text", required: true },
        { key: "appointed_on", label: "Date of the original appointment", kind: "date" },
        { key: "cancel_date", label: "Cancellation effective date", kind: "date", required: true },
        {
          key: "reason",
          label: "Reason for the cancellation",
          kind: "select",
          required: true,
          options: ["Reassignment", "Separation from the agency", "Contract completion", "Performance", "Other"],
        },
        { key: "reason_detail", label: "Detail", kind: "textarea" },
      ],
    },
    {
      id: "transition",
      title: "Transition",
      citation: "FAR 4.801; NFS CG 1842.2",
      tier: "binding",
      fields: [
        { key: "successor", label: "Successor representative, or none appointed", kind: "text", required: true },
        { key: "records", label: "COR file and records transferred", kind: "textarea", required: true },
        { key: "notified", label: "Contractor notified on", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 1.602-2(d)"),
};

const cparsInput: TemplateDef = {
  key: "cpars-input",
  name: "Contractor Performance Assessment Reporting System (CPARS) Input",
  tab: "099",
  badge: {
    citation: "RFO FAR Part 42 (formerly 42.1502, 42.1503)",
    tier: "binding",
    revision: "HQ 04/2026 revision, effective 4/21/2026",
    effective: "2026-04-21",
    note: "Input to CPARS. CPARS is the system of record; the evaluation is entered there.",
  },
  lead: "Past performance input for the evaluation period, prepared for entry in CPARS.",
  sections: [
    acquisitionHeader(),
    {
      id: "contract",
      title: "Contract and period",
      citation: "RFO FAR Part 42 (formerly 42.1503(f))",
      tier: "binding",
      fields: [
        { key: "contract_number", label: "Contract or order number", kind: "text", required: true },
        { key: "contractor_name", label: "Contractor", kind: "text", bind: "vendor_legal_name", required: true },
        { key: "uei", label: "UEI", kind: "text", bind: "vendor_uei" },
        { key: "period_start", label: "Evaluation period start", kind: "date", required: true },
        { key: "period_end", label: "Evaluation period end", kind: "date", required: true },
        {
          key: "report_type",
          label: "Report type",
          kind: "select",
          required: true,
          options: ["Interim", "Final", "Addendum"],
        },
        { key: "obligated", label: "Amount obligated to date", kind: "money" },
      ],
    },
    {
      id: "ratings",
      title: "Ratings",
      citation: "RFO FAR Part 42 (formerly 42.1503, Table 42-1 and Table 42-2)",
      tier: "binding",
      standingText:
        "Each rating is exceptional, very good, satisfactory, marginal, or unsatisfactory, and each carries a narrative.",
      fields: [
        ...(
          [
            ["quality", "Quality"],
            ["schedule", "Schedule"],
            ["cost_control", "Cost control"],
            ["management", "Management or business relations"],
            ["small_business", "Small business subcontracting"],
            ["other", "Other areas"],
          ] as const
        ).flatMap(([key, label]) => [
          {
            key: `${key}_rating`,
            label: `${label} rating`,
            kind: "select" as const,
            required: key !== "other",
            options: [
              "Exceptional",
              "Very good",
              "Satisfactory",
              "Marginal",
              "Unsatisfactory",
              "Not applicable",
            ],
          },
          { key: `${key}_narrative`, label: `${label} narrative`, kind: "textarea" as const, required: key !== "other" },
        ]),
        {
          key: "recommend",
          label: "Would you recommend this contractor for similar requirements?",
          kind: "select",
          required: true,
          options: ["Yes", "No"],
        },
        {
          key: "recommend_reason",
          label: "Why not",
          kind: "textarea",
          required: true,
          showIf: (v) => (v["recommend"] ?? "") === "No",
        },
      ],
    },
    {
      id: "process",
      title: "Contractor comment period",
      citation: "RFO FAR Part 42 (formerly 42.1503(d))",
      tier: "binding",
      fields: [
        { key: "sent_to_contractor", label: "Date sent to the contractor for comment", kind: "date", required: true },
        { key: "comments_received", label: "Contractor comments received", kind: "textarea" },
        { key: "submitted", label: "Date entered in CPARS", kind: "date" },
      ],
    },
  ],
  signature: coSignature("RFO FAR Part 42", "Signed by the assessing official and entered in CPARS."),
};

const closeoutChecklist: TemplateDef = {
  key: "closeout-checklist",
  name: "Closeout Transfer Checklist",
  tab: "NA",
  badge: {
    citation: "FAR 4.804-5; FAR 4.805",
    tier: "binding",
    revision: "HQ 06/2026 revision, effective 6/10/2026",
    effective: "2026-06-10",
    note: "The checklist that accompanies the contract file when it transfers to records.",
  },
  lead: "Closeout of the contract file and transfer to records.",
  sections: [
    acquisitionHeader(),
    {
      id: "contract",
      title: "Contract",
      citation: "FAR 4.804-1",
      tier: "binding",
      fields: [
        { key: "contract_number", label: "Contract or order number", kind: "text", required: true },
        { key: "contractor_name", label: "Contractor", kind: "text", bind: "vendor_legal_name", required: true },
        { key: "closeout_pr", label: "NASA closeout requisition (PR) number", kind: "text", required: true },
        { key: "final_payment_date", label: "Date of final payment", kind: "date", required: true },
        { key: "deobligated", label: "Excess funds deobligated", kind: "money" },
        { key: "physically_complete", label: "Date physically complete", kind: "date", required: true },
      ],
    },
    {
      id: "steps",
      title: "Closeout steps",
      citation: "FAR 4.804-5(a)",
      tier: "binding",
      standingText: CLOSEOUT_CHECKLIST.join(" "),
      fields: CLOSEOUT_CHECKLIST.map((step, i) => ({
        key: `step_${i + 1}`,
        label: step,
        kind: "select" as const,
        required: true,
        options: ["Complete", "Not applicable", "Open"],
      })),
      },
    {
      id: "retention",
      title: "Transfer and retention",
      citation: "FAR 4.805; NFS CG 1804.8",
      tier: "binding",
      fields: [
        { key: "retention_date", label: "Records retention date", kind: "date", required: true },
        { key: "retention_basis", label: "Basis for the retention date", kind: "textarea", required: true },
        { key: "transferred_to", label: "Records office the file transfers to", kind: "text", required: true },
        { key: "closed_on", label: "Date the file was closed", kind: "date", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 4.804-5(b)", "Signed by the contracting officer closing the file."),
};

// ------------------------------------------------- memoranda issued on NF 1858
const marketResearchMemo: TemplateDef = {
  key: "market-research-memo",
  name: "Market Research Memorandum",
  tab: "N/A",
  badge: {
    citation: "FAR Part 10; NFS 1810",
    tier: "binding",
    revision: "T-Minus form; issued on NF 1858",
    note: "Issued on NASA Form 1858 (Rev 12/24) electronic letterhead.",
  },
  lead: "Records the market research conducted and the conclusions the contracting officer drew from it.",
  sections: [
    acquisitionHeader(),
    {
      id: "purpose",
      title: "Purpose",
      citation: "FAR 10.002(e)",
      tier: "binding",
      fields: [{ key: "purpose", label: "Purpose of this memorandum", kind: "textarea", required: true }],
    },
    {
      id: "requirement",
      title: "Requirement",
      citation: "FAR 10.001",
      tier: "binding",
      fields: [
        {
          key: "requirement",
          label: "The requirement, its schedule and its estimated value",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
      ],
    },
    {
      id: "research",
      title: "Research conducted",
      citation: "FAR 10.002(b)",
      tier: "binding",
      fields: [
        { key: "research", label: "Sources searched, dates and techniques used", kind: "textarea", required: true },
      ],
    },
    {
      id: "findings",
      title: "Findings",
      citation: "FAR 10.002(d)",
      tier: "binding",
      fields: [{ key: "findings", label: "What the research found about each source", kind: "textarea", required: true }],
    },
    {
      id: "commercial",
      title: "Commercial products and services",
      citation: "FAR 10.002(d)(1); FAR 12.102",
      tier: "binding",
      fields: [
        { key: "commercial", label: "Whether commercial products or services meet the need", kind: "textarea", required: true },
      ],
    },
    {
      id: "conclusion",
      title: "Conclusion",
      citation: "FAR 10.002(e)",
      tier: "binding",
      fields: [{ key: "conclusion", label: "Conclusion and the procedures to be used", kind: "textarea", required: true }],
    },
  ],
  signature: coSignature("FAR 10.002(e)"),
};

const waiverDeviation: TemplateDef = {
  key: "waiver-deviation-request",
  name: "Waiver or Deviation Request",
  tab: "N/A",
  badge: {
    citation: "FAR 1.402; NFS 1801.404",
    tier: "binding",
    revision: "T-Minus form; issued on NF 1858",
    note: "Issued on NASA Form 1858 (Rev 12/24) electronic letterhead.",
  },
  lead: "Requests a waiver or a deviation from a regulation, with the authority and the rationale.",
  sections: [
    acquisitionHeader(),
    {
      id: "request",
      title: "Request",
      citation: "FAR 1.402",
      tier: "binding",
      fields: [
        {
          key: "kind",
          label: "Kind of relief requested",
          kind: "select",
          required: true,
          options: ["Individual deviation", "Class deviation", "Waiver"],
        },
        { key: "provision", label: "Regulation or clause the request is from", kind: "text", required: true },
        { key: "relief", label: "Relief requested, stated plainly", kind: "textarea", required: true },
      ],
    },
    {
      id: "rationale",
      title: "Rationale",
      citation: "NFS 1801.404",
      tier: "binding",
      fields: [
        { key: "rationale", label: "Why the relief is needed and the effect on the mission", kind: "textarea", required: true },
        { key: "alternatives", label: "Alternatives considered and why they do not work", kind: "textarea", required: true },
        { key: "period", label: "Period the relief applies to", kind: "text", required: true },
      ],
    },
    {
      id: "approval",
      title: "Approval requested",
      citation: "NFS 1801.404",
      tier: "binding",
      fields: [{ key: "approval_level", label: "Official whose approval is requested", kind: "text", required: true }],
    },
  ],
  signature: coSignature("FAR 1.402"),
};

const coordinationMemo: TemplateDef = {
  key: "coordination-memo",
  name: "Coordination Memorandum",
  tab: "N/A",
  badge: {
    citation: "FAR 4.801; NFS CG 1804.8",
    tier: "guidance",
    revision: "T-Minus form; issued on NF 1858",
    note: "Issued on NASA Form 1858 (Rev 12/24) electronic letterhead.",
  },
  lead: "Records coordination with a requester, a reviewer or another organization, and what was agreed.",
  sections: [
    acquisitionHeader(),
    {
      id: "matter",
      title: "Matter coordinated",
      citation: "FAR 4.801(b)",
      tier: "binding",
      fields: [
        { key: "matter", label: "What was coordinated, and with whom", kind: "textarea", required: true },
        { key: "coordination_date", label: "Date of the coordination", kind: "date", required: true },
      ],
    },
    {
      id: "positions",
      title: "Positions",
      citation: "FAR 4.801(b)",
      tier: "binding",
      fields: [{ key: "positions", label: "Positions taken by each organization", kind: "textarea", required: true }],
    },
    {
      id: "agreement",
      title: "Agreement and next step",
      citation: "FAR 4.801(b)",
      tier: "binding",
      fields: [
        { key: "agreement", label: "What was agreed", kind: "textarea", required: true },
        { key: "next_step", label: "Next step, its owner and its date", kind: "textarea", required: true },
      ],
    },
  ],
  signature: coSignature("FAR 4.801(b)"),
};

const packetTransmittal: TemplateDef = {
  key: "packet-transmittal-memo",
  name: "Pre-award Package Transmittal Memorandum",
  tab: "N/A",
  badge: {
    citation: "NF 1098 Checklist for Contract Award File Content; FAR 4.801",
    tier: "binding",
    revision: "T-Minus form; issued on NF 1858",
    note: "Issued on NASA Form 1858 (Rev 12/24) electronic letterhead.",
  },
  lead: "Transmits the pre-award review package and asks for review and concurrence.",
  sections: [
    acquisitionHeader(),
    {
      id: "action",
      title: "Action",
      citation: "FAR 4.801",
      tier: "binding",
      fields: [
        { key: "action", label: "The award the package supports, its vendor and its amount", kind: "textarea", required: true },
      ],
    },
    {
      id: "competition",
      title: "Competition",
      citation: "RFO FAR 12.201-1",
      citationFor: (v) =>
        /sole/i.test(v["competition"] ?? "")
          ? "RFO FAR 12.201-1; FAR 6.104"
          : "RFO FAR 12.201-1",
      tier: "binding",
      fields: [{ key: "competition_basis", label: "How competition was handled and any notice issued", kind: "textarea", required: true }],
    },
    {
      id: "strategy",
      title: "Enterprise strategy",
      citation: "Enterprise Procurement Strategies",
      tier: "guidance",
      fields: [{ key: "strategy", label: "Strategy reviewed and the result", kind: "textarea", required: true }],
    },
    {
      id: "request",
      title: "Request",
      citation: "FAR 4.801",
      tier: "binding",
      fields: [{ key: "request", label: "What is asked of the addressee, and by when", kind: "textarea", required: true }],
    },
  ],
  signature: coSignature("FAR 4.801"),
};

// ------------------------------------------------ Memorandum for Record
/** Purposes the memorandum can carry, in the order the form offers them. */
export const MFR_PURPOSES = [
  "Record of a decision not otherwise documented",
  "Explanation of a gap or delay in the file",
  "Correction of a document or date on the record",
  "Chronology of the acquisition to date",
  "Other",
] as const;

export const MFR_KEY = "memorandum-for-record";

const memorandumForRecord: TemplateDef = {
  key: MFR_KEY,
  name: "Memorandum for Record",
  tab: "N/A",
  badge: {
    citation: "FAR 4.801; FAR 4.803",
    tier: "guidance",
    revision: "T-Minus form; issued on NF 1858",
    note: "Contents of contract files. Issued on NASA Form 1858 electronic letterhead and filed under the tab the contracting officer picks.",
  },
  lead: "A memorandum to the contract file. Available on every file, whatever its phase.",
  sections: [
    acquisitionHeader(),
    {
      id: "purpose",
      title: "Purpose",
      citation: "FAR 4.803",
      tier: "guidance",
      fields: [
        {
          key: "purpose",
          label: "Purpose of the memorandum",
          kind: "select",
          options: [...MFR_PURPOSES],
          required: true,
        },
        {
          key: "purpose_other",
          label: "State the purpose",
          kind: "text",
          showIf: (v) => (v["purpose"] ?? "") === "Other",
          required: true,
        },
      ],
    },
    {
      id: "body",
      title: "Memorandum",
      citation: "FAR 4.801",
      tier: "binding",
      fields: [
        { key: "opening", label: "Opening", kind: "textarea", required: true },
        {
          key: "body",
          label: "Body",
          kind: "textarea",
          required: true,
          help: "State the facts and the decision. Cite the authority if one applies.",
        },
        {
          key: "authority",
          label: "Authority, if one applies",
          kind: "text",
          help: "Printed on the Ref line of the memorandum.",
        },
      ],
    },
    {
      id: "filing",
      title: "Filing",
      citation: "NF 1098 Checklist for Contract Award File Content",
      tier: "guidance",
      fields: [
        {
          key: "file_tab",
          label: "Contract file tab",
          kind: "text",
          help: "The NF 1098 tab this memorandum is filed under. Tab 001 unless the contracting officer picks another.",
        },
      ],
    },
  ],
  signature: coSignature("FAR 4.801"),
};

// --------------------------------------------------------- SAM.gov notice
const isSole = (v: Values) => (v["notice_type"] ?? "") === "Notice of intent to sole source";
const isCombined = (v: Values) => (v["notice_type"] ?? "") === "Combined synopsis/solicitation";
const isSources = (v: Values) => (v["notice_type"] ?? "") === "Sources sought";
/** Presolicitation modes carried over from the HQ Governmentwide Point of Entry master. */
const PRESOL_MODES = [
  "Presolicitation notice: noncompetitive",
  "Presolicitation notice: commercial competitive",
  "Presolicitation notice: noncommercial competitive",
  "Presolicitation notice: construction competitive",
  "Presolicitation notice: architect-engineer services",
  "Presolicitation notice: major system acquisition",
];
const MOD_MODES = ["Modification to a notice", "Modification to a combination synopsis"];
const RFI_MODES = ["Request for information: draft solicitation or statement of work", "Request for information: organizational conflict of interest"];
const isPresol = (v: Values) => PRESOL_MODES.includes(String(v["notice_type"] ?? ""));
const isMod = (v: Values) => MOD_MODES.includes(String(v["notice_type"] ?? ""));
const isRfi = (v: Values) => RFI_MODES.includes(String(v["notice_type"] ?? ""));


const samNotice: TemplateDef = {
  key: "sam-notice",
  name: "SAM.gov notice",
  tab: "N/A",
  badge: {
    citation: "RFO FAR 5.203; FAR 12.603; RFO FAR 6.104",
    tier: "binding",
    revision: "HQ Governmentwide Point of Entry templates 05/2026; posted in SAM.gov",
    note: "T-Minus drafts the notice; SAM.gov remains the system of record for posting.",
  },
  lead: "The notice posted to SAM.gov. The record picks the mode: combined synopsis/solicitation for a competitive commercial buy, notice of intent to sole source for a sole-source file, a presolicitation notice, a modification to a posted notice, a sources sought, or a request for information.",
  sections: [
    {
      id: "notice",
      title: "Notice",
      citation: "RFO FAR 5.203",
      tier: "binding",
      fields: [
        {
          key: "notice_type",
          label: "Notice type",
          kind: "select",
          options: [
            "Combined synopsis/solicitation",
            "Notice of intent to sole source",
            ...PRESOL_MODES,
            ...MOD_MODES,
            "Sources sought",
            ...RFI_MODES,
          ],

          required: true,
          help: "Set from the record; change it when the contracting officer posts a sources sought instead.",
        },
        { key: "title", label: "Title", kind: "text", bind: "title", required: true },
        { key: "naics_code", label: "NAICS", kind: "text", bind: "naics_code", required: true },
        { key: "psc_code", label: "PSC", kind: "text", bind: "psc_code", required: true },
        { key: "set_aside", label: "Set-aside", kind: "text", bind: "set_aside" },
        {
          key: "place_of_performance",
          label: "Place of performance",
          kind: "text",
          bind: "place_of_performance",
          required: true,
        },
        {
          key: "response_date",
          label: "Response date",
          kind: "date",
          required: true,
          help: "Combined synopsis/solicitation: the quote due date. Notice of intent: the regulation sets the period.",
        },
        {
          key: "response_period_basis",
          label: "Response period",
          kind: "readonly",
          showIf: isSole,
          help: "RFO FAR 5.203 / 6.104: allow at least 15 days for responses to the notice of intent unless an exception applies.",
        },
        {
          key: "response_rule",
          label: "Rule used for the response date",
          kind: "readonly",
          showIf: isCombined,
        },
      ],
    },
    {
      id: "requirement",
      title: "Description of the requirement",
      citation: "FAR 5.207",
      tier: "binding",
      fields: [
        {
          key: "description_of_requirement",
          label: "Description",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
        {
          key: "period_of_performance",
          label: "Period of performance",
          kind: "text",
        },
      ],
    },
    {
      id: "combined",
      title: "Solicitation terms",
      citation: "FAR 12.603",
      tier: "binding",
      showIf: isCombined,
      standingText:
        "This is a combined synopsis/solicitation under FAR 12.603. This notice is the only solicitation issued; quotations are being requested and a written solicitation will not be issued.",
      fields: [
        { key: "evaluation_basis", label: "Basis for award", kind: "textarea", required: true },
        { key: "clause_note", label: "Provisions and clauses that apply", kind: "textarea" },
      ],
    },
    {
      id: "intent",
      title: "Intent to sole source",
      citation: "RFO FAR 5.203; RFO FAR 6.104",
      tier: "binding",
      showIf: isSole,
      standingText:
        "This is a notice of intent to award on a sole-source basis. It is not a request for competitive quotations. Responses showing an ability to meet the requirement will be considered.",
      fields: [
        { key: "intended_vendor", label: "Intended awardee", kind: "text", bind: "vendor_legal_name", required: true },
        { key: "intended_vendor_uei", label: "Intended awardee UEI", kind: "text", bind: "vendor_uei" },
        { key: "sole_source_basis", label: "Why only this source can meet the need", kind: "textarea", required: true },
        {
          key: "authority",
          label: "Authority cited",
          kind: "text",
          bind: "jofoc_authority_citation",
          required: true,
        },
      ],
    },
    {
      id: "sources",
      title: "Sources sought",
      citation: "FAR 10.002(b)",
      tier: "binding",
      showIf: isSources,
      standingText:
        "This is a sources sought notice for market research only. It is not a solicitation, and no award will be made from it.",
      fields: [
        { key: "capability_requested", label: "Capability information requested", kind: "textarea", required: true },
        { key: "submission_instructions", label: "How to respond", kind: "textarea", required: true },
      ],
    },
    {
      id: "presolicitation",
      title: "Presolicitation notice",
      citation: "FAR 5.101(c); FAR 5.207",
      tier: "binding",
      showIf: isPresol,
      standingText:
        "All responsible sources may submit an offer which will be considered by the agency. This posting, in addition to any attached documents, will be available on SAM.gov. It is the offeror's responsibility to monitor this website for the release of the solicitation and amendments (if any).",
      fields: [
        {
          key: "solicitation_vehicle",
          label: "Type of solicitation planned",
          kind: "select",
          options: [
            "Request for Proposal (RFP)",
            "Invitation for Bids (IFB)",
            "Request for Quotations (RFQ)",
            "Broad Agency Announcement (BAA)",
            "Announcement of Opportunity (AO)",
            "NASA Research Announcement (NRA)",
          ],
          required: true,
        },
        { key: "solicitation_number", label: "Solicitation number", kind: "text" },
        { key: "anticipated_release_date", label: "Anticipated release date", kind: "date", required: true },
        { key: "anticipated_offer_due", label: "Anticipated offer due date", kind: "date", required: true },
        {
          key: "size_standard",
          label: "Size standard",
          kind: "text",
          help: "Revenue or number of employees for the NAICS shown above.",
        },
        {
          key: "commercial_statement",
          label: "Commercial statement",
          kind: "select",
          options: [
            "The Government intends to acquire a commercial product or service using FAR Part 12.",
            "The Government does not intend to acquire a commercial product or commercial service using FAR Part 12.",
          ],
          required: true,
        },
        {
          key: "trade_agreements_statement",
          label: "Trade agreements statement",
          kind: "select",
          options: [
            "",
            "One or more of the items under this acquisition are subject to Free Trade Agreements.",
            "One or more of the items under this acquisition are subject to the World Trade Organization Government Procurement Agreement and Free Trade Agreements.",
          ],
          help: "FAR 5.101(c)(4)(iii), Table 5-1. Leave empty when no trade agreements clause is included.",
        },
        {
          key: "sole_source_statement",
          label: "Intended source and why competition is limited",
          kind: "textarea",
          showIf: (v) => (v["notice_type"] ?? "") === "Presolicitation notice: noncompetitive",
          required: true,
        },
        {
          key: "completion_days",
          label: "Calendar days for completion after notice to proceed",
          kind: "text",
          showIf: (v) => (v["notice_type"] ?? "") === "Presolicitation notice: construction competitive",
        },
        {
          key: "ae_selection_note",
          label: "Selection process and submission instructions",
          kind: "textarea",
          showIf: (v) =>
            (v["notice_type"] ?? "") === "Presolicitation notice: architect-engineer services" ||
            (v["notice_type"] ?? "") === "Presolicitation notice: major system acquisition",
        },
        {
          key: "ombudsman_note",
          label: "Ombudsman",
          kind: "readonly",
          help: "NASA clause 1852.215-84, Ombudsman, is applicable. The Center Ombudsman for this acquisition is listed in the NASA Procurement Ombudsman and Competition Advocate listing.",
        },
      ],
    },
    {
      id: "modification",
      title: "Modification to a previous notice",
      citation: "FAR 5.102",
      tier: "binding",
      showIf: isMod,
      fields: [
        { key: "original_notice_title", label: "Title of the notice being modified", kind: "text", required: true },
        { key: "original_notice_number", label: "Solicitation number", kind: "text", required: true },
        { key: "original_posted_date", label: "Date the notice was posted", kind: "date", required: true },
        {
          key: "amendment_number",
          label: "Amendment number",
          kind: "text",
          showIf: (v) => (v["notice_type"] ?? "") === "Modification to a combination synopsis",
          required: true,
        },
        { key: "modification_description", label: "Changes made", kind: "textarea", required: true },
        {
          key: "due_date_extended",
          label: "Due date for responses",
          kind: "select",
          options: ["is extended", "is not extended"],
          required: true,
        },
      ],
    },
    {
      id: "rfi",
      title: "Request for information",
      citation: "FAR 15.201(e)",
      tier: "binding",
      showIf: isRfi,
      standingText:
        "This is a request for information only. It is not a solicitation, it does not commit the Government to award a contract, and the Government will not pay for any information provided in response.",
      fields: [
        {
          key: "rfi_material",
          label: "Material released for comment",
          kind: "textarea",
          showIf: (v) => (v["notice_type"] ?? "") === "Request for information: draft solicitation or statement of work",
          required: true,
        },
        {
          key: "oci_concern",
          label: "Potential organizational conflict of interest described",
          kind: "textarea",
          showIf: (v) => (v["notice_type"] ?? "") === "Request for information: organizational conflict of interest",
          required: true,
        },
        { key: "rfi_response_instructions", label: "How to respond", kind: "textarea", required: true },
        { key: "rfi_response_due", label: "Responses due", kind: "date", required: true },
      ],
    },

    {
      id: "poc",
      title: "Point of contact",
      citation: "FAR 5.207(c)(16)",
      tier: "binding",
      fields: [
        { key: "co_name", label: "Point of contact", kind: "text", bind: "co_name", required: true },
        { key: "poc_email", label: "Email", kind: "text", required: true },
        { key: "poc_phone", label: "Telephone", kind: "text" },
      ],
    },
  ],
  signature: coSignature("RFO FAR 5.203", "Posted in SAM.gov; the posting confirmation is filed under FAR 4.801."),
};

/** Notice mode the record calls for, before the contracting officer changes it. */
export function samNoticeMode(acq: { competition?: string | null } | null | undefined): string {
  return /sole/i.test(String(acq?.competition ?? ""))
    ? "Notice of intent to sole source"
    : "Combined synopsis/solicitation";
}

// ------------------------------------------- Evaluation of quotations record
// FAR 13.106-2. Required on a competed simplified acquisition: the quotations
// are judged against the criteria stated in the notice and the basis for the
// recommendation is recorded.
const quoterRow = (n: number): FieldDef[] => [
  { key: `quoter_${n}_name`, label: `Quoter ${n}: name`, kind: "text" },
  { key: `quoter_${n}_uei`, label: `Quoter ${n}: UEI`, kind: "text" },
  { key: `quoter_${n}_price`, label: `Quoter ${n}: price quoted`, kind: "money" },
  {
    key: `quoter_${n}_rating`,
    label: `Quoter ${n}: technical rating`,
    kind: "select",
    options: ["", "Acceptable", "Unacceptable"],
  },
  { key: `quoter_${n}_reason`, label: `Quoter ${n}: reason for the rating`, kind: "textarea" },
];

const evaluationOfQuotations: TemplateDef = {
  key: "evaluation-of-quotations",
  name: "Evaluation of Quotations Record",
  tab: "054",
  badge: {
    citation: "FAR 13.106-2",
    tier: "binding",
    revision: "T-Minus 09/2026",
    effective: "2026-09-01",
    note: "Required on a competed simplified acquisition. It records how each quotation was judged against the criteria in the notice.",
  },
  lead: "Each quotation judged against the criteria stated in the notice, with the recommended quoter and the comparison to the Government estimate.",
  sections: [
    {
      id: "header",
      title: "Acquisition",
      citation: "FAR 13.106-2",
      tier: "binding",
      fields: [
        { key: "acquisition_id", label: "Acquisition", kind: "readonly", bind: "acquisition_id" },
        { key: "title", label: "Requirement", kind: "text", bind: "title", required: true },
        { key: "naics_code", label: "NAICS", kind: "text", bind: "naics_code" },
        { key: "set_aside", label: "Set-aside", kind: "text", bind: "set_aside" },
        {
          key: "igce_amount",
          label: "Independent government cost estimate",
          kind: "money",
          bind: "igce_amount",
        },
      ],
    },
    {
      id: "basis",
      title: "Basis for award and evaluation criteria",
      citation: "FAR 13.106-2(b)",
      tier: "binding",
      fields: [
        {
          key: "award_basis",
          label: "Basis for award",
          kind: "select",
          required: true,
          options: ["Lowest price technically acceptable", "Best value tradeoff"],
        },
        {
          key: "evaluation_criteria",
          label: "Evaluation criteria stated in the notice",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "quotations",
      title: "Quotations received",
      citation: "FAR 13.106-2(a)",
      tier: "binding",
      standingText:
        "Record every quotation received: the quoter, its UEI, the price quoted, the technical rating and the reason for that rating. Leave unused rows blank.",
      fields: [...quoterRow(1), ...quoterRow(2), ...quoterRow(3), ...quoterRow(4)],
    },
    {
      id: "recommendation",
      title: "Recommendation",
      citation: "FAR 13.106-2(b)(3)",
      tier: "binding",
      fields: [
        { key: "recommended_quoter", label: "Recommended quoter", kind: "text", required: true },
        { key: "recommended_uei", label: "Recommended quoter UEI", kind: "text" },
        { key: "recommended_price", label: "Recommended price", kind: "money", required: true },
        {
          key: "price_comparison",
          label: "Comparison with the independent government cost estimate",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "signoff",
      title: "Sign-off",
      citation: "FAR 4.801",
      tier: "binding",
      fields: [
        { key: "evaluator_name", label: "Technical evaluator", kind: "text" },
        { key: "co_name", label: "Contracting officer", kind: "text", bind: "co_name" },
      ],
    },
  ],
  signature: (): SignatureBlock => ({
    tierLabel: "Technical evaluator and contracting officer",
    citation: "FAR 13.106-2",
    blocks: ["Technical evaluator", "Date", "Contracting officer", "Date"],
    note: "Signed and placed in the contract file (FAR 4.801).",
  }),
};

export const TEMPLATES: TemplateDef[] = [
  samNotice,
  evaluationOfQuotations,
  nf1707,
  jofoc,
  ter,
  nonresponsibility,
  pnm,
  commerciality,
  fairOpportunity,
  optionJustification,
  optionExercise,
  optionNotification,
  consolidation,
  bundling,
  economyAct,
  commercialTmLh,
  corAppointment,
  corCancellation,
  cparsInput,
  closeoutChecklist,
  marketResearchMemo,
  waiverDeviation,
  coordinationMemo,
  packetTransmittal,
  memorandumForRecord,
  ...HQ_TEMPLATES,
  ...HQ4_TEMPLATES,
  ...HQ5_TEMPLATES,
  ...HQ6_TEMPLATES,
  ...HQ6B_TEMPLATES,
  ...HQ6C_TEMPLATES,
];

export function templateByKey(key: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Pre-fill every field that exists on the record. */
export function prefill(def: TemplateDef, acq: Record<string, unknown>): Values {
  const out: Values = {};
  for (const s of def.sections) {
    for (const f of s.fields) {
      const raw = f.bind ? acq[f.bind] : undefined;
      if (raw === null || raw === undefined || raw === "") {
        out[f.key] = f.default ?? "";
        continue;
      }
      out[f.key] = typeof raw === "boolean" ? (raw ? "Yes" : "No") : String(raw);
    }
  }
  // Carried so a section citation can follow the record's acquisition method.
  out["__method"] = `${String(acq["acquisition_method"] ?? "")} ${String(acq["contract_format"] ?? "")}`.trim();
  if (def.key === "jofoc") {
    const competition = String(acq["competition"] ?? "").toLowerCase();
    const soleSource = competition.includes("sole") || competition.includes("brand");
    // A sole-source record opens on the action it is: the CO can change it.
    if (!out["action_type"] && soleSource) out["action_type"] = "Sole-source contract";
    if (soleSource) {
      // The stored citation only stands if it is one of the offered options;
      // otherwise the field opens on the only-one-responsible-source option
      // that matches the acquisition method.
      const options =
        def.sections.flatMap((s) => s.fields).find((f) => f.key === "authority")?.options ?? [];
      const stored = String(out["authority"] ?? "").trim();
      if (!stored || !options.includes(stored)) {
        const method = String(acq["acquisition_method"] ?? "").toLowerCase();
        const commercial = /12\.102|13\.5|commercial simplified/.test(method);
        out["authority"] =
          options.find((o) =>
            commercial ? o.startsWith("41 U.S.C. 1901") : o.startsWith("10 U.S.C. 3204(a)(1)"),
          ) ?? stored;
      }
    }
  }
  if (def.key === "sam-notice") {
    if (!out["notice_type"]) out["notice_type"] = samNoticeMode(acq as { competition?: string | null });
    out["response_period_basis"] =
      "At least 15 days from posting, unless an exception in RFO FAR 5.203 applies.";
  }
  return out;
}

/**
 * The requester's technical representative on the record. One field, read the
 * same way on the page, the export and the requisition.
 */
export function technicalRepresentative(acq: Record<string, unknown>): string {
  const cor = String(acq["cor_name"] ?? "").trim();
  if (cor) return cor;
  return String(acq["requester_name"] ?? "").trim();
}

/**
 * The approving official's title. When the value sits inside the contracting
 * officer's tier, the approval is the contracting officer's and nothing else
 * is printed; a routing note that is not a title never prints as one.
 */
export function approvingOfficialTitle(routingTitle: string | null | undefined, withinCoTier: boolean): string {
  if (withinCoTier) return "Contracting Officer";
  const title = (routingTitle ?? "").trim();
  if (!title || /^per\s+far/i.test(title) || /approval level/i.test(title)) return "Contracting Officer";
  return title;
}

export function visibleSections(def: TemplateDef, v: Values): SectionDef[] {
  return def.sections.filter((s) => !s.showIf || s.showIf(v));
}

export function visibleFields(s: SectionDef, v: Values): FieldDef[] {
  return s.fields.filter((f) => !f.showIf || f.showIf(v));
}

/**
 * Fields still to complete. A version saves with any field empty, so this is a
 * list shown on the form and on the phase, never a gate on the save.
 */
export function validate(def: TemplateDef, v: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const s of visibleSections(def, v)) {
    for (const f of visibleFields(s, v)) {
      if (f.required && !(v[f.key] ?? "").trim()) errors[f.key] = `${f.label} is required.`;
    }
  }
  return errors;
}

export type RenderedDoc = {
  title: string;
  badgeLine: string;
  blocks: { heading: string; citation?: string | undefined; lines: string[] }[];
};

export type ExportContext = {
  def: TemplateDef;
  values: Values;
  acquisitionId: string;
  coName: string;
  coTitle?: string | undefined;
  approvingOfficialTitle?: string | undefined;
  technicalRepresentativeName?: string | undefined;
  centerName?: string | undefined;
  centerAddress?: string | undefined;
  preparedDate?: string | undefined;
  organizationCode?: string | undefined;
  additionalApprovalRequired?: boolean | undefined;
};

type PrintBlock = { heading?: string; lines: string[]; numbered?: boolean; center?: boolean; bold?: boolean };

const cleanExportText = (text: string) =>
  text
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s*(?:Drafted from the record, confirm\.?|drafted from the record, confirm\.?)/gi, "")
    // On-screen draft flags never print in an exported document.
    .replace(/(?:^|\s)Draft,\s*confirm\.\s*/gi, " ")
    .replace(/\s*Source:.*$/gi, "")
    .replace(/^\s*[—–-]\s*$/, "")
    .replace(/\.\s*\.$/g, ".")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

const blankLine = "____________________________________________";

function genericPrintBlocks(doc: RenderedDoc): PrintBlock[] {
  return doc.blocks
    .filter((block) => !block.heading.startsWith("Signatures"))
    .map((block) => ({
      heading: block.heading,
      lines: block.lines.map((line) => {
        const at = line.indexOf(": ");
        const value = at >= 0 ? line.slice(at + 2) : line;
        return cleanExportText(value) || blankLine;
      }),
    }));
}

function jofocPrintBlocks(ctx: ExportContext): PrintBlock[] {
  const v = ctx.values;
  const value = (key: string) => cleanExportText(v[key] ?? "");
  const contractor = value("contractor_name") || blankLine;
  const action = (value("action_type") || "sole-source contract").toLowerCase();
  const actionDescription = (value("action_description") || value("requirement_description") || blankLine).replace(/[.!?]+$/, "");
  const authorityRationale = value("authority_rationale").replace(/\s*Basis of record:.*$/i, "").trim();
  // Saving a notice is not publishing it: the printed item reads posted only
  // when a publication date is on the form, and otherwise follows the status
  // line the form carries.
  const noticeStatus = value("notice_status");
  const notice = value("notice_date")
    ? `The notice of intent was posted on ${value("notice_date")}${value("interested_sources") ? `. ${value("interested_sources")}` : "."}`
    : /draft/i.test(noticeStatus)
    ? "The notice of intent has been prepared as a draft and has not yet been posted to the Government Point of Entry."
    : "The notice of intent has not yet been posted.";
  const item = (n: number, heading: string, prose: string): PrintBlock => ({ heading: `${n}. ${heading}`, lines: [prose] });
  const approvalLines = [
    `${ctx.technicalRepresentativeName || blankLine}, Technical Representative`,
    "Signature: ______________________________    Date: __________",
    `${ctx.coName || blankLine}, ${ctx.coTitle || "Contracting Officer"}`,
    "Signature: ______________________________    Date: __________",
  ];
  if (ctx.additionalApprovalRequired) {
    approvalLines.push(ctx.approvingOfficialTitle || blankLine, "Signature: ______________________________    Date: __________");
  } else {
    approvalLines.push("Approved by the Contracting Officer under FAR 6.104-2 Table 6-1");
  }
  return [
    { lines: ["National Aeronautics and Space Administration"], center: true },
    { lines: [ctx.centerName || "", ctx.centerAddress || "", ctx.preparedDate || ""].filter(Boolean), center: true },
    { lines: ["JUSTIFICATION FOR OTHER THAN FULL AND OPEN COMPETITION"], center: true, bold: true },
    { lines: [`Center: ${value("center_code") || blankLine}`, `Solicitation/contract number: ${value("solicitation_name") || blankLine}`, `Program: ${value("program_name") || blankLine}`] },
    item(1, "Identification of the agency and the contracting activity", `The procuring agency is the National Aeronautics and Space Administration, and the contracting activity is ${value("buying_location") || blankLine}.`),
    item(2, "Nature and description of the action being approved", `This action is a ${action} to ${contractor} for ${actionDescription}.`),
    item(3, "Description of the supplies or services required, including estimated value", `${value("requirement_description") || actionDescription} The estimated value is ${value("estimated_value") ? money(Number(value("estimated_value").replace(/[$,]/g, ""))) : blankLine}.${value("pop_start") || value("pop_end") ? ` The period of performance is ${value("pop_start") || blankLine} to ${value("pop_end") || blankLine}.` : ""}`),
    item(4, "Statutory authority permitting other than full and open competition", `This action is authorized by ${value("authority") || blankLine}.`),
    item(5, "Demonstration that the authority cited applies", authorityRationale || blankLine),
    item(6, "Efforts to solicit offers from as many potential sources as practicable", notice),
    item(7, "Determination that the anticipated cost will be fair and reasonable", value("price_analysis_plan") || blankLine),
    { heading: "8. Market research conducted and the results", lines: (value("market_research") || blankLine).split("\n").filter(Boolean) },
    item(9, "Other facts supporting the use of other than full and open competition", value("other_facts") || "No other facts were identified."),
    item(10, "Sources that expressed an interest in writing", notice),
    item(11, "Actions to remove barriers to competition", value("barriers") || blankLine),
    {
      heading: "Certification and approval",
      lines: approvalLines,
    },
  ];
}

function terPrintBlocks(ctx: ExportContext): PrintBlock[] {
  const v = ctx.values;
  const raw = (key: string) => cleanExportText(v[key] ?? "");
  const value = (key: string) => raw(key) || "N/A";
  const evaluator = ctx.technicalRepresentativeName || raw("from_evaluator");
  const org = ctx.organizationCode || raw("office_name");
  const co = [ctx.coName, org].filter(Boolean).join(", ");
  const item7 = [raw("acceptability"), raw("acceptability_basis"), raw("ae_six_percent")].filter(Boolean);
  return [
    { lines: ["National Aeronautics and Space Administration"], center: true },
    { lines: [ctx.centerName || "", ctx.centerAddress || "", ctx.preparedDate || ""].filter(Boolean), center: true },
    { lines: [`Date: ${ctx.preparedDate || ""}`, `Reply to Attn of: ${org}`, `TO: ${co}`, `FROM: ${[evaluator, org].filter(Boolean).join(", ")}`, `SUBJECT: ${raw("subject")}`] },
    { heading: "1. Technical requirement and background", lines: [value("background")] },
    { heading: "2. Technical evaluation team members", lines: [value("team")] },
    { heading: "3. Fact-finding", lines: [value("fact_finding")] },
    { heading: "4. Ground rules and assumptions", lines: [value("ground_rules")] },
    { heading: "5. Data requirements documents (DRDs)", lines: [value("drds")] },
    { heading: "6. Government furnished property and information", lines: [value("gfp")] },
    { heading: "7. Overall acceptability of the technical proposal", lines: item7.length ? item7 : ["N/A"] },
    { heading: "8. Evaluation of resources", lines: [
      `a. Direct labor: ${value("res_labor")}`,
      `b. Material: ${value("res_material")}`,
      `c. Travel: ${value("res_travel")}`,
      `d. Subcontractor effort: ${value("res_subcontracts")}`,
      `e. Special tooling and test equipment: ${value("res_tooling")}`,
      `f. Other direct costs, training, consultants, and IWTs: ${value("res_odc")}`,
    ] },
    { heading: "Technical evaluator", lines: [evaluator || blankLine, "Signature: ______________________________    Date: __________"] },
  ];
}

/**
 * HQ memorandum, determination and findings, and plan layouts.
 *
 * Headings, standing determination and certification sentences and signature
 * titles print exactly as the HQ template carries them. A field the record has
 * not filled prints a blank line so the contracting officer can complete it in
 * ink; nothing prints a bracket, a label, a citation banner or a URL.
 */
function hqPrintBlocks(ctx: ExportContext): PrintBlock[] {
  const def = ctx.def;
  const v = ctx.values;
  const out: PrintBlock[] = [
    { lines: ["NATIONAL AERONAUTICS AND SPACE ADMINISTRATION"], center: true, bold: true },
    { lines: [ctx.centerName || "", ctx.centerAddress || "", ctx.preparedDate || ""].filter(Boolean), center: true },
    { lines: [def.name.toUpperCase()], center: true, bold: true },
  ];
  // The printed page already carries the agency line and the document title,
  // so a standing line that repeats either of them is not printed again.
  const key = (text: string) => text.replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
  const banner = new Set([key("National Aeronautics and Space Administration"), key(def.name)]);
  const titleWords = key(def.name).split(" ").filter(Boolean);
  const repeatsTitle = (line: string) => {
    const l = key(line);
    if (banner.has(l)) return true;
    return titleWords.length > 2 && l.length > 8 && key(def.name).includes(l);
  };
  for (const section of visibleSections(def, v)) {
    const lines: string[] = [];
    if (section.standingText)
      lines.push(...section.standingText.split("\n").filter(Boolean).filter((line) => !repeatsTitle(line)));
    for (const field of visibleFields(section, v)) {
      const raw = (v[field.key] ?? "").trim();
      const value =
        field.kind === "money" && raw && !Number.isNaN(Number(raw.replace(/[$,]/g, "")))
          ? money(Number(raw.replace(/[$,]/g, "")))
          : cleanExportText(raw);
      const isSignature = field.key.startsWith("sig_");
      if (isSignature) {
        lines.push(`${value || blankLine}, ${field.label.replace(/^(APPROVAL|CONCURRENCES?):\s*/i, "")}`);
        lines.push("Signature: ______________________________    Date: __________");
        continue;
      }
      if (!value && !field.required) continue;
      lines.push(value || blankLine);
    }
    if (!lines.length) continue;
    out.push({ heading: section.title, lines });
  }
  return out;
}

export function exportBlocks(doc: RenderedDoc, context?: ExportContext): PrintBlock[] {
  if (context?.def.key === "jofoc") return jofocPrintBlocks(context);
  if (context?.def.key === "technical-evaluation-report") return terPrintBlocks(context);
  if (context?.def.layout) return hqPrintBlocks(context);
  return genericPrintBlocks(doc);
}

/** One rendering used by the printable view and by both exports. */
export function renderDocument(
  def: TemplateDef,
  v: Values,
  acquisitionId: string,
  signature?: SignatureBlock,
): RenderedDoc {
  const blocks = visibleSections(def, v).map((s) => {
    const lines: string[] = [];
    if (s.standingText) lines.push(s.standingText);
    for (const f of visibleFields(s, v)) {
      const raw = (v[f.key] ?? "").trim();
      const value =
        f.kind === "money" && raw && !Number.isNaN(Number(raw.replace(/[$,]/g, "")))
          ? money(Number(raw.replace(/[$,]/g, "")))
          : raw;
      lines.push(`${f.label}: ${value || "—"}`);
    }
    return { heading: s.title, citation: sectionCitation(s, v), lines };
  });
  if (signature) {
    blocks.push({
      heading: `Signatures — ${signature.tierLabel}`,
      citation: signature.citation,
      lines: signature.note ? [...signature.blocks, `Note: ${signature.note}`] : signature.blocks,
    });
  }
  return {
    title: `${def.name} — ${acquisitionId}`,
    badgeLine: `${badgeCitation(def, v)} · ${def.badge.tier} · ${def.badge.revision}${def.badge.note ? ` · ${def.badge.note}` : ""}`,
    blocks,
  };
}

/** Word export. The docx library is loaded on demand in the browser. */
export async function exportDocx(doc: RenderedDoc, fileName: string, context?: ExportContext) {
  const { Document, Packer, Paragraph, TextRun, Footer, PageNumber, AlignmentType, TabStopType } = await import("docx");
  const blocks = exportBlocks(doc, context);
  const isTer = context?.def.key === "technical-evaluation-report";
  const children: InstanceType<typeof Paragraph>[] = [];
  for (const [index, b] of blocks.entries()) {
    if (b.heading) children.push(new Paragraph({ spacing: { before: index ? 180 : 0, after: 120 }, children: [new TextRun({ text: b.heading, bold: true, font: "Times New Roman", size: 24 })] }));
    for (const line of b.lines) children.push(new Paragraph({ ...(b.center ? { alignment: "center" as const } : {}), spacing: { after: 120 }, children: [new TextRun({ text: line, ...(b.bold !== undefined ? { bold: b.bold } : {}), font: "Times New Roman", size: 24 })] }));
  }
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, tabStops: [{ type: TabStopType.CENTER, position: 4680 }], children: [
    new TextRun({ text: "Prototype, synthetic data\t", color: "777777", size: 16, font: "Times New Roman" }),
    new TextRun({ text: "Page ", size: 18, font: "Times New Roman" }), new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Times New Roman" }),
    new TextRun({ text: " of ", size: 18, font: "Times New Roman" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Times New Roman" }),
  ] })] });
  const document = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24, color: "000000" } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: isTer ? { top: 720, right: 1440, bottom: 1440, left: 1800 } : { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        footers: { default: footer },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Deterministic PDF export using the same clean, template-aware content as Word. */
export async function exportPdf(doc: RenderedDoc, _headerLine: string, fileName = "document", context?: ExportContext) {
  const blocks: PdfBlock[] = [];
  for (const block of exportBlocks(doc, context)) {
    if (block.heading) blocks.push({ text: block.heading, bold: true, gap: 6 });
    block.lines.forEach((line) => blocks.push({ text: line, gap: 6, ...(block.center !== undefined ? { center: block.center } : {}), ...(block.bold !== undefined ? { bold: block.bold } : {}) }));
  }
  await renderPdf(blocks, {
    fileName,
    prototype: true,
    margins: context?.def.key === "technical-evaluation-report"
      ? { top: 36, right: 72, bottom: 72, left: 90 }
      : { top: 72, right: 72, bottom: 72, left: 72 },
  });
  return true;
}
