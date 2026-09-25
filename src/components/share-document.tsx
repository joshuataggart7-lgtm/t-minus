/**
 * E8. Limited external access.
 *
 * Issues a read-only link to one saved document version for one named outside
 * email, good for seven days, revocable at any time by the issuing office.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { StatusMark } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { issueDocumentShare, revokeDocumentShare, SHARE_DAYS } from "@/lib/document-share.functions";

type ShareRow = {
  share_id: string;
  token: string;
  recipient_email: string;
  document_version: number | null;
  issued_by: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  open_count: number;
  last_opened_at: string | null;
  magic_link_sent: boolean;
  magic_link_note: string | null;
};

function state(row: ShareRow) {
  if (row.revoked_at) return { label: "Revoked", color: "var(--atrisk)" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { label: "Expired", color: "var(--muted-foreground)" };
  return { label: "Open", color: "var(--ontrack)" };
}

export function ShareDocument({
  documentId,
  canShare,
}: {
  documentId: string | null;
  canShare: boolean;
}) {
  const qc = useQueryClient();
  const issue = useServerFn(issueDocumentShare);
  const revoke = useServerFn(revokeDocumentShare);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["document-shares", documentId],
    enabled: Boolean(documentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_shares")
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ShareRow[];
    },
  });

  const issueLink = useMutation({
    mutationFn: async () => {
      if (!documentId) throw new Error("Save a version first, then share it.");
      return issue({
        data: {
          documentId,
          recipientEmail: email.trim(),
          recipientName: name.trim() || undefined,
          origin: window.location.origin,
        },
      });
    },
    onSuccess: async (res) => {
      setIssued(res.url);
      setMessage(
        `Link issued for ${email.trim()}. It closes on ${res.expiresAt.slice(0, 10)}. ${res.magicLinkNote}`,
      );
      setEmail("");
      setName("");
      await qc.invalidateQueries({ queryKey: ["document-shares", documentId] });
    },
    onError: (e) => setMessage(e instanceof Error ? `The link was not issued: ${e.message}` : "It was not issued."),
  });

  const revokeLink = useMutation({
    mutationFn: (shareId: string) => revoke({ data: { shareId } }),
    onSuccess: async () => {
      setIssued(null);
      setMessage("That link was revoked. It no longer opens the document.");
      await qc.invalidateQueries({ queryKey: ["document-shares", documentId] });
    },
    onError: (e) => setMessage(e instanceof Error ? `It was not revoked: ${e.message}` : "It was not revoked."),
  });

  const rows = q.data ?? [];

  return (
    <section aria-label="Outside access" className="mb-10 max-w-[80ch]">
      <h2 className="mb-3 text-[18px] leading-6 font-medium">Outside access</h2>
      <p className="mb-4 text-[15px] leading-[22px] text-muted-foreground">
        Send this one document to a named outside address, read only, for {SHARE_DAYS} days. Nothing else in T-Minus
        opens with the link, and you can revoke it at any time.
      </p>

      {!documentId ? (
        <p className="text-muted-foreground">Save a version first, then you can share it.</p>
      ) : canShare ? (
        <div className="mb-6 border border-border bg-background p-4">
          <label htmlFor="share-email" className="block text-[13px] text-muted-foreground">
            Recipient email
          </label>
          <input
            id="share-email"
            type="email"
            className="mt-1 mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="share-name" className="block text-[13px] text-muted-foreground">
            Recipient name (optional)
          </label>
          <input
            id="share-name"
            className="mt-1 mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground disabled:opacity-50"
            disabled={issueLink.isPending || !email.trim()}
            onClick={() => issueLink.mutate()}
          >
            {issueLink.isPending ? "Issuing" : "Issue a read-only link"}
          </button>
        </div>
      ) : (
        <p className="mb-6 text-muted-foreground">Only the contracting office can issue outside links.</p>
      )}

      {message ? (
        <p role="status" className="mb-3 text-[15px] leading-[22px]">
          {message}
        </p>
      ) : null}
      {issued ? (
        <p className="mb-6 text-[13px] break-all">
          <span className="text-muted-foreground">Link: </span>
          {issued}
        </p>
      ) : null}

      {rows.length ? (
        <div className="overflow-x-auto">
        <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-3 py-2 font-medium">Recipient</th>
              <th scope="col" className="px-3 py-2 font-medium">Closes</th>
              <th scope="col" className="px-3 py-2 font-medium">Opens</th>
              <th scope="col" className="px-3 py-2 font-medium">State</th>
              {canShare ? <th scope="col" className="px-3 py-2 font-medium">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = state(r);
              return (
                <tr key={r.share_id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2">
                    {r.recipient_email}
                    <span className="block text-muted-foreground">
                      Version {r.document_version ?? 1} · issued by {r.issued_by}
                    </span>
                  </td>
                  <td className="px-3 py-2" data-numeric>
                    {r.expires_at.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2" data-numeric>
                    {r.open_count}
                    {r.last_opened_at ? (
                      <span className="block text-muted-foreground">{new Date(r.last_opened_at).toLocaleString()}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <StatusMark color={s.color}>{s.label}</StatusMark>
                  </td>
                  {canShare ? (
                    <td className="px-3 py-2">
                      {r.revoked_at ? (
                        <span className="text-muted-foreground">Revoked by {r.revoked_by ?? "the office"}</span>
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg border border-border px-3 py-1"
                          style={{ color: "var(--atrisk)" }}
                          onClick={() => revokeLink.mutate(r.share_id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      ) : documentId ? (
        <p className="text-muted-foreground">No outside links for this document.</p>
      ) : null}
    </section>
  );
}
