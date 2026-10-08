// Payment milestones on a file. Optional and empty unless the contracting
// office records something: no events, amounts or percentages are invented.
// A CLIN can be linked only from the schedule already on the file.

import { TableScrollRegion } from "@/components/table-scroll-region";
import { StatusChip } from "@/components/ui-mc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { signedInName } from "@/lib/account-name";
import { loadClinSchedule } from "@/lib/clin-schedule";
import {
  PAYMENT_AMOUNT_BLANK,
  PAYMENT_MILESTONES_EMPTY,
  PAYMENT_MILESTONES_EMPTY_NOTE,
  PAYMENT_PLAN_LABEL,
  paymentMilestonesForPacket,
  paymentPlanNotes,
  createPaymentMilestone,
  deletePaymentMilestone,
  loadPaymentMilestones,
  payAmount,
  paymentClinHint,
  paymentOrphanNote,
  paymentUnlinkedNote,
  payPercent,
  payText,
  payValueMissing,
  updatePaymentMilestone,
  type PaymentMilestoneInput,
  type PaymentMilestoneRow,
} from "@/lib/payment-milestones";


type Draft = {
  event: string;
  due_logic: string;
  clin_id: string;
  amount: string;
  percent: string;
  notes: string;
};

const emptyDraft: Draft = {
  event: "",
  due_logic: "",
  clin_id: "",
  amount: "",
  percent: "",
  notes: "",
};

const draftFrom = (r: PaymentMilestoneRow): Draft => ({
  event: r.event,
  due_logic: r.due_logic ?? "",
  clin_id: r.clin_id ?? "",
  amount: r.amount === null ? "" : String(r.amount),
  percent: r.percent === null ? "" : String(r.percent),
  notes: r.notes ?? "",
});

const num = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const x = Number(t.replace(/[$,]/g, ""));
  return Number.isFinite(x) ? x : null;
};

const field = "mc-pa-input";

/** "0001: Line item description", truncated so the picker stays readable. */
const clinOptionLabel = (c: { clin_number: string; description: string }): string => {
  const d = (c.description ?? "").trim();
  if (!d) return c.clin_number;
  const short = d.length > 48 ? `${d.slice(0, 47)}…` : d;
  return `${c.clin_number}: ${short}`;
};


