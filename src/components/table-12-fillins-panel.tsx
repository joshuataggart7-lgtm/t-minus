// Tables 12-2 / 12-3 fill-in aid. Confirm records the officer's decision in
// the audit log; it never rewrites the clause list and never writes to NCMS.

import { TableScrollRegion } from "@/components/table-scroll-region";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { signedInName } from "@/lib/account-name";
import { supabase } from "@/integrations/supabase/client";
import type { PacketClause } from "@/lib/clause-packet";
import {
  TABLE12_BANNER,
  TABLE12_EMPTY,
  confirmFillinSummary,
  table12Fillins,
  type Table12Row,
} from "@/lib/table-12-fillins";

export function Table12FillinsPanel({
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

  const nfs = useQuery({
    queryKey: ["nfs-fill-in-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfs_clause_matrix")
        .select("clause_number,fill_in")
        .eq("fill_in", "X");
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((r) => String(r.clause_number ?? "").trim()).filter(Boolean));
    },
  });

  const rows = table12Fillins(facts, recommended, nfs.data);

  const confirm = useMutation({
    mutationFn: async (row: Table12Row) => {
      const who = await signedInName(actor);
      const { error } = await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: who,
        action: "Table 12 fill-ins confirmed",
        field: "table_12_fillins",
        old_value: null,
        new_value: row.clause_number,
        reason: confirmFillinSummary(row),
        phase,
      });
      if (error) throw error;
      return row.clause_number;
    },
    onSuccess: (n) => {
      setConfirmed((c) => (c.includes(n) ? c : [...c, n]));
      onBanner(`${n} fill-ins are recorded as confirmed. The clause list is unchanged.`);
    },
    onError: (e: Error) => onBanner(`The confirmation was not recorded: ${e.message}. Try again.`),
  });

  return (
    <section aria-label="Table 12-2 and 12-3 fill-ins" className="mt-4 border-t border-border pt-4">
      <h3 className="text-[15px] leading-[22px] font-medium">Tables 12-2 and 12-3 fill-ins</h3>
      <p className="mt-1 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">{TABLE12_BANNER}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{TABLE12_EMPTY}</p>
      ) : (
        <TableScrollRegion baseClassName="overflow-x-auto" label="Commercial fill-in slots table" className="mt-2">
<table className="w-full min-w-[720px] text-[13px] leading-[18px]">
            <caption className="sr-only">Commercial fill-in slots read from this record</caption>
            <thead>
              <tr className="border-y border-border text-left">
                <th scope="col" className="p-2">Clause</th>
                <th scope="col" className="p-2">Table</th>
                <th scope="col" className="p-2">Fill-in fields</th>
                <th scope="col" className="p-2">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.clause_number} className="border-b border-border align-top">
                  <td className="p-2">
                    {r.clause_number}
                    <div className="text-muted-foreground">{r.title}</div>
                  </td>
                  <td className="p-2">
                    {r.table}
                    <div className="text-muted-foreground">{r.note}</div>
                  </td>
                  <td className="p-2">
                    <ul className="space-y-1">
                      {r.slots.map((s) => (
                        <li key={s.label}>
                          {s.label}: {s.value}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-2">
                    {confirmed.includes(r.clause_number) ? (
                      "Confirmed"
                    ) : canWrite ? (
                      <button
                        type="button"
                        disabled={confirm.isPending}
                        onClick={() => confirm.mutate(r)}
                        className="text-primary disabled:opacity-60"
                      >
                        Confirm
                      </button>
                    ) : (
                      "Not confirmed"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
</TableScrollRegion>
      )}
    </section>
  );
}
