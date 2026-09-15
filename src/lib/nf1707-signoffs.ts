// NF 1707 signature and concurrence blocks, read from the current form in
// t-minus-seed/nf1707_fields_full.csv (field_kind = signature), kept in the
// order they are printed on the form, with the block name exactly as printed.
//
// A block is only listed when the record makes that review apply: the funds
// certification always applies, every other block applies when the gate
// section that triggers it is answered yes (and, where the form prints the
// block only for one Center, when the record is at that Center).
//
// Blocks whose trigger is not stated by the form or a cited regulation are
// listed in UNMAPPED_BLOCKS. They are never routed on a guess.

export type SignoffStatus = "not_sent" | "sent" | "concurred" | "non_concurred";

export const SIGNOFF_STATUS_LABEL: Record<SignoffStatus, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  concurred: "Concurred",
  non_concurred: "Non-concurred with comment",
};

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
  /** Gate answer that makes the block apply; null means it always applies. */
  gate: "services" | "it" | "hardware" | "space" | "aviation" | "hazards" | null;
  /** Extra condition on the stored answers. */
  requiresAnswer?: { key: string; equals: string[] };
  /** Only printed for this Center. */
  center: string | null;
  citation: string;
};

export const SIGNOFF_BLOCKS: SignoffBlock[] = [
  {
    blockName: "Funds certification",
    formSection: "Record",
    sigField: "",
    textField: null,
    sectionKey: "record",
    sectionTitle: "Funding on the record",
    gate: null,
    center: null,
    citation: "FAR 32.702; NFS 1832.702",
  },
  {
    blockName: "Quality Point of Contact Signature",
    formSection: "Section 6",
    sigField: "Section6s5.Section6s5.QualityPOCSig",
    textField: "Section6s5.Section6s5.QualityPOCTxt",
    sectionKey: "6",
    sectionTitle: "Quality assurance",
    gate: "hardware",
    center: null,
    citation: "NPR 8735.2C; FAR 46.202-4",
  },
  {
    blockName: "Center GIDEP Coordinator Signature",
    formSection: "Section 6",
    sigField: "Section6s7.Section6s7.CenterGIDEPSig",
    textField: "Section6s7.Section6s7.CenterGIDEPTxt",
    sectionKey: "6",
    sectionTitle: "Quality assurance",
    gate: "hardware",
    requiresAnswer: { key: "s6_gidep", equals: ["yes"] },
    center: null,
    citation: "NPD 8730.2; NF 1707 Section 6",
  },
  {
    blockName: "Health & Safety Signature",
    formSection: "Section 7",
    sigField: "Section7.HnS.HnSSig",
    textField: "Section7.HnS.HnSTxt",
    sectionKey: "7",
    sectionTitle: "Safety and health",
    gate: "hazards",
    center: null,
    citation: "NPR 8715.3; NF 1707 Section 7",
  },
];

/** Printed blocks whose trigger the form does not state. Never routed on a guess. */
export const UNMAPPED_BLOCKS: { blockName: string; formSection: string; center: string | null }[] = [
  { blockName: "Approver Approval", formSection: "Header", center: null },
  { blockName: "Requisitioner Approval", formSection: "Header", center: "GRC" },
  { blockName: "KSC Environmental Management Branch Approval", formSection: "Section 3", center: "KSC" },
  { blockName: "Environmental Management Branch Approval", formSection: "Section 3", center: "ARC" },
  { blockName: "KSC PSM Approval", formSection: "Section 7", center: "KSC" },
  { blockName: "KSC-DL-1707-Radiation@mail.nasa.gov Approval", formSection: "Section 7", center: "KSC" },
  { blockName: "KSC-DL-1707-ESO@mail.nasa.gov Approval", formSection: "Section 7", center: "KSC" },
  { blockName: "KSC-DL-1707-BSO@mail.nasa.gov Approval", formSection: "Section 7", center: "KSC" },
  { blockName: "KSC-DL-1707-Safety@mail.nasa.gov Approval", formSection: "Section 7", center: "KSC" },
  { blockName: "KSC-DL-1707-SHRB@mail.nasa.gov Approval", formSection: "Section 7", center: "KSC" },
];

/** Which blocks the record makes apply, in form order. */
export function applicableBlocks(answers: Record<string, string>, centerCode: string | null): SignoffBlock[] {
  return SIGNOFF_BLOCKS.filter((block) => {
    if (block.center && block.center !== (centerCode ?? "")) return false;
    if (block.gate && answers[`gate.${block.gate}`] !== "yes") return false;
    if (block.requiresAnswer && !block.requiresAnswer.equals.includes(answers[block.requiresAnswer.key] ?? "")) return false;
    return true;
  });
}

/** Reviewer title from the Center routing table, falling back to the block name. */
export function reviewerTitle(
  block: SignoffBlock,
  routing: { center_code: string; document_key: string; approving_official_title: string }[],
  centerCode: string | null,
): string {
  const key = `nf-1707:${block.sigField || block.blockName}`;
  const match =
    routing.find((r) => r.document_key === key && r.center_code === (centerCode ?? "")) ??
    routing.find((r) => r.document_key === key);
  return match?.approving_official_title ?? block.blockName;
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
      out[block.textField] = [row.owner_name ?? "", row.approval_role ?? block.blockName, date].filter(Boolean).join(", ");
    }
  }
  return out;
}

export function nonConcurrences<T extends { status: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.status === "non_concurred");
}
