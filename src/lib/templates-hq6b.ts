/**
 * HQ Office of Procurement administration and warrant templates (Batch 6,
 * part 2: voucher review checklist, NF 533M analysis, ratification of an
 * unauthorized commitment, NEAR file-location memorandum, BPA annual review,
 * the two contracting officer warrant nominations, the appointment and
 * termination letters, and the authorization to use Government supply
 * sources).
 *
 * Headings, determination sentences, certifications and signature titles come
 * from the HQ masters and the Batch 6 field map. Instruction pages, document
 * history logs and colour-coded drafter prompts never print; they appear here
 * only as field help.
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

const M = (key: string, label: string, bind?: string): FieldDef => ({
  key,
  label,
  kind: "money",
  ...(bind ? { bind } : {}),
});

const S = (key: string, label: string, options: string[], def?: string): FieldDef => ({
  key,
  label,
  kind: "select",
  options,
  ...(def ? { default: def } : {}),
});

/** Yes, No or N/A, as the HQ checklists ask it. */
const YN = (key: string, label: string): FieldDef =>
  S(key, label, ["Choose an item.", "Yes", "No", "N/A"], "Choose an item.");

// ------------------------------------------- voucher review checklist

const voucherStep = (n: number, question: string): FieldDef[] => [
  YN(`step_${n}_answer`, `${n}. ${question}`),
  X(`step_${n}_reference`, `${n}. Filename and page reference`),
];

const voucherReview: TemplateDef = {
  key: "voucher-review-checklist",
  name: "NASA Voucher Review Checklist (Cost-Type Contract)",
  tab: "083",
  badge: {
    citation: "FAR 32.905; NFS 1832.905; FAR 52.232-25(a)(3); NFS 1852.232-80(e)",
    tier: "binding",
    revision: "HQ base issuance 06/2020, revision 02/2025",
    effective: "2025-02-01",
  },
  lead: "Checklist the cost voucher approver completes before approving each voucher on a cost-type contract.",
  layout: "plan",
  sections: [
    {
      id: "header",
      title: "Voucher",
      citation: "SF 1034 and SF 1035, obtained from IRIS",
      tier: "guidance",
      standingText:
        "Cost Voucher Approvers shall complete this checklist using the steps below (as applicable) prior to approving each voucher. If the NASA cost voucher approver is not the contracting officer/specialist for the contract, consult with the contracting officer/specialist as appropriate to complete the evaluation of the voucher and completion of the checklist. If the answer is \u201cNo\u201d to any of these steps, obtain additional supporting information from the contractor by either contacting the contractor or rejecting the voucher. Indicate N/A as appropriate. Upload completed checklist into IRIS.",
      fields: [
        X("contract_number", "Contract number", "contract_number"),
        X("delivery_order_number", "Delivery order (DO) number"),
        X("voucher_number", "Voucher number"),
        M("voucher_amount", "Voucher amount"),
        X("approver_name", "NASA cost voucher approver name"),
        D("date_reviewed", "Date reviewed"),
        X("co_cs_name", "Name of CO/CS (if not voucher approver)", "co_name"),
        D("coordination_date", "Date of coordination with CO/CS"),
      ],
    },
    {
      id: "steps_1_3",
      title: "Voucher accuracy",
      citation: "FAR 52.232-25, Prompt Payment, paragraph (a)(3)",
      tier: "binding",
      fields: [
        ...voucherStep(1, "Does the date of services on the voucher falls within the contract period of performance?"),
        ...voucherStep(
          2,
          "Is the data on the voucher (contract number, contractor name, address, date of voucher, etc.) accurate?",
        ),
        ...voucherStep(3, "Are the mathematical calculations on the voucher accurate?"),
      ],
    },
    {
      id: "hours_costs",
      title: "Review of Hours and Costs",
      citation: "FAR 32.905; NF 533M",
      tier: "binding",
      fields: [
        ...voucherStep(4, "Are the billed direct labor hours reasonable?"),
        ...voucherStep(
          5,
          "Are the direct labor and indirect billing rates reasonable? (e.g. current year provisional billing rates or revised billing rates to reflect final settled/audited indirect rates, or in accordance with the contract terms and conditions.)",
        ),
        ...voucherStep(
          6,
          "For T&M type contracts, are billed labor hourly rates consistent with rates negotiated in the contract?",
        ),
        ...voucherStep(7, "Have the required items been delivered and/or the required services been performed?"),
        ...voucherStep(8, "Are any deductions made in the voucher amount consistent with contract terms?"),
        ...voucherStep(
          9,
          "Are payments within the limit established in the Limitation of Cost or Limitation of Funds clauses?",
        ),
        ...voucherStep(10, "Are the Other Direct Costs (ODCs) billed reasonable for payment?"),
      ],
    },
    {
      id: "contract_terms",
      title: "Review of Contract Terms",
      citation: "NFS 1852.232-80, Submission of Vouchers/Invoices for Payment, paragraph (e)",
      tier: "binding",
      fields: [
        ...voucherStep(
          11,
          "Are all submitted costs consistent with requirements and contractual conditions in the contract that affect or limit payments (e.g., ceilings on indirect rates)?",
        ),
      ],
    },
  ],
};

// ----------------------------------------------------- NF 533M analysis

