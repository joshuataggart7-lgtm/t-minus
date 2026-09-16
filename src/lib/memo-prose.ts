/**
 * Human prose for a signed memorandum body.
 *
 * The research log keeps the source detail: endpoint names, query strings and
 * result counts as they were recorded. A signed memorandum is read by people,
 * so the same facts are printed in plain English — no API or endpoint names,
 * no URLs, no square-bracket source tags. Nothing is added: counts, dates,
 * NAICS codes and place of performance are carried through unchanged.
 */

/** Public sources named the way a memorandum names them. */
const SOURCE_NAMES: [RegExp, string][] = [
  [/SAM\.gov\s+Entity\s+Management(?:\s+API)?/gi, "SAM.gov entity search"],
  [/SAM\.gov\s+Opportunit(?:y|ies)(?:\s+API)?/gi, "SAM.gov notices"],
  [/SAM\.gov\s+Exclusions?(?:\s+API)?/gi, "SAM.gov exclusions"],
  [/USA\s?spending(?:\.gov)?(?:\s+Awards?)?(?:\s+API)?/gi, "USAspending award history"],
  [/FPDS(?:-NG)?(?:\s+API)?/gi, "FPDS award history"],
  [/GSA\s+(?:CALC\+?|Calc\+?)(?:\s+API)?/gi, "GSA CALC+ labor rates"],
];

/** True where a line still carries machine detail a memorandum should not print. */
export function hasSourceJargon(text: string): boolean {
  return /\bAPI\b|\bendpoint\b|https?:\/\/|\[from public data[^\]]*\]|[?&][a-z]+=/i.test(text);
}

/** One line of a memorandum body, in human prose. */
function humanLine(line: string): string {
  let out = line;
  // Square-bracket provenance tags belong to the on-screen draft, not the
  // signed page. The same provenance stays in the research log.
  out = out.replace(/\s*\[from public data[^\]]*\]/gi, "");
  // A raw request URL is never printed in a memorandum.
  out = out.replace(/https?:\/\/\S+/g, "").replace(/\s*[?&][A-Za-z]+=\S+/g, "");
  for (const [pattern, name] of SOURCE_NAMES) out = out.replace(pattern, name);
  // Any remaining machine words.
  out = out.replace(/\s+(?:API|endpoint)s?\b/gi, "");
  // "source, what was searched; date; 45 results" reads as a sentence.
  const parts = out.split(";").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]!) && /results?$|not available/i.test(parts[2]!)) {
    const head = parts[0]!.split(",").map((p) => p.trim()).filter(Boolean);
    const source = head[0] ?? "";
    // The first clause repeats the parameters; only distinct ones are kept.
    const said = [...new Set(head.slice(1))];
    const what = said.length ? ` for ${said.join(", ")}` : "";
    const count = /not available/i.test(parts[2]!) ? parts[2]! : `returned ${parts[2]!}`;
    out = `${source}${what}, searched ${parts[1]}, ${count}.`;
  }
  return out
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A memorandum body field, rewritten as human prose. */
export function humanMemoProse(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .split("\n")
    .map((line) => humanLine(line))
    .filter((line) => line !== "")
    .join("\n");
}
