/**
 * HQ Office of Procurement solicitation and evaluation templates (Batch 5,
 * FAR Part 15 and NFS Part 1815).
 *
 * Headings, determination, certification and appointment sentences and the
 * signature-block titles are taken verbatim from the HQ Word masters and the
 * Batch 5 field map. Drafter instructions, colour-coded sample wording and the
 * document history logs never print: they appear here only as field help.
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

const YESNO = (key: string, label: string): FieldDef => ({
  key,
  label,
  kind: "select",
  options: ["No", "Yes"],
  default: "No",
});

/** Period of performance wording shared by the DRFP and final RFP cover letters. */
const POP_CHOICES = [
  "an effective ordering period of years from the contract effective date.",
  "a total potential period of performance of years, including a Base Period and Option Periods.",
  "an effective ordering period of years from the contract effective date, and a total core potential period of performance made up of a Base Period and Option Periods.",
];

const AI_DISCLOSURE =
  "Disclosure of Artificial Intelligence (AI) Use During Contract Performance. Offerors are required to disclose any intent to propose, or plan to use Artificial Intelligence (AI) to perform contract requirements.";

const AI_TRANSPARENCY_CHOICES = [
  "The planned use of the AI system being acquired is not likely to include high-impact use cases, as defined in OMB M-25-21.",
  "The planned use of the AI system being acquired does include high-impact use cases, as defined in OMB M-25-21, or there is a reasonable likelihood for such a high-impact use case to occur during the life of the contract.",
];

const PROCUREMENT_INTEGRITY = (body: string) =>
  `The ${body} Chairperson and other members must comply with the FAR, NFS, and other legal requirements regarding personal conflicts of interest, as well as the requirements of FAR 3.104, Procurement Integrity, which prohibits the disclosure of information to individuals not also participating in the same evaluation proceedings. After receipt of proposals, all information contained in the proposals submitted for evaluation shall be protected and shall be made available only to members (voting and non-voting) of the ${body} and to properly designated committees and panels on a need-to-know basis. The right to information on a need-to-know basis does not extend to the normal chain of supervision of any member of the ${body}, nor to any individual having technical responsibility for the effort being evaluated, except as specifically approved by the ${body} Chairperson on a case-by-case basis. Individuals so designated by the ${body} Chairperson shall be notified, in writing, of the sensitive nature of proposal information.`;

function memoHeader(subjectHelp: string, extra: FieldDef[] = []): SectionDef {
  return {
    id: "memo_header",
    title: "Memorandum",
    citation: "NPR 1450.10D",
    tier: "guidance",
    fields: [
      X("org_code", "Procurement organization code or identifier", "requester_org_code"),
      X("to_line", "TO"),
      X("from_line", "FROM"),
      X("subject_line", "SUBJECT", undefined, subjectHelp),
      D("memo_date", "Date"),
      ...extra,
    ],
  };
}

// ------------------------------------------------ 1. SEB membership appointment memorandum
const sebAppointment: TemplateDef = {
  key: "seb-appointment",
  name: "Source Evaluation Board (SEB) Membership Appointment Memorandum",
  tab: "036",
  layout: "memo",
  badge: {
    citation: "FAR Subpart 15.3; FAR 15.303(b)(1); NFS Subpart 1815.3; NFS 1815.303(b)(i)(B); NFS 1815.370",
    tier: "binding",
    revision: "HQ base issuance 04/2020",
    effective: "2020-04-20",
    note: "The Procurement Official recommends the membership; the Source Selection Authority approves it.",
  },
  lead: "Memorandum recommending appointment of the Source Evaluation Board for a competitive acquisition.",
  sections: [
    memoHeader(
      "Appointment of the [acquisition name] Source Evaluation Board (SEB).",
      [X("acquisition_name", "Name of the acquisition", "title")],
    ),
    {
      id: "recommendation",
      title: "Recommendation",
      citation: "NFS 1815.303(b)(i)(B)",
      tier: "binding",
      standingText:
        "Pursuant to the NASA Federal Acquisition Regulation (FAR) Supplement (NFS) 1815.303(b)(i)(B), I hereby recommend appointment of the individuals identified below to serve as members of the SEB for the acquisition named above competitive acquisition:",
      fields: [],
    },
    {
      id: "voting_members",
      title: "Voting Members",
      citation: "NFS 1815.370",
      tier: "binding",
      fields: [
        X("chairperson", "SEB Chairperson: name, title, organization code"),
        S("procurement_member_role", "Procurement voting member role", ["Contracting Officer", "Procurement Member"], "Contracting Officer"),
        X("procurement_member", "Procurement voting member: name, organization code", "co_name"),
        T("other_voting_members", "Other voting members: name, title, organization code, organization name (one per line)"),
      ],
    },
    {
      id: "non_voting_members",
      title: "Non-Voting Members:",
      citation: "NFS 1815.370",
      tier: "binding",
      fields: [
        X("cost_price_analyst", "Cost/Price Analyst (if applicable): name, title, organization code and organization name"),
        X("past_performance_evaluator", "Past Performance Evaluator (if applicable): name, title, organization code and organization name"),
        T("other_non_voting", "Other non-voting members"),
      ],
    },
    {
      id: "consultants",
      title: "Consultants",
      citation: "NFS 1815.370",
      tier: "binding",
      fields: [
        X("technical_representative", "Technical Representative(s)", "cor_name"),
        X("small_business_representative", "Small Business Representative (if applicable)"),
        X("safety_health_representative", "Safety and Health Representative (if applicable)"),
        T("other_consultants", "Other consultants"),
      ],
    },
    {
      id: "ex_officio",
      title: "Ex-Officio Members",
      citation: "NFS 1815.303",
      tier: "binding",
      fields: [
        S(
          "ex_officio_office",
          "Headquarters ex-officio office (acquisitions over $500M or as designated by the Senior Procurement Executive)",
          [
            "",
            "Assistant Administrator for Procurement",
            "Deputy Assistant Administrator for Procurement",
            "Headquarters Office of Procurement, Procurement Strategic Operations Division",
            "Headquarters Office of Procurement, Procurement Management and Policy Division",
          ],
        ),
        T("ex_officio_members", "Ex-officio members: name, title, organization code, organization name"),
      ],
    },
    {
      id: "conduct",
      title: "Conduct of the board",
      citation: "FAR Subpart 15.3; NFS Subpart 1815.3; NFS 1815.370",
      tier: "binding",
      standingText:
        "The SEB will conduct its business in accordance with the FAR, NFS, and Center acquisition policies and procedures, as applicable. The SEB Chairperson is responsible for determining that all SEB members (voting and non-voting) are fully conversant with the instructions and requirements of FAR Subpart 15.3 and NFS Subpart 1815.3, Source Selection. The SEB Chairperson and each member are responsible for being familiar with and following the procedures outlined in NFS 1815.370, which describes the SEB designation, organization, and process, and any Center-level SEB policies on SEB membership, roles, and responsibilities. SEB membership shall take precedence over other duties of members.\n\nIt is emphasized that the SEB report and/or presentation are the principal tools available to the Source Selection Authority to perform a comparative analysis for making the final source selection decision. The findings of the SEB must be documented and presented in sufficient depth to permit intelligent weighing of alternatives. All proposals shall be evaluated and reported in accordance with the solicitation evaluation criteria, the FAR, and the NFS. The SEB's written findings will give no consideration to elements that are extraneous to the objectives of this acquisition.\n\n" +
        PROCUREMENT_INTEGRITY("SEB"),
      fields: [],
    },
    {
      id: "delegation",
      title: "Delegation of membership changes",
      citation: "NFS 1815.303(b)(i)(C)",
      tier: "binding",
      fields: [
        S("delegation", "Delegation narrative", [
          "These appointments are effective immediately, and participation is mandatory. No additions or deletions to the voting membership or any changes to non-voting members appointed herein shall be without my approval through a revised appointment letter.",
          "I hereby delegate the authority to make changes to SEB membership of non-voting members and consultants to the SEB Chairperson without re-delegation authority.",
          "I delegate any changes to the SEB membership, other than the voting members, including appointment of an extended evaluation team, to the SEB Chair without re-delegation authority.",
        ]),
        T("delegation_concurrence", "Offices or individuals that must concur in any change"),
      ],
    },
    {
      id: "signature",
      title: "Signature and approval",
      citation: "NFS 1815.303(b)(i)(B)",
      tier: "binding",
      fields: [
        X("sig_name", "Name"),
        X("sig_title", "Title"),
        X("approval_name", "APPROVAL: name"),
        { key: "approval_title", label: "APPROVAL: title", kind: "readonly", default: "Source Selection Authority" },
        T("enclosures", "Enclosure(s)"),
        T("cc", "cc", "The Office of the General Counsel and every appointed member, one per line."),
      ],
    },
  ],
};

