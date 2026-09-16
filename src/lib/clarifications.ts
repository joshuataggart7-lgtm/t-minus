// Clarifications fairness ledger.
//
// A plain log of clarifications sent to offerors on a file. Nothing is
// invented: no traffic is seeded, and blank fields print "Not recorded".
// Advisory only — no row here holds a file, a phase or a launch-sequence beat.

import { supabase } from "@/integrations/supabase/client";

export type ClarificationRow = {
  clarification_id: string;
  acquisition_id: string;
  sent_on: string | null;
  topic: string;
  recipients: string | null;
  notes: string | null;
  created_at: string;
};

export type ClarificationInput = {
  sent_on: string | null;
  topic: string;
  recipients: string | null;
  notes: string | null;
};

export const CLARIFICATIONS_EMPTY = "No clarifications recorded on this file.";
export const CLARIFICATIONS_CHIP =
  "Fairness ledger — same clarification to all offerors when competed.";

export const clarificationText = (v: string | null | undefined): string =>
  (v ?? "").trim() || "Not recorded";

const clean = (v: string | null): string | null => (v ?? "").trim() || null;

export async function loadClarifications(acquisitionId: string): Promise<ClarificationRow[]> {
  const { data, error } = await supabase
    .from("clarifications")
    .select("clarification_id,acquisition_id,sent_on,topic,recipients,notes,created_at")
    .eq("acquisition_id", acquisitionId)
    .order("sent_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ClarificationRow[];
}

async function audit(
  acquisitionId: string,
  actor: string,
  action: string,
  field: string | null,
  newValue: string | null,
  reason: string,
): Promise<void> {
  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    actor,
    action,
    field,
    old_value: null,
    new_value: newValue,
    reason,
  } as never);
}

export async function createClarification(
  acquisitionId: string,
  input: ClarificationInput,
  actor: string,
): Promise<void> {
  const { error } = await supabase.from("clarifications").insert({
    acquisition_id: acquisitionId,
    sent_on: clean(input.sent_on),
    topic: input.topic.trim(),
    recipients: clean(input.recipients),
    notes: clean(input.notes),
  } as never);
  if (error) throw new Error(error.message);
  await audit(
    acquisitionId,
    actor,
    "Clarification recorded",
    input.topic.trim(),
    `sent ${clarificationText(input.sent_on)}; recipients ${clarificationText(input.recipients)}`,
    "Clarification recorded on the fairness ledger for this file.",
  );
}

export async function deleteClarification(row: ClarificationRow, actor: string): Promise<void> {
  const { error } = await supabase
    .from("clarifications")
    .delete()
    .eq("clarification_id", row.clarification_id);
  if (error) throw new Error(error.message);
  await audit(
    row.acquisition_id,
    actor,
    "Clarification removed",
    row.topic,
    null,
    "Clarification removed from the fairness ledger on this file.",
  );
}

/**
 * Edit a row already on the ledger. Advisory data only: nothing here holds the
 * file, and the change is logged like every other edit.
 */
export async function updateClarification(
  row: ClarificationRow,
  input: ClarificationInput,
  actor: string,
): Promise<void> {
  const { error } = await supabase
    .from("clarifications")
    .update({
      sent_on: clean(input.sent_on),
      topic: input.topic.trim(),
      recipients: clean(input.recipients),
      notes: clean(input.notes),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("clarification_id", row.clarification_id);
  if (error) throw new Error(error.message);
  await audit(
    row.acquisition_id,
    actor,
    "Clarification edited",
    row.topic,
    input.topic.trim(),
    "Clarification edited on the fairness ledger for this file.",
  );
}
