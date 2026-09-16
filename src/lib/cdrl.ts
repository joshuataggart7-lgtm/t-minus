// CDRL / data requirements on a file.
//
// Optional, and empty unless the contracting office records something. Nothing
// is invented: no deliverables, no data requirement descriptions, no citations.
// Blank fields print "Not recorded". The local handoff packet carries the same
// rows as the panel. NCMS remains the system of record.

import { supabase } from "@/integrations/supabase/client";

export type CdrlRow = {
  cdrl_id: string;
  acquisition_id: string;
  item_number: string;
  title: string;
  frequency: string | null;
  as_of: string | null;
  distribution: string | null;
  drd_ref: string | null;
  notes: string | null;
  sort_order: number;
};

export type CdrlInput = {
  item_number: string;
  title: string;
  frequency: string | null;
  as_of: string | null;
  distribution: string | null;
  drd_ref: string | null;
  notes: string | null;
};

export const CDRL_EMPTY = "No CDRL items on this file.";

/** Blank fields read plainly rather than pretending to a value. */
export const cdrlText = (v: string | null | undefined): string =>
  (v ?? "").trim() || "Not recorded";

export async function loadCdrl(acquisitionId: string): Promise<CdrlRow[]> {
  const { data, error } = await supabase
    .from("acquisition_cdrl")
    .select("*")
    .eq("acquisition_id", acquisitionId)
    .order("sort_order", { ascending: true })
    .order("item_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CdrlRow[];
}

const summary = (r: CdrlInput): string =>
  [
    r.title,
    `frequency ${cdrlText(r.frequency)}`,
    `as of ${cdrlText(r.as_of)}`,
    `distribution ${cdrlText(r.distribution)}`,
    `DRD ${cdrlText(r.drd_ref)}`,
  ].join("; ");

const clean = (v: string | null): string | null => (v ?? "").trim() || null;

export async function createCdrl(
  acquisitionId: string,
  input: CdrlInput,
  actor: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase.from("acquisition_cdrl").insert({
    acquisition_id: acquisitionId,
    item_number: input.item_number.trim(),
    title: input.title.trim(),
    frequency: clean(input.frequency),
    as_of: clean(input.as_of),
    distribution: clean(input.distribution),
    drd_ref: clean(input.drd_ref),
    notes: clean(input.notes),
    sort_order: sortOrder,
  } as never);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    actor,
    action: "CDRL item added",
    field: input.item_number.trim(),
    old_value: null,
    new_value: summary(input),
    reason: "Data requirement added to this file.",
  } as never);
}

const rowToInput = (r: CdrlRow): CdrlInput => ({
  item_number: r.item_number,
  title: r.title,
  frequency: r.frequency,
  as_of: r.as_of,
  distribution: r.distribution,
  drd_ref: r.drd_ref,
  notes: r.notes,
});

export async function updateCdrl(row: CdrlRow, input: CdrlInput, actor: string): Promise<void> {
  const { error } = await supabase
    .from("acquisition_cdrl")
    .update({
      item_number: input.item_number.trim(),
      title: input.title.trim(),
      frequency: clean(input.frequency),
      as_of: clean(input.as_of),
      distribution: clean(input.distribution),
      drd_ref: clean(input.drd_ref),
      notes: clean(input.notes),
    } as never)
    .eq("cdrl_id", row.cdrl_id);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "CDRL item edited",
    field: input.item_number.trim(),
    old_value: summary(rowToInput(row)),
    new_value: summary(input),
    reason: "Data requirement edited on this file.",
  } as never);
}

export async function deleteCdrl(row: CdrlRow, actor: string): Promise<void> {
  const { error } = await supabase.from("acquisition_cdrl").delete().eq("cdrl_id", row.cdrl_id);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "CDRL item deleted",
    field: row.item_number,
    old_value: summary(rowToInput(row)),
    new_value: null,
    reason: "Data requirement removed from this file.",
  } as never);
}

/** The rows as the handoff packet prints them. */
export type PacketCdrlItem = {
  item_number: string;
  title: string;
  frequency: string;
  as_of: string;
  distribution: string;
  drd_ref: string;
  notes?: string;
};

export function cdrlForPacket(rows: CdrlRow[]): PacketCdrlItem[] {
  return rows.map((r) => ({
    item_number: r.item_number,
    title: r.title,
    frequency: cdrlText(r.frequency),
    as_of: cdrlText(r.as_of),
    distribution: cdrlText(r.distribution),
    drd_ref: cdrlText(r.drd_ref),
    ...(r.notes?.trim() ? { notes: r.notes.trim() } : {}),
  }));
}