// ------------------------------------------------ 2. SET (non-SEB) membership appointment memorandum
const setAppointment: TemplateDef = {
  key: "set-appointment",
  name: "Source Evaluation Team (non-SEB Procedures) Membership Appointment Memorandum",
  tab: "036",
  layout: "memo",
  badge: {
    citation:
      "FAR Subpart 15.3; FAR 15.303(b)(1); NFS Subpart 1815.3; NFS 1815.300-70(a)(1)(ii); NFS 1815.303(b)(i)(B)",
    tier: "binding",
    revision: "HQ base issuance 04/2020",
    effective: "2020-04-20",
    note: "Used where the Center evaluates without Source Evaluation Board procedures.",
  },
  lead: "Memorandum recommending appointment of the Center evaluation team for a competitive acquisition.",
  sections: [
    memoHeader(
      "Appointment of the [acquisition name] [Center name for the evaluation team, e.g. Source Evaluation Team (SET)].",
      [
        X("acquisition_name", "Name of the acquisition", "title"),
        X("team_name", "Center name for the non-SEB evaluation team, with acronym", undefined, "For example Source Evaluation Team (SET) or Integrated Evaluation Team (IET)."),
      ],
    ),
    {
      id: "recommendation",
      title: "Recommendation",
      citation: "NFS 1815.303(b)(i)(B)",
      tier: "binding",
      standingText:
        "Pursuant to the NASA Federal Acquisition Regulation (FAR) Supplement (NFS) 1815.303(b)(i)(B), I hereby recommend appointment of the individuals identified below to serve as members of the evaluation team named above for the acquisition named above competitive acquisition:",
      fields: [],
    },
    {
      id: "voting_members",
      title: "Voting Members",
      citation: "FAR 15.303(b)(1)",
      tier: "binding",
      fields: [
        X("chairperson", "Evaluation team Chairperson: name, title, organization code"),
        S("procurement_member_role", "Procurement voting member role", ["Contracting Officer", "Procurement Member"], "Contracting Officer"),
        X("procurement_member", "Procurement voting member: name, organization code", "co_name"),
        T("other_voting_members", "Other voting members: name, title, organization code, organization name (one per line)"),
      ],
    },
    {
      id: "non_voting_members",
      title: "Non-Voting Members:",
      citation: "FAR Subpart 15.3",
      tier: "binding",
      fields: [
        X("cost_price_analyst", "Cost/Price Analyst (if applicable): name, title, organization code and organization name"),
        X("past_performance_evaluator", "Past Performance Evaluator (if applicable): name, title, organization code and organization name"),
        T("other_non_voting", "Other non-voting members"),
      ],
    },
    {
      id: "consultants",
      title: "Consultants",
      citation: "FAR Subpart 15.3",
      tier: "binding",
      fields: [
        X("technical_representative", "Technical Representative(s)", "cor_name"),
        X("small_business_representative", "Small Business Representative (if applicable)"),
        X("safety_health_representative", "Safety and Health Representative (if applicable)"),
        T("other_consultants", "Other consultants"),
      ],
    },
    {
      id: "ex_officio",
      title: "Ex-Officio Members",
      citation: "NFS 1815.303",
      tier: "binding",
      fields: [T("ex_officio_members", "Ex-officio members: name, title, organization code, organization name")],
    },
    {
      id: "conduct",
      title: "Conduct of the evaluation team",
      citation: "FAR Subpart 15.3; NFS Subpart 1815.3",
      tier: "binding",
      standingText:
        "The evaluation team will conduct its business in accordance with the FAR, NFS, and Center acquisition policies and procedures, as applicable. The evaluation team Chairperson is responsible for determining that all evaluation team members (voting and non-voting) are fully conversant with the instructions and requirements of FAR Subpart 15.3 and NFS Subpart 1815.3. The evaluation team Chairperson and each member are responsible for being familiar with and comply with the Center policies and procedures identified below. These policies/procedures describe the evaluation team designation, organization, roles, and responsibilities. Evaluation team duties will take precedence over other duties of members.\n\nIt is emphasized that the evaluation team report and/or presentation are the principal tools available to the Source Selection Authority to perform a comparative analysis for making the final source selection decision. The findings of the evaluation team must be documented and presented in sufficient depth to permit intelligent weighing of alternatives. All proposals shall be evaluated and reported in accordance with the solicitation evaluation criteria, the FAR, and the NFS. The evaluation team's written findings will give no consideration to elements that are extraneous to the objectives of this acquisition.\n\n" +
        PROCUREMENT_INTEGRITY("evaluation team"),
      fields: [T("center_policies", "Applicable Center source selection policies and procedures")],
    },
    {
      id: "delegation",
      title: "Delegation of membership changes",
      citation: "NFS 1815.303(b)(i)(C)",
      tier: "binding",
      fields: [
        S("delegation", "Delegation narrative", [
          "These appointments are effective immediately, and participation is mandatory. No additions or deletions to the voting or non-voting members appointed herein shall be without my approval through a revised appointment letter.",
          "I hereby delegate the authority to make changes to the evaluation team membership of non-voting members and consultants to the evaluation team Chairperson without re-delegation authority.",
          "I delegate any changes to the evaluation team membership, other than the voting members, including appointment of an extended evaluation team, to the evaluation team Chair without re-delegation authority.",
        ]),
        T("delegation_concurrence", "Offices or individuals that must concur in any change"),
      ],
    },
    {
      id: "signature",
      title: "Signature and approval",
      citation: "NFS 1815.303(b)(i)(B)",
      tier: "binding",
      fields: [
        X("sig_name", "Name"),
        X("sig_title", "Title"),
        X("approval_name", "APPROVAL: name"),
        { key: "approval_title", label: "APPROVAL: title", kind: "readonly", default: "Source Selection Authority" },
        T("cc", "cc", "The Office of the General Counsel and every appointed member, one per line."),
      ],
    },
  ],
};

// ------------------------------------------------ 3. SSA appointment letter
const ssaAppointment: TemplateDef = {
  key: "ssa-appointment",
  name: "Source Selection Authority Appointment Letter",
  tab: "036",
  layout: "memo",
  badge: {
    citation: "NFS 1801.603-1; FAR 15.303(a); NFS 1815.303(a); NPD 1000.3",
    tier: "binding",
    revision: "HQ 03/2021 revision",
    effective: "2021-03-01",
    note: "Only the Senior Procurement Executive or the Procurement Officer appoints a Source Selection Authority.",
  },
  lead: "Letter appointing the Source Selection Authority for the acquisition.",
  sections: [
    {
      id: "letter_header",
      title: "Letter",
      citation: "NPR 1450.10D",
      tier: "guidance",
      fields: [
        D("letter_date", "Date"),
        X("reply_to", "Reply to the attn. of", "requester_org_code"),
        X("to_line", "TO: name and title of the SSA designee"),
        X("from_line", "FROM: title of the approval authority", undefined, "The Senior Procurement Executive or the Procurement Officer, in accordance with NFS 1801.603-1."),
        X("acquisition_name", "Acquisition name", "title"),
      ],
    },
    {
      id: "appointment",
      title: "Appointment",
      citation: "NFS 1801.603-1; NPD 1000.3",
      tier: "binding",
      standingText:
        "Pursuant to NASA Federal Acquisition Regulation (FAR) Supplement (NFS) 1801.603-1 and NASA Procedural Directive 1000.3, I hereby appoint you to serve as the SSA for the subject acquisition.\n\nAs the SSA, you will be responsible for the review and approval of the major elements of this acquisition. This includes appointment of the source evaluation board/committee and approval of the acquisition strategy, request for proposal, and evaluation plan. Finally, you are responsible for making the contractor selection decision based on your independent judgement after considering the evaluation findings.\n\nA detailed explanation of SSA responsibilities is contained in NFS 1815.303 and section 2.5.2 of the NASA Source Selection Guide.\n\nThis appointment is effective immediately.",
      fields: [
        X("supersedes", "This appointment cancels and supersedes the previous appointment of", undefined, "Leave empty when there is no previous appointment."),
      ],
    },
    {
      id: "signature",
      title: "Signature",
      citation: "NFS 1801.603-1",
      tier: "binding",
      fields: [X("sig_name", "Name"), T("cc", "cc")],
    },
  ],
};

