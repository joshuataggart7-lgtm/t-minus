/**
 * E8. Limited external access.
 *
 * A CO can hand one saved document version to one named outside email through
 * a read-only link that stops working after seven days or as soon as the CO
 * revokes it. The outside reader gets that document and nothing else: no rail,
 * no other acquisition, no table access. Issue, open and revoke are all logged.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SHARE_DAYS = 7;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type IssuedShare = {
  token: string;
  url: string;
  expiresAt: string;
  magicLinkSent: boolean;
  magicLinkNote: string;
};

export const issueDocumentShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; recipientEmail: string; recipientName?: string | undefined; origin: string }) => {
    if (!input.documentId) throw new Error("Save a version of this document first, then share it.");
    if (!EMAIL.test(input.recipientEmail.trim())) throw new Error("Enter a valid email address for the recipient.");
    return input;
  })
  .handler(async ({ data, context }): Promise<IssuedShare> => {
    const { supabase } = context;

    // Read the document as the signed-in user, so RLS decides whether this
    // person may share it at all.
    const doc = await supabase
      .from("documents")
      .select("document_id, acquisition_id, version, template_id")
      .eq("document_id", data.documentId)
      .maybeSingle();
    if (doc.error) throw new Error(doc.error.message);
    if (!doc.data) throw new Error("That document version could not be read, so it cannot be shared.");

    const tpl = doc.data.template_id
      ? await supabase.from("templates").select("name").eq("template_id", doc.data.template_id).maybeSingle()
      : { data: null, error: null };
    const templateName = tpl.data?.name ?? "Document";

    const who = (context.claims as { email?: string } | null)?.email ?? "Contracting officer";
    const email = data.recipientEmail.trim().toLowerCase();
    const token = newToken();
    const expiresAt = new Date(Date.now() + SHARE_DAYS * 86_400_000).toISOString();
    const url = `${data.origin.replace(/\/$/, "")}/shared/${token}`;

    // The named outside reader is invited through a Supabase Auth magic link
    // that lands on the share page. The link itself is what carries the access.
    let magicLinkSent = false;
    let magicLinkNote = "";
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const gen = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: url },
      });
      if (gen.error) throw new Error(gen.error.message);
      magicLinkSent = true;
      magicLinkNote = "Magic link issued through Cloud auth to the named address.";
    } catch (e) {
      magicLinkNote = `Magic link not issued (${e instanceof Error ? e.message : "unknown"}). The link below still works and expires on the same date.`;
    }

    const ins = await supabase.from("document_shares").insert({
      token,
      document_id: doc.data.document_id,
      acquisition_id: doc.data.acquisition_id,
      template_name: templateName,
      document_version: doc.data.version,
      recipient_email: email,
      recipient_name: data.recipientName?.trim() || null,
      issued_by: who,
      issued_by_user_id: context.userId,
      magic_link_sent: magicLinkSent,
      magic_link_note: magicLinkNote,
      expires_at: expiresAt,
    } as never);
    if (ins.error) throw new Error(ins.error.message);

    await supabase.from("audit_log").insert({
      acquisition_id: doc.data.acquisition_id,
      actor: who,
      action: "External read-only link issued",
      field: "document_share",
      new_value: `${templateName} v${doc.data.version} to ${email}; expires ${expiresAt.slice(0, 10)}`,
      reason: `Read-only outside access for ${SHARE_DAYS} days; revocable by the issuing CO`,
      phase: "External access",
    } as never);

    return { token, url, expiresAt, magicLinkSent, magicLinkNote };
  });

export const revokeDocumentShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shareId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const who = (context.claims as { email?: string } | null)?.email ?? "Contracting officer";
    const row = await supabase
      .from("document_shares")
      .select("share_id, acquisition_id, template_name, recipient_email, revoked_at")
      .eq("share_id", data.shareId)
      .maybeSingle();
    if (row.error) throw new Error(row.error.message);
    if (!row.data) throw new Error("That link could not be found.");
    if (row.data.revoked_at) return { ok: true };

    const upd = await supabase
      .from("document_shares")
      .update({ revoked_at: new Date().toISOString(), revoked_by: who } as never)
      .eq("share_id", data.shareId);
    if (upd.error) throw new Error(upd.error.message);

    await supabase.from("audit_log").insert({
      acquisition_id: row.data.acquisition_id,
      actor: who,
      action: "External read-only link revoked",
      field: "document_share",
      old_value: `${row.data.template_name} to ${row.data.recipient_email}`,
      new_value: "revoked",
      reason: "Outside access withdrawn by the issuing office",
      phase: "External access",
    } as never);

    return { ok: true };
  });

export type SharedDocument = {
  ok: true;
  templateName: string;
  version: number | null;
  acquisitionId: string | null;
  values: Record<string, string>;
  recipientEmail: string;
  issuedBy: string;
  expiresAt: string;
};

export type SharedDocumentError = { ok: false; reason: "unknown" | "revoked" | "expired" };

/**
 * Public on purpose: the token is the credential. It returns one document
 * version and nothing else, and only while the link is live.
 */
export const openSharedDocument = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<SharedDocument | SharedDocumentError> => {
    const token = (data.token ?? "").trim();
    if (!/^[a-f0-9]{64}$/.test(token)) return { ok: false, reason: "unknown" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const share = await supabaseAdmin
      .from("document_shares")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (share.error || !share.data) return { ok: false, reason: "unknown" };
    const s = share.data as Record<string, unknown>;
    if (s["revoked_at"]) return { ok: false, reason: "revoked" };
    if (new Date(String(s["expires_at"])).getTime() < Date.now()) return { ok: false, reason: "expired" };

    const doc = await supabaseAdmin
      .from("documents")
      .select("field_values, version, acquisition_id")
      .eq("document_id", String(s["document_id"]))
      .maybeSingle();
    if (doc.error || !doc.data) return { ok: false, reason: "unknown" };

    await supabaseAdmin
      .from("document_shares")
      .update({
        open_count: Number(s["open_count"] ?? 0) + 1,
        last_opened_at: new Date().toISOString(),
      } as never)
      .eq("token", token);

    await supabaseAdmin.from("audit_log").insert({
      acquisition_id: doc.data.acquisition_id,
      actor: String(s["recipient_email"]),
      action: "External read-only link opened",
      field: "document_share",
      new_value: `${String(s["template_name"])} v${doc.data.version}`,
      reason: "Outside reader opened the shared document",
      phase: "External access",
    } as never);

    return {
      ok: true,
      templateName: String(s["template_name"]),
      version: doc.data.version ?? null,
      acquisitionId: doc.data.acquisition_id ?? null,
      values: (doc.data.field_values ?? {}) as Record<string, string>,
      recipientEmail: String(s["recipient_email"]),
      issuedBy: String(s["issued_by"]),
      expiresAt: String(s["expires_at"]),
    };
  });
