// NF 1707 (03/23) signature and concurrence blocks, in the order the form
// prints them, with the block name exactly as printed.
//
// Visibility follows the form's own visibility scripts. Every block is hidden
// unless its trigger is met; hidden blocks are still listed on the file under
// "Not applicable to this action" with the reason, so nothing is dropped
// silently.
//
// Funds certification is not a block on the NF 1707 — it is on the PR in SAP —
// so it is not listed here.

export type SignoffStatus = "not_sent" | "sent" | "concurred" | "non_concurred";

export const SIGNOFF_STATUS_LABEL: Record<SignoffStatus, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  concurred: "Concurred",
  non_concurred: "Non-concurred with comment",
};

export type SignoffAnswers = Record<string, string>;

export type SignoffBlock = {
  /** Exactly as printed on the form. */
  blockName: string;
  /** Form section the block sits in; also the stored form_section. */
  formSection: string;
  /** Signature field on the form; left blank on export. */
  sigField: string;
  /** Text field that carries the printed name, title and date. */
  textField: string | null;
  /** Intake section the reviewer is reviewing. */
  sectionKey: string;
  sectionTitle: string;
  /** Default reviewer title when the Center routing table has no entry. */
  defaultTitle: string;
  citation: string;
  /** Plain reason shown when the block is hidden. */
  hiddenReason: string;
  /** Form visibility rule. */
  applies: (a: SignoffAnswers, center: string) => boolean;
};

const on = (a: SignoffAnswers, ...keys: string[]) =>
  keys.some((k) => a[k] === "true" || a[k] === "1" || a[k] === "yes");

/** Section 6-I exclusions: NPR 8735.2C does not apply, so no Quality POC. */
const QUALITY_EXCLUSIONS = [
  "s6_exempt_it_infra",
  "s6_exempt_it_services",
  "s6_exempt_software",
  "s6_exempt_facilities",
  "s6_exempt_agreement",
  "Section6s1.Section6s1.S6In2",
  "Section6s1.Section6s1.S6In3",
  "Section6s1.Section6s1.S6In4",
  "Section6s1.Section6s1.S6In6",
  "Section6s1.Section6s1.S6In9",
];

/** Any Green Procurement Compilation waiver reason checked at ARC. */
const ARC_WAIVER_REASONS = [
  "s3_waiver1",
  "s3_waiver2",
  "s3_waiver3",
  "s3_waiver4",
  "Section3Old.ARC1.Waiver",
  "Section3Old.ARC1.Waiver1",
  "Section3Old.ARC1.Waiver2",
  "Section3Old.ARC1.Waiver3",
  "Section3Old.ARC1.Waiver4",
];

