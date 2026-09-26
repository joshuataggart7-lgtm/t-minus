// The schedule of line items on a file. The format scaffold and the local
// handoff packet read this same table, so there is one source of truth. Blanks
// stay blank: quantity, unit and price are only shown where the schedule or the
// estimate on the file carries them.

import { TableScrollRegion } from "@/components/table-scroll-region";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { signedInName } from "@/lib/account-name";
import {
  createClin,
  deleteClin,
  displayAmount,
  ensureClinScheduleFromIgce,
  loadClinSchedule,
  money,
  sourceLabel,
  updateClin,
  type ClinInput,
  type ClinRow,
} from "@/lib/clin-schedule";

const blank: ClinInput = {
  clin_number: "",
  description: "",
  quantity: null,
  unit_of_issue: null,
  unit_price: null,
  extended_price: null,
};

const numOrNull = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};

type Draft = {
  clin_number: string;
  description: string;
  quantity: string;
  unit_of_issue: string;
  unit_price: string;
  extended_price: string;
};

const draftFrom = (r: ClinRow): Draft => ({
  clin_number: r.clin_number,
  description: r.description,
  quantity: r.quantity === null ? "" : String(r.quantity),
  unit_of_issue: r.unit_of_issue ?? "",
  unit_price: r.unit_price === null ? "" : String(r.unit_price),
  extended_price: r.extended_price === null ? "" : String(r.extended_price),
});

const emptyDraft: Draft = {
  clin_number: "",
  description: "",
  quantity: "",
  unit_of_issue: "",
  unit_price: "",
  extended_price: "",
};

const toInput = (d: Draft): ClinInput => ({
  ...blank,
  clin_number: d.clin_number,
  description: d.description,
  quantity: numOrNull(d.quantity),
  unit_of_issue: d.unit_of_issue.trim() || null,
  unit_price: numOrNull(d.unit_price),
  extended_price: numOrNull(d.extended_price),
});

