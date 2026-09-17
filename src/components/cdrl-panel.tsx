// CDRL / data requirements on a file. Optional and empty unless the contracting
// office records something: no deliverables are invented and no DRD text is
// written for the officer. The handoff packet carries the same rows.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { signedInName } from "@/lib/account-name";
import {
  CDRL_EMPTY,
  CDRL_LABEL,
  cdrlForPacket,
  cdrlMethodNote,
  cdrlPackNotes,
  cdrlText,
  createCdrl,
  deleteCdrl,
  loadCdrl,
  updateCdrl,
  type CdrlInput,
  type CdrlRow,
} from "@/lib/cdrl";

type Draft = {
  item_number: string;
  title: string;
  frequency: string;
  as_of: string;
  distribution: string;
  drd_ref: string;
  notes: string;
};

const emptyDraft: Draft = {
  item_number: "",
  title: "",
  frequency: "",
  as_of: "",
  distribution: "",
  drd_ref: "",
  notes: "",
};

const draftFrom = (r: CdrlRow): Draft => ({
  item_number: r.item_number,
  title: r.title,
  frequency: r.frequency ?? "",
  as_of: r.as_of ?? "",
  distribution: r.distribution ?? "",
  drd_ref: r.drd_ref ?? "",
  notes: r.notes ?? "",
});

const toInput = (d: Draft): CdrlInput => ({
  item_number: d.item_number,
  title: d.title,
  frequency: d.frequency,
  as_of: d.as_of,
  distribution: d.distribution,
  drd_ref: d.drd_ref,
  notes: d.notes,
});

