// SOW -> clause assist. This is deliberately small and honest: it reads cues
// that are already on the record (acquisition method, contract format, the
// requirement description or title, and whether a SOW/PWS is attached) and
// points at clauses that the matrix-backed recommendation already produced.
// It never invents a clause, never writes FAR text, and never applies
// anything on its own -- the contracting officer confirms each suggestion.

import type { PacketClause } from "@/lib/clause-packet";

export const SOW_ASSIST_BANNER =
  "Suggested from method and requirement cues on the record. Confirm before applying. T-Minus does not write the FAR body.";

export const SOW_ASSIST_EMPTY =
  "No requirement cues on the record match a clause in the recommended list.";

export type AssistSuggestion = {
  clause_number: string;
  title: string;
  /** Why the matrix carries it, straight from the recommendation. */
  reason: string;
  /** The cue on the record that surfaced it. */
  cue: string;
};

type Cue = {
  /** Clause number prefixes this cue points at. */
  prefixes: string[];
  test: RegExp;
  label: (hit: string) => string;
};

const CUES: Cue[] = [
  {
    prefixes: ["52.222"],
    test: /\b(service|services|labor|labour|technician|support staff|maintenance)\b/i,
    label: (hit) => `The requirement text mentions ${hit.toLowerCase()}, so the labor clauses are in play.`,
  },
  {
    prefixes: ["52.204-21", "52.204-25", "52.239"],
    test: /\b(software|information system|IT|cyber|cloud|network|data system)\b/i,
    label: (hit) => `The requirement text mentions ${hit.toLowerCase()}, so the information-security clauses are in play.`,
  },
  {
    prefixes: ["52.227"],
    test: /\b(data|deliverable|deliverables|report|reports|drawing|drawings)\b/i,
    label: (hit) => `The requirement text mentions ${hit.toLowerCase()}, so the data-rights clauses are in play.`,
  },
  {
    prefixes: ["52.245", "52.247", "52.211"],
    test: /\b(equipment|hardware|instrument|delivery|shipment|property)\b/i,
    label: (hit) => `The requirement text mentions ${hit.toLowerCase()}, so the property and delivery clauses are in play.`,
  },
];

function text(facts: Record<string, unknown>, key: string): string {
  const v = facts[key];
  return typeof v === "string" ? v : "";
}

/**
 * Suggestions are always a subset of `recommended`, so nothing outside the
 * loaded matrices can appear.
 */
export function sowClauseAssist(
  facts: Record<string, unknown>,
  recommended: readonly PacketClause[],
): AssistSuggestion[] {
  const requirement = `${text(facts, "description_of_requirement")} ${text(facts, "title")}`.trim();
  const method = text(facts, "acquisition_method");
  const format = text(facts, "contract_format");
  const sowAttached = facts["sow_attached"] === true;

  const out: AssistSuggestion[] = [];
  const seen = new Set<string>();

  const push = (c: PacketClause, cue: string) => {
    if (seen.has(c.clause_number)) return;
    seen.add(c.clause_number);
    out.push({ clause_number: c.clause_number, title: c.title, reason: c.reason, cue });
  };

  // Format cue: the commercial terms clause is the spine of a Part 12 buy.
  if (/sf ?1449|commercial/i.test(`${format} ${method}`)) {
    const commercial = recommended.find((c) => c.clause_number.startsWith("52.212-4"));
    if (commercial) {
      push(
        commercial,
        "The record shows a commercial buy on the SF 1449, so the commercial terms clause carries the contract.",
      );
    }
  }

  if (requirement) {
    for (const cue of CUES) {
      const m = requirement.match(cue.test);
      if (!m) continue;
      for (const c of recommended) {
        if (cue.prefixes.some((p) => c.clause_number.startsWith(p))) push(c, cue.label(m[0]));
      }
    }
  }

  if (sowAttached && out.length > 0) {
    // Nothing is added for the attachment itself; it only tells the reader the
    // cues came from a requirement that is on the record.
    return out;
  }
  return out;
}

export function assistSourceLine(facts: Record<string, unknown>): string {
  const bits: string[] = [];
  const method = text(facts, "acquisition_method");
  const format = text(facts, "contract_format");
  if (method) bits.push(`method ${method}`);
  if (format) bits.push(`format ${format}`);
  bits.push(facts["sow_attached"] === true ? "SOW or PWS attached" : "no SOW or PWS recorded");
  return `Cues read from: ${bits.join(", ")}.`;
}
