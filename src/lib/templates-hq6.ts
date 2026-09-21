/**
 * HQ Office of Procurement award and administration templates (Batch 6,
 * part 1: postaward notification letters, set-aside preaward notice,
 * postaward conference report, award term determination, PEB and FDO
 * appointments, subcontract consent review, provisional cost increase).
 *
 * Headings, determination sentences, certification wording and signature
 * titles come from the HQ Word masters and the Batch 6 field map. Drafter
 * instructions, colour-coded sample wording and the document history logs
 * never print; they appear here only as field help.
 */

import type { FieldDef, SectionDef, TemplateDef, Values } from "@/lib/template-engine";
/** On a FAR 13.5 or Part 12 commercial file the notice is made under the
 *  commercial simplified procedures, not under the Part 15 negotiated rules. */
const noticeCitation = (part15: string, simplified: string) => (v: Values) => {
  const method = v["__method"] ?? "";
  if (/part\s*15|15\.\d/i.test(method) && !/13\.5|\b13\b|simplified/i.test(method)) return part15;
  return /13\.5|\b13\b|\b12\b|simplified|commercial/i.test(method) ? simplified : part15;
};

/** Three-way notice routing: Part 15 negotiated, Part 12 commercial, and
 *  simplified noncommercial. The postaward notification letters separate the
 *  last two: a commercial file notifies under RFO FAR 12.301, a simplified
 *  noncommercial file under FAR 13.301. */
const noticeCitation3 =
  (part15: string, commercial: string, simplifiedNoncommercial: string) => (v: Values) => {
    const method = v["__method"] ?? "";
    const simplified = /13\.5|\b13\b|\b12\b|simplified|commercial/i.test(method);
    if (/part\s*15|15\.\d/i.test(method) && !/13\.5|\b13\b|simplified/i.test(method)) return part15;
    if (!simplified) return part15;
    return /\b12\b|commercial/i.test(method) ? commercial : simplifiedNoncommercial;
  };


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

/** Header shared by the three notification letters. */
function letterHeader(subjectHelp: string): SectionDef {
  return {
    id: "letter_header",
    title: "Letter",
    citation: "NF 1858 letterhead",
    tier: "guidance",
    fields: [
      D("letter_date", "Date the letter is signed and sent"),
      X("org_code", "Procurement Office code or identifier", "co_code|requester_org_code"),
      T("addressee", "Offeror name and address"),
      X("solicitation_number", "Solicitation number"),
      X("acquisition_title", "Acquisition title and acronym", "title"),
      X("poc_name", "Offeror's point of contact", undefined, subjectHelp),
    ],
  };
}

/** Contracting officer contact block shared by the letters. */
const coContact: FieldDef[] = [
  X("co_name", "Contracting officer", "co_name"),
  X("co_email", "Contracting officer e-mail"),
  X("co_phone", "Contracting officer telephone"),
];

// ------------------------------------- 1. Postaward notification, successful
const postawardSuccessful: TemplateDef = {
  key: "postaward-letter-successful",
  name: "Postaward Notification Letter Successful Offeror",
  tab: "069",
  layout: "memo",
  badge: {
    citation:
      "FAR 15.207-1(a); FAR 15.301-1(a)(1); NFS CG 1815.29; NFS CG 1815.31; NFS CG 1815.32",
    citationFor: noticeCitation3(
      "FAR 15.207-1(a); FAR 15.301-1(a)(1); NFS CG 1815.29; NFS CG 1815.31; NFS CG 1815.32",
      "RFO FAR 12.301",
      "FAR 13.301",
    ),
    tier: "binding",
    revision: "HQ base issuance 09/2020, revisions 02/2025 and 04/2026",
    effective: "2026-04-01",
    note: "Sent after telephone notification, with the signed source selection statement enclosed.",
  },
  lead: "Letter notifying the successful offeror of the selection decision and the debriefing period.",
  // METHOD GATE: on a commercial simplified or FAR 13.5 file the part 15
  // debriefing period does not run, so the letter does not promise one.
  leadFor: noticeCitation(
    "Letter notifying the successful offeror of the selection decision and the debriefing period.",
    "Letter notifying the successful quoter that its quotation was accepted and an award has been made.",
  ),
  sections: [
    letterHeader("The successful offeror's point of contact, from the evaluation record."),
    {
      id: "selection",
      title: "Selection",
      citation: "FAR 15.207-1(a)",
      citationFor: noticeCitation3("FAR 15.207-1(a)", "RFO FAR 12.301", "FAR 13.301"),
      tier: "binding",
      fields: [
        X("company_name", "Successful offeror company name"),
        X("center_name", "Center or installation", "center_name"),
        X("contract_number", "Contract number", "contract_number"),
        M("award_amount", "Award amount"),
        D("effective_date", "Contract effective date"),
      ],
    },
    {
      id: "debriefing",
      title: "Debriefing",
      citation: "FAR 15.301-1(a)(1); NFS CG 1815.31",
      citationFor: noticeCitation(
        "FAR 15.301-1(a)(1); NFS CG 1815.31",
        "FAR 13.106-3(d)",
      ),
      tier: "binding",
      standingText:
        "Pursuant to FAR 15.301-1(a)(1), offerors may request a postaward debriefing in writing within three calendar days of receipt of this letter. In the event a debriefing is requested, one will be arranged upon receipt of the written request.",
      standingTextFor: noticeCitation(
        "Pursuant to FAR 15.301-1(a)(1), offerors may request a postaward debriefing in writing within three calendar days of receipt of this letter. In the event a debriefing is requested, one will be arranged upon receipt of the written request.",
        "This is a simplified acquisition; the debriefing procedures of FAR part 15 do not apply. On written request, the contracting officer will provide a brief explanation of the basis for the award decision under FAR 13.106-3(d).",
      ),
      fields: [],
    },
    {
      id: "closing",
      title: "Closing and signature",
      citation: "FAR 15.207-1(a)",
      citationFor: noticeCitation3("FAR 15.207-1(a)", "RFO FAR 12.301", "FAR 13.301"),
      tier: "binding",

      standingText:
        "NASA would like to express its appreciation for the time and effort that went into your proposal submittal and we look forward to working with you on the contract named above. For additional information, please contact the undersigned by telephone or e-mail.",
      standingTextFor: noticeCitation(
        "NASA would like to express its appreciation for the time and effort that went into your proposal submittal and we look forward to working with you on the contract named above. For additional information, please contact the undersigned by telephone or e-mail.",
        "NASA would like to express its appreciation for the time and effort that went into your quotation and we look forward to working with you on the award named above. For additional information, please contact the undersigned by telephone or e-mail.",
      ),
      fields: [
        ...coContact,
        T(
          "enclosures",
          "Enclosure(s)",
          "On a negotiated acquisition, the Source Selection Statement and any additional Center enclosures. A simplified acquisition has no source selection statement; leave this blank unless the Center encloses something with the letter.",
        ),
      ],
    },
  ],
};

