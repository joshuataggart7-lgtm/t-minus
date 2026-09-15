import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/components/role-context";
import { runExclusionsSweepNow } from "@/lib/exclusions-sweep.functions";
import type { SweepResult } from "@/lib/exclusions-sweep.server";

/** Nightly exclusions sweep: last run time, HQ on-demand run, and the vendor results. */
export function ExclusionsSweepPanel() {
  const { hasRole } = useRole();
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
    <section className="mt-10 max-w-[80ch]" aria-labelledby="exclusions-sweep-heading">
      <h3 id="exclusions-sweep-heading" className="text-[18px] leading-6 font-medium">
        Vendor exclusions sweep
      </h3>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Every vendor of record on every open file is checked against SAM.gov exclusions each night. A file whose vendor
        is excluded goes on hold with the reason “vendor excluded; CO review” and the contracting officer as owner.
      </p>
      <p className="mt-3 text-[15px]">
        {last.isLoading
          ? "Loading the last sweep time."
          : stamp
            ? `Last sweep ${stamp} · ${last.data?.new_value ?? ""}${last.data?.reason ? ` · ${last.data.reason}` : ""}`
            : "Exclusions sweep: never run"}
      </p>

      {hasRole("hq") ? (
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className="mt-3 rounded-lg border border-border px-3 py-2 text-[15px] hover:bg-canvas disabled:opacity-60"
        >
          {busy ? "Running the sweep" : "Run the sweep now"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4">
          <p className="text-[13px] text-muted-foreground">
            {result.vendorsChecked} vendor check{result.vendorsChecked === 1 ? "" : "s"} across {result.filesChecked}{" "}
            open file{result.filesChecked === 1 ? "" : "s"} · {result.excludedFound} excluded · {result.placedOnHold}{" "}
            placed on hold
          </p>
          {result.results.length === 0 ? (
            <p className="mt-2 text-muted-foreground">No open file has a vendor of record.</p>
          ) : (
            <table className="mt-3 w-full border-collapse text-[13px] leading-[18px]">
              <caption className="sr-only">Vendor exclusion results from the last sweep</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="p-2">Acquisition</th>
                  <th scope="col" className="p-2">Vendor</th>
                  <th scope="col" className="p-2">Result</th>
                  <th scope="col" className="p-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((row) => (
                  <tr key={`${row.acquisitionId}-${row.uei}`} className="border-b border-border">
                    <td className="p-2">{row.acquisitionId}</td>
                    <td className="p-2">
                      {row.legalName} ({row.uei})
                    </td>
                    <td className="p-2">
                      {row.exclusionLabel}
                      {row.placedOnHold ? " · placed on hold" : ""}
                    </td>
                    <td className="p-2">{row.sourceLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </section>
  );
}
