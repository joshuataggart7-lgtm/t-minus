import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FORM_FIELD_MAPPINGS } from "@/lib/form-field-mappings";
import { countByScope, mappingsInheritable, mappingsTransactionOnly } from "@/lib/field-scope";

/**
 * Soft §6 scaffold: "Start a new order from this contract".
 *
 * It shows the inheritance plan only. Nothing is created and no record is
 * changed on this file. Organization, acquisition and contract values carry
 * forward; everything transaction-level (order and modification numbers,
 * dates, schedule lines, funding, signatures) starts blank.
 */
export function NewOrderPanel({
  acq,
  canWrite,
  actor,
}: {
  acq: Record<string, unknown> | null;
  canWrite: boolean;
  actor: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const plan = useMemo(() => {
    const rows = FORM_FIELD_MAPPINGS;
    const copy = mappingsInheritable(rows, "new_order");
    const clear = mappingsTransactionOnly(rows);
    const paths = (list: typeof rows) =>
      Array.from(new Set(list.map((r) => r.record_path).filter(Boolean))).sort();
    return {
      counts: countByScope(rows),
      copyPaths: paths(copy),
      clearPaths: paths(clear),
    };
  }, []);

  const contractNumber = String(acq?.["contract_number"] ?? "").trim();
  const acquisitionId = String(acq?.["acquisition_id"] ?? "").trim();
  if (!acquisitionId || !contractNumber) return null;

  const record = async () => {
    setNote(null);
    try {
      await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor,
        action: `Prototype: inheritance plan prepared for a new order from ${contractNumber}`,
        field: null,
        old_value: null,
        new_value: `${plan.copyPaths.length} fields carry forward, ${plan.clearPaths.length} start blank`,
        reason: null,
        phase: (acq?.["current_phase"] as string | null) ?? null,
      } as never);
      setNote("Prototype: inheritance plan ready; full create follows.");
    } catch {
      setNote("The plan could not be recorded. Try again from this panel.");
    }
  };

  return (
    <section className="mt-10 max-w-[720px]">
      <h2 className="text-[18px] leading-6 font-medium">Start a new order from this contract</h2>
      <p className="mt-2 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">
        A new order under {contractNumber} keeps the office, acquisition and contract facts on this
        file and starts every order-level value blank. This panel shows the plan; no file is created
        and nothing on {acquisitionId} changes.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen(!open)}>
          {open ? "Hide the plan" : "Start a new order from this contract"}
        </Button>
        {open && canWrite ? (
          <Button size="sm" variant="ghost" onClick={() => void record()}>
            Record this plan
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 border border-border p-4 text-[15px] leading-[22px]">
          <p>
            Carries forward: {plan.copyPaths.length} fields — {plan.counts.organization} office,{" "}
            {plan.counts.acquisition} acquisition, {plan.counts.contract} contract.
          </p>
          <p className="mt-1">Starts blank: {plan.clearPaths.length} order-level fields.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-[15px] font-medium">Examples that copy</h3>
              <ul className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                {plan.copyPaths.slice(0, 8).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[15px] font-medium">Examples that start blank</h3>
              <ul className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                {plan.clearPaths.slice(0, 8).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {note ? <p className="mt-3 text-[13px] text-muted-foreground">{note}</p> : null}
    </section>
  );
}
