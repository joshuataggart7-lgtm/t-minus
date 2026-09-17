/**
 * Soft §8 — lineage overlay helpers.
 *
 * Status: inherited | overridden | manual.
 * A filled preview field that carries a shared-record value (organization,
 * acquisition or contract scope from §6, or a recorded research finding) is
 * outlined when the reader turns the overlay on. Everything else reads as
 * entered for this document.
 *
 * Nothing here invents a person, a date or a citation. When a source is not
 * recorded, the tooltip says so plainly. The overlay is preview only; it does
 * not touch the exported bytes.
 */
import { FORM_FIELD_MAPPINGS, type FieldScope, type FormFieldMapping } from "@/lib/form-field-mappings";
import { scopeOf } from "@/lib/field-scope";
import type { FindingMap } from "@/lib/research-findings";

export type LineageStatus = "inherited" | "overridden" | "manual";

export type FieldLineage = {
  status: LineageStatus;
  /** Human sentence for the tooltip. */
  tooltip: string;
  source?: string;
  sourceDate?: string | null;
  scope?: FieldScope;
};

const humanDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/** A finding recorded against exactly this path. No loose matching. */
export function findingForPath(findings: FindingMap | undefined, path: string) {
  if (!findings) return undefined;
  return findings[path];
}

/**
 * Resolve lineage for one displayed field.
 * - empty value → null, no outline
 * - a recorded finding → where it came from, with the date when one is stored
 * - organization, acquisition or contract scope → inherited from the record
 * - transaction scope → entered for this document
 */
export function resolveFieldLineage(args: {
  path: string;
  value: unknown;
  scope?: FieldScope;
  findings?: FindingMap;
  /** Soft: the value differs from a baseline, when one is known. */
  overridden?: boolean;
}): FieldLineage | null {
  const empty =
    args.value === null || args.value === undefined || args.value === "" || args.value === false;
  if (empty) return null;

  const finding = findingForPath(args.findings, args.path);
  if (finding) {
    const when = humanDate(finding.sourceDate);
    const fromSam = /sam\.gov|entity/i.test(finding.source ?? "");
    const tooltip = fromSam
      ? `from the SAM.gov entity lookup${when ? `, ${when}` : ""}`
      : `from ${finding.source}${when ? `, ${when}` : ""}`;
    return {
      status: args.overridden ? "overridden" : "inherited",
      tooltip,
      source: finding.source,
      sourceDate: finding.sourceDate,
      scope: args.scope,
    };
  }

  const scope = args.scope ?? "transaction";
  if (scope === "organization" || scope === "acquisition" || scope === "contract") {
    if (args.overridden) {
      return {
        status: "overridden",
        tooltip: "changed on this form; the shared acquisition record holds a different value",
        scope,
      };
    }
    return { status: "inherited", tooltip: "inherited from the acquisition record", scope };
  }

  return { status: "manual", tooltip: "entered for this document (transaction scope)", scope };
}

/** The form_id in the mapping table for a route form key. */
export function mappingFormId(formKey: string): string | null {
  if (formKey === "sf-1449") return "sf1449";
  if (formKey === "sf-30") return "sf30";
  if (formKey === "of-347") return "of347";
  return null;
}

const leaf = (path: string): string =>
  (path.split(".").pop() ?? "").replace(/\[[0-9]+\]/g, "").toLowerCase();

/**
 * A scope lookup for one form, read off the mapping rows by field name.
 * The preview names a field by its blank path; the leaf name is the join.
 * A name the table does not carry stays unscoped, which reads as transaction.
 */
export function scopeLookupForForm(formKey: string): Record<string, FieldScope> {
  const formId = mappingFormId(formKey);
  const table: Record<string, FieldScope> = {};
  if (!formId) return table;
  const rows: FormFieldMapping[] = FORM_FIELD_MAPPINGS.filter((row) => row.form_id === formId);
  for (const row of rows) {
    const name = leaf(row.pdf_field ?? "");
    if (!name) continue;
    const scope = scopeOf(row);
    // First row wins, so an indexed sibling does not change a settled name.
    if (!table[name]) table[name] = scope;
  }
  return table;
}

export type LineageSection = {
  title: string;
  fields: { path: string; value: unknown }[];
};

/** Lineage for every field in a generated form, keyed by field path. */
export function lineageForFormSections(
  formKey: string,
  sections: LineageSection[],
  findings?: FindingMap,
): Record<string, FieldLineage> {
  const scopes = scopeLookupForForm(formKey);
  const out: Record<string, FieldLineage> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      const lineage = resolveFieldLineage({
        path: field.path,
        value: field.value,
        scope: scopes[leaf(field.path)],
        findings,
      });
      if (lineage) out[field.path] = lineage;
    }
  }
  return out;
}

/** Counts by status, for the legend and for the audit note. */
export function countLineage(map: Record<string, FieldLineage>): Record<LineageStatus, number> {
  const counts: Record<LineageStatus, number> = { inherited: 0, overridden: 0, manual: 0 };
  for (const entry of Object.values(map)) counts[entry.status] += 1;
  return counts;
}