export function PaymentMilestonesPanel({
  acquisitionId,
  canWrite,
  actor,
  onBanner,
  regionContext,
}: {
  acquisitionId: string;
  canWrite: boolean;
  actor: string;
  onBanner: (s: string) => void;
  regionContext?: string;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);

  const q = useQuery({
    queryKey: ["payment-milestones", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadPaymentMilestones(acquisitionId),
  });
  const rows = q.data ?? [];

  // Only the line items already on the schedule can be linked.
  const clinQ = useQuery({
    queryKey: ["clin-schedule", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadClinSchedule(acquisitionId),
  });
  const clins = clinQ.data ?? [];

  // Advisory only. These notes never hold the file or block a phase exit.
  const clinIds = clins.map((c) => c.clin_id);
  const clinNote = (r: PaymentMilestoneRow): string | null =>
    paymentOrphanNote(r, clinIds) ?? paymentUnlinkedNote(r, clins.length);

  // Plan-level notes read from the same rows the packet prints.
  const planNotes: string[] = paymentPlanNotes(paymentMilestonesForPacket(rows, clins));


  const toInput = (d: Draft): PaymentMilestoneInput => {
    const linked = clins.find((c) => c.clin_id === d.clin_id);
    return {
      event: d.event,
      due_logic: d.due_logic,
      clin_id: linked ? linked.clin_id : null,
      clin_number: linked ? linked.clin_number : null,
      amount: num(d.amount),
      percent: num(d.percent),
      notes: d.notes,
    };
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["payment-milestones", acquisitionId] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const name = await signedInName(actor);
      await createPaymentMilestone(acquisitionId, toInput(draft), name, rows.length);
    },
    onSuccess: () => {
      onBanner("The payment milestone was added to this file.");
      setAdding(false);
      setDraft(emptyDraft);
      invalidate();
    },
    onError: (e: Error) => onBanner(`The payment milestone was not added: ${e.message}. Try again.`),
  });

  const save = useMutation({
    mutationFn: async (row: PaymentMilestoneRow) => {
      const name = await signedInName(actor);
      await updatePaymentMilestone(row, toInput(editDraft), name);
    },
    onSuccess: () => {
      onBanner("The payment milestone was saved.");
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => onBanner(`The payment milestone was not saved: ${e.message}. Try again.`),
  });

  const remove = useMutation({
    mutationFn: async (row: PaymentMilestoneRow) => {
      const name = await signedInName(actor);
      await deletePaymentMilestone(row, name);
    },
    onSuccess: () => {
      onBanner("The payment milestone was removed from this file.");
      invalidate();
    },
    onError: (e: Error) =>
      onBanner(`The payment milestone was not removed: ${e.message}. Try again.`),
  });

  const canAdd = draft.event.trim().length > 0;

  const clinPicker = (id: string, d: Draft, set: (d: Draft) => void, label: string) => (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={field}
        value={d.clin_id}
        onChange={(e) => set({ ...d, clin_id: e.target.value })}
      >
        <option value="">No CLIN linked</option>
        {clins.map((c) => (
          <option key={c.clin_id} value={c.clin_id}>
            {clinOptionLabel(c)}
          </option>
        ))}

      </select>
    </>
  );

  const cell = (label: string, id: string, key: keyof Draft, d: Draft, set: (d: Draft) => void) => (
    <td data-label={label}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={field}
        value={d[key]}
        onChange={(e) => set({ ...d, [key]: e.target.value })}
      />
    </td>
  );

  return (
    <div className="mc-kpanel mc-pa mt-3">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
          <h4 className="mc-kpanel-title">Payment milestones: invoice plan</h4>
          <p className="mc-pa-sub">Read in the handoff packet, not in a separate spreadsheet. {PAYMENT_PLAN_LABEL}</p>
        </div>
        <div className="mc-kpanel-status">
          <StatusChip
            label={rows.length === 0 ? "None recorded" : `${rows.length} recorded`}
            tone={rows.length === 0 ? "neutral" : "info"}
          />
          {canWrite ? (
            <button type="button" onClick={() => setAdding((v) => !v)} className="mc-pa-link">
              {adding ? "Cancel" : "Add a payment milestone"}
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mc-req-fallback mt-3">
          {PAYMENT_MILESTONES_EMPTY} {PAYMENT_MILESTONES_EMPTY_NOTE}
          {paymentClinHint(clins.length) ? (
            <span className="block">{paymentClinHint(clins.length)}</span>
          ) : null}
        </p>
      ) : (
        <TableScrollRegion baseClassName="mc-dt-wrap mt-3" className="stack" label={regionContext ? `Payment milestones table, ${regionContext}` : "Payment milestones table"}>
<table className="mc-dt stack">
          <caption className="sr-only">Payment milestones recorded on this file</caption>
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Due logic</th>
              <th scope="col" className="is-nowrap">CLIN</th>
              <th scope="col" className="is-numeric">Amount</th>
              <th scope="col" className="is-numeric">Percent</th>
              {canWrite ? <th scope="col">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editingId === r.milestone_id ? (
                <tr key={r.milestone_id}>
                  {cell("Event", `pay-event-${r.milestone_id}`, "event", editDraft, setEditDraft)}
                  {cell("Due logic", `pay-due-${r.milestone_id}`, "due_logic", editDraft, setEditDraft)}
                  <td data-label="CLIN">
                    {clinPicker(`pay-clin-${r.milestone_id}`, editDraft, setEditDraft, "CLIN link")}
                  </td>
                  {cell("Amount", `pay-amount-${r.milestone_id}`, "amount", editDraft, setEditDraft)}
                  {cell("Percent", `pay-percent-${r.milestone_id}`, "percent", editDraft, setEditDraft)}
                  <td data-label="Actions">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => save.mutate(r)}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.milestone_id}>
                  <td data-label="Event">
                    {r.event}
                    {r.notes?.trim() ? (
                      <span className="mc-req-meta">{r.notes.trim()}</span>
                    ) : null}
                  </td>
                  <td data-label="Due logic">{payText(r.due_logic)}</td>
                  <td data-label="CLIN" data-numeric>
                    {payText(r.clin_number)}
                    {clinNote(r) ? (
                      <span className="mc-req-meta">{clinNote(r)}</span>
                    ) : null}
                  </td>
                  <td data-label="Amount" className="is-numeric">{payAmount(r.amount)}</td>
                  <td data-label="Percent" className="is-numeric">
                    {payPercent(r.percent)}
                    {payValueMissing(r) ? (
                      <span className="mc-req-meta whitespace-normal">{PAYMENT_AMOUNT_BLANK}</span>
                    ) : null}
                  </td>
                  {canWrite ? (
                    <td data-label="Actions">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.milestone_id);
                            setEditDraft(draftFrom(r));
                          }}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove payment milestone "${r.event}"?`)) {
                              remove.mutate(r);
                            }
                          }}
                          className="text-destructive underline-offset-2 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ),
            )}
          </tbody>
        </table>
</TableScrollRegion>
      )}

      {planNotes.length > 0 ? (
        <ul className="mc-pa-list is-meta mt-3">
          {planNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      {canWrite && adding ? (
        <div className="mc-kpanel-section mt-4">
          <h5 className="mc-req-h">New payment milestone</h5>
          <div className="mc-pa-form is-3">
            <div className="is-wide">
              <label className="mc-pa-label" htmlFor="new-pay-event">
                Event that triggers payment
              </label>
              <input
                id="new-pay-event"
                className={field}
                value={draft.event}
                onChange={(e) => setDraft({ ...draft, event: e.target.value })}
              />
            </div>
            <div>
              <label className="mc-pa-label" htmlFor="new-pay-due">
                Due logic (optional)
              </label>
              <input
                id="new-pay-due"
                className={field}
                placeholder='Free text: a date or "upon CLIN 0001 acceptance"'
                value={draft.due_logic}
                onChange={(e) => setDraft({ ...draft, due_logic: e.target.value })}
              />
            </div>
            <div>
              <label className="mc-pa-label" htmlFor="new-pay-clin">
                CLIN link (optional)
              </label>
              <select
                id="new-pay-clin"
                className={field}
                value={draft.clin_id}
                onChange={(e) => setDraft({ ...draft, clin_id: e.target.value })}
              >
                <option value="">No CLIN linked</option>
                {clins.map((c) => (
                  <option key={c.clin_id} value={c.clin_id}>
                    {clinOptionLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mc-pa-label" htmlFor="new-pay-amount">
                Amount (optional)
              </label>
              <input
                id="new-pay-amount"
                className={field}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="mc-pa-label" htmlFor="new-pay-percent">
                Percent (optional)
              </label>
              <input
                id="new-pay-percent"
                className={field}
                value={draft.percent}
                onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
              />
            </div>
            <div className="is-wide">
              <label className="mc-pa-label" htmlFor="new-pay-notes">
                Note (optional)
              </label>
              <input
                id="new-pay-notes"
                className={field}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="mc-pa-actions">
            <button
              type="button"
              disabled={!canAdd || add.isPending}
              onClick={() => add.mutate()}
              className="mc-req-button"
            >
              Add the payment milestone
            </button>
            <span className="mc-req-meta">
              Blank fields print "Not recorded". {PAYMENT_AMOUNT_BLANK}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
