// The schedule of line items on a file. One source of truth: the format
// scaffold and the local NCMS handoff packet both read this table. Quantities,
// units and prices are only shown when the schedule carries them or they came
// from the independent government cost estimate already on the file. Nothing
// here is invented and nothing is written to NCMS.

import { supabase } from "@/integrations/supabase/client";
import type { ScaffoldClin } from "@/lib/format-scaffold";

export type ClinRow = {
  clin_id: string;
  acquisition_id: string;
  clin_number: string;
  description: string;
  quantity: number | null;
  unit_of_issue: string | null;
  unit_price: number | null;
  extended_price: number | null;
  source: string;
  sort_order: number;
};

export type ClinInput = {
  clin_number: string;
  description: string;
  quantity: number | null;
  unit_of_issue: string | null;
  unit_price: number | null;
  extended_price: number | null;
};

export const IGCE_SOURCE_NOTE =
  "Estimate-sourced (IGCE). Quantity and price come from the independent government cost estimate on this file; confirm before award.";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

export const money = (v: number | null): string =>
  v === null ? "Not recorded" : `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/**
 * The amount as the schedule shows it. Display only: when the extended price is
 * blank but quantity and unit price are both recorded, the amount shown is
 * quantity times unit price. Nothing is written back to the record.
 */
export function displayAmount(r: {
  quantity: number | null;
  unit_price: number | null;
  extended_price: number | null;
}): { text: string; derived: boolean } {
  if (r.extended_price !== null) return { text: money(r.extended_price), derived: false };
  if (r.quantity !== null && r.unit_price !== null) {
    return { text: money(r.quantity * r.unit_price), derived: true };
  }
  return { text: "Not recorded", derived: false };
}

export function sourceLabel(source: string): string {
  if (source === "igce_estimate") return "Estimate (IGCE)";
  if (source === "record") return "Record";
  return "Officer";
}

/** The schedule on a file, in the order it prints. */
export async function loadClinSchedule(acquisitionId: string): Promise<ClinRow[]> {
  const { data, error } = await supabase
    .from("acquisition_clins")
    .select("*")
    .eq("acquisition_id", acquisitionId)
    .order("sort_order", { ascending: true })
    .order("clin_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ClinRow[];
}

/**
 * Copy the estimate lines onto an empty schedule. An existing schedule is never
 * overwritten, so a later estimate upload cannot replace the officer's work.
 */
export async function ensureClinScheduleFromIgce(acquisitionId: string): Promise<ClinRow[]> {
  const existing = await loadClinSchedule(acquisitionId);
  if (existing.length > 0) return existing;

  const { data, error } = await supabase
    .from("igce_clins")
    .select("*")
    .eq("acquisition_id", acquisitionId)
    .order("clin_number", { ascending: true });
  if (error) throw new Error(error.message);
  const igce = (data ?? []) as unknown as Record<string, unknown>[];
  if (igce.length === 0) return [];

  const payload = igce.map((r, i) => ({
    acquisition_id: acquisitionId,
    clin_number: String(r["clin_number"] ?? "").trim() || String(i + 1).padStart(4, "0"),
    description: String(r["description"] ?? "").trim() || "Line item on the estimate",
    quantity: num(r["quantity"]),
    unit_of_issue: String(r["unit_of_issue"] ?? "").trim() || null,
    unit_price: num(r["unit_price"]),
    extended_price: num(r["extended_price"]),
    source: "igce_estimate",
    sort_order: i,
  }));
  const { error: insErr } = await supabase.from("acquisition_clins").insert(payload as never);
  if (insErr) throw new Error(insErr.message);
  return loadClinSchedule(acquisitionId);
}

const summary = (r: ClinInput): string =>
  [
    r.description,
    r.quantity === null ? null : `qty ${r.quantity}`,
    r.unit_of_issue || null,
    r.unit_price === null ? null : `unit ${money(r.unit_price)}`,
    r.extended_price === null ? null : `amount ${money(r.extended_price)}`,
  ]
    .filter(Boolean)
    .join("; ");

export async function createClin(
  acquisitionId: string,
  input: ClinInput,
  actor: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase.from("acquisition_clins").insert({
    acquisition_id: acquisitionId,
    clin_number: input.clin_number.trim(),
    description: input.description.trim(),
    quantity: input.quantity,
    unit_of_issue: input.unit_of_issue,
    unit_price: input.unit_price,
    extended_price: input.extended_price,
    source: "officer",
    sort_order: sortOrder,
  } as never);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    actor,
    action: "CLIN added",
    field: input.clin_number.trim(),
    old_value: null,
    new_value: summary(input),
    reason: "Line item added to the schedule on this file.",
  } as never);
}

export async function updateClin(
  row: ClinRow,
  input: ClinInput,
  actor: string,
): Promise<void> {
  const { error } = await supabase
    .from("acquisition_clins")
    .update({
      clin_number: input.clin_number.trim(),
      description: input.description.trim(),
      quantity: input.quantity,
      unit_of_issue: input.unit_of_issue,
      unit_price: input.unit_price,
      extended_price: input.extended_price,
    } as never)
    .eq("clin_id", row.clin_id);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "CLIN edited",
    field: input.clin_number.trim(),
    old_value: summary({
      clin_number: row.clin_number,
      description: row.description,
      quantity: row.quantity,
      unit_of_issue: row.unit_of_issue,
      unit_price: row.unit_price,
      extended_price: row.extended_price,
    }),
    new_value: summary(input),
    reason: "Line item edited on the schedule.",
  } as never);
}

export async function deleteClin(row: ClinRow, actor: string): Promise<void> {
  const { error } = await supabase.from("acquisition_clins").delete().eq("clin_id", row.clin_id);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "CLIN deleted",
    field: row.clin_number,
    old_value: summary({
      clin_number: row.clin_number,
      description: row.description,
      quantity: row.quantity,
      unit_of_issue: row.unit_of_issue,
      unit_price: row.unit_price,
      extended_price: row.extended_price,
    }),
    new_value: null,
    reason: "Line item removed from the schedule.",
  } as never);
}

/** The schedule as the scaffold and the handoff packet print it. */
export function scheduleToScaffoldClins(rows: ClinRow[]): ScaffoldClin[] {
  return rows.map((r) => ({
    clin: r.clin_number,
    description: r.description,
    quantity: r.quantity === null ? "Not recorded" : r.quantity.toLocaleString("en-US"),
    unit: r.unit_of_issue?.trim() || "Not recorded",
    amount:
      r.extended_price !== null
        ? money(r.extended_price)
        : r.unit_price !== null
          ? `${money(r.unit_price)} per unit`
          : "Not recorded",
    note:
      r.source === "igce_estimate"
        ? IGCE_SOURCE_NOTE
        : "Recorded on the schedule for this file by the contracting office.",
  }));
}
