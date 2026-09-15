/**
 * HQ Office of Procurement reference pages, surveillance plan, data
 * requirements descriptions and construction checklists (Batch 6, part 3:
 * digital signature instructions, QASP, SBIR/STTR Phase III checklist, the
 * DRD template and the OCI Plan DRD, the preconstruction orientation
 * checklist and the construction bond checklist).
 *
 * Headings, standing paragraphs and checklist items come from the HQ masters
 * and the Batch 6 field map. Instruction pages, applicability notes and the
 * blue drafter prompts never print; they appear here only as field help.
 */

import type { FieldDef, SectionDef, TemplateDef, Values } from "@/lib/template-engine";

const T = (key: string, label: string, help?: string): FieldDef => ({
  key,
  label,
  kind: "textarea",
  ...(help ? { help } : {}),
});

const X = (key: string, label: string, bind?: string, help?: string): FieldDef => ({
  key,
  label,
  kind: "text",
  ...(bind ? { bind } : {}),
  ...(help ? { help } : {}),
});

const D = (key: string, label: string, bind?: string): FieldDef => ({
  key,
  label,
  kind: "date",
  ...(bind ? { bind } : {}),
});

const S = (key: string, label: string, options: string[], def?: string): FieldDef => ({
  key,
  label,
  kind: "select",
  options,
  ...(def ? { default: def } : {}),
});

/** A checklist box: checked or not. */
const C = (key: string, label: string): FieldDef => S(key, label, ["Not checked", "Checked"], "Not checked");

/** A preconstruction row: addressed at the orientation, or not. */
const R = (key: string, label: string): FieldDef =>
  S(key, label, ["Not addressed", "Addressed"], "Not addressed");

/** A bond checklist row: one answer for each of the three bond forms. */
const bondRow = (key: string, item: string, na: string[] = []): FieldDef[] =>
  (["sf24", "sf25", "sf25a"] as const).map((form) => {
    const formLabel = form === "sf24" ? "SF 24" : form === "sf25" ? "SF 25" : "SF 25-A";
    return na.includes(form)
      ? S(`${key}_${form}`, `${item} \u2014 ${formLabel}`, ["N/A"], "N/A")
      : S(`${key}_${form}`, `${item} \u2014 ${formLabel}`, ["Not reviewed", "X", "N/A"], "Not reviewed");
  });

// -------------------------------------------- digital signature instructions

const digitalSignature: TemplateDef = {
  key: "digital-signature-instructions",
  name: "Digital Signature Instructions",
  tab: "NA",
  badge: {
    citation: "Office of Procurement signature guidance",
    tier: "guidance",
    revision: "HQ reference page",
    note: "Digital signatures are the Office of Procurement preferred method for signing documents. If for some reason digital signature is not possible, add a date to the signature block of the template.",
  },
  lead: "Reference page. How to convert a Word document to PDF and add a digital signature; nothing on this page is filled in.",
  layout: "plan",
  sections: [
    {
      id: "convert",
      title: "Converting a Word Document into a PDF file",
      tier: "guidance",
      standingText:
        "1. Open the Word document you would like to convert to a .pdf file in Microsoft Word\n2. Click File in the ribbon menu (upper left of document)\n3. Click Export (Note: If the PC has Adobe Pro, the button labeled Save as Adobe PDF and will perform steps 4 and 5.)\n4. Click Create PDF/XPS Document (Note: If the PC has Adobe Pro, Create Adobe PDF will perform steps 4 and 5)\n5. Select desired location where you want to save the file\n6. Click Publish to save .PDF",
      fields: [],
    },
    {
      id: "sign",
      title: "Adding a Digital Signature to a PDF in Acrobat Reader DC",
      tier: "guidance",
      standingText:
        "1. Open the PDF file you would like to digitally sign\n2. Navigate to the location in the document for the new signature\n3. Select Tools from the menu bar\n4. Select Certificates from the choices\n5. Select Digitally Sign in the ribbon\n6. Select the OK button in the Acrobat Reader instructional window\n7. Click and drag to draw the area for the signature\n8. Release the mouse to display the Sign with a Digital ID pop up window\n9. Select a digital ID from the choices and verify that the selected certificate has not expired\n10. Click the Continue button in the Sign with a Digital ID window\n11. Click the Sign button\n12. The Save As pop up window displays\n13. Click the Save button\n14. A pop up window displays requesting the password or PIN associated to the certificate\n15. Enter your PIN and click the OK button\n16. The digitally signed document displays\n17. Save the document and circulate to all those whose signatures are required",
      fields: [],
    },
  ],
};

// ------------------------------------------------------------------- QASP

const isAi = (v: Values) => (v["ai_acquisition"] ?? "No") === "Yes";
const hasMonitors = (v: Values) => (v["monitor_language"] ?? "None") !== "None";

