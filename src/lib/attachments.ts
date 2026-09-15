// Real file attachments on an acquisition file.
//
// A document row only reads "Attached" once a file exists: the file is stored
// in the private attachments bucket, a row is written here, and an audit entry
// records who attached what and when. Cancelling the picker changes nothing.

import { supabase } from "@/integrations/supabase/client";
import { clinsFromSheet, isSpreadsheetFile, readSpreadsheet, type SheetClin } from "@/lib/spreadsheet";

/** What the picker offers everywhere an attachment is taken. */
export const ATTACHMENT_ACCEPT =
  ".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain";

export type AttachmentRow = {
  attachment_id: string;
  acquisition_id: string;
  doc_key: string;
  doc_label: string;
  nf_1098_tab: string | null;
  file_name: string;
  storage_path: string;
  uploaded_by_name: string | null;
  parsed_total: number | null;
  created_at: string;
};

/**
 * Requester-package records sit under the requisition tab of the NF 1098
 * index; drafted documents keep the tab carried by their template.
 */
export const REQUESTER_PACKAGE_TAB = "001";

export const DOC_TABS: Record<string, string> = {
  igce_attached: REQUESTER_PACKAGE_TAB,
  sow_attached: REQUESTER_PACKAGE_TAB,
  pr: REQUESTER_PACKAGE_TAB,
  "nf-1707": "—",
  funds_certified: REQUESTER_PACKAGE_TAB,
  acquisition_forecast_verified: REQUESTER_PACKAGE_TAB,
  jofoc_authority_citation: "015",
};

export function docKey(field: string | undefined, label: string): string {
  return field ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function tabFor(key: string): string {
  return DOC_TABS[key] ?? REQUESTER_PACKAGE_TAB;
}

export async function loadAttachments(acquisitionId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from("document_attachments")
    .select("attachment_id,acquisition_id,doc_key,doc_label,nf_1098_tab,file_name,storage_path,uploaded_by_name,parsed_total,created_at")
    .eq("acquisition_id", acquisitionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttachmentRow[];
}

function safeName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
}

export async function uploadAttachment(input: {
  acquisitionId: string;
  key: string;
  label: string;
  file: File;
  actor: string;
  parsedTotal?: number | null;
}): Promise<AttachmentRow> {
  if (input.file.size > 20 * 1024 * 1024) throw new Error(`${input.file.name} is larger than 20 MB.`);
  const path = `${input.acquisitionId}/${input.key}/${Date.now()}-${safeName(input.file.name)}`;
  const upload = await supabase.storage.from("attachments").upload(path, input.file, {
    contentType: input.file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);

  const { data, error } = await supabase
    .from("document_attachments")
    .insert({
      acquisition_id: input.acquisitionId,
      doc_key: input.key,
      doc_label: input.label,
      nf_1098_tab: tabFor(input.key),
      file_name: input.file.name,
      storage_path: path,
      content_type: input.file.type || null,
      size_bytes: input.file.size,
      uploaded_by_name: input.actor,
      parsed_total: input.parsedTotal ?? null,
    } as never)
    .select()
    .single();
  if (error) {
    await supabase.storage.from("attachments").remove([path]);
    throw new Error(error.message);
  }

  await supabase.from("audit_log").insert({
    acquisition_id: input.acquisitionId,
    actor: input.actor,
    action: "Document attached",
    field: input.key,
    old_value: null,
    new_value: input.file.name,
    reason: `${input.label} attached to the contract file, tab ${tabFor(input.key)}`,
  } as never);

  return data as AttachmentRow;
}

export async function removeAttachment(row: AttachmentRow, actor: string): Promise<void> {
  const { error } = await supabase
    .from("document_attachments")
    .delete()
    .eq("attachment_id", row.attachment_id);
  if (error) throw new Error(error.message);
  await supabase.storage.from("attachments").remove([row.storage_path]);
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "Document removed",
    field: row.doc_key,
    old_value: row.file_name,
    new_value: null,
    reason: `${row.doc_label} removed from the contract file`,
  } as never);
}

export async function downloadAttachment(row: AttachmentRow): Promise<string | null> {
  const { data } = await supabase.storage.from("attachments").createSignedUrl(row.storage_path, 300);
  return data?.signedUrl ?? null;
}

export type IgceRead = { clins: SheetClin[]; total: number | null; totalLabel: string; sheetName: string };

/** Read an uploaded IGCE. Returns null when the file is not a spreadsheet. */
export async function igceFromFile(file: File, sourceId = "upload"): Promise<IgceRead | null> {
  if (!isSpreadsheetFile(file)) return null;
  const read = await readSpreadsheet(file);
  const clins = clinsFromSheet(read, read.mapping, sourceId);
  const total = read.total ? Number(read.total) : null;
  return { clins, total: Number.isFinite(total as number) ? total : null, totalLabel: read.totalLabel, sheetName: read.sheetName };
}

/** Replace the CLIN rows on a file with the rows read from an IGCE. */
export async function saveIgceClins(acquisitionId: string, clins: SheetClin[]): Promise<void> {
  if (!clins.length) return;
  await supabase.from("igce_clins").delete().eq("acquisition_id", acquisitionId);
  const number = (value: string) => {
    const cleaned = value.replace(/[$,\s]/g, "");
    return cleaned && /^-?\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : null;
  };
  const rows = clins.map((clin) => ({
    acquisition_id: acquisitionId,
    clin_number: clin.clinNumber,
    description: clin.description || clin.clinNumber,
    quantity: number(clin.quantity),
    unit_of_issue: clin.unit || null,
    unit_price: number(clin.unitPrice),
    extended_price: number(clin.extendedPrice),
    period_start: /^\d{4}-\d{2}-\d{2}$/.test(clin.periodStart) ? clin.periodStart : null,
    period_end: /^\d{4}-\d{2}-\d{2}$/.test(clin.periodEnd) ? clin.periodEnd : null,
  }));
  const { error } = await supabase.from("igce_clins").insert(rows as never);
  if (error) throw new Error(error.message);
}
