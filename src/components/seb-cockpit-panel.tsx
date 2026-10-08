// SEB cockpit — advisory depth beside Sections K, L and M.
//
// Three calm, soft features: an L↔M consistency lamp, a clarifications
// fairness ledger, and an evidence map across the evaluation factors. Nothing
// here holds a file: no phase exit, hold, clock or required document reads
// from any of it. Nothing is seeded and no traffic is invented.

import { TableScrollRegion } from "@/components/table-scroll-region";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StatusChip } from "@/components/ui-mc";
import { signedInName } from "@/lib/account-name";
import { boardReadiness, boardReadinessItems } from "@/lib/board-readiness";
import {
  CLARIFICATIONS_CHIP,
  clarificationText,
  createClarification,
  deleteClarification,
  loadClarifications,
  updateClarification,
  type ClarificationRow,
} from "@/lib/clarifications";
import { LM_LAMP_LABEL, LM_LAMP_OK } from "@/lib/lm-consistency";
import { loadReadReceiptCount, READ_RECEIPTS_CHIP } from "@/lib/read-receipts";

import {
  FACTOR_EVIDENCE_ADVISORY,
  factorHasEvidence,
  loadFactors,
  loadSectionL,
  loadSectionM,
  saveFactorEvidence,
  type FactorRow,
  type MethodShell,
} from "@/lib/solicitation-lm";

const field =
  "w-full rounded-md border border-border bg-background px-2 py-1 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ClarificationDraft = { sent_on: string; topic: string; recipients: string; notes: string };
const emptyClarification: ClarificationDraft = { sent_on: "", topic: "", recipients: "", notes: "" };

