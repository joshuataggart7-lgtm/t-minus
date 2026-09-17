/**
 * Field mappings as data.
 *
 * Each row says which box on an official blank a recorded value goes into.
 * The rows live in form-field-mappings.json and carry the same columns a
 * future table will carry:
 *
 *   form_field_mappings (form_id, revision, pdf_field, record_path, type,
 *                        equals, max_len, font_size, multiline)
 *
 * Soft extra columns: match, constant, note.
 *
 * Every pdf_field is a name carried by the official blank itself and is
 * checked against the blank when the rows are generated. Nothing is renamed or
 * invented here. Signature, award signature and concurrence boxes are absent
 * on purpose: a person completes those. Only SF 1449 is generated from these
 * rows today; the SF 30 and OF 347 rows are data only.
 */

import rowsJson from "./form-field-mappings.json";

export type MappingType = "text" | "check" | "money" | "date";

/**
 * Soft §6: which level a recorded value belongs to. A future table carries it
 * as form_field_mappings(..., scope). A row without a scope is read as
 * "transaction", so nothing inherits by accident.
 */
export type FieldScope = "organization" | "acquisition" | "contract" | "transaction";

export type MappingMatch =
  | "eq"
  | "includes"
  | "includes_any"
  | "truthy"
  | "array_includes"
  | "roger_sb2";

export interface FormFieldMapping {
  form_id: string;
  revision: string;
  pdf_field: string;
  record_path: string;
  type: MappingType;
  equals?: string;
  max_len?: number;
  font_size?: number;
  multiline?: boolean;
  /** Soft: how a check row decides it is on. Defaults to truthy. */
  match?: MappingMatch;
  /** Soft: a fixed value written instead of a recorded one. */
  constant?: string;
  /** Soft: a short note for the reader of this table. */
  note?: string;
}

export const FORM_FIELD_MAPPINGS: FormFieldMapping[] = rowsJson as FormFieldMapping[];

/** The rows for one form, all revisions when none is named. */
export function mappingsFor(formId: string, revision?: string): FormFieldMapping[] {
  return FORM_FIELD_MAPPINGS.filter(
    (row) => row.form_id === formId && (!revision || row.revision === revision),
  );
}
