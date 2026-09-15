// Check-out label for documents. When someone opens a document to edit we
// record who and when. Everyone else who opens it sees "Checked out by [name]
// since [time]" and reads the fields read-only until the first person saves or
// closes the document, or thirty minutes pass. There is no locking beyond that.

import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";

export const CHECKOUT_MINUTES = 30;

export type Checkout = {
  checkout_id: string;
  user_id: string;
  user_name: string;
  checked_out_at: string;
};

export function isExpired(checkedOutAt: string) {
  return Date.now() - new Date(checkedOutAt).getTime() > CHECKOUT_MINUTES * 60_000;
}

/** Short local time for the label, e.g. "9:14 a.m." */
export function checkoutTime(iso: string) {
  const d = new Date(iso);
  const time = d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace("AM", "a.m.")
    .replace("PM", "p.m.");
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? time : `${d.toLocaleDateString()} ${time}`;
}

async function logCheckout(
  acquisitionId: string,
  phase: string,
  actor: string,
  action: string,
  documentName: string,
  detail: string,
  reason: string,
) {
  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    // Every audit row carries the account name, never a placeholder.
    actor: await signedInName(actor),
    action,
    field: documentName,
    old_value: null,
    new_value: detail,
    reason,
    phase,
    logged_at: new Date().toISOString(),
  });
}

/** The check-out in force right now, or null when the document is free. */
export async function loadCheckout(
  acquisitionId: string,
  templateKey: string,
): Promise<Checkout | null> {
  const { data, error } = await supabase
    .from("document_checkouts")
    .select("checkout_id,user_id,user_name,checked_out_at")
    .eq("acquisition_id", acquisitionId)
    .eq("template_key", templateKey)
    .is("released_at", null)
    .order("checked_out_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return isExpired(data.checked_out_at) ? null : (data as Checkout);
}

/**
 * Take the document out, unless someone else holds it. Returns the check-out
 * in force: the caller's own, or the other person's.
 */
export async function claimCheckout(args: {
  acquisitionId: string;
  templateKey: string;
  documentName: string;
  phase: string;
  userName: string;
}): Promise<Checkout | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  // The check-out records the account display name, so a lapse row later reads
  // "Check-out by Joshua Taggart lapsed", never a placeholder.
  const userName = await signedInName(args.userName);

  const existing = await supabase
    .from("document_checkouts")
    .select("checkout_id,user_id,user_name,checked_out_at")
    .eq("acquisition_id", args.acquisitionId)
    .eq("template_key", args.templateKey)
    .is("released_at", null)
    .order("checked_out_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const row = existing.data as Checkout | null;
  if (row && row.user_id === userId) return row;
  if (row && !isExpired(row.checked_out_at)) return row;
  if (row) {
    // Thirty minutes passed; the check-out lapses and the document is free.
    await supabase
      .from("document_checkouts")
      .update({ released_at: new Date().toISOString() })
      .eq("checkout_id", row.checkout_id);
    await logCheckout(
      args.acquisitionId,
      args.phase,
      row.user_name,
      "Document check-out released",
      args.documentName,
      `Check-out by ${row.user_name} lapsed`,
      `No save within ${CHECKOUT_MINUTES} minutes`,
    );
  }

  const checkedOutAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("document_checkouts")
    .insert({
      acquisition_id: args.acquisitionId,
      template_key: args.templateKey,
      user_id: userId,
      user_name: userName,
      checked_out_at: checkedOutAt,
    })
    .select("checkout_id,user_id,user_name,checked_out_at")
    .maybeSingle();
  // Someone claimed it in the same moment; show their check-out instead.
  if (error) return loadCheckout(args.acquisitionId, args.templateKey);

  await logCheckout(
    args.acquisitionId,
    args.phase,
    userName,
    "Document checked out",
    args.documentName,
    `Checked out by ${userName}`,
    "Opened for editing",
  );
  return data as Checkout;
}

/** Release on save, on closing the document, or when the page goes away. */
export async function releaseCheckout(args: {
  checkoutId: string;
  acquisitionId: string;
  documentName: string;
  phase: string;
  userName: string;
  reason: string;
}) {
  const { error, count } = await supabase
    .from("document_checkouts")
    .update({ released_at: new Date().toISOString() }, { count: "exact" })
    .eq("checkout_id", args.checkoutId)
    .is("released_at", null);
  if (error || !count) return;
  const userName = await signedInName(args.userName);
  await logCheckout(
    args.acquisitionId,
    args.phase,
    userName,
    "Document check-out released",
    args.documentName,
    `Released by ${userName}`,
    args.reason,
  );
}