const nf533Analysis: TemplateDef = {
  key: "nf-533-analysis",
  name: "NASA Form (NF) 533 Monthly Analysis",
  tab: "080",
  badge: {
    citation: "NFS 1842.7201; NPR 9501.2",
    tier: "binding",
    revision: "HQ base issuance 10/2020, revisions 02/2021 and 05/2025",
    effective: "2025-05-20",
  },
  lead: "NASA Form (NF) 533M Analysis Template: the monthly cost report analysis on a cost-type contract.",
  layout: "plan",
  sections: [
    {
      id: "header",
      title: "Report under analysis",
      citation: "NFS 1842.7201",
      tier: "binding",
      fields: [
        X("contract_number", "Contract number", "contract_number"),
        X("contractor", "Contractor", "vendor_legal_name"),
        D("period_month_ending", "Reporting period month ending"),
        X("reviewer", "Reviewer information and date of review", "co_name"),
      ],
    },
    {
      id: "inputs",
      title: "Analysis inputs",
      citation: "NF 533M",
      tier: "guidance",
      standingText: "Input data from the NF 533M. Every figure below is taken straight from the report.",
      fields: [
        M("in_5a", "From the current 533: 5a, amount billed"),
        M("in_7a", "From the current 533: 7a, actual month costs"),
        M("in_7b", "From the current 533: 7b, planned month costs"),
        M("in_7c", "From the current 533: 7c, actual cumulative to date cost incurred"),
        M("in_7d", "From the current 533: 7d, cumulative planned cost"),
        M("in_8a", "From the current 533: 8a, estimated cost to complete, next month"),
        M("in_8b", "From the current 533: 8b, estimated cost to complete, following month"),
        M("in_8d", "From the current 533: 8d, estimated cost to complete, remainder"),
        M("in_9a", "From the current 533: 9a, contractor estimated final cost"),
        M("in_9b", "From the current 533: 9b, contract value"),
        M("in_block_4", "From the current 533: Block 4, fund limitation"),
        M("in_block_3a", "From the current 533: Block 3a"),
        M("in_block_3b", "From the current 533: Block 3b"),
        M("prev_7c", "From the previous month 533: 7c"),
        M("prev_8a", "From the previous month 533: 8a"),
      ],
    },
    {
      id: "q1",
      title: "Question 1: Timely Submission",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText:
        "Was the contractor's report submitted timely? Provide the date the contractor's report was submitted and if the report was late provide the contractor's reason for its tardiness (in accordance with NPR 9501.2, the NF533 should be received no later than 10 working days following the close of the contractor's monthly accounting period. A NF 533M need not be submitted in months in which an NF 533 Q is submitted (unless the CO directs submission of both reports).",
      fields: [
        YN("q1_answer", "Timely submission"),
        D("q1_date_due", "Date due"),
        D("q1_date_submitted", "Date submitted"),
        T("q1_rationale", "Rationale if submitted late"),
      ],
    },
    {
      id: "q2",
      title: "Question 2: Baseline Consistency",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText:
        "Are the numbers used in blocks 7b and 7d consistent with the baseline report for the month-in-review? In accordance with NPR 9501.2, blocks 7b and 7d are obtained from the time-phased baseline plan, which includes the original contract value plus authorized changes. The NF533 template requires the contractor to identify the baseline report/ revision used in the development of the 533.",
      fields: [YN("q2_answer", "Baseline consistency"), T("q2_note", "Explanation")],
    },
    {
      id: "q3",
      title: "Question 3: Funding",
      citation: "NPR 9501.2",
      tier: "binding",
      fields: [
        YN("q3a_answer", "a) Is the funded amount in block 4 correct in accordance with the last funding modification issued?"),
        YN(
          "q3b_answer",
          "b) Compare the Actual Cum to Date Cost Incurred (Col. 7c) with the Fund Limitation (block 4): Does the contract have adequate funds?",
        ),
        YN(
          "q3c_answer",
          "c) Add the Actual Cum to Date Cost Incurred (Col. 7c) to the next two months Estimated Costs to Complete (Col. 8a and 8b) and compare with the Fund Limitation (block 4). Is there enough funding on the contract to cover the current actuals and future projections for the next month?",
        ),
        M("q3_7c_plus_next_two", "Act cum to date (7c) + next 2 months estimate (8a+8b)"),
        T("q3_note", "Explanation"),
      ],
    },
    {
      id: "q4",
      title: "Question 4: Contract Value",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText: "Does the sum of columns 9b equal the total contract value reported in blocks (3a + 3b)?",
      fields: [
        YN("q4_answer", "Contract value"),
        M("q4_total_3a_3b", "Total block 3a + 3b"),
        T("q4_note", "Explanation"),
      ],
    },
    {
      id: "q5",
      title: "Question 5: Invoiced vs Actuals to Date",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText:
        "Does the Invoiced amount in 5a exceed the cumulative to date actuals (sum of column 7c)? Is the Actual Cum to Date Cost Incurred (Col. 7c) significantly greater than 5a? If yes, then find out why they aren't invoicing.",
      fields: [YN("q5_answer", "Invoiced versus actuals"), T("q5_rationale", "Contractor rationale if significantly greater")],
    },
    {
      id: "q6",
      title: "Question 6: Estimated vs Planned",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText:
        "Does the estimate of cost in Col. 8a from the previous month's 533M match the planned cost in Col. 7b from the current month's NF533M? If not, what is the variance?",
      fields: [
        YN("q6_answer", "Estimated versus planned"),
        M("q6_variance", "Variance (estimated \u2212 planned)"),
        X("q6_percent", "% variance"),
      ],
    },
    {
      id: "q7",
      title: "Question 7: Actual vs Planned",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText:
        "Is there a variance between the cumulative actual costs in block 7c and the cumulative planned cost in block 7d indicating a potential cost overrun? Do the costs incurred correspond with the schedule (progress to date)? If not, then this may indicate a potential cost overrun.",
      fields: [
        YN("q7_answer", "Actual versus planned"),
        M("q7_difference", "Difference (planned \u2212 actual)"),
        X("q7_percent", "% variance"),
      ],
    },
    {
      id: "q8",
      title: "Question 8: Estimated vs Actual",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText:
        "Does the estimate of cost in Col. 8a from the previous month's 533M match the actual cost in Col. 7a? The contractor must provide an explanation if Estimate vs Actual variance exceeds +/- 10%.",
      fields: [
        YN("q8_answer", "Estimated versus actual"),
        M("q8_variance", "Variance (planned \u2212 actual)"),
        X("q8_percent", "% variance"),
        T("q8_explanation", "Contractor explanation where the variance exceeds +/- 10%"),
      ],
    },
    {
      id: "q9",
      title: "Question 9: Estimate at Completion",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText:
        "Does the Contractor estimated final cost (Col. 9a) reflect the most current estimate at completion (adding Col. 7c+8a+8b+8d should total the amount reported in Col. 9a)? If not, then why is there a discrepancy?",
      fields: [
        YN("q9_answer", "Estimate at completion"),
        M("q9_sum", "Sum of 7c + 8a + 8b + 8d"),
        T("q9_note", "Explanation of any discrepancy"),
      ],
    },
    {
      id: "q10",
      title: "Question 10: Overrun versus Underrun Costs",
      citation: "NPR 9501.2",
      tier: "binding",
      standingText:
        "Does the Estimated Final Cost (Col. 9a) indicate a potential underrun or overrun? a) Compare the Contractor's Estimated Final Cost (Col. 9a) to the Contract Value (Col. 9b). b) If there is a significant variance for an underrun/overrun, then the CO needs to understand the reasons for it. The CO should consider progress and performance to date to see if the Contractor is behind/ahead of schedule, whether services are acceptable, whether the Contractor is more/less efficient than planned, etc.",
      fields: [
        YN("q10_answer", "Overrun or underrun"),
        M("q10_variance", "Variance (9b \u2212 9a)"),
        X("q10_percent", "% variance"),
        T("q10_note", "Reasons for a significant variance"),
      ],
    },
    {
      id: "q11",
      title: "Question 11: Structure and Reporting",
      citation: "NPR 9501.2",
      tier: "binding",
      fields: [
        YN(
          "q11a_answer",
          "a. Are 533 reports structured and are costs being reported in accordance with the requirements specified in NPR 9501.2?",
        ),
        T("q11b_action", "b. What (if any) corrective action(s) need to be taken by the contractor?"),
      ],
    },
    {
      id: "q12",
      title: "Question 12: Adverse Trends or Corrective Action Plan",
      citation: "NPR 9501.2",
      tier: "binding",
      fields: [
        T("q12a_trends", "a. Describe any adverse trends or discrepancies identified during the 533 analysis."),
        T("q12b_action", "b. What (if any) corrective action(s) need to be taken by the contractor?"),
      ],
    },
    {
      id: "q13",
      title: "13. Rate(s) Verification",
      citation: "NPR 9501.2",
      tier: "binding",
      fields: [
        YN(
          "q13a_answer",
          "a. Are the rates (cost/hours = hourly rate) consistent with those identified in the baseline report?",
        ),
        YN(
          "q13b_answer",
          "b. Is there a variance between the overhead rate reported in actuals for the current month (block 7a) and planned (block 7b)?",
        ),
        YN(
          "q13c_answer",
          "c. Is there a variance between the general and administrative (G&A) rate (pool dollars/total dollars=% of cost) reported in actuals for the current month (block 7a) and planned (block 7b)?",
        ),
        YN("q13d_answer", "d. If there are any established indirect ceilings, has the contract exceeded those rate(s)?"),
        T("q13_note", "Explanation"),
      ],
    },
  ],
};

// ------------------------------------- ratification of an unauthorized commitment

const isNotice = (v: Values) => (v["ratification_template"] ?? "") === "Notice to the responsible employee";
const isRequest = (v: Values) => !isNotice(v);

