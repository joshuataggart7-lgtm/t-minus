import { useState } from "react";
import type { EmailDraft } from "@/lib/email-drafts";

/**
 * Email drafts written from the record, for the officer to copy into mail.
 * Nothing is sent from T-Minus and no external system is written.
 */
export function EmailDraftsPanel({
  drafts,
  onCopied,
}: {
  drafts: EmailDraft[];
  onCopied?: (label: string) => void;
}) {
  const first = drafts.find((d) => d.available) ?? drafts[0];
  const [key, setKey] = useState(first?.key ?? "");
  const [note, setNote] = useState<string | null>(null);
  const draft = drafts.find((d) => d.key === key) ?? first ?? null;
  if (!draft) return null;

  const text = draft.available
    ? `To: ${draft.to || "—"}\nSubject: ${draft.subject}\n\n${draft.body}`
    : "";

  return (
    <details aria-label="Email drafts" className="mb-8 max-w-[80ch] rounded-xl border border-border bg-background">
      <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">Draft an email</summary>
      <div className="border-t border-border px-5 py-4">
        <p className="mb-3 text-[13px] leading-[18px] text-muted-foreground">
          Written from this record in the contracting officer&rsquo;s voice. Copy only — T-Minus does not send mail.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {drafts.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => {
                setKey(d.key);
                setNote(null);
              }}
              aria-pressed={d.key === draft.key}
              className={`rounded-lg border px-3 py-2 text-[13px] ${
                d.key === draft.key ? "border-primary text-primary" : "border-border"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {draft.available ? (
          <>
            <label className="mb-1 block text-[13px] text-muted-foreground" htmlFor="email-draft-body">
              {draft.label}
            </label>
            <textarea
              id="email-draft-body"
              readOnly
              value={text}
              rows={14}
              className="w-full rounded-lg border border-border bg-background p-3 text-[13px] leading-[18px]"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-[15px]"
                onClick={() => {
                  void navigator.clipboard?.writeText(text).then(
                    () => {
                      setNote("Copied. Paste it into your mail client.");
                      onCopied?.(draft.label);
                    },
                    () => setNote("The copy did not go through. Select the text and copy it by hand."),
                  );
                }}
              >
                Copy the draft
              </button>
              {note ? <span className="text-[13px] text-muted-foreground">{note}</span> : null}
            </div>
          </>
        ) : (
          <p className="text-[15px] leading-[22px] text-muted-foreground">{draft.unavailableNote}</p>
        )}
      </div>
    </details>
  );
}