export const SIGNOFF_BLOCKS: SignoffBlock[] = [
  {
    blockName: "Approver Approval",
    formSection: "Header",
    sigField: "HeaderWrapper.ApproverApproval.ApproverApprovalConcurrenceSig",
    textField: "HeaderWrapper.ApproverApproval.ApproverApprovalConcurrence",
    sectionKey: "record",
    sectionTitle: "Requirement record",
    defaultTitle: "Requisition approver",
    citation: "NF 1707 (03/23) header",
    hiddenReason: "",
    applies: () => true,
  },
  {
    blockName: "Requisitioner Approval",
    formSection: "Header",
    sigField: "HeaderWrapper.GRC1Approval.GRC1ConcurrenceSig",
    textField: "HeaderWrapper.GRC1Approval.GRC1Concurrence",
    sectionKey: "record",
    sectionTitle: "Requirement record",
    defaultTitle: "Requisitioner",
    citation: "NF 1707 (03/23) header, GRC",
    hiddenReason: "Printed only at GRC.",
    applies: (_a, center) => center === "GRC",
  },
  {
    blockName: "KSC Environmental Management Branch Approval",
    formSection: "Section 3",
    sigField: "Section3Old.KSC2Approval.KSC2ConcurrenceSig",
    textField: "Section3Old.KSC2Approval.KSC2Concurrence",
    sectionKey: "3",
    sectionTitle: "Environmental",
    defaultTitle: "Environmental Management Branch",
    citation: "NF 1707 Section 3, KSC waiver for sustainable acquisition",
    hiddenReason: "Printed only at KSC.",
    applies: (_a, center) => center === "KSC",
  },
  {
    blockName: "Environmental Management Branch Approval",
    formSection: "Section 3",
    sigField: "Section3Old.ARC1Approval.ARC1ConcurrenceSig",
    textField: "Section3Old.ARC1Approval.ARC1Concurrence",
    sectionKey: "3",
    sectionTitle: "Environmental",
    defaultTitle: "Environmental Management Branch",
    citation: "NF 1707 Section 3, ARC waiver for sustainable acquisition",
    hiddenReason: "Printed at ARC only when a waiver from the Green Procurement Compilation requirement is requested.",
    applies: (a, center) => center === "ARC" && on(a, ...ARC_WAIVER_REASONS),
  },
  {
    blockName: "Quality Point of Contact Signature",
    formSection: "Section 6",
    sigField: "Section6s5.Section6s5.QualityPOCSig",
    textField: "Section6s5.Section6s5.QualityPOCTxt",
    sectionKey: "6",
    sectionTitle: "Quality assurance",
    defaultTitle: "Quality point of contact",
    citation: "NPR 8735.2C; NF 1707 Section 6-I",
    hiddenReason: "Hidden when a Section 6-I exclusion is checked, and at SSC.",
    applies: (a, center) => center !== "SSC" && !on(a, ...QUALITY_EXCLUSIONS),
  },
  {
    blockName: "Center GIDEP Coordinator Signature",
    formSection: "Section 6",
    sigField: "Section6s7.Section6s7.CenterGIDEPSig",
    textField: "Section6s7.Section6s7.CenterGIDEPTxt",
    sectionKey: "6",
    sectionTitle: "Quality assurance",
    defaultTitle: "Center GIDEP coordinator",
    citation: "NPR 8735.1; NF 1707 Section 6-IV",
    hiddenReason: "Printed only when the procurement is for safety critical items.",
    applies: (a) => on(a, "s6_gidep", "Section6s6.Section6s6.S6VIn1"),
  },
  {
    blockName: "Health & Safety Signature",
    formSection: "Section 7",
    sigField: "Section7.HnS.HnSSig",
    textField: "Section7.HnS.HnSTxt",
    sectionKey: "7",
    sectionTitle: "Safety and health",
    defaultTitle: "Health and safety official",
    citation: "NPR 8715.3; NF 1707 Section 7",
    hiddenReason: "",
    applies: () => true,
  },
  {
    blockName: "KSC PSM Approval",
    formSection: "Section 7",
    sigField: "PSMSigS5.PSMSigS5.PSMApprovalSig",
    textField: "PSMSigS5.PSMSigS5.PSMApproval",
    sectionKey: "7",
    sectionTitle: "Safety and health",
    defaultTitle: "KSC Pressure Systems Manager",
    citation: "NPD 8710.5; NF 1707 Section 6-IV, KSC",
    hiddenReason: "Printed at KSC only when pressure vessels or systems are checked.",
    applies: (a, center) =>
      center === "KSC" && on(a, "s7_pressure", "Section6s7.KSC4s1.KSC4c2"),
  },
  ...(["Radiation", "ESO", "BSO", "Safety", "SHRB"] as const).map((k) => ({
    blockName: `KSC-DL-1707-${k}@mail.nasa.gov Approval`,
    formSection: "Section 7",
    sigField: `Section7.${k === "Radiation" ? "HealthApprove.HealthApprovalSig" : k === "ESO" ? "SafetyApprove.SafetyApprovalSig" : k === "BSO" ? "BSOApprove.BSOApprovalSig" : k === "Safety" ? "Safety2Approve.Safety2ApprovalSig" : "SHRBApprove.SHRBApprovalSig"}`,
    textField: null,
    sectionKey: "7",
    sectionTitle: "Safety and health",
    defaultTitle: `KSC ${k} routing`,
    citation: "NF 1707 Section 7, KSC routing",
    hiddenReason: "Printed only at KSC, by the Section 7 hazard boxes checked.",
    applies: (_a: SignoffAnswers, center: string) => center === "KSC",
  })),
];

/** Which blocks the form shows for this record, in form order. */
export function applicableBlocks(answers: SignoffAnswers, centerCode: string | null): SignoffBlock[] {
  return SIGNOFF_BLOCKS.filter((b) => b.applies(answers, centerCode ?? ""));
}

/** Blocks the form hides for this record, in form order. */
export function hiddenBlocks(answers: SignoffAnswers, centerCode: string | null): SignoffBlock[] {
  return SIGNOFF_BLOCKS.filter((b) => !b.applies(answers, centerCode ?? ""));
}

/** Reviewer title from the Center routing table, falling back to the form's own title. */
export function reviewerTitle(
  block: SignoffBlock,
  routing: { center_code: string; document_key: string; approving_official_title: string }[],
  centerCode: string | null,
): string {
  const key = `nf-1707:${block.sigField || block.blockName}`;
  const match =
    routing.find((r) => r.document_key === key && r.center_code === (centerCode ?? "")) ??
    routing.find((r) => r.document_key === key);
  return match?.approving_official_title ?? block.defaultTitle;
}

/**
 * Concurred sign-offs supply the printed name, title and date on the exported
 * form. The signature line itself is always left blank.
 */
export function signatureCells(
  rows: { form_field_name: string; approval_role: string | null; owner_name: string | null; status: string | null; completed_at: string | null }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const block = SIGNOFF_BLOCKS.find((b) => b.sigField === row.form_field_name);
    if (!block || row.status !== "concurred") continue;
    if (block.sigField) out[block.sigField] = "";
    if (block.textField) {
      const date = (row.completed_at ?? "").slice(0, 10);
      out[block.textField] = [row.owner_name ?? "", row.approval_role ?? block.defaultTitle, date].filter(Boolean).join(", ");
    }
  }
  return out;
}

export function nonConcurrences<T extends { status: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.status === "non_concurred");
}
