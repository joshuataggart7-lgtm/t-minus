/**
 * HQ Office of Procurement acquisition-planning templates (Batch 3).
 *
 * Wording of headings, determination and certification sentences, and
 * signature-block titles is taken verbatim from the HQ Word templates and the
 * Batch 3 field map. Drafter instructions, "SAMPLE LANGUAGE" blocks and the
 * document history logs never print: they appear here only as field help.
 *
 * Every field that the acquisition record can fill carries a bind, so the form
 * opens prefilled with a Source link; everything else is a contracting officer
 * field.
 */

import type { FieldDef, SectionDef, TemplateDef, Values } from "@/lib/template-engine";

const T = (key: string, label: string, help?: string): FieldDef => ({
  key,
  label,
  kind: "textarea",
  ...(help ? { help } : {}),
});

const S = (key: string, label: string, options: string[], def?: string): FieldDef => ({
  key,
  label,
  kind: "select",
  options,
  ...(def ? { default: def } : {}),
});

const X = (key: string, label: string, bind?: string): FieldDef => ({
  key,
  label,
  kind: "text",
  ...(bind ? { bind } : {}),
});

/** Header every HQ template opens with, filled from the record. */
function hqHeader(titleLine: string, citation: string): SectionDef {
  return {
    id: "heading",
    title: "Heading",
    citation,
    tier: "binding",
    standingText: `NATIONAL AERONAUTICS AND SPACE ADMINISTRATION\n${titleLine}`,
    fields: [
      X("center_name", "Center name and acronym", "center_code"),
      X("acquisition_name", "Name of the contract to be awarded", "title"),
      X("acquisition_identifier", "Program or project name and acquisition identifier", "mission_id"),
      { key: "prepared_on", label: "Date", kind: "date" },
    ],
  };
}

const LEGAL_CONCURRENCE =
  "Legal: I have reviewed the above determination and findings and have no legal objection with respect to it. Comments, if any, are included in the file.";

/** The signature page printed at the foot of a determination and findings. */
function signaturePage(
  pageTitle: string,
  blocks: { label: string; note?: string }[],
  citation: string,
): SectionDef {
  return {
    id: "signature_page",
    title: `SIGNATURE PAGE — ${pageTitle}`,
    citation,
    tier: "binding",
    standingText: LEGAL_CONCURRENCE,
    fields: blocks.map((b) => ({
      key: `sig_${b.label.toLowerCase().replace(/[^a-z]+/g, "_")}`,
      label: b.label,
      kind: "text" as const,
      ...(b.note ? { help: b.note } : {}),
    })),
  };
}

const CO_BLOCK = { label: "Contracting Officer" };
const LEGAL_BLOCK = { label: "Office of the General Counsel at the Center", note: LEGAL_CONCURRENCE };
const PO_BLOCK = {
  label: "Procurement Officer",
  note: "Include this concurrence only for NSSC, NOJMO, ESDMD and SOMD actions.",
};
const HQ_OGC_BLOCK = { label: "Office of the General Counsel at Headquarters" };
const HCA_BLOCK = {
  label: "Head of the Contracting Activity",
  note: "Refer to the NFS 1802.101 definition of head of the contracting activity.",
};
const SPE_BLOCK = { label: "Senior Procurement Executive" };

/** FAR 16.104 factors, addressed in every contract-type determination. */
const far16104Fields = (): FieldDef[] =>
  [
    "Price competition",
    "Price analysis",
    "Cost analysis",
    "Type and complexity of the requirement",
    "Combining contract types",
    "Urgency of the requirement",
    "Period of performance or length of production run",
    "Contractor's technical capability and financial responsibility",
    "Adequacy of the contractor's accounting system",
    "Concurrent contracts",
    "Extent and nature of proposed subcontracting",
    "Acquisition history",
  ].map((label, i) =>
    T(
      `f16104_${i + 1}`,
      `${i + 1}. ${label}`,
      "Address every applicable factor. Enter N/A for a factor that does not apply.",
    ),
  );

const generalDescription = (typeLabel: string): SectionDef => ({
  id: "general_description",
  title: `II. General Description- FAR 1.704(b)`,
  citation: "FAR 1.704(b)",
  tier: "binding",
  fields: [
    {
      key: "general_description",
      label: `NASA requests approval to execute a ${typeLabel} contract for this acquisition`,
      kind: "textarea",
      bind: "description_of_requirement",
      required: true,
      help: "Describe the mission, scope, uncertainties, period of performance including options, competition and set-aside, and estimated value.",
    },
    { key: "pop_start", label: "Period of performance start", kind: "date", bind: "period_of_performance_start" },
    { key: "pop_end", label: "Period of performance end", kind: "date", bind: "period_of_performance_end" },
    { key: "estimated_value", label: "Estimated value", kind: "money", bind: "estimated_value" },
  ],
});

// ------------------------------------------------------------------ 1. WAP
const writtenAcquisitionPlan: TemplateDef = {
  key: "written-acquisition-plan",
  name: "Written Acquisition Plan Template for Contracts",
  tab: "002",
  layout: "plan",
  badge: {
    citation: "FAR Subpart 7.1; NFS Subpart 1807.1; NFS 1807.103",
    tier: "binding",
    revision: "HQ 02/2026 revision",
    effective: "2025-04-01",
    note: "The Procurement Strategy Meeting template supersedes this plan unless the Senior Procurement Executive asks for a written acquisition plan.",
  },
  lead:
    "Written acquisition plan. The PSM chart package supersedes this template unless the Senior Procurement Executive requests a written plan; this row stays offered for that reason.",
  sections: [
    {
      id: "cover",
      title: "Cover",
      citation: "FAR 2.101; FAR 3.104",
      tier: "binding",
      standingText:
        "Information included in this plan is considered \"SOURCE SELECTION INFORMATION\" and must be handled in accordance with FAR 2.101 and 3.104.",
      fields: [
        X("center_name", "Center name and acronym", "center_code"),
        X("acquisition_name", "Acquisition name and acronym", "title"),
        { key: "plan_date", label: "Plan date", kind: "date" },
        X("requiring_office", "Requirements owner organization", "requester_org_code"),
      ],
    },
    {
      id: "need",
      title: "Statement of Need",
      citation: "FAR 7.105(a)(1)",
      tier: "binding",
      fields: [
        { key: "need", label: "Statement of need", kind: "textarea", bind: "description_of_requirement", required: true },
        T("current_contract", "Current contract history"),
        T("in_house", "Any related in-house effort"),
      ],
    },
    {
      id: "conditions",
      title: "Applicable Conditions",
      citation: "FAR 7.105(a)(2)",
      tier: "binding",
      fields: [T("conditions", "Applicable conditions, directives and constraints"), T("place", "Place of performance")],
    },
    {
      id: "cost",
      title: "Cost",
      citation: "FAR 7.105(a)(3); NFS 1807.105(a)(3)",
      tier: "binding",
      fields: [
        { key: "igce_total", label: "Independent government cost estimate", kind: "money", bind: "igce_total" },
        T("igce_method", "IGCE estimating methodology"),
        T("life_cycle", "Life-cycle cost, design-to-cost and should-cost"),
      ],
    },
    {
      id: "capability",
      title: "Capability or Performance",
      citation: "FAR 7.105(a)(4)",
      tier: "binding",
      fields: [S("sow_type", "Requirement document", ["Statement of Work", "Performance Work Statement", "Statement of Objectives"], "Performance Work Statement"), T("capability", "Required capabilities and performance standards")],
    },
    {
      id: "delivery",
      title: "Delivery or Performance-Period Requirements",
      citation: "FAR 7.105(a)(5)",
      tier: "binding",
      fields: [
        { key: "pop_start", label: "Period of performance start", kind: "date", bind: "period_of_performance_start" },
        { key: "pop_end", label: "Period of performance end", kind: "date", bind: "period_of_performance_end" },
        T("delivery", "Delivery or performance-period requirements"),
      ],
    },
    {
      id: "tradeoffs",
      title: "Trade-offs",
      citation: "FAR 7.105(a)(6)",
      tier: "binding",
      standingText:
        "The Government is willing to pay more for a contract that offers increased value through an innovative approach, superior technical performance, or lower risk, either individually or in any combination.",
      fields: [T("tradeoffs", "Trade-offs expected among cost, capability and schedule")],
    },
    {
      id: "risks",
      title: "Risks",
      citation: "FAR 7.105(a)(7); NFS 1807.105(a)(7)",
      tier: "binding",
      fields: [T("risks", "Technical, cost, schedule, safety, security and OCI risks with mitigations")],
    },
    {
      id: "streamlining",
      title: "Acquisition Streamlining",
      citation: "FAR 7.105(a)(8); NFS 1807.105(a)(8)",
      tier: "binding",
      standingText: "Comply with the requirements of FAR 7.105(a)(8) and NFS 1807.105(a)(8).",
      fields: [T("streamlining", "Acquisition streamlining")],
    },
    {
      id: "sources",
      title: "Sources",
      citation: "FAR 7.105(b)(1); NFS 1807.105(b)(1); FAR Part 8; NFS Appendix A",
      tier: "binding",
      fields: [T("sources", "Sources considered, including AbilityOne, strategic sourcing and NFS Appendix A"), T("sources_sought", "Sources sought notice or request for information and the responses")],
    },
    {
      id: "competition",
      title: "Competition",
      citation: "FAR 7.105(b)(2)",
      tier: "binding",
      fields: [
        X("competition", "Competition", "competition"),
        T("competition_narrative", "How competition will be sought, promoted and sustained"),
        T("small_business", "Small business program and subcontracting goals"),
      ],
    },
    {
      id: "source_selection",
      title: "Source-Selection Procedures",
      citation: "FAR 7.105(b)(4); NFS 1815.3",
      tier: "binding",
      fields: [
        S("selection", "Source-selection procedures", ["Trade-off", "Lowest price technically acceptable", "Other", "N/A – Non-competitive acquisition."], "Trade-off"),
        T("factors", "Evaluation factors, subfactors and their relative order"),
      ],
    },
    {
      id: "contract_type",
      title: "Contracting Considerations",
      citation: "FAR 7.105(b)(3); FAR Part 16",
      tier: "binding",
      fields: [
        X("contract_type", "Contract type selected", "contract_type"),
        T("contract_type_rationale", "Rationale for the contract type"),
        T("dandfs", "Determinations, findings, deviations, waivers and approvals and their status"),
      ],
    },
    {
      id: "budget",
      title: "Budgeting and Funding",
      citation: "FAR 7.105(b)(6); NFS 1807.105(b)(6)",
      tier: "binding",
      fields: [T("budget", "Budget estimate and funding profile by government fiscal year"), T("bona_fide", "Bona fide needs and severability")],
    },
    {
      id: "descriptions",
      title: "Product or Service Descriptions",
      citation: "FAR 7.105(b)(7)",
      tier: "binding",
      fields: [
        X("naics_code", "NAICS code and title", "naics_code"),
        X("psc_code", "Product or service code", "psc_code"),
        T("service_descriptions", "Commerciality, non-personal services and Service Contract Labor Standards"),
      ],
    },
    {
      id: "priorities",
      title: "Priorities, Allocations, and Allotments",
      citation: "FAR 7.105(b)(8)",
      tier: "binding",
      fields: [X("dpas", "DPAS priority rating"), T("dpas_rationale", "Rationale")],
    },
    {
      id: "contractor_v_government",
      title: "Contractor versus Government Performance",
      citation: "FAR 7.105(b)(9); OMB Circular No. A-76",
      tier: "binding",
      standingText:
        "This is not an acquisition subject to OMB Circular No. A-76. The work has historically been performed by contractors. Civil servant resources are not available for this effort.",
      fields: [T("contractor_v_government", "Any further explanation")],
    },
    {
      id: "inherently_governmental",
      title: "Inherently Governmental Functions",
      citation: "FAR 7.503(e); NFS 1807.503(e)",
      tier: "binding",
      fields: [
        X("requiring_office_name", "Requiring office name", "requester_org_code"),
        T(
          "inherently_governmental",
          "Written determination provided to the contracting officer",
          "In accordance with FAR 7.503(e) and NFS 1807.503(e), the requiring office has provided the contracting officer with a written determination that none of the Statement of Work requirements include inherently governmental functions.",
        ),
      ],
    },
    {
      id: "management_information",
      title: "Management Information Requirements",
      citation: "FAR 7.105(b)(12)",
      tier: "binding",
      fields: [T("management_information", "Surveillance, CPARS, NF 533 reporting and earned value management")],
    },
    { id: "make_or_buy", title: "Make or Buy", citation: "FAR 7.105(b)(13); FAR 15.407-2", tier: "binding", fields: [T("make_or_buy", "Make-or-buy program")] },
    { id: "test", title: "Test and Evaluation", citation: "FAR 7.105(b)(14)", tier: "binding", fields: [T("test", "Test and evaluation")] },
    { id: "logistics", title: "Logistics Considerations", citation: "FAR 7.105(b)(15)", tier: "binding", fields: [T("logistics", "Logistics considerations")] },
    {
      id: "gfp",
      title: "Government-Furnished Property",
      citation: "FAR 7.105(b)(16); FAR Part 45",
      tier: "binding",
      fields: [T("gfp", "Government-furnished property and installation-accountable government property")],
    },
    { id: "gfi", title: "Government-Furnished Information", citation: "FAR 7.105(b)(17)", tier: "binding", fields: [T("gfi", "Government-furnished information")] },
    {
      id: "environment",
      title: "Environmental and Energy Conservation Objectives",
      citation: "FAR 7.105(b)(18); FAR Part 23",
      tier: "binding",
      fields: [T("environment", "Environmental and energy conservation objectives")],
    },
    {
      id: "security",
      title: "Security Considerations",
      citation: "FAR 7.105(b)(19); NFS 1807.105(b)(19)",
      tier: "binding",
      fields: [T("security", "Personal identity verification, classified work, controlled information and foreign travel")],
    },
    {
      id: "administration",
      title: "Contract Administration",
      citation: "FAR 7.105(b)(20)",
      tier: "binding",
      fields: [T("administration", "Contract administration, COR appointment, surveillance and data requirements")],
    },
    {
      id: "other",
      title: "Other Considerations",
      citation: "FAR 7.105(b)(21); FAR 7.107",
      tier: "binding",
      fields: [
        T("pcd", "Procurement class deviation review", "A review of impactful Executive Orders as implemented via Procurement Class Deviations (PCDs) has been completed and the solicitation reflects compliance with the PCDs."),
        T("it", "Information technology and artificial intelligence considerations"),
      ],
    },
    {
      id: "milestones",
      title: "Milestones for the Acquisition Cycle",
      citation: "FAR 7.105(b)(22)",
      tier: "binding",
      fields: [T("milestones", "Milestones from plan approval through contract effective date")],
    },
    {
      id: "participants",
      title: "Identification of Participants in Acquisition Plan Preparation",
      citation: "FAR 7.105(b)(23)",
      tier: "binding",
      standingText: "This plan was developed by the following team members:",
      fields: [T("participants", "Name, organizational code, title and contact for each team member")],
    },
    {
      id: "approval",
      title: "Stakeholder Concurrence and Approval",
      citation: "NFS 1807.103",
      tier: "binding",
      fields: [
        X("sig_co", "Contracting Officer"),
        X("sig_po", "Procurement Officer"),
        X("sig_cfo", "Chief Financial Officer or Center representative approving the IGCE"),
        X("sig_osbp", "Center Office of Small Business Programs representative"),
        X("sig_requirements", "Center requirements office representative"),
        X("sig_hca", "Head of the Contracting Activity"),
      ],
    },
  ],
};

