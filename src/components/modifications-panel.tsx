// Modifications under an awarded file. NCMS writes the SF 30; T-Minus carries
// the type, the block 13 authority, the value and period change, the clause
// delta and the funds line, and hands over a packet.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import {
  MOD_TYPES,
  modRows,
  modTypeInfo,
  sf30Blocks,
  type ModificationRow,
} from "@/lib/vehicles";

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US")}`;

export function ModificationsPanel({
  acq,
  canWrite,
  actor,
  onBanner,
}: {
  acq: Record<string, unknown> | null | undefined;
  canWrite: boolean;
  actor: string;
  onBanner: (s: string) => void;
}) {
  const qc = useQueryClient();
  const acquisitionId = String(acq?.["acquisition_id"] ?? "");
  const awarded = Boolean(String(acq?.["contract_number"] ?? "").trim());
  const method = String(acq?.["acquisition_method"] ?? "");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("administrative");
  const [description, setDescription] = useState("");
  const [valueChange, setValueChange] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [fundsLine, setFundsLine] = useState("");
  const [outOfScope, setOutOfScope] = useState(false);

  const q = useQuery({
    queryKey: ["modifications", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_modifications")
        .select("*")
        .eq("acquisition_id", acquisitionId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ModificationRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const name = await signedInName(actor);
      const count = (q.data ?? []).length;
      const info = modTypeInfo(type);
      const modNumber = `P${String(count + 1).padStart(5, "0")}`;
      const payload = {
        acquisition_id: acquisitionId,
        mod_number: modNumber,
        mod_type: type,
        ...sf30Blocks(type),
        authority_text: info.authority,
        description: description.trim() || null,
        value_change: valueChange.trim() ? Number(valueChange) : null,
        period_change_end: periodEnd || null,
        funds_line: fundsLine.trim() || null,
        clause_delta: [],
        state: "draft",
      };
      const { error } = await supabase.from("contract_modifications").insert(payload as never);
      if (error) throw new Error(error.message);
      await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: name,
        action: "Modification created",
        field: modNumber,
        old_value: null,
        new_value: info.label,
        reason: `${info.label} created as ${modNumber}, SF 30 block ${info.block}`,
      } as never);
      return modNumber;
    },
    onSuccess: (modNumber) => {
      onBanner(`Modification ${modNumber} was created.`);
      setOpen(false);
      setDescription("");
      setValueChange("");
      setPeriodEnd("");
      setFundsLine("");
      void qc.invalidateQueries({ queryKey: ["modifications", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: Error) => onBanner(`The modification was not created: ${e.message}. Try again.`),
  });

  if (!acq || !awarded) return null;
  const rows = q.data ?? [];
  const input = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]";

  return (
    <section aria-label="Modifications" className="mb-10 rounded-xl border border-border bg-background p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[18px] leading-6 font-medium">Modifications</h2>
        {canWrite ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-[15px] text-primary">
            {open ? "Cancel" : "New modification"}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        The SF 30 of record is written in NCMS. Each modification here carries its block 13
        authority, the change, and the rows the change calls for.
      </p>

      {open && canWrite ? (
        <form
          className="mt-4 grid max-w-[70ch] gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="block text-[13px] text-muted-foreground">
            Type
            <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
              {MOD_TYPES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] text-muted-foreground">
            Value change, dollars
            <input className={input} inputMode="decimal" value={valueChange} onChange={(e) => setValueChange(e.target.value)} />
          </label>
          <label className="block text-[13px] text-muted-foreground sm:col-span-2">
            Description
            <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block text-[13px] text-muted-foreground">
            New period end
            <input type="date" className={input} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </label>
          <label className="block text-[13px] text-muted-foreground">
            Funds line
            <input className={input} value={fundsLine} onChange={(e) => setFundsLine(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <input type="checkbox" checked={outOfScope} onChange={(e) => setOutOfScope(e.target.checked)} />
            This modification adds work outside the scope of the contract
          </label>
          <p className="text-[13px] text-muted-foreground sm:col-span-2">
            SF 30 block {modTypeInfo(type).block}: {modTypeInfo(type).authority}.
          </p>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-lg border border-border px-4 py-2 text-[15px] text-primary disabled:opacity-60"
            >
              {create.isPending ? "Creating" : "Create the modification"}
            </button>
          </div>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          No modifications are recorded on this file.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {rows.map((m) => {
            const info = modTypeInfo(m.mod_type);
            const change = Number(m.value_change ?? 0);
            return (
              <li key={m.mod_id} className="border-t border-border pt-3">
                <p className="text-[15px] leading-[22px]">
                  {m.mod_number} · {info.label} · {m.state === "draft" ? "Draft" : "Issued"}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  SF 30 block {info.block}: {m.authority_text ?? info.authority}.
                  {change ? ` Value change ${money(change)}.` : ""}
                  {m.period_change_end ? ` Period runs to ${m.period_change_end}.` : ""}
                  {m.funds_line ? ` Funds line ${m.funds_line}.` : ""}
                </p>
                {m.description ? <p className="mt-1 text-[13px]">{m.description}</p> : null}
                <ul className="mt-2 space-y-1 text-[13px]">
                  {modRows(m, { method, outOfScope: false }).map((r) => (
                    <li key={r.label}>
                      {r.label} · {r.state === "required" ? "Required" : "Offered"} · {r.citation}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