// ------------------------------------------------ 4. DRFP cover letter
const drfpCoverLetter: TemplateDef = {
  key: "drfp-cover-letter",
  name: "Draft Request For Proposal (DRFP) Cover Letter",
  tab: "037",
  layout: "memo",
  badge: {
    citation: "FAR 15.201; NFS 1815.201; NFS 1815.201(c)(6)(A); NFS 1852.215-84",
    tier: "binding",
    revision: "HQ 02/2026 revision",
    effective: "2026-02-01",
    note: "Released to industry for comment; it is not a solicitation.",
  },
  lead: "Cover letter releasing the draft request for proposal to industry for comment.",
  sections: [
    {
      id: "letter_header",
      title: "Letter",
      citation: "FAR 15.201",
      tier: "binding",
      fields: [
        D("letter_date", "Date the notification is signed and sent by the contracting officer"),
        X("org_code", "Procurement office code or identifier", "requester_org_code"),
        { key: "to_line", label: "TO", kind: "readonly", default: "All Potential Offerors" },
        X("solicitation_number", "Solicitation number"),
        X("acquisition_title", "Acquisition title and acronym", "title"),
      ],
    },
    {
      id: "purpose",
      title: "Purpose and scope",
      citation: "FAR 15.201",
      tier: "binding",
      fields: [
        X("center_name", "Center name", "center_code"),
        T("scope", "The principal purpose of this requirement is to provide", "description_of_requirement"),
        T("comment_focus", "Aspects the Government asks potential offerors to comment on", "For example the CLIN structure, unique terms and conditions, representative task orders, and the Section M evaluation criteria."),
      ],
    },
    {
      id: "competition",
      title: "Competition, contract type and period",
      citation: "FAR 15.201; FAR 19.2",
      tier: "binding",
      fields: [
        X("competition_type", "NASA will conduct this acquisition as a", "competition"),
        X("contract_type", "This competitive acquisition will result in a", "contract_type"),
        S("pop_form", "Period of performance form", POP_CHOICES),
        X("pop_detail", "Period of performance detail"),
        X("naics_code", "NAICS code", "naics_code"),
        X("size_standard", "Small business size standard"),
      ],
    },
    {
      id: "databases",
      title: "Databases offerors must be registered in",
      citation: "FAR 52.204-7",
      tier: "binding",
      standingText:
        "1. System for Award Management: https://www.sam.gov/SAM/\n2. U.S. Department of Labor VETS-4212 Reports: https://vets4212.dol.gov/vets4212/\n3. Unique Entity Identifier (UEI), obtained through SAM.gov.",
      fields: [],
    },
    {
      id: "schedule",
      title: "Schedule and place of performance",
      citation: "FAR 15.201",
      tier: "binding",
      fields: [
        D("final_rfp_date", "Planned release date for the final RFP"),
        X("proposal_days", "Calendar days later that proposals are due"),
        D("award_date", "Anticipated contract award date", "target_award_date"),
        D("effective_date", "Contract effective date"),
        X("place_of_performance", "Place(s) of performance", "place_of_performance"),
      ],
    },
    {
      id: "additional",
      title: "Additional information",
      citation: "FAR 15.201; NFS 1852.209-71",
      tier: "binding",
      fields: [
        T("phase_in", "Phase-in period and the method used to establish it"),
        YESNO("gfp_offsite", "Government Furnished Property for offsite use at the Contractor's facility is described in the DRFP"),
        S("industry_event", "Industry engagement after release of the final RFP", ["", "Industry Day", "Pre-proposal Conference"]),
        D("industry_event_date", "Date of the industry day or pre-proposal conference"),
        T("site_visits", "Site visits or conferences (FAR 52.236-27, FAR 52.237-1, NFS 1852.215-77)"),
        T("oci", "Organizational conflicts of interest information in the DRFP", "NFS clause 1852.209-71, Limitation of Future Contracting, applies."),
        X("security_level", "Facilities clearance level required"),
        T("security_timing", "When the security clearance is required"),
      ],
    },
    {
      id: "ai",
      title: "Disclosure of Artificial Intelligence (AI) Use During Contract Performance",
      citation: "OMB M-25-21; OMB M-25-22",
      tier: "binding",
      standingText: AI_DISCLOSURE,
      fields: [
        S("ai_transparency", "AI Use Transparency Disclosure", ["", ...AI_TRANSPARENCY_CHOICES]),
        X("ai_documentation_location", "Where the AI Impact Assessment documentation is required in the solicitation"),
      ],
    },
    {
      id: "standing",
      title: "Release, posting and ombudsman",
      citation: "NFS 1804.7103; NFS 1852.215-84",
      tier: "binding",
      standingText:
        "To control and protect sensitive data owned by the Government and its Contractors, NASA policy requires all acquisition-related documents be released in Adobe Portable Document Format (PDF).\n\nThis DRFP and any amendments are posted to the Governmentwide point of entry at SAM.gov.\n\nNASA FAR Supplement (NFS) clause 1852.215-84, OMBUDSMAN, is applicable.",
      fields: [X("ombudsman", "Ombudsman name, email address and phone number")],
    },
    {
      id: "disclaimer",
      title: "Disclaimer",
      citation: "FAR 15.201(e)",
      tier: "binding",
      standingText:
        "This DRFP is not a solicitation and NASA is not requesting proposals. This DRFP does not commit NASA to pay any proposal preparation costs, nor does it obligate NASA to procure or contract for this requirement. This request is not an authorization to proceed and does not authorize payment for any charges incurred by the offeror for performing any of the work called for in this solicitation.",
      fields: [],
    },
    {
      id: "comments",
      title: "Comments",
      citation: "FAR 15.201(c)",
      tier: "binding",
      standingText:
        "Any comments regarding the DRFP should be submitted electronically in writing to the Contracting Officer named below. If a respondent believes their comments contain confidential, proprietary, competition sensitive, or business information, those questions and comments shall be marked appropriately. However, questions that are marked as containing confidential, proprietary, competition sensitive or business information will not be provided a Government response. The Government will consider all comments received in preparation of the Final RFP. To the extent a comment leads the Government to revise the acquisition approach or requirements, the change will be reflected in the Final RFP. Some DRFP questions and comments may receive a posted response to the GPE if the Contracting Officer determines that a response would facilitate additional understanding of the solicitation. The Government may also respond via the GPE to comments and questions received following the issuance of the Final Request for Proposal (RFP).",
      fields: [
        X("co_name", "Contracting Officer", "co_name"),
        X("co_email", "Contracting Officer email"),
        X("comment_days", "Calendar days after release of this DRFP for comments", undefined, "Typically 14 days."),
      ],
    },
    {
      id: "signature",
      title: "Signature and enclosures",
      citation: "FAR 15.201",
      tier: "binding",
      fields: [
        X("sig_name", "Contracting Officer name", "co_name"),
        { key: "sig_title", label: "Title", kind: "readonly", default: "Contracting Officer" },
        X("drfp_number", "Enclosure: Draft RFP number"),
        { key: "enclosure_two", label: "Enclosure", kind: "readonly", default: "Template for Submission of Comments" },
      ],
    },
  ],
};

// ------------------------------------------------ 5. Final RFP cover letter
const finalRfpCoverLetter: TemplateDef = {
  key: "final-rfp-cover-letter",
  name: "Final Request for Proposal (RFP) Cover Letter",
  tab: "040",
  layout: "memo",
  badge: {
    citation: "FAR 15.201; FAR 15.203; NFS 1815.201(c)(6)(D); NFS 1815.201(f); NFS 1852.215-84",
    tier: "binding",
    revision: "HQ 02/2026 revision",
    effective: "2026-02-01",
    note: "Mandatory for acquisitions under FAR Part 15 and NFS Part 1815; recommended for FAR Parts 8, 12 and 13.",
  },
  lead: "Cover letter releasing the final request for proposal to industry.",
  sections: [
    {
      id: "letter_header",
      title: "Letter",
      citation: "FAR 15.203",
      tier: "binding",
      fields: [
        D("letter_date", "Date"),
        { key: "to_line", label: "TO", kind: "readonly", default: "All Potential Offerors" },
        X("solicitation_number", "Solicitation number"),
        X("acquisition_title", "Acquisition title and acronym", "title"),
        X("center_name", "Center name", "center_code"),
        T("scope", "Scope of the anticipated acquisition", "description_of_requirement"),
      ],
    },
    {
      id: "competition",
      title: "Competition, contract type and period",
      citation: "FAR 15.203; FAR 19.2",
      tier: "binding",
      fields: [
        X("competition_type", "NASA will conduct this acquisition as a", "competition"),
        X("naics_code", "NAICS code", "naics_code"),
        X("size_standard", "Small business size standard"),
        X("contract_type", "Contract type", "contract_type"),
        S("pop_form", "Period of performance form", POP_CHOICES),
        X("pop_detail", "Period of performance detail"),
        D("award_date", "Anticipated contract award date", "target_award_date"),
        D("effective_date", "Contract effective date"),
        X("place_of_performance", "Place(s) of performance", "place_of_performance"),
      ],
    },
    {
      id: "special_emphasis",
      title: "Items of special emphasis",
      citation: "FAR 15.203; NFS 1852.209-71",
      tier: "binding",
      fields: [
        T("phase_in", "Phase-in period and the method used to establish it"),
        YESNO("gfp_offsite", "Government Furnished Property for offsite use at the Contractor's facility is described in the RFP"),
        T("site_visits", "Site visits or conferences (FAR 52.236-27, FAR 52.237-1, NFS 1852.215-77)"),
        T("oci", "Organizational conflicts of interest information in the RFP", "Clause 1852.209-71, Limitation of Future Contracting."),
        X("security_level", "Facilities clearance level required"),
        T("security_timing", "When the security clearance is required"),
        T("drfp_changes", "Significant changes from the DRFP to the final RFP"),
        X("past_performance_provision", "Past performance questionnaires are required in accordance with provision"),
      ],
    },
    {
      id: "ai",
      title: "Disclosure of Artificial Intelligence (AI) Use During Contract Performance",
      citation: "OMB M-25-21; OMB M-25-22",
      tier: "binding",
      standingText: AI_DISCLOSURE,
      fields: [
        S("ai_transparency", "AI Use Transparency Disclosure", ["", ...AI_TRANSPARENCY_CHOICES]),
        X("ai_documentation_location", "Where the AI Impact Assessment documentation is required in the solicitation"),
      ],
    },
    {
      id: "evaluation_team",
      title: "Source selection officials",
      citation: "NFS 1815.303",
      tier: "binding",
      standingText:
        "Other than the Contracting Officer, the individuals identified below shall not be contacted regarding this acquisition.",
      fields: [
        X("ssa", "SSA: name and code"),
        T("voting_members", "Voting members: name and code (one per line)"),
      ],
    },
    {
      id: "standing",
      title: "Standing instructions",
      citation: "FAR 52.215-1; NFS 1804.7103; NFS 1815.201(f)",
      tier: "binding",
      standingText:
        "Offerors are required to have a Commercial and Government Entity (CAGE) code that matches the corporate address submitted with its proposal.\n\nIn order to control and protect sensitive data owned by the Government and its Contractors, NASA policy required all acquisition-related documents be released in Adobe Portable Document Format (PDF).\n\nThis RFP and any amendments are posted to the Governmentwide point of entry at SAM.gov.\n\nNASA FAR Supplement (NFS) clause 1852.215-84, Ombudsman, is applicable. The Center Ombudsman for this acquisition can be found in the NASA Procurement Ombudsman and Competition Advocate listing.\n\nIn accordance with NFS 1815.201(f), a \u201cBlackout Notice\u201d has been issued to NASA personnel. All inquiries and communications pertaining to this acquisition shall be directed only to the Contracting Officer listed below.",
      fields: [
        S("award_without_discussions", "Instructions to offerors provision", [
          "Offerors are encouraged to refer to Federal Acquisition Regulation (FAR) provision 52.215-1, INSTRUCTIONS TO OFFERORS\u2013COMPETITIVE ACQUISITION, in particular paragraph (f)(4) which discusses the Government's right to award a contract without discussions.",
          "Offerors are encouraged to refer to Federal Acquisition Regulation (FAR) provision 52.212-1, INSTRUCTIONS TO OFFERORS-COMMERCIAL ITEMS, in particular paragraph (g), which states that the Government intends to evaluate offers and award a contract without discussions with offerors.",
        ]),
        S("cost_or_price", "Volume named in the exhibit instruction", ["Cost", "Price"], "Cost"),
        X("exhibit_instruction_source", "Provision or document that carries the exhibit instructions"),
      ],
    },
    {
      id: "disclaimer",
      title: "Disclaimer",
      citation: "FAR 15.201(e)",
      tier: "binding",
      standingText:
        "This RFP does not commit NASA to pay any proposal preparation costs, nor does it obligate NASA to procure or contract for these services. This request is not an authorization to proceed and does not authorize payment for any charges incurred by the offeror for performing any of the work called for in this solicitation.",
      fields: [],
    },
    {
      id: "due_dates",
      title: "Proposal and question due dates",
      citation: "FAR 15.208",
      tier: "binding",
      fields: [
        X("proposals_due", "Proposals are due no later than (date, time and time zone)"),
        X("co_name", "Contracting Officer", "co_name"),
        X("co_email", "Contracting Officer email"),
        D("questions_due", "Questions are due on or before"),
      ],
    },
    {
      id: "signature",
      title: "Signature",
      citation: "FAR 15.203",
      tier: "binding",
      standingText: "Thank you for your support. We look forward to receiving your proposals.",
      fields: [
        X("sig_name", "Contracting Officer name", "co_name"),
        { key: "sig_title", label: "Title", kind: "readonly", default: "Contracting Officer" },
      ],
    },
  ],
};

