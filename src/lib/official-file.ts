/**
 * Official file copy (soft).
 *
 * One saved document version per template on a file can be marked as the
 * official final copy. The marks live in the document's existing
 * `field_values` JSON, so there is no schema change and drafts are never
 * deleted. Nothing here holds a file, changes a clock, or blocks a phase exit.
 */
import { supabase } from "@/integrations/supabase/client";

export const OFFICIAL_KEY = "__official_final";
export const OFFICIAL_AT_KEY = "__official_filed_at";
export const OFFICIAL_BY_KEY = "__official_filed_by";

export type OfficialMeta = { official: boolean; filedAt: string | null; filedBy: string | null };

export const FILE_IT_LABEL = "This is the final version — file it";
export const FILE_IT_NOTE =
  "This marks the latest saved version as the official file copy. It does not send email and does not write to NCMS.";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function isOfficialFinal(fieldValues: unknown): boolean {
  const v = asRecord(fieldValues)[OFFICIAL_KEY];
  return v === true || v === "true";
}

export function officialMeta(fieldValues: unknown): OfficialMeta {
  const fv = asRecord(fieldValues);
  const at = fv[OFFICIAL_AT_KEY];
  const by = fv[OFFICIAL_BY_KEY];
  return {
    official: isOfficialFinal(fieldValues),
    filedAt: typeof at === "string" && at.trim() ? at : null,
    filedBy: typeof by === "string" && by.trim() ? by : null,
  };
}

/** Official / Draft / — for an index or versions table. */
export function officialLabel(fieldValues: unknown): "Official" | "Draft" {
  return isOfficialFinal(fieldValues) ? "Official" : "Draft";
}

export function officialFieldValues(fieldValues: unknown, actor: string, at: string): Record<string, unknown> {
  return { ...asRecord(fieldValues), [OFFICIAL_KEY]: true, [OFFICIAL_AT_KEY]: at, [OFFICIAL_BY_KEY]: actor };
}

export function clearedFieldValues(fieldValues: unknown): Record<string, unknown> {
  const fv = { ...asRecord(fieldValues) };
  delete fv[OFFICIAL_KEY];
  delete fv[OFFICIAL_AT_KEY];
  delete fv[OFFICIAL_BY_KEY];
  return fv;
}

/**
 * Mark one saved version as the official file copy for its template on this
 * acquisition, and clear the mark from the other versions so only one official
 * copy exists. Records one audit line. Never touches the clock or a hold.
 */
export async function fileAsOfficialFinal(input: {
  acquisitionId: string;
  templateId: string;
  documentId: string;
  version: number;
  templateName: string;
  actor: string;
  phase?: string | null;
}): Promise<void> {
  const at = new Date().toISOString();
  const rows = await supabase
    .from("documents")
    .select("document_id,field_values")
    .eq("acquisition_id", input.acquisitionId)
    .eq("template_id", input.templateId);
  if (rows.error) throw new Error(rows.error.message);

  for (const row of rows.data ?? []) {
    const id = String(row.document_id);
    if (id === input.documentId) {
      const next = officialFieldValues(row.field_values, input.actor, at);
      const { error } = await supabase
        .from("documents")
        .update({ field_values: next as never })
        .eq("document_id", id);
      if (error) throw new Error(error.message);
    } else if (isOfficialFinal(row.field_values)) {
      const { error } = await supabase
        .from("documents")
        .update({ field_values: clearedFieldValues(row.field_values) as never })
        .eq("document_id", id);
      if (error) throw new Error(error.message);
    }
  }

  const { error: logError } = await supabase.from("audit_log").insert({
    acquisition_id: input.acquisitionId,
    actor: input.actor,
    action: "Document filed as official final",
    field: input.templateName,
    new_value: `version ${input.version}`,
    reason: `${input.actor} filed version ${input.version} as the official copy on ${at.slice(0, 10)}`,
    phase: input.phase ?? null,
  });
  if (logError) throw new Error(logError.message);
}

/**
 * Take the official mark off a version. The version itself is never deleted;
 * it stays on the file as a draft. One audit line is recorded.
 */
export async function unfileOfficialFinal(input: {
  acquisitionId: string;
  documentId: string;
  version: number;
  templateName: string;
  actor: string;
  phase?: string | null;
}): Promise<void> {
  const row = await supabase
    .from("documents")
    .select("field_values")
    .eq("document_id", input.documentId)
    .maybeSingle();
  if (row.error) throw new Error(row.error.message);

  const { error } = await supabase
    .from("documents")
    .update({ field_values: clearedFieldValues(row.data?.field_values) as never })
    .eq("document_id", input.documentId);
  if (error) throw new Error(error.message);

  const { error: logError } = await supabase.from("audit_log").insert({
    acquisition_id: input.acquisitionId,
    actor: input.actor,
    action: "Official final mark removed",
    field: input.templateName,
    old_value: `version ${input.version}`,
    new_value: null,
    reason: `${input.actor} unfiled version ${input.version}. The version stays on the file as a draft.`,
    phase: input.phase ?? null,
  });
  if (logError) throw new Error(logError.message);
}
