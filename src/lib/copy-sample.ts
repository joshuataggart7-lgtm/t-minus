// "Copy as new sample": a fresh acquisition in the same series carrying the
// intake facts and the requester package of an existing file.
//
// The original file is never touched. The copy starts at Intake with the clock
// running and an empty audit trail apart from one row naming its source.

import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";

/** Intake facts only. Vendor, award, hold and post-award fields never copy. */
const INTAKE_FIELDS = [
  "title",
  "mission_id",
  "center_code",
  "center_name",
  "branch_code",
  "mission_directorate_code",
  "mission_directorate_name",
  "mission_directorate_other",
  "sponsoring_agency",
  "requester_name",
  "requester_org_code",
  "description_of_requirement",
  "estimated_value",
  "period_of_performance_start",
  "period_of_performance_end",
  "place_of_performance",
  "place_of_performance_standardized",
  "naics_code",
  "psc_code",
  "psc_note",
  "contract_type",
  "hybrid_contract_type",
  "acquisition_method",
  "competition",
  "set_aside",
  "commercial_determination",
  "contract_format",
  "funding_fiscal_year",
  "funds_certified",
  "igce_attached",
  "sow_attached",
  "hardware_deliverable",
  "includes_it",
  "is_reimbursable",
  "enterprise_psl_check",
  "co_name",
  "co_code",
  "cor_name",
  "need_date",
  "target_award_date",
  "lead_to_delivery_days",
  "acquisition_forecast_verified",
  "nf1707_answers",
  "intake_estimate",
] as const;

/** A-2027-0101 gives series "A-2027-" and a four-digit counter. */
function seriesOf(acquisitionId: string) {
  const match = /^(.*?)(\d+)$/.exec(acquisitionId);
  if (!match) return { prefix: `${acquisitionId}-`, width: 4 };
  return { prefix: match[1], width: match[2].length };
}

async function nextIdInSeries(sourceId: string): Promise<string> {
  const { prefix, width } = seriesOf(sourceId);
  const { data, error } = await supabase
    .from("acquisition_facts")
    .select("acquisition_id")
    .like("acquisition_id", `${prefix}%`);
  if (error) throw new Error(error.message);
  let highest = 0;
  for (const row of (data ?? []) as { acquisition_id: string }[]) {
    const tail = row.acquisition_id.slice(prefix.length);
    if (/^\d+$/.test(tail)) highest = Math.max(highest, Number(tail));
  }
  return `${prefix}${String(highest + 1).padStart(width, "0")}`;
}

export async function copyAsNewSample(sourceId: string, actorFallback: string): Promise<string> {
  const actor = await signedInName(actorFallback);
  const { data: source, error } = await supabase
    .from("acquisition_facts")
    .select("*")
    .eq("acquisition_id", sourceId)
    .single();
  if (error || !source) throw new Error(error?.message ?? "The file did not load.");

  const newId = await nextIdInSeries(sourceId);
  const facts: Record<string, unknown> = { acquisition_id: newId };
  for (const field of INTAKE_FIELDS) {
    const value = (source as Record<string, unknown>)[field];
    if (value !== undefined) facts[field] = value;
  }
  const { data: auth } = await supabase.auth.getUser();
  facts["status"] = "Open";
  facts["current_phase"] = "Intake";
  facts["clock_state"] = "running";
  facts["hold_reason"] = null;
  facts["hold_owner"] = null;
  facts["hold_started_at"] = null;
  facts["regulatory_baseline_date"] = new Date().toISOString().slice(0, 10);
  facts["is_seed"] = false;
  facts["is_package_complete"] = false;
  facts["source_tag"] = `Copy of ${sourceId}`;
  facts["created_by"] = auth?.user?.id ?? null;

  const insert = await supabase.from("acquisition_facts").insert(facts as never);
  if (insert.error) throw new Error(insert.error.message);

  // Requester package attachments: the stored file is duplicated so removing a
  // document on the copy can never touch the original's file.
  const { data: attachments } = await supabase
    .from("document_attachments")
    .select("doc_key,doc_label,nf_1098_tab,file_name,storage_path,content_type,size_bytes,parsed_total")
    .eq("acquisition_id", sourceId);

  for (const row of (attachments ?? []) as {
    doc_key: string;
    doc_label: string;
    nf_1098_tab: string | null;
    file_name: string;
    storage_path: string;
    content_type: string | null;
    size_bytes: number | null;
    parsed_total: number | null;
  }[]) {
    const download = await supabase.storage.from("attachments").download(row.storage_path);
    if (download.error || !download.data) continue;
    const path = `${newId}/${row.doc_key}/${Date.now()}-${row.file_name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80)}`;
    const upload = await supabase.storage.from("attachments").upload(path, download.data, {
      contentType: row.content_type ?? "application/octet-stream",
      upsert: false,
    });
    if (upload.error) continue;
    const inserted = await supabase
      .from("document_attachments")
      .insert({
        acquisition_id: newId,
        doc_key: row.doc_key,
        doc_label: row.doc_label,
        nf_1098_tab: row.nf_1098_tab,
        file_name: row.file_name,
        storage_path: path,
        content_type: row.content_type,
        size_bytes: row.size_bytes,
        uploaded_by_name: actor,
        parsed_total: row.parsed_total,
      } as never)
      .select("attachment_id")
      .single();
    if (inserted.error) continue;
    await supabase.from("documents").insert({
      acquisition_id: newId,
      field_values: {
        attachment_id: (inserted.data as { attachment_id: string }).attachment_id,
        doc_key: row.doc_key,
        doc_label: row.doc_label,
        file_name: row.file_name,
        storage_path: path,
        nf_1098_tab: row.nf_1098_tab,
        kind: "attachment",
      },
      version: 1,
      saved_by: actor,
      saved_at: new Date().toISOString(),
    } as never);
  }

  // The only entry in the new file's audit trail.
  await supabase.from("audit_log").insert({
    acquisition_id: newId,
    actor,
    action: `Copied from ${sourceId} by ${actor}`,
    field: null,
    old_value: null,
    new_value: newId,
    reason: null,
    phase: "Intake",
  } as never);

  return newId;
}