export function SebCockpitPanel({
  acquisitionId,
  shell,
  canWrite,
  actor,
  onBanner,
  regionContext,
}: {
  acquisitionId: string;
  shell: MethodShell | null;
  canWrite: boolean;
  actor: string;
  onBanner: (s: string) => void;
  regionContext?: string;
}) {
  const qc = useQueryClient();
  const lQ = useQuery({
    queryKey: ["section-l", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadSectionL(acquisitionId),
  });
  const mQ = useQuery({
    queryKey: ["section-m", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadSectionM(acquisitionId),
  });
  const factorsQ = useQuery({
    queryKey: ["section-m-factors", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadFactors(acquisitionId),
  });
  const clarQ = useQuery({
    queryKey: ["clarifications", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadClarifications(acquisitionId),
  });
  // Receipts are only counted, never invented: a failed read leaves the line off.
  const receiptCountQ = useQuery({
    queryKey: ["read-receipt-count", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadReadReceiptCount(acquisitionId),
  });


  const [draft, setDraft] = useState<ClarificationDraft>(emptyClarification);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ClarificationDraft>(emptyClarification);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [evidenceDraft, setEvidenceDraft] = useState("");

  const factors = factorsQ.data ?? [];
  const clarifications = clarQ.data ?? [];

  const readiness = boardReadiness({
    shell,
    l: lQ.data ?? null,
    m: mQ.data ?? null,
    factors,
    clarificationCount: clarifications.length,
    receiptCount: receiptCountQ.data ?? null,
  });

  const lamp = readiness.lamp;

  const addClarification = useMutation({
    mutationFn: async () => {
      const name = await signedInName(actor);
      await createClarification(
        acquisitionId,
        {
          sent_on: draft.sent_on.trim() || null,
          topic: draft.topic,
          recipients: draft.recipients.trim() || null,
          notes: draft.notes.trim() || null,
        },
        name,
      );
    },
    onSuccess: () => {
      onBanner("The clarification was recorded on the ledger.");
      setAdding(false);
      setDraft(emptyClarification);
      void qc.invalidateQueries({ queryKey: ["clarifications", acquisitionId] });
    },
    onError: (e: Error) => onBanner(`The clarification was not recorded: ${e.message}. Try again.`),
  });

  const editClarification = useMutation({
    mutationFn: async (row: ClarificationRow) => {
      const name = await signedInName(actor);
      await updateClarification(
        row,
        {
          sent_on: editDraft.sent_on.trim() || null,
          topic: editDraft.topic,
          recipients: editDraft.recipients.trim() || null,
          notes: editDraft.notes.trim() || null,
        },
        name,
      );
    },
    onSuccess: () => {
      onBanner("The clarification was saved.");
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ["clarifications", acquisitionId] });
    },
    onError: (e: Error) => onBanner(`The clarification was not saved: ${e.message}. Try again.`),
  });

  const removeClarification = useMutation({
    mutationFn: async (row: ClarificationRow) => {
      const name = await signedInName(actor);
      await deleteClarification(row, name);
    },
    onSuccess: () => {
      onBanner("The clarification was removed from the ledger.");
      void qc.invalidateQueries({ queryKey: ["clarifications", acquisitionId] });
    },
    onError: (e: Error) => onBanner(`The clarification was not removed: ${e.message}. Try again.`),
  });

  const saveEvidence = useMutation({
    mutationFn: async (row: FactorRow) => {
      const name = await signedInName(actor);
      await saveFactorEvidence(row, evidenceDraft, name);
    },
    onSuccess: () => {
      onBanner("The evidence note was saved.");
      setEvidenceId(null);
      void qc.invalidateQueries({ queryKey: ["section-m-factors", acquisitionId] });
    },
    onError: (e: Error) => onBanner(`The evidence note was not saved: ${e.message}. Try again.`),
  });

  if (!shell) return null;

  const readinessItems = boardReadinessItems(readiness);

  return (
    <div className="mc-kpanel mc-seb mt-3">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
          <h4 className="mc-kpanel-title">Evaluation cockpit</h4>
          <p className="mc-req-meta">
            Advisory and soft. Nothing on this panel holds a phase exit, a hold or a required document.
          </p>
        </div>
        <StatusChip label="Advisory" tone="info" />
      </div>

      <div className="mc-kpanel-grid is-2 mt-4">

      {/* Board brief — one scannable strip, counts only, never a gate. */}
      <section className="mc-seb-card break-inside-avoid" aria-label="Board brief">
        <div className="mc-seb-card-head">
          <h5 className="mc-req-h">Board brief</h5>
          <StatusChip label={readiness.methodLabel} tone="neutral" />
        </div>
        <p className="mc-req-meta mt-1">
          {readiness.methodVoice}
        </p>
        <dl className="mc-details-list mt-3">
          {readinessItems.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd className="font-medium" data-numeric>{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mc-req-meta mt-3">
          A brief only. Every count is advisory; nothing here gates the board, the file or a phase
          exit. The detail behind each line sits below.
        </p>
      </section>

      {/* 1: L to M consistency lamp. */}
      <section className="mc-seb-card" aria-label="L and M consistency">
        <div className="mc-seb-card-head">
          <h5 className="mc-req-h">L↔M consistency</h5>
          <StatusChip label={lamp.status === "ok" ? "Consistent" : "Advisory"} tone={lamp.status === "ok" ? "ontrack" : "attention"} />
        </div>
        {lamp.findings.length === 0 ? (
          <p className="mc-req-text mt-2">{LM_LAMP_OK}</p>
        ) : (
          <ul className="mc-req-text mt-2 list-disc pl-5">
            {lamp.findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <p className="mc-req-meta mt-3">{LM_LAMP_LABEL}</p>
      </section>
      </div>

      {/* 2: clarifications fairness ledger. */}
      <section className="mc-kpanel-section mc-seb-section">
        <div className="mc-seb-card-head">
          <h5 className="mc-req-h">Clarifications ledger</h5>
          {canWrite ? (
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="ml-auto text-[14px] font-medium text-primary underline-offset-2 hover:underline"
            >
              {adding ? "Cancel" : "Record a clarification"}
            </button>
          ) : null}
        </div>
        <p className="mc-req-meta mt-1">{CLARIFICATIONS_CHIP}</p>
        {clarifications.length === 0 ? (
          <p className="mc-dt-empty mt-2">
            None recorded. The fairness ledger stays empty until the office adds one.
          </p>
        ) : (
          <TableScrollRegion baseClassName="mc-dt-wrap mt-2" className="stack" label={regionContext ? `Clarification log table, ${regionContext}` : "Clarification log table"}>
<table className="mc-dt stack">
            <caption className="sr-only">Clarifications recorded on this file</caption>
            <thead>
              <tr>
                <th scope="col" className="is-nowrap">Sent</th>
                <th scope="col">Topic</th>
                <th scope="col">Recipients</th>
                <th scope="col">Notes</th>
                {canWrite ? <th scope="col">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {clarifications.map((row) => (
                <tr key={row.clarification_id}>
                  <td data-label="Sent" className="is-nowrap" data-numeric>{clarificationText(row.sent_on)}</td>
                  <td data-label="Topic">{row.topic}</td>
                  <td data-label="Recipients">{clarificationText(row.recipients)}</td>
                  <td data-label="Notes" className="text-muted-foreground">{clarificationText(row.notes)}</td>
                  {canWrite ? (
                    <td data-label="Actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(editingId === row.clarification_id ? null : row.clarification_id);
                          setEditDraft({
                            sent_on: row.sent_on ?? "",
                            topic: row.topic,
                            recipients: row.recipients ?? "",
                            notes: row.notes ?? "",
                          });
                        }}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {editingId === row.clarification_id ? "Cancel" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove the clarification “${row.topic}”?`)) {
                            removeClarification.mutate(row);
                          }
                        }}
                        className="ml-3 text-destructive underline-offset-2 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {canWrite && editingId
                ? clarifications
                    .filter((r) => r.clarification_id === editingId)
                    .map((row) => (
                      <tr key={`edit-${row.clarification_id}`}>
                        <td data-label="Sent">
                          <label className="sr-only" htmlFor="clar-edit-date">Date sent</label>
                          <input
                            id="clar-edit-date"
                            type="date"
                            className={field}
                            value={editDraft.sent_on}
                            onChange={(e) => setEditDraft({ ...editDraft, sent_on: e.target.value })}
                          />
                        </td>
                        <td data-label="Topic">
                          <label className="sr-only" htmlFor="clar-edit-topic">Topic</label>
                          <input
                            id="clar-edit-topic"
                            className={field}
                            value={editDraft.topic}
                            onChange={(e) => setEditDraft({ ...editDraft, topic: e.target.value })}
                          />
                        </td>
                        <td data-label="Recipients">
                          <label className="sr-only" htmlFor="clar-edit-recipients">Recipients</label>
                          <input
                            id="clar-edit-recipients"
                            className={field}
                            value={editDraft.recipients}
                            onChange={(e) => setEditDraft({ ...editDraft, recipients: e.target.value })}
                          />
                        </td>
                        <td data-label="Notes">
                          <label className="sr-only" htmlFor="clar-edit-notes">Notes</label>
                          <input
                            id="clar-edit-notes"
                            className={field}
                            value={editDraft.notes}
                            onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                          />
                        </td>
                        <td data-label="Actions">
                          <button
                            type="button"
                            disabled={!editDraft.topic.trim() || editClarification.isPending}
                            onClick={() => editClarification.mutate(row)}
                            className="rounded-md border border-border px-3 py-1 text-[14px] font-medium disabled:opacity-50"
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))
                : null}
            </tbody>
          </table>
</TableScrollRegion>
        )}
        {canWrite && adding ? (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <div>
              <label className="block text-[13px] text-muted-foreground" htmlFor="clar-date">
                Date sent
              </label>
              <input
                id="clar-date"
                type="date"
                className={field}
                value={draft.sent_on}
                onChange={(e) => setDraft({ ...draft, sent_on: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[13px] text-muted-foreground" htmlFor="clar-topic">
                Topic
              </label>
              <input
                id="clar-topic"
                className={field}
                value={draft.topic}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[13px] text-muted-foreground" htmlFor="clar-recipients">
                Recipients
              </label>
              <input
                id="clar-recipients"
                className={field}
                value={draft.recipients}
                onChange={(e) => setDraft({ ...draft, recipients: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[13px] text-muted-foreground" htmlFor="clar-notes">
                Notes (optional)
              </label>
              <input
                id="clar-notes"
                className={field}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={!draft.topic.trim() || addClarification.isPending}
                onClick={() => addClarification.mutate()}
                className="rounded-md border border-border px-3 py-1 text-[14px] font-medium disabled:opacity-50"
              >
                Record the clarification
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* 3: evaluation factor to evidence map. */}
      <section className="mc-kpanel-section mc-seb-section">
        <h5 className="mc-req-h">Evidence map</h5>
        {!shell.competitive ? (
          <p className="mc-req-text mt-1 max-w-[80ch]">
            This file is sole-source on the record, so competitive factors are not the path. The
            technical evaluation of the single proposal carries the finding.
          </p>
        ) : factors.length === 0 ? (
          <p className="mc-dt-empty mt-2">
            No factors recorded. There is no evaluation evidence to map yet.
          </p>
        ) : (
          <ul className="mc-seb-factors mt-2">
            {factors.map((f) => {
              const has = factorHasEvidence(f);
              return (
                <li key={f.factor_id} className={has ? "is-noted" : "is-open"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.name}</span>
                    <StatusChip label={has ? "Evidence noted" : "No evidence noted"} tone={has ? "ontrack" : "attention"} />
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEvidenceId(evidenceId === f.factor_id ? null : f.factor_id);
                          setEvidenceDraft(f.evidence_note ?? "");
                        }}
                        className="ml-auto text-primary underline-offset-2 hover:underline"
                      >
                        {evidenceId === f.factor_id ? "Cancel" : "Link evidence"}
                      </button>
                    ) : null}
                  </div>
                  {has ? (
                    <p className="mt-1 text-muted-foreground">{f.evidence_note}</p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">{FACTOR_EVIDENCE_ADVISORY}</p>
                  )}
                  {canWrite && evidenceId === f.factor_id ? (
                    <div className="mt-2">
                      <label className="block text-muted-foreground" htmlFor={`ev-${f.factor_id}`}>
                        Where the evidence sits (officer-entered)
                      </label>
                      <textarea
                        id={`ev-${f.factor_id}`}
                        rows={2}
                        className={field}
                        value={evidenceDraft}
                        onChange={(e) => setEvidenceDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={saveEvidence.isPending}
                        onClick={() => saveEvidence.mutate(f)}
                        className="mt-2 rounded-md border border-border px-3 py-1 text-[14px] font-medium disabled:opacity-50"
                      >
                        Save the evidence note
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mc-req-meta mt-2">
          The evidence map is advisory and does not hold the file, a phase or a document.
        </p>
      </section>

      {/* 4: pointer to the read receipts that sit directly below on the Board path. */}
      <section className="mc-kpanel-section mc-seb-section">
        <h5 className="mc-req-h">Read receipts</h5>
        <p className="mc-req-meta mt-1 max-w-[80ch]">
          {receiptCountQ.isError
            ? "Receipt counts are omitted when the record cannot be read. The receipts panel below remains the source of truth."
            : receiptCountQ.data !== undefined && receiptCountQ.data > 0
            ? `${receiptCountQ.data} recorded. Who opened what is listed in the read receipts just below.`
            : "None yet. Opens are listed in the read receipts just below as people read documents on this file."}{" "}
          {READ_RECEIPTS_CHIP}
        </p>
      </section>

    </div>
  );
}
