// Citation stubs.
//
// T-Minus does not carry the full FAR / RFO / NFS corpus. Where a citation is
// shown but the loaded regulatory_refs corpus holds no matching row, the app
// must say so plainly rather than imply it has the authority text. Nothing
// here invents citation text: it only labels what is and is not loaded.

import { useQuery } from "@tanstack/react-query";
import { loadRegulationRefs, type RegRefRow } from "@/lib/regulation-sidebar";

export const CITE_STUB_NOTE =
  "Citation stub: the reference is recorded, but the full FAR, RFO, and NFS text is not loaded in this prototype. Read the authority at its official source before relying on it.";

export const CITE_CORPUS_UNLOADED_NOTE =
  "Citation stub: the regulation corpus is not loaded in this session, so this citation is shown as recorded text only.";

export const NFS_CG_NOT_LOADED_NOTE =
  "NFS Companion Guide text is not loaded in this prototype.";

/** True when a citation names the NFS Companion Guide (NFS CG / Companion Guide). */
export function citationHasCompanionGuide(citation: string | null | undefined): boolean {
  return /NFS\s+CG|\bCompanion Guide\b/i.test(String(citation ?? ""));
}

/** Citation tokens in a line of prose: FAR 13.106-3, NFS 1819.202-70, 41 U.S.C. 1901. */
export function citationTokens(citation: string | null | undefined): string[] {
  const text = String(citation ?? "");
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(?:RFO\s+)?(FAR|NFS(?:\s+CG)?)\s+(\d{1,4}(?:\.\d+)*(?:-\d+)*)/gi)) {
    out.add(`${m[1]!.replace(/\s+/g, " ").toUpperCase()} ${m[2]!}`);
  }
  for (const m of text.matchAll(/\b(\d{1,2})\s+U\.S\.C\.\s+(\d+[a-z]?)/gi)) {
    out.add(`${m[1]} U.S.C. ${m[2]}`);
  }
  return [...out];
}

function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

/** True when the loaded corpus carries a row for at least one token in the citation. */
export function corpusCovers(citation: string | null | undefined, rows: RegRefRow[]): boolean {
  const tokens = citationTokens(citation);
  if (tokens.length === 0 || rows.length === 0) return false;
  const haystack = rows
    .map((r) => normalise(`${r.citation ?? ""} ${r.title ?? ""} ${r.far_part ?? ""} ${r.nfs_part ?? ""}`))
    .join(" | ");
  return tokens.some((t) => haystack.includes(normalise(t)));
}

export type CiteStatus =
  | { kind: "loading" }
  | { kind: "covered" }
  | { kind: "stub"; note: string };

/** The stub status for one citation against the corpus rows in hand. */
export function citeStatus(
  citation: string | null | undefined,
  rows: RegRefRow[] | undefined,
  state: { loading: boolean; failed: boolean },
): CiteStatus {
  if (!String(citation ?? "").trim()) return { kind: "covered" };
  if (state.loading) return { kind: "loading" };
  if (state.failed || !rows || rows.length === 0) return { kind: "stub", note: CITE_CORPUS_UNLOADED_NOTE };
  return corpusCovers(citation, rows) ? { kind: "covered" } : { kind: "stub", note: CITE_STUB_NOTE };
}

/** Loads the citation corpus once per session; failures are treated as "not loaded". */
export function useCiteCorpus() {
  const q = useQuery({
    queryKey: ["cite-corpus"],
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: loadRegulationRefs,
  });
  return {
    rows: q.data,
    state: { loading: q.isPending, failed: q.isError },
  };
}
