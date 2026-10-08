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

/** The full official RFO text, the same copy the verified text was taken from. */
export const RFO_PDF_URL = "https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf";

/**
 * acquisition.gov keeps one FAR Overhaul page per part. Every part from 1 to 53
 * answered at this address on Oct 8, 2026 except Parts 20 and 21 (reserved),
 * which fall back to the full RFO PDF.
 */
const RFO_PART_PAGES_MISSING = new Set([20, 21]);

export type OfficialSource = { url: string; label: string };

/**
 * Where a reader can check a citation at the official source. Only RFO FAR
 * citations get a link (acquisition.gov). NFS Companion Guide, NF forms, older
 * "FAR" citations and Center practice get none, rather than a guessed address.
 */
export function officialSourceFor(part: string): OfficialSource | null {
  const m = part.match(/RFO FAR (?:[Pp]art |[Ss]ubpart )?(\d+)(?:\.|\b)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1 || n > 53 || RFO_PART_PAGES_MISSING.has(n)) {
    return { url: RFO_PDF_URL, label: "Read the RFO at acquisition.gov" };
  }
  return {
    url: `https://www.acquisition.gov/far-overhaul/far-part-deviation-guide/far-overhaul-part-${n}`,
    label: `Read RFO Part ${n} at acquisition.gov`,
  };
}