// ------------------------------------------------------------------ 2. PSM
const execChart = (title: string, citation: string, fields: FieldDef[]): SectionDef => ({
  id: `exec_${title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`,
  title,
  citation,
  tier: "binding",
  fields,
});

const backupChart = (title: string, citation: string, fields: FieldDef[]): SectionDef => ({
  ...execChart(title, citation, fields),
  id: `backup_${title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`,
  collapsed: true,
});

const psm: TemplateDef = {
  key: "psm-executive-presentation",
  name: "Procurement Strategy Meeting Executive Presentation",
  tab: "002",
  layout: "plan",
  badge: {
    citation: "FAR Subpart 7.1; NFS Subpart 1807.1; PIC 25-03A; PIC 24-04A",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2025-04-01",
    note: "The PSM must address every topic in this template. Topics that do not apply are marked N/A.",
  },
  lead: "Procurement strategy meeting chart package: executive summary charts, then the back-up charts.",
  sections: [
    {
      id: "front",
      title: "Front matter",
      citation: "FAR 2.101; FAR 3.104",
      tier: "binding",
      standingText:
        "Information included in this presentation is considered \"SOURCE SELECTION INFORMATION\" and must be handled in accordance with FAR 2.101 and 3.104.",
      fields: [
        X("center_name", "Center name and acronym", "center_code"),
        X("acquisition_name", "Acquisition name and acronym", "title"),
        { key: "psm_date", label: "PSM date", kind: "date" },
        X("requiring_office", "Requirements owner organization", "requester_org_code"),
      ],
    },
    {
      id: "ethics",
      title: "Compliance with Ethical Obligations",
      citation: "18 U.S.C. §208; 5 CFR 2635.502; FAR 3.104",
      tier: "binding",
      standingText:
        "By attendance at this meeting, participants hereby affirm the following:\n" +
        "No one whose interests are imputed to you have a financial interest in any of the entities on the enclosed Interested Parties list. Those whose financial interests are imputed to you under 18 U.S.C. §208 are: Spouse, Minor child, General partner, Organization, or entity with which you serve as an officer, director, trustee, general partner, or employee, and Person (to include any entity) with which you are negotiating for, or have an arrangement with, concerning prospective employment.\n" +
        "You do not have a covered relationship with any entity on the Interested Parties list. Covered relationships that must be considered are the following (5 CFR 2635.502): Person or organization with whom you have or seek a business relationship that involves something more than a routine consumer purchase; Person who is a member of your household, or who is a relative with whom you have a close personal relationship; Person or organization for whom your spouse, parent or dependent child is, to your knowledge, serving or seeking to serve as an officer, director, trustee, general partner, agent, attorney, consultant, contractor or employee; Person or organization for whom you have, within the last year, served as officer, director, trustee, general partner, agent, attorney, consultant, contractor or employee; Organization, other than certain political organizations, in which you are an active participant.\n" +
        "You do not have any other ongoing relationships with, or interests in, any entity on the enclosed Interested Parties list, that would either give rise to a conflict of interest or an appearance of a conflict of interest. Further, neither you nor your spouse, parent, dependent child, or member of your household is seeking employment with any of the Interested Parties expressing interest in this procurement.",
      fields: [T("interested_parties", "Interested parties list")],
    },
    execChart("Potential Sources", "FAR 7.105(b)(1)", [
      T("potential_sources", "Potential sources", "Any person with a potential conflict of interest with any of the following potential sources must now excuse themselves from this presentation."),
    ]),
    execChart("Statement of Need", "FAR 7.105(a)(1)", [
      { key: "need", label: "Statement of need", kind: "textarea", bind: "description_of_requirement", required: true },
    ]),
    execChart("Applicable Conditions", "FAR 7.105(a)(2)", [T("conditions", "Applicable conditions")]),
    execChart("Cost", "FAR 7.105(a)(3)", [
      { key: "igce_total", label: "Independent government cost estimate", kind: "money", bind: "igce_total" },
      T("cost_basis", "Basis of the estimate"),
    ]),
    execChart("Capability or Performance", "FAR 7.105(a)(4)", [T("capability", "Required capabilities")]),
    execChart("Delivery or Performance-Period Requirements", "FAR 7.105(a)(5)", [
      { key: "pop_start", label: "Period of performance start", kind: "date", bind: "period_of_performance_start" },
      { key: "pop_end", label: "Period of performance end", kind: "date", bind: "period_of_performance_end" },
      T("delivery", "Delivery or performance-period requirements"),
    ]),
    execChart("Trade-offs", "FAR 7.105(a)(6)", [
      T("tradeoffs", "Trade-offs", "The Government is willing to pay more for a contract that offers increased value through an innovative approach, superior technical performance, or lower risk, either individually or in any combination."),
    ]),
    execChart("Risks", "FAR 7.105(a)(7); NFS 1807.105(a)(7)", [T("risks", "Risks and mitigations")]),
    execChart("Acquisition Streamlining", "FAR 7.105(a)(8)", [T("streamlining", "Acquisition streamlining")]),
    execChart("Sources", "FAR 7.105(b)(1)", [T("sources", "Sources")]),
    execChart("Competition", "FAR 7.105(b)(2)", [
      X("competition", "Competition", "competition"),
      T("competition_narrative", "How competition will be sought, promoted and sustained"),
    ]),
    execChart("Small Business Program", "FAR Part 19; NFS 1810.002", [
      X("set_aside", "Set-aside", "set_aside"),
      T("small_business", "Small business strategy and subcontracting goals"),
    ]),
    execChart("Contract Type Selection", "FAR 7.105(b)(3); FAR Part 16", [
      X("contract_type", "Contract type selected", "contract_type"),
      T("contract_type_rationale", "Rationale"),
    ]),
    execChart("Bundling or Consolidation", "FAR 7.107; NFS 1807.107", [
      S("bundling", "Bundling or consolidation", ["None", "Bundling", "Consolidation"], "None"),
      T("bundling_narrative", "Narrative and approving official"),
    ]),
    execChart("Made In America", "FAR 25.103(b)(2)(i)", [T("made_in_america", "Made in America")]),
    execChart("Strategic Sourcing Considerations", "FAR 7.105(b)(1)", [T("strategic_sourcing", "Strategic sourcing considerations")]),
    execChart("Challenges or Unique Aspects", "NFS 1807.105", [
      T("challenges", "Challenges or unique aspects", "Enter N/A – Routine competition with no anticipated challenges or unique aspects where none exist."),
    ]),
    execChart("Sources Sought Notice/RFI", "FAR Part 10; NFS 1810.002", [T("sources_sought", "Sources sought notice or request for information")]),
    execChart("Source Selection Procedures", "FAR 15.3; NFS 1815.3", [
      S("selection", "Source-selection procedures", ["Trade-off", "Lowest price technically acceptable", "Other", "N/A – Non-competitive acquisition."], "Trade-off"),
      T("mission_suitability", "Mission suitability factor and subfactor points, totalling 1,000"),
    ]),
    execChart("D&Fs, Deviations, Waivers and Approvals", "FAR 1.7; NFS 1801.4", [T("dandfs", "Each determination, deviation, waiver and approval with its status")]),
    execChart("Source Selection Authority", "NFS 1815.303", [X("ssa", "Source selection authority: name, title and organizational identifier")]),
    execChart("SEB Chairperson and Voting Membership", "NFS 1815.370", [T("seb", "Chair, other voting members, and the contracting officer or procurement member")]),
    execChart("Organizational Conflicts of Interest", "FAR 9.5", [T("oci", "OCIs identified and any waiver status")]),
    execChart("Status of Technical Documents", "FAR 7.105(b)(4)", [T("technical_documents", "Status of the SOW, PWS or SOO, evaluation criteria and eLibrary")]),
    execChart("Schedule", "FAR 7.105(b)(22)", [T("schedule", "Dates from plan approval through contract effective date")]),

    backupChart("Back-up: Statement of Need", "FAR 7.105(a)(1)", [
      T("bu_need", "Technical organization, mission, scope and objectives"),
      T("bu_current_contract", "Current contract history"),
      T("bu_alternatives", "Feasible acquisition alternatives"),
      T("bu_in_house", "Any related in-house effort", "There are no related in-house resources available currently capable of providing these services."),
    ]),
    backupChart("Back-up: Applicable Conditions", "FAR 7.105(a)(2); NPR 7120.5", [
      T("bu_conditions", "Compatibility, NPR applicability, earned value management and Section 508"),
      T("bu_constraints", "Cost, schedule and capability constraints"),
      T("bu_place", "Place of performance"),
    ]),
    backupChart("Back-up: Cost/Price", "FAR 7.105(a)(3)", [
      T("bu_igce", "IGCE totals"),
      T("bu_igce_method", "IGCE estimating methodology: labor hours, labor rates, indirect rates, other direct costs, fee, escalation"),
    ]),
    backupChart("Back-up: Capability or Performance", "FAR 7.105(a)(4)", [T("bu_capability", "Required capabilities, performance standards, QASP and performance evaluation plan")]),
    backupChart("Back-up: Delivery or Performance-Period Requirements", "FAR 7.105(a)(5); FAR 52.217-8", [T("bu_delivery", "Period of performance and option strategy")]),
    backupChart("Back-up: Trade-offs", "FAR 7.105(a)(6)", [T("bu_tradeoffs", "Trade-offs")]),
    backupChart("Back-up: Acquisition Streamlining", "FAR 7.105(a)(8)", [T("bu_streamlining", "Acquisition streamlining")]),
    backupChart("Back-up: Sources", "FAR 8.002; FAR 8.003; NFS Appendix A", [T("bu_sources", "AbilityOne, best-in-class vehicles, NFS Appendix A, FAR Part 12 and FAR Part 10 methods")]),
    backupChart("Back-up: Sources Sought Notice/RFI", "FAR Part 10", [T("bu_sources_sought", "Interested businesses and the small business office recommendation")]),
    backupChart("Back-up: Competition", "FAR 7.105(b)(2)", [T("bu_competition", "Competition, subcontract competition, major components and spares")]),
    backupChart("Back-up: Small Business Program", "FAR Part 19", [T("bu_small_business", "Subcontracting goals by category")]),
    backupChart("Back-up: Contract Type Selection", "FAR Part 16; NFS 1816", [T("bu_contract_type", "Contract type rationale, incentive or award-fee structure and share ratios")]),
    backupChart("Back-up: Source-Selection Procedures", "FAR 15.3; NFS 1815.3", [
      T("bu_selection", "Procedures, evaluation factors and weighting"),
      T("bu_board", "Board membership, advisors and ex-officio members"),
      T("bu_past_performance", "Past performance factor and confidence scale"),
    ]),
    backupChart("Back-up: Acquisition Considerations", "FAR 17.202; FAR 7.105(b)(5)", [
      T("bu_special_methods", "Special contracting methods, warranties and special clauses"),
      T("bu_options", "Option justification", "In accordance with FAR 17.202, the CO has determined (see contract file) the inclusion of option periods is in the best interest of the Government based on the following: The Government has a bona fide need for continuity of services to be provided under the contract; and The potential exists for additional costs due to disrupted support because there is an anticipated need for similar services beyond the basic period for which funds may not be available at this time."),
      T("bu_clin", "CLIN structure"),
    ]),
    backupChart("Back-up: Budgeting and Funding", "FAR 7.105(b)(6)", [T("bu_budget", "Budget estimate and funding profile by government fiscal year"), T("bu_shortfalls", "Approaches to eliminate funding shortfalls")]),
    backupChart("Back-up: Product or Service Descriptions", "FAR 7.105(b)(7); FAR 37.104", [
      X("bu_naics", "NAICS code and title", "naics_code"),
      X("bu_psc", "Product or service code", "psc_code"),
      T("bu_descriptions", "Commerciality, non-personal services and Service Contract Labor Standards"),
    ]),
    backupChart("Back-up: Priorities, Allocations, and Allotments", "FAR 7.105(b)(8)", [X("bu_dpas", "DPAS priority rating"), T("bu_dpas_rationale", "Rationale")]),
    backupChart("Back-up: Contractor versus Government Performance", "OMB Circular No. A-76", [
      T("bu_contractor_v_government", "Statements", "This is not an acquisition subject to OMB Circular No. A-76. The work has historically been performed by contractors. Civil servant resources are not available for this effort."),
    ]),
    backupChart("Back-up: Inherently Governmental Functions", "FAR 7.503(e); NFS 1807.503(e)", [
      T("bu_inherently_governmental", "Written determination", "In accordance with FAR 7.503(e) and NFS 1807.503(e), the requiring office has provided the CO with a written determination that none of the Statement of Work requirements include inherently governmental functions."),
    ]),
    backupChart("Back-up: Management Information Requirements", "FAR 7.105(b)(12)", [T("bu_management", "QASP, CPARS, NF 533 reporting, award-fee evaluations and earned value management")]),
    backupChart("Back-up: Make or Buy", "FAR 15.407-2(d)(2)", [T("bu_make_or_buy", "Make-or-buy program")]),
    backupChart("Back-up: Test and Evaluation", "FAR 7.105(b)(14)", [T("bu_test", "Test and evaluation, or mission assurance requirements")]),
    backupChart("Back-up: Logistics Considerations", "FAR 7.105(b)(15)", [T("bu_logistics", "Logistics considerations and data rights")]),
    backupChart("Back-up: Government-Furnished Property", "FAR Part 45; NF 1739", [T("bu_gfp", "IAGP, GFP, capital asset determination and property clauses")]),
    backupChart("Back-up: Government-Furnished Information", "FAR 7.105(b)(17)", [T("bu_gfi", "Government-furnished information")]),
    backupChart("Back-up: Environmental and Energy Conservation Objectives", "FAR Part 23", [T("bu_environment", "Environmental and energy conservation objectives")]),
    backupChart("Back-up: Security Considerations", "NFS 1807.105(b)(19); NPR 1660.1", [T("bu_security", "PIV, classified work, controlled information and foreign travel")]),
    backupChart("Back-up: Contract Administration", "FAR 7.105(b)(20); NF 1634", [
      T("bu_administration", "COR appointment, surveillance, data requirements descriptions and required plans"),
      T("bu_undefinitized", "Undefinitized contractual actions", "No undefinitized contractual actions are anticipated."),
    ]),
    backupChart("Back-up: Other Considerations", "FAR 7.105(b)(21)", [
      T("bu_pcd", "Procurement class deviation review", "A review of impactful Executive Orders as implemented via Procurement Class Deviations (PCDs) has been completed and the solicitation reflects compliance with the PCDs."),
      T("bu_it", "Information technology, ORCA authorization number and artificial intelligence"),
    ]),
    backupChart("Back-up: Milestones for the Acquisition Cycle", "FAR 7.105(b)(22)", [T("bu_milestones", "Milestone dates from sources sought through contract effective date")]),
    backupChart("Back-up: Identification of Participants", "FAR 7.105(b)(23)", [
      T("bu_participants", "This PSM was developed by the following team members: name, organizational code identifier, title and contact"),
    ]),
    backupChart("Back-up: Source Evaluation Qualifications", "NFS 1815.370", [T("bu_qualifications", "Qualification statements for each voting member")]),
  ],
};