// ----------------------------------- 2. Postaward notification, unsuccessful
const postawardUnsuccessful: TemplateDef = {
  key: "postaward-letter-unsuccessful",
  name: "Postaward Notification Letter Unsuccessful Offeror",
  tab: "069",
  layout: "memo",
  badge: {
    citation: "FAR 15.207-2; FAR 15.207-2(b); FAR 15.301-1; NFS CG 1815.28",
    citationFor: noticeCitation(
      "FAR 15.207-2; FAR 15.207-2(b); FAR 15.301-1; NFS CG 1815.28",
      "FAR 13.106-3(d) (notification to unsuccessful quoters)",

    ),
    tier: "binding",
    revision: "HQ base issuance 09/2020, revisions 02/2025 and 03/2026",
    effective: "2026-03-01",
    note: "One letter per unsuccessful offeror. Choose the offeror from the evaluation record; the letter fills from it.",
  },
  lead: "Letter notifying an unsuccessful offeror.",
  leadFor: noticeCitation(
    "Letter notifying an unsuccessful offeror, with the five items FAR 15.207-2(b) requires.",
    "Letter notifying an unsuccessful quoter that its quotation was not accepted (FAR 13.106-3(d)).",
  ),
  sections: [
    {
      id: "recipient",
      title: "Recipient",
      citation: "FAR 15.207-2",
      citationFor: noticeCitation("FAR 15.207-2", "FAR 13.106-3(d)"),
      tier: "binding",
      fields: [
        // Left empty so the letter opens on the first unsuccessful offeror on
        // the evaluation record. Offeror N is quoter N on that record.
        S("offeror_slot", "Which offeror this letter goes to", [
          "Offeror 1",
          "Offeror 2",
          "Offeror 3",
          "Offeror 4",
        ]),
        X("company_name", "Unsuccessful offeror company name"),
        X("offeror_uei", "Unsuccessful offeror UEI"),
        T("quotation_summary", "The quotation as evaluated", "Price quoted and the rating recorded on the evaluation of quotations."),
      ],
    },
    letterHeader("The unsuccessful offeror's point of contact."),
    {
      id: "notification",
      title: "Notification",
      citation: "FAR 15.207-2(b)",
      citationFor: noticeCitation("FAR 15.207-2(b)", "FAR 13.106-3(d)"),
      tier: "binding",
      standingText:
        "This notification is to inform the offeror named above that the National Aeronautics and Space Administration (NASA) has awarded a contract under the subject solicitation and your proposal was not selected for award. Pursuant to Federal Acquisition Regulation (FAR) 15.207-2(b), the following information is provided:",
      // On a FAR 13.5 or Part 12 commercial file the notice is made under the
      // simplified rules; the Part 15 negotiated sentence does not apply.
      standingTextFor: noticeCitation(
        "This notification is to inform the offeror named above that the National Aeronautics and Space Administration (NASA) has awarded a contract under the subject solicitation and your proposal was not selected for award. Pursuant to Federal Acquisition Regulation (FAR) 15.207-2(b), the following information is provided:",
        "This notification is to inform the quoter named above that the National Aeronautics and Space Administration (NASA) has made an award under the subject solicitation and your quotation was not selected. Pursuant to Federal Acquisition Regulation (FAR) 13.106-3(d), the following information is provided:",
      ),
      fields: [
        X("center_name", "Center or installation", "center_name"),
        X("offerors_solicited", "1. Number of offerors solicited"),
        X("proposals_received", "2. Number of proposals received"),
        T("awardees", "3. Name and address of each offeror receiving an award"),
        M("contract_value", "4. Maximum contract value including options", "estimated_value"),
        T("value_period", "4. Period of performance covered by that value"),
        T(
          "selection_rationale",
          "5. Evaluation factors considered and the selected offeror",
          "State the factors considered and the offeror selected. On a negotiated acquisition the rationale is in the enclosed source selection statement; on a simplified acquisition the price negotiation memorandum is the record.",
        ),
      ],
    },
    {
      id: "debriefing",
      title: "Debriefing and proposal disposition",
      citation: "FAR 15.301-1",
      citationFor: noticeCitation("FAR 15.301-1", "FAR 13.106-3(d)"),
      tier: "binding",
      standingText:
        "Pursuant to FAR 15.301-1, offerors may request a post award debriefing in writing within three calendar days after receipt of this letter. In the event a debriefing is requested, one will be arranged after receipt of the written request by the contracting officer. One copy of your proposal will be retained in the permanent contract file, and all remaining copies will be destroyed.",
      // Part 15 debriefing rights do not run on a simplified acquisition. The
      // quoter may ask why the quotation was not selected, under FAR 13.106-3(d).
      standingTextFor: noticeCitation(
        "Pursuant to FAR 15.301-1, offerors may request a post award debriefing in writing within three calendar days after receipt of this letter. In the event a debriefing is requested, one will be arranged after receipt of the written request by the contracting officer. One copy of your proposal will be retained in the permanent contract file, and all remaining copies will be destroyed.",
        "This is a simplified acquisition; the debriefing procedures of FAR part 15 do not apply. On written request, the contracting officer will provide a brief explanation of the basis for the award decision under FAR 13.106-3(d). One copy of your quotation will be retained in the contract file and the remaining copies destroyed.",
      ),
      fields: [],
    },
    {
      id: "closing",
      title: "Closing and signature",
      citation: "FAR 15.207-2(b)",
      citationFor: noticeCitation("FAR 15.207-2(b)", "FAR 13.106-3(d)"),
      tier: "binding",
      standingText:
        "NASA appreciates your proposal submission and encourages continued interest in future NASA acquisitions. For additional information, please contact the undersigned by telephone or e-mail. Please confirm receipt of this letter by replying to this e-mail.",
      standingTextFor: noticeCitation(
        "NASA appreciates your proposal submission and encourages continued interest in future NASA acquisitions. For additional information, please contact the undersigned by telephone or e-mail. Please confirm receipt of this letter by replying to this e-mail.",
        "NASA appreciates your quotation and encourages continued interest in future NASA acquisitions. For additional information, please contact the undersigned by telephone or e-mail. Please confirm receipt of this letter by replying to this e-mail.",
      ),
      fields: [
        ...coContact,
        T(
          "enclosures",
          "Enclosure",
          "On a negotiated acquisition, the Source Selection Statement. A simplified acquisition has none; leave this blank unless the Center encloses something with the letter.",
        ),
      ],
    },
  ],
};

