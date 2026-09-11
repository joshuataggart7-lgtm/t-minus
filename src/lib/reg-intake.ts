/**
 * HQ regulatory data intake. HQ uploads a new PCD list, clause matrix,
 * template list, or thresholds file; T-Minus reads it, shows the difference
 * against what is loaded, and applies it row by row. Nothing regulatory is
 * hard-coded: every figure stays a row with its citation and effective date.
 */
import { parseCsv } from "@/lib/csv";

export type Dataset = {
  id: string;
  label: string;
  /** The file HQ normally sends, shown so the right file is picked. */
  fileHint: string;
  table: string;
  pk: string;
  /** Column that carries the effective date of the row, when the table has one. */
  effectiveColumn: string | null;
  /** Columns compared and written. */
  columns: string[];
  /** Columns shown in the difference table, in order. */
  display: string[];
  fromCsv: (r: Record<string, string>) => Record<string, unknown>;
  keyOf: (r: Record<string, unknown>) => string;
};

const nul = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : v.trim());
const num = (v: string | undefined) => (nul(v) === null ? null : Number(v));

export const DATASETS: Dataset[] = [
  {
    id: "templates",
    label: "Template list",
    fileHint: "templates.csv",
    table: "templates",
    pk: "template_id",
    effectiveColumn: "hq_revision_date",
    columns: ["nf_1098_tab", "name", "hq_revision_date", "status", "governing_citation", "citation_tier"],
    display: ["nf_1098_tab", "name", "hq_revision_date", "status", "governing_citation", "citation_tier"],
    fromCsv: (r) => ({
      nf_1098_tab: nul(r["nf_1098_tab"]),
      name: r["name"] ?? "",
      hq_revision_date: nul(r["hq_effective_date"]),
      status: nul(r["status"]),
      governing_citation: nul(r["governing_citation"]),
      citation_tier: nul(r["citation_tier"]),
    }),
    keyOf: (r) => `${String(r["nf_1098_tab"] ?? "")}|${String(r["name"] ?? "")}`,
  },
  {
    id: "thresholds",
    label: "Thresholds",
    fileHint: "thresholds.csv",
    table: "thresholds",
    pk: "threshold_id",
    effectiveColumn: "effective_date",
    columns: ["name", "value", "citation", "effective_date", "note", "tier"],
    display: ["name", "value", "citation", "effective_date", "tier", "note"],
    fromCsv: (r) => ({
      name: r["name"] ?? "",
      value: num(r["value"]),
      citation: nul(r["citation"]),
      effective_date: nul(r["effective_date"]),
      note: nul(r["note"]),
      tier: nul(r["tier"]),
    }),
    keyOf: (r) => `${String(r["name"] ?? "")}|${String(r["effective_date"] ?? "")}`,
  },
  {
    id: "regulatory_refs",
    label: "PCD list and regulatory references",
    fileHint: "regulatory_refs.csv",
    table: "regulatory_refs",
    pk: "ref_id",
    effectiveColumn: "effective_date",
    columns: [
      "citation",
      "title",
      "tier",
      "source",
      "effective_date",
      "far_part",
      "nfs_part",
      "url",
      "applies_to_phase",
    ],
    display: ["citation", "title", "tier", "source", "effective_date", "applies_to_phase"],
    fromCsv: (r) => ({
      citation: r["citation"] ?? "",
      title: nul(r["title"]),
      tier: nul(r["tier"]),
      source: nul(r["source"]),
      effective_date: nul(r["effective_date"]),
      far_part: nul(r["far_part"]),
      nfs_part: nul(r["nfs_part"]),
      url: nul(r["url"]),
      applies_to_phase: nul(r["applies_to_phase"]),
    }),
    keyOf: (r) => `${String(r["citation"] ?? "")}|${String(r["applies_to_phase"] ?? "")}`,
  },
  {
    id: "clause_matrix_2603b",
    label: "Clause matrix (PCD 26-03B)",
    fileHint: "clause_matrix_26-03B.csv",
    table: "clause_matrix_2603b",
    pk: "row_id",
    effectiveColumn: "effective_date",
    columns: [
      "codified_number",
      "name",
      "effective_date",
      "prescribed_in",
      "p_or_c",
      "rfo_rx",
      "rfo_number",
      "rfo_title",
      "nasa_date_post_rfo",
      "disposition",
      "notes",
    ],
    display: ["codified_number", "name", "effective_date", "disposition", "notes"],
    fromCsv: (r) => ({
      codified_number: r["codified_number"] ?? "",
      name: nul(r["name"]),
      effective_date: nul(r["effective_date"]),
      prescribed_in: nul(r["prescribed_in"]),
      p_or_c: nul(r["p_or_c"]),
      rfo_rx: nul(r["rfo_rx"]),
      rfo_number: nul(r["rfo_number"]),
      rfo_title: nul(r["rfo_title"]),
      nasa_date_post_rfo: nul(r["nasa_date_post_rfo"]),
      disposition: nul(r["disposition"]),
      notes: nul(r["notes"]),
    }),
    keyOf: (r) => `${String(r["codified_number"] ?? "")}|${String(r["name"] ?? "")}`,
  },
  {
    id: "nfs_clause_matrix",
    label: "NFS clause matrix",
    fileHint: "nfs_clause_matrix_2026-07-23.csv",
    table: "nfs_clause_matrix",
    pk: "row_id",
    effectiveColumn: "clause_date",
    columns: [
      "clause_number",
      "title",
      "clause_date",
      "prescribed_in",
      "provision_or_clause",
      "ucf",
      "ibr_or_ft",
      "fill_in",
      "mod_or_sub",
      "app_dev",
    ],
    display: ["clause_number", "title", "clause_date", "provision_or_clause", "ucf"],
    fromCsv: (r) => ({
      clause_number: r["Clause/Provision Number"] ?? "",
      title: nul(r["Title"]),
      clause_date: nul(r["Date"]),
      prescribed_in: nul(r["Prescribed In"]),
      provision_or_clause: nul(r["Provision or Clause"]),
      ucf: nul(r["UCF"]),
      ibr_or_ft: nul(r["IBR or FT"]),
      fill_in: nul(r["Fill In"]),
      mod_or_sub: nul(r["Mod or Sub"]),
      app_dev: nul(r["App Dev"]),
    }),
    keyOf: (r) => `${String(r["clause_number"] ?? "")}|${String(r["title"] ?? "")}`,
  },
];

