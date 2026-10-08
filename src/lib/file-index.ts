// NF 1098 contract file index (E14).
//
// The index is built from the documents saved on the file: each document's
// template carries an NF 1098 tab. Tabs the acquisition type requires are
// derived from the phase plan for that type — a core tabbed record whose
// phase is in the file's sequence is required. Nothing is invented: tabs and
// names come from the template definitions and the templates table.

import { TEMPLATES } from "./template-engine";
import { FORM_NAMES, type FormKey } from "./nf1787";
import { phaseForTemplate, requiredDocs, type AcqRow } from "./launch-sequence";
import { isOfficialFinal } from "./official-file";
import { nearForTemplateKey, type NearElement } from "./near-crosswalk";

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
  /** Filed by the contracting officer as the official copy on this file. */
  official?: boolean;
  officialAt?: string | null;
  officialBy?: string | null;
};

/**
 * Where a row opens the official version: the document route for a drafted
 * template, the form route for a generated form, or the stored upload itself.
 */
export type IndexOpen =
  | { kind: "document"; templateKey: string }
  | { kind: "form"; formKey: string }
  | { kind: "attachment"; attachmentId: string };

export type IndexTab = {
  tab: string;
  templateName: string;
  phase: string;
  /** "Generated" for a drafted document or form, "Uploaded" for an attachment. */
  origin: "generated" | "uploaded";
  open: IndexOpen | null;
  documents: IndexDocument[];
  /** Crosswalk WSC enrichment, present only where the template is mapped. */
  nearOrder?: number;
  nearTitle?: string;
  nearUid?: string;
  nearNotes?: string;
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
  field_values?: {
    __tab?: string;
    __official_final?: boolean;
    __official_filed_at?: string;
    __official_filed_by?: string;
    __retired?: unknown;
    kind?: string;
    doc_key?: string;
    doc_label?: string;
  } | null;
};

export type IndexTemplateRow = {
  template_id: string;
  name: string;
  nf_1098_tab: string | null;
};

/**
 * A saved version marked out of the file keeps its row (nothing is deleted).
 * field_values.__retired carries { status, reason } and the plain note reads
 * from it, for example "Superseded: ...".
 */
export function retiredNote(fieldValues: unknown): string | null {
  const r = (fieldValues as { __retired?: unknown } | null | undefined)?.__retired;
  if (!r) return null;
  if (typeof r === "object") {
    const o = r as Record<string, unknown>;
    const status = typeof o["status"] === "string" && o["status"] ? o["status"] : "Retired from the file";
    return typeof o["reason"] === "string" && o["reason"] ? `${status}: ${o["reason"]}` : status;
  }
  return "Retired from the file";
}

/** An upload kept on the file but superseded by another form carries a doc_key ending "-superseded". */
export const isSupersededAttachmentKey = (key: string | null | undefined) => /-superseded$/.test(String(key ?? ""));