// ------------------------------------------------------- 3. PSM signature page
const psmSignaturePage: TemplateDef = {
  key: "psm-signature-page",
  name: "Procurement Strategy Meeting Signature Page Template for Contracts",
  tab: "002",
  layout: "plan",
  badge: {
    citation: "NFS 1807.103; PIC 24-06",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2025-04-01",
    note: "Required for every PSM approved by NASA Headquarters Office of Procurement; optional for all other PSMs.",
  },
  lead: "PSM stakeholder concurrence signature page.",
  sections: [
    {
      id: "concurrence",
      title: "PSM STAKEHOLDER CONCURRENCE",
      citation: "NFS 1807.103",
      tier: "binding",
      fields: [
        X("acquisition_name", "Acquisition name and acronym", "title"),
        X("center_name", "Center", "center_code"),
      ],
    },
    {
      id: "signature_page",
      title: "SIGNATURE PAGE",
      citation: "PIC 24-06",
      tier: "binding",
      fields: [
        X("sig_procurement_officer", "Procurement Officer, or the cognizant Center Procurement Office representative"),
        X("sig_cfo", "Chief Financial Officer, or the Center representative approving the IGCE"),
        X("sig_osbp", "Center Office of Small Business Programs representative"),
        X("sig_requirements", "Center requirements office representative"),
        {
          key: "sig_epo",
          label: "Director, Enterprise Pricing Office",
          kind: "text",
          help: "Include this block in the Headquarters signature list for any PSM approved by the Senior Procurement Executive.",
        },
      ],
    },
  ],
};

