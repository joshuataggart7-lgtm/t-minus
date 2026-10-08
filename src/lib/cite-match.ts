import type { VerifiedRegEntry } from "./verified-reg-text";

/**
 * Splits a citation as written into its parts and finds regulation text for each
 * explicit "RFO FAR" reference in the verified map. Nothing is guessed: a bare
 * "FAR" (pre-RFO) reference, an NFS reference, or a statute never gets RFO text.
 */
export type CiteMatch = {
  /** The reference exactly as it appears in the citation, e.g. "RFO FAR 10.001(f)(1)". */
  written: string;
  /** Key that was asked for, e.g. "10.001(f)(1)". */
  wanted: string;
  /** Key whose text is shown; differs from wanted when only the enclosing paragraph is on file. */
  shown: string | null;
  entry: VerifiedRegEntry | null;
};

export type CitePart = { text: string; matches: CiteMatch[] };

const RFO_REF = /RFO FAR (\d+\.\d+(?:-\d+)?)((?:\([a-zA-Z0-9]+\))*)/g;

export function isPracticeCite(cite: string): boolean {
  return /\bpractice\b/i.test(cite);
}

export function splitCite(cite: string): string[] {
  return cite
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function matchCite(cite: string, map: Record<string, VerifiedRegEntry>): CitePart[] {
  return splitCite(cite).map((text) => {
    const matches: CiteMatch[] = [];
    for (const m of text.matchAll(RFO_REF)) {
      const wanted = m[1] + (m[2] ?? "");
      let key: string | null = wanted;
      while (key && !map[key]) {
        const cut: number = key.lastIndexOf("(");
        key = cut > 0 ? key.slice(0, cut) : null;
      }
      matches.push({ written: m[0], wanted, shown: key, entry: key ? (map[key] ?? null) : null });
    }
    return { text, matches };
  });
}