// ------------------------------------------------ 6. RFP for non-competitive new awards
const rfpNoncompetitive: TemplateDef = {
  key: "rfp-noncompetitive",
  name: "Request For Proposal (RFP) for Non-Competitive New Awards",
  tab: "040",
  layout: "memo",
  badge: {
    citation: "FAR 15.203(e); FAR 15.203(e)(3) and (4); NFS 1815.203-70; NFS 1804.7103",
    tier: "binding",
    revision: "HQ 02/2026 revision",
    effective: "2026-02-01",
    note: "Letter request for proposal to a single offeror. Information in this letter is sensitive but unclassified; use an SF 901 coversheet.",
  },
  lead: "Letter request for proposal for a non-competitive new award, with its enclosures.",
  sections: [
    {
      id: "letter_header",
      title: "Letter",
      citation: "FAR 15.203(e)",
      tier: "binding",
      fields: [
        X("org_code", "Procurement office code or identifier", "requester_org_code"),
        X("to_line", "TO: offeror name", "vendor_legal_name"),
        X("rfp_number", "RFP number"),
        X("acquisition_title", "Acquisition title and acronym", "title"),
        X("center_name", "Center name", "center_code"),
      ],
    },
    {
      id: "purpose",
      title: "Purpose and authority",
      citation: "FAR 15.203(e)(3) and (4); FAR Part 6",
      tier: "binding",
      fields: [
        T("scope", "The principal purpose of this requirement is to provide", "description_of_requirement"),
        X("proposal_due", "The proposal must be submitted by (time and date)"),
        X("proposal_destination", "Contracting officer and location for receipt of the proposal", "co_name"),
        X("acceptance_period", "Acceptance period, in days, of not less than"),
        X("far6_citation", "This acquisition is being conducted utilizing other than full and open competition, as implemented by FAR", "jofoc_authority_citation"),
        X("page_limit", "Pages the technical approach narrative must not exceed"),
      ],
    },
    {
      id: "certified_data",
      title: "Certified cost or pricing data",
      citation: "FAR 15.403-4; FAR 52.215-20; FAR 15.408 Table 15-2; FAR 15.406-2",
      tier: "binding",
      standingText:
        "Please be advised, in accordance with Federal Acquisition Regulation (FAR) 15.403-4, Requiring Cost or Pricing Data (10 U.S.C. 2306a and 41 U.S.C. 254b), certified cost or pricing data is required for this contract (see FAR 52.215-20, Requirements for Certified Cost or Pricing Data and Data Other Than Certified Cost or Pricing Data). The cost or pricing data must be prepared in accordance with the instructions contained in Table 15-2 under FAR 15.408. As soon as practicable after agreement on price, but before contract award, a Certificate of Current Cost or Pricing Data must be submitted to the contracting officer in accordance with FAR 15.406-2.",
      fields: [
        YESNO("certified_data_required", "Certified cost or pricing data is required"),
        T("subcontractor_data", "Subcontractor certified cost or pricing data required under FAR 15.404-3(c)(1)"),
      ],
      showIf: (v: Values) => v["certified_data_required"] === "Yes",
    },
    {
      id: "volumes",
      title: "Proposal volumes",
      citation: "FAR 15.204",
      tier: "binding",
      standingText:
        "Contract Volume \u2014 the signed award form and the draft contract, with any Safety and Health Plan and Small Business Subcontracting Plan attachments.\nOffer Volume \u2014 technical approach, business systems, contract administration and other information, any Cost Accounting Standards Disclosure Statement, and the Total Compensation Plan (see FAR 22.1103).\nCost or Price Volume \u2014 the cost or price exhibits with supporting documentation and NFS provision 1852.215-85, Proposal Adequacy Checklist.",
      fields: [
        S("award_form", "Award form in the Contract Volume", ["SF 26", "SF 33", "SF 1449"], "SF 33"),
        S("cost_or_price", "Cost or Price Volume", ["Cost", "Price"], "Cost"),
        X("exhibit_range", "Cost or price exhibits included in Enclosure 2"),
        T("other_instructions", "Any other instructions pertinent to this request for proposal"),
      ],
    },
    {
      id: "enclosures_detail",
      title: "Enclosure content",
      citation: "NFS 1852.245-80; NFS 1852.245-81; NFS 1852.234-1 (DEVIATION); FAR 44.3",
      tier: "binding",
      collapsed: true,
      fields: [
        T("business_systems", "Business systems the offeror must address"),
        T("summary_exceptions", "Summary of exceptions"),
        T("contract_administration", "Contract administration"),
        T("applicable_provisions", "Provisions the offeror must comply with, with their dates"),
        T("cas", "Cost Accounting Standards"),
        X("security_classification_level", "Contract security classification level"),
        T("government_property", "Government property information required (NFS 1852.245-80 and 1852.245-81)"),
        T("total_compensation_plan", "Total Compensation Plan instructions (FAR 22.1103)"),
        T("evms", "Earned value management system (NFS 1852.234-1 (DEVIATION))"),
        T("subcontracting_goals", "Small business subcontracting goals, by category"),
      ],
    },
    {
      id: "optional_paragraphs",
      title: "Conditional paragraphs",
      citation: "NFS 1852.215-85; NFS 1852.223-73; FAR 9.504; NFS 1852.240-76 (DEVIATION)",
      tier: "binding",
      fields: [
        YESNO("adequacy_checklist", "The Proposal Adequacy Checklist is included as an enclosure"),
        YESNO("subcontracting_plan", "A small business subcontracting plan is required"),
        YESNO("it_security", "The NFS 1852.240-76 information technology security paragraph applies"),
        YESNO("safety_health_plan", "A Safety and Health Plan is required"),
        YESNO("oci_plan", "An Organizational Conflicts of Interest plan is required"),
        X("security_level", "Security clearance level required"),
      ],
    },
    {
      id: "ai",
      title: "Disclosure of Artificial Intelligence (AI) Use During Contract Performance",
      citation: "OMB M-25-21; OMB M-25-22",
      tier: "binding",
      standingText: AI_DISCLOSURE,
      fields: [
        S("ai_transparency", "AI Use Transparency Disclosure", ["", ...AI_TRANSPARENCY_CHOICES]),
        X("ai_documentation_location", "Where the AI Impact Assessment documentation is required in the solicitation"),
      ],
    },
    {
      id: "standing",
      title: "Standing instructions",
      citation: "FAR 52.204-7; 18 USC \u00a7 1001",
      tier: "binding",
      standingText:
        "In accordance with FAR provision 52.204-7, System for Award Management (SAM), register and complete representations and certifications via the SAM web site accessed through https://www.sam.gov/SAM/.\n\nPlease submit an electronic copy of your proposal in Microsoft Office Word or Adobe Portable Document Format (PDF). DO NOT compress any electronic files. DO NOT password protect any portion of your electronic submission.\n\nThe proposal must set forth full, accurate, and complete information as required by this letter. The penalty for making false statements in a proposal is prescribed in 18 USC \u00a7 1001. This request is not to be construed in any way as a commitment of Government funds. Any award as a result of this request is contingent upon approval of the authority to negotiate and the availability of Government funds.\n\nThis RFP does not commit NASA to pay any proposal preparation costs, nor does it obligate NASA to procure or contract for these services. This request must not be construed as authorization to proceed with, or be paid for charges incurred by performing any of the work called for in this solicitation.",
      fields: [],
    },
    {
      id: "signature",
      title: "Signature and enclosures",
      citation: "FAR 15.203(e)",
      tier: "binding",
      fields: [
        X("co_contact", "For questions associated with this RFP, please contact the undersigned at"),
        X("sig_name", "Name", "co_name"),
        { key: "sig_title", label: "Title", kind: "readonly", default: "Contracting Officer" },
        T("enclosures", "Enclosures", "Enclosure 1 award form and draft contract; 2 cost or price exhibits; 3 exhibit instructions; 4 business systems, contract administration and other information; then any conditional enclosures."),
      ],
    },
  ],
};

