/**
 * T-Minus template engine.
 *
 * A template is a set of sections whose fields bind to acquisition_facts or to
 * document-specific values. Sections and fields can show or hide by rule,
 * required fields are validated, and each template carries a version badge
 * (governing citation, tier, HQ revision date).
 */

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
  help?: string;
  showIf?: (v: Values) => boolean;
};

export type SectionDef = {
  id: string;
  title: string;
  citation?: string;
  tier?: "binding" | "guidance";
  standingText?: string;
  fields: FieldDef[];
  showIf?: (v: Values) => boolean;
};

export type TemplateDef = {
  key: string;
  /** Name as it appears in the templates table. */
  name: string;
  tab: string;
  badge: {
    citation: string;
    tier: "binding" | "guidance";
    revision: string;
    /** Machine-readable HQ revision date, used to spot newer guidance. */
    effective?: string;
    note?: string;
    corrections?: string[];
  };
  lead: string;
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
            "41 U.S.C. 1901 (FAR 12.102 procedures)",
            "41 U.S.C. 1903 (FAR 12.102 procedures)",
          ],
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
          key: "notice_date",
          label: "Date the notice was published to the Government Point of Entry",
          kind: "date",
          required: true,
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
      tier: "binding",
      standingText:
        "The Contracting Officer's signature on this document indicates that the Contracting Officer has determined that the anticipated cost to the Government will be fair and reasonable. The contractor must submit a proposal to be evaluated and negotiated by the Government. Prior to execution of the contractual instrument a proposal analysis will be performed to ensure the final agreed-to price is fair and reasonable.",
      fields: [
        {
          key: "price_analysis_plan",
          label: "Planned proposal analysis under FAR Subpart 15.4",
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
        { key: "other_facts", label: "Other facts, or none", kind: "textarea", required: true },
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
          required: true,
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
// The PNM is the price reasonableness determination of record for simplified
// commercial procedures (FAR 12.204(b)(1)); no separate determination is made.
const pnm: TemplateDef = {
  key: "pnm",
  name: "Price Negotiation Memorandum (PNM)",
  tab: "065",
  badge: {
    citation: "FAR 12.204(b)(1); FAR 15.406-3",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2026-04-07",
    note: "The PNM is the price reasonableness determination of record. No separate price reasonableness determination is generated.",
  },
  lead: "Price negotiation memorandum, pre-filled from the record, the IGCE, and the quote.",
  sections: [
    {
      id: "header",
      title: "Acquisition and vendor",
      citation: "FAR 15.406-3(a)(1)",
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
      citation: "FAR 15.406-3(a)(7); FAR 13.106-3(a)",
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
      citation: "FAR 15.406-3(a)(7) through (a)(11)",
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
      citation: "FAR 12.204(b)(1)",
      tier: "binding",
      standingText:
        "For simplified commercial procedures this memorandum is the determination of record. No separate price reasonableness determination is written.",
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
    citation: "FAR 15.406-3(b)",
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

export const TEMPLATES: TemplateDef[] = [
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
        out[f.key] = "";
        continue;
      }
      out[f.key] = typeof raw === "boolean" ? (raw ? "Yes" : "No") : String(raw);
    }
  }
  return out;
}

export function visibleSections(def: TemplateDef, v: Values): SectionDef[] {
  return def.sections.filter((s) => !s.showIf || s.showIf(v));
}

export function visibleFields(s: SectionDef, v: Values): FieldDef[] {
  return s.fields.filter((f) => !f.showIf || f.showIf(v));
}

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
    return { heading: s.title, citation: s.citation, lines };
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
    badgeLine: `${def.badge.citation} · ${def.badge.tier} · ${def.badge.revision}${def.badge.note ? ` · ${def.badge.note}` : ""}`,
    blocks,
  };
}

/** Word export. The docx library is loaded on demand in the browser. */
export async function exportDocx(doc: RenderedDoc, fileName: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(doc.title)] }),
    new Paragraph({ children: [new TextRun({ text: doc.badgeLine, size: 18 })] }),
    new Paragraph({ children: [new TextRun({ text: "Prototype. Not an official NASA system.", size: 18 })] }),
  ];
  for (const b of doc.blocks) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.heading)] }));
    if (b.citation) children.push(new Paragraph({ children: [new TextRun({ text: b.citation, italics: true, size: 18 })] }));
    for (const line of b.lines) children.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  const document = new Document({
    styles: {
      default: { document: { run: { font: "IBM Plex Sans", size: 22, color: "000000" } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 30, bold: true, color: "000000", font: "IBM Plex Sans" },
          paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, color: "000000", font: "IBM Plex Sans" },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
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

/** PDF export through the browser print dialog, on white with the version badge in the footer. */
export function exportPdf(doc: RenderedDoc, headerLine: string) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = doc.blocks
    .map(
      (b) =>
        `<section><h2>${esc(b.heading)}</h2>${b.citation ? `<p class="cite">${esc(b.citation)}</p>` : ""}${b.lines
          .map((l) => `<p>${esc(l)}</p>`)
          .join("")}</section>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #000; background: #fff; font-size: 12pt; line-height: 1.5; }
  header, footer { font-size: 9pt; }
  h1 { font-size: 18pt; } h2 { font-size: 13pt; margin-bottom: 2px; }
  .cite { font-size: 9pt; font-style: italic; margin-top: 0; }
  section { margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
</style></head><body>
<header>${esc(headerLine)}</header>
<h1>${esc(doc.title)}</h1>
${body}
<footer><p>${esc(doc.badgeLine)}</p><p>Prototype. Not an official NASA system.</p></footer>
<script>window.onload = function () { window.print(); }<\/script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