const field =
  "w-full border border-border bg-background px-2 py-1 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ClinSchedulePanel({
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
    queryKey: ["clin-schedule", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadClinSchedule(acquisitionId),
  });
  const rows = q.data ?? [];

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["clin-schedule", acquisitionId] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const name = await signedInName(actor);
      await createClin(acquisitionId, toInput(draft), name, rows.length);
    },
    onSuccess: () => {
      onBanner("The line item was added to the schedule.");
      setAdding(false);
      setDraft(emptyDraft);
      invalidate();
    },
    onError: (e: Error) => onBanner(`The line item was not added: ${e.message}. Try again.`),
  });

  const save = useMutation({
    mutationFn: async (row: ClinRow) => {
      const name = await signedInName(actor);
      await updateClin(row, toInput(editDraft), name);
    },
    onSuccess: () => {
      onBanner("The line item was saved.");
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => onBanner(`The line item was not saved: ${e.message}. Try again.`),
  });

  const remove = useMutation({
    mutationFn: async (row: ClinRow) => {
      const name = await signedInName(actor);
      await deleteClin(row, name);
    },
    onSuccess: () => {
      onBanner("The line item was removed from the schedule.");
      invalidate();
    },
    onError: (e: Error) => onBanner(`The line item was not removed: ${e.message}. Try again.`),
  });

  const loadIgce = useMutation({
    mutationFn: async () => {
      const seeded = await ensureClinScheduleFromIgce(acquisitionId);
      return seeded.length;
    },
    onSuccess: (count) => {
      onBanner(
        count > 0
          ? "The schedule was filled from the estimate on this file."
          : "No estimate lines are on this file to load.",
      );
      invalidate();
    },
    onError: (e: Error) => onBanner(`The estimate could not be loaded: ${e.message}. Try again.`),
  });

  const canAdd = draft.clin_number.trim().length > 0 && draft.description.trim().length > 0;

  return (
    <div className="mt-3 border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[15px] font-medium">Schedule of line items</h4>
        <span className="text-[13px] text-muted-foreground">
          The format scaffold and the handoff packet read this table.
        </span>
        {canWrite ? (
          <div className="ml-auto flex flex-wrap gap-3">
            {rows.length === 0 ? (
              <button
                type="button"
                onClick={() => loadIgce.mutate()}
                className="text-[13px] text-primary underline-offset-2 hover:underline"
              >
                Load from the estimate
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="text-[13px] text-primary underline-offset-2 hover:underline"
            >
              {adding ? "Cancel" : "Add a line item"}
            </button>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
          No line items are on the schedule yet. Nothing is invented here; the contracting office adds
          each line, and the estimate on this file can fill the schedule when it is empty.
        </p>
      ) : (
        <TableScrollRegion baseClassName="overflow-x-auto" label="CLIN schedule table">
<table className="mt-3 w-full text-[13px] leading-[18px]">
          <caption className="sr-only">Line items on the schedule for this file</caption>
          <thead>
            <tr className="border-y border-border text-left">
              <th scope="col" className="p-2">CLIN</th>
              <th scope="col" className="p-2">Description</th>
              <th scope="col" className="p-2">Quantity</th>
              <th scope="col" className="p-2">Unit</th>
              <th scope="col" className="p-2">Unit price</th>
              <th scope="col" className="p-2">Amount</th>
              <th scope="col" className="p-2">Source</th>
              {canWrite ? <th scope="col" className="p-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editingId === r.clin_id ? (
                <tr key={r.clin_id} className="border-b border-border align-top">
                  <td className="p-2">
                    <label className="sr-only" htmlFor={`clin-num-${r.clin_id}`}>Line item number</label>
                    <input
                      id={`clin-num-${r.clin_id}`}
                      className={field}
                      value={editDraft.clin_number}
                      onChange={(e) => setEditDraft({ ...editDraft, clin_number: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <label className="sr-only" htmlFor={`clin-desc-${r.clin_id}`}>Description</label>
                    <input
                      id={`clin-desc-${r.clin_id}`}
                      className={field}
                      value={editDraft.description}
                      onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <label className="sr-only" htmlFor={`clin-qty-${r.clin_id}`}>Quantity</label>
                    <input
                      id={`clin-qty-${r.clin_id}`}
                      className={field}
                      value={editDraft.quantity}
                      onChange={(e) => setEditDraft({ ...editDraft, quantity: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <label className="sr-only" htmlFor={`clin-unit-${r.clin_id}`}>Unit of issue</label>
                    <input
                      id={`clin-unit-${r.clin_id}`}
                      className={field}
                      value={editDraft.unit_of_issue}
                      onChange={(e) => setEditDraft({ ...editDraft, unit_of_issue: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <label className="sr-only" htmlFor={`clin-up-${r.clin_id}`}>Unit price</label>
                    <input
                      id={`clin-up-${r.clin_id}`}
                      className={field}
                      value={editDraft.unit_price}
                      onChange={(e) => setEditDraft({ ...editDraft, unit_price: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <label className="sr-only" htmlFor={`clin-amt-${r.clin_id}`}>Amount</label>
                    <input
                      id={`clin-amt-${r.clin_id}`}
                      className={field}
                      value={editDraft.extended_price}
                      onChange={(e) => setEditDraft({ ...editDraft, extended_price: e.target.value })}
                    />
                  </td>
                  <td className="p-2 text-muted-foreground">{sourceLabel(r.source)}</td>
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
                <tr key={r.clin_id} className="border-b border-border align-top">
                  <td className="p-2" data-numeric>{r.clin_number}</td>
                  <td className="p-2">
                    {r.description}
                    {r.source === "igce_estimate" ? (
                      <span className="block text-muted-foreground">Estimate-sourced (IGCE)</span>
                    ) : null}
                  </td>
                  <td className="p-2" data-numeric>
                    {r.quantity === null ? "Not recorded" : r.quantity.toLocaleString("en-US")}
                  </td>
                  <td className="p-2">{r.unit_of_issue?.trim() || "Not recorded"}</td>
                  <td className="p-2" data-numeric>{money(r.unit_price)}</td>
                  <td className="p-2" data-numeric>
                    {displayAmount(r).text}
                    {displayAmount(r).derived ? (
                      <span className="block text-muted-foreground">
                        Quantity times unit price
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2 text-muted-foreground">{sourceLabel(r.source)}</td>
                  {canWrite ? (
                    <td className="p-2">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.clin_id);
                            setEditDraft(draftFrom(r));
                          }}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove line item ${r.clin_number} from the schedule?`)) {
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

      {canWrite && adding ? (
        <div className="mt-3 grid grid-cols-1 gap-3 border border-border p-3 sm:grid-cols-3">
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-clin-number">
              Line item number
            </label>
            <input
              id="new-clin-number"
              className={field}
              value={draft.clin_number}
              onChange={(e) => setDraft({ ...draft, clin_number: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-clin-description">
              Description
            </label>
            <input
              id="new-clin-description"
              className={field}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-clin-quantity">
              Quantity (optional)
            </label>
            <input
              id="new-clin-quantity"
              className={field}
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-clin-unit">
              Unit of issue (optional)
            </label>
            <input
              id="new-clin-unit"
              className={field}
              value={draft.unit_of_issue}
              onChange={(e) => setDraft({ ...draft, unit_of_issue: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-clin-unit-price">
              Unit price (optional)
            </label>
            <input
              id="new-clin-unit-price"
              className={field}
              value={draft.unit_price}
              onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-clin-amount">
              Amount (optional)
            </label>
            <input
              id="new-clin-amount"
              className={field}
              value={draft.extended_price}
              onChange={(e) => setDraft({ ...draft, extended_price: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="button"
              disabled={!canAdd || add.isPending}
              onClick={() => add.mutate()}
              className="border border-border px-3 py-1 text-[13px] disabled:opacity-50"
            >
              Add the line item
            </button>
            <span className="ml-3 text-[13px] text-muted-foreground">
              Quantity, unit and price stay blank unless they are recorded.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