// ------------------------------------------------ 7. RFP for existing contracts
const rfpExistingContract: TemplateDef = {
  key: "rfp-existing-contract",
  name: "Request for Proposal (RFP) for Existing Contracts",
  tab: "040",
  layout: "memo",
  badge: {
    citation: "FAR 15.203(e); FAR 43.102(b); FAR 15.403-4; NFS 1815.403-3",
    tier: "binding",
    revision: "HQ 02/2025 revision",
    effective: "2025-02-01",
    note: "Requests a proposal from a contractor for a modification to an existing contract or order.",
  },
  lead: "Letter request for proposal for a modification to an existing contract or order.",
  sections: [
    {
      id: "letter_header",
      title: "Letter",
      citation: "FAR 15.203(e)",
      tier: "binding",
      fields: [
        X("org_code", "Procurement office code or identifier", "requester_org_code"),
        X("to_line", "TO: offeror name", "vendor_legal_name"),
        X("contract_number", "Contract or task order number"),
        X("acquisition_title", "Acquisition title", "title"),
        X("center_name", "Center name", "center_code"),
      ],
    },
    {
      id: "purpose",
      title: "Purpose and authority",
      citation: "FAR 43.102(b); FAR Part 6",
      tier: "binding",
      fields: [
        T("scope", "The principal purpose of this requirement is to provide", "description_of_requirement"),
        S("authority_basis", "Authority for this action", [
          "Other than full and open competition under FAR Part 6",
          "The changes clause, following a previously issued change order",
          "Another authority described below",
        ]),
        X("far6_citation", "FAR Part 6 citation and title", "jofoc_authority_citation"),
        X("prior_modification", "Previously issued change order modification number(s)"),
        X("changes_clause", "Changes clause number"),
        T("authority_narrative", "Authority paragraph tailored to this action"),
        X("page_limit", "Pages the technical approach narrative must not exceed"),
      ],
    },
    {
      id: "certified_data",
      title: "Certified cost or pricing data",
      citation: "FAR 15.403-4; FAR 52.215-21; FAR 15.408 Table 15-2; FAR 15.406-2",
      tier: "binding",
      standingText:
        "Please be advised, in accordance with Federal Acquisition Regulation (FAR) 15.403-4, Requiring Cost or Pricing Data (10 U.S.C. 2306a and 41 U.S.C. 254b), certified cost or pricing data is required for this contract modification (see FAR 52.215-21, Requirements for Certified Cost or Pricing Data and Data Other Than Certified Cost or Pricing Data \u2013 Modifications). The cost or pricing data shall be prepared in accordance with the instructions contained at FAR 15.408, Table 15-2, and NFS 1852.215-85, Proposal Adequacy Checklist. As soon as practicable after agreement on price, but before contract modification award, a Certificate of Current Cost or Pricing Data shall be submitted to the Contracting Officer in accordance with FAR 15.406-2.",
      fields: [
        YESNO("certified_data_required", "Certified cost or pricing data is required"),
        T("subcontractor_data", "Subcontractor certified cost or pricing data required under FAR 15.404-3(c)(1)"),
      ],
      showIf: (v: Values) => v["certified_data_required"] === "Yes",
    },
    {
      id: "submission",
      title: "Submission",
      citation: "FAR 15.203(e)",
      tier: "binding",
      standingText:
        "Submit an electronic copy of your proposal in Microsoft Office Word, Adobe Portable Document Format (PDF), or Microsoft Excel spreadsheets (containing unlocked cells with formulas). DO NOT compress any electronic files. DO NOT password protect any portion of your electronic submission.\n\nPrepare the proposal in accordance with the instructions in this letter and any enclosures. Information contained in the proposal must be in sufficient detail to allow adequate technical, business and cost/price evaluation.\n\nThis RFP does not commit NASA to pay any proposal preparation costs, nor does it obligate NASA to procure or contract for these services. This request shall not be construed as authorization to proceed with or be paid for charges incurred by performing any of the work called for in this solicitation.\n\nThe proposal must set forth full, accurate, and complete information as required by this letter. The penalty for making false statements in a proposal is prescribed in 18 USC \u00a7 1001. This request is not to be construed in any way as a commitment of Government funds. Any award as a result of this request is contingent upon approval of the authority to negotiate and the availability of Government funds.",
      fields: [
        X("proposal_due", "A proposal shall be submitted by (time and date)"),
        X("proposal_destination", "Location for receipt of the proposal"),
        X("acceptance_period", "Acceptance period, in days, of not less than"),
        T("other_instructions", "Any other instructions pertinent to this request for proposal"),
      ],
    },
    {
      id: "signature",
      title: "Signature and enclosures",
      citation: "FAR 15.203(e)",
      tier: "binding",
      fields: [
        X("co_contact", "For questions associated with this request, please contact the undersigned at"),
        X("sig_name", "Name", "co_name"),
        { key: "sig_title", label: "Title", kind: "readonly", default: "Contracting Officer" },
        T("enclosures", "Enclosures", "For example the draft contract modification, technical exhibits, and cost or price exhibits and instructions."),
      ],
    },
  ],
};

// ------------------------------------------------ 8. Blackout notice
const blackoutNotice: TemplateDef = {
  key: "blackout-notice",
  name: "Blackout Notice",
  tab: "039",
  layout: "memo",
  badge: {
    citation: "FAR 15.201(f); NFS 1815.201(f)(i); NFS 1815.201(f)(ii); NFS 1815.370(a)",
    tier: "binding",
    revision: "HQ 01/2025 revision",
    effective: "2025-01-01",
    note: "Issued to NASA personnel when the solicitation is released to industry.",
  },
  lead: "Notice to NASA personnel that communications with industry on this acquisition have stopped.",
  sections: [
    {
      id: "notice_header",
      title: "Notice",
      citation: "NFS 1815.201(f)",
      tier: "binding",
      fields: [
        { key: "to_line", label: "TO", kind: "readonly", default: "NASA Civil Servants" },
        X("program_office", "FROM: Office of Procurement and the program or project office this activity supports"),
        S("solicitation_kind", "This notice covers a", ["Final Request for Proposal (RFP)", "Solicitation"], "Final Request for Proposal (RFP)"),
        X("solicitation_number", "Final RFP or solicitation number"),
        X("acquisition_name", "Acquisition name and acronym", "title"),
      ],
    },
    {
      id: "release",
      title: "Release to industry",
      citation: "FAR 5.102",
      tier: "binding",
      standingText:
        "The solicitation is located at the Governmentwide point of entry (GPE) (https://SAM.gov) and can be found by entering the solicitation number into the \u201ckeywords\u201d field.",
      fields: [T("scope", "Description of the acquisition scope", "description_of_requirement")],
    },
    {
      id: "blackout",
      title: "Blackout",
      citation: "NFS 1815.201(f)(i)",
      tier: "binding",
      standingText:
        "Effective immediately, all NASA personnel will cease communications with industry concerning this acquisition. This \u201cblackout\u201d period of communication with industry will continue through the receipt and evaluation of proposals, the award of the contract, and the release of the evaluation board from its responsibilities.\n\nNASA personnel shall refer anyone seeking information regarding this acquisition to the designated Contracting Officer identified below. Improper communication could jeopardize the integrity or successful completion of this acquisition. Therefore, compliance with the above will ensure the dissemination of uniform responses to all inquiries and eliminate the possibility of preferential treatment of any prospective offeror. This blackout notice is not intended to terminate all communication with offerors. The designated Contracting Officer should continue to provide information as long as it does not create an unfair competitive advantage or reveal proprietary data.\n\nNASA personnel who may be responsible for the administration of existing contracts or agreements that may be related to this acquisition shall, at all times, be fully aware of the extremely sensitive nature of this acquisition and maintain compliance with the blackout notice. While it is recognized that some NASA personnel have a need to communicate with prospective offerors relative to the conduct of current ongoing contract work, any communication is limited solely to existing contracts or agreements and shall not be expanded into matters relating to this acquisition. Under no circumstances shall this acquisition be discussed. It is important that all NASA personnel adhere to this notice to ensure that all offerors are treated fairly and impartially.",
      fields: [
        X("co_contact", "Designated Contracting Officer: name, phone number and email address", "co_name"),
        X("center_name", "Center name and acronym", "center_code"),
      ],
    },
    {
      id: "nasa_resources",
      title: "Permitted communications about NASA resources",
      citation: "NFS 1815.201(f)(ii)",
      tier: "binding",
      standingText:
        "These communications shall not include assistance in preparing the company's proposal, providing advice or opinions on the company's solution or approach for performing the work and/or discussion of any information regarding the competition or its technical requirements. In addition, Centers must firewall NASA personnel participating in communications regarding the availability of NASA resources to ensure those employees will not participate directly or indirectly in the evaluation of proposals on behalf of the Agency. The cooperation of the NASA workforce with this notice is appreciated.",
      fields: [
        YESNO("nasa_resources_apply", "Limited communications about NASA resources are permitted"),
        X("resources_reference", "Attachment or document that identifies the NASA points of contact"),
      ],
      showIf: (v: Values) => v["nasa_resources_apply"] === "Yes",
    },
    {
      id: "signature",
      title: "Signature",
      citation: "NFS 1815.201(f)",
      tier: "binding",
      fields: [X("sig_name", "Name"), X("sig_title", "Position Title")],
    },
  ],
};

