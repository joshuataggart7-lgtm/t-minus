// Complete reads of the evidence key rows (stored files and saved document
// versions). Pages through the API row cap so a capped read can never make a
// satisfied document look missing. Never selects field_values.

import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000;
const MAX_PAGES = 200;

export type AttachmentKeyRow = { acquisition_id: string; doc_key: string };
export type DocumentKeyRow = { acquisition_id: string | null; template_id: string | null };

export async function loadAttachmentKeyRows(acquisitionId?: string): Promise<AttachmentKeyRow[]> {
  const out: AttachmentKeyRow[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabase.from("document_attachments").select("acquisition_id,doc_key");
    if (acquisitionId) query = query.eq("acquisition_id", acquisitionId);
    const { data, error } = await query
      .order("attachment_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Stored files could not be read: ${error.message}`);
    const rows = (data ?? []) as AttachmentKeyRow[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
    from += rows.length;
  }
  throw new Error("Stored files could not be read: too many pages.");
}

export async function loadDocumentKeyRows<C extends string = "acquisition_id,template_id">(
  acquisitionId?: string,
  columns?: C,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabase.from("documents").select(columns ?? "acquisition_id,template_id");
    if (acquisitionId) query = query.eq("acquisition_id", acquisitionId);
    const { data, error } = await query
      .order("document_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Saved documents could not be read: ${error.message}`);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
    from += rows.length;
  }
  throw new Error("Saved documents could not be read: too many pages.");
}
