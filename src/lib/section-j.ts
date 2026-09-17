// Section J — the list of attachments on the file.
//
// Section J is the list of documents attached to the acquisition, not a clause
// bucket. The rows here are the real attachments on the record
// (document_attachments): nothing is invented, and an empty list says so
// plainly. The same list rides in the local handoff packet so a contracting
// officer does not have to hunt for it. NCMS remains the system of record.

import type { AttachmentRow } from "@/lib/attachments";
import { tabRank } from "@/lib/file-index";

export type SectionJAttachment = {
  label: string;
  file_name: string;
  /** The NF 1098 tab on the row, or an em dash where the row carries none. */
  nf_1098_tab: string;
  doc_key?: string | undefined;
};

/** What the empty list says. Calm and honest; never clause wording. */
export const SECTION_J_EMPTY =
  "No attachments on this file. The office adds one when the record calls for it.";

/**
 * The attachments on the file, ordered by NF 1098 tab, then label, then the
 * order they were attached.
 */
export function attachmentsForSectionJ(
  rows: Array<Partial<AttachmentRow>> | null | undefined,
): SectionJAttachment[] {
  const list = (rows ?? []).map((r) => ({
    label: String(r.doc_label ?? "").trim() || "Attachment",
    file_name: String(r.file_name ?? "").trim() || "File name not recorded",
    nf_1098_tab: String(r.nf_1098_tab ?? "").trim() || "—",
    doc_key: r.doc_key ?? undefined,
    created_at: String(r.created_at ?? ""),
  }));
  list.sort(
    (a, b) =>
      tabRank(a.nf_1098_tab) - tabRank(b.nf_1098_tab) ||
      a.label.localeCompare(b.label) ||
      a.created_at.localeCompare(b.created_at),
  );
  return list.map(({ created_at: _created_at, ...rest }) => rest);
}

/** What the Section J cell reads in the A–M table. */
export function sectionJSummary(attachments: SectionJAttachment[]): string {
  if (attachments.length === 0) return SECTION_J_EMPTY;
  const count = `${attachments.length} file${attachments.length === 1 ? "" : "s"} on the record`;
  return `${count}; see the list of attachments below.`;
}
