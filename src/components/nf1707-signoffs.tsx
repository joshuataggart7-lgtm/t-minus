import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { answersFromStored } from "@/components/nf1707-intake";
import {
  applicableBlocks,
  reviewerTitle,
  SIGNOFF_STATUS_LABEL,
  UNMAPPED_BLOCKS,
  type SignoffBlock,
  type SignoffStatus,
} from "@/lib/nf1707-signoffs";

type ApprovalRow = {
  approval_id: string;
  form_section: string;
  form_field_name: string;
  approval_role: string;
  owner_name: string | null;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  note: string | null;
};

type RoutingRow = { center_code: string; document_key: string; approving_official_title: string };

const STATUSES: SignoffStatus[] = ["not_sent", "sent", "concurred", "non_concurred"];

export function Nf1707Signoffs({
  acquisitionId,
  centerCode,
  storedAnswers,
  rows,
  routing,
  canWrite,
  actor,
  onBanner,
  onChanged,
}: {
  acquisitionId: string;
  centerCode: string | null;
  storedAnswers: Record<string, unknown>;
  rows: ApprovalRow[];
  routing: RoutingRow[];
  canWrite: boolean;
  actor: string;
  onBanner: (message: string | null) => void;
  onChanged: () => Promise<void> | void;
}) {
  const answers = useMemo(() => answersFromStored(storedAnswers ?? {}), [storedAnswers]);
  const blocks = useMemo(() => applicableBlocks(answers, centerCode), [answers, centerCode]);
  const rowFor = (block: SignoffBlock) =>
    rows.find((r) => r.form_field_name === (block.sigField || block.blockName)) ?? null;

  const save = async (block: SignoffBlock, patch: Partial<ApprovalRow>, action: string) => {
    const existing = rowFor(block);
    const base = {
      acquisition_id: acquisitionId,
      form_section: block.formSection,
      form_field_name: block.sigField || block.blockName,
      approval_role: reviewerTitle(block, routing, centerCode),
    };
    const next = { ...base, status: existing?.status ?? "not_sent", owner_name: existing?.owner_name ?? null, note: existing?.note ?? null, ...patch };
    const { error } = await supabase
      .from("nf1707_approvals")
      .upsert(next, { onConflict: "acquisition_id,form_section,form_field_name" });
    if (error) {
      onBanner(`The sign-off did not save: ${error.message}`);
      return;
    }
    await supabase.from("audit_log").insert({
      acquisition_id: acquisitionId,
      actor,
      action,
      field: block.blockName,
      old_value: existing?.status ?? "not_sent",
      new_value: String(next.status ?? ""),
      reason: next.note ?? null,
      phase: "Intake",
    });
    onBanner(null);
    await onChanged();
  };

  const blocked = rows.filter((r) => r.status === "non_concurred");

  return (
    <section aria-labelledby="nf1707-approvals" className="mb-12 max-w-[80ch] border-t border-border pt-5">
      <h2 id="nf1707-approvals" className="text-[18px] font-medium leading-6">NF 1707 sign-offs</h2>
      <p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
        One row for each signature or concurrence block the form prints, shown only when the record makes that review
        apply. A concurrence writes the name, title and date onto the exported form and leaves the signature line blank.
      </p>

      {blocked.length ? (
        <div className="mt-4 border-l-4 border-[#C8321E] bg-background p-3">
          <p className="text-[15px] font-medium">Non-concurrence. This phase is blocked.</p>
          <ul className="mt-1 space-y-1 text-[13px]">
            {blocked.map((r) => (
              <li key={r.approval_id}>{r.approval_role}: {r.note ?? "No comment recorded."}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <table className="mt-4 w-full border border-border text-[13px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-2">Block</th>
            <th className="p-2">Reviewer title</th>
            <th className="p-2">Assigned person</th>
            <th className="p-2">Status</th>
            <th className="p-2">Date</th>
            <th className="p-2">Section</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <SignoffRow
              key={block.sigField || block.blockName}
              block={block}
              row={rowFor(block)}
              title={reviewerTitle(block, routing, centerCode)}
              canWrite={canWrite}
              save={save}
            />
          ))}
          {blocks.length === 0 ? (
            <tr><td className="p-2 text-muted-foreground" colSpan={6}>No sign-off on the form applies to this record yet.</td></tr>
          ) : null}
        </tbody>
      </table>

      <details className="mt-4 text-[13px]">
        <summary className="cursor-pointer">Blocks on the form with no stated trigger ({UNMAPPED_BLOCKS.length})</summary>
        <p className="mt-2 max-w-[70ch] text-muted-foreground">
          These blocks are printed on the form, but neither the form nor a cited regulation says which answer triggers
          them, so they are not routed. Tell us which section triggers each one and they will be added.
        </p>
        <ul className="mt-2 space-y-1">
          {UNMAPPED_BLOCKS.map((b) => (
            <li key={b.blockName}>{b.blockName} · {b.formSection}{b.center ? ` · ${b.center} only` : ""}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function SignoffRow({
  block,
  row,
  title,
  canWrite,
  save,
}: {
  block: SignoffBlock;
  row: ApprovalRow | null;
  title: string;
  canWrite: boolean;
  save: (block: SignoffBlock, patch: Partial<ApprovalRow>, action: string) => Promise<void>;
}) {
  const [person, setPerson] = useState(row?.owner_name ?? "");
  const [comment, setComment] = useState(row?.note ?? "");
  const status = (row?.status ?? "not_sent") as SignoffStatus;
  const date = row?.completed_at?.slice(0, 10) ?? row?.due_date ?? "—";

  return (
    <tr className="border-b border-border align-top">
      <td className="p-2">
        {block.blockName}
        <span className="block text-muted-foreground">{block.formSection} · {block.citation}</span>
      </td>
      <td className="p-2">{title}</td>
      <td className="p-2">
        {canWrite ? (
          <input
            aria-label={`Assigned person for ${block.blockName}`}
            className="w-40 rounded-lg border border-border bg-background px-2 py-1"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            onBlur={() => { if (person !== (row?.owner_name ?? "")) void save(block, { owner_name: person || null }, "NF 1707 sign-off assigned"); }}
          />
        ) : (person || "Not assigned")}
      </td>
      <td className="p-2">
        {canWrite ? (
          <>
            <label className="sr-only" htmlFor={`status-${block.blockName}`}>Status for {block.blockName}</label>
            <select
              id={`status-${block.blockName}`}
              className="rounded-lg border border-border bg-background px-2 py-1"
              value={status}
              onChange={(e) => {
                const next = e.target.value as SignoffStatus;
                if (next === "non_concurred") { void save(block, { status: next, note: comment || null, completed_at: null }, "NF 1707 non-concurrence recorded"); return; }
                void save(
                  block,
                  { status: next, note: null, completed_at: next === "concurred" ? new Date().toISOString() : null, owner_name: person || row?.owner_name || null },
                  next === "concurred" ? "NF 1707 sign-off concurred" : "NF 1707 sign-off status changed",
                );
              }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{SIGNOFF_STATUS_LABEL[s]}</option>)}
            </select>
            {status === "non_concurred" ? (
              <div className="mt-2">
                <label className="sr-only" htmlFor={`comment-${block.blockName}`}>Non-concurrence comment for {block.blockName}</label>
                <textarea
                  id={`comment-${block.blockName}`}
                  className="w-56 rounded-lg border border-border bg-background px-2 py-1"
                  rows={2}
                  placeholder="Why this review did not concur"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button
                  type="button"
                  variant="link"
                  className="ml-1 h-auto p-0"
                  disabled={!comment.trim()}
                  onClick={() => void save(block, { status: "non_concurred", note: comment.trim() }, "NF 1707 non-concurrence comment saved")}
                >
                  Save comment
                </Button>
              </div>
            ) : null}
          </>
        ) : SIGNOFF_STATUS_LABEL[status]}
      </td>
      <td className="p-2" data-numeric>{date}</td>
      <td className="p-2">
        <Link to="/intake" hash={`nf-section-${block.sectionKey}`} className="underline">
          {block.sectionTitle}
        </Link>
      </td>
    </tr>
  );
}