// ------------------------------------------------------------ 4. PSM addendum
const psmAddendum: TemplateDef = {
  key: "psm-addendum",
  name: "Addendum Outlining Significant Changes to Approved PSMs / Written Acquisition Plans Template",
  tab: "002",
  layout: "memo",
  badge: {
    citation: "NFS 1807.103(j)(vii); NFS 1802.101",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2025-04-01",
    note: "Used for significant changes until contract award. Post-award changes belong in the post-award documentation.",
  },
  lead: "Addendum documenting significant changes to an approved PSM or written acquisition plan.",
  sections: [
    {
      id: "opening",
      title: "Addendum Outlining Significant Changes to Approved Procurement Strategy Meeting/Written Acquisition Plan",
      citation: "NFS 1807.103(j)(vii)",
      tier: "binding",
      fields: [
        S("plan_kind", "Approved document", ["Procurement Strategy Meeting (PSM)", "written Acquisition Plan (AP)"], "Procurement Strategy Meeting (PSM)"),
        X("center_name", "Center name and acquisition name or acronym", "title"),
      ],
    },
    {
      id: "background",
      title: "Background",
      citation: "NFS 1807.103(j)(vii)",
      tier: "binding",
      fields: [
        T("background", "What is being acquired, current status, the date the PSM was held and approved or the plan approved, and the approval authority"),
      ],
    },
    {
      id: "changes",
      title: "Proposed Change(s)",
      citation: "NFS 1807.103(j)(vii)",
      tier: "binding",
      fields: [
        T("change_reference", "PSM or plan section, chart or page number, summary and reason"),
        T("change_from", "FROM: existing language"),
        T("change_to", "TO: proposed changed language"),
        T("change_new", "For new or added language: the proposed language, or the existing language to be deleted"),
      ],
    },
    {
      id: "signature_page",
      title: "SIGNATURE PAGE — Addendum Outlining Significant Changes to Approved PSM/Written Acquisition Plan",
      citation: "NFS 1802.101",
      tier: "binding",
      standingText: "Additional signatures may be added below to comply with local Center procedures.",
      fields: [
        X("sig_co", "Contracting Officer"),
        { key: "sig_ccta", label: "Chief of the Contracting Activity, NOJMO", kind: "text", help: "NOJMO actions only." },
        { key: "sig_po", label: "Procurement Officer", kind: "text", help: "ESDMD and SOMD actions only." },
        { key: "sig_psod", label: "CONCURRENCE: Director, Procurement Strategic Operations Division", kind: "text", help: "For significant changes to PSMs or plans approved by Headquarters." },
        X("sig_hca", "APPROVAL: Head of the Contracting Activity"),
      ],
    },
  ],
};

// --------------------------------------------------------- 5. ASM not conducted
const asmNotConducted: TemplateDef = {
  key: "asm-not-conducted",
  name: "Determination ASM Not Conducted Memorandum",
  tab: "002",
  layout: "memo",
  badge: {
    citation: "NPD 1000.5; NPD 1000.3, Chapter 6.1; NAII 1000.1; PIC 24-06",
    tier: "guidance",
    revision: "HQ 04/2026 revision",
    effective: "2025-05-01",
    note: "The final memorandum carries source selection and pre-decisional information and is filed with the SF 901 cover sheet.",
  },
  lead: "Memorandum determining that an optional acquisition strategy meeting is not required.",
  sections: [
    {
      id: "memo_header",
      title: "Memorandum",
      citation: "NPD 1000.5",
      tier: "binding",
      fields: [
        { key: "memo_date", label: "Date", kind: "date" },
        X("to", "TO: name, Assistant Administrator for the Office of Procurement (OP)"),
        X("from", "FROM: name, Acquisition Strategy Council Executive"),
        X("subject_acquisition", "SUBJECT: name of the acquisition and acronym", "title"),
      ],
    },
    {
      id: "background",
      title: "Background.",
      citation: "NPD 1000.5C; NPD 1000.3, Chapter 6.1",
      tier: "binding",
      fields: [
        T("background", "Directorate or office that owns the requirement, the top-level purpose, and the outcomes of any decision framing meeting or pre-ASM"),
      ],
    },
    {
      id: "determination",
      title: "Determination:",
      citation: "NPD 1000.5 subsection 5.b.(2)",
      tier: "binding",
      fields: [
        T(
          "determination",
          "Determination",
          "Based on the above, the ASC Chair has determined that an optional ASM is not required. The acquisition is approved to proceed to the Procurement Strategy Meeting, which is chaired by the Assistant Administrator for the Office of Procurement.",
        ),
      ],
    },
    {
      id: "signature",
      title: "V/R,",
      citation: "NPD 1000.5",
      tier: "binding",
      fields: [X("sig_asc", "Acquisition Strategy Council Executive")],
    },
  ],
};

// -------------------------------------------------------------- 6. RDT letters
const RDT_CHECKLIST = [
  "Implementing project management principles to achieve timely completion of actions",
  "Conducting market research prior to developing a PWS, SOW, or SOO, including risk and constraints (FAR Part 10, NFS 1810.002)",
  "Create e-Library, as applicable",
  "Defining and preparing PWS/SOW/SOO requirements (FAR Part 11, NFS Part 1811)",
  "Developing drawings for industry use, as applicable (FAR Part 11, FAR Subpart 39.2, NFS 1839.203-70)",
  "Preparing all programmatic and technical CDRL/DRD (FAR Part 11, NFS Part 1811)",
  "Support completion of NF 1787 in consultation with the OSBP SBS and completion of NPD 5000 (FAR Part 19, NFS Part 1819)",
  "Assess the amount of work performed on and offsite and other Government furnished facilities or IAGP/services (FAR Part 45, NFS Part 1845)",
  "Health and Safety (FAR 7.105(a)(7), NFS 1807.104(a), NFS 1807.105(a)(7), NFS 1823.7001(d)(2))",
  "Identification and description of risks (FAR 7.105(a)(7), NFS 1807.105(a)(7))",
  "Mission assurance requirements, as applicable (FAR Part 46, NFS Part 1846, NPR 8705.4, NPR 8705.2)",
  "Initial draft CLIN structure, used when developing the IGCE (FAR Subpart 4.10, NFS 1804.10)",
  "Identify the estimated cost and describe the estimating methodology (FAR 7.105(a)(3), NFS 1807.105(a)(3))",
  "Drafting the Quality Assurance Surveillance Plan (FAR Part 37.6, NFS Part 1837.6)",
  "Support the Procurement Office in selection of contract type, including any applicable Determination & Findings (FAR Part 16, NFS Part 1816)",
  "Budget Estimate and Funding by Government fiscal year (FAR 7.105(b)(6), NFS 1807.105(b)(6)(B))",
  "Completion of the NF 1707 Special Approvals and Affirmations of Requisitions (NFS 1804.73)",
  "Incorporate Supply Chain Visibility Reporting DRD as applicable (NPR 7120.5)",
  "Completion of the NF 1739 NASA Projects Capitalization Determination Form (NPR 9250.1)",
  "Assessing and establishing citation of required technical reference documents, including ITAR, EAR and proprietary information prior to release",
  "Provisioning any necessary GFP and establishing the list of GFP to be provided (FAR Part 45, NFS Part 1845)",
  "Coordinating the acquisition package with required review and approval organizations (NFS 1807.104)",
  "Support the Procurement Office in drafting and obtaining approval of any applicable JOFOC, Determinations and Findings, and deviations (FAR Subpart 1.7, Subpart 6.3, NFS 1801.4, NFS Subpart 1806.3)",
  "Support the Procurement Office in preparing the initial draft of the proposal instructions and evaluation criteria (FAR 7.105(b)(4), NFS 1807.105(b)(4))",
  "Support the Acquisition Planning Team in drafting the PSM Charts (FAR 7.104, NFS Subpart 1807.104, FAR 7.105, NFS 1807.105)",
  "Coordinating requirements with the ERM for acquisitions associated with a product service line, or with the requirements owner organization designee",
  "Support the Procurement Office in drafting the Organizational Conflicts of Interest Limitation of Future Contracting documentation (FAR 9.5, NFS Part 1809)",
];

const rdtLetters: TemplateDef = {
  key: "rdt-request-appointment",
  name: "Requirements Development Team Request & Appointment Letters",
  tab: "002",
  layout: "memo",
  badge: {
    citation: "FAR Part 7; FAR 3.104; NFS 1803.104; NFS 1804.7103",
    tier: "guidance",
    revision: "HQ 05/2026 revision",
    effective: "2025-01-01",
    note: "Required for new awards or recompetes estimated at $50 million or more; optional for other acquisitions.",
  },
  lead: "RDT membership request letter, RDT appointment letter, and the acquisition package products and support listing.",
  sections: [
    {
      id: "letter1",
      title: "Letter 1 — Requirements Development Team (RDT) Membership Request",
      citation: "FAR Part 7; NFS Subpart 1807.104",
      tier: "guidance",
      standingText:
        "The purpose of this letter is to begin the acquisition development process by soliciting appointment of members for the RDT.",
      fields: [
        { key: "l1_date", label: "Date", kind: "date" },
        X("l1_org_code", "Reply to Attn of: organizational code", "requester_org_code"),
        S("l1_to", "TO", ["Enterprise Requirements Manager (ERM)", "Directorate-level Technical Lead"], "Enterprise Requirements Manager (ERM)"),
        X("l1_subject", "SUBJECT: title of acquisition", "title"),
        T("l1_opening", "Opening paragraph: the current contract and its expiration, or the need to start a new acquisition"),
        S("l1_chair_source", "Chairperson selection", [
          "be designated in conjunction with the Enterprise Requirements Manager (ERM) and the Agency Office associated with the acquisition",
          "come from the Lead Technical Organization for the requirement",
        ]),
        X("l1_procurement_rep", "RDT procurement representative: name and title", "co_name"),
        { key: "l1_package_due", label: "Acquisition package due date", kind: "date" },
        { key: "l1_psm_date", label: "Procurement Strategy Meeting date", kind: "date" },
        { key: "l1_rfp_date", label: "Final Request for Proposal date", kind: "date" },
        { key: "l1_award_date", label: "Award date", kind: "date", bind: "target_award_date" },
        { key: "l1_appointment_due", label: "Appointment deadline", kind: "date" },
        X("l1_signer", "Signature: name, Procurement Officer"),
        T("l1_distribution", "Distribution"),
      ],
    },
    {
      id: "letter2",
      title: "Letter 2 — Appointment of the Requirements Development Team (RDT)",
      citation: "FAR 3.104; NFS 1803.104",
      tier: "guidance",
      standingText:
        "The purpose of this letter is to formally begin the acquisition development process by appointing members to the RDT. Coordination with stakeholders has resulted in the selection and appointment of the following RDT members to support this effort:\n" +
        "The RDT Chair and all members must comply with FAR 3.104 and NFS 1803.104, which provide requirements related to the protection and disclosure of source selection information.",
      fields: [
        { key: "l2_date", label: "Date", kind: "date" },
        X("l2_org_code", "Reply to Attn of: organizational code", "requester_org_code"),
        S("l2_from", "FROM", ["Enterprise Requirements Manager (ERM)", "Directorate Level Technical Lead"], "Enterprise Requirements Manager (ERM)"),
        X("l2_subject", "SUBJECT: title of acquisition", "title"),
        X("l2_chair", "CHAIRPERSON: name and technical organization"),
        T("l2_members", "MEMBERS: name and technical organization"),
        T("l2_advisors", "ADVISORS: title and office"),
        X("l2_procurement_reps", "Procurement representatives receiving monthly updates"),
        X("l2_signer", "Signature: name and title"),
        T("l2_distribution", "Distribution"),
      ],
    },
    {
      id: "enclosure",
      title: "Enclosure — RDT ACQUISITION PACKAGE PRODUCTS AND SUPPORT",
      citation: "NFS 1807.104",
      tier: "guidance",
      standingText: RDT_CHECKLIST.join("\n"),
      fields: [T("enclosure_tailoring", "Products and support tailored to this acquisition")],
    },
  ],
};