// -------------------------- 3. Set-aside preaward apparent successful notice
const setAsidePreaward: TemplateDef = {
  key: "setaside-preaward-notification",
  name: "Set-Aside Preaward Apparent Successful Offeror Notification",
  tab: "069",
  layout: "memo",
  badge: {
    citation:
      "FAR 15.206-1(b)(1); FAR 19.201-2; FAR 19.201-2(d)(1); NFS CG 1815.28",
    citationFor: noticeCitation(
      "FAR 15.206-1(b)(1); FAR 19.201-2; FAR 19.201-2(d)(1); NFS CG 1815.28",
      "FAR 19.201-2; FAR 19.201-2(d)(1)",
    ),
    tier: "binding",
    revision: "HQ base issuance 01/2021, revision 04/2026",
    effective: "2026-04-01",
    note: "The preaward notice runs on a FAR Part 15 negotiated set-aside; NFS CG 1815.28 carries the NASA notification process.",
  },
  lead: "Preaward notice on a set-aside: to the apparent successful offeror, or to the unsuccessful offerors.",
  sections: [
    {
      id: "variant",
      title: "Which notice this is",
      citation: "FAR 15.206-1(b)(1)",
      tier: "binding",
      fields: [
        S(
          "notice_variant",
          "Recipient",
          ["Apparent successful offeror", "Unsuccessful offeror"],
          "Apparent successful offeror",
        ),
      ],
    },
    letterHeader("The offeror's point of contact."),
    {
      id: "opening",
      title: "Opening",
      citation: "FAR 15.206-1(b)",
      tier: "binding",
      standingText:
        "In reference to proposals submitted in response to the subject solicitation, the Government has completed evaluations and has selected an offeror.",
      fields: [],
    },
    {
      id: "successful",
      title: "Notice to the apparent successful offeror",
      citation: "FAR 15.206-1(b)(1); FAR 19.201-2",
      tier: "binding",
      showIf: (v: Values) => v["notice_variant"] !== "Unsuccessful offeror",
      standingText:
        "In accordance with Federal Acquisition Regulation (FAR) 15.206-1(b)(1), the purpose of this letter is to provide written notification that the offeror named below has been selected as the apparent successful offeror for the acquisition named above. Other offerors are being notified in accordance with FAR 19.201-2. No response to this letter is required. If there are no protests to the offeror's small business size status, the Government intends to proceed with formal contract award on or near the anticipated award date stated below.",
      fields: [
        X("selected_offeror", "Apparent successful offeror"),
        D("anticipated_award_date", "Anticipated award date", "target_award_date"),
      ],
    },
    {
      id: "unsuccessful",
      title: "Notice to the unsuccessful offerors",
      citation: "FAR 15.206-1(b)(1); FAR 19.201-2(d)(1)",
      tier: "binding",
      showIf: (v: Values) => v["notice_variant"] === "Unsuccessful offeror",
      standingText:
        "In accordance with FAR 15.206-1(b)(1), this is a notification that the apparent successful offeror for the subject solicitation is named below. The Government will not consider subsequent revisions to your proposal. In accordance with FAR 19.201-2(d)(1), a response is not required unless a basis exists to challenge the size status or small business status of the apparently successful offeror. Size status or small business status challenges must be submitted to the contracting officer in writing by the close of business of the fifth business day after receipt of this letter. If no size status or small business status challenge is received within five business days of this letter, a postaward notification will be sent with information on how to request a debriefing along with the Source Selection Statement detailing the Government's selection decision.",
      fields: [T("selected_offeror_address", "Name and address of selected offeror")],
    },
    {
      id: "closing",
      title: "Closing and signature",
      citation: "FAR 15.206-1(b)",
      tier: "binding",
      standingText: "For additional information, please contact the undersigned by telephone or e-mail.",
      fields: coContact,
    },
  ],

};

// ------------------------------------------- 4. Postaward conference report
const conferenceRow = (id: string, label: string, citation: string): FieldDef[] => [
  S(`${id}_applies`, `${label}: applicable`, ["", "Yes", "No", "N/A"]),
  T(`${id}_comments`, `${label}: comments, action items, actionee and due date`, citation),
];

const conferenceSection = (
  id: string,
  title: string,
  citation: string,
  rows: [string, string, string][],
): SectionDef => ({
  id,
  title,
  citation,
  tier: "binding",
  collapsed: true,
  fields: rows.flatMap(([rowId, label, ref]) => conferenceRow(`${id}_${rowId}`, label, ref)),
});

