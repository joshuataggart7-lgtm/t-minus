// Situation memo. Pick the event, get a memo shell from facts already on the
// record, copy it. Advisory: nothing here holds the file or exits a phase.

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import { SITUATION_EMPTY, SITUATION_EVENTS, situationMemo } from "@/lib/situation-memo";

export function SituationMemoPanel({
  acq,
  actor,
  onBanner,
}: {
  acq: Record<string, unknown> | null | undefined;
  actor: string;
  onBanner: (s: string) => void;
}) {
  const [key, setKey] = useState("");
  if (!acq) return null;
  const acquisitionId = String(acq["acquisition_id"] ?? "");
  const event = SITUATION_EVENTS.find((e) => e.key === key) ?? null;
  const text = event ? situationMemo(event, acq) : "";

  const copy = async () => {
    if (!event) return;
    void navigator.clipboard?.writeText(text);
    onBanner("The situation memorandum was copied. Paste it where you keep the file.");
    try {
      const name = await signedInName(actor);
      await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: name,
        action: "Situation memo copied",
        field: "situation_memo",
        old_value: null,
        new_value: event.label,
        reason: "A situation memorandum shell was copied from the record.",
      } as never);
    } catch {
      // the copy already happened; the log entry is not worth an error to the user
    }
  };

  return (
    <section
      aria-label="Situation memo"
      className="mb-10 max-w-[80ch] rounded-xl border border-border bg-background p-5"
    >
      <h2 className="text-[18px] leading-6 font-medium">Situation memo</h2>
      <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
        A memorandum shell for an unexpected event, built only from facts on this record. Advisory;
        it does not hold the file or change a phase.
      </p>
      <label className="mt-3 block text-[13px] text-muted-foreground">
        Event
        <select
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        >
          <option value="">Choose an event</option>
          {SITUATION_EVENTS.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
        </select>
      </label>

      {!event ? (
        <p className="mt-3 text-[13px] text-muted-foreground">{SITUATION_EMPTY}</p>
      ) : (
        <>
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap border border-border p-3 text-[13px] leading-[18px]">
            {text}
          </pre>
          <button type="button" onClick={() => void copy()} className="mt-2 text-[15px] text-primary">
            Copy the situation memorandum
          </button>
        </>
      )}
    </section>
  );
}
