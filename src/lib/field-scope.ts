/**
 * Soft §6 — field scope for inheritance.
 * organization | acquisition | contract | transaction
 *
 * New document inherits: acquisition + contract only.
 * New order from this contract: organization + acquisition + contract; clears transaction.
 * Transaction never carries forward.
 *
 * Scope is inheritance metadata only. It does not change how a form is filled:
 * applyFormMappings ignores it.
 */
import type { FormFieldMapping } from "@/lib/form-field-mappings";

export type FieldScope = "organization" | "acquisition" | "contract" | "transaction";

export const FIELD_SCOPES: FieldScope[] = [
  "organization",
  "acquisition",
  "contract",
  "transaction",
];

/** Scopes that inherit when opening a new document from prior values. */
export const INHERIT_ON_NEW_DOCUMENT: ReadonlySet<FieldScope> = new Set<FieldScope>([
  "acquisition",
  "contract",
]);

/** Scopes that copy when starting a new order from this contract. */
export const INHERIT_ON_NEW_ORDER: ReadonlySet<FieldScope> = new Set<FieldScope>([
  "organization",
  "acquisition",
  "contract",
]);

export type InheritMode = "new_document" | "new_order";

/** The scope on a row. A row without one is treated as transaction. */
export function scopeOf(row: FormFieldMapping): FieldScope {
  return row.scope ?? "transaction";
}

export function mappingsInheritable(
  rows: FormFieldMapping[],
  mode: InheritMode = "new_document",
): FormFieldMapping[] {
  const allow = mode === "new_order" ? INHERIT_ON_NEW_ORDER : INHERIT_ON_NEW_DOCUMENT;
  return rows.filter((row) => allow.has(scopeOf(row)));
}

export function mappingsTransactionOnly(rows: FormFieldMapping[]): FormFieldMapping[] {
  return rows.filter((row) => scopeOf(row) === "transaction");
}

/** Whether a single recorded path may copy, given a path → scope table. */
export function shouldInheritPath(
  path: string,
  pathScope: Record<string, FieldScope>,
  mode: InheritMode = "new_order",
): boolean {
  const scope = pathScope[path] ?? "transaction";
  const allow = mode === "new_order" ? INHERIT_ON_NEW_ORDER : INHERIT_ON_NEW_DOCUMENT;
  return allow.has(scope);
}

/** A path → scope table read off the mapping rows. */
export function pathScopeTable(rows: FormFieldMapping[]): Record<string, FieldScope> {
  const table: Record<string, FieldScope> = {};
  for (const row of rows) {
    const path = (row.record_path ?? "").trim();
    if (path) table[path] = scopeOf(row);
  }
  return table;
}

/** Which of the given paths may copy, and which are cleared. Soft, for the plan UI. */
export function splitPathsByInheritance(
  paths: string[],
  rows: FormFieldMapping[],
  mode: InheritMode = "new_order",
): { copy: string[]; clear: string[] } {
  const table = pathScopeTable(rows);
  const copy: string[] = [];
  const clear: string[] = [];
  for (const path of paths) {
    (shouldInheritPath(path, table, mode) ? copy : clear).push(path);
  }
  return { copy, clear };
}

/** A count of rows by scope, for the plan UI and for notes. */
export function countByScope(rows: FormFieldMapping[]): Record<FieldScope, number> {
  const out: Record<FieldScope, number> = {
    organization: 0,
    acquisition: 0,
    contract: 0,
    transaction: 0,
  };
  for (const row of rows) out[scopeOf(row)] += 1;
  return out;
}
