/**
 * COR or task order request panel: a local scaffold on awarded and IDIQ files.
 * Advisory only: it never holds a phase exit and never writes to NCMS.
 */

import { writeAudit } from "@/lib/audit";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useReadOnly } from "@/components/role-context";
import { postAward } from "@/lib/post-award";
import { StatusChip } from "@/components/ui-mc";
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

const input = "mc-pa-input";

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
  const readOnly = useReadOnly();
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
      await writeAudit({
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
    <section aria-label="COR or task order request" className="mc-kpanel mc-pa mb-8 w-full">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
          <h3 className="mc-kpanel-title">COR or task order request</h3>
          <p className="mc-pa-sub">{COR_TO_NOTE}</p>
        </div>
        <div className="mc-kpanel-status">
          <StatusChip label={empty ? "Not written yet" : "Recorded"} tone={empty ? "neutral" : "ontrack"} />
          {saved.updated_at ? (
            <span className="mc-req-meta" data-numeric>
              Last saved {new Date(saved.updated_at).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mc-kpanel-section">
        <h4 className="mc-req-h">On the record</h4>
        <dl className="mc-pa-facts is-3">
          <div>
            <dt>Requester on the record</dt>
            <dd className={defaults.requester ? undefined : "is-blank"}>{defaults.requester ?? NOT_RECORDED}</dd>
          </div>
          <div>
            <dt>COR on the record</dt>
            <dd className={defaults.corOrTo ? undefined : "is-blank"}>{defaults.corOrTo ?? NOT_RECORDED}</dd>
          </div>
          <div>
            <dt>COR appointed on</dt>
            <dd className={defaults.appointedOn ? undefined : "is-blank"} data-numeric>{defaults.appointedOn ?? NOT_RECORDED}</dd>
          </div>
        </dl>
        <p className="mc-pa-sub mt-2">
          Appointment dates stay in the contracting officer's representative block above; this panel reads them.
        </p>
      </div>

      <div className="mc-kpanel-section">
        <h4 className="mc-req-h">The request</h4>
        <div className="mc-pa-form">
          <div>
            <label className="mc-pa-label" htmlFor="cor-to-requester">Requester</label>
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
            <label className="mc-pa-label" htmlFor="cor-to-name">COR or task order manager</label>
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
            <label className="mc-pa-label" htmlFor="cor-to-type">Request type</label>
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
            <label className="mc-pa-label" htmlFor="cor-to-asking">What is being asked</label>
            <input
              id="cor-to-asking"
              className={input}
              disabled={!canWrite}
              value={form.what_asking ?? ""}
              onChange={(e) => setForm({ ...form, what_asking: e.target.value })}
            />
          </div>
          <div className="is-wide">
            {readOnly ? (
              form.narrative ? <p className="mc-pa-text whitespace-pre-wrap">{form.narrative}</p> : null
            ) : (<>
            <label className="mc-pa-label" htmlFor="cor-to-narrative">Narrative</label>
            <textarea
              id="cor-to-narrative"
              rows={4}
              className={input}
              disabled={!canWrite}
              value={form.narrative ?? ""}
              onChange={(e) => setForm({ ...form, narrative: e.target.value })}
            />
            </>)}
            {empty ? (
              <p className="mc-pa-sub mt-1">
                Nothing written yet. The memo below shows "Not recorded" until it is.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mc-pa-actions">
          {readOnly ? null : <button
            type="button"
            disabled={!canWrite || save.isPending}
            onClick={() => save.mutate()}
            className="mc-req-button"
          >
            Save the request
          </button>}
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(memo);
              setNote("Memo copied.");
            }}
            className="mc-pa-link"
          >
            Copy the memo to file
          </button>
        </div>
        {note ? <p className="mc-pa-text mt-2" role="status">{note}</p> : null}
      </div>

      <div className="mc-kpanel-section">
        <h4 className="mc-req-h">Memo to file</h4>
        <pre className="mc-pa-memo">{memo}</pre>
      </div>
    </section>
  );
}