// ------------------------------------------------------- 7-10. Contract-type D&Fs
function contractTypeDandF(opts: {
  key: string;
  name: string;
  typeLabel: string;
  titleLine: string;
  authorityHeading: string;
  authoritySentence: string;
  sectionThree: SectionDef[];
  determination: string;
  signaturePageTitle: string;
  signatureBlocks: { label: string; note?: string }[];
  badge: TemplateDef["badge"];
  approvalCitation: string;
}): TemplateDef {
  return {
    key: opts.key,
    name: opts.name,
    tab: "003",
    layout: "dandf",
    badge: opts.badge,
    lead: `Determination and findings supporting a ${opts.typeLabel} contract.`,
    sections: [
      hqHeader(`DETERMINATION AND FINDINGS\n${opts.titleLine}`, opts.badge.citation),
      {
        id: "authority",
        title: opts.authorityHeading,
        citation: opts.badge.citation,
        tier: "binding",
        standingText: opts.authoritySentence,
        fields: [],
      },
      generalDescription(opts.typeLabel),
      ...opts.sectionThree,
      {
        id: "determination",
        title: "Determination",
        citation: opts.approvalCitation,
        tier: "binding",
        standingText: opts.determination,
        fields: [{ key: "determined_on", label: "Date", kind: "date" }],
      },
      signaturePage(opts.signaturePageTitle, opts.signatureBlocks, opts.approvalCitation),
    ],
  };
}

const dandfCpif = contractTypeDandF({
  key: "dandf-cpif",
  name: "Determination and Findings Authority to Execute a CPIF Contract",
  typeLabel: "cost-plus-incentive-fee (CPIF)",
  titleLine: "Authority to Execute a Cost-Plus-Incentive-Fee (CPIF) Contract",
  authorityHeading: "I. Authority – FAR 16.401(d) and NFS 1816.401(d)",
  authoritySentence:
    "In accordance with FAR 16.401(d) and as supplemented by the NASA FAR Supplement (NFS) 1816.401(d) the following determination and findings support the use of a CPIF contract for this acquisition.",
  badge: {
    citation: "FAR 16.401(d); NFS 1816.401(d); FAR 16.405-1",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2024-07-16",
    note: "Signed before a solicitation using an incentive is issued. Approval authority: Head of the Contracting Activity.",
  },
  sectionThree: [
    {
      id: "iii_a",
      title: "III. CONSIDERATION OF CONTRACT TYPES — A. A FIRM-FIXED PRICE CONTRACT IS NOT SUITABLE",
      citation: "FAR 16.301-3",
      tier: "binding",
      standingText:
        "The acquisition is not for commercial products or commercial services (see parts 2 and 12) since use of cost-reimbursement contracts are prohibited for these acquisition IAW 16.301-3.",
      fields: [T("iii_a", "Why a firm-fixed-price contract is not suitable")],
    },
    {
      id: "iii_b",
      title: "B. USE OF COST-REIMBURSEMENT CONTRACT TYPE",
      citation: "FAR 16.301-2",
      tier: "binding",
      fields: [
        T("iii_b_1", "1. Uncertainties in performance"),
        T("iii_b_2", "2. Environment and types of change expected"),
        T("iii_b_3", "3. Requirement types covered"),
        T("iii_b_4", "4. Why costs cannot be estimated with sufficient accuracy"),
      ],
    },
    {
      id: "iii_c",
      title: "C. FACTORS IN SELECTING CONTRACT TYPES IN FAR 16.104",
      citation: "FAR 16.104",
      tier: "binding",
      standingText:
        "All factors in selecting contract types in FAR 16.104 have been thoroughly considered and those applicable to this contract are noted below:",
      fields: far16104Fields(),
    },
    {
      id: "iii_d",
      title: "D. USE OF INCENTIVE FEE",
      citation: "FAR 16.405-1(b)",
      tier: "binding",
      fields: [
        T("iii_d", "How the target cost and fee adjustment formula will be negotiated"),
        X("incentive_metrics", "Selected technical performance metrics"),
        X("technical_percent", "Technical incentive fee, percent"),
        X("cost_percent", "Cost incentive fee, percent"),
        X("share_ratio", "Share ratio, for example 80/20"),
      ],
    },
  ],
  determination:
    "In accordance with FAR 16.401(d) and 16.405-1(b), I have determined the following: A. A cost-reimbursement contract is necessary because uncertainties involved in contract performance do not permit costs to be estimated with sufficient accuracy to use any type of fixed price arrangement. B. A target cost and a cost incentive fee adjustment formula based on the relationship of total allowable costs to total target costs can be negotiated that are likely to motivate the contractor to manage cost effectively. C. Predetermined objective, measurable technical performance requirements levels can be established that relate the amount of technical incentive fee earned to the technical performance level achieved by the contract to encourage excellent technical performance. In accordance with the authority at NFS 1816.401(d), and based on the findings herein, I have determined that a CPIF contract type is appropriate for this acquisition. The use of this contract type is in the best interest of the Government.",
  signaturePageTitle: "DETERMINATION AND FINDINGS FOR USE OF A COST-PLUS INCENTIVE FEE CONTRACT",
  signatureBlocks: [CO_BLOCK, LEGAL_BLOCK, PO_BLOCK, HQ_OGC_BLOCK, HCA_BLOCK],
  approvalCitation: "FAR 16.401(d); NFS 1816.401(d)",
});

const dandfCpaf = contractTypeDandF({
  key: "dandf-cpaf",
  name: "Determination and Findings Authority to Execute a CPAF Contract",
  typeLabel: "cost-plus-award-fee (CPAF)",
  titleLine: "Authority to Execute a Cost-Plus-Award-Fee (CPAF) Contract",
  authorityHeading: "I. Authority- FAR 16.401(d), NFS 1816.401(d) and 1816.405-270(a)",
  authoritySentence:
    "In accordance with Federal Acquisition Regulation (FAR) 16.401(d), as supplemented by the NASA FAR Supplement (NFS) 1816.401(d) and 1816.405-270(a), the following determination and findings support the use of a Cost-Plus-Award-Fee (CPAF) contract for this proposed acquisition.",
  badge: {
    citation: "FAR 16.401(d); NFS 1816.401(d); NFS 1816.405-270(a)",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2024-07-16",
    note: "Approval authority: Senior Procurement Executive.",
  },
  sectionThree: [
    {
      id: "iii_a",
      title: "III. Consideration of Contract Types — A. Evaluation of Fixed Price versus Cost Reimbursement Contract Type- FAR 16.202-2",
      citation: "FAR 16.202-2; FAR 16.301-2; FAR 16.104",
      tier: "binding",
      standingText:
        "In accordance with FAR 16.301-2, a cost-reimbursement contract type is appropriate, as the uncertainties involved in contract performance do not permit costs to be estimated with sufficient accuracy to use any type of fixed price arrangement. Therefore a reasonable basis for firm fixed pricing under this contract does not exist, and a cost reimbursement contract is appropriate.\nAll factors in FAR 16.104 have been thoroughly considered for this contract and are addressed below.",
      fields: [T("iii_a", "Evaluation of fixed price versus cost reimbursement"), ...far16104Fields()],
    },
    {
      id: "iii_b",
      title: "B. Evaluation of Other Contract Types- NFS 1816.405-270(a)",
      citation: "NFS 1816.405-270(a)",
      tier: "binding",
      fields: [T("iii_b_cpff", "Cost-Plus-Fixed-Fee (CPFF)"), T("iii_b_cpif", "Cost-Plus-Incentive-Fee (CPIF)")],
    },
    {
      id: "iv",
      title: "IV. Use of Award Fee- FAR 16.401(e)(1)",
      citation: "FAR 16.401(e)(1)",
      tier: "binding",
      standingText:
        "In consideration of FAR 16.401(e)(1), utilization of an award fee contract is suitable for this acquisition for the following reasons. The use of Award Fee will incentivize the contractor to excel in technical and schedule performance while effectively managing cost.",
      fields: [
        T("iv_a", "A. Why predetermined objective incentive targets are neither feasible nor effective"),
        T("iv_b", "B. How the award fee has motivated performance on the predecessor or similar contracts"),
        T("iv_c", "C. Risk and cost-benefit analysis of award fee administration"),
      ],
    },
    {
      id: "nfs_compliance",
      title: "Compliance with NFS Requirements- NFS 1816.4",
      citation: "NFS 1816.4; NFS 1816.402; NFS 1816.405-271",
      tier: "binding",
      fields: [
        T("nfs_compliance", "How the requirements of NFS 1816.4 are met, with rationale for any that do not apply"),
        X("fdo_title", "Fee Determination Official title, for an end-item contract"),
      ],
    },
  ],
  determination:
    "In accordance with FAR 16.401(e), an award fee contract is suitable for this acquisition for the following reasons: The work to be performed is such that it is neither feasible nor effective to utilize predetermined objective incentive targets applicable to cost, technical performance, or schedule. The likelihood of meeting acquisition objectives will be enhanced by using a contract that effectively motivates the contractor toward exceptional performance and provides the Government with the flexibility to evaluate both actual performance and the conditions under which it was achieved. Any additional administrative effort and cost required to monitor and evaluate performance are justified by the expected benefits. Additionally, in accordance with NFS 1816.405-270, the use of an award fee contract for this acquisition is appropriate after consideration of other types of contracts. Based on the aforementioned, the use of a Cost-Plus-Award-Fee contract is considered to be in the best interest of the Government.",
  signaturePageTitle: "AWARD FEE DETERMINATION AND FINDINGS FOR USE OF AN AWARD FEE CONTRACT",
  signatureBlocks: [CO_BLOCK, LEGAL_BLOCK, { label: "Procurement Officer", note: "Include this concurrence only for NSSC, NMO and HEOMD actions." }, HCA_BLOCK, HQ_OGC_BLOCK, SPE_BLOCK],
  approvalCitation: "FAR 16.401(e); NFS 1816.405-270",
});

