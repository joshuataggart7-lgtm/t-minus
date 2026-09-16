import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import { storedClauseList } from "@/lib/clause-impact";
import {
  RFO_RESERVED_212_NOTE,
  removedClauseNumbers,
  sanitizeClauseSelection,
  type ClauseRow,
  type PacketClause,
} from "@/lib/clause-packet";

/**
 * The clause picker. Recommended clauses come from the record through
 * selectPacketClauses; the officer chooses which of them go on the file. A
 * clause the matrices show as removed is never offered and never applied, and
 * FAR 52.212-5 is Reserved under the RFO, so it is never on this list.
 * Applying writes the clause numbers onto the record and logs the change.
 * NCMS stays the system of record; this is the local handoff packet.
 */
export function ClausePicker({
  acquisitionId,
  recommended,
  clauseRows,
  applied,
  actorName,
  phase,
  facts,
  onApplied,
}: {
  acquisitionId: string;
  recommended: PacketClause[];
  clauseRows: ClauseRow[];
  applied: string[] | null;
  actorName: string;
  phase: string;
  /** The record, so each clause can show the fill-ins this file already carries. */
  facts?: Record<string, unknown> | null;
  onApplied?: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo(
    () => (applied && applied.length > 0 ? applied : recommended.map((c) => c.clause_number)),
    [applied, recommended],
  );
  const [selected, setSelected] = useState<string[]>(initial);
  useEffect(() => setSelected(initial), [initial]);

  const removed = useMemo(() => removedClauseNumbers(clauseRows), [clauseRows]);
  const dirty = useMemo(
    () => JSON.stringify([...selected].sort()) !== JSON.stringify([...(applied ?? [])].sort()),
    [selected, applied],
  );

  const apply = useMutation({
    mutationFn: async () => {
      const clean = sanitizeClauseSelection(selected, recommended, clauseRows);
      const who = await signedInName(actorName);
      const { error: updateError } = await supabase
        .from("acquisition_facts")
        .update({ contract_clauses: clean, updated_at: new Date().toISOString() })
        .eq("acquisition_id", acquisitionId);
      if (updateError) throw updateError;
      await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: who,
        action: "Clause list applied to the file",
        field: "contract_clauses",
        old_value: (applied ?? []).join(", "),
        new_value: clean.join(", "),
        reason:
          "Clauses selected from the record and read from the PCD 26-03B and NFS 1852 matrices; removed clauses and FAR 52.212-5 excluded",
        phase,
      });
      return clean;
    },
    onSuccess: (clean) => {
      setError(null);
      setNote(
        `${clean.length} clauses are on the file and in the handoff packet. NCMS remains the system of record; the packet is a local file.`,
      );
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      onApplied?.();
    },
    onError: (e: Error) => {
      setNote(null);
      setError(`The clause list did not save: ${e.message}. Try again.`);
    },
  });

  function toggle(number: string) {
    setSelected((prev) => (prev.includes(number) ? prev.filter((n) => n !== number) : [...prev, number]));
  }

  return (
    <div className="mt-3 border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[15px] font-medium">Clauses on this file</h4>
        <span className="text-[13px] text-muted-foreground" data-numeric>
          {applied && applied.length > 0
            ? `${applied.length} on the file of ${recommended.length} recommended`
            : `${recommended.length} recommended, none put on the file yet`}
        </span>
        <span className="basis-full text-[13px] text-muted-foreground">
          {applied && applied.length > 0
            ? "On the file means the clause is recorded on this acquisition and carries into the handoff packet. The solicitation and contract of record are still written in NCMS."
            : "Choosing clauses records them on this acquisition and carries them into the handoff packet. The solicitation and contract of record are still written in NCMS."}
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[13px] text-primary underline-offset-2 hover:underline"
        >
          {open ? "Hide the clause picker" : "Choose clauses"}
        </button>
      </div>

      {open ? (
        <>
          <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
            Each clause below is recommended by this record. FAR 52.212-5 is Reserved under the RFO, so clauses
            that once sat inside it are prescribed on their own and shown here separately. Clauses the matrices
            show as removed are not offered and cannot be applied.
          </p>
          <table className="mt-3 w-full text-[13px] leading-[18px]">
            <caption className="sr-only">Recommended clauses, why each is included, and whether it is selected</caption>
            <thead>
              <tr className="border-y border-border text-left">
                <th scope="col" className="p-2">On the file</th>
                <th scope="col" className="p-2">Clause</th>
                <th scope="col" className="p-2">Title</th>
                <th scope="col" className="p-2">Why it is included</th>
                <th scope="col" className="p-2">Section and source</th>
                <th scope="col" className="p-2">Matrix status</th>
              </tr>
            </thead>
            <tbody>
              {recommended.map((c) => {
                const fillIns =
                  c.fill_ins && typeof c.fill_ins === "object" && Object.keys(c.fill_ins as object).length > 0
                    ? Object.entries(c.fill_ins as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join("; ")
                    : null;
                return (
                  <tr key={c.clause_number} className="border-b border-border align-top">
                    <td className="p-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.clause_number)}
                          onChange={() => toggle(c.clause_number)}
                          aria-label={`Include ${c.clause_number} on this file`}
                        />
                        <span className="sr-only">{c.clause_number}</span>
                      </label>
                    </td>
                    <td className="p-2" data-numeric>
                      {c.clause_number}
                      {c.formerly_bundled ? (
                        <span className="mt-1 block text-[13px] text-muted-foreground">
                          Prescribed on its own; 52.212-5 is Reserved
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2">{c.title}</td>
                    <td className="p-2">
                      {c.reason}
                      {fillIns ? (
                        <span className="mt-1 block text-muted-foreground">Fill-ins — {fillIns}</span>
                      ) : null}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {[c.ucf_section, c.source].filter(Boolean).join(" · ") || "Not recorded"}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {c.status}
                      {c.effective_date ? <span className="block">{c.effective_date}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {removed.length > 0 ? (
            <p className="mt-3 max-w-[80ch] text-[13px] text-muted-foreground">
              Removed under the RFO and not available: {removed.slice(0, 8).join(", ")}
              {removed.length > 8 ? ` and ${removed.length - 8} more` : ""}.
            </p>
          ) : null}

          <details className="mt-3 max-w-[80ch] text-[13px] text-muted-foreground">
            <summary className="cursor-pointer text-primary underline-offset-2 hover:underline">
              Why FAR 52.212-3 and 52.212-5 are not on the packet
            </summary>
            <p className="mt-2">{RFO_RESERVED_212_NOTE}</p>
          </details>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => apply.mutate()}
              disabled={apply.isPending || !dirty}
              className="rounded-[8px] bg-primary px-3 py-2 text-[15px] text-primary-foreground disabled:opacity-50"
            >
              {apply.isPending ? "Applying" : "Apply to file"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(recommended.map((c) => c.clause_number))}
              className="text-[13px] text-primary underline-offset-2 hover:underline"
            >
              Select every recommended clause
            </button>
          </div>
        </>
      ) : null}

      {note ? <p className="mt-3 max-w-[80ch] text-[13px]">{note}</p> : null}
      {error ? (
        <p className="mt-3 max-w-[80ch] text-[13px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

/** The clause numbers already written onto a record, if any. */
export function appliedClauses(value: unknown): string[] | null {
  return storedClauseList(value);
}