const ratification: TemplateDef = {
  key: "ratification-unauthorized-commitment",
  name: "Ratification of Unauthorized Commitments",
  tab: "005",
  badge: {
    citation: "FAR 1.602-3; NFS 1801.602-3",
    tier: "binding",
    revision: "HQ base issuance 02/2021, revision 04/2025",
    effective: "2025-04-01",
  },
  lead:
    "Two memoranda: the notice asking the responsible employee for documentation, and the ratification request to the head of the contracting activity.",
  layout: "memo",
  sections: [
    {
      id: "which",
      title: "Which memorandum",
      citation: "FAR 1.602-3",
      tier: "binding",
      fields: [
        S(
          "ratification_template",
          "Memorandum being written",
          ["Notice to the responsible employee", "Ratification request to the head of the contracting activity"],
          "Notice to the responsible employee",
        ),
      ],
    },
    {
      id: "heading",
      title: "Memorandum heading",
      citation: "NF 1858 letterhead",
      tier: "guidance",
      fields: [
        D("memo_date", "Date"),
        X("org_code", "Reply to attn. of: organization code", "requester_org_code"),
        X(
          "memo_to",
          "TO:",
          undefined,
          "The individual who made the unauthorized commitment, or the head of the contracting activity on the request memorandum.",
        ),
        X("memo_from", "FROM:", undefined, "Organization name and title, for example Contracting Officer or Ratification Coordinator."),
        X("company_name", "Company that received the unauthorized commitment", "vendor_legal_name"),
      ],
    },
    {
      id: "notice_body",
      title: "Notice to the responsible employee",
      citation: "FAR 1.602-3(c); NFS 1801.602-3(c)(7)",
      tier: "binding",
      showIf: isNotice,
      standingText:
        "I have been informed that an unauthorized commitment, defined in the Federal Acquisition Regulations (FAR) 1.602-3 as \u201can agreement that is not binding solely because the Government representative who made it lacked the authority to enter into that agreement on behalf of the Government\u201d has occurred. Only a warranted Contracting Officer (CO) has the authority to obligate Government funds and enter into contracts or otherwise bind the Government to a contractual commitment. Serious legal, disciplinary, and personal liability actions can result from an unauthorized commitment.\n\nPayment for goods or services received from an unauthorized commitment may be made only through the ratification process. Ratification is defined as the \u201cact of approving an unauthorized commitment by an official who has the authority to do so\u201d. Absent ratification, the individual making the unauthorized commitment may be held personally liable for payment to the vendor.\n\nThe Head of the Contracting Activity (HCA) is the approval authority for ratifications. In accordance with FAR 1.602-3(c) and NASA FAR Supplement (NFS) 1801.602-3(c)(7), it is requested that you provide the following documentation regarding the unauthorized commitment for ratification consideration:\n\n\u2022 A Procurement Request that provides appropriate funding.\n\u2022 A signed statement addressing in detail: a description of the unauthorized work performed and/or supplies received; how the unauthorized commitment occurred, including dates, events, circumstances, and dollar amount; why this unauthorized commitment is considered valid and was necessary to meet NASA requirements, and the benefit(s) received by the Government; why normal acquisition procedures were not followed; why the vendor was selected, listing all other sources considered; the estimated or agreed to price; and any other information pertinent to the unauthorized commitment.\n\u2022 All supporting documentation (invoice(s), contractor correspondence, etc.).\n\u2022 Certification that funds were available at the time the unauthorized commitment was made.\n\u2022 A copy of a route sheet forwarding the signed statement through your supervisor and cognizant director or comparable official.\n\nIt is imperative that ratification actions be processed and completed in a timely manner since the Government cannot make payment to the vendor before the action has been ratified. If any required information/documentation is missing, the ratification request package will be returned and not processed until the missing information/documentation is furnished to the undersigned.\n\nUpon receipt of a complete ratification package, the facts, records, and documents furnished will be reviewed and a statement of findings prepared, including a recommendation that will be routed through the Office of General Counsel for review and to the HCA for approval.",
      fields: [
        X("director_title", "Director or comparable official title"),
        X("directorate_name", "Directorate or comparable official's office name"),
        D("documentation_due", "Date all documentation is to be provided", undefined),
        T(
          "prevention_statement_request",
          "Statement required of the director under NFS 1801.602-3(c)(7)(C)",
          "The director provides a separate statement describing the measures taken to prevent recurrence and whether disciplinary action should be taken.",
        ),
        X("notice_signer", "Signature name"),
        X("notice_cc", "Cc: director responsible for the individual"),
      ],
    },
    {
      id: "background",
      title: "Background and Chronology of Events",
      citation: "FAR 1.602-3; NFS 1801.602-3",
      tier: "binding",
      showIf: isRequest,
      standingText:
        "As required by the Federal Acquisition Regulation (FAR) 1.602-3 and NASA FAR Supplement (NFS) 1801.602-3, this memorandum requests ratification of charges resulting from an unauthorized commitment.",
      fields: [
        X("company_city_state", "City and state of the company"),
        X("short_title", "Short title or description of the unauthorized commitment"),
        T("chronology", "Chronology of events", "A detailed chronology: dates, events, circumstances and the bona fide need."),
      ],
    },
    {
      id: "findings",
      title: "Findings",
      citation: "FAR 1.602-3(c)(1-7); NFS 1801.602-3(c)(7)",
      tier: "binding",
      showIf: isRequest,
      standingText:
        "In accordance with the limitations set forth in FAR 1.602-3(c)(1-7) and NFS 1801.602-3(c)(7), the authority to ratify an unauthorized commitment may be exercised only when \u2013\n\n1. Supplies or services have been provided to and accepted by the Government, or the Government otherwise has obtained or will obtain a benefit resulting from performance of the unauthorized commitment.\n\n2. The ratifying official has the authority to enter into a contractual commitment. Under the authority provided in FAR 1.602-3(b)(2) the Head of the Contracting Activity (HCA) may ratify unauthorized commitments and has the authority to enter into a contractual commitment.\n\n3. The resulting contract would otherwise have been proper if made by an appropriate contracting officer (CO). A valid and legitimate requirement existed at the time the unauthorized commitment was made, and the unauthorized commitment was not made to evade any statutes/regulations. Standard acquisition procedures could have been used for obtaining these supplies or services and would have been proper if made by a warranted CO.\n\n4. The CO reviewing the unauthorized commitment determines the price to be fair and reasonable.\n\n5. The CO recommends payment and legal counsel concurs in the recommendation, unless agency procedures expressly do not require such concurrence. The CO and legal counsel concur in the recommendations set forth in this memorandum as evidenced by the signatures below.\n\n6. Funds were available at the time the unauthorized commitment was made and are currently available.\n\n7. The ratification is in accordance with any other limitations prescribed under agency policy. In accordance with 1801.602-3(c)(7), the authority in FAR 1.602-3 may be exercised only when \u2013",
      fields: [
        T("finding_1_benefit", "1. Benefit obtained by the Government"),
        T("finding_3_requirement", "3. The requirement that existed when the commitment was made"),
        S("price_basis", "4. The price is", ["estimated", "agreed to"], "agreed to"),
        M("finding_4_price", "4. Price of the unauthorized commitment"),
        T("finding_4_invoices", "4. Contractor invoices received", "Invoice number, invoice date and amount; list each invoice separately."),
        S("price_analysis_kind", "4. Analysis performed", ["cost", "price"], "price"),
        T("finding_4_analysis", "4. The analysis supporting a fair and reasonable price"),
        M("finding_4_lesser_amount", "4. Lesser amount considered fair and reasonable, where applicable"),
        X("funds_certifier", "6. Name, code and title of the official certifying funds"),
        X("finding_6_pr_number", "6. Procurement request number", "pr_number"),
        X("finding_6_cas_years", "6. Cross Agency Support years of funding"),
        M("finding_6_amount", "6. Amount available to cover the ratification"),
        X("committer_name", "7(A). Name and code of the individual who made the unauthorized commitment"),
        D("finding_7a_pr_date", "7(A). Date the procurement request was initiated"),
        M("finding_7a_amount", "7(A). Amount of the procurement request"),
        D("finding_7b_statement_date", "7(B). Date of the signed statement of fact"),
        X("finding_7b_tab", "7(B). Backup documentation tab, where used"),
        D("finding_7c_submitted", "7(C). Date the ratification documentation was submitted"),
        X("finding_7c_through", "7(C). Name and position title it was submitted through"),
        X("director_name", "7(C). Director who prepared the prevention memorandum"),
        D("finding_7c_memo_date", "7(C). Date of the director's memorandum"),
        T("preventive_measures", "7(C). Measures taken to prevent recurrence"),
        T("disciplinary_action", "7(C). Disciplinary action recommended, where applicable"),
      ],
    },
    {
      id: "recommendation",
      title: "Recommendation",
      citation: "FAR 1.602-3(b)(2)",
      tier: "binding",
      showIf: isRequest,
      standingText:
        "NASA has obtained a benefit resulting from performance of the unauthorized commitment, which is consistent with the amount recommended in this memorandum, and the resulting contract action would have otherwise been proper if made by a warranted contracting officer. In addition, funds were available at the time the unauthorized commitment was made and are currently available.",
      fields: [
        M("payment_amount", "Payment recommended"),
        T(
          "recommendation_sentence",
          "Recommendation",
          "Based on the findings stated above, I recommend that the unauthorized commitment be ratified and payment made to the company named above.",
        ),
      ],
    },
    {
      id: "signature_page",
      title: "Signature page",
      citation: "NFS 1802.101, head of the contracting activity",
      tier: "binding",
      showIf: isRequest,
      standingText:
        "CONCURRENCE: I have reviewed the above ratification and have no legal objection with respect to it. Comments, if any, are included in the contract file.",
      fields: [
        X("program_identifier", "Program or project name and acquisition identifier", "title"),
        X("co_signer", "Contracting officer or ratification coordinator", "co_name"),
        X("counsel_center", "Office of the General Counsel at (Center name)", "center_name"),
        S("activity_variant", "Additional concurrence", ["None", "NOJMO", "ESDMD or SOMD"], "None"),
        X("cota_name", "Chief of the Contracting Activity, NOJMO", undefined, "NOJMO actions only."),
        X("procurement_officer_name", "Procurement Officer", undefined, "ESDMD and SOMD actions only."),
        X("hca_name", "Head of the Contracting Activity"),
        X("hca_activity", "Center name, or the procurement activity", "center_name"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting officer, counsel and head of the contracting activity",
    citation: "FAR 1.602-3(b)(2)",
    blocks: ["Contracting Officer", "Date", "CONCURRENCE: Office of the General Counsel", "Date", "APPROVAL: Head of the Contracting Activity", "Date"],
  }),
};

// ------------------------------------------------ NEAR file location memo

const nearFileLocation: TemplateDef = {
  key: "near-file-location-memo",
  name: "Location of Contract Files prior to NEAR Transition Memo",
  tab: "005",
  badge: {
    citation: "PIC 24-06, NEAR and NCMS Implementation Guidance",
    tier: "guidance",
    revision: "HQ base issuance 12/2024",
    effective: "2024-12-30",
  },
  lead: "Short memorandum recording where the pre-transition contract files are held before NEAR.",
  layout: "memo",
  sections: [
    {
      id: "heading",
      title: "Memorandum heading",
      citation: "NF 1858 letterhead",
      tier: "guidance",
      fields: [
        D("memo_date", "Date"),
        X("org_code", "Organization code", "requester_org_code"),
        X("contract_number", "Contract number", "contract_number"),
        X("contract_title", "Contract title", "title"),
      ],
    },
    {
      id: "body",
      title: "Location of the files",
      citation: "NEAR User's Manual",
      tier: "guidance",
      standingText:
        "Effective as of October 1, 2024, modifications starting with the modification number below are stored in the NASA Enterprise's Acquisition Repository (NEAR), including a copy of the conformed copy. Any new task order or delivery orders or modifications issued after October 1, 2024 are also documented in NEAR.",
      fields: [
        X("through_modification", "The base award and documentation are filed through modification number"),
        X("file_hyperlink", "Hyperlink to the location of the files"),
        X("physical_location", "Physical location of the files, where applicable"),
        S("is_idv", "Indefinite delivery vehicle", ["No", "Yes"], "No"),
        X("near_start_modification", "Modifications stored in NEAR start with modification number"),
        X("signer_name", "Signature name"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Contract specialist",
    citation: "PIC 24-06",
    blocks: ["Contract Specialist", "Date"],
  }),
};

// ------------------------------------------------------- BPA annual review

const isFss = (v: Values) => (v["bpa_variant"] ?? "") === "FAR 8.405 schedule BPA";

const bpaRow = (key: string, question: string, showIf?: (v: Values) => boolean): FieldDef => ({
  key,
  label: question,
  kind: "textarea",
  ...(showIf ? { showIf } : {}),
});

const bpaAnnualReview: TemplateDef = {
  key: "bpa-annual-review",
  name: "Blanket Purchase Agreement (BPA) Annual Review",
  tab: "099",
  badge: {
    citation: "FAR 13.303-6(a); FAR 8.405-3(e)",
    citationFor: (v) => (isFss(v) ? "FAR 8.405-3(e); PIC 14-01" : "FAR 13.303-6(a); NFS 1813.303-6"),
    tier: "binding",
    revision: "HQ base issuance 04/2020",
    effective: "2020-04-20",
  },
  lead: "The annual review of a blanket purchase agreement, in the form the agreement was established under.",
  layout: "plan",
  sections: [
    {
      id: "header",
      title: "Agreement under review",
      citation: "FAR 13.303-6(a)",
      citationFor: (v) => (isFss(v) ? "FAR 8.405-3(e)" : "FAR 13.303-6(a)"),
      tier: "binding",
      fields: [
        S(
          "bpa_variant",
          "The BPA was established under",
          ["FAR 13.303 simplified acquisition BPA", "FAR 8.405 schedule BPA"],
          "FAR 13.303 simplified acquisition BPA",
        ),
        X("bpa_number", "BPA number", "contract_number"),
        D("review_date", "Date of the review"),
        X("contractor", "Contractor or supplier", "vendor_legal_name"),
        X("period_of_performance", "Period of performance"),
        X("review_period", "Review period assessed"),
        M("bpa_value", "BPA value", "estimated_value"),
        X("orders_placed", "Number of orders placed during the period assessed"),
        X("orders_reviewed", "Number of orders reviewed in the random sample"),
      ],
    },
    {
      id: "review_13303",
      title: "Review",
      citation: "FAR 13.303-3; FAR 13.303-4; FAR 13.303-5; FAR 13.303-6",
      tier: "binding",
      showIf: (v) => !isFss(v),
      fields: [
        bpaRow("q1", "1. Was a previous BPA review conducted? if so, when? Reference FAR 13.303-6(b)(1)"),
        bpaRow(
          "q2",
          "2. Are there any changes in market conditions, sources of supply, or other pertinent factors that may warrant making new arrangements with different suppliers or modifying existing arrangements? Reference FAR 13.303-6(b)(2)",
        ),
        bpaRow(
          "q3",
          "3. The Contracting Officer is to provide the BPA supplier a list of individuals authorized to purchase under the BPA, identified by position title or by individual name, organizational code, and the dollar limitation per purchase for each position title or individual. Is the list current? Were orders issued within the limitations provided in the listing? If not, explain. Reference FAR 13.303-3(a)(4)",
        ),
        bpaRow(
          "q4",
          "4. Do all of the delivery tickets contain the following minimum information: 1) name of supplier; 2) BPA number; 3) date of purchase; 4) purchase number; 5) itemized list of supplies or services furnished; 6) quantity, unit price, and 7) extension of each item and date of delivery or shipment? Reference FAR 13.303-3(a)(5)",
        ),
        bpaRow("q5", "5. Has the contractor been compliant with the invoicing terms and conditions? Reference FAR 13.303-3(6)"),
        bpaRow("q6", "6. Are the clauses included within the BPA current? Reference FAR 13.303-4(a)"),
        bpaRow(
          "q7",
          "7. Are purchases made within the limitations set in the BPA? If not, explain why not and how the issue or incident was reconciled. (Orders should not exceed the simplified acquisition threshold unless otherwise provided by agency regulations). Reference FAR 13.303-5(b)",
        ),
        bpaRow(
          "q8",
          "8. Do the orders reviewed comply with the requirements of 13.003(b) and Subpart 19.5 regarding the use of small business set-asides? Explain. Reference FAR 13.303-5(c)",
        ),
        bpaRow(
          "q9",
          "9. For purchases greater than the micro-purchase threshold were there sufficient numbers of BPAs to ensure maximum practicable competition? If not, were quotations solicited from other sources or were additional BPAs established to facilitate future purchases? Reference FAR 13.303-5(d) (1) and (2)",
        ),
        bpaRow(
          "q10",
          "10. Has documentation of purchases been limited to essential information? (e.g. document supplier and the purchaser agreement concerning the transaction; record of essential elements (i.e., date, supplier, supplies or services, price, delivery date); pertinent purchase requisition and the accounting and appropriation data.) Reference FAR 13.303-5(e)",
        ),
      ],
    },
    {
      id: "review_8405",
      title: "Review",
      citation: "FAR 8.405-3(e); PIC 14-01",
      tier: "binding",
      showIf: isFss,
      fields: [
        bpaRow("fss_q1", "1. Was a previous BPA review conducted? Reference FAR 8.405-3(e)"),
        bpaRow(
          "fss_q2",
          "2. The General Services Administration's (GSA) has determined the prices of supplies and fixed-price services and rates for services offered at hourly rates to be fair and reasonable for the purpose of establishing the Federal Supply Schedule contract. However, GSA's determination does not relieve the ordering activity contracting officer from the responsibility of making a determination of fair and reasonable pricing for individual orders, BPAs, and orders under BPAs. Does the BPA still represent the best value for the Government? Explain any market research conducted. If the BPA does not represent the best value for the Government explain why. Reference FAR 8.405-3(e)(ii) and Procurement Information Circular (PIC) 14-01",
        ),
        bpaRow(
          "fss_q3",
          "3. Have the estimated quantities or amounts been exceeded? Have additional price reductions been obtained? If so, state why the amounts were exceeded and discuss how this was reconciled. Discuss the amount of the price reduction(s) and its impact to the BPA or Orders.",
        ),
      ],
    },
    {
      id: "certification",
      title: "Certification",
      citation: "FAR 13.303-6(a)",
      citationFor: (v) => (isFss(v) ? "FAR 8.405-3(e)" : "FAR 13.303-6(a)"),
      tier: "binding",
      fields: [
        S("certifier_role", "Signed by", ["contracting officer", "contracting officer's designated representative"], "contracting officer"),
        X("certifier_name", "Name", "co_name"),
        X("certifier_title", "Position title, where the signer is the designated representative"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting officer or designated representative",
    citation: "FAR 13.303-6(a); FAR 8.405-3(e)",
    blocks: ["Contracting Officer", "Date"],
  }),
};

// ------------------------------------------------------ warrant nominations

const warrantJustificationFields = (): FieldDef[] => [
  T("special_training", "Candidate's special training"),
  T("specialized_knowledge", "Candidate's specialized knowledge in a particular field of contracting"),
  T(
    "contracting_experience",
    "Candidate's experience in Govt. contracting and administration, commercial purchasing, or related fields",
  ),
  T(
    "policy_knowledge",
    "Candidate's knowledge of acquisition policy & procedures, including this and other applicable regulations",
  ),
  T("honors_awards", "Relevant Honors and Awards"),
  T(
    "additional_support",
    "Additional supporting information that the candidate meets the established qualification standards at the requested warrant classification level is as follows:",
  ),
  T("actions_if_short", "Actions to be taken for candidates that do not meet the minimum qualifications:"),
  S("oge_450_filed", "Candidate's current Confidential Financial Disclosure Report (OGE-450) is filed in the Legal Office", ["Yes", "Not Complete"], "Yes"),
  T("oge_450_justification", "If not complete, provide justification"),
];

const warrantGeneralFields = (): FieldDef[] => [
  X("candidate_name", "Candidate's Name"),
  X("buying_location", "Buying Location", "center_name"),
  X("candidate_email", "Email"),
  X("candidate_telephone", "Telephone"),
  X("candidate_title", "Candidate's Title"),
  X("job_series", "Job Series"),
  X("grade", "Grade"),
  X("sponsor_name", "Sponsor's Name"),
  X("sponsor_email", "Sponsor's Email"),
  X("current_warrant", "Candidate's Current Warrant"),
  D("warrant_signed_date", "Date Warrant Signed"),
];

const educationField = (): FieldDef =>
  S(
    "education_level",
    "Highest Education Level Completed",
    ["High School", "Baccalaureate Degree", "Post Graduate Degree", "Doctoral Degree"],
    "Baccalaureate Degree",
  );

const warrantNominationOther: TemplateDef = {
  key: "warrant-nomination-other-series",
  name: "Contracting Officer Warrant Nomination Other Than 1102-1105",
  tab: "NA",
  badge: {
    citation: "FAR 1.403; NFS 1801.603(d); NFS CG 1801.45",
    tier: "binding",
    revision: "HQ base issuance 10/2021, revisions 05/2022, 07/2024 and 05/2026",
    effective: "2026-05-01",
  },
  lead:
    "Warrant nomination for a candidate in an occupational series other than GS-1102 or GS-1105, approved by the Assistant Administrator for Procurement.",
  layout: "plan",
  sections: [
    {
      id: "general",
      title: "General Information",
      citation: "NFS CG 1801.45",
      tier: "binding",
      fields: warrantGeneralFields(),
    },
    {
      id: "education",
      title: "Formal Education",
      citation: "NASA Procurement Career Development and Training Program Policy Handbook",
      tier: "guidance",
      fields: [educationField()],
    },
    {
      id: "training",
      title: "Required Training",
      citation: "NASA Procurement Career Development and Training Program Policy Handbook",
      tier: "guidance",
      standingText: "Candidate has completed the following Defense Acquisition University courses:",
      fields: [
        S("course_fcn_101", "FCN 101", ["Not completed", "Completed"], "Not completed"),
        S("course_clc_106", "CLC 106", ["Not completed", "Completed"], "Not completed"),
        S("course_con_1100", "CON 1100", ["Not completed", "Completed"], "Not completed"),
        S("course_con_1200", "CON 1200", ["Not completed", "Completed"], "Not completed"),
        S("course_acq_1010", "ACQ 1010", ["Not completed", "Completed"], "Not completed"),
        S("course_negotiation", "Negotiation Skills", ["Not completed", "Completed"], "Not completed"),
        S("course_con_0510", "CON 0510", ["Not completed", "Completed"], "Not completed"),
      ],
    },
    {
      id: "warrant_request",
      title: "Warrant Request",
      citation: "FAR 1.403",
      tier: "binding",
      standingText:
        "There is a clear and convincing need to appoint a CO with the ability to perform the following duties:",
      fields: [
        T(
          "organizational_need",
          "Duties and need",
          "The activities and workload the candidate will be assigned, the average dollar value of the contract actions, and why the warrant authority requested is needed.",
        ),
      ],
    },
    {
      id: "authority",
      title: "Warrant Authority Requested",
      citation: "FAR 2.101",
      tier: "binding",
      standingText:
        "Federal Acquisition Regulation (FAR), the NASA FAR Supplement Companion Guide, other Statutory requirements, Executive Orders, NASA Procurement Enterprise requirements, and other applicable regulations, the following additional warrant limitations are imposed. The warrant limit applies to award of contracts as defined by FAR 2.101 and includes modifications, delivery orders, and task orders issued under existing contracts. The warrant must be equal to or greater than the value of the instant contract action. To maintain warrant appointments, COs in occupational series other than GS-1102 or GS-1105, must obtain 40 acquisition related continuous learning points every two-years to avoid having the warrant modified or revoked.",
      fields: [
        S(
          "warrant_authority",
          "Warrant authority requested",
          ["Warrant Authority $0 - $250K", "Warrant Authority > $250K - $1M", "Warrant Authority >$1M"],
          "Warrant Authority $0 - $250K",
        ),
        D("fcn_101_date", "FCN 101 course completion date"),
        D("clc_106_date", "CLC 106 course completion date"),
        D("fac_cor_date", "FAC-COR certification date, where CLC 106 is waived"),
        D("con_1100_date", "CON 1100 course completion date"),
        D("con_1200_date", "CON 1200 course completion date"),
        D("acq_1010_date", "ACQ 1010 course completion date"),
        D("negotiation_date", "Negotiation Skills course completion date"),
        D("con_0510_date", "CON 0510 course completion date"),
      ],
    },
    {
      id: "limitation",
      title: "Limitation of Authority",
      citation: "FAR 1.603",
      tier: "binding",
      standingText:
        "In addition to the FAR and NASA FAR Supplement and other statutory requirements, the following additional warrant limitations are imposed:",
      fields: [T("limitation_details", "Limitation of warrant authority")],
    },
    {
      id: "justification",
      title: "Warrant Justification",
      citation: "NASA Procurement Career Development and Training Program Policy Handbook",
      tier: "guidance",
      fields: warrantJustificationFields(),
    },
    {
      id: "signature_page",
      title: "Signature Page",
      citation: "NFS CG 1801.45",
      tier: "binding",
      standingText:
        "I certify that the information contained herein has been verified against this candidate's personnel file and that this candidate is qualified to be considered for appointment.",
      fields: [
        X("certifying_official", "Certifying official"),
        S("aa_decision", "Assistant Administrator for Procurement", ["Approve", "Disapprove"], "Approve"),
        X("aa_name", "NASA Assistant Administrator for Procurement"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Nominating official and Assistant Administrator for Procurement",
    citation: "NFS CG 1801.45",
    blocks: ["Nominating Official", "Date", "NASA Assistant Administrator for Procurement", "Date"],
  }),
};

const enterpriseWarrantNomination: TemplateDef = {
  key: "warrant-nomination-enterprise",
  name: "Enterprise Contracting Officer Warrant Nomination-",
  tab: "NA",
  badge: {
    citation: "FAR 1.403; NFS CG 1801.45(c)",
    tier: "binding",
    revision: "HQ base issuance 10/2021, current revision 02/2026",
    effective: "2026-02-01",
  },
  lead: "Enterprise warrant nomination for a contracting officer candidate, with the procurement officer endorsement and CORB page.",
  layout: "plan",
  sections: [
    {
      id: "general",
      title: "General Information",
      citation: "NFS CG 1801.45(c)",
      tier: "binding",
      fields: [...warrantGeneralFields(), X("years_experience", "Years of Experience")],
    },
    {
      id: "request_type",
      title: "Warrant Request Type",
      citation: "NFS CG 1801.45(c)",
      tier: "binding",
      fields: [
        S(
          "request_type",
          "Warrant request type",
          ["New Appointment", "Admin/Modification", "Transfer Warrant"],
          "New Appointment",
        ),
      ],
    },
    {
      id: "education",
      title: "Formal Education",
      citation: "NASA Procurement Career Development and Training Program Policy Handbook, Appendix D",
      tier: "guidance",
      fields: [educationField()],
    },
    {
      id: "certifications",
      title: "Acquisition Certification(s)",
      citation: "NASA Procurement Career Development and Training Program Policy Handbook, Appendix D",
      tier: "guidance",
      fields: [
        S("fac_c_professional", "Acquisition Certification: FAC-C Professional", ["Not held", "Held"], "Held"),
        S(
          "legacy_certification",
          "Highest Legacy Certification Held",
          ["None", "FAC-C/DAWIA Level 1", "FAC-C/DAWIA Level 2", "FAC-C/DAWIA Level 3"],
          "None",
        ),
      ],
    },
    {
      id: "specialized_training",
      title: "Specialized Training",
      citation: "NASA Procurement Career Development and Training Program Policy Handbook, Appendix D",
      tier: "guidance",
      fields: [
        S("grants_training", "Grants Training and Certification Program", ["Not completed", "Completed"], "Not completed"),
        X("other_training", "Other"),
      ],
    },
    {
      id: "organization_need",
      title: "Warrant Request - Organization Need",
      citation: "FAR 1.403",
      tier: "binding",
      standingText:
        "There is a clear and convincing need to appoint a CO with the ability to perform the following duties:",
      fields: [
        T(
          "organizational_need",
          "Duties and need",
          "The activities and workload assigned, the average dollar value of the contract actions, and why the classification requested is needed.",
        ),
      ],
    },
    {
      id: "authority",
      title: "Warrant Authority Requested",
      citation: "FAR 2.101; NASA Procurement Career Development and Training Program Policy Handbook, Appendix D",
      tier: "binding",
      standingText:
        "In addition to the Federal Acquisition Regulation (FAR), the NASA FAR Supplement, other Statutory requirements, Executive Orders, NASA Procurement Enterprise requirements, and other applicable regulations, the following additional warrant limitations are imposed. The warrant limit applies to award of contracts as defined by FAR 2.101 and includes modifications, delivery orders, and task orders issued under existing contracts. The warrant must be equal to or greater than the value of the instant contract action. Effective May 1, 2024, to maintain warrant appointments COs must complete 100 Continuous Learning Points (CLPs) in acquisition or leadership developmental courses or activities within the common two-year CL period.",
      fields: [
        S(
          "warrant_class",
          "Warrant classification requested",
          [
            "Class I \u2013 Simplified Acquisition Threshold (SAT)",
            "Class II \u2013 $1M",
            "Class II \u2013 $5M",
            "Class II \u2013 $10M",
            "Class III \u2013 $25M",
            "Class III \u2013 $50M",
            "Class IV \u2013 $250M",
            "Class IV \u2013 Unlimited",
          ],
          "Class II \u2013 $10M",
        ),
        T("training_path", "Training route relied on for this classification", "The FAC-C Professional route or the legacy route, with the credential or courses named."),
        X("course_name", "Course"),
        D("course_date", "Course completion date"),
        T("other_relevant_training", "Other relevant training"),
        S(
          "other_authority",
          "E. Other Warrant Authority",
          ["None", "Grants Officer", "Administrative Contracting Officer (ACO)", "Termination Contracting Officer (TCO)"],
          "None",
        ),
        T("limitation_details", "F. Limitation of Warrant Authority"),
      ],
    },
    {
      id: "justification",
      title: "Warrant Justification",
      citation: "NASA Procurement Career Development and Training Program Policy Handbook, Appendix D",
      tier: "guidance",
      showIf: (v) => (v["request_type"] ?? "") !== "Transfer Warrant",
      fields: warrantJustificationFields(),
    },
    {
      id: "signature_page",
      title: "Signature Page",
      citation: "NFS CG 1801.45(c)",
      tier: "binding",
      standingText:
        "I certify that the information contained herein has been verified against this candidate's personnel file and that this candidate is qualified to be considered for appointment.\n\nIn accordance with the CD&T Handbook, Appendix D - OP Enterprise Warrant Program, the enclosed warrant nomination addresses the standards outlined in FAR 1.403, NFS CG 1801.45(c) and is requested/issued as follows:",
      fields: [
        X("certifying_official", "Certifying official"),
        S(
          "po_endorsement",
          "Procurement Officer/Deputy Procurement Officer endorsement and approval",
          [
            "Warrant Appointment of Class IV \u2014 CORB Required",
            "Warrant Appointment of Class I, Class II, or Class III \u2014 CORB Not Required",
            "Transfer at Existing or Lower Warrant Classification Level",
            "Increase within Existing Warrant Classification Level",
            "Vetting Embedded in Hiring Process",
          ],
          "Warrant Appointment of Class I, Class II, or Class III \u2014 CORB Not Required",
        ),
        X("transfer_class_and_limit", "Warrant class and dollar limit, on a transfer"),
        X("procurement_officer_name", "Procurement Officer or Deputy Procurement Officer"),
      ],
    },
    {
      id: "corb",
      title: "Contracting Officer Review Board (CORB) Signature Page",
      citation: "NASA Procurement Career Development and Training Program Policy Handbook, Appendix D",
      tier: "binding",
      showIf: (v) => (v["po_endorsement"] ?? "").includes("CORB Required"),
      standingText:
        "In accordance with the findings provided above, it is determined that there is a clear and convincing need to appoint a Contracting Officer with the ability to perform at the Contracting Warrant Classification selected below. The position will be held at the buying location, where the candidate will be assigned various Contracting Officer duties, which will include responsibilities as outlined by the office assigned.",
      fields: [
        X("corb_classification", "Warrant Classification"),
        S("corb_decision", "CORB endorsement", ["Approve", "Disapprove"], "Approve"),
        X("corb_chair", "CORB Chair, Director, Procurement and Grants Policy Division"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Nominating official, procurement officer and CORB",
    citation: "NFS CG 1801.45(c)",
    blocks: ["Nominating Official", "Date", "Procurement Officer", "Date", "CORB Chair", "Date"],
  }),
};

// ---------------------------------------------- appointment and termination

const coAppointmentLetter: TemplateDef = {
  key: "co-appointment-letter",
  name: "NASA Enterprise Contracting Officer Appointment Letter",
  tab: "NA",
  badge: {
    citation: "FAR Subpart 1.6; NFS 1801.603",
    tier: "binding",
    revision: "HQ base issuance 11/2021, revision 04/2025",
    effective: "2025-04-01",
  },
  lead: "The procurement officer's letter appointing a contracting officer, issued with the signed SF 1402.",
  layout: "memo",
  sections: [
    {
      id: "heading",
      title: "Letter heading",
      citation: "NF 1858 letterhead",
      tier: "guidance",
      fields: [
        D("letter_date", "Date"),
        X("org_code", "Reply to Attn of: organizational code", "requester_org_code"),
        X("appointee_name", "TO: contracting officer's name"),
        X("warrant_number", "SUBJECT: Contracting Officer Appointment, warrant number"),
      ],
    },
    {
      id: "body",
      title: "Appointment",
      citation: "FAR 1.602-1; FAR 1.603-1; FAR 1.603-2; FAR 1.603-3; NFS 1801.603",
      tier: "binding",
      standingText:
        "By the authority vested in me and in conformance with Federal Acquisition Regulation (FAR) Subpart 1.6 and NASA FAR Supplement 1801.603, you are hereby appointed as a contracting officer (CO) for the United States of America. As a CO, you are to exercise sound business judgement in fulfilling the responsibility for ensuring performance of all necessary actions for effective contracting, compliance with the terms of the contract, and safeguarding the interests of the United States in its contractual relationships. You must also ensure that contractors receive impartial, fair, and equitable treatment; request and consider the advice of specialists in auditing, law, information security, engineering, and other fields as appropriate; and designate and authorize a contracting officer's representative on contracts in accordance with federal and Agency procedures.\n\nYou may bind the Government only to the extent of the authority delegated to you. The limitations of your authority are stated in the enclosed Standard Form (SF) 1402, Certificate of Appointment, which you must promptly display in your work area.\n\nNo contract shall be entered into unless the CO ensures that all requirements of law, executive orders, regulations, and all other applicable procedures, including clearances and approvals, have been met.\n\nCongratulations on achieving this career milestone!",
      fields: [
        X("procurement_officer_name", "Name of the buying location's Procurement Officer"),
        X("enclosures", "Enclosures"),
        X("distribution", "Distribution: supervisor's name"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Procurement officer",
    citation: "NFS 1801.603",
    blocks: ["Procurement Officer", "Date"],
  }),
};

const coTerminationLetter: TemplateDef = {
  key: "co-appointment-termination",
  name: "Contracting Officer Appointment Termination Letter",
  tab: "NA",
  badge: {
    citation: "FAR 1.603-4; NFS 1801.603",
    tier: "binding",
    revision: "HQ base issuance 11/2021, revision 05/2025",
    effective: "2025-05-01",
  },
  lead: "The procurement officer's letter rescinding a contracting officer appointment.",
  layout: "memo",
  sections: [
    {
      id: "heading",
      title: "Memorandum heading",
      citation: "NF 1858 letterhead",
      tier: "guidance",
      fields: [
        D("letter_date", "Date"),
        X("org_code", "Reply to attn. of: organization code", "requester_org_code"),
        X("appointee_name", "TO: contracting officer's name"),
        X("warrant_number", "SUBJECT: Termination of Contracting Officer Appointment, warrant number"),
      ],
    },
    {
      id: "body",
      title: "Termination",
      citation: "FAR 1.603-4",
      tier: "binding",
      standingText:
        "Effective immediately and pursuant to Federal Acquisition Regulation (FAR) 1.603-4, the subject contracting officer appointment is hereby rescinded due to the reason stated below.\n\nFor the aforementioned reason(s), authority to award any contractual instruments within the NASA Contracting Writing System has also been revoked. Thank you for your service in support of the NASA mission.",
      fields: [
        S(
          "termination_reason",
          "Reason for the termination",
          [
            "There is no longer a need for the appointment",
            "Unsatisfactory performance",
            "Anti-deficiency Act violations",
            "Loss of security clearance",
            "Fraud or negligence",
            "Significant lapse in judgement",
            "Alleged official misconduct pending criminal or administrative investigations",
            "Failure to meet training or skills currency requirements",
            "A contracting officer taking an action that exceeds his or her authority",
            "Blatant disregard for adhering to acquisition regulations, policies and procedures",
            "FAC-C Certification has expired or has been revoked",
          ],
          "There is no longer a need for the appointment",
        ),
        T("termination_narrative", "Supporting narrative"),
        X("procurement_officer_name", "Name of the buying location Procurement Officer"),
        X("distribution", "Distribution: supervisor's name"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Procurement officer",
    citation: "FAR 1.603-4",
    blocks: ["Procurement Officer", "Date"],
  }),
};

// ------------------------------------------ authorization to use supply sources

const supplySourcesAuthorization: TemplateDef = {
  key: "supply-sources-authorization",
  name: "Authorization to Use Government Supply Sources",
  tab: "NA",
  badge: {
    citation: "FAR Subpart 51.1; FAR 51.102(e); NFS Subpart 1851.1",
    tier: "binding",
    revision: "HQ base issuance 09/2020, revision 12/2024",
    effective: "2024-12-12",
  },
  lead: "The contracting officer's written authorization for a contractor to use Government supply sources.",
  layout: "memo",
  sections: [
    {
      id: "heading",
      title: "Authorization heading",
      citation: "FAR 51.102",
      tier: "binding",
      fields: [
        D("letter_date", "Date the authorization is signed and sent"),
        X("org_code", "Procurement Office code or identifier", "requester_org_code"),
        T("contractor_block", "TO: contractor point of contact, name and address"),
        S("authorized_action", "SUBJECT: Authorization to", ["Lease", "Rent", "Purchase"], "Purchase"),
        X("supply_source", "Government supply source", undefined, "For example the General Services Administration (GSA), Defense Logistics Agency (DLA) or Veterans Administration (VA)."),
        X("contract_number", "NASA contract number", "contract_number"),
        T("authorized_contractor", "Authorized Contractor: name, full address, telephone and email of the point of contact", undefined),
      ],
    },
    {
      id: "scope",
      title: "1. Authorized use",
      citation: "FAR 51.101; FAR 51.102(c)",
      tier: "binding",
      standingText:
        "The contractor named above is hereby authorized to use the Government supply sources named above in performance of the contract number above for NASA as follows:\n\n\u2022 The acquisition of supplies and/or services available for purchase by Government agencies either directly from GSA stock or under Federal Supply Schedules subject to the limitations set forth in this authorization.\n\u2022 The leasing or rental of equipment available for lease or rental by Government agencies under Federal Supply Schedules subject to the limitations set forth in this authorization.\n\u2022 Access to NASA, GSA, or other agencies' training programs available for Government employees at Government rates, subject to the approval of the agency providing the training.\n\u2022 The issuance of tax exemption certificates in lieu of the payment of State or other taxes for which the Government is not liable on supplies or services purchases under this authorization.\n\u2022 The acquisition of supplies, services, equipment, or training programs authorized under NASA Center or other Government agency contracts to include NASA's Solutions for Enterprise-Wide Procurement (SEWP) contract.\n\u2022 The acquisition and administration of printing and or related services, as appropriate and needed for the performance of, and in accordance with the provisions of, the contract, from the NASA Shared Services Center (NSSC), NASA End User Services Program Office (EUSO), or the Government Publishing Office (GPO).",
      fields: [
        X("authorization_period", "This authorization is limited to the following period"),
        T("scope_limitations", "Limitations or conditions imposed under FAR 51.102(e)(4)"),
      ],
    },
    {
      id: "ordering",
      title: "2. Ordering",
      citation: "FAR 51.102(e)(1) through (5); FAR 53.302-347",
      tier: "binding",
      standingText:
        "When requisitioning from GSA or DOD, the contractor shall use FEDSTRIP or MILSTRIP, as appropriate, and include the activity address code assigned by GSA or DOD. When requisitioning from the VA, the contractor should use FEDSTRIP or MILSTRIP, as appropriate, Optional Form 347, Order for Supplies or Services (see 53.302-347).\n\nOrders under GSA schedule contracts shall be placed in accordance with the terms and conditions of the GSA schedule contract and this authorization. A copy of this authorization shall be attached to each order (unless a copy was previously furnished to the GSA contractor). All orders shall contain the following statement: \u201cThis order is placed under written authorization from the National Aeronautics and Space Administration dated as shown below. In the event of any inconsistency between the terms and conditions of this order and those of the Federal Supply Schedule contract, the latter will govern. This order contains only items required in performance of the NASA contract named above.\u201d\n\nOrders for items in the GSA Supply Catalog shall be placed in accordance with the Catalog and this authorization and shall include the address to which billings are to be sent. GSA does not issue bills until after shipment has been made and should therefore be paid promptly upon receipt of billings. Any necessary adjustments will be made by GSA subsequent to payment. All orders shall contain the following statement: \u201cThis order is placed on behalf of the National Aeronautics and Space Administration under the contract named above pursuant to the written authorization effective as shown below.\u201d\n\nOrders under NASA Center or other agency contracts shall be placed in accordance with the contract and shall include the address to which billings are to be sent.\n\nUse of Government supply sources by the contractor's subcontractor(s) must be requested on a case-by-case basis and is not valid without a written authorization issued by the cognizant contracting officer. Any orders placed in accordance with the above shall be subject to the subcontract consent provisions of the contract.\n\nTitle to all property acquired by the contractor under this authorization shall vest in the parties as provided in the contract, unless specifically provided for otherwise. Contractor shall comply with the applicable policies and procedures prescribed in FAR Subpart 51.1 and NASA FAR Subpart 1851.1.",
      fields: [
        D("order_authorization_date", "Date of the written authorization cited in orders"),
        X("copy_statement", "Whether the authorization is attached or already on file", undefined, "For example, a copy of which is attached, or a copy of which you have on file."),
        D("effective_date", "Authorization effective date for GSA Supply Catalog orders"),
        X("activity_address_code", "Activity address code assigned by GSA or DOD"),
      ],
    },
    {
      id: "duration",
      title: "3. Duration",
      citation: "FAR 51.104; FAR 52.251-1",
      tier: "binding",
      standingText:
        "The authority hereby granted is not transferable or assignable and is in effect until withdrawn or upon completion or termination of the NASA contract named above or upon written notice from the contracting officer.",
      fields: [X("co_name", "Contracting officer", "co_name")],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting officer",
    citation: "FAR 51.102(e)",
    blocks: ["Contracting Officer", "Date"],
  }),
};

export const HQ6B_TEMPLATES: TemplateDef[] = [
  voucherReview,
  nf533Analysis,
  ratification,
  nearFileLocation,
  bpaAnnualReview,
  warrantNominationOther,
  enterpriseWarrantNomination,
  coAppointmentLetter,
  coTerminationLetter,
  supplySourcesAuthorization,
];

export const HQ6B_TEMPLATE_KEYS = HQ6B_TEMPLATES.map((t) => t.key);

/** Phase each Batch 6 part 2 document belongs to. */
export const HQ6B_PHASES: Record<string, string> = {
  "voucher-review-checklist": "Administration",
  "nf-533-analysis": "Administration",
  "ratification-unauthorized-commitment": "Intake",
  "near-file-location-memo": "Administration",
  "bpa-annual-review": "Administration",
  "warrant-nomination-other-series": "Administration",
  "warrant-nomination-enterprise": "Administration",
  "co-appointment-letter": "Administration",
  "co-appointment-termination": "Administration",
  "supply-sources-authorization": "Administration",
};