const dandfFpaf = contractTypeDandF({
  key: "dandf-fpaf",
  name: "Determination and Findings Authority to Execute a FPAF Contract",
  typeLabel: "fixed-price-award-fee (FPAF)",
  titleLine: "Authority to Execute a Fixed-Price-Award-Fee (FPAF) Contract",
  authorityHeading: "I. Authority- FAR 16.401(d), NFS 1816.401(d) and 1816.405-270(a)",
  authoritySentence:
    "In accordance with Federal Acquisition Regulation (FAR) 16.401(d), as supplemented by the NASA FAR Supplement (NFS) 1816.401(d) and NFS 1816.405-270(a), the following determination and findings support the use of a Fixed-Price-Award-Fee (FPAF) or Firm-Fixed-Price contract type for this proposed acquisition.",
  badge: {
    citation: "FAR 16.401(d); NFS 1816.401(d); NFS 1816.405-270(a)",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2024-07-16",
    note: "Approval authority: Senior Procurement Executive. Two variants: firm-fixed-price award fee, or fixed-price award fee.",
  },
  sectionThree: [
    {
      id: "iii_a",
      title: "III. CONSIDERATION OF CONTRACT TYPES — A. USE OF A FIXED-PRICE CONTRACT TYPE",
      citation: "FAR 16.202-2; FAR 16.202-1",
      tier: "binding",
      fields: [
        S("variant", "Variant", ["Firm-fixed-price award fee", "Fixed-price award fee"], "Fixed-price award fee"),
        T("iii_a_ffp", "How the intended contract meets the conditions in FAR 16.202-2", "Used for the firm-fixed-price award fee variant."),
        T("iii_a_fp", "Why a firm-fixed-price contract is not suitable", "Used for the fixed-price award fee variant."),
      ],
    },
    {
      id: "iii_b",
      title: "B. USE OF AWARD FEE INCENTIVE",
      citation: "FAR 16.401(e)(1); NFS 1816.405-270(a)",
      tier: "binding",
      standingText:
        "In accordance with FAR 16.401(e)(1), the following items should be addressed to support use of an award fee contract type:\n" +
        "(i) The work to be performed is such that it is neither feasible nor effective to devise predetermined objective incentive targets applicable to cost, schedule, and technical performance;\n" +
        "(ii) The likelihood of meeting acquisition objectives will be enhanced by using a contract that effectively motivates the contractor toward exceptional performance and provides the Government with the flexibility to evaluate both actual performance and the conditions under which it was achieved;\n" +
        "(iii) Any additional administrative effort and cost required to monitor and evaluate performance are justified by the expected benefits as documented by a risk and cost benefit analysis.",
      fields: [
        T("iii_b_i", "(i) Narrative"),
        T("iii_b_ii", "(ii) Narrative"),
        T("iii_b_iii", "(iii) Risk and cost benefit analysis"),
        T("iii_b_other", "Other contract types considered, and why an award fee incentive is the appropriate choice"),
      ],
    },
  ],
  determination:
    "For a firm-fixed-price award fee contract: In accordance with FAR 16.401(e) and NFS 1816.405-270, a firm-fixed-price award fee contract is suitable for this acquisition for the following reasons: A. The work to be performed is such that it is neither feasible nor effective to utilize predetermined objective incentive targets applicable to cost, technical performance, or schedule/delivery. B. The likelihood of meeting acquisition objectives will be enhanced by using a contract that effectively motivates the contractor toward exceptional performance and provides the Government with the flexibility to evaluate both actual performance and the conditions under which it was achieved. C. Any additional administrative effort and cost required to monitor and evaluate performance are justified by the expected benefits. Based on the aforementioned, the use of a Firm-Fixed-Price-Award-Fee contract is considered to be in the best interest of the Government.\n" +
    "For a fixed-price award fee contract: In accordance with FAR 16.401(e)(1) and NFS 1816.405-270, a fixed-price award fee contract is suitable for this acquisition for the following reasons: A. The use of a firm-fixed contract type is not suitable for this acquisition. B. The work to be performed is such that it is neither feasible nor effective to utilize predetermined objective incentive targets applicable to cost, technical performance, or schedule/delivery. C. The likelihood of meeting acquisition objectives will be enhanced by using a contract that effectively motivates the contractor toward exceptional performance and provides the Government with the flexibility to evaluate both actual performance and the conditions under which it was achieved. D. Any additional administrative effort and cost required to monitor and evaluate performance are justified by the expected benefits. Based on the aforementioned, the use of a Fixed-Price-Award-Fee contract is considered to be in the best interest of the Government.",
  signaturePageTitle: "DETERMINATION AND FINDINGS FOR USE OF A FIXED-PRICE AWARD FEE CONTRACT",
  signatureBlocks: [CO_BLOCK, LEGAL_BLOCK, PO_BLOCK, HCA_BLOCK, HQ_OGC_BLOCK, SPE_BLOCK],
  approvalCitation: "FAR 16.401(e); NFS 1816.405-270",
});

const dandfFpi = contractTypeDandF({
  key: "dandf-fpi",
  name: "Determination and Findings Authority to Execute a FPI Contract",
  typeLabel: "fixed-price-incentive (FPI)",
  titleLine: "Authority to Execute a Fixed-Price-Incentive (FPI) Contract",
  authorityHeading: "I. Authority- FAR 16.401(d), NFS 1816.401(d)",
  authoritySentence:
    "In accordance with Federal Acquisition Regulation (FAR) 16.401(d), as supplemented by the NASA FAR Supplement (NFS) 1816.401(d), the following determination and findings support the use of a FPI contract for this acquisition.",
  badge: {
    citation: "FAR 16.401(d); NFS 1816.401(d); FAR 16.403",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2023-07-20",
    note: "Approval authority: Head of the Contracting Activity. Two variants: firm target, or successive targets.",
  },
  sectionThree: [
    {
      id: "iii_a",
      title: "III. CONSIDERATION OF CONTRACT TYPES — A. A FIRM-FIXED PRICE CONTRACT IS NOT SUITABLE",
      citation: "FAR 16.202",
      tier: "binding",
      standingText: "A firm-fixed-price contract is not suitable for the following reasons:",
      fields: [T("iii_a", "Reasons")],
    },
    {
      id: "iii_b",
      title: "B. USE OF FIXED-PRICE INCENTIVE (FPI) CONTRACT TYPE",
      citation: "FAR 16.403(b); FAR 16.403-1; FAR 16.403-2",
      tier: "binding",
      standingText:
        "In accordance with FAR 16.403(b), the following items support use of an incentive contract type for this acquisition:\n" +
        "Since it is usually to the Government's advantage for the contractor to assume substantial cost responsibility and an appropriate share of the cost risk, fixed-price contracts are preferred when contract costs and performance requirements are reasonably certain. Fixed-price incentive contracts provide for an adjustable price that includes a ceiling price, a target price (including target cost), or both. Unless otherwise specified in the contract, the ceiling price or target price is subject to adjustment only by operation of contract clauses providing for equitable adjustment or other revision of the contract price under stated circumstances.",
      fields: [
        S("variant", "Variant", ["Firm Target contract type", "Successive Target contract type"], "Firm Target contract type"),
        T("iii_b_cost", "Cost responsibility and cost risk"),
        T("iii_b_incentive", "Technical performance or delivery incentives"),
        X("incentive_metrics", "Selected metrics"),
        X("technical_percent", "Technical incentive, percent"),
        X("cost_percent", "Cost incentive, percent"),
        X("share_ratio", "Share ratio, for example 80/20"),
      ],
    },
  ],
  determination:
    "In accordance with FAR 16.401, I have determined the following: A. A fixed-price incentive (FPI) contract is necessary because a firm-fixed-price contract is not appropriate and the required supplies or services can be acquired at lower cost and with improved technical and schedule/delivery performance, by relating the amount of profit payable under the contract to the contractor's performance.\n" +
    "For a firm target contract: B. The contractor's accounting system is adequate for providing data to support negotiation of final cost and incentive price revision; and C. Adequate cost or pricing information for establishing reasonable firm targets is available at the time of initial contract negotiation.\n" +
    "For successive targets: B. The contractor's accounting system is adequate for providing data for negotiating firm targets and a realistic profit adjustment formula, as well as later negotiation of final costs; and C. Cost or pricing information adequate for establishing a reasonable firm target cost is reasonably expected to be available at an early point in contract performance.\n" +
    "In accordance with the authority at NFS 1816.401(d), and based on the findings herein, I have determined that a FPI contract type is appropriate for this acquisition. The use of this contract type is in the best interest of the Government.",
  signaturePageTitle: "DETERMINATION AND FINDINGS FOR USE OF A FIXED-PRICE INCENTIVE CONTRACT",
  signatureBlocks: [CO_BLOCK, LEGAL_BLOCK, PO_BLOCK, HCA_BLOCK],
  approvalCitation: "FAR 16.401(d); NFS 1816.401(d)",
});