const qasp: TemplateDef = {
  key: "qasp",
  name: "QASP Template for Performance-Based Services Contracts",
  tab: "NA",
  badge: {
    citation: "FAR 37.601(b)(3); FAR 46.103; FAR 46.401",
    tier: "binding",
    revision: "HQ base issuance 04/08/2025, revisions 09/2025 and 02/2026",
    effective: "2026-02-01",
    note: "The 02/2026 revision adds the AI requirements needed for compliance with OMB M-25-22.",
  },
  lead:
    "Quality Assurance Surveillance Plan for a performance-based service contract: roles, standards, surveillance methods and the monitoring record.",
  layout: "plan",
  sections: [
    {
      id: "cover",
      title: "Cover",
      citation: "FAR 46.401",
      tier: "binding",
      standingText:
        "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION\n(Insert Center name)\nQUALITY ASSURANCE SURVEILLANCE PLAN (QASP)\nFOR THE\n(Insert name of acquisition)\n\nThis Quality Assurance Surveillance Plan (QASP) was prepared by the following:",
      fields: [
        X("center_name", "Center name", "center_name"),
        X("acquisition_name", "Name of acquisition", "title"),
        X("cor_name", "Contracting Officer's Representative (COR)"),
        X("co_name", "Contracting Officer (CO)", "co_name"),
        S("ai_acquisition", "Covered AI acquisition under OMB M-25-22 and PIC 25-03A", ["No", "Yes"], "No"),
        S(
          "monitor_language",
          "Monitors used in addition to the COR",
          ["None", "Task Monitor(s)", "Technical Monitor(s)", "Task Monitor(s) and Technical Monitor(s)"],
          "None",
        ),
      ],
    },
    {
      id: "revision_history",
      title: "Document revision history",
      tier: "guidance",
      standingText: "Rev. No. | Description of Change | Author | Effective Date",
      fields: [
        X("rev_number", "Rev. No.", undefined, "Draft on the initial release."),
        X("rev_description", "Description of change"),
        X("rev_author", "Author"),
        D("rev_effective", "Effective date"),
      ],
    },
    {
      id: "s1",
      title: "1 INTRODUCTION",
      citation: "FAR 37.601(b)(3)",
      tier: "binding",
      standingText:
        "This quality assurance surveillance plan (QASP) is pursuant to the requirements listed in the performance work statement (PWS) entitled (insert name of services). This plan sets forth the procedures and guidelines NASA (insert Center name and or program/project office performing monitoring/surveillance activity) will use in ensuring the required performance standards or services levels are achieved by the contractor.\n\n1.1 Purpose\n\n1.1.1 The purpose of the QASP is to describe the systematic methods used to monitor performance and identify required documentation and resources to be employed. The QASP provides a means for evaluating whether the contractor is meeting the performance standards/quality levels identified in the PWS and the contractor's quality control plan (QCP), and ensure the Government pays only for the level of services received.\n\n1.1.2 This QASP defines the roles and responsibilities of all surveillance members, identifies the performance objectives, defines the methodologies used to monitor and evaluate the contractor's performance, describes quality assurance documentation requirements, and describes the analysis of quality assurance monitoring results.",
      fields: [
        X("services_name", "Name of the services in the PWS title", "title"),
        X("monitoring_activity", "Center name and or program/project office performing monitoring"),
        T("performance_management_approach", "1.2 Performance Management Approach"),
        T("performance_management_strategy", "1.3 Performance Management Strategy"),
      ],
    },
    {
      id: "s2",
      title: "2 ROLES AND RESPONSIBILITIES",
      citation: "FAR 1.602-2; FAR 46.103",
      tier: "binding",
      standingText:
        "2.1 Contracting Officer (CO)\n\n2.1.1 The CO is responsible for monitoring contract compliance, contract administration, and cost control, and resolving any differences between observations documented by the Contracting Officer's Representative (COR) and the contractor. The CO will delegate a COR as the Government authority for performance management.\n\n2.1.2 The CO is ultimately responsible for the acceptance of services received under this contract. The CO will complete an annual contractor performance assessment report using the Contractor Performance Assessment Reporting System (CPARS) that will also be reviewed by the contractor.",
      fields: [
        S("cor_scope", "2.2.1 The COR monitors the", ["contract", "task orders", "contract and task orders"], "contract"),
        T("cor_responsibilities", "2.2 COR/Alternate COR responsibilities"),
        T("tom_responsibilities", "2.3 Task Order Monitors (TOMs)"),
        T("tm_responsibilities", "2.4 Technical/Task Monitors (TMs)"),
        T(
          "ocio_responsibilities",
          "2.5 NASA Office of the Chief Information Officer (OCIO)",
          "Included on AI system or service acquisitions only.",
        ),
      ],
    },
    {
      id: "s3",
      title: "3 IDENTIFICATION OF REQUIRED PERFORMANCE STANDARDS/QUALITY LEVELS",
      citation: "FAR 37.601(b)(2)",
      tier: "binding",
      fields: [T("applicable_documents", "Applicable documents containing the performance standards or quality levels")],
    },
    {
      id: "s4",
      title: "4 METHODOLOGIES TO MONITOR PERFORMANCE",
      citation: "FAR 46.401",
      tier: "binding",
      fields: [
        S(
          "surveillance_method",
          "4.1 Surveillance technique used",
          ["Random monitoring", "100% Inspection", "Periodic inspection", "Customer Feedback"],
          "Random monitoring",
        ),
        X("inspection_period", "Period for 100% or periodic inspection", undefined, "For example month, quarter or monthly."),
        S(
          "surveillance_responsibility",
          "4.2 Responsibility for surveillance activities",
          ["COR", "Task Monitor(s)", "Technical Monitor(s)", "Task Monitor(s) and Technical Monitor(s)"],
          "COR",
        ),
        T(
          "surveillance_activities",
          "4.2 Surveillance Activities",
          "One row per activity: Contract Clause/PWS/DRD Reference | Performance Standard or Metric | Surveillance Method | Frequency | Responsibility.",
        ),
        T("aql_levels", "4.3 Acceptable Quality Levels (AQLs)/Acceptable Performance Levels (APLs)"),
        X("critical_services", "4.3 Names of any critical services"),
        X("receiving_activity", "4.3 Government activity receiving the services"),
      ],
    },
    {
      id: "s4_ai",
      title: "4.3 AI acceptable quality levels",
      citation: "OMB M-25-22; PIC 25-03A",
      tier: "guidance",
      showIf: isAi,
      standingText:
        "Requirement | Acceptable Quality Levels\nSubcontractor obligations | 100%\nNASA Data | Zero instances of unauthorized use of NASA data for AI training\nAI testing and validation | Complete documentation for all AI testing and validation\nNew AI Features | 100% notification and approval rate for new features prior to deployment",
      fields: [T("ai_surveillance_activities", "AI surveillance activities added to the table in 4.2")],
    },
    {
      id: "s5",
      title: "5 QUALITY ASSURANCE (QA) DOCUMENTATION",
      citation: "FAR 46.104",
      tier: "binding",
      fields: [
        T("feedback_loop", "5.1 The Performance Management Feedback Loop"),
        X("feedback_document_reference", "5.1 Document reference"),
        T("monitoring_forms", "5.2 Monitoring Forms"),
        S("monitoring_preparer", "5.2.1 Monitoring forms prepared by", ["COR", "TOM", "TM", "COR and monitors"], "COR"),
      ],
    },
    {
      id: "s6",
      title: "6 ANALYSIS OF QUALITY ASSURANCE ASSESSMENT",
      citation: "FAR 46.401",
      tier: "binding",
      fields: [
        T("determining_performance", "6.1 Determining Performance"),
        T("deduction_or_incentive", "6.1 Deduction or incentive sentence, where appropriate"),
        X("reporting_frequency", "6.2 Reporting frequency", undefined, "For example month or quarter."),
        X("reporting_document_reference", "6.2 Applicable document reference"),
        T("reviews_and_resolution", "6.3 Reviews and Resolution"),
        X("review_participants", "6.3.1 Applicable personnel", undefined, "For example CO, TM, TO."),
      ],
    },
    {
      id: "prs",
      title: "PERFORMANCE REQUIREMENTS SUMMARY (PRS)",
      citation: "FAR 37.601(b)",
      tier: "guidance",
      collapsed: true,
      standingText:
        "Required Services (Tasks) | Performance Standards | Acceptable Quality Levels (AQL) or Acceptable Performance Level (APL) | Methods of Surveillance | Incentive (Positive and/or Negative) (Impact on Contractor Payments)",
      fields: [
        T(
          "prs_rows",
          "Performance requirements summary rows",
          "The PRS is not mandatory. Where it is included in the contract, reference it in Section 3 rather than attaching it twice.",
        ),
      ],
    },
    {
      id: "monitoring_form",
      title: "SAMPLE QUALITY ASSURANCE MONITORING FORM",
      citation: "FAR 46.401",
      tier: "guidance",
      collapsed: true,
      fields: [
        X("form_service_or_standard", "SERVICE or STANDARD"),
        X("form_survey_period", "SURVEY PERIOD"),
        S(
          "form_method",
          "SURVEILLANCE METHOD",
          ["Random Sampling", "100% Inspection", "Periodic Inspection", "Customer Complaint"],
          "Random Sampling",
        ),
        S("form_level", "LEVEL OF SURVEILLANCE", ["Monthly", "Quarterly", "As needed"], "Monthly"),
        X("form_percentage_sampled", "PERCENTAGE OF ITEMS SAMPLED DURING SURVEY PERIOD (%)"),
        T("form_analysis", "ANALYSIS OF RESULTS"),
        X("form_observed_rate", "Observed Service Provider Performance Measurement Rate (%)"),
        S("form_performance", "Service Provider's Performance", ["Meets Standards", "Does Not Meet Standards"], "Meets Standards"),
        T("form_narrative", "Narrative of Performance During Survey Period"),
        X("form_prepared_by", "PREPARED BY"),
        D("form_date", "DATE"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting officer's representative and contracting officer",
    citation: "FAR 46.401",
    blocks: ["Contracting Officer's Representative (COR)", "Date", "Contracting Officer (CO)", "Date"],
  }),
};

// ------------------------------------------------ SBIR/STTR Phase III checklist

const sbirPhaseIii: TemplateDef = {
  key: "sbir-phase-iii-checklist",
  name: "SBIR-STTR Phase III CO Checklist",
  tab: "NA",
  badge: {
    citation: "15 U.S.C. \u00a7 638(r)(4); SBA SBIR/STTR Policy Directive",
    tier: "binding",
    revision: "HQ reference checklist",
  },
  lead: "SBIR/STTR PHASE III \u2014 CONTRACTING OFFICER CHECKLIST.",
  layout: "plan",
  sections: [
    {
      id: "s1",
      title: "1. Phase III Eligibility Determination",
      citation: "15 U.S.C. \u00a7 638(r)",
      tier: "binding",
      fields: [
        C("s1_derives", "Requirement derives from, extends, or completes prior SBIR/STTR Phase I or II work"),
        C("s1_award_numbers", "Prior SBIR/STTR award number(s) identified"),
        X("s1_award_number_list", "Prior SBIR/STTR award number(s)"),
        C("s1_lineage", "Technical lineage documented (clear \u201cbut-for SBIR/STTR\u201d connection)"),
        C("s1_non_sbir_funds", "Phase III work funded with non-SBIR/STTR funds"),
        S(
          "s1_scope",
          "Phase III scope may include",
          ["Products / Production", "Services", "R&D", "Combination of the above"],
          "Combination of the above",
        ),
      ],
    },
    {
      id: "s2",
      title: "2. Special Acquisition Requirement (MANDATORY)",
      citation: "15 U.S.C. \u00a7 638(r)(4)",
      tier: "binding",
      fields: [
        C("s2_good_faith", "Good-faith effort made to negotiate with SBIR/STTR awardee"),
        C("s2_market_research", "Market research conducted addressing availability, capability and willingness to perform"),
        C("s2_availability", "Availability"),
        C("s2_capability", "Capability"),
        C("s2_willingness", "Willingness to perform"),
        C("s2_determination", "Determination made whether direct Phase III award is practicable"),
        S("s2_practicable", "Direct Phase III award is", ["Practicable", "Not practicable"], "Practicable"),
      ],
    },
    {
      id: "s3_yes",
      title: "3. Award Strategy Decision \u2014 If Direct Award IS Practicable",
      citation: "15 U.S.C. \u00a7 638(r)(4)",
      tier: "binding",
      showIf: (v) => (v["s2_practicable"] ?? "Practicable") === "Practicable",
      fields: [
        C("s3y_noncompetitive", "Award issued noncompetitively to SBIR/STTR awardee"),
        C("s3y_instrument", "Funding instrument clearly identified as \u201cSBIR/STTR Phase III\u201d"),
        C("s3y_no_competition", "No additional competition conducted"),
        C("s3y_no_justification", "No sole-source justification beyond Phase III authority required"),
      ],
    },
    {
      id: "s3_no",
      title: "3. Award Strategy Decision \u2014 If Direct Award is NOT Practicable",
      citation: "15 U.S.C. \u00a7 638(r)(4)",
      tier: "binding",
      showIf: (v) => (v["s2_practicable"] ?? "Practicable") === "Not practicable",
      fields: [
        C("s3n_rationale", "Rationale documented in contract file"),
        T("s3n_rationale_text", "Rationale"),
        C("s3n_sba_notice", "Written notice provided to SBA prior to pursuing other mechanisms"),
        C("s3n_preference_methods", "Preference methods considered/applied (if appropriate)"),
        C("s3n_brand_name", "Brand-name reference tied to SBIR/STTR technology"),
        C("s3n_evaluation_factors", "Evaluation factors favoring SBIR/STTR subcontracting"),
        C("s3n_incentives", "Incentives for SBIR/STTR utilization"),
      ],
    },
    {
      id: "s4",
      title: "4. Competition & Justification",
      citation: "15 U.S.C. \u00a7 638(r)(4); Competition in Contracting Act",
      tier: "binding",
      fields: [
        C("s4_prior_competition", "Prior Phase I/II competition relied upon (CICA satisfied)"),
        C("s4_ja_action", "If J&A required by agency process, it states only: Action is SBIR/STTR Phase III"),
        C("s4_ja_derives", "Work derives from/extends/completes prior SBIR/STTR work"),
        C("s4_ja_authority", "Authority: 15 U.S.C. \u00a7 638(r)(4)"),
        C("s4_no_additional", "No additional sole-source justification included"),
      ],
    },
    {
      id: "s5",
      title: "5. Timing, Duration, and Value Check",
      citation: "15 U.S.C. \u00a7 638(r)",
      tier: "binding",
      fields: [
        C("s5_dollar_value", "No concern applied regarding dollar value"),
        C("s5_duration", "No concern applied regarding contract duration"),
        C("s5_number_awards", "No concern applied regarding number of Phase III awards"),
        C("s5_time_gap", "No time-gap restriction applied between Phase I/II and Phase III"),
      ],
    },
    {
      id: "s6",
      title: "6. Business Size Verification",
      citation: "15 U.S.C. \u00a7 638(r)",
      tier: "binding",
      fields: [
        C("s6_size_status", "Size status not used to disqualify Phase III awardee"),
        C("s6_acknowledged", "Acknowledged: firm need not be a small business for Phase III"),
      ],
    },
    {
      id: "s7",
      title: "7. Data Rights (CRITICAL)",
      citation: "15 U.S.C. \u00a7 638(j)(2)(A)",
      tier: "binding",
      fields: [
        C("s7_clause", "SBIR/STTR Data Rights clause included in award"),
        C("s7_protection_period", "SBIR/STTR Protection Period stated as \u2265 20 years from award date"),
        C("s7_marking", "Awardee instructed on proper SBIR/STTR data marking"),
        C("s7_marked_protected", "File reflects understanding that properly marked data = protected"),
        C("s7_unmarked", "Unmarked data / FFF / OMIT = Unlimited Rights"),
        C("s7_doe", "DOE exception noted (if applicable)"),
      ],
    },
  ],
};

// ---------------------------------------------------------------- DRD blocks

const drdBlocks = (): FieldDef[] => [
  X("drd_title", "1. DRD Title"),
  X("drd_number", "2. DRD No."),
  S("data_type", "3. Data Type", ["Type 1", "Type 2", "Type 3"], "Type 1"),
  X("opr", "4. OPR", undefined, "Name or acronym of the office of primary responsibility."),
  X("solicitation_number", "5. Solicitation No.", "solicitation_number"),
  X("contract_number", "6. Contract No.", "contract_number"),
  D("date_issued", "7. Date Issued"),
  D("date_revised", "8. Date Revised"),
  S("drd_category", "9. DRD Category", ["Technical", "Administrative", "S&MA"], "Administrative"),
];

const drdTemplate: TemplateDef = {
  key: "drd-template",
  name: "Data Requirements Description (DRD) Template",
  tab: "DRD",
  badge: {
    citation: "NFS Appendix C; NFS 1804.7103",
    tier: "binding",
    revision: "HQ base issuance 04/28/2021, revisions 10/2021, 01/2025 and 04/2025",
    effective: "2025-04-01",
  },
  lead: "The eleven-block data requirements description used to define one deliverable.",
  layout: "plan",
  sections: [
    {
      id: "blocks",
      title: "Data Requirements Description",
      citation: "NFS Appendix C",
      tier: "binding",
      standingText:
        "Type 1 \u2013 All submittals of and interim changes to Type 1 DRDs require written approval from the contracting officer before formal release for use or implementation.\nType 2 \u2013 NASA reserves a time-limited right to disapprove in writing any submittal of and interim changes to those Type 2 DRDs.\nType 3 \u2013 These data shall be delivered by the contractor as required by the contract and do not require NASA approval.",
      fields: drdBlocks(),
    },
    {
      id: "description",
      title: "10. Description/Use",
      citation: "NFS Appendix C",
      tier: "binding",
      fields: [T("description_use", "Description and intended use of the data")],
    },
    {
      id: "distribution",
      title: "11. Distribution",
      citation: "NFS Appendix C",
      tier: "binding",
      fields: [
        T("distribution", "Distribution", "Names and organizational codes of the recipients, where the contract does not address it."),
        X("initial_submission", "Initial Submission"),
        X("submission_frequency", "Submission Frequency"),
        X("format", "Format"),
        T("interrelationship", "Interrelationship", "SOW/PWS references, CLIN references, clauses and provisions."),
        T("applicable_documents", "Applicable Documents"),
        T("scope", "Scope"),
        T("contents", "Contents"),
        T("remarks", "Remarks"),
        T("maintenance", "Maintenance"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting officer",
    citation: "NFS Appendix C",
    blocks: ["Contracting Officer: Approve / Disapprove", "Date"],
  }),
};

const ociPlanDrd: TemplateDef = {
  key: "oci-plan-drd",
  name: "OCI Plan DRD",
  tab: "DRD",
  badge: {
    citation: "FAR Subpart 9.5; NFS 1809.5; NFS Appendix C-202.1",
    tier: "binding",
    revision: "HQ base issuance 10/28/2021, revisions 03/2022, 01/2024 and 05/2025",
    effective: "2025-05-01",
  },
  lead: "Organizational Conflicts of Interest (OCI) Plan Data Requirements Description, pre-populated as a Type 1 administrative DRD.",
  layout: "plan",
  sections: [
    {
      id: "blocks",
      title: "Data Requirements Description",
      citation: "NFS Appendix C-202.1",
      tier: "binding",
      standingText:
        "1. DRD Title: Organizational Conflicts of Interest (OCI) Plan\n3. Data Type: 1\n4. OPR: OP\n9. DRD Category: Administrative",
      fields: [
        X("drd_number", "2. DRD No."),
        X("solicitation_number", "5. Solicitation No.", "solicitation_number"),
        X("contract_number", "6. Contract No.", "contract_number"),
        D("date_issued", "7. Date Issued"),
        D("date_revised", "8. Date Revised"),
      ],
    },
    {
      id: "description",
      title: "10. Description/Use",
      citation: "FAR Subpart 9.5",
      tier: "binding",
      standingText:
        "The Plan will communicate the contractor's approach to identify and resolve OCIs. The contractor will be held accountable for identifying, dispositioning, and reporting OCIs during contract performance.",
      fields: [],
    },
    {
      id: "distribution",
      title: "11. Distribution",
      citation: "NFS 1809.5",
      tier: "binding",
      standingText:
        "Distribution shall be as instructed by the contracting officer.\n\nInitial Submission: Plan shall be submitted with the initial proposal.\n\nSubmission Frequency: As needed.\n\nFormat: Contractor's format is acceptable. The electronic format shall be compatible with Microsoft Office.\n\nInterrelationship: NASA Federal Acquisition Regulation (FAR) Supplement (NFS) 1852.209-71, Limitation of Future Contracting, NFS 1852.237-72, Access to Sensitive Information, NFS 1852.237-73, Release of Sensitive Information.\n\nApplicable Documents: FAR Subpart 9.5, Organizational and Consultant Conflicts of Interest, NFS 1809.5, Organizational and Consultant Conflicts of Interest, NASA Guide on Organizational Conflicts of Interest.\n\nScope: The OCI Plan describes the contractor's comprehensive approach to identify, avoid, mitigate, neutralize, and report potential OCI issues, including conflicts described in the solicitation and those discovered during contract performance.",
      fields: [
        X("initial_submission_tailoring", "Initial Submission, where the contracting officer tailors it", undefined, "For example 30 days after award."),
        X("submission_frequency_tailoring", "Submission Frequency, where the contracting officer tailors it"),
        T("interrelationship_additions", "Additional SOW/PWS references, CLIN references, clauses and provisions"),
      ],
    },
    {
      id: "contents",
      title: "Contents",
      citation: "FAR 9.5",
      tier: "binding",
      standingText:
        "The OCI Plan shall meet the requirements of FAR 9.5 and include the following:\n\n1. Point of contact for OCI issues and reports.\n2. Demonstrate an understanding of (1) OCI principles and (2) the full breadth of OCI issues and the types of harm that can result. The Plan at a minimum addresses the three primary types of OCIs (i.e., biased ground rules, unequal access to information, and impaired objectivity).\n3. Define company roles, responsibilities, and procedures for (1) screening (i.e., identifying/recognizing, analyzing/evaluating, resolving, and reporting) existing and new business opportunities for actual/potential OCIs and (2) monitoring and reporting all potential/actual OCIs that arise, resolving conflicts, and reporting previously unidentified OCIs or potential OCIs to the Government.\n4. Describe how employees are notified of the Plan's requirements and how this notification will be documented. Establish and require entrance training for new employees, refresher training for existing employees, and exit training for departing employees. Describe how completion of this training will be documented, including a copy of any training certification template that the contractor will use to document that its employees have completed training.\n5. Describe how the contractor will report breaches of the protective measures in the Plan to the contracting officer. Describe what processes the contractor will implement following any breach and indicate that final resolution of the corrective action must be approved by the contracting officer.\n6. Identify any affiliated companies/entities (e.g., a parent company or a wholly owned subsidiary) and procedures for coordinating OCIs with such affiliated companies/entities.\n7. Address the process for reporting all potential/actual OCIs that arise during performance of the contract. An OCI report shall include (1) a description of the conflict, (2) the plan for resolving the conflict, and (3) the benefits/risks to contract performance associated with plan approval/acceptance. Specific resolution strategies shall be appended to the Plan upon approval by the Government.\n8. Explain how the contractor will flow down the provisions of this Plan to any subcontractor that may have a conflict with regard to performing the requirements of this contract. Discuss affected subcontractors' OCI program as it relates to this contract and specifically explain how affected subcontractors will identify, resolve, and report actual/potential OCIs associated with this contract.\n9. Define organizational and employee sanctions for violations of established OCI procedures/requirements/guidelines.\n10. Include an assertion from the offeror that to the best of its knowledge no OCIs exist currently, if applicable. Provide a list of all the prime's and proposed subcontractor(s)'s NASA contracts and subcontracts currently being performed and contracts performed within the last five years of the release of this solicitation, in order to provide the CO a better understanding of other NASA work performed by the offeror that may give rise to an actual or potential conflict. For each prime contract and subcontract listed, the offeror shall: (1) identify the contract number; (2) describe the scope of work in sufficient detail to ascertain the likelihood of a conflict with performance of this contract; and (3) discuss any conflicts that may arise from performance of the listed contracts and award of this contract.\n11. The offeror shall also list any non-NASA Federal contracts and subcontracts that it or its proposed subcontractors are currently performing or have performed in the five years preceding the release of the solicitation that may give rise to an OCI. For each and subcontract listed, the offeror shall: (1) identify the contract by number and name; (2) identify the name, address and contact information of the customer(s); (3) describe the scope of work in sufficient detail to ascertain the likelihood of a conflict with performance of this contract; and (4) discuss any conflicts that may arise from performance of the listed contracts and award of this contract.\n12. For financial or other interests or relationships beyond Federal contracts or subcontracts that may give rise to an OCI, the offeror shall (1) address the nature and extent of the interest(s) or relationship(s); (2) list any entity or entities involved in the interest(s) or relationship(s) and award of this contract.\n13. The offeror shall address how it will avoid, neutralize, or mitigate each potential OCI listed above. Sufficient information must be provided to allow a meaningful evaluation of the potential effect of the interest on the performance of the statement of work.\n14. Include a requirement to update this plan as necessary to address specific OCIs. All updates to the plan must be approved by the contracting officer and the updates/changes must be incorporated in the contract to be effective.\n15. Require periodic self-audits to ensure compliance with established OCI procedures/requirements/guidelines.\n16. Define records related to the OCI plan (e.g., training and audit records) that will be made available to the Government upon request. Note: The OCI Plan as outlined in paragraphs 1 through 12 above is not for the purpose of addressing other very important contractual obligations such as (1) the contractor's obligation to protect sensitive information in accordance with NFS 1852.237-72, Access to Sensitive Information, (2) the contractor's obligation to conduct business in an ethical manner in accordance with FAR 52.203-13, contractor's Code of Business Ethics and Conduct, and (3) the contractor's obligation to prevent personal conflicts of interest in accordance with FAR 52.203-16, Preventing Personal Conflicts of Interest.\n17. In an appendix to the OCI Plan identify the strategy (e.g., mitigation, limitation on future contracting) for resolving each OCI that is either identified in the solicitation or created by the requirements of the solicitation/contract and explain the effect of such strategy on performance of the contract. If using a firewall, explain how these actions will operate to successfully address the conflict without adversely affecting performance of the contract. (Note: Specific plans to limit future competition are reflected in the clause at NFS 1852.209-71, Limitation of Future Contracting.)",
      fields: [
        T("center_specific_contents", "Center-specific provisions, clauses or other requirements added to the contents"),
        T("remarks", "Remarks"),
      ],
    },
    {
      id: "maintenance",
      title: "Maintenance",
      citation: "NFS Appendix C",
      tier: "binding",
      standingText:
        "The contractor shall review the OCI Plan on an annual basis or as directed by the contracting officer to revise the OCI Plan if necessary. Revisions are subject to contracting officer approval and shall be incorporated by change page or complete reissue.",
      fields: [],
    },
  ],
};

// ---------------------------------------- preconstruction orientation checklist

const preconstructionSection = (
  id: string,
  title: string,
  citation: string,
  rows: [string, string][],
): SectionDef => ({
  id,
  title,
  citation,
  tier: "binding",
  fields: [
    ...rows.map(([key, label]) => R(`${id}_${key}`, label)),
    T(`${id}_notes`, "Notes", "If explaining information pertaining to above rows include row number."),
  ],
});

const preconstruction: TemplateDef = {
  key: "preconstruction-orientation-checklist",
  name: "Preconstruction Orientation Checklist",
  tab: "077",
  badge: {
    citation: "FAR 36.212; NFS CG 1836.22",
    tier: "binding",
    revision: "HQ base issuance 10/22/2020, revision 04/10/2025",
    effective: "2025-04-10",
    note: "The 04/2025 revision removed the reference to FAR 52.222-26, Equal Opportunity (Ref: PCD 25-01).",
  },
  lead:
    "The topics the contracting officer covers with the construction contractor, by explanatory letter or at a preconstruction conference.",
  layout: "plan",
  sections: [
    {
      id: "header",
      title: "Contract",
      citation: "NFS CG 1836.22",
      tier: "binding",
      fields: [
        X("contract_number", "CONTRACT NUMBER", "contract_number"),
        D("orientation_date", "DATE"),
        X("project_name", "PROJECT NAME", "title"),
      ],
    },
    {
      id: "personnel",
      title: "Function and Authority of Government Personnel/support contractors",
      citation: "FAR 1.602-1; FAR 1.602-2",
      tier: "binding",
      standingText:
        "Only NASA Contracting Officers are authorized to enter into any contract or agreement that binds NASA. Another designated contracting officer may sign contract documents or enter into agreements in the absence of the primary contracting officer.",
      fields: [
        X("co_name", "1. Contracting Officer (CO) name and contact information", "co_name"),
        X("cor_name", "2. Contracting Officer's Representative (COR) name and contact information"),
        X("inspector_names", "3. Technical Inspector's names"),
        T("other_personnel", "4. Other", "For example Architectural Engineer (AE) contractor, security, safety or environmental points of contact."),
        T("personnel_notes", "Notes"),
      ],
    },
    preconstructionSection("admin", "Contract Administration", "FAR 52.243-4; FAR 52.236-2; FAR 52.232-5; FAR 52.246-12; FAR 52.242-14", [
      ["proposal", "1. Request for Proposal/Change Order (52.243-4)"],
      ["site_conditions", "2. Differing Site Conditions (FAR 52.236-2)"],
      ["gfp", "3. Government-Furnished Property"],
      ["invoicing", "4. Invoicing/Progress Payments (52.232-5)"],
      ["inspection", "5. Inspection of Construction (52.246-12)"],
      ["suspension", "6. Suspension of Work (52.242-14)"],
    ]),
    preconstructionSection("submittals", "Submittals", "FAR 52.236-15; FAR Subpart 19.7", [
      ["schedule", "1. Project Schedule (FAR 52.236-15)"],
      ["values", "2. Schedule of Values"],
      ["register", "3. Submittal Register"],
      ["app", "4. Accident Prevention Plan (APP)"],
      ["qcp", "5. Quality Control Plan"],
      ["environmental", "6. Environmental Protection Plan"],
      ["waste", "7. Waste Management Plan"],
      ["contacts", "8. Contact List of Key Personnel"],
      ["materials", "9. Status Report on Material Orders/Long Lead time Items"],
      ["subcontracting", "10. Subcontracting Plan"],
    ]),
    preconstructionSection("security", "Security and Badge Requirements", "NFS 1852.242-72", [
      ["piv", "1. PIV Badge & Temporary Badge"],
      ["visits", "2. Visit Requests"],
      ["access", "3. Access to Center/Facility"],
      ["escort", "4. Unescorted/Escorted processes"],
      ["history", "5. Criminal History Check"],
      ["firearms", "6. Firearms"],
      ["vehicles", "7. Vehicle Passes"],
      ["photography", "8. Prohibition of Flight Line Photography"],
      ["hours", "9. Working Hours/After Hours Notification"],
    ]),
    preconstructionSection("labor", "Labor", "FAR Subpart 22.4", [
      ["provisions", "1. Labor Provisions"],
      ["wage_rates", "2. FAR 52.222-6 Construction Wage Rate Requirements (formerly Davis Bacon Act)"],
      ["classification", "2.A. Classification and Wage Rates (including fringe benefits, where appropriate)"],
      ["site_of_work", "2.B. Site of the Work"],
      ["posting", "2.C. Posting Requirements (Wage Determination, WH-1321 Poster)"],
      ["overtime", "3. FAR 52.222-4 Contract Work Hours and Safety Standards Act. Overtime Compensation"],
      ["payrolls", "4. FAR 52.222-8 Payrolls and Basic Records. Submission of Weekly Payrolls and Statements of Compliance"],
      ["apprentices", "5. FAR 52.222-9 Apprentices and Trainees. DOL Registered Apprenticeship/Trainee programs"],
      ["copeland", "6. FAR 52.222-10 Compliance with Copeland Act Requirements. \u201cAnti-Kickback\u201d and Payroll Deductions"],
      ["subcontracts", "7. FAR 52.222-11 Subcontracts (Labor Standards). List of subcontractors, SF 1413 completed for all subcontractors"],
    ]),
    preconstructionSection("onsite", "On-Site Work Operations", "FAR 52.236-5 through FAR 52.236-21; NFS 1852.242-72", [
      ["superintendence", "1. Superintendence by the Contractor (FAR 52.236-6)"],
      ["sub_superintendence", "2. Superintendence of Subcontractors"],
      ["daily_review", "3. Daily Site Coordination Review"],
      ["layout", "4. Layout of Work (FAR 52.236-17)"],
      ["permits", "5. Permits and Responsibilities (FAR 52.236-7)"],
      ["utilities", "6. Availability and use of Utility Services (FAR 52.236-14)"],
      ["denied_access", "7. Denied Access to NASA Facilities (NFS 1852.242-72)"],
      ["protection", "8. Protection of Existing Vegetation, Structures, Equipment, Utilities, and Improvements (FAR 52.236-9)"],
      ["cleanup", "9. Clean-Up (FAR 52.236-12)"],
      ["workmanship", "10. Material and Workmanship (FAR 52.236-5)"],
      ["delivery", "11. Material Delivery"],
      ["storage", "12. Operations and Storage Areas (FAR 52.236-10)"],
      ["route", "13. Construction Site Access Route"],
      ["drawings", "14. Specifications and Drawings for Construction (52.236-21)"],
    ]),
    preconstructionSection("quality", "Quality Control/Assurance and Progress Reporting", "FAR 52.246-12", [
      ["daily_report", "1. Daily Superintendent Report"],
      ["weekly_meetings", "2. Weekly Construction Progress Meetings"],
      ["certification", "3. Certification Requirements"],
      ["testing", "4. Testing"],
      ["records", "5. Maintenance of Records Including Warranties and Operation Manuals"],
      ["final_inspection", "6. Final Inspection and Acceptance"],
    ]),
    preconstructionSection("environment", "Environmental Aspects", "FAR 52.236-9", [
      ["preferable", "1. Environmentally Preferable Products"],
      ["water", "2. Water Quality"],
      ["dust", "3. Dust Controls"],
      ["waste", "4. Waste Disposal"],
      ["fumes", "5. Toxic Fumes Controls"],
      ["suspect_asbestos", "6. Suspect Asbestos Containing Material"],
      ["asbestos_removal", "7. Asbestos Removal"],
      ["other", "8. Other Environmental Considerations"],
    ]),
    preconstructionSection("safety", "Safety and Health Requirements", "FAR 52.236-13; NFS 1852.223-70", [
      ["accident_prevention", "1. Accident Prevention (FAR 52.236-13)"],
      ["covid", "2. Novel Coronavirus Disease 2019 (COVID-19) Contractor Guidance"],
      ["mishap", "3. Notification of Injuries Sent to Contracting Officer, Safety and Health Measures & Mishap Reporting (1852.223-70)"],
      ["emergency", "4. Emergency Telephone Numbers for Installation"],
      ["osha", "5. OSHA Regulations/Formal Inspections"],
      ["training", "6. Safety Training Records"],
      ["sds", "7. Safety Data Sheets (SDS) Maintained On-Site with APP"],
      ["weekly_safety", "8. Weekly Job Safety Meetings (Required) Include in APP"],
      ["daily_inspections", "9. Daily Site Safety Inspections"],
      ["zone", "10. Designate Construction Zone (Signage and Demarcation Tape)"],
      ["evacuation", "11. Evacuation Procedures (Assembly Points, Head Count)"],
      ["hot_work", "12. Hot Work/Fire Prevention"],
      ["confined_space", "13. Confined Space Entry (Permit, Atmospheric Monitoring)"],
      ["co2", "14. CO2 Monitoring (Operation of Combustion Equipment Indoors)"],
      ["electrical", "15. Electrical Hazards (Lockout/Tagout)"],
      ["fall_protection", "16. Fall Protection (Required at 6 Feet and Above)"],
    ]),
    preconstructionSection("other", "Other Topics", "NFS CG 1836.22", [
      ["fire", "1. Fire Department Briefing Information"],
      ["safety_personnel", "2. Safety Personnel Briefing"],
      ["as_builts", "3. Requirement to maintain as-builts"],
      ["parking", "4. Crew parking area(s)"],
      ["advance_notice", "5. Advance notice to Government for inspections"],
      ["conduct", "6. Conduct while working onsite (e.g. Is smoking allowed onsite)"],
      ["weather", "7. Weather days allowed"],
      ["leed", "8. LEED requirements"],
      ["rfi", "9. Contractor requests for information (RFI), product substitutions"],
      ["outages", "10. Advance notices of electricity outages, excavation"],
      ["mockups", "11. Submittal review process, mock-up reviews"],
      ["pay", "12. Process for pay application"],
      ["closeout", "13. Project close-out requirements"],
    ]),
  ],
};

// -------------------------------------------------- construction bond checklist

const constructionBonds: TemplateDef = {
  key: "construction-bond-checklist",
  name: "Construction Bond Checklist",
  tab: "088",
  badge: {
    citation: "FAR Part 28; FAR 28.102-1(b); FAR 28.202; FAR 28.203",
    tier: "binding",
    revision: "HQ base issuance 06/08/2021",
    effective: "2021-06-08",
  },
  lead:
    "CONTRACT BONDS CHECKLIST. Review each item against the corresponding part of the bond and mark X or N/A for each form.",
  layout: "plan",
  sections: [
    {
      id: "header",
      title: "Bonds under review",
      citation: "FAR Part 28",
      tier: "binding",
      standingText:
        "INSTRUCTIONS: Review each item with the corresponding part of the Bond and indicate either by a \u201cX\u201d or \u201cN/A\u201d (not applicable) for each item. File this completed form in the appropriate part of the contract file.",
      fields: [
        X("solicitation_number", "SOLICITATION NO.", "solicitation_number"),
        X("contract_number", "CONTRACT NO.", "contract_number"),
        X("reviewer", "Reviewed by", "co_name"),
        D("review_date", "Date of review"),
      ],
    },
    {
      id: "items_1_4",
      title: "Items 1 through 4",
      citation: "SF 24; SF 25; SF 25-A; SF 1442",
      tier: "binding",
      fields: [
        ...bondRow("i1", "1. Bond must be executed on correct form (SF 24, SF 25, SF 25-A)"),
        ...bondRow("i2a", "2.A. Ensure that date of the Bid Bond is not later than the bid opening date", ["sf25", "sf25a"]),
        ...bondRow("i2b", "2.B. Payment Bond (SF 25-A) date is same or later than date of contract (SF 1442)", ["sf24", "sf25"]),
        ...bondRow("i2c", "2.C. Performance Bond (SF 25) date is same or later than date of contract (SF 1442)", ["sf24", "sf25a"]),
        ...bondRow("i3", "3. Full legal name of Principal entered on form(s) is identical with name on bid and/or contract"),
        ...bondRow("i4", "4. Type of organization space completed - If corporation, state of incorporation must be entered"),
      ],
    },
    {
      id: "corporate_surety",
      title: "5. Corporate Surety",
      citation: "FAR 28.202; Treasury Department Circular 570",
      tier: "binding",
      fields: [
        ...bondRow("i5a", "5.A. Name of Surety and state in which Surety was incorporated"),
        ...bondRow(
          "i5b",
          "5.B. Surety listed on current list of the Treasury's Listing of approved Sureties (Treasury Department Circular 570) for the appropriate amount (FAR 28.202)",
        ),
        ...bondRow("i5c1", "5.C.I. Excess amount covered by coinsurance (in accordance with 28.202)"),
        ...bondRow("i5c2_bid", "5.C.II.1. Reinsurance for the bid bond (SF 275)", ["sf25", "sf25a"]),
        ...bondRow("i5c2_perf", "5.C.II.2. Reinsurance for the performance bond (SF 273)", ["sf24", "sf25a"]),
        ...bondRow("i5c2_pay", "5.C.II.3. Reinsurance for the payment bond (SF 274)", ["sf24", "sf25"]),
      ],
    },
    {
      id: "individual_surety",
      title: "6. Individual Sureties",
      citation: "FAR 28.203; FAR 28.203-1(c)",
      tier: "binding",
      fields: [
        ...bondRow("i6a", "6.A. Contractor complies with FAR 28.203"),
        ...bondRow("i6b", "6.B. SF 28, Affidavit Of Individual Surety, executed correctly by each Surety and submitted with Bonds"),
        ...bondRow("i6c1", "6.C.I. Contracting Officer has consulted with Treasury on each individual surety bond in accordance with 28.203-1(c)"),
        ...bondRow("i6c2", "6.C.II. Contracting Officer has determined whether or not the bond is acceptable based on the above consultation with Treasury"),
        ...bondRow("i6c3", "6.C.III. Contracting Officer notifies both the contractor and the surety of the CO's decision"),
        ...bondRow(
          "i6c4",
          "6.C.IV. If the bond is acceptable, Contracting Officer requests the Treasury's collateral operations support team to set up the necessary individual surety pledged asset collateral account",
        ),
      ],
    },
    {
      id: "items_7_16",
      title: "Items 7 through 16",
      citation: "FAR 28.102-1(b)",
      tier: "binding",
      fields: [
        ...bondRow(
          "i7a",
          "7.A. Penal Sum or Percentage must be entered (Bid Bond SF 24 at least 20%, not to exceed $3 million, per 28.102-1(b); Performance Bond SF 25 100%; Payment Bond SF 25-A 100%)",
        ),
        ...bondRow("i7b", "7.B. Penal Sum is in sufficient amount (Penal Sum is in agreement with Bond Requirements)"),
        ...bondRow("i8", "8. Bid or contract date are on the form(s)"),
        ...bondRow("i9", "9. Bid or contract number must be entered (Entry identical with number on bid or contract)"),
        ...bondRow("i10a", "10.A. Individual - Signature identical to that on bid and is an authorized person"),
        ...bondRow("i10b", "10.B. Partnership - Signature of Partner"),
        ...bondRow("i10c", "10.C. Corporation - Signature of Officer or Agent"),
        ...bondRow("i10d", "10.D. Corporation - The Seal or Scroll, stamped must be impressed or affixed"),
        ...bondRow("i11", "11. Name and address of Surety must be entered in the appropriate space"),
        ...bondRow("i12a", "12.A. Bond signed for Surety Company"),
        ...bondRow("i12b", "12.B. Power of Attorney by Surety giving authority to the Agent to execute Bonds in the appropriate dollar amount"),
        ...bondRow("i13", "13. Impression (Raised) or Stamp of the Corporate Seal of the Surety must be affixed to the Bond"),
        ...bondRow("i14", "14. Rate and amount of the Premium entered (Entry NOT required on Payment Bond - SF 25-A)", ["sf25a"]),
        ...bondRow("i15", "15. Erasures, corrections, or other material alterations, if any, must be initialed by each person signing the Bond"),
        ...bondRow(
          "i16",
          "16. Bond Disposition - File original in the contract file (bid bond in preaward file; performance and payment bonds in post-award file)",
        ),
      ],
    },
  ],
};

export const HQ6C_TEMPLATES: TemplateDef[] = [
  digitalSignature,
  qasp,
  sbirPhaseIii,
  drdTemplate,
  ociPlanDrd,
  preconstruction,
  constructionBonds,
];

export const HQ6C_TEMPLATE_KEYS = HQ6C_TEMPLATES.map((t) => t.key);

/** Phase each Batch 6 part 3 document belongs to. */
export const HQ6C_PHASES: Record<string, string> = {
  "digital-signature-instructions": "Administration",
  qasp: "Solicitation/Quote",
  "sbir-phase-iii-checklist": "Market Research",
  "drd-template": "Solicitation/Quote",
  "oci-plan-drd": "Solicitation/Quote",
  "preconstruction-orientation-checklist": "Administration",
  "construction-bond-checklist": "Award",
};