const postawardConference: TemplateDef = {
  key: "postaward-conference-report",
  name: "Postaward Conference Report",
  tab: "077",
  layout: "plan",
  badge: {
    citation: "FAR 42.503; FAR 42.503-1; FAR 42.503-1(a)(4); FAR 42.503-2; FAR 42.503-3; NFS Subpart 1842.5",
    tier: "binding",
    revision: "HQ base issuance 05/2021, revisions 03/2025 and 08/2025",
    effective: "2025-08-01",
    note: "This report does not apply to construction contracts; a preconstruction conference uses the Preconstruction Orientation Checklist.",
  },
  lead: "Record of the postaward conference: attendees, agenda, and the administration subjects covered.",
  sections: [
    {
      id: "header",
      title: "Postaward conference report",
      citation: "FAR 42.503",
      tier: "binding",
      fields: [
        X("contract_number", "Contract No.", "contract_number"),
        M("contract_value", "Contract value with options", "estimated_value"),
        X("contractor_name", "Contractor name", "vendor_legal_name"),
        T("contractor_address", "Contractor address"),
        X("contract_type", "Contract type", "contract_type"),
        X("place_of_performance", "Place of performance", "place_of_performance"),
        D("conference_date", "Conference date"),
        S("conducted", "Conducted", ["Face to face", "Telephone", "Other"], "Face to face"),
        X("conducted_other", "If other, describe"),
      ],
    },
    {
      id: "attendees",
      title: "Attendees",
      citation: "FAR 42.503-1",
      tier: "binding",
      fields: [
        T("government_attendees", "Government attendees: name and title, one per line"),
        T("contractor_attendees", "Contractor attendees: name and title, one per line"),
      ],
    },
    {
      id: "agenda",
      title: "Agenda",
      citation: "FAR 42.503-1",
      tier: "binding",
      fields: [T("agenda", "Agenda")],
    },
    conferenceSection("general", "Contract administration — general", "FAR 1.602", [
      ["a1", "Function and authority of Government personnel", "FAR 1.602"],
      ["a2", "Personal vs. nonpersonal services", "FAR 37.104"],
      ["a3", "Technical direction and contracting officer's representative delegations", "NFS 1801.602-2; NF 1634"],
      ["a4", "Contract administration delegations", "NFS 1842.102; NFS Subpart 1842.2; NF 1430; NF 1433"],
      ["a5", "On-site performance, access and personal identity verification", "FAR 52.204-9"],
      ["a6", "Organizational charts and phone listings", ""],
      ["a7", "Location of Government forms and routing of correspondence", ""],
      ["a8", "Exercising options", "FAR 52.217-9"],
      ["a9", "Contractor system reviews", "FAR Subpart 42.3; FAR 44.3"],
      ["a10", "Bilateral vs. unilateral modification", "FAR Subpart 43.1"],
      ["a11", "Incremental funding", "FAR 52.232-20; FAR 52.232-22"],
      ["a12", "Other", ""],
    ]),
    conferenceSection("reports", "Contract administration — reports and plans", "NFS 1852.242-73", [
      ["b1", "Standard operating procedures", ""],
      ["b2", "Phase-in / phase-out plan", "FAR 52.237-3"],
      ["b3", "Task ordering plans and procedures", "NFS 1852.216-80; FAR 52.216-32"],
      ["b4", "Scientific and technical reports", "NFS 1835.010; NFS 1852.235-73; NFS 1852.235-74"],
      ["b5", "IT security plan", "NFS 1804.470; NFS 1852.204-76"],
      ["b6", "Safety and health plan", "NFS 1852.223-70; NFS 1852.223-72; NFS 1853.223-75; FAR 52.236-13"],
      ["b7", "NASA mishap report", "NFS 1852.233-70; NF 1627"],
      ["b8", "Initial financial management report", "NFS 1852.242-73; NF 533M; NF 533Q"],
      ["b9", "Monthly financial management report", "NFS 1852.242-73; NF 533M"],
      ["b10", "Quarterly financial management report", "NFS 1852.242-73; NF 533Q"],
      ["b11", "Property reporting", "NFS 1845.71; NFS 1852.245-73; NF 1018"],
      ["b12", "New technology and patent reports", "NFS 1827.305; NFS 1852.227-70; NF 1679"],
      ["b13", "Earned value management", "NFS 1852.234-2 (Deviation)"],
      ["b14", "Award and incentive fee plans", "Award Fee or Incentive Fee Plan"],
      ["b15", "Performance evaluation boards and award fee determinations", "NFS 1816.405-275; NFS 1852.216-76"],
      ["b16", "Other", ""],
    ]),
    conferenceSection("subcontracting", "Contract administration — subcontracting", "FAR Subpart 44.2", [
      ["c1", "Prime's responsibility for administration", ""],
      ["c2", "Subcontract consent requirements", "FAR 44.201-1; FAR 52.244-2"],
      ["c3", "Consent considerations and limitations", "FAR 44.203; FAR 44.204"],
      ["c4", "Pricing data requirements", "FAR 15.404-3"],
      ["c5", "Contractor purchasing system reviews", "FAR Subpart 44.3"],
      ["c6", "Subcontracting plans and reports", "FAR Subpart 19.7; FAR 52.219-9"],
      ["c7", "Limitations on subcontracting", "FAR 52.219-14"],
      ["c8", "Clauses required to flow down to subcontracts", ""],
      ["c9", "Other", ""],
    ]),
    conferenceSection("property", "Contract administration — Government property", "NFS Subpart 1845.3", [
      ["d1", "Government-furnished and installation accountable property", "NFS 1852.245-70; NFS 1852.245-71; NFS 1852.245-76"],
      ["d2", "Responsibility for repair and servicing", ""],
      ["d3", "Other", ""],
    ]),
    {
      id: "gfi",
      title: "Contract administration — Government furnished information",
      citation: "FAR 42.503-2",
      tier: "binding",
      collapsed: true,
      fields: [T("gfi_topics", "Topics, comments and action items")],
    },
    conferenceSection("special", "Contract administration — special contract requirements", "FAR 42.503-2", [
      ["f1", "Contractor access to sensitive information", "NFS 1852.237-72"],
      ["f2", "Data rights and patent clauses", "FAR Part 27; NFS 1827.4; NFS 1852.227-14; NFS 1852.227-84"],
      ["f3", "Emergency preparedness", "NFS 1818.000-70; NFS 1852.237-70; NFS 1852.242-78"],
      ["f4", "Key personnel and facilities", "NFS 1852.235-71"],
      ["f5", "Liquidated damages", "FAR 22.302"],
      ["f6", "Government financing", "FAR Subpart 32.5; FAR Subpart 32.10; NFS Subpart 1832.5"],
      ["f7", "Overtime", ""],
      ["f8", "Denied access", "NFS 1852.242-72"],
      ["f9", "Severance pay", ""],
      ["f10", "Document availability authorization review", "NFS 1835.010"],
      ["f11", "Contractor performance assessment reporting system", "FAR Subpart 42.15"],
      ["f12", "Revisions to wage determinations or collective bargaining agreements", "FAR 22.1002"],
      ["f13", "Requirements of foreign travel", "NFS 1852.242-71; NPR 1660.1"],
      ["f14", "Submission of insurance certificates", "FAR 52.228-7; NFS Subpart 1828.3; NFS 1852.228-75"],
      ["f15", "NASA vehicle reports", "FAR 52.251-2; NPR 6200.1; NFS 1852.223-76"],
      ["f16", "Other", ""],
    ]),
    conferenceSection("payment", "Contract administration — payment", "NFS 1852.232-80", [
      ["g1", "Limitation of funds and limitation of costs", "FAR 52.232-20; FAR 52.232-22; NFS 1852.232-77"],
      ["g2", "Allowability of cost", "FAR 52.216-7"],
      ["g3", "Submission of vouchers for payment", "NFS 1852.232-80"],
      ["g4", "Determination of performance fees and deductions", "NFS 1816.405-275; NFS 1816.405-273"],
      ["g5", "Other", ""],
    ]),
    conferenceSection("interpretation", "Statement of requirements interpretation", "FAR 42.503-2", [
      ["h1", "Differences", ""],
      ["h2", "Other", ""],
    ]),
    conferenceSection("quality", "Quality assurance and engineering", "FAR Subpart 46.1", [
      ["q1", "Quality assurance system", ""],
      ["q2", "Waivers and deviations", ""],
      ["q3", "Drawing and design approval", ""],
      ["q4", "Manuals", ""],
      ["q5", "Qualification and environmental tests", ""],
      ["q6", "Inspection and acceptance", ""],
      ["q7", "Specification interpretation", ""],
      ["q8", "Value engineering", ""],
      ["q9", "Other", ""],
    ]),
    conferenceSection("security", "Security", "FAR Part 4", [
      ["s1", "Special security handling", ""],
      ["s2", "Disposition of classified material", ""],
      ["s3", "Other", ""],
    ]),
    {
      id: "other_items",
      title: "Other items",
      citation: "FAR 42.503-2",
      tier: "binding",
      fields: [T("other_items", "Other topics, comments and action items")],
    },
    {
      id: "chair",
      title: "Conference chair signature",
      citation: "FAR 42.503-1(a)(4)",
      tier: "binding",
      standingText:
        "In accordance with FAR 42.503-1(a)(4), this individual can be either a contracting officer or designated by a contracting officer.",
      fields: [X("conference_chair", "Conference chair")],
    },
  ],
};

