/**
 * Writing a filled form from mapping rows.
 *
 * The generator does not carry a hard-coded list of field names. It reads the
 * rows in form-field-mappings and writes each one onto the official blank.
 * A row that names a field the blank does not carry is skipped quietly, and an
 * empty value is never written, so an unmapped or unrecorded box stays blank.
 */

import type { PDFForm } from "pdf-lib";
import type { FormFieldMapping } from "@/lib/form-field-mappings";

export type FormData = Record<string, unknown>;

/** A value on the data object, by dotted path with optional array indexes. */
export function getPath(data: FormData, path: string): unknown {
  if (path in data) return data[path];
  let node: unknown = data;
  for (const part of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (part === "") continue;
    if (node === null || node === undefined || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const asText = (v: unknown): string =>
  v === null || v === undefined || typeof v === "boolean" ? "" : String(v).trim();

/** A recorded date as the form prints it. Empty when nothing is recorded. */
export function displayDate(value: unknown): string {
  const raw = asText(value);
  if (!raw) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : raw;
}

/** Write a text field. Empty values are skipped; a missing field is ignored. */
export function pdfText(form: PDFForm, name: string, value: unknown, size = 8, maxLen?: number): void {
  let text = asText(value);
  if (!text) return;
  if (maxLen && text.length > maxLen) text = text.slice(0, maxLen);
  try {
    const field = form.getTextField(name);
    field.setText(text);
    try {
      field.setFontSize(size);
    } catch {
      /* the blank fixes the size on some fields */
    }
  } catch {
    /* the blank does not carry this field */
  }
}

/** Tick a check box. Only a true value writes; false leaves the box as it is. */
export function pdfCheck(form: PDFForm, name: string, on: unknown): void {
  if (!on) return;
  try {
    form.getCheckBox(name).check();
  } catch {
    /* the blank does not carry this box */
  }
}

/** A money field, written the way the form prints amounts. */
export function pdfMoney(form: PDFForm, name: string, value: unknown, size = 8): void {
  if (value === null || value === undefined || value === "") return;
  if (typeof value === "string") {
    pdfText(form, name, value, size);
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return;
  pdfText(form, name, n.toFixed(2), size);
}

const listOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : [];

/** Whether a check row is on, by its match rule. */
function checkIsOn(row: FormFieldMapping, value: unknown): boolean {
  const wanted = (row.equals ?? "").toLowerCase();
  const text = asText(value).toLowerCase();
  switch (row.match ?? "truthy") {
    case "eq":
      return Boolean(text) && text === wanted;
    case "includes":
      return Boolean(text) && Boolean(wanted) && text.includes(wanted);
    case "includes_any":
      return (
        Boolean(text) &&
        wanted
          .split("|")
          .filter(Boolean)
          .some((part) => text.includes(part))
      );
    case "array_includes":
      return listOf(value).includes(wanted);
    case "roger_sb2":
      // The total small business box: a set-aside is recorded and it is not partial.
      return Boolean(text) && !text.includes("partial");
    case "truthy":
    default:
      return Boolean(value);
  }
}

/** Write every mapping row onto the form. */
export function applyFormMappings(form: PDFForm, rows: FormFieldMapping[], data: FormData): void {
  for (const row of rows) {
    const value = row.constant !== undefined ? row.constant : getPath(data, row.record_path);
    switch (row.type) {
      case "check":
        pdfCheck(form, row.pdf_field, checkIsOn(row, value));
        break;
      case "money":
        pdfMoney(form, row.pdf_field, value, row.font_size ?? 8);
        break;
      case "date":
        pdfText(form, row.pdf_field, displayDate(value), row.font_size ?? 8, row.max_len);
        break;
      case "text":
      default:
        pdfText(form, row.pdf_field, value, row.font_size ?? 8, row.max_len);
        break;
    }
  }
}
