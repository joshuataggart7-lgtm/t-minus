import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";
import { signedInName } from "@/lib/account-name";
import { DEMO_READ_ONLY_NOTE, isDemoSession } from "@/lib/demo-guard";
import type { IntakeFacts } from "@/lib/intake";
import type { Nf1707Field } from "@/lib/nf1707";
import {
  Nf1707Intake,
  answersFromStored,
  canonicalAnswers,
  canonicalFromFacts,
  mappedNf1707,
  type NfAnswers,
} from "@/components/nf1707-intake";

/**
 * Edit and save the NF 1707 answers on an existing file. The record keeps the
 * Intake answer keys (so the answers reload here) and the blank's cells (so
 * the export fills). Signature and concurrence text already on the record is
 * kept as is.
 */
export function Nf1707AnswersEditor({
  acquisitionId,
  acq,
  canWrite,
  actor,
  onSaved,
}: {
  acquisitionId: string;
  acq: Record<string, unknown>;
  canWrite: boolean;
  actor: string;
  onSaved: () => Promise<void> | void;
}) {
  const stored = useMemo(
    () => ((acq["nf1707_answers"] ?? {}) as Record<string, unknown>),
    [acq],
  );
  const facts = acq as unknown as IntakeFacts;
  const [answers, setAnswers] = useState<NfAnswers>(() => answersFromStored(stored));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) setAnswers(answersFromStored(stored));
  }, [stored, dirty]);

  const fieldsQ = useQuery({
    queryKey: ["nf1707-fields"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from("nf1707_fields").select("*");
      if (error) throw error;
      return (data ?? []) as Nf1707Field[];
    },
  });

  const setTracked: React.Dispatch<React.SetStateAction<NfAnswers>> = (next) => {
    setDirty(true);
    setMessage(null);
    setAnswers(next);
  };

  const save = async () => {
    if (await isDemoSession()) {
      setMessage(DEMO_READ_ONLY_NOTE);
      return;
    }
    setSaving(true);
    try {
      const merged = { ...canonicalFromFacts(facts), ...answers };
      const keep: Record<string, string> = {};
      for (const [k, v] of Object.entries(stored)) {
        if (k.split(".").length >= 3 && /Sig$|Concurrence$|Approval$|Txt$/.test(k) && v) keep[k] = String(v);
      }
      const next = {
        ...mappedNf1707(fieldsQ.data ?? [], merged, {}, facts),
        ...keep,
        ...canonicalAnswers(merged),
      };
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ nf1707_answers: next as Record<string, string> })
        .eq("acquisition_id", acquisitionId);
      if (error) throw new Error(error.message);
      const who = await signedInName(actor);
      await writeAudit({
        acquisition_id: acquisitionId,
        actor: who,
        action: "NF 1707 answers saved",
        field: "nf1707_answers",
        old_value: null,
        new_value: `${Object.values(next).filter((v) => v === "1").length} statements checked`,
        reason: "NF 1707 answers edited on the form page",
      } as never);
      setDirty(false);
      setMessage("NF 1707 answers saved.");
      await onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? `The answers did not save: ${e.message}` : "The answers did not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mb-8 max-w-[80ch] rounded-xl border border-border bg-background">
      <summary className="cursor-pointer px-5 py-4 text-[18px] font-medium leading-6">Edit NF 1707 answers</summary>
      <div className="border-t border-border px-5 pb-5">
        {canWrite ? null : (
          <p className="mt-3 text-[13px] text-muted-foreground">View only. Sign in as a contracting specialist to save changes.</p>
        )}
        <Nf1707Intake answers={answers} setAnswers={setTracked} fields={fieldsQ.data ?? []} facts={facts} evmThreshold={0} />
        <div className="flex flex-wrap items-center gap-4">
          <Button type="button" onClick={() => void save()} disabled={!canWrite || !dirty || saving}>
            {saving ? "Saving" : "Save NF 1707 answers"}
          </Button>
          {message ? <p role="status" className="text-[15px]">{message}</p> : null}
        </div>
      </div>
    </details>
  );
}
