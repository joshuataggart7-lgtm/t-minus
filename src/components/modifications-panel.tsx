// Modifications under an awarded file. NCMS writes the SF 30; T-Minus carries
// the type, the block 13 authority, the value and period change, the clause
// delta and the funds line, and hands over a packet.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import {
  MOD_TYPES,
  modAuthorityText,
  modRows,
  modTypeInfo,
  sf30Blocks,
  acquisitionProfile,
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
  const [reason, setReason] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [funded, setFunded] = useState<"yes" | "no">("yes");

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
      const authorityText = modAuthorityText(type, acq ?? null);
      const modNumber = `P${String(count + 1).padStart(5, "0")}`;
      const payload = {
        acquisition_id: acquisitionId,
        mod_number: modNumber,
        mod_type: type,
        ...sf30Blocks(type),
        authority_text: authorityText,
        description: description.trim() || null,
        value_change: valueChange.trim() ? Number(valueChange) : null,
        period_change_end: periodEnd || null,
        funds_line: fundsLine.trim() || null,
        clause_delta: [
          ...(outOfScope ? [{ key: "out_of_scope", value: true }] : []),
          ...(reason.trim() ? [{ key: "reason", value: reason.trim() }] : []),
          ...(requestedBy.trim() ? [{ key: "requested_by", value: requestedBy.trim() }] : []),
          { key: "funded", value: funded === "yes" },
        ],
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
        reason: `${info.label} created as ${modNumber}, SF 30 block ${info.block}, authority ${authorityText}${outOfScope ? "; adds out-of-scope work, justification required" : ""}`,
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
      setOutOfScope(false);
      setReason("");
      setRequestedBy("");
      setFunded("yes");
      void qc.invalidateQueries({ queryKey: ["modifications", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: Error) => onBanner(`The modification was not created: ${e.message}. Try again.`),
  });

  if (!acq || !awarded) return null;
  const rows = q.data ?? [];
  const draftAuthority = modAuthorityText(type, acq);
  const profile = acquisitionProfile(acq);
  const clauseDeltaWithheld = profile === "idiq_parent" || profile === "order_under_idiq";
  const draftRows = modRows(
    { mod_type: type, value_change: valueChange.trim() ? Number(valueChange) : null },
    { method, outOfScope },
  );
  const fpdsSheet = [
    `FPDS-NG fill sheet, ${acquisitionId}`,
    `Modification type: ${modTypeInfo(type).label}`,
    `SF 30 block: ${modTypeInfo(type).block}`,
    `Authority in block 13: ${draftAuthority}`,
    `Value change: ${valueChange.trim() ? money(Number(valueChange)) : "none recorded"}`,
    `New period end: ${periodEnd || "unchanged"}`,
    `Funds line: ${fundsLine.trim() || "not recorded"}`,
    `Within scope: ${outOfScope ? "no, out of scope" : "yes"}`,
    `Reason: ${reason.trim() || "not recorded"}`,
    `Requested by: ${requestedBy.trim() || "not recorded"}`,
    "",
    "Keyed by hand in FPDS-NG. T-Minus does not write to FPDS.",
  ].join("\n");
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
        The SF 30 of record is written in NCMS. Answer five questions — what changes, why, who
        asked, funded or not, within scope or not — and T-Minus sets the SF 30 block 13 authority
        from the clause already in the instrument, lists the rows the change calls for, and gives
        you an FPDS fill sheet to key by hand.
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
          <label className="block text-[13px] text-muted-foreground sm:col-span-2">
            Why the change is needed
            <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label className="block text-[13px] text-muted-foreground">
            Who asked for it
            <input className={input} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} />
          </label>
          <label className="block text-[13px] text-muted-foreground">
            Funding
            <select className={input} value={funded} onChange={(e) => setFunded(e.target.value === "no" ? "no" : "yes")}>
              <option value="yes">Funds are available on this line</option>
              <option value="no">Not funded yet</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <input type="checkbox" checked={outOfScope} onChange={(e) => setOutOfScope(e.target.checked)} />
            This modification adds work outside the scope of the contract
          </label>
          <div className="border border-border p-3 text-[13px] leading-[18px] sm:col-span-2">
            <p>
              SF 30 block {modTypeInfo(type).block}. Authority: {draftAuthority}
            </p>
            <p className="mt-1 text-muted-foreground">
              Block 13 names the authority already in the instrument, or the administrative form
              cite at FAR 43.103(b). Form use RFO 43.401; modification types RFO 43.203. A
              negotiation memorandum or a justification is a document this change may trigger, never
              the block 13 authority.
            </p>
            {funded === "no" ? (
              <p className="mt-1 text-muted-foreground">
                Funds are not certified yet on this change. Record the funds line before the
                modification is signed.
              </p>
            ) : null}
            <p className="mt-2">Rows this change calls for:</p>
            <ul className="mt-1 space-y-1">
              {draftRows.map((r) => (
                <li key={r.label}>
                  {r.label} · {r.state === "required" ? "Required" : "Offered"} · {r.citation}
                </li>
              ))}
            </ul>
            {clauseDeltaWithheld ? (
              <p className="mt-2 text-muted-foreground">
                Clause delta: withheld on this vehicle. Clause reconciliation is not complete, so it
                is not shown on this file.
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground">
                Clause delta: read from the clause matrices on the file after the modification is
                created. Removed clauses are never carried forward.
              </p>
            )}
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(fpdsSheet)}
              className="mt-2 text-primary"
            >
              Copy the FPDS fill sheet
            </button>
            <span className="ml-2 text-muted-foreground">
              A local aid for keying FPDS-NG. T-Minus does not write to FPDS.
            </span>
          </div>
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
                  SF 30 block {info.block}: {m.authority_text ?? modAuthorityText(m.mod_type, acq)}.
                  {change ? ` Value change ${money(change)}.` : ""}
                  {m.period_change_end ? ` Period runs to ${m.period_change_end}.` : ""}
                  {m.funds_line ? ` Funds line ${m.funds_line}.` : ""}
                </p>
                {m.description ? <p className="mt-1 text-[13px]">{m.description}</p> : null}
                <ul className="mt-2 space-y-1 text-[13px]">
                  {modRows(m, { method }).map((r) => (
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
