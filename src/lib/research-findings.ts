/**
 * Market research findings, shared between the engine, the memorandum and the
 * generated forms.
 *
 * Every value the engine writes carries where it came from and the date it was
 * pulled. Until the contracting officer confirms it, the value is shown and
 * exported with that mark attached. Confirming clears the mark; nothing is
 * invented, so a value that no source supports is simply absent.
 */

export type ResearchFinding = {
  target: string;
  label: string;
  value: string;
  source: string;
  sourceDate: string | null;
  confirmed: boolean;
  confirmedBy: string | null;
};

export type FindingMap = Record<string, ResearchFinding>;

export const PROVENANCE = (f: ResearchFinding) =>
  `from public data, ${f.source}${f.sourceDate ? `, ${f.sourceDate}` : ""}`;

/** The value with its provenance mark, until the contracting officer confirms it. */
export function markedValue(f: ResearchFinding | undefined): string {
  if (!f) return "";
  return f.confirmed ? f.value : `${f.value} [${PROVENANCE(f)}]`;
}

/** Reads one finding out of the map by target key. */
export function findingText(findings: FindingMap | undefined, target: string): string {
  return markedValue(findings?.[target]);
}

export function findingFlag(findings: FindingMap | undefined, target: string): boolean | null {
  const f = findings?.[target];
  if (!f) return null;
  return /^yes$/i.test(f.value.trim());
}

export type ResearchRespondent = {
  uei: string;
  name: string;
  category: string;
  assessment: string;
};

/** The respondents table, stored as JSON on one finding. */
export function respondentsFromFinding(findings: FindingMap | undefined): ResearchRespondent[] {
  const raw = findings?.["nf1787a.respondents"]?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ResearchRespondent[]) : [];
  } catch {
    return [];
  }
}