// --------------------------------------------- 5. Award term determination
const awardTermDetermination: TemplateDef = {
  key: "award-term-determination",
  name: "Award Term Determination",
  tab: "076",
  layout: "memo",
  badge: {
    citation: "NFS 1816.405-277",
    tier: "binding",
    revision: "HQ base issuance 04/2021, revision 09/2024",
    effective: "2024-09-01",
    note: "Award term contracts are supported by an award term plan; this memorandum records the Term-Determining Official's decision.",
  },
  lead: "The Term-Determining Official's performance rating and eligibility decision for an award term period.",
  sections: [
    {
      id: "purpose",
      title: "Award Term Determination",
      citation: "NFS 1816.405-277",
      tier: "binding",
      standingText:
        "The purpose of this memorandum is to document the Term Determination Official's decision regarding the award term option period's performance rating and consideration of the contractor's eligibility for the award term option period of the contract identified below.",
      fields: [
        X("contract_number", "Contract number", "contract_number"),
        D("atb_meeting_date", "Date the Award Term Board met"),
        X("evaluation_period", "Contract period being evaluated"),
        X("recommended_rating", "Adjectival rating recommended by the Award Term Board"),
        X("recommended_score", "Score recommended by the Award Term Board"),
        T("additional_information", "Additional information pertinent to this determination"),
      ],
    },
    {
      id: "board",
      title: "Award Term Board evaluation",
      citation: "NFS 1816.405-277",
      tier: "binding",
      standingText:
        "The Award Term Board (ATB) met on the date stated above and completed its evaluation of the contractor's performance under this contract during the period being evaluated. The ATB considered the award term evaluation report, as well as other factors pertinent to the evaluation period. Based on its evaluation, the ATB has recommended the performance rating and score stated above for the contract period being evaluated.",
      fields: [],
    },
    {
      id: "determination",
      title: "DETERMINATION",
      citation: "NFS 1816.405-277",
      tier: "binding",
      standingText:
        "As Term-Determining Official, upon the information available, it is hereby determined that the contractor has earned a performance rating under the contract identified above during the above referenced period as follows:",
      fields: [],
    },
    {
      id: "rating",
      title: "PERFORMANCE RATING",
      citation: "NFS 1816.405-277",
      tier: "binding",
      fields: [
        X("determined_adjective", "Adjective"),
        X("determined_score", "Numerical score"),
        S("eligibility", "The contractor", ["has", "has not"], "has"),
        D("award_term_start", "Beginning of the award term period"),
        D("award_term_end", "End of the award term period"),
        X("tdo_name", "Term-Determining Official"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Term-Determining Official",
    citation: "NFS 1816.405-277",
    blocks: ["Term-Determining Official", "Date"],
  }),
};

// --------------------------------------------------- 6. PEB appointment memo
const pebAppointment: TemplateDef = {
  key: "peb-appointment",
  name: "Performance Evaluation Board (PEB) Appointment",
  tab: "076",
  layout: "memo",
  badge: {
    citation: "NASA Award Fee Contracting Guide, Part 3",
    tier: "guidance",
    revision: "HQ base issuance 03/2021, revision 03/2025",
    effective: "2025-03-01",
    note: "Members are identified by position and organizational title, not by individual name, so the appointment need not be reissued.",
  },
  lead: "Memorandum appointing the Performance Evaluation Board for an award fee contract.",
  sections: [
    {
      id: "memo_header",
      title: "Memorandum",
      citation: "NPR 1450.10D",
      tier: "guidance",
      fields: [
        D("memo_date", "Date"),
        X("org_code", "Reply to attn. of: sender's organizational code", "requester_org_code"),
        X("to_line", "TO"),
        X("from_line", "FROM: name and title"),
        X("contract_number", "Contract number", "contract_number"),
        X("contract_name", "Contract name", "title"),
      ],
    },
    {
      id: "appointment",
      title: "Appointment",
      citation: "NASA Award Fee Contracting Guide, Part 3",
      tier: "guidance",
      standingText:
        "You are hereby appointed to serve on the subject board for the purpose of reviewing PEB documents and recommending performance scores to the Fee-Determining Official (FDO) for the subject contract. The composition of the PEB is as follows:",
      fields: [
        X("chairperson", "Chairperson: organizational code and position title"),
        T("members", "Members: organizational code and position title, one per line"),
        T("alternate_members", "Alternate members: organizational code and position title, one per line"),
      ],
    },
    {
      id: "duties",
      title: "Evaluation and determination",
      citation: "NASA Award Fee Contracting Guide, Part 3",
      tier: "guidance",
      standingText:
        "The PEB will evaluate the contractor's performance according to the standards and criteria stated in the performance evaluation plan for the contract. The PEB's findings and recommendations are to be submitted to the FDO. The amount of award fee to be awarded to the contractor shall be computed based on performance scores determined by the FDO. The determination shall be based on facts of performance as evaluated, the recommendation of the PEB, and any other information that may be available to the FDO. The FDO will make the final determination of the Award Fee earned and payable for each evaluation period. Please refer to Part 3 of the NASA Award Fee Contracting Guide for additional information regarding the PEB organizational structure. These appointments are effective immediately and participation is mandatory.",
      fields: [X("signer_name", "Signature: name"), T("cc_list", "cc")],
    },
  ],
};

// --------------------------------------------------- 7. FDO appointment memo
const fdoAppointment: TemplateDef = {
  key: "fdo-appointment",
  name: "Fee Determining Official (FDO) Appointment",
  tab: "076",
  layout: "memo",
  badge: {
    citation: "NFS 1816.401; NFS 1816.401(e)(3)(i); NFS 1816.405-273(d)",
    tier: "binding",
    revision: "HQ base issuance 03/2021",
    effective: "2021-03-29",
    note: "The appointment is non-delegable. The same template appoints a Term Determination Official where the head of contracting activity delegates that role.",
  },
  lead: "Head of contracting activity appointment of the Fee Determining Official or Term Determination Official.",
  sections: [
    {
      id: "memo_header",
      title: "Memorandum",
      citation: "NPR 1450.10D",
      tier: "guidance",
      fields: [
        D("memo_date", "Date"),
        X("org_code", "Reply to attn. of: organizational code", "requester_org_code"),
        X("to_line", "TO: position title and name"),
        X("from_line", "FROM: position title"),
        S("official_kind", "Appointment", ["Fee Determination Official (FDO)", "Term Determination Official (TDO)"], "Fee Determination Official (FDO)"),
        X("acquisition_and_contract", "Acquisition name and contract number", "contract_number"),
      ],
    },
    {
      id: "appointment_fdo",
      title: "Appointment",
      citation: "NFS 1816.401",
      tier: "binding",
      showIf: (v: Values) => v["official_kind"] !== "Term Determination Official (TDO)",
      standingText:
        "You are hereby appointed to serve as the FDO for the acquisition and contract identified above. In accordance with the performance evaluation plan of this contract, you are to determine the contractor's performance ratings and scores for the duration of the contract or until replaced. These performance ratings and scores will be used in establishing the amount of fee to be awarded to the contractor. Your determinations must be based on the assessment of the facts and circumstances of performance as evaluated and documented in the performance evaluation board (PEB) report, the recommendations of the PEB, and any other pertinent information that may be available to you.",
      fields: [],
    },
    {
      id: "appointment_tdo",
      title: "Appointment",
      citation: "NFS 1816.401(e)(3)(i)",
      tier: "binding",
      showIf: (v: Values) => v["official_kind"] === "Term Determination Official (TDO)",
      standingText:
        "You are hereby appointed to serve as the TDO for the acquisition and contract identified above. In accordance with the award term plan of this contract, you are to determine the contractor's performance ratings and scores for the duration of the contract or until replaced. These performance ratings and scores will be used in establishing the term to be awarded to the contractor. Your determinations must be based on the assessment of the facts and circumstances of performance as evaluated and documented in the award term determination, the recommendations of the Award Term Board, and any other pertinent information that may be available to you.",
      fields: [],
    },
    {
      id: "closing",
      title: "Effect and signature",
      citation: "NFS 1816.401",
      tier: "binding",
      standingText:
        "This non delegable appointment is effective immediately and supersedes any previous FDO appointments related to this acquisition.",
      fields: [X("signer_name", "Signature: name, head of contracting activity"), T("cc_list", "cc")],
    },
  ],
};

// ------------------------------------------------ 8. Subcontract consent review
const consentItem = (n: number, question: string, citation: string): FieldDef[] => [
  S(`q${n}`, `${n}. ${question}`, ["", "Yes", "No", "N/A"]),
  T(`q${n}_basis`, `${n}. Explain basis for answer`, citation),
];

const subcontractConsent: TemplateDef = {
  key: "subcontract-consent-review",
  name: "Subcontract Consent Review",
  tab: "079",
  layout: "plan",
  badge: {
    citation: "FAR 44.201-1(b); FAR 44.202-2; FAR 44.203; FAR 52.244-2; NFS 1844.202-1",
    tier: "binding",
    revision: "HQ base issuance 12/2020",
    effective: "2020-12-10",
    note: "The contracting officer considers each item below before consenting to a subcontract.",
  },
  lead: "Review supporting consent to, or denial of, a subcontract under FAR 44.202-2.",
  sections: [
    {
      id: "header",
      title: "Subcontract consent review",
      citation: "FAR 52.244-2(d)",
      tier: "binding",
      fields: [
        X("prime_contract_number", "PRIME CONTRACT NUMBER", "contract_number"),
        X("prime_contractor", "PRIME CONTRACTOR", "vendor_legal_name"),
        T(
          "purchasing_system_status",
          "PURCHASING SYSTEM STATUS",
          "Approved or not approved. Name the agency that performed the review and the date, and any other pertinent information.",
        ),
        X("subcontract_name", "SUBCONTRACT NAME"),
        M("subcontract_value", "SUBCONTRACT VALUE"),
        X("subcontract_type", "SUBCONTRACT TYPE"),
        T(
          "subcontract_description",
          "SUBCONTRACT EFFORT DESCRIPTION",
          "Supplies or services purchased, the period of performance, and the reason for the review.",
        ),
      ],
    },
    {
      id: "instructions",
      title: "Instructions",
      citation: "FAR 44.202-2",
      tier: "binding",
      standingText:
        "Instructions: Prior to providing subcontract consent to a prime contractor, the contracting officer must consider, at a minimum, the items identified below in accordance with FAR 44.202-2. Document all technical input received and attach any additional evaluations or include other considerations provided by the government in support of this review.",
      fields: [],
    },
    {
      id: "review",
      title: "Review items",
      citation: "FAR 44.202-2",
      tier: "binding",
      fields: [
        ...consentItem(1, "Is the decision to subcontract consistent with the contractor's approved make or buy plan, if any (see FAR 15.407-2)?", "FAR 15.407-2"),
        ...consentItem(2, "Is the subcontract for special test equipment, equipment or real property that are available from Government sources (see FAR Subpart 45.3)?", "FAR Subpart 45.3"),
        ...consentItem(3, "Is the selection of the particular supplies, equipment or services technically justified?", "FAR 44.202-2"),
        ...consentItem(4, "Has the contractor complied with the prime's contract requirements regarding small business subcontracting: (i) if applicable, its plan for subcontracting with small, veteran-owned, service-disabled veteran-owned, HUBZone, small disadvantaged and women-owned small business concerns and (ii) purchase from nonprofit agencies designated by the Committee for Purchase From People Who Are Blind or Severely Disabled, 41 U.S.C. 8504 (see FAR Part 8)?", "41 U.S.C. 8504; FAR Part 8"),
        ...consentItem(5, "Was adequate price competition obtained or its absence properly justified (see FAR Subpart 6.3)?", "FAR Subpart 6.3"),
        ...consentItem(6, "Did the contractor adequately assess and dispose of subcontractors' alternate proposals, if offered?", "FAR 44.202-2"),
        ...consentItem(7, "Does the contractor have a sound basis for selecting and determining the responsibility of the particular subcontractor (see FAR 9.104-4)?", "FAR 9.104-4"),
        ...consentItem(8, "Has the contractor performed adequate cost or price analysis or price comparisons and obtained certified cost or pricing data and data other than certified cost or pricing data (see FAR Subpart 15.4)?", "FAR Subpart 15.4"),
        ...consentItem(9, "In accordance with FAR 15.404-3(c), a contractor or subcontractor is required to submit certified cost or pricing data and analyze it prior to awarding any subcontract, purchase order, or modification expected to exceed the certified cost or pricing data threshold, unless an exception in 15.403-1(b) applies to that action. Was the necessary subcontractor certified cost and pricing data submitted to the Government?", "FAR 15.404-3(c); FAR 15.403-1(b)"),
        ...consentItem(10, "Is the proposed subcontract type appropriate for the risks involved and consistent with current policy (see FAR Part 16)?", "FAR Part 16"),
        ...consentItem(11, "Has adequate consideration been obtained for any proposed subcontract that will involve the use of Government-provided equipment and real property (see FAR Subpart 45.3)?", "FAR Subpart 45.3"),
        ...consentItem(12, "Has the contractor adequately and reasonably translated prime contract technical requirements into subcontract requirements?", "FAR 44.202-2"),
        ...consentItem(13, "Does the prime contractor comply with applicable cost accounting standards for awarding the subcontract (see FAR Part 30)?", "FAR Part 30"),
        ...consentItem(14, "Is the proposed subcontractor in the System for Award Management Exclusions (see FAR Subpart 9.4)?", "FAR Subpart 9.4"),
      ],
    },
    {
      id: "decision",
      title: "Decision",
      citation: "FAR 44.202-2",
      tier: "binding",
      fields: [
        S("decision", "Decision", ["Consent granted", "Consent denied"], "Consent granted"),
        X("consent_subcontract", "Subcontract name and number"),
        M("consent_amount", "Amount"),
      ],
    },
    {
      id: "consent_text",
      title: "Consent",
      citation: "FAR 44.201-1(b)",
      tier: "binding",
      showIf: (v: Values) => v["decision"] !== "Consent denied",
      standingText:
        "Based on the above, NASA consents to the placement of the subcontract identified above in the amount stated. This consent is subject to the clauses contained in the prime contract and conditioned upon the information furnished at the time of submittal. The consent in no way relieves the prime contractor of any obligations or responsibilities it may otherwise have under the contract or under law, create neither any obligation of the Government to, nor privity of contract with the vendor, and is without prejudice to any right or claim of the Government under the prime contract. This consent does not constitute a determination as to the acceptability of the purchase order, nor should be interpreted to constitute approval of the vendor to receive proprietary and confidential information.",
      fields: [X("co_name", "Contracting officer", "co_name")],
    },
    {
      id: "denial_text",
      title: "Denial",
      citation: "FAR 44.202-2",
      tier: "binding",
      showIf: (v: Values) => v["decision"] === "Consent denied",
      standingText:
        "The contractor has not met the above criteria as required by FAR 44.202-2; as a result, consent to subcontract is not granted. The reasons for denial have been identified in the above review. The contractor has been notified of the specific concerns and is required to resubmit its request with adequate documentation to address the Government's concerns.",
      fields: [X("co_name_denial", "Contracting officer", "co_name")],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting Officer",
    citation: "FAR 44.202-2",
    blocks: ["Contracting Officer", "Date"],
  }),
};

// -------------------------------------- 9. Provisional increase in estimated cost
const provisionalIncrease: TemplateDef = {
  key: "provisional-cost-increase",
  name: "Request for Provisional Increase in the Estimated Cost",
  tab: "NA",
  layout: "plan",
  badge: {
    citation: "NFS 1832.704-71; FAR 52.232-20; FAR 52.232-22; FAR 16.603; NFS 1802.101",
    tier: "binding",
    revision: "HQ base issuance 08/2021, revisions 10/2024 and 01/2025",
    effective: "2025-01-01",
    note: "The head of contracting activity approves the provisional increase. Fee is not provisionally increased, and the action is definitized within six months.",
  },
  lead: "Request for approval of a provisional increase in the estimated cost of a cost-reimbursement contract.",
  sections: [
    {
      id: "request",
      title: "Request",
      citation: "NFS 1832.704-71",
      tier: "binding",
      fields: [
        X("contract_number", "1. Contract number", "contract_number"),
        X("modification_number", "2. Modification number"),
        X("contractor_name", "3. Contractor name", "vendor_legal_name"),
        T(
          "contract_description",
          "4. Contract description",
          "Brief description of the effort and the history of the provisional increase action, including Limitation of Funds 75 percent notifications, NF 533 cost reports and earned value management IPMDAR.",
        ),
        M("current_estimated_cost", "5. Current negotiated (definitized) estimated cost of the contract"),
        M("previous_provisional", "6. Amount of previously approved provisional estimated cost increases, if any"),
        M("requested_increase", "7. Amount of current request for provisional increase in estimated cost"),
        M("total_if_approved", "8. Total contract estimated cost if this request is approved"),
      ],
    },
    {
      id: "adjustments",
      title:
        "9. Description and estimate of expected dollar amounts for adjustments of the contract estimated cost",
      citation: "FAR 52.243",
      tier: "binding",
      standingText:
        "Do not include the cost of any work that is not contractually authorized, such as pending changes and new work.",
      fields: [
        T("adjustment_rows", "Action description and modification number, one per line"),
        M("adjustments_initial_total", "9(a) Total initial Government estimate"),
        T(
          "adjustments_current",
          "9(b) Current Government assessment of expected estimated cost adjustment and definitization date",
        ),
        M("adjustments_current_total", "9(b) Total"),
      ],
    },
    {
      id: "remarks",
      title: "Remarks/Justification",
      citation: "NFS 1832.704-71",
      tier: "binding",
      standingText:
        "The requested provisional increase will permit continued performance of the previously authorized scope of work on the contract. This contract action is within the scope of the existing contract and does not add any new scope.",
      fields: [
        M("present_total_cost", "Present total estimated cost of the contract, the sum of items 5 and 6"),
        D("expended_by", "Date by which that amount will be expended"),
        T("further_remarks", "Further remarks or justification"),
      ],
    },
    {
      id: "funds",
      title: "Available Funds",
      citation: "FAR 52.232-22",
      tier: "binding",
      fields: [
        M("current_funding", "Present total funding on this contract"),
        M("funding_added", "Additional funding to be provided"),
        S("limitation_clause", "Funding clause", ["FAR 52.232-22, Limitation of Funds", "FAR 52.232-20, Limitation of Cost"], "FAR 52.232-22, Limitation of Funds"),
        M("total_funding", "Resulting total funding"),
        D("allotment_date", "Date through which the revised funding is sufficient"),
        X("purchase_request", "Purchase request number", "pr_number"),
        M("certified_amount", "Certified funds provided"),
        T(
          "budget_statement",
          "Where the contract is incrementally funded, the written statement from the budget or resource analyst",
        ),
      ],
    },
    {
      id: "signature_page",
      title: "Signature page",
      citation: "NFS 1802.101",
      tier: "binding",
      fields: [
        X("program_identifier", "Program or project name and contract identifier", "title"),
        X("co_name", "Contracting officer", "co_name"),
        X("hca_name", "Head of contracting activity"),
        X("hca_organization", "Center name, or the mission directorate for an ESDMD or SOMD action", "center_name"),
      ],
    },
  ],
  signature: () => ({
    tierLabel: "Contracting officer and head of contracting activity",
    citation: "NFS 1832.704-71",
    blocks: ["Contracting Officer", "Date", "APPROVAL: Head of Contracting Activity", "Date"],
  }),
};

export const HQ6_TEMPLATES: TemplateDef[] = [
  postawardSuccessful,
  postawardUnsuccessful,
  setAsidePreaward,
  postawardConference,
  awardTermDetermination,
  pebAppointment,
  fdoAppointment,
  subcontractConsent,
  provisionalIncrease,
];

export const HQ6_TEMPLATE_KEYS = HQ6_TEMPLATES.map((t) => t.key);

/** Phase each Batch 6 document belongs to. */
export const HQ6_PHASES: Record<string, string> = {
  "postaward-letter-successful": "Award",
  "postaward-letter-unsuccessful": "Award",
  "setaside-preaward-notification": "Award",
  "postaward-conference-report": "Administration",
  "award-term-determination": "Administration",
  "peb-appointment": "Administration",
  "fdo-appointment": "Administration",
  "subcontract-consent-review": "Administration",
  "provisional-cost-increase": "Administration",
};