// ------------------------------------------------ 9. Electronic document posting checklist
const CHECK = ["", "Completed", "N/A"];
const electronicPostingChecklist: TemplateDef = {
  key: "electronic-posting-checklist",
  name: "Electronic Document Posting Checklist",
  tab: "38",
  badge: {
    citation: "NFS 1804.7103; FAR 3.104-4; NAII 2190.1",
    tier: "binding",
    revision: "HQ 01/2025 revision",
    effective: "2025-01-01",
    note: "Retain the completed checklist as part of the contract file.",
  },
  lead: "Checklist completed before acquisition documents are posted, with an independent approval.",
  sections: [
    {
      id: "header",
      title: "Electronic Document Posting Checklist",
      citation: "NFS 1804.7103",
      tier: "binding",
      fields: [
        X("posting_action", "Acquisition title and posting action", "title"),
        T("documents_reviewed", "Summary of Documents Reviewed As Part of this Checklist:"),
      ],
    },
    {
      id: "review",
      title: "CO/CS Review",
      citation: "FAR 3.104-4; NAII 2190.1",
      tier: "binding",
      fields: [
        S("check_1", "Ensure all files to be posted (e.g. RFP and other acquisition documents) contain no proprietary information about manufacturing processes, operations, or contractor unique approaches, sensitive, CUI, or export controlled information in accordance with applicable law or regulation. This includes confirming that the predecessor contract, if applicable, was provided with the appropriate data rights. Page by page review of the actual electronic documents is required.", CHECK),
        S("check_2", "Ensure there are no hidden worksheets, columns, rows or data in the Excel cost chart exhibits. Double-check using the \u201cCheck for Issues/Inspect Document\u201d feature.", CHECK),
        S("check_3", "Coordinate with Legal to ensure any necessary redactions of proprietary or sensitive data have occurred, if applicable.", CHECK),
        S("check_4", "Ensure all review comments and changes are successfully removed from documents, including all metadata. Double-check using the \u201cCheck for Issues/Inspect Document\u201d feature.", CHECK),
        S("check_5", "Save all documents to be posted (including SOW and Cost/Price Exhibits) as PDF files, converted from Microsoft Word and Excel. Do not scan documents to PDF.", CHECK),
        S("check_6", "Final metadata check completed after documents converted to PDF format prior to sending to authorized approver.", CHECK),
        T("actions_taken", "Action To Be Taken By CO/CS"),
      ],
    },
    {
      id: "certification",
      title: "Certification",
      citation: "NFS 1804.7103",
      tier: "binding",
      standingText:
        "I hereby certify that the checklist has been completed for all documents summarized above.\n\nApproval must be conducted by an individual at least one level above the contracting officer who is independent from the drafting of the documents.",
      fields: [
        X("prepared_by_name", "Prepared By: name", "co_name"),
        X("prepared_by_title", "Prepared By: title"),
        X("approved_by_name", "Approved By: name"),
        X("approved_by_title", "Approved By: title"),
      ],
    },
  ],
};

// ------------------------------------------------ 10. Notification to interested parties under CBAs
const cbaNotification: TemplateDef = {
  key: "cba-notification",
  name: "Notification to Interested Parties under CBAs",
  tab: "030",
  layout: "memo",
  badge: {
    citation: "FAR 22.1004-6(a); FAR 22.1010(a); FAR 22.1002-3(b)(2); FAR 22.1005-6; NFS 1822.1008-2(b)(2)",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2026-04-01",
    note: "Given to the incumbent prime contractor and the collective bargaining agent at least 30 days in advance of the earliest applicable acquisition date. The contracting officer retains a copy in the contract file.",
  },
  lead: "Letter notifying the contractor and the bargaining agent of the acquisition dates.",
  sections: [
    {
      id: "letter_header",
      title: "Letter",
      citation: "FAR 22.1004-6(a)",
      tier: "binding",
      fields: [
        D("letter_date", "Date"),
        X("reply_to", "Reply to attn. of: procurement office name or organization code", "requester_org_code"),
        T("to_contractor", "TO: contractor addressee (name, title, company, address)"),
        T("to_bargaining_agent", "and TO: bargaining agent addressee (name, title, bargaining unit, address)"),
        X("from_line", "FROM", "co_name"),
        X("contract_number", "Contract number"),
        X("effort_name", "Name of the effort under the contract", "title"),
        X("installation", "Installation name", "center_code"),
      ],
    },
    {
      id: "determination",
      title: "Determination",
      citation: "FAR 22.1010(a)",
      tier: "binding",
      standingText:
        "In accordance with Federal Acquisition Regulation (FAR) section 22.1010(a), I have determined that service employees performing under the subject contract for the prime contractor named below and the number of its subcontractors shown are represented by collective bargaining agents (CBAs). NASA is required by the FAR to notify the prime contractor and the collective bargaining agent for the prime contractor's service employees of information pertaining to forthcoming modifications (e.g., contract extension, option exercise) and successor contracts. We encourage the prime contractor to forward this notification to any subcontractors with service employees performing under the subject contract, as well as the collective bargaining agents for those subcontractor service employees, as appropriate.",
      fields: [
        X("prime_contractor", "Prime contractor's name", "vendor_legal_name"),
        X("subcontractor_count", "Number of subcontractors with CBAs"),
      ],
    },
    {
      id: "kind",
      title: "Action covered",
      citation: "FAR 22.1004-6(a)",
      tier: "binding",
      fields: [
        S("action_kind", "This notification covers", [
          "A forthcoming successor contract",
          "A forthcoming modification",
          "An option exercise",
          "A multiple-year contract anniversary date",
        ], "A forthcoming successor contract"),
      ],
    },
    {
      id: "anniversary",
      title: "Multiple-year contract anniversary date",
      citation: "FAR 22.1004-6(a)",
      tier: "binding",
      standingText:
        "The forthcoming multiple year contract anniversary date (annual anniversary date or biennial date) is shown below.",
      fields: [D("anniversary_date", "Anniversary date")],
      showIf: (v: Values) => v["action_kind"] === "A multiple-year contract anniversary date",
    },
    {
      id: "dates",
      title: "Acquisition dates",
      citation: "FAR 22.1004-6(a)",
      tier: "binding",
      standingText:
        "I hereby notify you that the applicable acquisition dates for the forthcoming action identified below are as follows.",
      fields: [
        X("action_title", "Title of the follow-on contract or description of the modification"),
        D("date_solicitation", "Issuance of Solicitation: on or about"),
        D("date_proposals", "Proposals Due: on or about"),
        D("date_negotiations", "Commence Negotiations: on or about"),
        D("date_award", "Award of Contract, or issue of the definitization modification: on or about"),
        D("date_performance", "Start of Performance: on or about"),
      ],
      showIf: (v: Values) =>
        v["action_kind"] === "A forthcoming successor contract" || v["action_kind"] === "A forthcoming modification",
    },
    {
      id: "option",
      title: "Option exercise",
      citation: "FAR 52.217-9",
      tier: "binding",
      standingText:
        "In accordance with contract clause at FAR 52.217-9, Option to Extend the Term of the Contract (Mar 2000), this letter is to provide preliminary notice that the Government intends to exercise the option identified below for the period shown. This preliminary notice does not commit the Government to an extension, nor obligate the Government to acquire additional services under the contract.",
      fields: [
        X("option_number", "Option to be exercised, with contract year"),
        D("option_date", "Planned date for exercising the option"),
        X("option_period", "Period of performance for the exercised option"),
      ],
      showIf: (v: Values) => v["action_kind"] === "An option exercise",
    },
    {
      id: "closing",
      title: "Closing",
      citation: "NPR 5200.1E",
      tier: "guidance",
      standingText:
        "In support of the extension please review and distribute this letter and refer to Chapter 7 of NASA Procedural Requirements 5200.1E, \u201cProcedure for Providing Admission of Labor Union Representatives to NASA Centers\u201d. Additionally, please note that all site access requests must be coordinated through the Center Industrial Relations Officer.\n\nConfirmation of receipt of this notification is requested via reply e-mail.",
      fields: [
        X("co_phone", "Contracting Officer phone number"),
        X("co_email", "Contracting Officer email address"),
        X("sig_name", "Sincerely, name", "co_name"),
        { key: "sig_title", label: "Title", kind: "readonly", default: "Contracting Officer" },
        X("office_name", "Office name"),
      ],
    },
  ],
};

