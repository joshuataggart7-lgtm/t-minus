// Payment milestones on a file. Optional and empty unless the contracting
// office records something: no events, amounts or percentages are invented.
// A CLIN can be linked only from the schedule already on the file.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { signedInName } from "@/lib/account-name";
import { loadClinSchedule } from "@/lib/clin-schedule";
import {
  PAYMENT_AMOUNT_BLANK,
  PAYMENT_MILESTONES_EMPTY,
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

const field =
  "w-full border border-border bg-background px-2 py-1 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PaymentMilestonesPanel({
  acquisitionId,
  canWrite,
  actor,
  onBanner,
}: {
  acquisitionId: string;
  canWrite: boolean;
  actor: string;
  onBanner: (s: string) => void;
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
            {c.clin_number}
          </option>
        ))}
      </select>
    </>
  );

  const cell = (label: string, id: string, key: keyof Draft, d: Draft, set: (d: Draft) => void) => (
    <td className="p-2">
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
    <div className="mt-3 border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[15px] font-medium">Payment milestones</h4>
        <span className="text-[13px] text-muted-foreground">
          Read in the handoff packet, not in a separate spreadsheet.
        </span>
        {canWrite ? (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="ml-auto text-[13px] text-primary underline-offset-2 hover:underline"
          >
            {adding ? "Cancel" : "Add a payment milestone"}
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
          {PAYMENT_MILESTONES_EMPTY} Nothing is written here for you; the contracting office
          records each milestone when the requirement calls for one.
        </p>
      ) : (
        <table className="mt-3 w-full text-[13px] leading-[18px]">
          <caption className="sr-only">Payment milestones recorded on this file</caption>
          <thead>
            <tr className="border-y border-border text-left">
              <th scope="col" className="p-2">Event</th>
              <th scope="col" className="p-2">Due logic</th>
              <th scope="col" className="p-2">CLIN</th>
              <th scope="col" className="p-2">Amount</th>
              <th scope="col" className="p-2">Percent</th>
              {canWrite ? <th scope="col" className="p-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editingId === r.milestone_id ? (
                <tr key={r.milestone_id} className="border-b border-border align-top">
                  {cell("Event", `pay-event-${r.milestone_id}`, "event", editDraft, setEditDraft)}
                  {cell("Due logic", `pay-due-${r.milestone_id}`, "due_logic", editDraft, setEditDraft)}
                  <td className="p-2">
                    {clinPicker(`pay-clin-${r.milestone_id}`, editDraft, setEditDraft, "CLIN link")}
                  </td>
                  {cell("Amount", `pay-amount-${r.milestone_id}`, "amount", editDraft, setEditDraft)}
                  {cell("Percent", `pay-percent-${r.milestone_id}`, "percent", editDraft, setEditDraft)}
                  <td className="p-2">
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
                <tr key={r.milestone_id} className="border-b border-border align-top">
                  <td className="p-2">
                    {r.event}
                    {r.notes?.trim() ? (
                      <span className="block text-muted-foreground">{r.notes.trim()}</span>
                    ) : null}
                  </td>
                  <td className="p-2">{payText(r.due_logic)}</td>
                  <td className="p-2" data-numeric>{payText(r.clin_number)}</td>
                  <td className="p-2" data-numeric>{payAmount(r.amount)}</td>
                  <td className="p-2" data-numeric>
                    {payPercent(r.percent)}
                    {payValueMissing(r) ? (
                      <span className="block text-muted-foreground">{PAYMENT_AMOUNT_BLANK}</span>
                    ) : null}
                  </td>
                  {canWrite ? (
                    <td className="p-2">
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
      )}

      {canWrite && adding ? (
        <div className="mt-3 grid grid-cols-1 gap-3 border border-border bg-background p-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-pay-event">
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
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-pay-due">
              Due logic (optional)
            </label>
            <input
              id="new-pay-due"
              className={field}
              value={draft.due_logic}
              onChange={(e) => setDraft({ ...draft, due_logic: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-pay-clin">
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
                  {c.clin_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-pay-amount">
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
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-pay-percent">
              Percent (optional)
            </label>
            <input
              id="new-pay-percent"
              className={field}
              value={draft.percent}
              onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-pay-notes">
              Note (optional)
            </label>
            <input
              id="new-pay-notes"
              className={field}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="button"
              disabled={!canAdd || add.isPending}
              onClick={() => add.mutate()}
              className="border border-border px-3 py-1 text-[13px] disabled:opacity-50"
            >
              Add the payment milestone
            </button>
            <span className="ml-3 text-[13px] text-muted-foreground">
              Blank fields print "Not recorded". {PAYMENT_AMOUNT_BLANK}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
