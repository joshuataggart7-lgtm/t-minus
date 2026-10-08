// Closeout record. The Closeout Transfer Checklist reads these values instead
// of blank boxes; the retention date is computed from the final payment date.

import { writeAudit } from "@/lib/audit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import { CiteChip, StatusChip } from "@/components/ui-mc";
import {
  closeoutChecklist,
  closeoutMemo,
  closeoutOf,
  closeoutReady,
  retentionDate,
  type CloseoutRecord,
} from "@/lib/vehicles";

export function CloseoutPanel({
  acq,
  canWrite,
  actor,
  onBanner,
  cparsRecorded,
}: {
  acq: Record<string, unknown> | null | undefined;
  canWrite: boolean;
  actor: string;
  onBanner: (s: string) => void;
  cparsRecorded: boolean;
}) {
  const qc = useQueryClient();
  const acquisitionId = String(acq?.["acquisition_id"] ?? "");
  const saved = acq ? closeoutOf(acq) : null;
  const [draft, setDraft] = useState<CloseoutRecord | null>(null);
  const record = draft ?? saved;

  const save = useMutation({
    mutationFn: async (next: CloseoutRecord) => {
      const name = await signedInName(actor);
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ closeout: next } as never)
        .eq("acquisition_id", acquisitionId);
      if (error) throw new Error(error.message);
      await writeAudit({
        acquisition_id: acquisitionId,
        actor: name,
        action: "Closeout record updated",
        field: "closeout",
        old_value: null,
        new_value: next.final_payment_date ?? "",
        reason: "The closeout record was updated on the file.",
      } as never);
    },
    onSuccess: () => {
      onBanner("The closeout record was saved.");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: Error) => onBanner(`The closeout record was not saved: ${e.message}. Try again.`),
  });

  if (!acq || !record) return null;
  const phase = String(acq["current_phase"] ?? "");
  const launched = String(acq["clock_state"] ?? "") === "launched";
  if (!launched && phase !== "Closeout") return null;

  const set = (patch: Partial<CloseoutRecord>) => setDraft({ ...record, ...patch });
  const retention = retentionDate(record.final_payment_date);
  const items = closeoutChecklist(record, { cparsRecorded });
  const open = items.filter((i) => !i.done);
  const ready = closeoutReady(items);
  const done = items.length - open.length;

  return (
    <section aria-label="Closeout record" className="mc-kpanel mc-pa mb-10 w-full">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
          <h2 className="mc-kpanel-title">Closeout record</h2>
          <p className="mc-pa-sub">
            The Closeout Transfer Checklist reads these values. Each line reads from this record;
            nothing is marked complete that the record does not show.
          </p>
        </div>
        <div className="mc-kpanel-status">
          <StatusChip
            label={ready ? "Ready for transfer" : `${open.length} open`}
            tone={ready ? "ontrack" : "attention"}
          />
          <span className="mc-req-meta" data-numeric>
            {done} of {items.length} complete
          </span>
        </div>
      </div>

      <div className="mc-kpanel-section">
        <div className="mc-pa-form">
          <label className="mc-pa-label">
            Deobligation amount, dollars
            <input
              className="mc-pa-input"
              inputMode="decimal"
              disabled={!canWrite}
              value={record.deobligation_amount ?? ""}
              onChange={(e) =>
                set({ deobligation_amount: e.target.value.trim() ? Number(e.target.value) : null })
              }
            />
          </label>
          <label className="mc-pa-label">
            Deobligation date
            <input
              type="date"
              className="mc-pa-input"
              disabled={!canWrite}
              value={record.deobligation_date ?? ""}
              onChange={(e) => set({ deobligation_date: e.target.value })}
            />
          </label>
          <label className="mc-pa-label">
            Final invoice date
            <input
              type="date"
              className="mc-pa-input"
              disabled={!canWrite}
              value={record.final_invoice_date ?? ""}
              onChange={(e) => set({ final_invoice_date: e.target.value })}
            />
          </label>
          <label className="mc-pa-label">
            Final payment date
            <input
              type="date"
              className="mc-pa-input"
              disabled={!canWrite}
              value={record.final_payment_date ?? ""}
              onChange={(e) => set({ final_payment_date: e.target.value })}
            />
          </label>
          <label className="mc-pa-toggle">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={Boolean(record.release_of_claims)}
              onChange={(e) => set({ release_of_claims: e.target.checked })}
            />
            Release of claims received
          </label>
          <label className="mc-pa-toggle">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={Boolean(record.property_cleared)}
              onChange={(e) => set({ property_cleared: e.target.checked })}
            />
            Government property cleared
          </label>
        </div>
        <dl className="mc-pa-facts is-2 mt-4">
          <div>
            <dt>Final CPARS</dt>
            <dd className={cparsRecorded ? undefined : "is-blank"}>
              {cparsRecorded ? "Entered on this file" : "Not entered yet"}
            </dd>
          </div>
          <div>
            <dt>Retention date</dt>
            <dd className={retention ? undefined : "is-blank"}>
              {retention ? (
                <>
                  {retention}, six years after final payment <CiteChip cite="RFO FAR 4.309" />
                </>
              ) : (
                "Set the final payment date to compute it"
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mc-kpanel-section">
        <h3 className="mc-req-h">Closeout checklist</h3>
        <ul className="mc-pa-check">
          {items.map((i) => (
            <li key={i.label} className={i.done ? "is-done" : undefined}>
              <span className="mc-pa-check-main">
                <span>{i.label}</span>
                {i.citation ? <CiteChip cite={i.citation} /> : null}
              </span>
              <StatusChip label={i.done ? "Complete" : "Open"} tone={i.done ? "ontrack" : "attention"} />
              {i.note ? <span className="mc-pa-check-note">{i.note}</span> : null}
            </li>
          ))}
        </ul>
        <p className={`mc-pa-callout mt-3 ${ready ? "is-ontrack" : ""}`}>
          {ready
            ? "Every closeout item reads complete. This file is ready for transfer."
            : `This file is not ready for transfer yet. ${open.length} item${open.length === 1 ? "" : "s"} still open: ${open
                .map((i) => i.label.toLowerCase())
                .join(", ")}.`}
        </p>
      </div>

      <div className="mc-pa-actions">
        {canWrite ? (
          <button
            type="button"
            disabled={!draft || save.isPending}
            onClick={() => draft && save.mutate(draft)}
            className="mc-req-button"
          >
            {save.isPending ? "Saving" : "Save the closeout record"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(closeoutMemo(acquisitionId, items, record));
            onBanner("The memorandum to file was copied. Paste it where you keep the file.");
          }}
          className="mc-pa-link"
        >
          Copy the memorandum to file
        </button>
      </div>
    </section>
  );
}
