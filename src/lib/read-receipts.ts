// Read receipts.
//
// A light record that someone opened a document on a file: who, when, which
// document, and where they opened it from. Soft tracking only — nothing here
// holds a file, a phase, a hold or a required document, and nothing is seeded.
// A file stays empty until a real person opens something.

import { supabase } from "@/integrations/supabase/client";

export type ReceiptKind = "template" | "form" | "file";
export type ReceiptSource = "reviewer-inbox" | "document-route" | "form-route";

export type ReadReceiptRow = {
  receipt_id: string;
  acquisition_id: string;
  doc_kind: ReceiptKind;
  doc_key: string;
  doc_label: string | null;
  opened_by: string;
  opened_at: string;
  poll_id: string | null;
  source: string | null;
};

export type ReadReceiptInput = {
  acquisitionId: string;
  docKind: ReceiptKind;
  docKey: string;
  docLabel?: string | null;
  openedBy: string;
  pollId?: string | null;
  source: ReceiptSource;
};

export const READ_RECEIPTS_EMPTY = "No read receipts on this file yet.";
export const READ_RECEIPTS_CHIP = "Soft tracking — does not hold the file.";

/** Two minutes: a second open inside this window is treated as the same visit. */
const DEDUPE_MS = 2 * 60 * 1000;

const SELECT = "receipt_id,acquisition_id,doc_kind,doc_key,doc_label,opened_by,opened_at,poll_id,source";

export function receiptStamp(iso: string | null | undefined): string {
  if (!iso) return "Not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not recorded";
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export async function loadReadReceipts(acquisitionId: string): Promise<ReadReceiptRow[]> {
  const { data, error } = await supabase
    .from("document_read_receipts")
    .select(SELECT)
    .eq("acquisition_id", acquisitionId)
    .order("opened_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReadReceiptRow[];
}

export async function loadReceiptsForDoc(
  acquisitionId: string,
  docKind: ReceiptKind,
  docKey: string,
): Promise<ReadReceiptRow[]> {
  const { data, error } = await supabase
    .from("document_read_receipts")
    .select(SELECT)
    .eq("acquisition_id", acquisitionId)
    .eq("doc_kind", docKind)
    .eq("doc_key", docKey)
    .order("opened_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReadReceiptRow[];
}

/**
 * Record that this person opened this document.
 *
 * Dedupe rule, chosen and documented: the same person opening the same
 * document within two minutes refreshes the time on the existing receipt
 * rather than writing a second row. Nothing here throws into the page — a
 * receipt that cannot be written never blocks reading the document.
 */
export async function recordReadReceipt(input: ReadReceiptInput): Promise<void> {
  if (!input.acquisitionId || !input.docKey || !input.openedBy) return;
  const since = new Date(Date.now() - DEDUPE_MS).toISOString();
  const recent = await supabase
    .from("document_read_receipts")
    .select("receipt_id")
    .eq("acquisition_id", input.acquisitionId)
    .eq("doc_kind", input.docKind)
    .eq("doc_key", input.docKey)
    .eq("opened_by", input.openedBy)
    .gte("opened_at", since)
    .order("opened_at", { ascending: false })
    .limit(1);

  const existing = (recent.data ?? [])[0] as { receipt_id: string } | undefined;
  if (existing) {
    await supabase
      .from("document_read_receipts")
      .update({ opened_at: new Date().toISOString() } as never)
      .eq("receipt_id", existing.receipt_id);
    return;
  }

  const { error } = await supabase.from("document_read_receipts").insert({
    acquisition_id: input.acquisitionId,
    doc_kind: input.docKind,
    doc_key: input.docKey,
    doc_label: (input.docLabel ?? "").trim() || null,
    opened_by: input.openedBy,
    poll_id: input.pollId ?? null,
    source: input.source,
  } as never);
  if (error) return;

  await supabase.from("audit_log").insert({
    acquisition_id: input.acquisitionId,
    actor: input.openedBy,
    action: "Document opened",
    field: input.docKey,
    old_value: null,
    new_value: (input.docLabel ?? "").trim() || input.docKey,
    reason: `Read receipt recorded from the ${input.source}.`,
  } as never);
}

/** Never throws: a receipt is a courtesy, not a gate. */
export function recordReadReceiptQuietly(input: ReadReceiptInput): void {
  void recordReadReceipt(input).catch(() => undefined);
}

/** Receipts across several files at once, newest first. Used by the reviewer inbox. */
export async function loadReceiptsForAcquisitions(ids: string[]): Promise<ReadReceiptRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("document_read_receipts")
    .select(SELECT)
    .in("acquisition_id", ids)
    .order("opened_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReadReceiptRow[];
}