// ---------------------------------------------- 11-12. T&M or labor-hour D&Fs
function tmLhDandF(opts: {
  key: string;
  name: string;
  instrumentOptions: string[];
  titleLine: string;
  authoritySentence: string;
  badge: TemplateDef["badge"];
  extraFinding?: SectionDef;
  finalFinding: { title: string; text: string };
  determination: string;
  approvalNote: string;
}): TemplateDef {
  const sections: SectionDef[] = [
    hqHeader(`DETERMINATION AND FINDINGS (D&F)\n${opts.titleLine}`, opts.badge.citation),
    {
      id: "authority",
      title: "Authority",
      citation: opts.badge.citation,
      tier: "binding",
      standingText: opts.authoritySentence,
      fields: [
        S("basis", "Basis", ["Time and materials (T&M)", "Labor hour"], "Time and materials (T&M)"),
        S("instrument", "Instrument", opts.instrumentOptions, opts.instrumentOptions[0] ?? "Contract"),
      ],
    },
    {
      id: "finding_1",
      title: "Findings — 1. Description of the Requirement.",
      citation: "FAR 16.601",
      tier: "binding",
      fields: [
        { key: "scope", label: "Purpose and scope of the effort", kind: "textarea", bind: "description_of_requirement", required: true },
        { key: "pop_start", label: "Period or ordering period start", kind: "date", bind: "period_of_performance_start" },
        { key: "pop_end", label: "Period or ordering period end", kind: "date", bind: "period_of_performance_end" },
        { key: "ceiling_price", label: "Estimated value or maximum ordering value, which is the ceiling price", kind: "money", bind: "estimated_value" },
        { key: "place", label: "Place or places of performance", kind: "text", bind: "place_of_performance" },
      ],
    },
    {
      id: "finding_2",
      title: "2. Description of the market research conducted.",
      citation: "FAR Part 10",
      tier: "binding",
      fields: [T("market_research", "Market research description and results")],
    },
    {
      id: "finding_3",
      title:
        "3. Demonstrate why no other contract type is suitable and establish that it is not possible at the time of placing the action to accurately estimate the extent or duration of the work or to anticipate costs with any reasonable degree of certainty.",
      citation: "FAR 16.601(c)",
      tier: "binding",
      fields: [T("no_other_type", "Detailed explanation with specific examples")],
    },
  ];
  if (opts.extraFinding) sections.push(opts.extraFinding);
  sections.push(
    {
      id: "finding_surveillance",
      title:
        "Describe the government's surveillance of the contractor's performance to ensure reasonable assurance that efficient methods and effective cost controls are being used.",
      citation: "FAR 16.601(c)(1)",
      tier: "binding",
      fields: [T("surveillance", "Surveillance")],
    },
    {
      id: "finding_rates",
      title: opts.finalFinding.title,
      citation: opts.badge.citation,
      tier: "binding",
      standingText: opts.finalFinding.text,
      fields: [],
    },
    {
      id: "determination",
      title: "Determination",
      citation: opts.badge.citation,
      tier: "binding",
      standingText: opts.determination,
      fields: [{ key: "determined_on", label: "Date", kind: "date" }],
    },
    signaturePage(
      "DETERMINATION AND FINDINGS FOR AUTHORITY TO ENTER INTO A TIME AND MATERIALS OR LABOR HOUR ACQUISITION",
      [CO_BLOCK, { label: "Office of General Counsel at the Center", note: LEGAL_CONCURRENCE }, { label: "Head of Contracting Activity", note: opts.approvalNote }],
      opts.badge.citation,
    ),
  );
  return {
    key: opts.key,
    name: opts.name,
    tab: "003",
    layout: "dandf",
    badge: opts.badge,
    lead: "Determination and findings supporting a time-and-materials or labor-hour action.",
    sections,
  };
}

const dandfTmLhNoncommercial = tmLhDandF({
  key: "dandf-tm-lh-noncommercial",
  name: "Determination and Findings Noncommercial Time and Materials or Labor Hour Contract / Order",
  instrumentOptions: ["Contract", "Order"],
  titleLine: "Authority to enter into a Time and Materials (T&M) or Labor Hour Contract/Order.",
  authoritySentence:
    "Upon the basis of the following D&F, made under the authority of Federal Acquisition Regulation (FAR) 16.601(d)(1), the acquisition described below may be entered into on a time-and-materials or labor-hour basis.",
  badge: {
    citation: "FAR 16.601(d)(1); FAR 16.601(c)(2)(i)",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2020-12-10",
    note: "The Head of the Contracting Activity approves this determination where the period of performance or ordering period exceeds three years.",
  },
  finalFinding: {
    title: "In accordance with FAR 16.601(c)(2)(i) the contract or order shall specify separate fixed hourly rates.",
    text: "In accordance with FAR 16.601(c)(2)(i) the contract or order shall specify separate fixed hourly rates that include wages, overhead, general and administrative expenses, and profit for each category of labor (see 16.601(f)(2)).",
  },
  determination:
    "There are too many variables in the services required to accurately establish a reasonable fixed price. In addition, the duration or extent of the work cannot be accurately estimated with a degree of certainty or anticipated costs estimated with any reasonable degree of confidence for use of a cost type contract. Therefore, it is considered impracticable to secure services of this kind or quality required without the use of a time-and-materials or labor-hour contract or order. Based on the findings above, I have determined that the issuance of a time-and-materials or labor-hour contract or order is in the best interest of the Government.",
  approvalNote:
    "In accordance with FAR 16.601(d)(1)(ii), the Head of the Contracting Activity (HCA) is the approver of this D&F if the period of performance or ordering period of the acquisition will exceed three years.",
});

const dandfGsaTmLh = tmLhDandF({
  key: "dandf-gsa-tm-lh",
  name: "Determination and Findings GSA Time and Materials or Labor Hour Order",
  instrumentOptions: ["Order", "Blanket Purchase Agreement (BPA)"],
  titleLine: "Authority to enter into a Time and Materials (T&M) or Labor Hour Order or BPA",
  authoritySentence:
    "Based on the following determination and findings, made under the authority of Federal Acquisition Regulation (FAR) 12.104(b), the acquisition described below may be entered into on a time-and-materials or labor-hour basis.",
  badge: {
    citation: "FAR 8.401; FAR 12.104(b); FAR 16.601-4(c); FAR 16.601-3(a)(2)",
    tier: "binding",
    revision: "HQ 11/2025 revision",
    effective: "2025-11-01",
    note: "For orders and BPAs under the GSA Federal Supply Schedule. Verify the master schedule contract allows BPAs and T&M or labor-hour orders.",
  },
  extraFinding: {
    id: "finding_fixed_price",
    title:
      "4. Establish that the current requirement has been structured to maximize the use of fixed-price orders on future acquisitions for the same or similar requirements.",
    citation: "FAR 16.601-3",
    tier: "binding",
    fields: [T("fixed_price_structure", "How the requirement is structured, and actions to maximize the use of fixed-price orders in future")],
  },
  finalFinding: {
    title: "The order must specify separate fixed hourly rates.",
    text: "The contract or order must specify separate fixed hourly rates that include wages, overhead, general and administrative expenses, and profit for each labor category (see 16.601-4(c)).",
  },
  determination:
    "There are too many variables in the services required to accurately establish a reasonable fixed price. Therefore, it is considered impracticable to secure services of this kind or quality required without the use of a time-and-materials or labor-hour order or BPA. Based on the findings above, I have determined that the issuance of a time-and-materials or labor-hour order or BPA is in the best interest of the Government.",
  approvalNote:
    "In accordance with FAR 16.601-3(a)(2), the Head of the Contracting Activity (HCA) is the approver of this D&F if the period of performance or ordering period of the acquisition will exceed three years.",
});

