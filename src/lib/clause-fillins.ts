// Clause fill-ins read from the record.
//
// A clause packet is only useful at handoff if the blanks a clause carries are
// filled from the file: the contracting officer, the period of performance, the
// ordering period on a vehicle, the option notice lead. This module does that
// one thing. Every slot is read from the acquisition record or the matrices; a
// slot with nothing behind it reads "Not recorded". No FAR or NFS body text is
// written here, no number or date is invented, and nothing is applied: the
// clause picker stays the only place a clause goes on a file. NCMS remains the
// system of record (NFS 1804.171); none of this is written back.

import { OPTION_NOTICE_LEAD_DAYS } from "@/lib/post-award";

export type FillinSlot = { label: string; value: string };

export const NOT_RECORDED = "Not recorded";

/** Clauses the RFO keeps Reserved or off the packet entirely. */
const NEVER = new Set(["52.212-3", "52.212-5"]);

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const txt = (facts: Record<string, unknown>, key: string): string => {
  const v = facts[key];
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || NOT_RECORDED;
};

const money = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return NOT_RECORDED;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString("en-US")}` : NOT_RECORDED;
};

const plain = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || NOT_RECORDED;
};

/** Fill-in text the matrices carry, as label/value slots. */
function matrixSlots(fills: unknown): FillinSlot[] {
  if (Array.isArray(fills)) {
    return fills
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .map((value) => ({ label: "From the matrices", value }));
  }
  if (fills && typeof fills === "object") {
    return Object.entries(fills as Record<string, unknown>)
      .map(([k, v]) => ({ label: k, value: plain(v) }))
      .filter((slot) => Boolean(slot.label));
  }
  const s = typeof fills === "string" ? fills.trim() : "";
  return s ? [{ label: "From the matrices", value: s }] : [];
}

/**
 * Ordered fill-in slots for one clause: the record first, then anything the
 * matrices carry that the record did not already cover.
 */
export function clauseFillinSlots(
  facts: Record<string, unknown> | null | undefined,
  clauseNumber: string,
  matrixFills?: unknown,
): FillinSlot[] {
  const num = (clauseNumber ?? "").trim();
  if (!num || NEVER.has(num)) return [];
  const f = rec(facts);
  const vehicle = rec(f["vehicle"]);
  const post = rec(f["post_award"]);
  const slots: FillinSlot[] = [];

  const push = (label: string, value: string) => {
    if (!slots.some((s) => s.label === label)) slots.push({ label, value });
  };

  if (num === "52.212-1") {
    push("Contracting officer", txt(f, "co_name"));
    push("NAICS code", txt(f, "naics_code"));
    push("Set-aside", txt(f, "set_aside"));
  } else if (num === "52.212-2") {
    push("Evaluation factors", "Not recorded — carried from Section M on this file");
    push("Estimated value", money(f["estimated_value"]));
  } else if (num === "52.212-4") {
    push("Period of performance start", txt(f, "period_of_performance_start"));
    push("Period of performance end", txt(f, "period_of_performance_end"));
    push("Place of performance", txt(f, "place_of_performance_standardized") === NOT_RECORDED ? txt(f, "place_of_performance") : txt(f, "place_of_performance_standardized"));
    push("Contract type", txt(f, "contract_type"));
  } else if (num === "52.217-9") {
    const raw = rec(post["clause_fill_ins"])["52.217-9"];
    const parsed = typeof raw === "number" ? raw : Number(String(raw ?? "").match(/\d+/)?.[0]);
    const lead = Number.isFinite(parsed) && parsed >= 0 ? Number(parsed) : OPTION_NOTICE_LEAD_DAYS;
    push("Preliminary notice lead", `${lead} calendar days`);
    const periods = Array.isArray(post["option_periods"]) ? (post["option_periods"] as unknown[]) : [];
    push("Option periods on the record", periods.length > 0 ? String(periods.length) : NOT_RECORDED);
    const last = periods.length > 0 ? rec(periods[periods.length - 1]) : {};
    push("Performance may extend through", plain(last["end"]));
  } else if (num === "52.216-18" || num === "52.216-19" || num === "52.216-22") {
    push("Parent contract number", plain(f["parent_contract_number"]));
    push(
      "Ordering period",
      `${plain(vehicle["ordering_start"])} to ${plain(vehicle["ordering_end"])}`,
    );
    if (num === "52.216-19") {
      push("Minimum order", money(vehicle["minimum_order"] ?? vehicle["guaranteed_minimum"]));
      push("Maximum order", money(vehicle["maximum_order"] ?? vehicle["ceiling_value"]));
    }
    if (num === "52.216-22") {
      push("Orders may be placed through", plain(vehicle["ordering_end"]));
    }
  } else {
    push("Contracting officer", txt(f, "co_name"));
    push(
      "Place of performance",
      txt(f, "place_of_performance_standardized") === NOT_RECORDED
        ? txt(f, "place_of_performance")
        : txt(f, "place_of_performance_standardized"),
    );
  }

  for (const slot of matrixSlots(matrixFills)) push(slot.label, slot.value);
  return slots;
}

/** The same slots as one readable line: "Label: value; Label: value". */
export function clauseFillinText(
  facts: Record<string, unknown> | null | undefined,
  clauseNumber: string,
  matrixFills?: unknown,
): string | null {
  const slots = clauseFillinSlots(facts, clauseNumber, matrixFills);
  if (slots.length === 0) return null;
  return slots.map((s) => `${s.label}: ${s.value}`).join("; ");
}

export const CLAUSE_FILLIN_NOTE =
  "Fill-ins from the record — blanks read Not recorded. Advisory only; NCMS is the system of record (NFS 1804.171).";
