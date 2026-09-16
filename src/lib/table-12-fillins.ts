// FAR Tables 12-2 and 12-3 fill-in aid.
//
// FAR 52.212-5 is Reserved under the RFO / PCD 26-03B, so commercial clause
// content is carried through Tables 12-2 (provisions) and 12-3 (clauses) and
// each clause's own prescription. This module does one honest thing: for the
// clauses the matrix-backed recommendation already put on the file, it lists
// the fill-in slots a commercial packet needs and fills each slot from the
// record or leaves it reading "Not recorded". It never writes FAR or NFS body,
// never invents a clause number, and never applies anything.

import type { PacketClause } from "@/lib/clause-packet";

export const TABLE12_BANNER =
  "Advisory — fill-ins are local handoff aids. NCMS is the system of record (NFS 1804.171). Nothing here holds phase exit.";

export const TABLE12_EMPTY =
  "No commercial Table 12-2/12-3 fill-ins to show on this file.";

export const TABLE12_UNCONFIRMED = "Table not confirmed — verify in RFO Part 12";

export type TableTag = "Table 12-2 (provision)" | "Table 12-3 (clause)" | typeof TABLE12_UNCONFIRMED;

export type FillinSlot = { label: string; value: string };

export type Table12Row = {
  clause_number: string;
  title: string;
  table: TableTag;
  slots: FillinSlot[];
  /** Citation / source line, always honest about where the tag came from. */
  note: string;
  /** NFS matrix marks this clause as needing a fill-in. */
  nfsFillIn: boolean;
};

/** Is this file a commercial / SF 1449 / Part 12 buy on the record? */
export function isCommercialFile(facts: Record<string, unknown> | null | undefined): boolean {
  if (!facts) return false;
  const s = (k: string) => String(facts[k] ?? "");
  const vehicle = (facts["vehicle"] ?? {}) as Record<string, unknown>;
  const clauseSet = String(vehicle["clause_set"] ?? "");
  const text = `${s("commercial_determination")} ${s("contract_format")} ${s("acquisition_method")} ${clauseSet}`;
  return /commercial/i.test(text) || /sf\s*1449/i.test(text) || /\bpart 12\b|far 12/i.test(text);
}

// The small honest map. Only numbers whose table placement is settled appear
// here; everything else falls through to "Table not confirmed".
const PROVISIONS = new Set(["52.212-1", "52.212-2", "52.204-7", "52.204-16", "52.204-22", "52.225-25"]);
const CLAUSES = new Set([
  "52.212-4",
  "52.204-13",
  "52.204-18",
  "52.204-21",
  "52.204-24",
  "52.204-25",
  "52.232-33",
  "52.232-40",
  "52.222-50",
  "52.223-18",
  "52.225-13",
  "52.233-3",
  "52.233-4",
  "52.244-6",
  "52.247-34",
]);

function tagFor(c: PacketClause): { table: TableTag; note: string } {
  const n = c.clause_number;
  if (PROVISIONS.has(n)) {
    return {
      table: "Table 12-2 (provision)",
      note: "Solicitation provision on a commercial buy, FAR 12.301 and Table 12-2.",
    };
  }
  if (CLAUSES.has(n) || c.formerly_bundled) {
    return {
      table: "Table 12-3 (clause)",
      note: c.formerly_bundled
        ? "Carried on its own prescription now that FAR 52.212-5 is Reserved (RFO / PCD 26-03B), Table 12-3."
        : "Contract clause on a commercial buy, FAR 12.301 and Table 12-3.",
    };
  }
  if (n.startsWith("1852")) {
    return {
      table: TABLE12_UNCONFIRMED,
      note: "NFS clause. Interim NFS matrix (PCD 26-03B) governs; the FAR Part 12 table placement is not confirmed here.",
    };
  }
  return { table: TABLE12_UNCONFIRMED, note: TABLE12_UNCONFIRMED + "." };
}

// ---------------------------------------------------------------- slots

function val(facts: Record<string, unknown>, key: string): string {
  const v = facts[key];
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || "Not recorded";
}

function money(facts: Record<string, unknown>, key: string): string {
  const v = facts[key];
  if (v === null || v === undefined || v === "") return "Not recorded";
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toLocaleString("en-US")}` : "Not recorded";
}

/** Fill-in slots a commercial packet asks for, all read from the record. */
function slotsFor(clauseNumber: string, facts: Record<string, unknown>): FillinSlot[] {
  const vehicle = (facts["vehicle"] ?? {}) as Record<string, unknown>;
  const common: Record<string, FillinSlot[]> = {
    "52.212-1": [
      { label: "Contracting officer", value: val(facts, "co_name") },
      { label: "NAICS code", value: val(facts, "naics_code") },
      { label: "Set-aside", value: val(facts, "set_aside") },
    ],
    "52.212-2": [
      { label: "Evaluation factors", value: "Not recorded — enter from Section M on this file" },
      { label: "Estimated value", value: money(facts, "estimated_value") },
    ],
    "52.212-4": [
      { label: "Period of performance start", value: val(facts, "period_of_performance_start") },
      { label: "Period of performance end", value: val(facts, "period_of_performance_end") },
      { label: "Place of performance", value: val(facts, "place_of_performance") },
      { label: "Contract type", value: val(facts, "contract_type") },
    ],
  };
  if (common[clauseNumber]) return common[clauseNumber]!;

  const slots: FillinSlot[] = [
    { label: "Contracting officer", value: val(facts, "co_name") },
    { label: "Place of performance", value: val(facts, "place_of_performance") },
  ];
  const parent = String(facts["parent_contract_number"] ?? "").trim();
  if (parent) slots.push({ label: "Parent contract number", value: parent });
  const start = vehicle["ordering_start"];
  const end = vehicle["ordering_end"];
  if (start || end) {
    slots.push({
      label: "Ordering period",
      value: `${start ? String(start) : "Not recorded"} to ${end ? String(end) : "Not recorded"}`,
    });
  }
  return slots;
}

/**
 * Rows are always a subset of `recommended`, so no clause outside the loaded
 * matrices can appear. `nfsFillFlags` is the set of NFS clause numbers the NFS
 * matrix marks with fill_in = 'X'.
 */
export function table12Fillins(
  facts: Record<string, unknown> | null | undefined,
  recommended: readonly PacketClause[],
  nfsFillFlags?: ReadonlySet<string>,
): Table12Row[] {
  if (!facts || !isCommercialFile(facts)) return [];
  return recommended
    .filter((c) => c.clause_number !== "52.212-5" && c.clause_number !== "52.212-3")
    .map((c) => {
      const { table, note } = tagFor(c);
      const nfsFillIn = Boolean(nfsFillFlags?.has(c.clause_number));
      return {
        clause_number: c.clause_number,
        title: c.title,
        table,
        slots: slotsFor(c.clause_number, facts),
        note: nfsFillIn ? `${note} NFS matrix: fill-in required.` : note,
        nfsFillIn,
      };
    });
}

/** One line for the audit log when the officer confirms a row. */
export function confirmFillinSummary(row: Table12Row): string {
  const blanks = row.slots.filter((s) => s.value.startsWith("Not recorded")).length;
  return `${row.clause_number} · ${row.table} · ${row.slots.length} fill-in slot${
    row.slots.length === 1 ? "" : "s"
  }, ${blanks} not recorded.`;
}