// ----------------------------------------------- 13. Over five years D&F
const dandfOverFiveYears: TemplateDef = {
  key: "dandf-pop-over-five-years",
  name: "Determination and Findings POP or Ordering Period Over 5 years",
  tab: "003",
  layout: "dandf",
  badge: {
    citation: "FAR 17.204; NFS 1817.204(e)(5); NFS 1816.505-71; FAR 16.501-2(c); 10 U.S.C. 3206(c)",
    tier: "binding",
    revision: "HQ 03/2026 revision",
    effective: "2026-01-26",
    note: "Used where a deviation is not required because no statutory limitation applies. Where a statute limits the period, use the deviation request instead.",
  },
  lead: "Determination supporting a total potential period of performance or ordering period longer than five years.",
  sections: [
    hqHeader(
      "DETERMINATION AND FINDINGS (D&F)\nAuthority to enter into a contract, Blanket Purchase Agreement (BPA), Order or Interagency Agreement (IAA) exceeding 5 years",
      "FAR 17.204; NFS 1817.204(e)(5)",
    ),
    {
      id: "authority",
      title: "Authority",
      citation: "FAR 16.501-2(c); 10 U.S.C. 3206(c)",
      tier: "binding",
      standingText:
        "Based on the following determination and findings, the acquisition described below may be entered into with a total potential ordering period or period of performance exceeding 5 years.",
      fields: [
        S("instrument", "Instrument", ["contract", "Blanket Purchase Agreement (BPA)", "Order", "Interagency Agreement (IAA)"], "contract"),
        S("authority_basis", "Authority", [
          "For task and delivery order contracts: FAR 16.501-2(c) and 10 U.S.C. 3206(c)",
          "For all other contracts: NASA Internal Instructions",
        ]),
        S("period_kind", "Period", ["ordering period", "period of performance", "ordering period and period of performance"], "period of performance"),
      ],
    },
    {
      id: "finding_1",
      title: "Findings — 1. Nature and/or description of the action being approved.",
      citation: "NFS 1817.204(e)(5)",
      tier: "binding",
      fields: [
        { key: "scope", label: "Purpose and scope of the effort", kind: "textarea", bind: "description_of_requirement", required: true },
        { key: "pop_start", label: "Period start", kind: "date", bind: "period_of_performance_start" },
        { key: "pop_end", label: "Period end, including options", kind: "date", bind: "period_of_performance_end" },
        { key: "value", label: "Estimated value or maximum ordering value", kind: "money", bind: "estimated_value" },
        T("period_table", "Basic and optional periods: period name, dates and duration"),
        T("history", "Initial award or extension, prior extensions, and for an IAA the servicing agency and agreement"),
      ],
    },
    {
      id: "finding_2",
      title: "2. Findings that detail the particular circumstances, facts, or reasoning essential to support the determination.",
      citation: "NFS 1817.204(e)(5)",
      tier: "binding",
      fields: [
        T("circumstances", "Exceptional circumstances, why the longer period is the most prudent business course of action, the best-value discussion, pricing evidence, and the planned future assessment"),
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 17.204; NFS 1817.204(e)(5)",
      tier: "binding",
      standingText:
        "The exceptional circumstances surrounding this acquisition necessitate a total potential period of performance or ordering period exceeding 5 years. Based on the findings above, I have determined that the issuance of the instrument with the period specified in item 1 is in the best interest of the Government.",
      fields: [{ key: "determined_on", label: "Date", kind: "date" }],
    },
    {
      id: "signature_page",
      title: "SIGNATURE PAGE — DETERMINATION AND FINDINGS FOR AUTHORITY TO ENTER INTO AN ACTION EXCEEDING 5 YEARS",
      citation: "PIC 24-06",
      tier: "binding",
      standingText: LEGAL_CONCURRENCE,
      fields: [
        S("signature_variant", "Signature page", [
          "Center approval: actions not requiring a Headquarters PSM",
          "Headquarters approval: actions requiring a Headquarters PSM",
        ], "Center approval: actions not requiring a Headquarters PSM"),
        X("sig_co", "Contracting Officer"),
        X("sig_legal", "Office of General Counsel at the Center"),
        X("sig_po", "Procurement Officer"),
        {
          key: "sig_aa",
          label: "APPROVAL: Assistant Administrator for Procurement",
          kind: "text",
          help: "Headquarters variant only. On the Center variant the Procurement Officer approves.",
        },
      ],
    },
  ],
};

// ------------------------------------------- 14. Single award IDIQ over $150M
const dandfSingleAwardIdiq: TemplateDef = {
  key: "dandf-single-award-idiq",
  name: "Determination and Findings Single Award IDIQ Contract Over $150M",
  tab: "011",
  layout: "dandf",
  badge: {
    citation: "FAR 16.504-3(a)(4)(i); NFS 1816.504(c)(1)(ii)(D)(1)",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2026-01-01",
    note: "Approval authority: Senior Procurement Executive. Threshold raised from $100M to $150M in the 01/2026 revision.",
  },
  lead: "Determination supporting a single-award IDIQ contract estimated to exceed $150,000,000 including all options.",
  sections: [
    hqHeader(
      "DETERMINATION AND FINDINGS FOR SINGLE AWARD INDEFINITE DELIVERY INDEFINITE QUANTITY (IDIQ) CONTRACT OVER $150M\nAuthority to Award a Single Contract Containing an indefinite-delivery indefinite-quantity (IDIQ) Task/Delivery Order Mechanism Notwithstanding the Restrictions in FAR 16.504-3.",
      "FAR 16.504-3(a)(4)(i)",
    ),
    {
      id: "authority",
      title: "Authority",
      citation: "FAR 16.504-3(a)(4)(i)",
      tier: "binding",
      standingText:
        "Based on the following findings and determination, which I make under the authority provided at FAR 16.504-3(a)(4)(i), the proposed contract action described below may be awarded on a single-award basis.",
      fields: [],
    },
    {
      id: "finding_1",
      title: "Findings — 1. The exception relied on",
      citation: "FAR 16.504-3(a)(4)(i)",
      tier: "binding",
      standingText:
        "This document addresses the requirement in FAR 16.504-3(a)(4)(i), which states \"No task or delivery order contract in an amount estimated to exceed $150 million (including all options) may be awarded to a single source unless the head of the agency determines in writing\" that one of the four specific exceptions in FAR 16.504-3(a)(4)(i) applies.",
      fields: [
        S("exception", "Exception", [
          "(A) The task or delivery orders expected under the contract are so integrally related that only a single source can reasonably perform the work.",
          "(B) The contract provides only for firm fixed price (see 16.202) task or delivery orders for— (A) Products for which unit prices are established in the contract; or (B) Services for which prices are established in the contract for the specific tasks to be performed.",
          "(C) Only one source is qualified and capable of performing the work at a reasonable price to the Government.",
          "(D) It is necessary in the public interest to award the contract to a single source due to exceptional circumstances.",
        ]),
      ],
    },
    {
      id: "finding_2",
      title: "2. Contract structure",
      citation: "NFS 1816.504(c)(1)(ii)(D)(1)(v)(B)",
      tier: "binding",
      fields: [
        S("structure", "Structure", ["IDIQ without a Core", "Core and IDIQ of the same contract type", "Core and IDIQ of different contract types"], "IDIQ without a Core"),
        X("contract_type", "Task order contract type or types", "contract_type"),
        { key: "minimum_value", label: "Minimum ordering value", kind: "money" },
        { key: "maximum_value", label: "Estimated maximum ordering value", kind: "money", bind: "estimated_value" },
        T("structure_narrative", "Length including options, base and option breakdown, and for an IDIQ without a Core why a core requirement is not appropriate"),
        T("follow_on", "Follow-on discussion with specific task order examples from the previous contract"),
      ],
    },
    {
      id: "finding_3",
      title: "3. Description and single-award rationale",
      citation: "FAR 16.504(c)(1)(ii)(A)",
      tier: "binding",
      fields: [
        { key: "description", label: "Purpose, scope and places of performance", kind: "textarea", bind: "description_of_requirement", required: true },
        T("single_award_rationale", "Rationale addressing scope and complexity, expected duration and frequency of orders, mix of resources, and the ability to maintain competition"),
      ],
    },
    {
      id: "finding_4",
      title: "4. Why the exception applies",
      citation: "FAR 16.504-3(a)(4)(i)",
      tier: "binding",
      fields: [T("exception_rationale", "Rationale with examples showing why the requirements preclude the effective use of multiple contractors")],
    },
    {
      id: "finding_5",
      title: "5. Effective period",
      citation: "FAR 16.504-3",
      tier: "binding",
      standingText: "The Determination and Findings shall be effective for the life of the contract.",
      fields: [],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 16.504-3(a)(4)(i); NFS 1816.504(c)(1)(ii)(D)(1)",
      tier: "binding",
      standingText:
        "For the reasons identified and explained above, although award of the subject IDIQ contract is estimated to exceed $150,000,000 (including all options) to a single source and is generally not permitted under FAR 16.504-3, it is determined permissible in this event because the work to be performed under the contract falls within the exception selected in item 1.",
      fields: [{ key: "determined_on", label: "Date", kind: "date" }],
    },
    signaturePage(
      "DETERMINATION AND FINDINGS FOR SINGLE AWARD INDEFINITE-DELIVERY INDEFINITE-QUANTITY (IDIQ) CONTRACT OVER $150M",
      [CO_BLOCK, LEGAL_BLOCK, { label: "Procurement Officer" }, HQ_OGC_BLOCK, SPE_BLOCK],
      "NFS 1816.504(c)(1)(ii)(D)(1)",
    ),
  ],
};

// ------------------------------------------------ 15. Five-year deviation request
const popDeviationRequest: TemplateDef = {
  key: "pop-deviation-request",
  name: "FAR Period of Performance-Ordering Period Deviation",
  tab: "033",
  layout: "memo",
  badge: {
    citation: "FAR/RFO 1.303; FAR/RFO 16.501-2(c); 10 U.S.C. 3403; 10 U.S.C. 3405; 41 U.S.C. 6707(d)",
    tier: "binding",
    revision: "HQ 06/2026 revision",
    effective: "2026-01-26",
    note: "Required where a statutory limitation applies. Approval authority: Assistant Administrator for Procurement.",
  },
  lead: "Memorandum requesting an individual deviation from the five-year period of performance or ordering period limitation.",
  sections: [
    {
      id: "memo_header",
      title: "Memorandum",
      citation: "FAR/RFO 1.303",
      tier: "binding",
      standingText:
        "TO: Assistant Administrator for Procurement\nTHRU: Headquarters Office of Procurement, Procurement Strategic Operations Division\nFROM: Procurement Officer\n" +
        "This memorandum requests authority to deviate from the provisions of the subject regulations and statutes regarding the 5-year period of performance limitation. The following information is submitted in accordance with RFO 1.303, Individual Deviations.",
      fields: [
        { key: "memo_date", label: "Date", kind: "date" },
        X("org_code", "Reply to Attn of: organizational code", "requester_org_code"),
        X("contract_number", "Contract number", "contract_number"),
        X("contractor_name", "Name of contractor", "vendor_name"),
      ],
    },
    {
      id: "item_1",
      title: "1. Identification of the RFO requirement from which a deviation is sought:",
      citation: "FAR/RFO 16.501-2(c); 22.1002; 35.403(d)",
      tier: "binding",
      fields: [
        S("deviation_case", "Case", [
          "FAR/RFO 16.501-2(c)(1) and 10 U.S.C. 3403, basic ordering periods exceeding 5 years",
          "FAR/RFO 16.501-2(c)(1) and 10 U.S.C. 3403, total potential ordering periods exceeding 10 years",
          "FAR/RFO 16.501-2(c)(2) and 10 U.S.C. 3405, advisory and assistance service contracts exceeding 5 years",
          "FAR/RFO 22.1002-2(a)(2) and 41 U.S.C. 6707(d), contracts exceeding 5 years when Service Contract Labor Standards apply",
          "FAR/RFO 35.403(d), FFRDC sponsoring agreement terms exceeding 5 years",
        ]),
        T("citation_language", "The regulatory or statutory citation and language for the requested deviation"),
      ],
    },
    {
      id: "item_2",
      title: "2. Nature and description of the deviation and the contract action(s) to which it applies:",
      citation: "FAR/RFO 1.303",
      tier: "binding",
      fields: [T("nature", "Initial award or extension, base award and options with dollar values, contract history and prior extensions")],
    },
    {
      id: "item_3",
      title: "3. Findings that detail the particular circumstances, facts, or reasoning essential to support the deviation:",
      citation: "FAR/RFO 1.303",
      tier: "binding",
      fields: [T("findings", "Exceptional circumstances, supporting documentation, planned future assessment, pricing evidence, why this period is the most prudent business course of action, and the best-value discussion")],
    },
    {
      id: "item_4",
      title: "4. A copy of counsel's concurrence or comments",
      citation: "FAR/RFO 1.303",
      tier: "binding",
      fields: [S("counsel", "Counsel", ["See signature below", "Comments attached"], "See signature below")],
    },
    {
      id: "signature_page",
      title: "SIGNATURE PAGE — DEVIATION REQUEST",
      citation: "PIC 24-06",
      tier: "binding",
      standingText:
        "I have reviewed the above deviation request and have no legal objection with respect to it. Comments, if any, are included in the contract file.",
      fields: [
        X("sig_co", "Contracting Officer"),
        X("sig_legal", "CONCURRENCES: Office of the General Counsel at the Center"),
        X("sig_po", "Procurement Officer"),
        X("sig_hq_ogc", "Office of the General Counsel at Headquarters"),
        X("sig_aa", "APPROVAL: Assistant Administrator for Procurement"),
      ],
    },
  ],
};

export const HQ_TEMPLATES: TemplateDef[] = [
  writtenAcquisitionPlan,
  psm,
  psmSignaturePage,
  psmAddendum,
  asmNotConducted,
  rdtLetters,
  dandfCpif,
  dandfCpaf,
  dandfFpaf,
  dandfFpi,
  dandfTmLhNoncommercial,
  dandfGsaTmLh,
  dandfOverFiveYears,
  dandfSingleAwardIdiq,
  popDeviationRequest,
];

export const HQ_TEMPLATE_KEYS = HQ_TEMPLATES.map((t) => t.key);

/** The contract-type determination this record needs, if any. */
export function contractTypeTemplateKey(contractType: string): string | null {
  const t = contractType.toUpperCase();
  if (t.startsWith("CPIF")) return "dandf-cpif";
  if (t.startsWith("CPAF")) return "dandf-cpaf";
  if (t.startsWith("FPAF")) return "dandf-fpaf";
  if (t.startsWith("FPI")) return "dandf-fpi";
  return null;
}

/** CPFF carries no determination of its own; the file says so on the row. */
export const NO_DANDF_NOTE = "No D&F required for CPFF, FAR 16.306.";

export type { Values };
