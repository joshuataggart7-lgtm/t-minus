import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/components/role-context";
import { runExclusionsSweepNow } from "@/lib/exclusions-sweep.functions";
import type { SweepResult } from "@/lib/exclusions-sweep.server";
import { DataTable, StatusChip, type DataColumn } from "@/components/ui-mc";

type SweepRow = SweepResult["results"][number];

const SWEEP_COLUMNS: DataColumn<SweepRow>[] = [
  { key: "acq", header: "Acquisition", nowrap: true, rowHeader: true, cell: (row) => <span data-numeric>{row.acquisitionId}</span> },
  {
    key: "vendor",
    header: "Vendor",
    cell: (row) => (
      <>
        {row.legalName} <span className="text-muted-foreground" data-numeric>({row.uei})</span>
      </>
    ),
  },
  {
    key: "result",
    header: "Result",
    cell: (row) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <StatusChip label={row.exclusionLabel} tone={/^no active/i.test(row.exclusionLabel) ? "ontrack" : "atrisk"} />
        {row.flaggedForReview ? <StatusChip label="Flagged for CO review" tone="attention" /> : null}
      </span>
    ),
  },
  { key: "source", header: "Source", cell: (row) => row.sourceLabel },
];

/** Nightly exclusions sweep: last run time, HQ on-demand run, and the vendor results. */
export function ExclusionsSweepPanel() {
  const { hasRole, readOnly } = useRole();
  const run = useServerFn(runExclusionsSweepNow);
  const [result, setResult] = useState<SweepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const last = useQuery({
    queryKey: ["exclusions-sweep-last"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("audit_log")
        .select("actor,logged_at,new_value,reason")
        .eq("action", "Exclusions sweep")
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (queryError) throw new Error(queryError.message);
      return data;
    },
  });

  const onRun = async () => {
    setBusy(true);
    setError("");
    try {
      const view = await run({});
      setResult(view);
      await last.refetch();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The sweep did not run. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const stamp = last.data?.logged_at ? new Date(last.data.logged_at).toLocaleString() : null;

  return (
    <section className="mc-kpanel mt-10 w-full [&_p]:max-w-[80ch]" aria-labelledby="exclusions-sweep-heading">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
      <h3 id="exclusions-sweep-heading" className="mc-kpanel-title">
        Vendor exclusions sweep
      </h3>
      <p className="mc-req-meta mt-1">
        Every vendor of record on every open file is checked against SAM.gov exclusions each night, by exact UEI. The
        sweep never changes a clock. Where an exclusion record is found, the file is flagged for the contracting
        officer to review, and a clean live check on the same UEI clears the flag.
      </p>
        </div>
        {hasRole("hq") && !readOnly ? (
          <button
            type="button"
            onClick={onRun}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-[15px] font-medium hover:bg-canvas disabled:opacity-60"
          >
            {busy ? "Running the sweep" : "Run the sweep now"}
          </button>
        ) : null}
      </div>
      <p className="mc-req-text mt-4">
        {last.isLoading
          ? "Loading the last sweep time."
          : stamp
            ? `Last sweep ${stamp} · ${last.data?.new_value ?? ""}${last.data?.reason ? ` · ${last.data.reason}` : ""}`
            : "Exclusions sweep: never run"}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4">
          <p className="mc-req-meta">
            {result.vendorsChecked} vendor check{result.vendorsChecked === 1 ? "" : "s"} across {result.filesChecked}{" "}
            open file{result.filesChecked === 1 ? "" : "s"} · {result.excludedFound} exclusion record(s) ·{" "}
            {result.flaggedForReview} flagged for CO review · no clock changed
          </p>
          {result.results.length === 0 ? (
            <p className="mt-2 text-muted-foreground">No open file has a vendor of record.</p>
          ) : (
            <div className="mt-3">
              <DataTable
                label="Vendor exclusion results from the last sweep"
                caption="Vendor exclusion results from the last sweep"
                columns={SWEEP_COLUMNS}
                rows={result.results}
                rowKey={(row) => `${row.acquisitionId}-${row.uei}`}
              />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