export function datasetById(id: string): Dataset {
  return DATASETS.find((d) => d.id === id) ?? DATASETS[0]!;
}

export type FieldChange = { column: string; from: string; to: string };
export type DiffRow = {
  key: string;
  label: string;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown>;
  pkValue?: string;
  changes: FieldChange[];
};

export type Diff = {
  added: DiffRow[];
  changed: DiffRow[];
  removed: DiffRow[];
  unchanged: number;
};

export function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function same(a: unknown, b: unknown): boolean {
  const x = cell(a);
  const y = cell(b);
  if (x === y) return true;
  const nx = Number(x);
  const ny = Number(y);
  return x !== "" && y !== "" && Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

function labelFor(d: Dataset, r: Record<string, unknown>): string {
  const first = d.display[0]!;
  const second = d.display[1];
  const a = cell(r[first]);
  const b = second ? cell(r[second]) : "";
  return [a, b].filter(Boolean).join(" — ") || d.label;
}

/** Read an uploaded file into rows shaped like the table it will be written to. */
export function readUpload(d: Dataset, text: string): Record<string, unknown>[] {
  return parseCsv(text).map((r) => d.fromCsv(r));
}

/**
 * Compare the uploaded rows with what is loaded. Rows are matched on the
 * dataset's natural key; a row present on both sides with a different value is
 * a change, and the difference names the column and both values.
 */
export function diffDataset(
  d: Dataset,
  incoming: Record<string, unknown>[],
  existing: Record<string, unknown>[],
): Diff {
  const byKeyExisting = new Map<string, Record<string, unknown>>();
  for (const row of existing) byKeyExisting.set(d.keyOf(row), row);

  const added: DiffRow[] = [];
  const changed: DiffRow[] = [];
  let unchanged = 0;
  const seen = new Set<string>();

  for (const row of incoming) {
    const key = d.keyOf(row);
    if (seen.has(key)) continue;
    seen.add(key);
    const prior = byKeyExisting.get(key);
    if (!prior) {
      added.push({ key, label: labelFor(d, row), incoming: row, changes: [] });
      continue;
    }
    const changes = d.columns
      .filter((c) => !same(row[c], prior[c]))
      .map((c) => ({ column: c, from: cell(prior[c]), to: cell(row[c]) }));
    if (changes.length === 0) {
      unchanged++;
      continue;
    }
    changed.push({
      key,
      label: labelFor(d, row),
      incoming: row,
      existing: prior,
      pkValue: cell(prior[d.pk]),
      changes,
    });
  }

  const removed: DiffRow[] = [];
  for (const [key, prior] of byKeyExisting) {
    if (seen.has(key)) continue;
    removed.push({ key, label: labelFor(d, prior), existing: prior, pkValue: cell(prior[d.pk]), changes: [] });
  }

  return { added, changed, removed, unchanged };
}

export function diffSentence(d: Dataset, diff: Diff, effectiveDate: string): string {
  const parts = [
    `${diff.added.length} row${diff.added.length === 1 ? "" : "s"} added`,
    `${diff.changed.length} changed`,
    `${diff.removed.length} removed`,
    `${diff.unchanged} unchanged`,
  ];
  return `${d.label}: ${parts.join(", ")}, effective ${effectiveDate}.`;
}