const field =
  "w-full border border-border bg-background px-2 py-1 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CdrlPanel({
  acquisitionId,
  canWrite,
  actor,
  onBanner,
  facts,
}: {
  acquisitionId: string;
  canWrite: boolean;
  actor: string;
  onBanner: (s: string) => void;
  /** The record, read only for the muted method-aware line. */
  facts?: Record<string, unknown> | null;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);

  const q = useQuery({
    queryKey: ["cdrl", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadCdrl(acquisitionId),
  });
  const rows = q.data ?? [];
  // Advisory only: these notes never hold a phase or block an exit.
  const packNotes = cdrlPackNotes(cdrlForPacket(rows));
  const methodNote = cdrlMethodNote(facts ?? null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["cdrl", acquisitionId] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const name = await signedInName(actor);
      await createCdrl(acquisitionId, toInput(draft), name, rows.length);
    },
    onSuccess: () => {
      onBanner("The data requirement was added to this file.");
      setAdding(false);
      setDraft(emptyDraft);
      invalidate();
    },
    onError: (e: Error) => onBanner(`The data requirement was not added: ${e.message}. Try again.`),
  });

  const save = useMutation({
    mutationFn: async (row: CdrlRow) => {
      const name = await signedInName(actor);
      await updateCdrl(row, toInput(editDraft), name);
    },
    onSuccess: () => {
      onBanner("The data requirement was saved.");
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => onBanner(`The data requirement was not saved: ${e.message}. Try again.`),
  });

  const remove = useMutation({
    mutationFn: async (row: CdrlRow) => {
      const name = await signedInName(actor);
      await deleteCdrl(row, name);
    },
    onSuccess: () => {
      onBanner("The data requirement was removed from this file.");
      invalidate();
    },
    onError: (e: Error) =>
      onBanner(`The data requirement was not removed: ${e.message}. Try again.`),
  });

  const canAdd = draft.item_number.trim().length > 0 && draft.title.trim().length > 0;

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
        <h4 className="text-[15px] font-medium">{CDRL_LABEL}</h4>
        <span className="text-[13px] text-muted-foreground">
          Optional, and listed beside the document attachments rather than among them. Blanks print
          "Not recorded" and no Word sidecar is needed.
        </span>
        {canWrite ? (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="ml-auto text-[13px] text-primary underline-offset-2 hover:underline"
          >
            {adding ? "Cancel" : "Add a data requirement"}
          </button>
        ) : null}
      </div>

      {methodNote ? (
        <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">{methodNote}</p>
      ) : null}

      {packNotes.length > 0 ? (
        <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
          {packNotes.map((n) => (
            <span key={n} className="block">
              {n}
            </span>
          ))}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
          {CDRL_EMPTY} The contracting office records an item when the requirement calls for one.
        </p>
      ) : (
        <table className="mt-3 w-full text-[13px] leading-[18px]">
          <caption className="sr-only">Data requirements recorded on this file</caption>
          <thead>
            <tr className="border-y border-border text-left">
              <th scope="col" className="p-2">Item</th>
              <th scope="col" className="p-2">Title</th>
              <th scope="col" className="p-2">Frequency</th>
              <th scope="col" className="p-2">As of</th>
              <th scope="col" className="p-2">Distribution</th>
              <th scope="col" className="p-2">DRD reference</th>
              {canWrite ? <th scope="col" className="p-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editingId === r.cdrl_id ? (
                <tr key={r.cdrl_id} className="border-b border-border align-top">
                  {cell("Item number", `cdrl-item-${r.cdrl_id}`, "item_number", editDraft, setEditDraft)}
                  {cell("Title", `cdrl-title-${r.cdrl_id}`, "title", editDraft, setEditDraft)}
                  {cell("Frequency", `cdrl-freq-${r.cdrl_id}`, "frequency", editDraft, setEditDraft)}
                  {cell("As of", `cdrl-asof-${r.cdrl_id}`, "as_of", editDraft, setEditDraft)}
                  {cell("Distribution", `cdrl-dist-${r.cdrl_id}`, "distribution", editDraft, setEditDraft)}
                  {cell("DRD reference", `cdrl-drd-${r.cdrl_id}`, "drd_ref", editDraft, setEditDraft)}
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
                <tr key={r.cdrl_id} className="border-b border-border align-top">
                  <td className="p-2" data-numeric>{r.item_number}</td>
                  <td className="p-2">
                    {r.title}
                    {r.notes?.trim() ? (
                      <span className="block text-muted-foreground">{r.notes.trim()}</span>
                    ) : null}
                  </td>
                  <td className="p-2">{cdrlText(r.frequency)}</td>
                  <td className="p-2">{cdrlText(r.as_of)}</td>
                  <td className="p-2">{cdrlText(r.distribution)}</td>
                  <td className="p-2">{cdrlText(r.drd_ref)}</td>
                  {canWrite ? (
                    <td className="p-2">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.cdrl_id);
                            setEditDraft(draftFrom(r));
                          }}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove data requirement ${r.item_number}?`)) {
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
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-cdrl-item">
              Item number
            </label>
            <input
              id="new-cdrl-item"
              className={field}
              value={draft.item_number}
              onChange={(e) => setDraft({ ...draft, item_number: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-cdrl-title">
              Title
            </label>
            <input
              id="new-cdrl-title"
              className={field}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-cdrl-frequency">
              Frequency (optional)
            </label>
            <input
              id="new-cdrl-frequency"
              className={field}
              value={draft.frequency}
              onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-cdrl-asof">
              As of (optional)
            </label>
            <input
              id="new-cdrl-asof"
              className={field}
              value={draft.as_of}
              onChange={(e) => setDraft({ ...draft, as_of: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-cdrl-distribution">
              Distribution (optional)
            </label>
            <input
              id="new-cdrl-distribution"
              className={field}
              value={draft.distribution}
              onChange={(e) => setDraft({ ...draft, distribution: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-cdrl-drd">
              DRD reference (optional)
            </label>
            <input
              id="new-cdrl-drd"
              className={field}
              value={draft.drd_ref}
              onChange={(e) => setDraft({ ...draft, drd_ref: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[13px] text-muted-foreground" htmlFor="new-cdrl-notes">
              Note (optional)
            </label>
            <input
              id="new-cdrl-notes"
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
              Add the data requirement
            </button>
            <span className="ml-3 text-[13px] text-muted-foreground">
              Blank fields print "Not recorded".
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
