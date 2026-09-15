// The scenario trigger table: the condition on a record, the document row it
// switches on, the citation that requires it, the phase it appears in, and
// whether it is Required or Offered. HQ and administrators edit it here.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setTriggerConfig, type TriggerConfigRow } from "@/lib/scenario";

type Row = TriggerConfigRow & { config_id: string; condition_label: string; sort_order: number };

export function TriggerTableEditor({ mayEdit, actor }: { mayEdit: boolean; actor: string }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["scenario-trigger-config-table"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenario_trigger_config")
        .select("config_id,trigger_key,doc_key,condition_label,label,citation,phase,state,enabled,note,sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Row[];
      setTriggerConfig(rows);
      return rows;
    },
  });

  const save = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("scenario_trigger_config")
        .update({
          state: row.state,
          enabled: row.enabled,
          citation: row.citation,
          phase: row.phase,
          updated_by: actor,
        })
        .eq("config_id", row.config_id);
      if (error) throw new Error(error.message);
      return row;
    },
    onSuccess: (row) => {
      setMessage(`${row.label} saved.`);
      void qc.invalidateQueries({ queryKey: ["scenario-trigger-config-table"] });
      void qc.invalidateQueries({ queryKey: ["scenario-trigger-config"] });
    },
    onError: (e: Error) => setMessage(`That row did not save: ${e.message}. Try again.`),
  });

  const rows = q.data ?? [];

  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">Trigger table</h2>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted">
        A row appears on a file only when the record answers its condition. Required rows gate the
        phase exit; offered rows never do.
      </p>
      {message ? <p className="mt-2 text-[13px] text-muted">{message}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th scope="col" className="py-2 pr-4 font-medium">Condition</th>
              <th scope="col" className="py-2 pr-4 font-medium">Document</th>
              <th scope="col" className="py-2 pr-4 font-medium">Citation</th>
              <th scope="col" className="py-2 pr-4 font-medium">Phase</th>
              <th scope="col" className="py-2 pr-4 font-medium">State</th>
              <th scope="col" className="py-2 font-medium">In use</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.config_id} className="border-b border-border align-top">
                <td className="py-2 pr-4">{r.condition_label}</td>
                <td className="py-2 pr-4">{r.label}</td>
                <td className="py-2 pr-4">{r.citation}</td>
                <td className="py-2 pr-4">{r.phase}</td>
                <td className="py-2 pr-4">
                  {mayEdit ? (
                    <select
                      aria-label={`State for ${r.label}`}
                      value={r.state}
                      onChange={(e) => save.mutate({ ...r, state: e.target.value })}
                      className="rounded-lg border border-border bg-background px-2 py-1"
                    >
                      <option value="required">Required</option>
                      <option value="offered">Offered</option>
                    </select>
                  ) : r.state === "offered" ? (
                    "Offered"
                  ) : (
                    "Required"
                  )}
                </td>
                <td className="py-2">
                  {mayEdit ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={(e) => save.mutate({ ...r, enabled: e.target.checked })}
                      />
                      <span>{r.enabled ? "In use" : "Off"}</span>
                    </label>
                  ) : r.enabled ? (
                    "In use"
                  ) : (
                    "Off"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