export function tabRank(tab: string | null | undefined): number {
  const n = Number(String(tab ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && String(tab ?? "").trim() !== "" ? n : 9999;
}

const normTab = (tab: string | null | undefined) => String(tab ?? "").trim();

/**
 * One display form for every tab: NF 1098 tab numbers read as three digits
 * ("4" and "004" are the same tab), and a document with no tab of its own is
 * listed under an honest "N/A".
 */
const displayTab = (tab: string) => {
  const t = tab.trim();
  if (t === "" || t === "\u2014" || /^n\/?a$/i.test(t)) return "N/A";
  return /^\d{1,3}$/.test(t) ? t.padStart(3, "0") : t;
};

/** An uploader the record could not name is said plainly, never as a role placeholder. */
const uploaderName = (name: string | null) =>
  !name || /^signed-in user$/i.test(name.trim()) ? "Name not recorded" : name;

const blankTab = (tab: string) => tab === "" || tab === "—" || tab === "NA" || tab === "N/A";

/**
 * Crosswalk WSC enrichment for a template key. The checklist tab is used for
 * display only where the template carries no tab of its own — a real tab on
 * the record is never overwritten.
 */
function nearFields(templateKey: string | undefined, tab: string): {
  tab: string;
  near: Pick<IndexTab, "nearOrder" | "nearTitle" | "nearUid" | "nearNotes">;
} {
  const el: NearElement | null = nearForTemplateKey(templateKey);
  if (!el) return { tab, near: {} };
  const resolved = blankTab(tab) && el.tabPrimary !== null ? String(el.tabPrimary) : tab;
  return {
    tab: resolved,
    near: {
      nearOrder: el.visualOrder,
      nearTitle: el.title,
      nearUid: el.uid,
      // Crosswalk WSC "NEAR FE Notes" (What to File Here), shown verbatim.
      ...(el.notes ? { nearNotes: el.notes } : {}),
    },
  };
}

/** Checklist order where the row is mapped, otherwise the tab number. */
function indexRank(t: IndexTab): number {
  return t.nearOrder ?? 1000 + tabRank(t.tab);
}

/** The route that opens the official version of a generated document. */
function openFor(templateName: string, templateKey: string | undefined): IndexOpen | null {
  const formKey = (Object.keys(FORM_NAMES) as FormKey[]).find((k) => FORM_NAMES[k] === templateName);
  if (formKey) return { kind: "form", formKey };
  return templateKey ? { kind: "document", templateKey } : null;
}

/** Tabs the acquisition type requires, from the phases in its sequence. */
/**
 * What the launch sequence asks of each core template on this file: the phase
 * that names it and whether it is Required or Offered there. The index reads
 * this, so the two always agree (for example the COR appointment is Offered
 * on a firm-fixed-price file, RFO FAR 1.404(b), and Required otherwise).
 */
export function sequenceRequirements(phases: string[], acq?: AcqRow) {
  const out = new Map<string, { phase: string; optional: boolean }>();
  for (const phase of phases) {
    for (const doc of requiredDocs(phase, acq, phases)) {
      if (!doc.templateKey || !(CORE_KEYS as readonly string[]).includes(doc.templateKey)) continue;
      const seen = out.get(doc.templateKey);
      const optional = Boolean(doc.optional);
      if (!seen || (seen.optional && !optional)) out.set(doc.templateKey, { phase, optional });
    }
  }
  return out;
}

function coreTabs(phases: string[], acq: AcqRow | undefined, wantOptional: boolean): IndexTab[] {
  const req = sequenceRequirements(phases, acq);
  return TEMPLATES.filter((t) => (CORE_KEYS as readonly string[]).includes(t.key))
    .filter((t) => {
      const r = req.get(t.key);
      return Boolean(r) && r!.optional === wantOptional;
    })
    .map((t) => {
      const { tab, near } = nearFields(t.key, normTab(t.tab));
      return {
        tab: displayTab(tab),
        templateName: t.name,
        phase: req.get(t.key)!.phase,
        origin: "generated" as const,
        open: { kind: "document" as const, templateKey: t.key },
        documents: [],
        ...near,
      };
    })
    .filter((t) => !blankTab(t.tab));
}

/** Core tabs the launch sequence marks Required on this file. */
export function requiredTabs(phases: string[], acq?: AcqRow): IndexTab[] {
  return coreTabs(phases, acq, false);
}

/** Core tabs the launch sequence marks Offered (optional) on this file. */
export function offeredTabs(phases: string[], acq?: AcqRow): IndexTab[] {
  return coreTabs(phases, acq, true);
}

/** An uploaded file on the record, indexed by the tab it belongs under. */
export type IndexAttachmentRow = {
  attachment_id?: string;
  doc_label: string;
  nf_1098_tab: string | null;
  file_name: string;
  uploaded_by_name: string | null;
  created_at: string;
  storage_path?: string;
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

  // P1-6: once the official SF 1449 export is on the file, an earlier hand
  // upload of the same form is stale and is not listed a second time.
  const isSf1449 = (label: string) => /sf\s*[- ]?1449/i.test(label);
  const hasGeneratedOfficialSf1449 = documents.some((d) => {
    const values = d.field_values;
    if (!values || values.__retired || values.kind !== "official-export") return false;
    return values.doc_key === "sf-1449-official" || isSf1449(values.doc_label ?? "");
  });
  const hasOfficialSf1449Upload = attachments.some(
    (a) => isSf1449(a.doc_label) && /official/i.test(a.doc_label),
  );
  // A hand upload marked official is the signed copy someone filed: it stays on
  // the index either way. Only unmarked drafts drop out once an official
  // version exists.
  const liveAttachments = hasGeneratedOfficialSf1449 || hasOfficialSf1449Upload
    ? attachments.filter((a) => !isSf1449(a.doc_label) || /official|signed|award/i.test(a.doc_label))
    : attachments;

  for (const a of liveAttachments) {
    // An upload with no tab is still on the file. It is listed under an honest
    // "N/A" rather than dropped out of the index.
    const tab = displayTab(normTab(a.nf_1098_tab));
    const key = `${tab}|${a.doc_label}`;
    const entry =
      present.get(key) ??
      ({
        tab,
        templateName: a.doc_label,
        phase: "Intake",
        origin: "uploaded" as const,
        open: a.attachment_id ? ({ kind: "attachment" as const, attachmentId: a.attachment_id }) : null,
        documents: [],
      } satisfies IndexTab);
    entry.documents.push({
      templateName: a.file_name,
      version: entry.documents.length + 1,
      savedBy: uploaderName(a.uploaded_by_name),
      savedAt: a.created_at,
      memo: false,
      memoTo: null,
    });
    if (a.attachment_id) entry.open = { kind: "attachment", attachmentId: a.attachment_id };
    present.set(key, entry);
  }

  for (const d of documents) {
    const tpl = d.template_id ? tplById.get(d.template_id) : undefined;
    if (!tpl) continue;
    // P1-6: a version retired from the file is not part of the index.
    if ((d.field_values as { __retired?: unknown } | null | undefined)?.__retired) continue;
    // A memorandum for record is filed under the tab the contracting officer
    // picked when saving it, not under the template's own tab. A template with
    // no tab of its own is still listed, under "N/A".
    const picked = normTab(d.field_values?.__tab);
    const def = TEMPLATES.find((t) => t.name === tpl.name);
    // Where the template carries no tab, the Crosswalk WSC tab is used so the
    // index reads honestly; a real tab on the record is left alone.
    const resolved = nearFields(def?.key, picked !== "" && picked !== "—" ? picked : normTab(tpl.nf_1098_tab));
    const tab = displayTab(resolved.tab);
    // An official export saved under the SF 1449 template with a different
    // doc_key (the RFP cover letter) is its own document, not an SF 1449
    // version. Only doc_key "sf-1449-official" counts toward the SF 1449.
    const values = d.field_values;
    const strayExport =
      values?.kind === "official-export" &&
      isSf1449(tpl.name) &&
      typeof values.doc_key === "string" &&
      values.doc_key !== "" &&
      values.doc_key !== "sf-1449-official" &&
      typeof values.doc_label === "string" &&
      values.doc_label.trim() !== "";
    const rowName = strayExport ? String(values?.doc_label).trim() : tpl.name;
    const key = `${tab}|${rowName}`;
    const entry =
      present.get(key) ??
      ({
        tab,
        templateName: rowName,
        phase: def ? phaseForTemplate(def.key) : "—",
        origin: "generated" as const,
        open: openFor(tpl.name, def?.key),
        documents: [],
        ...resolved.near,
      } satisfies IndexTab);
    entry.documents.push({
      templateName: rowName,
      version: d.version ?? 1,
      savedBy: d.saved_by,
      savedAt: d.saved_at,
      memo: d.issue_on_nf1858 === true,
      memoTo: d.memo_header?.to ?? null,
      official: isOfficialFinal(d.field_values),
      officialAt: d.field_values?.__official_filed_at ?? null,
      officialBy: d.field_values?.__official_filed_by ?? null,
    });
    present.set(key, entry);
  }

  const presentList = [...present.values()]
    .map((t) => ({ ...t, documents: [...t.documents].sort((a, b) => a.version - b.version) }))
    .sort((a, b) => indexRank(a) - indexRank(b) || a.templateName.localeCompare(b.templateName));

  const presentTabs = new Set(presentList.map((t) => t.tab));
  const missing = requiredTabs(phases, acq)
    .filter((t) => !presentTabs.has(t.tab))
    .sort((a, b) => indexRank(a) - indexRank(b));

  return { present: presentList, missing };
}
