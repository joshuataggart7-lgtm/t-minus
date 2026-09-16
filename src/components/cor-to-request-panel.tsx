/**
 * COR / task order request panel — a local scaffold on awarded and IDIQ files.
 * Advisory only: it never holds a phase exit and never writes to NCMS.
 */

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { postAward } from "@/lib/post-award";
import {
  COR_TO_NOTE,
  NOT_RECORDED,
  corToDefaults,
  corToMemo,
  corToRequest,
  corToRequestApplies,
  type CorToRequest,
  type CorToRequestType,
} from "@/lib/cor-to-request";

const input =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px]";

export function CorToRequestPanel({
  acq,
  profile,
  actorName,
  canWrite,
  onSaved,
}: {
  acq: Record<string, unknown> | null;
  profile?: string | null;
  actorName: string;
  canWrite: boolean;
  onSaved?: () => void;
}) {
  const applies = corToRequestApplies(acq, profile);
  const saved = useMemo(() => corToRequest(acq), [acq]);
  const defaults = useMemo(() => corToDefaults(acq), [acq]);

  const [form, setForm] = useState<CorToRequest>(saved);
  const [note, setNote] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!acq) return;
      const next: CorToRequest = { ...form, updated_at: new Date().toISOString() };
      const pa = { ...(postAward(acq as never) as Record<string, unknown>), cor_to_request: next };
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ post_award: pa, updated_at: new Date().toISOString() } as never)
        .eq("acquisition_id", String(acq["acquisition_id"]));
      if (error) throw error;
      await supabase.from("audit_log").insert({
        acquisition_id: String(acq["acquisition_id"]),
        actor: actorName,
        action: "COR or task order request recorded",
        field: "post_award.cor_to_request",
        new_value: next.what_asking ?? "",
        reason: "Local memo and handoff aid. NCMS is the system of record.",
        phase: String(acq["current_phase"] ?? ""),
      });
    },
    onSuccess: () => {
      setNote("Recorded on the file.");
      onSaved?.();
    },
    onError: (e: Error) => setNote(`That did not save: ${e.message}. Try again.`),
  });

  if (!applies || !acq) return null;

  const memo = corToMemo(acq, form);
  const empty = !form.what_asking?.trim() && !form.narrative?.trim();

  return (
    <section aria-label="COR or task order request" className="mb-8 max-w-[80ch] border border-border p-4">
      <h3 className="text-[18px] font-medium leading-[24px]">COR or task order request</h3>
      <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{COR_TO_NOTE}</p>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Requester on the record</dt>
          <dd>{defaults.requester ?? NOT_RECORDED}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">COR on the record</dt>
          <dd>{defaults.corOrTo ?? NOT_RECORDED}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">COR appointed on</dt>
          <dd data-numeric>{defaults.appointedOn ?? NOT_RECORDED}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Appointment dates stay in the contracting officer's representative block above; this panel reads them.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[13px]" htmlFor="cor-to-requester">Requester</label>
          <input
            id="cor-to-requester"
            className={input}
            disabled={!canWrite}
            value={form.requester ?? ""}
            placeholder={defaults.requester ?? NOT_RECORDED}
            onChange={(e) => setForm({ ...form, requester: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[13px]" htmlFor="cor-to-name">COR or task order manager</label>
          <input
            id="cor-to-name"
            className={input}
            disabled={!canWrite}
            value={form.cor_or_to ?? ""}
            placeholder={defaults.corOrTo ?? NOT_RECORDED}
            onChange={(e) => setForm({ ...form, cor_or_to: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[13px]" htmlFor="cor-to-type">Request type</label>
          <select
            id="cor-to-type"
            className={input}
            disabled={!canWrite}
            value={form.request_type ?? "COR"}
            onChange={(e) => setForm({ ...form, request_type: e.target.value as CorToRequestType })}
          >
            <option value="COR">COR</option>
            <option value="TO">Task order</option>
          </select>
        </div>
        <div>
          <label className="text-[13px]" htmlFor="cor-to-asking">What is being asked</label>
          <input
            id="cor-to-asking"
            className={input}
            disabled={!canWrite}
            value={form.what_asking ?? ""}
            onChange={(e) => setForm({ ...form, what_asking: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[13px]" htmlFor="cor-to-narrative">Narrative</label>
        <textarea
          id="cor-to-narrative"
          rows={4}
          className={input}
          disabled={!canWrite}
          value={form.narrative ?? ""}
          onChange={(e) => setForm({ ...form, narrative: e.target.value })}
        />
        {empty ? (
          <p className="mt-1 text-[13px] text-muted-foreground">
            Nothing written yet. The memo below shows "Not recorded" until it is.
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canWrite || save.isPending}
          onClick={() => save.mutate()}
          className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground disabled:opacity-60"
        >
          Save the request
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(memo);
            setNote("Memo copied.");
          }}
          className="text-[15px] text-primary"
        >
          Copy the memo to file
        </button>
        {saved.updated_at ? (
          <span className="text-[13px] text-muted-foreground" data-numeric>
            Last saved {new Date(saved.updated_at).toLocaleString()}
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-2 text-[13px]">{note}</p> : null}

      <pre className="mt-3 whitespace-pre-wrap border border-border p-3 text-[13px] leading-[18px]">{memo}</pre>
    </section>
  );
}
