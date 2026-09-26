// Quiet SOW -> clause assist. Suggestions come from the same matrix-backed
// recommendation the packet uses; confirming records the officer's decision in
// the audit log and does not change the clause list. The clause picker stays
// the only place clauses are applied.

import { TableScrollRegion } from "@/components/table-scroll-region";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { signedInName } from "@/lib/account-name";
import { supabase } from "@/integrations/supabase/client";
import type { PacketClause } from "@/lib/clause-packet";
import {
  SOW_ASSIST_BANNER,
  SOW_ASSIST_EMPTY,
  assistSourceLine,
  sowClauseAssist,
  type AssistSuggestion,
} from "@/lib/sow-clause-assist";

export function SowClauseAssistPanel({
  acquisitionId,
  facts,
  recommended,
  canWrite,
  actor,
  phase,
  onBanner,
}: {
  acquisitionId: string;
  facts: Record<string, unknown> | null;
  recommended: readonly PacketClause[];
  canWrite: boolean;
  actor: string;
  phase: string;
  onBanner: (s: string) => void;
}) {
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const suggestions: AssistSuggestion[] = facts ? sowClauseAssist(facts, recommended) : [];

  const confirm = useMutation({
    mutationFn: async (s: AssistSuggestion) => {
      const who = await signedInName(actor);
      const { error } = await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: who,
        action: "Clause suggestion confirmed by the contracting officer",
        field: "sow_clause_assist",
        old_value: null,
        new_value: s.clause_number,
        reason: `${s.cue} ${s.reason}`,
        phase,
      });
      if (error) throw error;
      return s.clause_number;
    },
    onSuccess: (n) => {
      setConfirmed((c) => (c.includes(n) ? c : [...c, n]));
      onBanner(`${n} is recorded as confirmed. Apply it in the clause list when you are ready.`);
    },
    onError: (e: Error) => onBanner(`The confirmation was not recorded: ${e.message}. Try again.`),
  });

  return (
    <div className="mt-3 border border-border bg-muted/20 p-4">
      <h4 className="text-[15px] font-medium">Clause assist from the requirement</h4>
      <p className="mt-1 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">{SOW_ASSIST_BANNER}</p>
      {facts ? (
        <p className="mt-1 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">
          {assistSourceLine(facts)}
        </p>
      ) : null}
      {suggestions.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{SOW_ASSIST_EMPTY}</p>
      ) : (
        <TableScrollRegion baseClassName="overflow-x-auto" label="SOW clause assist table">
<table className="mt-3 w-full text-[13px] leading-[18px]">
          <caption className="sr-only">Clauses suggested from the requirement on the record</caption>
          <thead>
            <tr className="border-y border-border text-left">
              <th scope="col" className="p-2">Clause</th>
              <th scope="col" className="p-2">Why it is suggested</th>
              <th scope="col" className="p-2">Decision</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.clause_number} className="border-b border-border align-top">
                <td className="p-2" data-numeric>
                  {s.clause_number}
                  <span className="block text-muted-foreground">{s.title}</span>
                </td>
                <td className="p-2">
                  {s.cue} <span className="text-muted-foreground">{s.reason}</span>
                </td>
                <td className="p-2">
                  {confirmed.includes(s.clause_number) ? (
                    <span className="text-muted-foreground">Confirmed by the contracting officer</span>
                  ) : canWrite ? (
                    <button
                      type="button"
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(s)}
                      className="border border-border px-3 py-1 text-[13px] disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  ) : (
                    <span className="text-muted-foreground">Read only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</TableScrollRegion>
      )}
      <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
        Confirming records the decision on the file. Clauses are applied in the clause list above.
      </p>
    </div>
  );
}