// ------------------------------------------------ 11. Prenegotiation Position Memorandum
const CHECKBOX_SYSTEM = ["", "Adequate", "Inadequate", "Other", "N/A"];
const ppm: TemplateDef = {
  key: "ppm",
  name: "Prenegotiation Position Memorandum (PPM)",
  tab: "063",
  layout: "memo",
  badge: {
    citation: "FAR 15.4; FAR 15.408; FAR 15.408-1(b); NFS CG 1815.48",
    tier: "binding",
    revision: "HQ 04/2026 revision",
    effective: "2026-04-01",
    note: "Used for non-competitive acquisitions, including new awards and modifications to contracts and orders, above the simplified acquisition threshold; approved before negotiations begin. The price negotiation memorandum records the result.",
  },
  lead: "Prenegotiation position memorandum, prepared and approved before negotiations open.",
  sections: [
    {
      id: "title",
      title: "PRENEGOTIATION POSITION MEMORANDUM",
      citation: "FAR 15.408; NFS CG 1815.48",
      tier: "binding",
      standingText:
        "The contracting officer (CO) has prepared this Prenegotiation Position Memorandum (PPM) pursuant to Federal Acquisition Regulation (FAR) 15.408 and NASA FAR Supplement (NFS) Companion Guide (CG) 1815.48.",
      fields: [
        X("requirement_title", "Title of the requirement being negotiated, with contract, order and modification number", "title"),
      ],
    },
    {
      id: "introduction",
      title: "I. INTRODUCTION",
      citation: "FAR 15.408-1(b)",
      tier: "binding",
      fields: [
        T("description_background", "A. Description and Background of the proposed action:", "description_of_requirement"),
        X("contractor_name", "B. Contractor:", "vendor_legal_name"),
        X("contractor_address", "B. Contractor address"),
        X("place_of_performance", "B. Place of Performance", "place_of_performance"),
        T("major_subcontractors", "C. Major Subcontractor(s) (if applicable)"),
      ],
    },
    {
      id: "compliance",
      title: "D. Documentation Pertaining to Compliance with Law, Regulations, And Policy:",
      citation: "FAR 5.101; FAR 44.301; NFS CG 1844.3; FAR 19.302(a); FAR 30.301; FAR 44.201-1; NFS CG 1845.23; FAR 15.404-9(c)(3)",
      tier: "binding",
      fields: [
        X("jofoc_status", "1. Justification for Other Than Full and Open Competition (JOFOC): exception, 10 U.S.C. 3204(a)( )", "jofoc_authority_citation"),
        D("jofoc_approved_on", "1. JOFOC approved on"),
        D("synopsis_date", "2. Presolicitation Notice posted to the Government Point of Entry (FAR 5.101) on"),
        X("interested_companies", "2. Number of interested companies"),
        S("accounting_system", "3(a). Accounting system is", CHECKBOX_SYSTEM),
        X("accounting_determined_by", "3(a). Determined by and on, and verified by the contract specialist on"),
        S("estimating_system", "3(b). Estimating system is", CHECKBOX_SYSTEM),
        X("estimating_determined_by", "3(b). Determined by and on, and verified by the contract specialist on"),
        S("purchasing_system", "3(c). Purchasing system (FAR 44.301; NFS CG 1844.3) is", ["", "Approved", "Approval Withheld", "Approval Withdrawn", "Other", "N/A (sales to Government less than $25M during next 12 months)"]),
        X("purchasing_determined_by", "3(c). Determined by and on, and verified by the contract specialist on"),
        S("tcp_received", "4. Total Compensation Plan received", ["", "Yes", "N/A (under $750K)", "Other"]),
        X("tcp_reviewed_by", "4. Reviewed by and on"),
        S("subcontracting_plan", "5. Small Business Subcontracting Plan (or revision) received (FAR 19.302(a))", ["", "Yes", "N/A (under $900K, or $2M construction)", "Other"]),
        S("subcontracting_plan_position", "5. The Small Business Specialist", ["", "Concurred", "Non-concurred"]),
        S("consent_subcontractors", "6. Subcontractors require special surveillance consent and designation under FAR 52.244-2, paragraphs (c) and (d) (see FAR 44.201-1(a) and (b))", ["", "Yes", "No", "N/A", "As yet undetermined; addressed in item M below"]),
        S("cas_disclosure", "7. Contractor's Cost Accounting Standards Disclosure Statement (FAR 30.301) is", ["", "Adequate", "Inadequate", "Other", "N/A (Small Business or Foreign Government)"]),
        S("ipo_review", "8. Industrial Property Officer (IPO) review received (NFS CG 1845.23)", ["", "Yes", "N/A (contract under $250K, modification or change order, contract not onsite, existing property not being furnished, or contractor not acquiring property)", "Other"]),
        S("ipo_position", "8. The Industrial Property Officer", ["", "Concurred", "Nonconcurred"]),
        S("fccm", "9. Contractor has proposed Facilities Capital Cost of Money (FCCM); if yes, the FCCM cost objective amounts have been excluded from the profit/fee base in accordance with FAR 15.404-9(c)(3)(ii)", ["No", "Yes"]),
        S("cap_equipment", "10. Contractor has proposed Contractor-Acquired Property categorized as equipment (FAR 45.101) charged directly to the contract; if yes, those amounts have been excluded from the profit/fee base in accordance with FAR 15.404-9(c)(3)(i)", ["No", "Yes"]),
        T("compliance_explanations", "Explanations for any item above"),
      ],
    },
    {
      id: "chronology",
      title: "E. Evaluation Documentation Chronology:",
      citation: "FAR 15.408-1(b)",
      tier: "binding",
      fields: [
        S("igce_developed", "1. Was an Independent Government Cost Estimate (IGCE) developed for this action?", ["Yes", "No"], "Yes"),
        M("igce_amount", "1. IGCE amount", "igce_total"),
        X("igce_approved", "1. Approved by and on"),
        S("igce_used", "1. Was the IGCE utilized in developing the prenegotiation positions?", ["Yes", "No"], "Yes"),
        T("proposals", "2. Contractor's Proposal(s): number(s), date(s) and amount(s)"),
        T("fact_finding", "3. Fact-Finding Results: date(s) and key findings"),
        T("technical_evaluation", "4. Technical Evaluation Report: signer, date, approval, and the findings supporting this memorandum"),
        T("field_pricing", "5. Field Pricing Report or Auditor Rate Verification, if prepared"),
        T("cost_price_report", "6. Cost/Price Evaluation Report, if prepared"),
      ],
    },
    {
      id: "data_schedule_team",
      title: "F. Certified Cost or Pricing Data; G. Proposed Negotiation Schedule; H. Negotiation Team:",
      citation: "FAR 15.403; FAR 15.408",
      tier: "binding",
      standingText: "Negotiations will commence upon approval of this PPM.",
      fields: [
        T("certified_data", "F. Certified cost or pricing data"),
        T("negotiation_schedule", "G. Proposed negotiation schedule"),
        T("negotiation_team", "H. Negotiation team: name, role and organization (one per line)", "co_name"),
      ],
    },
    {
      id: "contract_type",
      title: "II. TYPE OF CONTRACT CONTEMPLATED",
      citation: "FAR 16.4; NFS 1816.4",
      tier: "binding",
      fields: [
        X("contract_type", "Contract type", "contract_type"),
        T("contract_type_narrative", "Why this contract type is appropriate for this action"),
      ],
    },
    {
      id: "special_features",
      title: "III. SPECIAL FEATURES AND REQUIREMENTS",
      citation: "FAR 15.408",
      tier: "binding",
      standingText:
        "Checking \u201cNo\u201d means none or not applicable to the requirement. Checking \u201cYes\u201d means the item applies to this requirement. The CO will address any \u201cYes\u201d items under this section.",
      fields: [
        YESNO("sf_undefinitized", "i. Undefinitized authorized work"),
        YESNO("sf_preaward_survey", "ii. Pre-award survey results"),
        YESNO("sf_options", "iii. Contract option requirements"),
        YESNO("sf_property", "iv. Government property to be furnished"),
        YESNO("sf_facilities", "v. Contractor or Government investment in facilities and equipment"),
        YESNO("sf_deviations", "vi. Any deviations, special clauses, or unusual conditions anticipated"),
        YESNO("sf_risk", "vii. Any risk management issues"),
        YESNO("sf_other", "viii. Other"),
        T("special_features_narrative", "Elaboration on every item marked Yes"),
      ],
    },
    {
      id: "cost_analysis",
      title: "IV. COST ANALYSIS \u2014 PARALLEL TABULATION BY ELEMENT OF COST AND PROFIT/FEE",
      citation: "FAR 15.404-1; FAR 15.404-1(b)",
      tier: "binding",
      standingText:
        "The Maximum position (if used) for each individual element of cost must be explained in detail (basis and why it is fair and reasonable) in the Section IV reference notes. Rationale for the Government's profit/fee objectives must be explained in the Section IV reference notes and, if appropriate, attach a completed NASA Form 634, Structured Approach\u2014Profit/Fee Objective.",
      fields: [
        T("tabulation", "Parallel tabulation: cost element, proposed, NASA objective, delta, NASA maximum, reference note"),
      ],
    },
    {
      id: "reference_notes",
      title: "IV. COST ANALYSIS \u2014 REFERENCE NOTES",
      citation: "FAR 15.404-1(b)(2); FAR 15.404-4",
      tier: "binding",
      fields: [
        T("note_a", "A. Direct Labor"),
        T("note_b", "B. Overhead"),
        T("note_c", "C. Fringe"),
        T("note_d", "D. Equipment"),
        T("note_e", "E. Materials/Supplies"),
        T("note_f", "F. Subcontracts"),
        T("note_g", "G. Travel"),
        T("note_h", "H. Other Direct Costs (ODCs)"),
        T("note_i", "I. General and Administrative (G&A)"),
        T("note_j", "J. Facilities Capital Cost of Money (FCCOM)"),
        T("note_k", "K. Profit/Fee"),
        T("note_l", "L. Special Provisions/Clauses"),
        T("note_m", "M. Other Objectives/Information (if any)"),
        T("note_n", "N. Price Analysis"),
      ],
    },
    {
      id: "approval",
      title: "V. NEGOTIATION APPROVAL SOUGHT",
      citation: "FAR 15.408; NFS CG 1815.48",
      tier: "binding",
      standingText:
        "The prenegotiation position above represents the Government's realistic assessment of fair and reasonable prices for the requirement named in this memorandum. Based on the information provided herein, approval is sought for the prenegotiation positions set forth in this document.",
      fields: [
        M("proposed_total_cost", "Contractor proposed total cost"),
        M("objective_total_cost", "Government objective total cost"),
        M("maximum_total_cost", "Government maximum total cost"),
        M("proposed_fee", "Contractor proposed profit/fee"),
        M("objective_fee", "Government objective profit/fee"),
        M("maximum_fee", "Government maximum profit/fee"),
        M("proposed_price", "Contractor proposed total price", "quoted_price"),
        M("objective_price", "Government objective total price"),
        M("maximum_price", "Government maximum total price"),
        X("sig_name", "Name", "co_name"),
        X("sig_title", "Title"),
        X("concurrence_name", "CONCURRENCE/APPROVAL: name"),
        X("concurrence_title", "CONCURRENCE/APPROVAL: title"),
        X("approval_name", "APPROVAL: name"),
        X("approval_title", "APPROVAL: title"),
        X("epo_concurrence", "Concurrence: Director, Enterprise Pricing Office", undefined, "Required for any action over $500 million or approved by the Assistant Administrator / Senior Procurement Executive."),
      ],
    },
    {
      id: "attachments",
      title: "VI. OTHER ATTACHMENTS",
      citation: "FAR 4.801",
      tier: "binding",
      fields: [T("attachments", "Attachments: any additional information supporting the contracting officer's negotiation objectives")],
    },
  ],
};

