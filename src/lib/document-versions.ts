/**
 * Who signed / saved what (advisory).
 *
 * Reads saved `documents` rows joined to `templates` for one acquisition, plus
 * the most recent matching audit line when one already exists. Empty signature
 * fields stay empty; nothing is invented and nothing holds a file.
 */
import { supabase } from "@/integrations/supabase/client";

export type DocVersionRow = {
  document_id: string;
  name: string;
  version: number | null;
  saved_by: string | null;
  saved_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export const NO_VERSIONS_NOTE = "No saved document versions are on this file.";

const KEY_WORDS = ["pnm", "jofoc", "letter", "commerciality", "notice"];

export async function loadDocumentVersions(acquisitionId: string): Promise<{
  rows: DocVersionRow[];
  lastAudit: { actor: string | null; action: string | null; logged_at: string } | null;
}> {
  const [docsRes, tplRes, auditRes] = await Promise.all([
    supabase
      .from("documents")
      .select("document_id,template_id,version,saved_by,saved_at,reviewed_by,reviewed_at")
      .eq("acquisition_id", acquisitionId),
    supabase.from("templates").select("template_id,name"),
    supabase
      .from("audit_log")
      .select("actor,action,logged_at")
      .eq("acquisition_id", acquisitionId)
      .order("logged_at", { ascending: false })
      .limit(50),
  ]);
  if (docsRes.error) throw new Error(docsRes.error.message);
  if (tplRes.error) throw new Error(tplRes.error.message);

  const names = new Map<string, string>();
  for (const t of tplRes.data ?? []) names.set(String(t.template_id), String(t.name));

  const all: DocVersionRow[] = (docsRes.data ?? []).map((d) => ({
    document_id: String(d.document_id),
    name: names.get(String(d.template_id)) ?? "Document name not recorded",
    version: d.version ?? null,
    saved_by: d.saved_by ?? null,
    saved_at: d.saved_at ?? null,
    reviewed_by: d.reviewed_by ?? null,
    reviewed_at: d.reviewed_at ?? null,
  }));

  const key = all.filter((r) => KEY_WORDS.some((w) => r.name.toLowerCase().includes(w)));
  const rows = (key.length >= 3 ? key : all).sort(
    (a, b) => a.name.localeCompare(b.name) || (a.version ?? 0) - (b.version ?? 0),
  );

  const audit = (auditRes.data ?? []).find((a) =>
    /save|review/i.test(String(a.action ?? "")),
  );

  return {
    rows,
    lastAudit: audit
      ? { actor: audit.actor ?? null, action: audit.action ?? null, logged_at: String(audit.logged_at) }
      : null,
  };
}

export function stampOrBlank(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "Not recorded";
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return v;
  return t.toISOString().slice(0, 10);
}

export function textOrBlank(value: string | null | undefined): string {
  return (value ?? "").trim() || "Not recorded";
}
