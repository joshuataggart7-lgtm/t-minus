// Modifications under an awarded file. NCMS writes the SF 30; T-Minus carries
// the type, the block 13 authority, the value and period change, the clause
// delta and the funds line, and hands over a packet.

import { writeAudit } from "@/lib/audit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import { CiteChip, StatusChip } from "@/components/ui-mc";
import { IDIQ_CLAUSE_DELTA_WITHHELD_NOTE } from "@/lib/clause-packet";
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
      await writeAudit({
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
  const input = "mc-pa-input";
  const label = "mc-pa-label";

  const rowChips = (list: { label: string; state: string; citation: string }[]) => (
    <ul className="mc-pa-check mt-2">
      {list.map((r) => (
        <li key={r.label} className={r.state === "required" ? undefined : "is-info"}>
          <span className="mc-pa-check-main">
            <span>{r.label}</span>
            {r.citation ? <CiteChip cite={r.citation} /> : null}
          </span>
          <StatusChip label={r.state === "required" ? "Required" : "Offered"} />
        </li>
      ))}
    </ul>
  );
  const drafts = rows.filter((m) => m.state === "draft").length;

  return (
    <section aria-label="Modifications" className="mc-kpanel mc-pa mb-10">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
          <h2 className="mc-kpanel-title">Modifications</h2>
          <p className="mc-pa-sub">
            The SF 30 of record is written in NCMS. Answer five questions (what changes, why, who
            asked, funded or not, within scope or not) and T-Minus sets the SF 30 block 13 authority
            from the clause already in the instrument, lists the rows the change calls for, and gives
            you an FPDS fill sheet to key by hand.
          </p>
        </div>
        <div className="mc-kpanel-status">
          <StatusChip
            label={rows.length === 0 ? "None recorded" : `${rows.length} recorded`}
            tone={rows.length === 0 ? "neutral" : "info"}
          />
          {rows.length > 0 ? (
            <span className="mc-req-meta" data-numeric>
              {drafts} draft · {rows.length - drafts} issued
            </span>
          ) : null}
          {canWrite ? (
            <button type="button" onClick={() => setOpen((v) => !v)} className="mc-pa-link">
              {open ? "Cancel" : "New modification"}
            </button>
          ) : null}
        </div>
      </div>

      {open && canWrite ? (
        <form
          className="mc-kpanel-section"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <h3 className="mc-req-h">New modification</h3>
          <div className="mc-pa-form">
            <label className={label}>
              Type
              <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
                {MOD_TYPES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Value change, dollars
              <input className={input} inputMode="decimal" value={valueChange} onChange={(e) => setValueChange(e.target.value)} />
            </label>
            <label className={`${label} is-wide`}>
              Description
              <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className={label}>
              New period end
              <input type="date" className={input} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </label>
            <label className={label}>
              Funds line
              <input className={input} value={fundsLine} onChange={(e) => setFundsLine(e.target.value)} />
            </label>
            <label className={`${label} is-wide`}>
              Why the change is needed
              <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <label className={label}>
              Who asked for it
              <input className={input} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} />
            </label>
            <label className={label}>
              Funding
              <select className={input} value={funded} onChange={(e) => setFunded(e.target.value === "no" ? "no" : "yes")}>
                <option value="yes">Funds are available on this line</option>
                <option value="no">Not funded yet</option>
              </select>
            </label>
            <label className="mc-pa-toggle is-wide">
              <input type="checkbox" checked={outOfScope} onChange={(e) => setOutOfScope(e.target.checked)} />
              This modification adds work outside the scope of the contract
            </label>
          </div>
          <div className="mc-pa-card mt-4">
            <p className="mc-pa-card-title">
              SF 30 block {modTypeInfo(type).block}. Authority: {draftAuthority}
            </p>
            <p className="mc-pa-sub">
              Block 13 names the authority already in the instrument, or the administrative form
              cite at RFO FAR 43.203(b). Form use RFO 43.401; modification types RFO 43.203. A
              negotiation memorandum or a justification is a document this change may trigger, never
              the block 13 authority.
            </p>
            {funded === "no" ? (
              <p className="mc-pa-callout mt-2">
                Funds are not certified yet on this change. Record the funds line before the
                modification is signed.
              </p>
            ) : null}
            <h4 className="mc-req-h mt-3">Rows this change calls for</h4>
            {rowChips(draftRows)}
            {clauseDeltaWithheld ? (
              <p className="mc-pa-sub mt-2">{IDIQ_CLAUSE_DELTA_WITHHELD_NOTE}</p>
            ) : (
              <p className="mc-pa-sub mt-2">
                Clause delta: read from the clause matrices on the file after the modification is
                created. Removed clauses are never carried forward.
              </p>
            )}
            <div className="mc-pa-actions">
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(fpdsSheet)}
                className="mc-pa-link"
              >
                Copy the FPDS fill sheet
              </button>
              <span className="mc-req-meta">
                A local aid for keying FPDS-NG. T-Minus does not write to FPDS.
              </span>
            </div>
          </div>
          <div className="mc-pa-actions">
            <button type="submit" disabled={create.isPending} className="mc-req-button">
              {create.isPending ? "Creating" : "Create the modification"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mc-kpanel-section">
        {rows.length === 0 ? (
          <p className="mc-req-fallback">
            No modifications are recorded on this file.
          </p>
        ) : (
          <ul aria-label="Modifications on this file">
            {rows.map((m) => {
              const info = modTypeInfo(m.mod_type);
              const change = Number(m.value_change ?? 0);
              const draftState = m.state === "draft";
              return (
                <li key={m.mod_id} className={`mc-pa-card ${draftState ? "is-draft" : "is-issued"}`}>
                  <div className="mc-pa-card-head">
                    <p className="mc-pa-card-title">
                      {m.mod_number} · {info.label}
                    </p>
                    <StatusChip label={draftState ? "Draft" : "Issued"} tone={draftState ? "attention" : "ontrack"} />
                  </div>
                  <dl className="mc-pa-facts is-2 mt-1">
                    <div className="is-wide">
                      <dt>SF 30 block {info.block}</dt>
                      <dd>{m.authority_text ?? modAuthorityText(m.mod_type, acq)}</dd>
                    </div>
                    {change ? (
                      <div>
                        <dt>Value change</dt>
                        <dd data-numeric>{money(change)}</dd>
                      </div>
                    ) : null}
                    {m.period_change_end ? (
                      <div>
                        <dt>Period runs to</dt>
                        <dd data-numeric>{m.period_change_end}</dd>
                      </div>
                    ) : null}
                    {m.funds_line ? (
                      <div>
                        <dt>Funds line</dt>
                        <dd>{m.funds_line}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {m.description ? <p className="mc-pa-text mt-2">{m.description}</p> : null}
                  {rowChips(modRows(m, { method }))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
