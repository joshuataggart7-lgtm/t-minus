// NF 1098 contract file index (E14).
//
// The index is built from the documents saved on the file: each document's
// template carries an NF 1098 tab. Tabs the acquisition type requires are
// derived from the phase plan for that type — a core tabbed record whose
// phase is in the file's sequence is required. Nothing is invented: tabs and
// names come from the template definitions and the templates table.

import { TEMPLATES } from "./template-engine";
import { phaseForTemplate, isTerRequired, type AcqRow } from "./launch-sequence";

/** Core tabbed records every file of that type is expected to hold. */
const CORE_KEYS = [
  "jofoc",
  "technical-evaluation-report",
  "evaluation-of-quotations",
  "pnm",
  "cor-appointment",
  "cpars-input",
] as const;

export type IndexDocument = {
  templateName: string;
  version: number;
  savedBy: string | null;
  savedAt: string | null;
  /** Issued on NASA Form 1858 letterhead, and the official it is addressed to. */
  memo: boolean;
  memoTo: string | null;
};

export type IndexTab = {
  tab: string;
  templateName: string;
  phase: string;
  documents: IndexDocument[];
};

export type FileIndex = {
  present: IndexTab[];
  missing: IndexTab[];
};

export type IndexDocRow = {
  template_id: string | null;
  version: number | null;
  saved_by: string | null;
  saved_at: string | null;
  issue_on_nf1858?: boolean | null;
  memo_header?: { to?: string } | null;
  /** Saved values; a memorandum for record carries the tab the CO picked. */
  field_values?: { __tab?: string } | null;
};

export type IndexTemplateRow = {
  template_id: string;
  name: string;
  nf_1098_tab: string | null;
};

export function tabRank(tab: string | null | undefined): number {
  const n = Number(String(tab ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && String(tab ?? "").trim() !== "" ? n : 9999;
}

const normTab = (tab: string | null | undefined) => String(tab ?? "").trim();

/** Tabs the acquisition type requires, from the phases in its sequence. */
export function requiredTabs(phases: string[], acq?: AcqRow): IndexTab[] {
  const inSequence = new Set(phases.map((p) => p.toLowerCase()));
  return TEMPLATES.filter((t) => (CORE_KEYS as readonly string[]).includes(t.key))
    // The technical evaluation report is required only for a sole-source
    // proposal above the simplified acquisition threshold; on a competed
    // simplified acquisition it is offered, not required.
    .filter((t) => t.key !== "technical-evaluation-report" || isTerRequired(acq))
    // The evaluation of quotations record is the requirement on a competed
    // simplified acquisition, in place of the report.
    .filter((t) => t.key !== "evaluation-of-quotations" || !isTerRequired(acq))
    .map((t) => ({ tab: normTab(t.tab), templateName: t.name, phase: phaseForTemplate(t.key), documents: [] }))
    .filter((t) => t.tab !== "" && t.tab !== "—" && t.tab !== "NA" && t.tab !== "N/A")
    .filter((t) => inSequence.has(t.phase.toLowerCase()));
}

/** An uploaded file on the record, indexed by the tab it belongs under. */
export type IndexAttachmentRow = {
  doc_label: string;
  nf_1098_tab: string | null;
  file_name: string;
  uploaded_by_name: string | null;
  created_at: string;
};

export function buildFileIndex(
  documents: IndexDocRow[],
  templates: IndexTemplateRow[],
  phases: string[],
  attachments: IndexAttachmentRow[] = [],
  acq?: AcqRow,
): FileIndex {
  const tplById = new Map(templates.map((t) => [t.template_id, t]));
  const present = new Map<string, IndexTab>();

  for (const a of attachments) {
    const tab = normTab(a.nf_1098_tab);
    if (tab === "" || tab === "—") continue;
    const key = `${tab}|${a.doc_label}`;
    const entry =
      present.get(key) ?? ({ tab, templateName: a.doc_label, phase: "Intake", documents: [] } satisfies IndexTab);
    entry.documents.push({
      templateName: a.file_name,
      version: entry.documents.length + 1,
      savedBy: a.uploaded_by_name,
      savedAt: a.created_at,
      memo: false,
      memoTo: null,
    });
    present.set(key, entry);
  }

  for (const d of documents) {
    const tpl = d.template_id ? tplById.get(d.template_id) : undefined;
    if (!tpl) continue;
    // A memorandum for record is filed under the tab the contracting officer
    // picked when saving it, not under the template's own tab.
    const picked = normTab(d.field_values?.__tab);
    const tab = picked !== "" && picked !== "—" ? picked : normTab(tpl.nf_1098_tab);
    if (tab === "" || tab === "—") continue;
    const def = TEMPLATES.find((t) => t.name === tpl.name);
    const key = `${tab}|${tpl.name}`;
    const entry =
      present.get(key) ??
      ({
        tab,
        templateName: tpl.name,
        phase: def ? phaseForTemplate(def.key) : "—",
        documents: [],
      } satisfies IndexTab);
    entry.documents.push({
      templateName: tpl.name,
      version: d.version ?? 1,
      savedBy: d.saved_by,
      savedAt: d.saved_at,
      memo: d.issue_on_nf1858 === true,
      memoTo: d.memo_header?.to ?? null,
    });
    present.set(key, entry);
  }

  const presentList = [...present.values()]
    .map((t) => ({ ...t, documents: [...t.documents].sort((a, b) => a.version - b.version) }))
    .sort((a, b) => tabRank(a.tab) - tabRank(b.tab) || a.templateName.localeCompare(b.templateName));

  const presentTabs = new Set(presentList.map((t) => t.tab));
  const missing = requiredTabs(phases, acq)
    .filter((t) => !presentTabs.has(t.tab))
    .sort((a, b) => tabRank(a.tab) - tabRank(b.tab));

  return { present: presentList, missing };
}
