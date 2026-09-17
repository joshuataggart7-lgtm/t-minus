/**
 * Soft §9 — Pin form revision.
 *
 * Builtin revisions: SF 1449 11/2021, SF 30 11/2016, OF 347 02/2012. A new
 * document uses the builtin; a saved document keeps the revision recorded on
 * it, so regenerating an older version reads the blank it was written against.
 *
 * Future table: form_templates (form_id, revision, storage_path, sha256,
 * effective_date, superseded_at, mapping_profile, source). Soft keeps the
 * registry as code rows in the same shape until that table exists.
 */
export type FormTemplateId = "sf1449" | "sf30" | "of347";

export type FormTemplateEntry = {
  form_id: FormTemplateId;
  revision: string;
  storage_path: string;
  /** Soft optional; fill when known. */
  sha256?: string;
  effective_date?: string;
  superseded_at?: string | null;
  source?: string;
  mapping_profile?: string;
};

/** The revisions a new document is written against until an update ships. */
export const BUILTIN_FORM_REVISIONS: Record<FormTemplateId, string> = {
  sf1449: "11/2021",
  sf30: "11/2016",
  of347: "02/2012",
};

export const FORM_TEMPLATES: FormTemplateEntry[] = [
  {
    form_id: "sf1449",
    revision: "11/2021",
    storage_path: "/forms/SF1449.pdf",
    source: "Official GSA blank held with the prototype",
    mapping_profile: "sf1449-v1",
    effective_date: "2021-11-01",
    superseded_at: null,
  },
  {
    form_id: "sf30",
    revision: "11/2016",
    storage_path: "/forms/SF30.pdf",
    source: "Official GSA blank held with the prototype",
    mapping_profile: "sf30-v1",
    effective_date: "2016-11-01",
    superseded_at: null,
  },
  {
    form_id: "of347",
    revision: "02/2012",
    storage_path: "/forms/OF347.pdf",
    source: "Official GSA blank held with the prototype",
    mapping_profile: "of347-v1",
    effective_date: "2012-02-01",
    superseded_at: null,
  },
];

export function currentFormRevision(formId: FormTemplateId): string {
  return BUILTIN_FORM_REVISIONS[formId];
}

/**
 * The blank for a form and revision. An unknown pin falls back to the current
 * builtin rather than naming a blank that does not exist.
 */
export function resolveFormTemplate(
  formId: FormTemplateId,
  revision?: string | null,
): FormTemplateEntry {
  const wanted = (revision || "").trim() || currentFormRevision(formId);
  const hit = FORM_TEMPLATES.find((t) => t.form_id === formId && t.revision === wanted);
  if (hit) return hit;
  const current = FORM_TEMPLATES.find(
    (t) => t.form_id === formId && t.revision === currentFormRevision(formId),
  );
  if (current) return current;
  throw new Error(`No blank is registered for ${formId} revision ${wanted}.`);
}

export function routeKeyToFormId(formKey: string): FormTemplateId | null {
  if (formKey === "sf-1449") return "sf1449";
  if (formKey === "sf-30") return "sf30";
  if (formKey === "of-347") return "of347";
  return null;
}

/** The key the pin is kept under on a saved document's field values. */
export const FORM_REVISION_KEY = "__form_revision";

/** The pin recorded on a saved document, when it carries one. */
export function pinnedRevisionFrom(fieldValues: unknown): string | null {
  const bag = (fieldValues ?? {}) as Record<string, unknown>;
  const value = bag[FORM_REVISION_KEY] ?? bag["form_revision"];
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}
