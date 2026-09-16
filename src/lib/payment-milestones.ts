// Payment milestones on a file.
//
// Optional and empty unless the contracting office records something. Nothing
// is invented: no events, no amounts, no percentages, no rates. Blank fields
// print "Not recorded", and a row with neither an amount nor a percentage is
// flagged as such. The local handoff packet carries the same rows as the panel.
// NCMS remains the system of record.

import { supabase } from "@/integrations/supabase/client";

export type PaymentMilestoneRow = {
  milestone_id: string;
  acquisition_id: string;
  event: string;
  due_logic: string | null;
  clin_id: string | null;
  clin_number: string | null;
  amount: number | null;
  percent: number | null;
  notes: string | null;
  sort_order: number;
};

export type PaymentMilestoneInput = {
  event: string;
  due_logic: string | null;
  clin_id: string | null;
  clin_number: string | null;
  amount: number | null;
  percent: number | null;
  notes: string | null;
};

export const PAYMENT_MILESTONES_EMPTY = "No payment milestones on this file.";
export const PAYMENT_AMOUNT_BLANK = "Neither an amount nor a percentage is recorded.";
export const PAYMENT_CLIN_ORPHAN = "Linked CLIN missing from schedule.";

/** Soft hint under the empty state when a schedule already exists. */
export const paymentClinHint = (clinCount: number): string | null =>
  clinCount > 0
    ? "CLIN schedule is on this file; link a CLIN when you add a milestone."
    : null;

/** Advisory only: the schedule has line items but this row links none. */
export const paymentUnlinkedNote = (
  row: { clin_id: string | null },
  clinCount: number,
): string | null =>
  !row.clin_id && clinCount > 0
    ? `CLIN not linked — schedule has ${clinCount} line ${clinCount === 1 ? "item" : "items"} on this file.`
    : null;

/** Advisory only: the stored link points at a CLIN no longer on the schedule. */
export const paymentOrphanNote = (
  row: { clin_id: string | null },
  clinIds: string[],
): string | null =>
  row.clin_id && !clinIds.includes(row.clin_id) ? PAYMENT_CLIN_ORPHAN : null;


/** Blank fields read plainly rather than pretending to a value. */
export const payText = (v: string | null | undefined): string =>
  (v ?? "").trim() || "Not recorded";

export const payAmount = (v: number | null | undefined): string =>
  typeof v === "number" && Number.isFinite(v) ? `$${v.toLocaleString("en-US")}` : "Not recorded";

export const payPercent = (v: number | null | undefined): string =>
  typeof v === "number" && Number.isFinite(v) ? `${v}%` : "Not recorded";

/** True when the row carries neither an amount nor a percentage. */
export const payValueMissing = (r: { amount: number | null; percent: number | null }): boolean =>
  !(typeof r.amount === "number" && Number.isFinite(r.amount)) &&
  !(typeof r.percent === "number" && Number.isFinite(r.percent));

export async function loadPaymentMilestones(
  acquisitionId: string,
): Promise<PaymentMilestoneRow[]> {
  const { data, error } = await supabase
    .from("payment_milestones")
    .select("*")
    .eq("acquisition_id", acquisitionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PaymentMilestoneRow[];
}

const clean = (v: string | null): string | null => (v ?? "").trim() || null;

const summary = (r: PaymentMilestoneInput): string =>
  [
    r.event,
    `due ${payText(r.due_logic)}`,
    `CLIN ${payText(r.clin_number)}`,
    `amount ${payAmount(r.amount)}`,
    `percent ${payPercent(r.percent)}`,
  ].join("; ");

export async function createPaymentMilestone(
  acquisitionId: string,
  input: PaymentMilestoneInput,
  actor: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase.from("payment_milestones").insert({
    acquisition_id: acquisitionId,
    event: input.event.trim(),
    due_logic: clean(input.due_logic),
    clin_id: input.clin_id,
    clin_number: clean(input.clin_number),
    amount: input.amount,
    percent: input.percent,
    notes: clean(input.notes),
    sort_order: sortOrder,
  } as never);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    actor,
    action: "Payment milestone added",
    field: input.event.trim(),
    old_value: null,
    new_value: summary(input),
    reason: "Payment milestone added to this file.",
  } as never);
}

const rowToInput = (r: PaymentMilestoneRow): PaymentMilestoneInput => ({
  event: r.event,
  due_logic: r.due_logic,
  clin_id: r.clin_id,
  clin_number: r.clin_number,
  amount: r.amount,
  percent: r.percent,
  notes: r.notes,
});

export async function updatePaymentMilestone(
  row: PaymentMilestoneRow,
  input: PaymentMilestoneInput,
  actor: string,
): Promise<void> {
  const { error } = await supabase
    .from("payment_milestones")
    .update({
      event: input.event.trim(),
      due_logic: clean(input.due_logic),
      clin_id: input.clin_id,
      clin_number: clean(input.clin_number),
      amount: input.amount,
      percent: input.percent,
      notes: clean(input.notes),
    } as never)
    .eq("milestone_id", row.milestone_id);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "Payment milestone edited",
    field: input.event.trim(),
    old_value: summary(rowToInput(row)),
    new_value: summary(input),
    reason: "Payment milestone edited on this file.",
  } as never);
}

export async function deletePaymentMilestone(
  row: PaymentMilestoneRow,
  actor: string,
): Promise<void> {
  const { error } = await supabase
    .from("payment_milestones")
    .delete()
    .eq("milestone_id", row.milestone_id);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: row.acquisition_id,
    actor,
    action: "Payment milestone deleted",
    field: row.event,
    old_value: summary(rowToInput(row)),
    new_value: null,
    reason: "Payment milestone removed from this file.",
  } as never);
}

/** The rows as the handoff packet prints them. */
export type PacketPaymentMilestone = {
  event: string;
  due_logic: string;
  clin_number: string;
  amount: string;
  percent: string;
  value_note?: string;
  notes?: string;
};

export function paymentMilestonesForPacket(
  rows: PaymentMilestoneRow[],
): PacketPaymentMilestone[] {
  return rows.map((r) => ({
    event: r.event,
    due_logic: payText(r.due_logic),
    clin_number: payText(r.clin_number),
    amount: payAmount(r.amount),
    percent: payPercent(r.percent),
    ...(payValueMissing(r) ? { value_note: PAYMENT_AMOUNT_BLANK } : {}),
    ...(r.notes?.trim() ? { notes: r.notes.trim() } : {}),
  }));
}
