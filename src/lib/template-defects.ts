import { supabase } from "@/integrations/supabase/client";

/**
 * Template defects.
 *
 * Anyone working a template can report a defect in it: what is wrong, the
 * citation it turns on, the template name and revision as displayed, and who
 * reported it. Each report writes an audit entry and lands on the PGPD queue,
 * which HQ works. Nothing here is generated; the queue is the table.
 */

export type DefectStatus = "open" | "corrected" | "reported to PGPD" | "closed";

export const DEFECT_STATUSES: DefectStatus[] = ["open", "corrected", "reported to PGPD", "closed"];

export type DefectRow = {
  defect_id: string;
  template_key: string;
  template_name: string;
  revision: string | null;
  citation: string | null;
  defect: string;
  correction: string | null;
  status: string;
  acquisition_id: string | null;
  reporter_name: string;
  reporter_role: string | null;
  reported_at: string;
};

export async function loadDefects(): Promise<DefectRow[]> {
  const { data, error } = await supabase
    .from("template_defects")
    .select(
      "defect_id,template_key,template_name,revision,citation,defect,correction,status,acquisition_id,reporter_name,reporter_role,reported_at",
    )
    .order("reported_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DefectRow[];
}

export type NewDefect = {
  templateKey: string;
  templateName: string;
  revision: string | null;
  citation: string | null;
  defect: string;
  acquisitionId: string | null;
  reporterName: string;
  reporterRole: string | null;
};

/** Records the defect and writes the audit entry for it. */
export async function reportDefect(input: NewDefect): Promise<void> {
  const { error } = await supabase.from("template_defects").insert({
    template_key: input.templateKey,
    template_name: input.templateName,
    revision: input.revision,
    citation: input.citation,
    defect: input.defect,
    status: "open",
    acquisition_id: input.acquisitionId,
    reporter_name: input.reporterName,
    reporter_role: input.reporterRole,
  } as never);
  if (error) throw new Error(error.message);

  const { error: logError } = await supabase.from("audit_log").insert({
    acquisition_id: input.acquisitionId,
    actor: input.reporterName,
    action: "Template defect reported",
    field: input.templateName,
    old_value: input.revision,
    new_value: input.defect,
    reason: input.citation ?? "Reported to the PGPD queue",
    logged_at: new Date().toISOString(),
  } as never);
  if (logError) throw new Error(logError.message);
}

export async function setDefectStatus(row: DefectRow, status: DefectStatus, actor: string): Promise<void> {
  const { data, error } = await supabase
    .from("template_defects")
    .update({ status } as never)
    .eq("defect_id", row.defect_id)
    .select("defect_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0)
    throw new Error("Working this queue requires HQ or Administrator access.");
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "Template defect status changed",
    field: row.template_name,
    old_value: row.status,
    new_value: status,
    reason: "PGPD queue",
    logged_at: new Date().toISOString(),
  } as never);
}

export async function deleteDefect(row: DefectRow, actor: string): Promise<void> {
  const { data, error } = await supabase
    .from("template_defects")
    .delete()
    .eq("defect_id", row.defect_id)
    .select("defect_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0)
    throw new Error("Working this queue requires HQ or Administrator access.");
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "Template defect removed",
    field: row.template_name,
    old_value: row.defect,
    new_value: null,
    reason: "PGPD queue",
    logged_at: new Date().toISOString(),
  } as never);
}
