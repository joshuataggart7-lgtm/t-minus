// Closeout record. The Closeout Transfer Checklist reads these values instead
// of blank boxes; the retention date is computed from the final payment date.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import { closeoutOf, retentionDate, type CloseoutRecord } from "@/lib/vehicles";

export function CloseoutPanel({
  acq,
  canWrite,
  actor,
  onBanner,
  cparsRecorded,
}: {
  acq: Record<string, unknown> | null | undefined;
  canWrite: boolean;
  actor: string;
  onBanner: (s: string) => void;
  cparsRecorded: boolean;
}) {
  const qc = useQueryClient();
  const acquisitionId = String(acq?.["acquisition_id"] ?? "");
  const saved = acq ? closeoutOf(acq) : null;
  const [draft, setDraft] = useState<CloseoutRecord | null>(null);
  const record = draft ?? saved;

  const save = useMutation({
    mutationFn: async (next: CloseoutRecord) => {
      const name = await signedInName(actor);
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ closeout: next } as never)
        .eq("acquisition_id", acquisitionId);
      if (error) throw new Error(error.message);
      await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: name,
        action: "Closeout record updated",
        field: "closeout",
        old_value: null,
        new_value: next.final_payment_date ?? "",
        reason: "The closeout record was updated on the file.",
      } as never);
    },
    onSuccess: () => {
      onBanner("The closeout record was saved.");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: Error) => onBanner(`The closeout record was not saved: ${e.message}. Try again.`),
  });

  if (!acq || !record) return null;
  const phase = String(acq["current_phase"] ?? "");
  const launched = String(acq["clock_state"] ?? "") === "launched";
  if (!launched && phase !== "Closeout") return null;

  const set = (patch: Partial<CloseoutRecord>) => setDraft({ ...record, ...patch });
  const input = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]";
  const retention = retentionDate(record.final_payment_date);

  return (
    <section aria-label="Closeout record" className="mb-10 max-w-[70ch] rounded-xl border border-border bg-background p-5">
      <h2 className="text-[18px] leading-6 font-medium">Closeout record</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] text-muted-foreground">
          Deobligation amount, dollars
          <input
            className={input}
            inputMode="decimal"
            disabled={!canWrite}
            value={record.deobligation_amount ?? ""}
            onChange={(e) => set({ deobligation_amount: e.target.value })}
          />
        </label>
        <label className="block text-[13px] text-muted-foreground">
          Deobligation date
          <input
            type="date"
            className={input}
            disabled={!canWrite}
            value={record.deobligation_date ?? ""}
            onChange={(e) => set({ deobligation_date: e.target.value })}
          />
        </label>
        <label className="block text-[13px] text-muted-foreground">
          Final invoice date
          <input
            type="date"
            className={input}
            disabled={!canWrite}
            value={record.final_invoice_date ?? ""}
            onChange={(e) => set({ final_invoice_date: e.target.value })}
          />
        </label>
        <label className="block text-[13px] text-muted-foreground">
          Final payment date
          <input
            type="date"
            className={input}
            disabled={!canWrite}
            value={record.final_payment_date ?? ""}
            onChange={(e) => set({ final_payment_date: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-[15px] sm:col-span-2">
          <input
            type="checkbox"
            disabled={!canWrite}
            checked={Boolean(record.release_of_claims)}
            onChange={(e) => set({ release_of_claims: e.target.checked })}
          />
          Release of claims received
        </label>
        <label className="flex items-center gap-2 text-[15px] sm:col-span-2">
          <input
            type="checkbox"
            disabled={!canWrite}
            checked={Boolean(record.property_cleared)}
            onChange={(e) => set({ property_cleared: e.target.checked })}
          />
          Government property cleared
        </label>
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        Final CPARS: {cparsRecorded ? "entered on this file" : "not entered yet"}. Retention date:{" "}
        {retention ?? "set the final payment date to compute it"}.
      </p>
      {canWrite ? (
        <button
          type="button"
          disabled={!draft || save.isPending}
          onClick={() => draft && save.mutate(draft)}
          className="mt-3 rounded-lg border border-border px-4 py-2 text-[15px] text-primary disabled:opacity-60"
        >
          {save.isPending ? "Saving" : "Save the closeout record"}
        </button>
      ) : null}
    </section>
  );
}
