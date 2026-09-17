/**
 * HQ Office of Procurement special-approval templates (Batch 4).
 *
 * Headings, determination and certification sentences, and signature-block
 * titles are taken verbatim from the HQ Word masters and the Batch 4 field map.
 * Drafter instructions, colour-coded sample wording and the document history
 * logs never print: they appear here only as field help.
 *
 * Every field the acquisition record can fill carries a bind, so the form opens
 * prefilled with a Source link; everything else is a contracting officer field.
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

const M = (key: string, label: string, bind?: string): FieldDef => ({
  key,
  label,
  kind: "money",
  ...(bind ? { bind } : {}),
});

const LEGAL_CONCURRENCE =
  "Legal: I have reviewed the above determination and findings and have no legal objection with respect to it. Comments, if any, are included in the file.";

function centreHeading(titleLines: string[], citation: string, extra: FieldDef[] = []): SectionDef {
  return {
    id: "heading",
    title: "Heading",
    citation,
    tier: "binding",
    standingText: `NATIONAL AERONAUTICS AND SPACE ADMINISTRATION\n${titleLines.join("\n")}`,
    fields: [
      X("center_name", "Center name and acronym", "center_code"),
      X("acquisition_name", "Solicitation or contract name and number", "acquisition_id"),
      X("acquisition_identifier", "Program or project name and acquisition identifier", "mission_id"),
      { key: "prepared_on", label: "Date", kind: "date" },
      ...extra,
    ],
  };
}

function signaturePage(
  pageTitle: string,
  blocks: { label: string; note?: string }[],
  citation: string,
  standingText = LEGAL_CONCURRENCE,
): SectionDef {
  return {
    id: "signature_page",
    title: `SIGNATURE PAGE — ${pageTitle}`,
    citation,
    tier: "binding",
    standingText,
    fields: blocks.map((b) => ({
      key: `sig_${b.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      label: b.label,
      kind: "text" as const,
      ...(b.note ? { help: b.note } : {}),
    })),
  };
}

const CO_BLOCK = { label: "Contracting Officer" };
const CENTER_LEGAL_BLOCK = { label: "Office of the General Counsel at the Center", note: LEGAL_CONCURRENCE };
const PO_BLOCK = { label: "Procurement Officer" };
const HQ_OGC_BLOCK = { label: "Office of the General Counsel at Headquarters" };
const HCA_BLOCK = {
  label: "Head of Contracting Activity",
  note: "Refer to the NFS 1802.101 definition of head of contracting activity.",
};
const SPE_BLOCK = { label: "Senior Procurement Executive" };
const TECH_REP_BLOCK = { label: "Technical Representative" };
const COMP_ADVOCATE_BLOCK = { label: "Competition Advocate, Center" };
const AGENCY_COMP_ADVOCATE_BLOCK = {
  label: "Agency Competition Advocate",
  note: "The Deputy Assistant Administrator for Procurement is the Agency Competition Advocate.",
};

// ------------------------------------------------ 1. Request to award a foreign contract
const foreignContractRequest: TemplateDef = {
  key: "foreign-contract-request",
  name: "Request to Award A Foreign Contract",
  tab: "032",
  layout: "memo",
  badge: {
    citation: "NFS 1825.7002(a); NFS 1825.7002(b)(1); NFS 1825.7003; FAR Part 25",
    tier: "binding",
    revision: "HQ 04/2025 revision",
    effective: "2026-04-09",
    note: "Clearance is requested from NASA Headquarters before a foreign contract above $100,000 or with export control issues is initiated.",
  },
  lead: "Memorandum requesting Headquarters clearance to award a contract to a foreign entity.",
  sections: [
    {
      id: "memo_header",
      title: "Memorandum",
      citation: "NFS 1825.7002(b)(1)",
      tier: "binding",
      standingText:
        "TO: NASA Headquarters, Attn: Office of International and Interagency Relations\n" +
        "THRU: NASA Headquarters, Office of Procurement, Procurement Strategic Operations Division\n" +
        "SUBJECT: Clearance Request to Award a Contract to a Foreign Entity\n\n" +
        "NASA Federal Acquisition Regulation (FAR) Supplement (NFS) 1825.7002(a) requires coordination with NASA Headquarters before initiating any foreign contract acquisition if the acquisition is valued above $100,000 or involves export control issues. In accordance with NFS 1825.7002(b)(1), the required information is provided below and clearance to award a contract to a foreign entity is hereby requested.",
      fields: [
        { key: "memo_date", label: "Date", kind: "date" },
        X("org_code", "Reply to Attn of: organizational code", "requester_org_code"),
        X("from_office", "Technical office and title of the technical representative", "cor_name"),
      ],
    },
    {
      id: "item_1",
      title: "1. The name of the foreign entity, the country or countries involved, and the purpose of the contract:",
      citation: "NFS 1825.7002(b)(1)",
      tier: "binding",
      fields: [
        X("foreign_entity", "Name of foreign entity", "vendor_legal_name"),
        X("countries", "Country or countries involved", "place_of_performance"),
        T("purpose", "Purpose of the contract", "Describe the requirement being acquired."),
        M("estimated_value", "Estimated value of this contract", "estimated_value"),
        T("prior_awards", "Previous awards to the same company, where any"),
      ],
    },
    {
      id: "item_2",
      title: "2. The Space Act agreement(s) involved:",
      citation: "NFS 1825.7002(b)(1)",
      tier: "binding",
      fields: [
        S(
          "space_act",
          "Select one",
          [
            "No Space Act agreement is applicable to this procurement.",
            "The following Space Act agreement is applicable to this procurement:",
            "Although no Space Act agreement is applicable to this procurement, the following Memorandum of Understanding is applicable to this procurement:",
            "Although no Space Act agreement is applicable to this procurement, the following Memorandum of Agreement is applicable to this procurement:",
          ],
          "No Space Act agreement is applicable to this procurement.",
        ),
        X("agreement_title", "Title of agreement"),
        X("agreement_installation", "NASA installation", "center_code"),
        X("agreement_partner", "Partner name"),
        X("agreement_partner_country", "Partner country"),
        { key: "agreement_executed", label: "Execution date", kind: "date" },
        { key: "agreement_expires", label: "Expiration date", kind: "date" },
      ],
    },
    {
      id: "item_3",
      title:
        "3. A description of the goods or technical data requiring prior written approval or the issuance of the license for their import or export from the Departments of Commerce, State, and Treasury:",
      citation: "NFS 1825.7003",
      tier: "binding",
      fields: [
        S(
          "licences",
          "Select one",
          [
            "No licenses are required from the Departments of Commerce, State, and Treasury.",
            "Licenses are required; the goods or technical data are described below.",
          ],
          "No licenses are required from the Departments of Commerce, State, and Treasury.",
        ),
        T("licence_detail", "Goods or technical data, status of the request, license number and date approved"),
      ],
    },
    {
      id: "item_4",
      title: "4. The reason why the acquisition is being placed with a foreign entity:",
      citation: "NFS 1825.7002(b)(1)",
      tier: "binding",
      fields: [T("reason", "Reason the acquisition is placed with a foreign entity")],
    },
    {
      id: "closing",
      title: "Closing",
      citation: "NFS 1825.7002",
      tier: "binding",
      standingText:
        "If there are any questions related to this request, please contact the undersigned or the Contracting Officer.",
      fields: [
        X("technical_email", "Email address of the technical officer"),
        X("co_email", "Email address of the contracting officer"),
      ],
    },
    signaturePage(
      "REQUEST TO AWARD A FOREIGN CONTRACT",
      [{ label: "Technical Officer" }, { label: "Concurrence: Contracting Officer" }],
      "NFS 1825.7002(b)(1)",
      "Concurrence:",
    ),
  ],
};

// ------------------------------------------------ 2. Duty free certificate
const dutyFreeCertificate: TemplateDef = {
  key: "duty-free-certificate",
  name: "Duty Free Certificate",
  tab: "095",
  layout: "memo",
  badge: {
    citation: "FAR Subpart 25.9; FAR 25.901; NFS 1825.903; 14 C.F.R. 1217.103",
    tier: "guidance",
    revision: "HQ 01/2026 revision",
    effective: "2026-04-07",
    note: "Item 9808.00.80, Harmonized Tariff Schedule of the United States.",
  },
  lead: "U.S. Customs duty-free entry certificate for articles imported for NASA use.",
  sections: [
    {
      id: "heading",
      title: "Heading",
      citation: "FAR 25.901",
      tier: "binding",
      standingText:
        "U.S. Customs duty-Free Entry Certificate\nArticles for National Aeronautics and Space Administration (NASA)\nItem 9808.00.80 Harmonized Tariff of the United States\n\n" +
        "I hereby certify that the articles identified below are being imported for the use of the National Aeronautics and Space Administration (NASA) in accordance with Item 9808.00.80, Harmonized Tariff Schedule of the United States.",
      fields: [
        X("program", "Program the articles will support", "mission_id"),
        T("purpose", "The article(s) below will be used for"),
        { key: "prepared_on", label: "Date", kind: "date" },
      ],
    },
    {
      id: "articles",
      title: "Description of Articles:",
      citation: "14 C.F.R. 1217.103",
      tier: "binding",
      fields: [
        T("article_list", "Articles: number, description, part number, quantity, unit value and total value"),
        M("article_total", "Estimated value of all articles"),
      ],
    },
    {
      id: "parties",
      title: "Contract and supplier",
      citation: "FAR Subpart 25.9",
      tier: "binding",
      fields: [
        X("prime_contractor", "NASA prime contractor: full name and address", "vendor_legal_name"),
        X("prime_contract_number", "Prime contract number", "acquisition_id"),
        X("subcontractor", "Subcontractor (Foreign Supplier): name and address"),
        X("subcontract_number", "Subcontract Number (Foreign)"),
      ],
    },
    {
      id: "shipment",
      title: "Shipment",
      citation: "14 C.F.R. 1217.103",
      tier: "binding",
      fields: [
        S("delivery_mode", "Deliveries", ["Single delivery", "Multiple deliveries"], "Single delivery"),
        X("entry_dates", "Approximate date(s) of entry"),
        X("shipment_method", "Method of shipment"),
        X("port_of_entry", "Port of entry"),
        X("airway_bill", "Airway bill no."),
        T("destination", "Shipment destination and technical receiver"),
        X("customs_contact", "Contact for Customs personnel with issues or inquiries"),
      ],
    },
    {
      id: "series",
      title: "Series of imports",
      citation: "14 C.F.R. 1217.103",
      tier: "binding",
      standingText:
        "Before this certification is used to obtain duty-free entry of these articles, a cognizant NASA official at the receiving NASA installation, who is designated by the installation Director, shall verify in writing that specifically identified articles to be entered on a particular date are the articles described in this certificate or its attachments. This verification and this certification shall be presented to the U.S. Customs Service at the time entry for the particular articles are sought.",
      fields: [],
      showIf: (v: Values) => v["delivery_mode"] === "Multiple deliveries",
    },
    signaturePage(
      "U.S. CUSTOMS DUTY-FREE ENTRY CERTIFICATE",
      [
        { label: "Prepared by: name and title, installation" },
        { label: "Concurrence: Office of the General Counsel, installation" },
        { label: "Approval: Procurement Officer, installation" },
      ],
      "NFS 1825.903",
      "Prepared by / Concurrence / Approval:",
    ),
  ],
};

// ------------------------------------------------ 3. Buy American Act nonavailability
const buyAmericanNonavailability: TemplateDef = {
  key: "buy-american-nonavailability",
  name: "Buy American Act Nonavailability Determination - Supplies",
  tab: "025",
  layout: "dandf",
  badge: {
    citation: "FAR 25.103(b)(2)(i); NFS 1825.103; Procurement Class Deviation 25-54",
    tier: "binding",
    revision: "HQ 02/2026 revision",
    effective: "2026-04-20",
    note: "Nonavailability determinations are approved by the head of the contracting activity.",
  },
  lead: "Determination that the foreign end product may be acquired under the nonavailability exception.",
  sections: [
    centreHeading(["Buy American Act Nonavailability Determination – Supplies"], "FAR 25.103", [
      X("pr_number", "Purchase Request (PR)/solicitation/contract no.", "pr_number"),
    ]),
    {
      id: "authority",
      title: "Authority",
      citation: "FAR 25.103(b)(2)(i)",
      tier: "binding",
      standingText:
        "In accordance with Federal Acquisition Regulation (FAR) 25.103, the contracting officer (CO) may acquire the foreign end product identified herein without regard to the restrictions of the Buy American Act, under the authority of the nonavailability exception (b)(2)(i). This authorization is based upon the determination that the articles, materials, or supplies to be procured are not mined, produced, or manufactured in the United States in sufficient and reasonably available commercial quantities of a satisfactory quality.",
      fields: [],
    },
    {
      id: "finding_a",
      title: "(a) A requirement exists to procure the following item(s):",
      citation: "FAR 25.103",
      tier: "binding",
      fields: [
        T("items", "Item, quantity, description, NAICS, PSC, unit price and total for each item"),
        M("items_total", "Total estimated value", "estimated_value"),
      ],
    },
    {
      id: "finding_b",
      title: "(b) The proposed contractor is:",
      citation: "FAR 25.103",
      tier: "binding",
      fields: [
        X("contractor", "Name of the proposed contractor", "vendor_legal_name"),
        S("business_size", "(i) The contractor is a:", ["Small business", "Small disadvantaged business", "Other"]),
        S("proposed_type", "(ii) The proposed contract type is:", [
          "Cost reimbursable",
          "Fixed-price",
          "Indefinite-delivery-indefinite-quantity",
          "Other",
        ]),
      ],
    },
    {
      id: "finding_c",
      title: "(c) The country of origin is:",
      citation: "FAR 25.7",
      tier: "binding",
      fields: [
        X("country_of_origin", "Name of country"),
        { key: "sanctions_checked", label: "Date the contract specialist verified the country is not a prohibited source", kind: "date" },
      ],
    },
    {
      id: "finding_d",
      title: "(d) Description of the item(s) to be acquired",
      citation: "FAR 25.103",
      tier: "binding",
      fields: [
        {
          key: "item_description",
          label: "Program, project or facility supported, technical description, mission impact and rationale for the foreign item",
          kind: "textarea",
          bind: "description_of_requirement",
        },
      ],
    },
    {
      id: "finding_e",
      title: "(e) Market research was conducted",
      citation: "FAR Part 10",
      tier: "binding",
      fields: [T("market_research", "Activities, methods, timing and conclusions")],
    },
    {
      id: "finding_f",
      title: "(f) Use of competition",
      citation: "FAR Part 6",
      tier: "binding",
      fields: [T("competition", "Use of competition for this acquisition")],
    },
    {
      id: "finding_g",
      title: "(g) Presolicitation notice",
      citation: "FAR 5.101",
      tier: "binding",
      fields: [
        S(
          "presolicitation",
          "Select one",
          [
            "This acquisition was exempt from a presolicitation notice in accordance with FAR 5.101(a)(1), as its value did not exceed the $20,000 threshold for posting a presolicitation notice.",
            "This acquisition was exempt from a presolicitation notice in accordance with FAR 5.101(b)(1)(i), as 1) its value did not exceed the simplified acquisition threshold (i.e., $350,000); and 2) the solicitation will be posted to the Governmentwide point of entry (GPE) and permit the public to respond to the solicitation electronically.",
            "This acquisition was exempt from a presolicitation notice in accordance with another exception at FAR 5.101(b)(1).",
            "A presolicitation notice was posted to the GPE as required by FAR 5.101(a).",
          ],
        ),
        T("presolicitation_detail", "Exception language, posting date, responses received, evaluation results and the rationale for selecting the foreign end product"),
      ],
    },
    {
      id: "finding_h",
      title: "(h) Expectation of price preference",
      citation: "FAR 25.103",
      tier: "binding",
      fields: [T("price_preference", "Whether the solicitation included the provision announcing the price preference")],
    },
    {
      id: "finding_i",
      title: "(i) Exclusion of a source offering a U.S. made product",
      citation: "FAR 25.103",
      tier: "binding",
      fields: [T("exclusion", "Preaward narrative")],
    },
    {
      id: "finding_j",
      title: "(j) The Government's minimum needs",
      citation: "FAR 25.103",
      tier: "binding",
      standingText:
        "The Government's minimum needs can only be satisfied by the unique items available from the country of origin cited in paragraph (c) above, as there are no known domestically available item(s) for the proposed acquisition.",
      fields: [
        S("recurring", "Is this a recurring purchase?", ["No", "Yes"], "No"),
        X("recurring_frequency", "Frequency, where recurring"),
        S("mission_notified", "Mission support program/project office has been notified of this determination.", ["Yes", "No"], "Yes"),
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 25.103(b)(2)(i)",
      tier: "binding",
      standingText:
        "On the basis of the foregoing, it is hereby determined the items described in paragraph (a) above are not mined, produced, or manufactured (or the articles, materials, or supplies from which the items are manufactured are not mined, produced, or manufactured) in the United States in sufficient and reasonably available commercial quantities of a satisfactory quality. Therefore, the Buy American Act requirement that acquisition be made from domestic sources and that the items be of domestic origin, are not applicable to this acquisition.\n\n" +
        "This acquisition is within the Buy American Act's nonavailability exception at FAR 25.103(b)(2)(i). Authority is hereby granted to acquire the above-described item(s) of foreign origin at an estimated total cost including duty and transportation costs to destination.",
      fields: [
        M("determination_value", "Estimated total cost including duty and transportation", "estimated_value"),
        S("determination_variant", "Additional paragraph", [
          "None",
          "Unusual and compelling urgency, FAR 6.103-2",
          "At or below the simplified acquisition threshold, FAR 13.106-1(b)",
        ], "None"),
        { key: "justification_approved_on", label: "Date the justification for other than full and open competition was approved", kind: "date" },
        X("justification_approver", "Name and title of the approving official"),
        X("sat_reason", "Reason the item is reasonably available from one source, where FAR 13.104(b) applies"),
        { key: "determined_on", label: "Date", kind: "date" },
      ],
    },
    signaturePage(
      "BUY AMERICAN ACT – SUPPLIES – NON-AVAILABILITY DETERMINATION",
      [
        CO_BLOCK,
        CENTER_LEGAL_BLOCK,
        { label: "Program or project office technical representative", note: "This signature will serve as acknowledgment and concurrence with the nonavailability determination." },
        { label: "Concurrence: Procurement Officer", note: "Include only where the head of the contracting activity is not the Procurement Officer." },
        { label: "Concurrence: Office of the General Counsel at Headquarters", note: "Include only for actions valued above the simplified acquisition threshold." },
        { label: "Senior Procurement Executive", note: "Include only for actions valued above the simplified acquisition threshold." },
        { label: "Director, HQs Procurement and Grants Policy Division", note: "Include only for NSSC actions at or under the simplified acquisition threshold." },
        { label: "Senior Accountability Official", note: "The Office of International and Interagency Relations is designated NASA's Senior Accountability Official." },
        { label: "Approval: Head of Contracting Activity" },
      ],
      "FAR 25.103(b)(2)(i)",
      "In accordance with FAR 25.103(b)(2)(i) non-availability determinations must be approved by the head of the contracting activity.\n" +
        LEGAL_CONCURRENCE,
    ),
  ],
};

// ------------------------------------------------ 4. Non-commercial request
const noncommercialRequest: TemplateDef = {
  key: "noncommercial-request",
  name: "Request to Solicit a Non-Commercial Product or Service Template",
  tab: "004",
  layout: "memo",
  badge: {
    citation: "Executive Order 14271; FAR Part 10 and 41 U.S.C. 3307(d); FAR Part 12 and 10 U.S.C. 3453(c)",
    tier: "binding",
    revision: "HQ 07/2025 issuance",
    effective: "2026-05-19",
    note: "The Senior Procurement Executive approves the request before any notice, solicitation or sole source notice is posted.",
  },
  lead: "Request to solicit a product or service as non-commercial.",
  sections: [
    {
      id: "heading",
      title: "Request To Solicit a Non-Commercial Product or Service",
      citation: "Executive Order 14271",
      tier: "binding",
      fields: [
        S("stage", "1. Select the current acquisition stage:", [
          "Market Research Completed",
          "Drafting the solicitation",
          "Issued Pre-solicitation Notice",
          "Issued Solicitation Notice",
          "Issued Sole Source Notice",
          "Issued Award",
          "Awarded",
        ]),
        X("naics", "2. NAICS Code:", "naics_code"),
        X("requiring_org", "3. Requiring organization:", "requester_org_code"),
        M("value", "4. Estimated or awarded value:", "estimated_value"),
        X("class_period", "5. Class request specified period of need:"),
        X("class_expiration", "6. Class request expiration date:"),
      ],
    },
    {
      id: "item_7",
      title: "7. Procurement Description:",
      citation: "FAR Part 12",
      tier: "binding",
      fields: [
        {
          key: "description",
          label: "Program or project supported, estimated need date, duration, significance and intended effect",
          kind: "textarea",
          bind: "description_of_requirement",
        },
      ],
    },
    {
      id: "item_8",
      title: "8. Reasons a non-commercial product or service is required:",
      citation: "FAR Part 12 and 10 U.S.C. 3453(c)",
      tier: "binding",
      fields: [T("reasons", "At least three reasons")],
    },
    {
      id: "item_9",
      title: "9. Summary of Market Research:",
      citation: "FAR Part 10 and 41 U.S.C. 3307(d)",
      tier: "binding",
      fields: [T("market_research", "When conducted, mechanism used and responses received")],
    },
    {
      id: "item_10",
      title: "10. Summary of Price Analysis:",
      citation: "FAR Part 15.4; NFS Subpart 1815.4",
      tier: "binding",
      fields: [T("price_analysis", "Type, contents, method and results, and the basis of the independent government cost estimate")],
    },
    {
      id: "signature_page",
      title: "Signature Page",
      citation: "Executive Order 14271",
      tier: "binding",
      standingText:
        "I hereby submit this request with the supporting market research and price analysis for consideration in obtaining the product or service identified below as a non-commercial product or service.",
      fields: [
        X("product_or_service", "Name of the product or service", "title"),
        X("sig_co", "Contracting Officer"),
        X("sig_hca", "Concurrence: Head of Contracting Activity, Center acronym"),
        X("sig_psod", "Director, Procurement Strategic Operations Division"),
        X("sig_spe", "Approved: Senior Procurement Executive"),
      ],
    },
  ],
};

// ------------------------------------------------ 5. AbilityOne coordination
const abilityOneCoordination: TemplateDef = {
  key: "abilityone-coordination",
  name: "AbilityOne Coordination",
  tab: "004",
  layout: "memo",
  badge: {
    citation: "NFS 1808.705-1(c) and (d); FAR Part 8",
    tier: "guidance",
    revision: "HQ 04/2025 revision",
    effective: "2026-05-20",
    note: "The NASA AbilityOne Representative is courtesy copied on the email that sends the completed coordination to AbilityOne.",
  },
  lead: "Coordination questionnaire that lets AbilityOne begin an initial assessment of the requirement.",
  sections: [
    {
      id: "heading",
      title: "ABILITYONE COORDINATION",
      citation: "NFS 1808.705-1(c)",
      tier: "binding",
      standingText:
        "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION\nABILITYONE COORDINATION\n\nThe following information is required for AbilityOne to begin an initial assessment of the requirement(s). Please, answer all the following questions:",
      fields: [
        X("center", "Center:", "center_code"),
        X("point_of_contact", "Point of Contact:", "co_name"),
      ],
    },
    {
      id: "questions",
      title: "Questions",
      citation: "NFS 1808.705-1(d)",
      tier: "binding",
      fields: [
        X("q1", "1. Where is the place of performance (address)?", "place_of_performance"),
        X("q2", "2. What is the name of the current incumbent contractor?"),
        X("q3", "3. What is the address of the current incumbent?"),
        X("q4", "4. What is the incumbent's unique entity identifier?"),
        X("q5", "5. What is the current contract number?"),
        T("q6", "6. When does the last option year expire? Are there any extensions left on the current contract, and if so how many?"),
        X("q7", "7. What year is the contract in now?"),
        M("q8", "8. What is the current year's annual value?"),
        S("q9", "9. Is there a Collective Bargaining Agreement (CBA)?", ["Yes", "No", "Unknown"], "Unknown"),
        { key: "q10", label: "10. Contracting office agency ID code?", kind: "text", default: "8000" },
        X("q11", "11. Contracting office ID code?"),
        S("q12", "12. Is a copy of the Performance Work Statement (PWS) attached?", ["Yes", "No"], "Yes"),
        { key: "q13", label: "13. What is the requested performance work start date?", kind: "date" },
      ],
    },
  ],
};

// ------------------------------------------------ 6. NASA notification of procurement action
const npaNotification: TemplateDef = {
  key: "npa-notification",
  name: "NASA Notification of Procurement Action",
  tab: "70",
  layout: "memo",
  badge: {
    citation: "FAR 5.3; FAR 5.302; NFS CG 1805.3; NFS CG 1805.302",
    tier: "guidance",
    revision: "HQ 03/2026 revision",
    effective: "2026-08-14",
    note: "For actions $7M to $30M. Effective 23 March 2026, actions of $30M and above, or deemed significant interest, are announced through the ANOSCA application.",
  },
  lead: "Notification of a procurement action, marked Controlled Unclassified Information.",
  sections: [
    {
      id: "heading",
      title: "NASA Notification of Procurement Action",
      citation: "NFS CG 1805.3",
      tier: "guidance",
      fields: [
        S("variant", "Notification route", [
          "NASA Notification of Procurement Action, for Actions $7M to $30M",
          "Administrator Notification of a Significant Contract Action (ANOSCA), for actions $30M and above",
        ]),
        S("phase_marked", "Mark the applicable item:", [
          "Pre-Award Phase: RFI or Sources Sought",
          "Pre-Award Phase: Industry Day Notice",
          "Pre-Award Phase: Synopsis/DRP/RFP Release",
          "Pre-Award Phase: Other Special Notice",
          "Award Phase: Public Announcement (PA)",
          "Award Phase: Administrator Notification of a Significant Contract Action (ANOSCA)",
          "Other: Action of Significant Interest",
        ]),
        X("short_title", "1. Short Title of Action:", "title"),
        S("scope", "1a. Contract scope", ["Multiple Center use contract", "Agency-wide contract", "Center specific contract"], "Center specific contract"),
        X("centers", "1a. Identify applicable centers:", "center_code"),
        S("set_aside", "1b. Small Business Set-Aside:", ["Yes", "No"], "No"),
        S("award_action", "1c. Type of Award Action", ["New Award", "Modification or order on existing contract"], "New Award"),
        { key: "proposal_expiration", label: "1c. Proposal expiration date, for a new award", kind: "date" },
        { key: "source_selection_signed", label: "1c. Date the Source Selection Statement was signed", kind: "date" },
        S("follow_on", "1d. Is this or will this be a follow-on award:", ["Yes", "No"], "No"),
        T("follow_on_detail", "1d. Incumbent, contract number, contract expiration date and current annual burn rate"),
      ],
    },
    {
      id: "description",
      title: "2. Description",
      citation: "FAR 5.302",
      tier: "binding",
      fields: [
        { key: "detailed_description", label: "2a. Detailed Description of Action:", kind: "textarea", bind: "description_of_requirement" },
        T("mission_need", "2b. Mission Need/Impact:"),
        T(
          "administrator_analysis",
          "2c. Analysis for the Administrator:",
          "Address why the requirement is needed, how it compares in priority with other procurements, and whether the capability should be held in-house.",
        ),
      ],
    },
    {
      id: "action_detail",
      title: "3–12. Action detail",
      citation: "NFS CG 1805.302",
      tier: "guidance",
      fields: [
        T("awardee", "3. Name and Full Address of Awardee (if applicable):"),
        T("value_table", "4. Contract Value/Planned Value, by CLIN:"),
        X("contract_type", "5. Contract Type:", "contract_type"),
        T("flexibilities", "6. Description of contract flexibilities and any unique attributes:"),
        X("place", "7. Place of Performance:", "place_of_performance"),
        X("awardee_poc", "8. Awardee's Point of Contact:"),
        T("subcontractors", "9. Significant Subcontractors & Addresses (if applicable):"),
        X("official_in_charge", "10. Official in Charge (Mission Directorate or funding organization):"),
        X("contracting_officer", "11. Contracting Officer (Name and Email):", "co_name"),
        X("center_director", "12. Affected Center Director and/or Deputy Center Director Notified: Name"),
        { key: "center_director_date", label: "12. Date notified", kind: "date" },
      ],
    },
  ],
};

// ------------------------------------------------ 7. Subcontracting plan waiver
const subcontractingPlanWaiver: TemplateDef = {
  key: "subcontracting-plan-waiver",
  name: "Determination to Waive the Requirement for a Subcontracting Plan When No Subcontracting Possibilities Exist",
  tab: "067",
  layout: "dandf",
  badge: {
    citation: "FAR 19.705-2(b); FAR 19.705-2(c); NFS 1819.705-2",
    tier: "binding",
    revision: "HQ 08/2024 revision",
    effective: "2026-05-01",
    note: "Approval authority is the head of the contracting activity.",
  },
  lead: "Determination that a subcontracting plan is not required because no subcontracting possibilities exist.",
  sections: [
    centreHeading(
      ["DETERMINATION", "Waiver of the Requirement for a Subcontracting Plan When it is Determined that No Subcontracting Possibilities Exist"],
      "FAR 19.705-2(b)",
    ),
    {
      id: "action",
      title: "A description of the action:",
      citation: "FAR 19.705-2",
      tier: "binding",
      fields: [
        X("contractor", "Name of the contractor", "vendor_legal_name"),
        X("action_title", "Title of the procurement action", "title"),
        { key: "action_description", label: "What is being acquired", kind: "textarea", bind: "description_of_requirement" },
      ],
    },
    {
      id: "citation",
      title: "Citation of the appropriate statue and/or regulation upon which the determination is based: FAR 19.705-2(b)",
      citation: "FAR 19.705-2(b)",
      tier: "binding",
      fields: [],
    },
    {
      id: "circumstances",
      title: "Circumstances, facts or reasonings essential to support the determination:",
      citation: "FAR 19.705-2(b)",
      tier: "binding",
      fields: [T("circumstances", "Detailed rationale specific to this procurement as to why no subcontracting possibilities exist")],
    },
    {
      id: "factors",
      title: "In accordance with FAR 19.705-2 (b), the contracting officer shall also consider the following factors:",
      citation: "FAR 19.705-2(b)",
      tier: "binding",
      fields: [
        T(
          "factor_1",
          "1. Did the contractor engage in the business of furnishing the types of items to be acquired customarily for performance of part of the work or maintain sufficient in-house capability to perform the work?",
        ),
        T("factor_2", "2. Are there likely to be product prequalification requirements? Explain."),
        T(
          "factor_3",
          "3. Can the firm acquire any portion of the work with minimal or no disruption to performance (without consideration given to the time remaining until contract completion), and at fair market value, when a determination is made in accordance with FAR 19.705-2(a)(2)?",
          "Address this factor where the action is a modification that could increase the contract value above the FAR 19.702(a) threshold.",
        ),
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 19.705-2(c)",
      tier: "binding",
      standingText:
        "Based on the rationale described above, it is determined pursuant to FAR 19.705-2(c), the pending contract named below should be awarded without a subcontracting plan because it has been determined that no subcontracting possibilities exist.",
      fields: [{ key: "determined_on", label: "Date", kind: "date" }],
    },
    signaturePage(
      "DETERMINATION FOR AUTHORITY TO WAIVE REQUIREMENT FOR A SUBCONTRACTING PLAN WHEN IT IS DETERMINED THAT NO SUBCONTRACTING POSSIBILITIES EXIST",
      [CO_BLOCK, { label: "Small Business Specialist (SBS)" }, { label: "Approval: Head of Contracting Activity" }],
      "FAR 19.705-2(c)",
      "APPROVAL:",
    ),
  ],
};

// ------------------------------------------------ 8. OCI determination memorandum and checklist
const OCI_PLAN_ITEMS = [
  "Plan demonstrates a basic understanding of OCI principles, the types of OCI and the harm they cause, references FAR 9.5 and addresses the three primary types.",
  "Plan defines company roles and responsibilities for monitoring OCIs during performance.",
  "Plan describes how employees are notified of the Plan's requirements.",
  "Plan explains how the contractor documents employee notification, entrance, refresher and exit training, and includes a training certification template.",
  "Plan describes reporting of breaches to the contracting officer.",
  "Plan describes corrective action processes after a breach, with the contracting officer approving the final resolution.",
  "Plan identifies affiliated companies and entities and the coordination procedures with them.",
  "Plan sets a process for reporting all potential and actual OCIs, with reports describing the conflict, the resolution plan and the benefits and risks.",
  "Plan flows the requirements down to subcontractors.",
  "Plan sets organizational and employee sanctions.",
  "Where award will create an OCI, the Plan incorporates a measure that fully resolves it.",
  "Where no OCI is identified, the Plan contains a clear assertion that none exist.",
  "Plan states how updates are submitted for contracting officer approval and that they are not effective until incorporated.",
  "Plan provides for periodic self-audits with records available on request.",
  "Plan demonstrates understanding of the definition of sensitive information in NFS 1852.237-72.",
  "Plan sets OCI training requirements and includes a copy of the certification form.",
  "Plan limits access to sensitive information to employees who need it.",
  "Plan firewalls employees holding sensitive information from proposal teams.",
  "Plan safeguards sensitive information from persons outside the company.",
  "Plan requires written affirmation from each employee regarding training.",
  "Plan requires non-disclosure agreements.",
  "Plan requires OCI-related records to be maintained and available.",
  "Plan includes a list of employees with access to sensitive information.",
];

const ociDetermination: TemplateDef = {
  key: "oci-determination",
  name: "OCI Determination Memorandum and Checklist Template",
  tab: "018",
  layout: "memo",
  badge: {
    citation: "FAR Subpart 9.5; NFS Subpart 1809.5; NFS 1852.237-72",
    tier: "binding",
    revision: "HQ 05/2021 issuance",
    effective: "2026-05-01",
    note: "Controlled Unclassified Information: file behind an SF 901 cover sheet.",
  },
  lead: "Memorandum recording the contracting officer's assessment of organizational conflicts of interest.",
  sections: [
    {
      id: "heading",
      title: "OCI Determination Memorandum and Checklist",
      citation: "FAR 9.504",
      tier: "binding",
      standingText:
        "This Memorandum documents my assessment of Organizational Conflicts of Interest (OCI) arising from award of the contract named below to the contractor named below.",
      fields: [
        X("contract_name", "Contract name", "title"),
        X("contractor", "Contractor's name", "vendor_legal_name"),
        { key: "prepared_on", label: "Date", kind: "date" },
      ],
    },
    {
      id: "section_1",
      title: "SECTION 1: BACKGROUND",
      citation: "FAR 9.504",
      tier: "binding",
      fields: [
        X("solicitation_number", "Solicitation Number:", "acquisition_id"),
        T("subcontractors", "List of all proposed subcontractors:"),
        {
          key: "services_description",
          label: "Description of services or supplies to be provided:",
          kind: "textarea",
          bind: "description_of_requirement",
        },
        S("proposal_instruction", "Does the solicitation contain any proposal instruction relating to OCI?", ["Yes", "No"], "No"),
        S("clause_209_71", "Does the contract contain NFS clause 1852.209-71 Limitation of Future Contracting?", ["Yes", "No"], "No"),
        S("clause_237_72", "Does the contract contain NFS 1852.237-72 Access to Sensitive Information or NFS 1852.237-73 Release of Sensitive Information?", ["Yes", "No"], "No"),
        S("other_clauses", "Does the contract contain any other clauses pertaining to OCIs?", ["Yes", "No"], "No"),
      ],
    },
    {
      id: "section_2",
      title: "SECTION 2: ANALYSIS OF POTENTIAL OCI ARISING FROM PERFORMANCE OF THIS CONTRACT",
      citation: "FAR 9.505",
      tier: "binding",
      fields: [
        S("q1_biased", "1. [Biased Ground Rules OCI] Does the anticipated contract require the drafting or generation of specifications or requirements?", ["No", "Yes"], "No"),
        S("q2_objectivity", "2. [Impaired Objectivity OCI] Does the anticipated contract include the evaluation, review, or assessment of services, supplies or other deliverables provided on another Government contract?", ["No", "Yes"], "No"),
        S("q3_access", "3. [Unequal Access to Information OCI] Will the contractor be able to access sensitive non-public information that could benefit the contractor in a separate Government procurement competition?", ["No", "Yes"], "No"),
        S("result", "Result statement", [
          "No conflict: all three answers are No.",
          "Only Question 2 is Yes.",
          "One or more answers are Yes and the conflict is addressed in the table below.",
        ], "No conflict: all three answers are No."),
        T("existing_contracts", "Name of the existing contract(s), where Question 2 is Yes"),
        T(
          "conflict_table",
          "Type of conflict, contract and underlying work creating it, avoidance, neutralization and mitigation measures, whether the conflict has been fully addressed and any additional action needed",
        ),
      ],
    },
    {
      id: "section_2_statements",
      title: "SECTION 2: Determination statement",
      citation: "FAR 9.505",
      tier: "binding",
      standingText:
        "I have thoroughly and independently reviewed the SOW (or equivalent) and determined that the nature of work to be performed under the anticipated contract does not give rise to a potential or actual OCI in the form of conflicting roles (i.e. biased ground rules or impaired objectivity) or an unfair competitive advantage. In particular, I have concluded that the anticipated contract does not require the drafting or generation of specifications or requirements. I have further concluded that this contract does not require the evaluation, review, or assessment of services, supplies, or other deliverables provided on a separate Government contract. Last, I have concluded that the contract does not involve access to non-public information, whether Government-generated or is proprietary information to a third party.",
      fields: [],
      showIf: (v: Values) => v["result"] === "No conflict: all three answers are No.",
    },
    {
      id: "section_3",
      title:
        "SECTION 3: ANALYSIS OF WHETHER THE CONTRACTOR GAINED A COMPETITIVE ADVANTAGE IN THIS ACQUISITION THROUGH ITS PERFORMANCE OF OTHER CONTRACTS",
      citation: "FAR 9.505-2(a)(3)",
      tier: "binding",
      fields: [
        S("advantage", "Lead statement", [
          "The contractor does not have an unfair competitive advantage in this acquisition arising from its performance of other contracts.",
          "The contractor has an unfair competitive advantage in this acquisition arising from its performance of other contracts.",
        ], "The contractor does not have an unfair competitive advantage in this acquisition arising from its performance of other contracts."),
        T("sources_consulted", "Government sources of information reviewed"),
        T(
          "contracts_table",
          "Prime contractor, contract number and title, prime or subcontractor, access to sensitive and competitively useful information, firewall under the existing OCI plan, other mitigation and whether the conflict is resolved",
        ),
      ],
    },
    {
      id: "section_3_statement",
      title: "SECTION 3: No advantage statement",
      citation: "FAR 9.505-2(a)(3)",
      tier: "binding",
      standingText:
        "Specifically, I have found the Contractor did not draft a requirement or specification to be performed under this contract. In addition, the evaluation was performed using civil service personnel only and the Contractor did not evaluate its own proposal. Last, in performing other contracts, the contractor did not have access to source selection information or proprietary data that could have provided it an unfair advantage in this competition.",
      fields: [],
      showIf: (v: Values) =>
        v["advantage"] ===
        "The contractor does not have an unfair competitive advantage in this acquisition arising from its performance of other contracts.",
    },
    {
      id: "section_4",
      title: "SECTION 4: REVIEW OF OCI PLAN AND COMPLIANCE WITH NFS 1852.237-72",
      citation: "NFS 1852.237-72",
      tier: "binding",
      standingText:
        "Unless otherwise noted above, I have determined contractor's OCI Plan is sufficient and compliant with NFS clause 1852.237-72, Access to Sensitive Information.",
      fields: OCI_PLAN_ITEMS.map((label, i) => ({
        key: `plan_${i + 1}`,
        label: `${i + 1}. ${label}`,
        kind: "select" as const,
        options: ["Yes", "No", "N/A"],
        default: "Yes",
      })),
    },
    {
      id: "section_4_comments",
      title: "SECTION 4: Comments",
      citation: "NFS 1852.237-72",
      tier: "binding",
      fields: [T("plan_comments", "Comments and page numbers in the OCI plan")],
    },
    {
      id: "section_5",
      title: "SECTION 5: CONCLUSION",
      citation: "FAR Subpart 9.5",
      tier: "binding",
      standingText: "I have determined that the contractor named below is eligible or not eligible for award of the contract named below.",
      fields: [
        S("eligibility", "Eligibility", ["eligible", "not eligible"], "eligible"),
        X("sig_co", "Contracting Officer", "co_name"),
      ],
    },
  ],
};

// ------------------------------------------------ 9. Limitation of future contracting memorandum
const limitationFutureContracting: TemplateDef = {
  key: "limitation-future-contracting",
  name: "Organizational Conflicts of Interest – Limitation of Future Contracting Memo",
  tab: "18",
  layout: "memo",
  badge: {
    citation: "FAR 9.504; FAR 9.506(b); NFS 1852.209-71; NFS 1852.237-72",
    tier: "guidance",
    revision: "HQ 07/2022 revision",
    effective: "2026-05-01",
    note: "Requests approval to include NFS clause 1852.209-71 in the solicitation.",
  },
  lead: "Memorandum analysing potential organizational conflicts of interest and proposing the limitation of future contracting clause.",
  sections: [
    {
      id: "memo_header",
      title: "Memorandum",
      citation: "FAR 9.506(b)",
      tier: "binding",
      standingText:
        "SUBJECT: Analysis of Potential Organizational Conflicts of Interest and Request for Approval to Include NASA Federal Acquisition Regulation (FAR) Supplement (NFS) Clause 1852.209-71, Limitation of Future Contracting, in the Solicitation\n\n" +
        "FAR 9.504 requires that Contracting Officers (COs) analyze as early in the procurement process as possible, all planned acquisitions to identify and evaluate potential organizational conflicts of interest (OCIs) and develop necessary solicitation provisions and contract clauses to avoid, neutralize, or mitigate any significant OCIs. Based on the CO's analysis, this acquisition involves significant potential OCIs. In accordance with FAR 9.506(b), this memorandum documents the analysis and provides a recommended course of action for avoiding, neutralizing, or mitigating the OCIs by using NFS clause 1852.209-71, Limitation of Future Contracting, as well as NFS clause 1852.237-72, Access to Sensitive Information. The bases of the analysis contained herein includes the advice of counsel and collective assistance from technical and requirements personnel assigned to this acquisition.",
      fields: [
        { key: "memo_date", label: "Date signed", kind: "date" },
        X("org_identifier", "Organizational identifier", "requester_org_code"),
        S("addressee", "TO:", ["Procurement Officer", "NASA Senior Procurement Executive"], "Procurement Officer"),
        X("solicitation_number", "Solicitation number", "acquisition_id"),
        X("acquisition_name", "Acquisition name and acronym", "title"),
        S("instrument", "Instrument", ["contract", "task order", "GSA FSS order", "GSA FSS BPA"], "contract"),
      ],
    },
    {
      id: "background",
      title: "Background",
      citation: "FAR 9.504",
      tier: "binding",
      fields: [
        X("technical_office", "Name and acronym of the technical requiring office", "requester_org_code"),
        T("technical_mission", "The technical office's mission, functions and responsibilities as they relate to this acquisition"),
        { key: "technical_scope", label: "Technical scope of this acquisition", kind: "textarea", bind: "description_of_requirement" },
        T("anticipated_award", "The anticipated contract, order or BPA: solicitation month and year, single or multiple award, contract type, ordering values and periods, and options"),
      ],
    },
    {
      id: "oci_paragraphs",
      title: "Potential organizational conflicts of interest",
      citation: "FAR 9.505",
      tier: "binding",
      fields: [
        T("biased_ground_rules", "1. Biased Ground Rules."),
        T("unequal_access", "2. Unequal Access to Information."),
        T("impaired_objectivity", "3. Impaired Objectivity."),
      ],
    },
    {
      id: "proposed_actions",
      title: "Proposed actions",
      citation: "NFS 1852.237-72",
      tier: "binding",
      standingText:
        "In order to avoid, neutralize, or mitigate the potential OCIs described above, I propose the following actions:",
      fields: [
        T("action_1", "1. NFS 1852.237-72, Access to Sensitive Information, and the OCI plan"),
        T("action_2", "2. NFS clause 1852.209-71, Limitation of Future Contracting"),
      ],
    },
    {
      id: "clause",
      title: "1852.209-71 LIMITATION OF FUTURE CONTRACTING (DECEMBER 1988)",
      citation: "NFS 1852.209-71",
      tier: "binding",
      standingText:
        "(a) The Contracting Officer has determined that this acquisition may give rise to potential organizational conflicts of interest. Accordingly, the attention of prospective offerors is invited to FAR Subpart 9.5--Organizational Conflicts of Interest.\n" +
        "(b) The nature of these conflicts are that in performing this contract, there are situations where the services performed may give rise to the significant potential organizational conflicts of interest listed below.\n" +
        "(c) The restrictions upon future contracting are as follows:\n" +
        "(End of clause)",
      fields: [
        T("clause_b", "(b) The significant potential conflicts, restated"),
        T("clause_c", "(c) The restrictions upon future contracting"),
      ],
    },
    {
      id: "recommendation",
      title: "Recommendation",
      citation: "FAR 9.506(b)",
      tier: "binding",
      standingText:
        "Based on the scope of this acquisition, it is in NASA's best interest to include the aforementioned clauses and provisions in the solicitation and require the submission of an OCI Avoidance Plan. Accordingly, approval to include NFS clause 1852.209-71, Limitation of Future Contracting, in the solicitation is hereby recommended. The Contracting Officer has determined that the steps described above represent adequate controls to avoid, neutralize, or mitigate the occurrence of OCIs in the conduct of the subject acquisition.",
      fields: [],
    },
    signaturePage(
      "ORGANIZATIONAL CONFLICTS OF INTEREST LIMITATION OF FUTURE CONTRACTING MEMORANDUM",
      [
        CO_BLOCK,
        { label: "Concurrence: Procurement Officer" },
        { label: "Office of the General Counsel at Headquarters", note: "Include only where Headquarters retains source selection authority." },
        { label: "Approval: Senior Procurement Executive", note: "Include only where Headquarters retains source selection authority." },
      ],
      "FAR 9.506(b)",
      "CONCURRENCE / APPROVAL:",
    ),
  ],
};

// ------------------------------------------------ 10. D&F authority to exclude a source
const EXCLUSION_CITATIONS = [
  "FAR 6.102-1(a)(1)",
  "FAR 6.102-1(a)(2)",
  "FAR 6.102-1(a)(3)",
  "FAR 6.102-1(a)(4)",
  "FAR 6.102-1(a)(5)",
  "FAR 6.102-1(a)(6)",
];


const excludeSourceDandf: TemplateDef = {
  key: "exclude-source-dandf",
  name: "Determination and Findings Authority to Exclude a Source",
  tab: "021",
  layout: "dandf",
  badge: {
    citation: "FAR 6.102; FAR 6.102-1(a); NFS CG 1806.11; 10 U.S.C. 3203(a)(1)",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2026-04-27",
    note: "Approval authority under NFS CG 1806.11(b) is the Senior Procurement Executive.",

  },
  lead: "Determination and findings that a source may be excluded from full and open competition.",
  sections: [
    centreHeading(["DETERMINATION AND FINDINGS", "Authority to Exclude a Source"], "FAR 6.102", [
      X("excluded_source", "Name of source to be excluded"),
    ]),
    {
      id: "authority",
      title: "Authority",
      citation: "10 U.S.C. 3203(a)(1)",
      tier: "binding",
      standingText:
        "On the basis of the following findings and determination, which I make under the authority of 10 U.S.C. 3203(a)(1), the proposed contract action described below may be awarded using full and open competition after exclusion of the source named above.",
      fields: [],
    },
    {
      id: "findings",
      title: "Findings",
      citation: "FAR 6.102-1(a)",
      tier: "binding",
      standingText:
        "Pursuant to the requirements of FAR 6.102(a), it is proposed that this requirement be acquired using full and open competition after exclusion of the source based on the citation selected below and the following:",
      fields: [
        S("exclusion_citation", "Citation", EXCLUSION_CITATIONS, "FAR 6.102-1(a)(1)"),
        T("citation_statement", "The statement that matches the citation selected"),
        T("finding_1", "1. A brief description of the requirement, including the acquisition history of the supplies or services, sources, quantities, prices, and dates of award"),
        T("finding_2", "2. The circumstances for excluding the source"),
        S("finding_3", "3. Exclusion", ["Total exclusion", "Partial exclusion"], "Total exclusion"),
        T("finding_4", "4. The potential effect on the excluded source"),
        T(
          "finding_5",
          "5. The benefit to the Government",
          "Where FAR 6.102-1(a)(1) is cited, give the estimated reduction in overall costs and how it was derived. Where FAR 6.102-1(a)(2) is cited, address current annual and mobilization requirements, production capacity, and the hazards of relying on the present source. Where FAR 6.102-1(a)(3) through (6) is cited, give details on how excluding the source serves the purpose cited.",
        ),
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 6.102-1(a)",
      tier: "binding",
      standingText:
        "Based on the findings identified and explained above in accordance with the citation selected above, the determination has been made to exclude the company named below.",
      fields: [
        X("excluded_company", "Company name"),
        { key: "determined_on", label: "Date", kind: "date" },
      ],
    },
    signaturePage(
      "DETERMINATION AND FINDINGS FOR AUTHORITY TO EXCLUDE A SOURCE",
      [
        CO_BLOCK,
        { label: "CONCURRENCES: Office of the General Counsel at the Center", note: LEGAL_CONCURRENCE },
        PO_BLOCK,
        HQ_OGC_BLOCK,
        { label: "Approval: Senior Procurement Executive" },
      ],
      "NFS CG 1806.11(b)",
    ),

  ],
};

// ------------------------------------------------ 11. Limited sources justification
const PCD_14_01 =
  "Supplies offered on the schedule are listed at fixed prices. Services offered on the schedule are priced either at hourly rates, or at a fixed price for performance of a specific task (e.g., installation, maintenance, and repair). GSA has determined the prices of supplies and fixed-price services and rates for services offered at hourly rates to be fair and reasonable for the purpose of establishing the schedule contract. GSA's determination does not relieve the ordering activity contracting officer from the responsibility of making a determination of fair and reasonable pricing for individual orders, BPAs, and orders under BPAs, using the proposal analysis techniques at FAR 15.404-1. The complexity and circumstances of each acquisition should determine the level of detail of the analysis required.";

const limitedSourcesJustification: TemplateDef = {
  key: "limited-sources-justification",
  name: "Limited Sources Justification (LSJ) GSA Federal Supply Schedule (FSS)",
  tab: "016",
  layout: "memo",
  badge: {
    citation: "FAR 8.401(b); GSAM 538.7104-3; GSAM 538.7104-4; FAR 8.404(d) (DEVIATION) (NASA PCD 14-01)",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2026-04-16",
    note: "Approval tier follows the estimated value of the order or BPA.",
  },
  lead: "Justification for limiting sources on a GSA Federal Supply Schedule order or blanket purchase agreement above the simplified acquisition threshold.",
  sections: [
    centreHeading(["LIMITED-SOURCES JUSTIFICATION"], "FAR 8.401(b)", [
      X("buying_location", "Buying location", "center_code"),
    ]),
    {
      id: "introduction",
      title: "Introduction",
      citation: "FAR 8.401(b); GSAM 538.7104-3(b)",
      tier: "binding",
      standingText:
        "This is a Limited-Sources Justification (LSJ) prepared by the National Aeronautics and Space Administration (NASA). This acquisition will be conducted under the Multiple Awards Schedule (MAS) Program (Title 41 U.S.C. 152(3)).",
      fields: [
        T("action_description", "The action type, the anticipated order or BPA type, and the supplies or services required to meet the agency's need"),
        X("contractors", "Contractor(s) the award is anticipated to be made to", "vendor_legal_name"),
        X("fss_details", "GSA FSS number, FSS title, Special Item Number (SIN) and SIN title"),
        M("estimated_price", "Total estimated price or ceiling amount", "estimated_value"),
        X("period", "Period of performance or lead-time for delivery, including options"),
      ],
    },
    {
      id: "authority",
      title: "Authority Cited and Rationale:",
      citation: "FAR 8.401(b); GSAM 538.7104-3(b)",
      tier: "binding",
      standingText:
        "The statutory exception supporting the placement of this order or BPA that exceeds the simplified acquisition threshold on a sole source basis is:",
      fields: [
        S("authority", "Authority", [
          "FAR 8.401(b)/GSAM 538.7104-3(b)(i). The need is of such unusual urgency that following normal procedures would result in unacceptable delays in fulfilling the need.",
          "FAR 8.401(b)/GSAM 538.7104-3(b)(ii). Only one source is capable of providing the products, services, or solution required at the level of quality required because the products, services, or solutions are unique or highly specialized.",
          "FAR 8.401(b)/GSAM 538.7104-3(b)(iii). The order should be issued on a sole source basis in the interest of economy and efficiency because it is a logical follow-on to an FSS order already issued on a competitive basis.",
          "FAR 8.401(b)/GSAM 538.7104-3(b)(iv). It is necessary to place the order with a particular FSS contractor to satisfy a minimum guarantee established in the FSS BPA.",
          "FAR 8.401(b)/GSAM 538.7104-3(b)(v). A law expressly authorizes or requires that the purchase be made from a specified source.",
          "FAR 8.401(b)/GSAM 538.7104-4(b)(1), Items peculiar to one manufacturer. The particular brand name, product, or feature is essential to NASA's requirements, and market research indicates other companies' similar products, or products lacking the particular feature, do not meet, or cannot be modified to meet, the need.",
        ]),
        X("identified_law", "Law identified", undefined),
        T("rationale", "Rationale:", "Provide sufficient detail and supporting rationale for the exception used, per GSAM 538.7104-3(b)(2)."),
      ],
    },

    {
      id: "best_value",
      title: "Price reasonableness",
      citation: "FAR 8.404(d) (DEVIATION) (NASA PCD 14-01)",
      tier: "binding",
      standingText: PCD_14_01,
      fields: [T("fair_reasonable", "How a fair and reasonable price will be determined, per FAR 15.404-1(b)(2)")],
    },
    {
      id: "certifications",
      title: "Certifications",
      citation: "GSAM 538.7104-3(b)(2)",

      tier: "binding",
      standingText:
        "Technical Representative: I certify that the supporting data presented in this justification are accurate and complete.\n" +
        "Contracting Officer: I hereby certify that this justification is accurate and complete to the best of my knowledge and belief. In addition, I hereby determine that the anticipated price(s)/pricing of the order will be fair and reasonable.",
      fields: [
        S("approval_tier", "Approval tier", [
          "At or below $900K",
          "Above $900K, but not exceeding $20M",
          "$20M or greater, but less than $150M",
          "$150M or greater",
        ]),
      ],
    },
    signaturePage(
      "LIMITED SOURCES JUSTIFICATION",
      [
        TECH_REP_BLOCK,
        CO_BLOCK,
        { label: "Competition Advocate, Center", note: "Include for tiers above $900K." },
        { label: "Procurement Officer", note: "Include for tiers of $20M or greater." },
        { label: "Head of Contracting Activity", note: "Include for tiers of $20M or greater." },
        { label: "Office of the General Counsel at Headquarters", note: "Include for $150M or greater." },
        { label: "NASA Competition Advocate", note: "Include for $150M or greater." },
        { label: "Approval: Senior Procurement Executive", note: "Include for $150M or greater." },
      ],
      "FAR 8.401(b); GSAM 538.7104-3(b)",
      "CONCURRENCES / APPROVAL:",
    ),
  ],
};

// ------------------------------------------------ 12. Determination to provide government property
const gfpDetermination: TemplateDef = {
  key: "gfp-determination",
  name: "Contracting Officer Determination to Provide Government Property",
  tab: "30",
  layout: "memo",
  badge: {
    citation: "FAR 45.102(b); NFS CG 1845.12(b); NFS CG 1845.11; FAR 45.201(a)",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2026-04-23",
    note: "Memorandum to the file; the property listing is attached.",
  },
  lead: "Determination that providing Government property is in the Government's best interest.",
  sections: [
    {
      id: "heading",
      title: "MEMORANDUM TO THE FILE",
      citation: "FAR 45.102(b)",
      tier: "binding",
      standingText: "FROM: Contracting Officer",
      fields: [
        S("solicitation_kind", "Solicitation", ["Request for Proposal (RFP)", "Request for Quotation (RFQ)"], "Request for Proposal (RFP)"),
        X("solicitation_number", "Solicitation number", "acquisition_id"),
        X("acquisition_title", "Acquisition title and acronym", "title"),
        S("property_kind", "Property provided", [
          "Installation-Accountable Government Property (IAGP)",
          "Government-Furnished Property (GFP)",
          "Both Installation-Accountable Government Property and Government-Furnished Property",
        ], "Government-Furnished Property (GFP)"),
        S("instrument", "Instrument", ["contract", "order", "Blanket Purchase Agreement (BPA)"], "contract"),
        { key: "prepared_on", label: "Date", kind: "date" },
      ],
    },
    {
      id: "scope",
      title: "Acquisition scope",
      citation: "NFS CG 1845.12(b)",
      tier: "binding",
      standingText:
        "Attached to this memorandum is a detailed listing of all IAGP or GFP that will be provided to the Contractor for performance. These listings include all of the information required by FAR 45.201(a). This IAGP or GFP listing will be included in the resultant instrument pursuant to the applicable property clauses.",
      fields: [
        {
          key: "technical_scope",
          label: "Technical scope, acquisition strategy and the make-up of the property",
          kind: "textarea",
          bind: "description_of_requirement",
        },
      ],
    },
    {
      id: "factors",
      title: "Factors at FAR 45.102(b)",
      citation: "FAR 45.102(b)",
      tier: "binding",
      fields: [
        T("factor_1", "(1) To be in the Government's best interest;"),
        T("factor_2", "(2) That the overall benefit to the acquisition significantly outweighs the increased cost of administration, including ultimate property disposal;"),
        T("factor_3", "(3) That providing the property does not substantially increase the Government's assumption of risk; and"),
        T("factor_4", "(4) That Government requirements cannot otherwise be met."),
      ],
    },
    {
      id: "factor_5",
      title: "(5) Additional factors in NFS CG 1845.11 to be considered by the CO when providing contractors Government property.",
      citation: "NFS CG 1845.11",
      tier: "binding",
      standingText:
        "I have considered the additional factors included in NFS CG 1845.11 with regard to providing Government property under this acquisition, and have determined that providing such property is in the best interest of the Government.",
      fields: [],
    },
    {
      id: "determination",
      title: "Determination:",
      citation: "FAR 45.102(b); NFS CG 1845.11",
      tier: "binding",
      standingText:
        "After considering the factors detailed at FAR 45.102(b) and NFS CG 1845.11 as described above, I hereby determine that it is in the Government's best interest to provide Government property and services to the Contractor for use under this acquisition since the benefit to the procurement outweighs the increased cost of administration, the assumption of risk (property and performance) is not substantially increased, and the Government requirements cannot otherwise be met.",
      fields: [
        X("sig_co", "Contracting Officer", "co_name"),
        S("attachments", "Attachments:", [
          "List of Government Furnished Property",
          "List of Installation-Accountable Government Property",
          "List of Installation-Accountable Government Property and List of Government Furnished Property",
        ], "List of Government Furnished Property"),
      ],
    },
  ],
};

// ------------------------------------------------ 13. UCA and letter contract justification
const ucaLetterContract: TemplateDef = {
  key: "uca-letter-contract",
  name: "UCA-Letter Contract Justification",
  tab: "028/72",
  layout: "memo",
  badge: {
    citation: "NFS CG 1843.6; FAR 16.603; NFS CG 1816.65; NFS CG 1816.66",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2026-05-14",
    note: "Approval authority is the head of the contracting activity.",
  },
  lead: "Justification and approval for issuing an undefinitized contract action or a letter contract.",
  sections: [
    {
      id: "heading",
      title: "Justification and Approval",
      citation: "NFS CG 1843.6",
      tier: "binding",
      fields: [
        S("action_kind", "Action", ["Undefinitized Contract Action (UCA)", "Letter Contract"], "Undefinitized Contract Action (UCA)"),
        X("center_name", "Center name", "center_code"),
        { key: "prepared_on", label: "Date", kind: "date" },
      ],
    },
    {
      id: "purpose",
      title: "1. Purpose:",
      citation: "NFS CG 1843.6; FAR 16.603",
      tier: "binding",
      standingText:
        "This document provides justification and request for approval to issue the action identified above. This action is in the Government's best interest because negotiating a definitive modification, contract or order is not possible in sufficient time to meet the requirement, and will provide the contractor a binding commitment so that work can start immediately.",
      fields: [
        X("contract_number", "Contract or order number, where applicable"),
        X("contractor_name", "Contractor name", "vendor_legal_name"),
        X("acquisition_name", "Acquisition name", "title"),
      ],
    },
    {
      id: "background",
      title: "2. Background:",
      citation: "NFS CG 1843.6",
      tier: "binding",
      fields: [{ key: "background", label: "Background", kind: "textarea", bind: "description_of_requirement" }],
    },
    {
      id: "impact",
      title: "3. Statement of Impact/Urgency:",
      citation: "NFS CG 1843.6",
      tier: "binding",
      standingText:
        "The contracting officer (CO) has reviewed this work under this UCA and has determined it to be within the general scope of the contract.",
      fields: [T("impact", "Impact and urgency")],
    },
    {
      id: "description",
      title: "4. Description of Action:",
      citation: "NFS CG 1843.6",
      tier: "binding",
      fields: [
        X("contractor_address", "Contractor name and address", "vendor_legal_name"),
        X("place_of_performance", "Place of performance", "place_of_performance"),
        X("action_number", "Contract, order or modification number, if applicable"),
        T("performance_period", "Performance period or delivery schedule"),
        M("igce_uca", "Independent government estimate for the work authorized", "igce_total"),
        M("igce_total_change", "Independent government estimate for the entire change or the definitized contract", "estimated_value"),
        X("definitized_type", "Contract type of the definitized contract, for a letter contract", "contract_type"),
        T("contingency", "Contingency included in the government estimate, where any"),
        M("nte_amount", "Not-to-exceed amount"),
        { key: "nte_date", label: "Date of the proposal or letter supporting the not-to-exceed amount", kind: "date" },
        T("funding_profile", "Funding profile by month: required funding and cumulative funding"),
        T("nte_clause", "Not-to-exceed clause language for the contract type"),
      ],
    },
    {
      id: "definitization",
      title: "5. Proposed Definitization Schedule",
      citation: "NFS CG 1843.21(b); NFS CG 1816.65",
      tier: "binding",
      fields: [
        T(
          "definitization_schedule",
          "Action and date for: issuance, receipt of full proposal, technical evaluation, pricing evaluation, prenegotiation plan memorandum approval, completion of negotiations and definitization, with the total time for definitization",
        ),
        S("change_order_accounting", "Change order accounting, where the UCA estimate exceeds $1M", [
          "The contract or modification will incorporate FAR clause 52.243-6 Change Order Accounting, which requires the contractor to account costs separately for the changed requirements to the degree necessary to provide the CO visibility into actual costs incurred pending definitization.",
          "This modification will direct the contractor to segregate costs in accordance with the Change Order Accounting clause (FAR 52.243-6).",
          "The CO has waived the requirement for the contractor that this change be separately accounted for by the contractor as such accounting procedures would not be cost effective.",
        ]),
        T("waiver_rationale", "Rationale where separate accounting is waived"),
      ],
    },
    {
      id: "determination",
      title: "6. Determination",
      citation: "NFS CG 1843.6; FAR 16.603",
      tier: "binding",
      standingText:
        "Based on the above, it is the determination of the undersigned that it is in the Government's best interest for the contractor to start work immediately, and that negotiating a definitive contract action is not possible in sufficient time to meet the requirements. Upon approval, NASA will authorize the contractor to begin incurring costs for urgent work performed in advance of definitization at the not-to-exceed estimate amount stated above.",
      fields: [
        S("authorization", "Authorization instrument", [
          "Unilateral change order modification",
          "Bilateral change order modification",
          "Task order",
          "Delivery order",
          "Letter contract",
        ]),
        { key: "determined_on", label: "Date", kind: "date" },
      ],
    },
    signaturePage(
      "UCA OR LETTER CONTRACT JUSTIFICATION AND APPROVAL",
      [
        CO_BLOCK,
        { label: "Concurrence: Procurement Officer, Center", note: "Include this concurrence only for NOJMO, ESDMD and SOMD actions." },
        { label: "Approval: Head of Contracting Activity" },
      ],
      "NFS CG 1843.64; NFS CG 1816.66",
      "Concurrence / Approval:",
    ),
  ],
};

// ------------------------------------------------ 14. JOFOC 8(a) over $30M
const jofocCommonSignature = (pageTitle: string) =>
  signaturePage(
    pageTitle,
    [
      { label: "Technical Representative", note: "I certify that the facts presented in this justification are accurate and complete." },
      { label: "Contracting Officer", note: "I hereby certify that the above justification is complete and accurate to the best of my knowledge and belief." },
      COMP_ADVOCATE_BLOCK,
      { label: "Procurement Officer, Center" },
      { label: "Office of the General Counsel at Headquarters", note: "Include for NOJMO, ESDMD and SOMD actions requiring approval by the head of the contracting activity, and for actions exceeding $150M." },
      HCA_BLOCK,
      { ...AGENCY_COMP_ADVOCATE_BLOCK, note: `${AGENCY_COMP_ADVOCATE_BLOCK.note} Include for actions exceeding $150M.` },
      { ...SPE_BLOCK, label: "Approval: Senior Procurement Executive", note: "Include for actions exceeding $150M." },
    ],
    "FAR 6.104-2(a); NFS 1806.303-1(c)",
    "CONCURRENCES / APPROVAL:",
  );

const FAIR_AND_REASONABLE =
  "The contracting officer's signature on this document indicates that the contracting officer has determined that the anticipated cost to the government will be fair and reasonable. The contractor shall be required to submit a proposal to be evaluated and negotiated by the Government. Prior to execution of the contractual instrument, a proposal analysis will be performed. The proposal analysis will ensure that the final agreed-to price for the contract action is fair and reasonable.";

const jofoc8aOver30m: TemplateDef = {
  key: "jofoc-8a-over-30m",
  name: "JOFOC Sole Source 8(a) Award or Modification Greater than $30M",
  tab: "015",
  layout: "memo",
  badge: {
    citation: "FAR 6.104-1; FAR 19.108-7; FAR 19.208-2(a); 15 U.S.C. 637(a)",
    tier: "binding",
    revision: "HQ 05/2026 revision",
    effective: "2026-05-18",
    note: "Required for an 8(a) sole source award or modification greater than $30 million.",
  },
  lead: "Justification for an 8(a) sole source award or new work modification above $30 million.",
  sections: [
    centreHeading(
      ["8(a) >$30 MILLION", "JUSTIFICATION FOR OTHER THAN FULL AND OPEN COMPETITION (JOFOC)"],
      "FAR 6.104-1",
    ),
    {
      id: "item_1",
      title:
        "1. FAR 6.104-1(a)(3) – A description of the supplies or services required to meet the agency's needs (including the estimated value):",
      citation: "FAR 6.104-1(a)(3)",
      tier: "binding",
      fields: [
        X("contract_number", "Contract number for a modification or extension"),
        X("contractor_name", "Contractor name", "vendor_legal_name"),
        { key: "description", label: "The action requested for approval", kind: "textarea", bind: "description_of_requirement" },
        M("estimated_value", "Estimated value", "estimated_value"),
      ],
    },
    {
      id: "item_2",
      title: "2. FAR 6.104-1(a)(4) – An identification of the statutory authority permitting other than full and open competition:",
      citation: "15 U.S.C. 637(a); FAR 19.108-7; FAR 19.208-2(a)",
      tier: "binding",
      fields: [T("authority_rationale", "The reason the use of 15 U.S.C. 637(a) is appropriate, with the narrative required by FAR 19.108-7 and FAR 19.208-2(a)")],
    },
    {
      id: "item_3",
      title: "3. FAR 6.104-1(a)(7) – A determination that the anticipated cost to the Governement will be fair and reasonable:",
      citation: "FAR 6.104-1(a)(7); FAR 15.4",
      tier: "binding",
      standingText: FAIR_AND_REASONABLE,
      fields: [T("pricing", "How proposed cost, fee or pricing will be determined fair and reasonable per FAR 15.4")],
    },
    {
      id: "item_4",
      title: "4. FAR 6.104-1(b) – A determination that the use of a sole-source contract is in the best interest of the agency concerned:",
      citation: "FAR 6.104-1(b)",
      tier: "binding",
      standingText: "Use of a sole-source contract is in the best interest of the agency for the product or service described below.",
      fields: [T("best_interest", "The product or service procured and the supporting detail")],
    },
    jofocCommonSignature("JUSTIFICATION FOR OTHER THAN FULL AND OPEN COMPETITION, 8(a) >$30 MILLION"),
  ],
};

// ------------------------------------------------ 15. JOFOC unusual and compelling urgency
const jofocUrgency: TemplateDef = {
  key: "jofoc-urgency",
  name: "JOFOC Unusual and Compelling Urgency Template",
  tab: "015",
  layout: "memo",
  badge: {
    citation: "10 U.S.C. 3204(a)(2); FAR 6.103-2; FAR 6.104-1",
    tier: "binding",
    revision: "HQ 09/2026 revision",
    effective: "2026-09-03",
    note: "Replaces the standard justification where unusual and compelling urgency is the authority.",
  },
  lead: "Justification for other than full and open competition on the grounds of unusual and compelling urgency.",
  sections: [
    centreHeading(
      ["UNUSUAL AND COMPELLING URGENCY", "JUSTIFICATION FOR OTHER THAN FULL AND OPEN COMPETITION (JOFOC)"],
      "FAR 6.103-2",
    ),
    {
      id: "item_1",
      title:
        "1. FAR 6.104-1(a)(1) – Identification of the agency and the contracting activity, and specific identification of the document as a \u201cJustification for other than full and open competition.\u201d",
      citation: "FAR 6.104-1(a)(1)",
      tier: "binding",
      standingText:
        "This document is a justification for other than full and open competition prepared by the National Aeronautics and Space Administration (NASA).",
      fields: [X("buying_location", "Contracting activity", "center_code")],
    },
    {
      id: "item_2",
      title: "2. FAR 6.104-1(a)(2) – The nature and/or description of the action being approved:",
      citation: "FAR 6.104-1(a)(2)",
      tier: "binding",
      fields: [
        X("contractor_name", "Contractor name", "vendor_legal_name"),
        X("contract_number", "Contract number for a modification or extension"),
        T("action_nature", "The action being approved and the general purpose of the contract or modification"),
        T("program_background", "Program background for this action"),
      ],
    },
    {
      id: "item_3",
      title:
        "3. FAR 6.104-1(a)(3) – A description of the supplies or services required, to meet the agency's needs (including the estimated value):",
      citation: "FAR 6.104-1(a)(3)",
      tier: "binding",
      fields: [
        { key: "description", label: "The supplies or services required", kind: "textarea", bind: "description_of_requirement" },
        M("estimated_value", "Anticipated cost of this action", "estimated_value"),
      ],
    },
    {
      id: "item_4",
      title: "4. FAR 6.104-1(a)(4) – An identification of the statutory authority permitting other than full and open competition:",
      citation: "10 U.S.C. 3204(a)(2); FAR 6.103-2",
      tier: "binding",
      standingText:
        "The statutory authority permitting other than full and open competition is 10 U.S.C. 3204(a)(2), as implemented by FAR 6.103-2, Unusual and compelling urgency.",
      fields: [],
    },
    {
      id: "item_5",
      title:
        "5. FAR 6.104-1(a)(5) – A demonstration that the proposed contractor's unique qualifications or the nature of the acquisition requires use of the authority cited:",
      citation: "FAR 6.104-1(a)(5)",
      tier: "binding",
      standingText:
        "The agency's need is of such unusual and compelling urgency that the Government would be seriously injured if it is not permitted to limit the number of sources from which it solicits proposals.",
      fields: [
        { key: "urgency_arose", label: "Date the urgent need arose", kind: "date" },
        T("urgency_rationale", "The circumstances creating the urgency and the harm to the Government from delay"),
      ],
    },
    {
      id: "item_6",
      title:
        "6. FAR 6.104-1(a)(6) – A description of the efforts made to ensure that offers are solicited from as many potential sources as practicable, including whether a notice was or will be publicized as required by Subpart 5.1 and, if not, which exception under 5.101 applies:",
      citation: "FAR 6.104-1(a)(6); FAR 5.101(b)(1)",
      tier: "binding",
      standingText:
        "The contracting officer has determined in accordance with FAR 5.101(b)(1) that this action is exempt from the notice required in FAR 5.101, because unusual and compelling urgency precludes competition to the maximum extent practicable and the Government would be seriously injured if the agency complies with the publicizing and response time periods specified in FAR 5.101(d).",
      fields: [T("sources_solicited", "The efforts made to solicit offers from as many sources as practicable")],
    },
    {
      id: "item_7",
      title:
        "7. FAR 6.104-1(a)(7) – A determination by the contracting officer that the anticipated cost to the Government will be fair and reasonable:",
      citation: "FAR 6.104-1(a)(7)",
      tier: "binding",
      standingText: FAIR_AND_REASONABLE,
      fields: [T("pricing", "How proposed cost, fee or pricing will be determined fair and reasonable")],
    },
    {
      id: "item_8",
      title:
        "8. FAR 6.104-1(a)(8) – Description of the market research conducted, and the results, or a statement of the reasons market research was not conducted:",
      citation: "FAR 6.104-1(a)(8); FAR 6.103-2(b)",
      tier: "binding",
      fields: [T("market_research", "The market research conducted and its results, or the reasons it was not conducted")],
    },
    {
      id: "item_9",
      title: "9. FAR 6.104-1(a)(9) – Any other facts supporting the use of other than full and open competition:",
      citation: "FAR 6.104-1(a)(9)",
      tier: "binding",
      fields: [T("other_facts", "Other facts supporting the use of other than full and open competition")],
    },
    {
      id: "item_10",
      title: "10. FAR 6.104-1(a)(10) – A listing of the sources, if any, that expressed an interest in writing in the acquisition:",
      citation: "FAR 6.104-1(a)(10)",
      tier: "binding",
      fields: [T("interested_sources", "Sources that expressed an interest in writing, or a statement that there were none")],
    },
    {
      id: "item_11",
      title:
        "11. FAR 6.104-1(a)(11) – A statement of actions, if any, the agency may take to remove or overcome any barriers to competition before any subsequent acquisition for the supplies or services required:",
      citation: "FAR 6.104-1(a)(11)",
      tier: "binding",
      fields: [
        {
          key: "barriers",
          label: "Actions to remove or overcome barriers to competition",
          kind: "textarea",
          default:
            "The agency will continue to examine the market in the future for alternative solutions or new sources before executing any subsequent acquisitions for the same requirements.",
        },
      ],
    },
    jofocCommonSignature("JUSTIFICATION FOR OTHER THAN FULL AND OPEN COMPETITION, UNUSUAL AND COMPELLING URGENCY"),
  ],

};

// ------------------------------------------------ 16. Precontract costs approval
const precontractCostsApproval: TemplateDef = {
  key: "precontract-costs-approval",
  name: "Precontract Costs Approval Memo and Authorization Letter",
  tab: "066",
  layout: "memo",
  badge: {
    citation: "NFS CG 1831.12; FAR 31.205-32; NFS 1852.231-70",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2026-04-24",
    note: "The Procurement Officer approves the request; the authorization letter is then issued to the contractor.",
  },
  lead: "Approval memorandum and authorization letter for precontract costs.",
  sections: [
    {
      id: "memo_header",
      title: "PRECONTRACT COSTS APPROVAL REQUEST MEMORANDUM",
      citation: "NFS CG 1831.12",
      tier: "binding",
      standingText:
        "TO: Procurement Officer\nFROM: Contracting Officer\n\nThis request for precontract costs approval authority is in accordance with NASA FAR Supplement (NFS) Companion Guide (CG) 1831.12.",
      fields: [
        { key: "memo_date", label: "Date", kind: "date" },
        X("org_code", "Procurement Office code or identifier", "requester_org_code"),
        X("contract_number", "Contract number", "acquisition_id"),
        X("acquisition_description", "Brief description of the acquisition, including acronym", "title"),
        M("requested_amount", "Amount of precontract costs requested"),
        X("contractor_name", "Contractor name", "vendor_legal_name"),
        S("award_basis", "Basis of the proposed contract", [
          "Sole source, based on an approved Justification for Other Than Full and Open Competition",
          "Selection under an Announcement of Opportunity (AO) solicitation",
          "Selection under a NASA Research Announcement (NRA) solicitation",
          "Selection under a Broad Agency Announcement (BAA) solicitation",
        ]),
        X("award_basis_reference", "Justification approval date or solicitation number and title"),
      ],
    },
    {
      id: "memo_body",
      title: "Purpose and scope",
      citation: "NFS CG 1831.12",
      tier: "binding",
      fields: [
        X("contract_type", "Proposed contract type", "contract_type"),
        { key: "scope", label: "Scope of the contract and major deliverables", kind: "textarea", bind: "description_of_requirement" },
        T("work_before_award", "The work to be performed and why it must start before contract award"),
        { key: "start_date", label: "Precontract costs start date", kind: "date" },
        { key: "effective_date", label: "Anticipated contract effective date", kind: "date" },
        M("estimated_amount", "Total estimated amount of the precontract costs effort"),
        T("prior_approvals", "History of previously approved requests, where this is not the first request"),
        T("limitations", "Other limitations to be imposed on the precontract costs advance agreement, where any"),
      ],
    },
    {
      id: "memo_recommendation",
      title: "Recommendation",
      citation: "NFS CG 1831.12",
      tier: "binding",
      standingText:
        "Based on the analysis above, and the authority granted in NASA FAR Supplement (NFS) Companion Guide (CG) 1831.12, the undersigned recommends approval of the request for authorization of precontract costs. If approved, and subject to contract award, the Government will consider the precontract costs, as defined in FAR 31.205-32, in the amount stated above as allowable to the same extent that those costs would have been allowable had they been incurred after contract award. Upon approval, authorization to incur precontract costs will be provided to the contractor in writing and address all required elements in NFS CG 1831.12.",
      fields: [
        S("recommendation_basis", "Amount recommended", [
          "The current request, in the amount not to exceed the amount stated above",
          "The cumulative precontract costs, inclusive of the current requested increase and all previous authorizations",
        ], "The current request, in the amount not to exceed the amount stated above"),
        X("sig_co", "Contracting Officer", "co_name"),
        X("sig_po", "APPROVAL: Procurement Officer"),
      ],
    },
    {
      id: "letter",
      title: "Authorization letter to the contractor",
      citation: "NFS 1852.231-70; FAR 31.205-32",
      tier: "binding",
      standingText:
        "REFERENCES: (1) NFS 1852.231-70, Precontract Costs\n\n" +
        "Acceptance of this letter constitutes an advance agreement between NASA and the contractor on precontract costs. The term \"precontract costs\" is defined in Federal Acquisition Regulation (FAR) 31.205-32. If a contract is awarded, costs incurred before the effective date of the contract will be allowable to the extent that they would have been allowable if incurred after the effective date of the contract subject to the following conditions:",
      fields: [
        X("contractor_poc", "Contractor point of contact, name and mailing address"),
        X("contractor_request", "Reference to the contractor's request for precontract cost authorization, including the date requested"),
        T("award_expectation", "The anticipated award month and year, the acquisition title and description, and the proposal identification number and date"),
      ],
    },
    {
      id: "letter_conditions",
      title: "Conditions",
      citation: "NFS CG 1831.12",
      tier: "binding",
      standingText:
        "(c) The costs are allowable only to the extent they would have been if incurred after formal contract award.\n" +
        "(d) The Government shall be under no obligation to reimburse the contractor for any costs incurred if the Government is unable to award the proposed contract or the parties are unable to reach agreement on the award of the contract.\n" +
        "(e) Attachment 1 to this letter details the tasks that have been approved for commencement under this precontract cost authorization.\n" +
        "Any resulting contract shall include NFS clause 1852.231-70, Precontract Costs.",
      fields: [
        T("condition_a", "(a) The start date for incurrence of the precontract costs, which shall cease on the effective date of the contract"),
        T("condition_b", "(b) The limitation on the amount of precontract costs"),
        X("response_days", "Number of days the contractor has to sign and return the letter"),
        X("letter_contact", "Contracting officer or contract specialist name, phone number and email address", "co_name"),
      ],
    },
    {
      id: "letter_signature",
      title: "ACKNOWLEDGEMENT AND ACCEPTANCE OF THE TERMS OF THIS LETTER:",
      citation: "NFS CG 1831.12",
      tier: "binding",
      standingText: "Enclosure: Attachment 1",
      fields: [
        X("letter_sig_co", "Contracting Officer", "co_name"),
        X("ack_signer", "Signature of Person Authorized to Sign"),
        X("ack_printed_name", "Printed Name of Signer"),
        X("ack_title", "Title of Signer"),
        X("ack_contractor", "Name of Contractor", "vendor_legal_name"),
        { key: "ack_date", label: "Date", kind: "date" },
      ],
    },
  ],
};

export const HQ4_TEMPLATES: TemplateDef[] = [
  foreignContractRequest,
  dutyFreeCertificate,
  buyAmericanNonavailability,
  noncommercialRequest,
  abilityOneCoordination,
  npaNotification,
  subcontractingPlanWaiver,
  ociDetermination,
  limitationFutureContracting,
  excludeSourceDandf,
  limitedSourcesJustification,
  gfpDetermination,
  ucaLetterContract,
  jofoc8aOver30m,
  jofocUrgency,
  precontractCostsApproval,
];

export const HQ4_TEMPLATE_KEYS = HQ4_TEMPLATES.map((t) => t.key);