// ------------------------------------------------ 12. TCP evaluation memo
const tcpEvaluationMemo: TemplateDef = {
  key: "tcp-evaluation-memo",
  name: "Total Compensation Plan (TCP) Evaluation Memo",
  tab: "54",
  layout: "memo",
  badge: {
    citation: "FAR 52.222-46; FAR 22.1103; 29 CFR 541",
    tier: "binding",
    revision: "HQ 06/2025 revision",
    effective: "2025-06-01",
    note: "Records the evaluation of an offeror's total compensation plan.",
  },
  lead: "Memorandum recording the evaluation of an offeror's total compensation plan.",
  sections: [
    {
      id: "header",
      title: "Total Compensation Plan (TCP) Evaluation Memo",
      citation: "FAR 52.222-46",
      tier: "binding",
      fields: [
        D("memo_date", "Date"),
        X("requirement_title", "Title of the requirement being negotiated", "title"),
        X("team_name", "Evaluation team"),
        X("offeror_name", "Offeror", "vendor_legal_name"),
      ],
    },
    {
      id: "background",
      title: "Description and Background of the proposed action:",
      citation: "FAR 52.222-46",
      tier: "binding",
      standingText:
        "The evaluation team named above has evaluated the Total Compensation Plan (TCP) for the offeror named above as provided by Federal Acquisition Regulation (FAR) 52.222-46, Evaluation of Compensation for Professional Employees, and other applicable provisions.",
      fields: [
        T("background", "Brief description of the acquisition, including the period and place(s) of performance", "description_of_requirement"),
      ],
    },
    {
      id: "evaluation",
      title: "TCP Evaluation:",
      citation: "FAR 52.222-46; FAR 22.1103",
      tier: "binding",
      standingText:
        "The evaluation covers: 1. Assessment of the offeror's ability to provide uninterrupted high-quality work. 2. Validation that the professional compensation proposed has been considered in terms of its impact upon recruiting and retention, and realism. 3. Assessment of consistency between the plan for compensation and other proposed approaches.",
      fields: [
        T("plans_described", "The offeror's and subcontractors' plans: salaries, fringe benefits and supporting surveys"),
        T("direct_labor_comparison", "Comparison of proposed direct labor rates to incumbent rates and market rates"),
        T("fringe_comparison", "Comparison of proposed fringe benefits to incumbent rates and market data"),
        T("total_comparison", "Comparison of total compensation proposed to incumbent and market data"),
        T("skill_mix", "Skill mix, ability to attract and retain, and program continuity"),
        T("conclusion", "Findings, and any cost realism adjustment to the direct labor rate component"),
      ],
    },
  ],
};

// ------------------------------------------------ 13. Requirements statements list
const requirementsStatementsList: TemplateDef = {
  key: "requirements-statements-list",
  name: "Requirements Statements List",
  tab: "010",
  layout: "plan",
  badge: {
    citation: "NFS Appendix C; NFS 1801.471",
    tier: "binding",
    revision: "HQ 02/2026 revision",
    effective: "2026-02-01",
    note: "Requirements statements shall not be changed without approval of a deviation in accordance with NFS 1801.471.",
  },
  lead: "Contract attachment listing the agency requirements statements invoked by the contract.",
  sections: [
    {
      id: "cover",
      title: "REQUIREMENTS STATEMENTS LIST",
      citation: "NFS Appendix C",
      tier: "binding",
      standingText: "National Aeronautics and Space Administration",
      fields: [
        X("attachment_number", "Attachment number"),
        X("center_name", "Center name", "center_code"),
        X("contract_number", "Contract number", "acquisition_id"),
      ],
    },
    {
      id: "change_log",
      title: "DOCUMENT CHANGE LOG",
      citation: "NFS Appendix C",
      tier: "binding",
      fields: [
        T("change_log", "Requirement statement title, revision and date (one per line)"),
      ],
    },
    {
      id: "statements",
      title: "REQUIREMENTS STATEMENTS",
      citation: "NFS Appendix C; NFS 1801.471",
      tier: "binding",
      standingText:
        "This requirements statements list consists of requirements that supplement the statement of work or performance work statement. These requirements are specific to agency-required procedures or protocols concerning matters related to contracts or other agreements; as a result, the requirements selected below are invoked by the contract identified above.",
      fields: [
        YESNO("background_investigations", "Background Investigations (FEB 2026)"),
        YESNO("counterintelligence_briefings", "Counterintelligence Briefings (AUG 2025)"),
        X("cict_office", "Cognizant NASA CI/CT Office contact and phone number"),
        YESNO("foreign_travel", "Foreign Travel by Contractor Employees on NASA Official Business (AUG 2025)"),
        YESNO("lunar_artifacts", "Protecting and Preserving the Historic and Scientific Value of U.S. Government Lunar Artifacts (AUG 2025)"),
      ],
    },
    {
      id: "background_investigations_text",
      title: "Background Investigations (FEB 2026)",
      citation: "NFS Appendix C",
      tier: "binding",
      collapsed: true,
      showIf: (v: Values) => v["background_investigations"] === "Yes",
      standingText:
        "Federal employees and contractors must undergo a background investigation if they require logical and physical access for more than 179 days (in a 365-day period). It is imperative to be transparent and answer all questions completely and accurately, as inaccurate information may lead to an unfavorable adjudication.",
      fields: [],
    },
    {
      id: "counterintelligence_text",
      title: "Counterintelligence Briefings (AUG 2025)",
      citation: "NPR 1660.1",
      tier: "binding",
      collapsed: true,
      showIf: (v: Values) => v["counterintelligence_briefings"] === "Yes",
      standingText:
        "If a contractor or subcontractor employee is going on official NASA travel to designated countries, Russia and/or other high intelligence-threat locations, a pre- and post-travel Counterintelligence Threat Briefing and Debriefing is required, per NASA Procedural Requirements (NPR) 1660.1 entitled, \u201cNASA Counterintelligence and Counterterrorism.\u201d The contractor shall contact the cognizant NASA Center Counterintelligence/Counter Terrorism (CI/CT) office at least two weeks prior to traveling and schedule a debriefing within one week of returning from travel.",
      fields: [],
    },
    {
      id: "foreign_travel_text",
      title: "Foreign Travel by Contractor Employees on NASA Official Business (AUG 2025)",
      citation: "NPR 2810.2; NF 1908",
      tier: "binding",
      collapsed: true,
      showIf: (v: Values) => v["foreign_travel"] === "Yes",
      standingText:
        "Contractor employees traveling internationally on NASA official business must obtain a country clearance via the Department of State (DOS) electronic Country Clearance (eCC) process and complete a NASA Form (NF) 1908, NASA Advance Travel Notification Form (ATNF) for International Travel, at least 30 business days prior to departure. Forms submitted less than 10 business days prior to departure have a presumption of denial, and require justification signed by the Center Director or designated senior individual at the cognizant NASA Center.\n\nForeign Affairs Counter Threat E-Learning (eFACT): All contractor employees traveling internationally on NASA official business must complete the eFACT training course regardless of destination. eFACT and CTAT course certification is valid for six years.\n\nForeign Affairs Counter Threat (FACT): Contractor employees are not required to complete FACT training unless the requirement is specifically included elsewhere in this contract.",
      fields: [],
    },
    {
      id: "lunar_artifacts_text",
      title: "Protecting and Preserving the Historic and Scientific Value of U.S. Government Lunar Artifacts (AUG 2025)",
      citation: "Public Law 116-275",
      tier: "binding",
      collapsed: true,
      showIf: (v: Values) => v["lunar_artifacts"] === "Yes",
      standingText:
        "Contractor shall follow the recommendations outlined in NASA's Recommendations to Space-Faring Entities: How to Protect and Preserve the Historic and Scientific Value of U.S. Government Lunar Artifacts issued by NASA on July 20, 2011, and updated on October 28, 2011 and Public Law 116-275, \u201cOne Small Step to Protect Human Heritage.\u201d Contractor shall also consult with NASA prior to implementing any successor recommendations, guidelines, best practices, or standards relating to the principle of due regard and the limitation of harmful interference with Apollo landing site artifacts issued by NASA.",
      fields: [],
    },
  ],
};

export const HQ5_TEMPLATES: TemplateDef[] = [
  sebAppointment,
  setAppointment,
  ssaAppointment,
  drfpCoverLetter,
  finalRfpCoverLetter,
  rfpNoncompetitive,
  rfpExistingContract,
  blackoutNotice,
  electronicPostingChecklist,
  cbaNotification,
  ppm,
  tcpEvaluationMemo,
  requirementsStatementsList,
];

export const HQ5_TEMPLATE_KEYS = HQ5_TEMPLATES.map((t) => t.key);

/** Phase each Batch 5 document belongs to. */
export const HQ5_PHASES: Record<string, string> = {
  "seb-appointment": "Solicitation/Quote",
  "set-appointment": "Solicitation/Quote",
  "ssa-appointment": "Solicitation/Quote",
  "drfp-cover-letter": "Solicitation/Quote",
  "final-rfp-cover-letter": "Solicitation/Quote",
  "rfp-noncompetitive": "Solicitation/Quote",
  "rfp-existing-contract": "Administration",
  "blackout-notice": "Solicitation/Quote",
  "electronic-posting-checklist": "Solicitation/Quote",
  "cba-notification": "Solicitation/Quote",
  ppm: "Price Reasonableness",
  "tcp-evaluation-memo": "Technical Evaluation",
  "requirements-statements-list": "Solicitation/Quote",
};
