// Regulation and guidance text.
//
// T-Minus holds verbatim authority text as rows in regulation_sections. Nothing
// here generates regulation text: a citation either resolves to a loaded row or
// is reported plainly as not loaded. Rows are never edited in place — a new load
// stamps superseded_at on the live rows it replaces and inserts the new text, so
// documents written under earlier text stay readable.

import { supabase } from "@/integrations/supabase/client";
import { citationTokens } from "@/lib/cite-stub";

export const BINDING_CORPORA = ["far_rfo", "nfs", "pcd"] as const;
export const GUIDANCE_CORPORA = ["far_companion", "nfs_companion", "buying_guide"] as const;

export type RegulationSection = {
  id: string;
  corpus: string;
  corpus_revision: string;
  citation: string;
  parent_citation: string | null;
  heading: string | null;
  text: string;
  binding: boolean;
  source_url: string;
  retrieved_at: string;
  effective_date: string | null;
  superseded_at: string | null;
  sha256: string;
};

const COLUMNS =
  "id,corpus,corpus_revision,citation,parent_citation,heading,text,binding,source_url,retrieved_at,effective_date,superseded_at,sha256";

/** Every live (not superseded) section row. */
export async function loadLiveSections(): Promise<RegulationSection[]> {
  const { data, error } = await supabase
    .from("regulation_sections")
    .select(COLUMNS)
    .is("superseded_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as RegulationSection[];
}

export function normaliseCitation(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** True when the whole string is one citation, e.g. "FAR 10.002(e)". */
function isSingleCitation(value: string): boolean {
  return /^(?:RFO\s+)?(?:FAR|NFS(?:\s+CG)?)\s+(?:PART\s+)?\d{1,4}(?:\.\d+)*(?:-\d+)*(?:\([0-9A-Z]+\))*$/.test(value);
}

/**
 * Resolve a citation to loaded sections. The match is exact on the citation
 * string. When the citation is a line of prose naming sections, the citation
 * tokens in it are tried; a single precise citation such as FAR 10.002(e) is
 * never widened to its parent section, so a paragraph the corpus does not
 * carry stays unresolved. Nothing is inferred beyond an exact match.
 */
export function resolveSections(
  citation: string | null | undefined,
  rows: RegulationSection[] | undefined,
): RegulationSection[] {
  const wanted = normaliseCitation(citation);
  if (!wanted || !rows || rows.length === 0) return [];
  const exact = rows.filter((r) => normaliseCitation(r.citation) === wanted);
  if (exact.length > 0) return exact;
  if (isSingleCitation(wanted)) return [];
  const tokens = citationTokens(citation).map(normaliseCitation);
  if (tokens.length === 0) return [];
  return rows.filter((r) => tokens.includes(normaliseCitation(r.citation)));
}

/** Loaded live citations that share the same section number stem, for a
 *  plain "the loaded corpus carries X instead" note. Never invents text. */
export function nearbyCitations(
  citation: string | null | undefined,
  rows: RegulationSection[] | undefined,
): string[] {
  const tokens = [normaliseCitation(citation), ...citationTokens(citation).map(normaliseCitation)];
  const stems = new Set<string>();
  for (const t of tokens) {
    const m = t.match(/^((?:FAR|NFS)\s+\d{1,4}(?:\.\d+)*)/);
    if (m) stems.add(m[1]!);
  }
  if (stems.size === 0 || !rows) return [];
  const out = new Set<string>();
  for (const r of rows) {
    const c = normaliseCitation(r.citation);
    for (const stem of stems) {
      if (c.startsWith(stem) && c !== normaliseCitation(citation)) out.add(r.citation);
    }
  }
  return [...out].sort();
}

export function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  return crypto.subtle.digest("SHA-256", bytes).then((buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""),
  );
}

export function formatRetrieved(value: string | null | undefined): string {
  if (!value) return "not recorded";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return String(value);
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Oldest live retrieved_at per corpus, for the "last loaded" reminder line. */
export function oldestRetrievedByCorpus(rows: RegulationSection[]): { corpus: string; retrieved_at: string }[] {
  const oldest = new Map<string, string>();
  for (const r of rows) {
    const prior = oldest.get(r.corpus);
    if (!prior || Date.parse(r.retrieved_at) < Date.parse(prior)) oldest.set(r.corpus, r.retrieved_at);
  }
  return [...oldest.entries()]
    .map(([corpus, retrieved_at]) => ({ corpus, retrieved_at }))
    .sort((a, b) => a.corpus.localeCompare(b.corpus));
}

export type SectionUpload = {
  corpus: string;
  corpus_revision: string;
  citation: string;
  parent_citation: string | null;
  heading: string | null;
  text: string;
  binding: boolean;
  source_url: string;
  retrieved_at: string;
  effective_date: string | null;
  sha256: string;
};

/** Read a .jsonl file (or a .json array) of section rows. */
export function parseSectionFile(body: string): Record<string, unknown>[] {
  const trimmed = body.trim();
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed);
    if (!Array.isArray(arr)) throw new Error("The file is not a list of sections.");
    return arr as Record<string, unknown>[];
  }
  return trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const nul = (v: unknown): string | null => (str(v) === "" ? null : str(v));

/**
 * Shape uploaded objects into rows. binding is forced by the intake type and
 * the corpus must be one the type allows, so guidance can never load as binding.
 */
export async function readSectionUpload(
  rows: Record<string, unknown>[],
  binding: boolean,
  allowedCorpora: readonly string[],
): Promise<SectionUpload[]> {
  const out: SectionUpload[] = [];
  for (const [i, r] of rows.entries()) {
    const corpus = str(r["corpus"]);
    if (!allowedCorpora.includes(corpus)) {
      throw new Error(
        `Row ${i + 1} names corpus "${corpus || "(blank)"}". This intake type accepts ${allowedCorpora.join(", ")}.`,
      );
    }
    const text = typeof r["text"] === "string" ? (r["text"] as string) : "";
    if (!text.trim()) throw new Error(`Row ${i + 1} carries no text.`);
    const citation = str(r["citation"]);
    if (!citation) throw new Error(`Row ${i + 1} carries no citation.`);
    const sourceUrl = str(r["source_url"]);
    if (!sourceUrl) throw new Error(`Row ${i + 1} carries no source link.`);
    out.push({
      corpus,
      corpus_revision: str(r["corpus_revision"]) || "not recorded",
      citation,
      parent_citation: nul(r["parent_citation"]),
      heading: nul(r["heading"]),
      text,
      binding,
      source_url: sourceUrl,
      retrieved_at: str(r["retrieved_at"]) || new Date().toISOString(),
      effective_date: nul(r["effective_date"]),
      sha256: str(r["sha256"]) || (await sha256Hex(text)),
    });
  }
  return out;
}

export type SectionDiffRow = {
  key: string;
  citation: string;
  corpus: string;
  incoming?: SectionUpload;
  existing?: RegulationSection;
};

export type SectionDiff = {
  added: SectionDiffRow[];
  changed: SectionDiffRow[];
  removed: SectionDiffRow[];
  unchanged: number;
};

const keyOf = (corpus: string, citation: string) => `${corpus}|${normaliseCitation(citation)}`;

/** Compare uploaded sections against the live rows of the corpora in the file. */
export function diffSections(incoming: SectionUpload[], live: RegulationSection[]): SectionDiff {
  const corpora = new Set(incoming.map((r) => r.corpus));
  const byKey = new Map<string, RegulationSection>();
  for (const r of live) if (corpora.has(r.corpus)) byKey.set(keyOf(r.corpus, r.citation), r);

  const added: SectionDiffRow[] = [];
  const changed: SectionDiffRow[] = [];
  const seen = new Set<string>();
  let unchanged = 0;

  for (const row of incoming) {
    const key = keyOf(row.corpus, row.citation);
    if (seen.has(key)) continue;
    seen.add(key);
    const prior = byKey.get(key);
    if (!prior) {
      added.push({ key, citation: row.citation, corpus: row.corpus, incoming: row });
      continue;
    }
    if (prior.sha256 === row.sha256 && prior.corpus_revision === row.corpus_revision) {
      unchanged++;
      continue;
    }
    changed.push({ key, citation: row.citation, corpus: row.corpus, incoming: row, existing: prior });
  }

  const removed: SectionDiffRow[] = [];
  for (const [key, prior] of byKey) {
    if (seen.has(key)) continue;
    removed.push({ key, citation: prior.citation, corpus: prior.corpus, existing: prior });
  }

  return { added, changed, removed, unchanged };
}

/**
 * Apply a section diff. Replaced and removed rows are superseded, never
 * updated in place or deleted; new text is inserted as new rows.
 */
export async function applySectionDiff(diff: SectionDiff): Promise<void> {
  const now = new Date().toISOString();
  const supersede = [...diff.changed, ...diff.removed]
    .map((r) => r.existing?.id)
    .filter((id): id is string => Boolean(id));
  if (supersede.length > 0) {
    const { error } = await supabase
      .from("regulation_sections")
      .update({ superseded_at: now })
      .in("id", supersede);
    if (error) throw new Error(error.message);
  }
  const inserts = [...diff.added, ...diff.changed]
    .map((r) => r.incoming)
    .filter((r): r is SectionUpload => Boolean(r));
  if (inserts.length > 0) {
    const { error } = await supabase.from("regulation_sections").insert(inserts);
    if (error) throw new Error(error.message);
  }
}

export function sectionDiffSentence(label: string, diff: SectionDiff): string {
  return `${label}: ${diff.added.length} section${diff.added.length === 1 ? "" : "s"} added, ${diff.changed.length} replaced, ${diff.removed.length} superseded, ${diff.unchanged} unchanged.`;
}

/**
 * Live acquisition files whose template citations name a section whose text
 * changed. Matching is on the citation string only; nothing is inferred.
 */
export async function filesCitingChangedSections(citations: string[]): Promise<string[]> {
  const wanted = new Set(citations.map(normaliseCitation).filter(Boolean));
  if (wanted.size === 0) return [];
  const [{ data: docs }, { data: templates }] = await Promise.all([
    supabase.from("documents").select("acquisition_id,template_id"),
    supabase.from("templates").select("template_id,governing_citation,name"),
  ]);
  const hit = new Set<string>();
  for (const t of templates ?? []) {
    const cit = normaliseCitation((t as { governing_citation: string | null }).governing_citation);
    if (!cit) continue;
    if ([...wanted].some((w) => cit === w || cit.includes(w))) {
      hit.add((t as { template_id: string }).template_id);
    }
  }
  const files = new Set<string>();
  for (const d of docs ?? []) {
    const row = d as { acquisition_id: string | null; template_id: string | null };
    if (row.acquisition_id && row.template_id && hit.has(row.template_id)) files.add(row.acquisition_id);
  }
  return [...files].sort();
}
