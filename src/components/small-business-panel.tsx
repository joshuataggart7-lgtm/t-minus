import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StatusMark } from "@/components/app-shell";
import type { AcqRow } from "@/lib/launch-sequence";
import {
  buildSmallBusinessPanel,
  loadPlansOnFile,
  type ThresholdRow,
} from "@/lib/small-business";
import { fetchSubawards, type SubawardView } from "@/lib/sam-subawards.functions";

function money(n: number | null) {
  if (n === null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function SmallBusinessPanel({
  acqs,
  thresholds,
  launchedIds,
}: {
  acqs: AcqRow[];
  thresholds: ThresholdRow[];
  launchedIds: Set<string>;
}) {
  const plans = useQuery({ queryKey: ["subcontracting-plans-on-file"], queryFn: loadPlansOnFile });
  const panel = buildSmallBusinessPanel(acqs, thresholds, plans.data ?? new Set<string>(), launchedIds);

  const [naics, setNaics] = useState("481219");
  const [view, setView] = useState<SubawardView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run = useServerFn(fetchSubawards);
  const research = useMutation({
    mutationFn: async () => run({ data: { naicsCode: naics.trim() } }),
    onSuccess: (result) => {
      setView(result);
      setMessage(null);
    },
    onError: (e: Error) => setMessage(`The subaward lookup did not run: ${e.message}. Try again.`),
  });

  return (
    <section aria-label="Small business" className="mt-10">
      <h3 className="text-[18px] leading-6 font-medium">Small business</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Computed from the set-aside decision on each file and the subcontracting plan threshold in the thresholds
        table.
      </p>

      <div className="mt-4 grid gap-8 sm:grid-cols-3">
        <div>
          <p className="text-[28px] leading-[34px] font-semibold" data-numeric>
            {panel.setAsideRate === null ? "—" : `${Math.round(panel.setAsideRate * 100)}%`}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Set-aside rate: {panel.setAsideFiles} of {panel.totalFiles} files
          </p>
        </div>
        <div>
          <p className="text-[28px] leading-[34px] font-semibold" data-numeric>
            {panel.awardsTotal}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Small business share of estimated value, {money(panel.awardsValue)} across {panel.awardsTotal}{" "}
            {panel.awardsTotal === 1 ? "file" : "files"}
          </p>
        </div>
        <div>
          <p className="text-[28px] leading-[34px] font-semibold" data-numeric>
            {panel.missingPlans.length}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">Above the plan threshold with no plan on file</p>
        </div>
      </div>

      <h4 className="mt-8 text-[15px] leading-[22px] font-medium">Small business estimated value by Center</h4>
      {panel.byCenter.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No file with a small business set-aside has launched yet.</p>
      ) : (
        <ul className="mt-3 max-w-[70ch] space-y-1 border-t border-border pt-3">
          {panel.byCenter.map((c) => (
            <li key={c.center} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[13px] leading-[18px]">
              <span>{c.center}</span>
              <span data-numeric>
                {c.files} {c.files === 1 ? "file" : "files"} · {money(c.value)} estimated value
              </span>
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-8 text-[15px] leading-[22px] font-medium">
        Above the subcontracting plan threshold with no plan on file
      </h4>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Threshold {money(panel.threshold?.value ?? null)}
        {panel.threshold?.citation ? ` · ${panel.threshold.citation}` : ""}
      </p>
      {plans.error ? (
        <p className="mt-2 text-muted-foreground">The documents on file could not be read. Reload the page.</p>
      ) : panel.missingPlans.length === 0 ? (
        <p className="mt-2 text-muted-foreground">
          Every file above the threshold has a plan or waiver on file.
        </p>
      ) : (
        <div className="overflow-x-auto">
        <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
          <caption className="sr-only">Files above the subcontracting plan threshold with no plan on file</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Acquisition</th>
              <th scope="col" className="p-2">Center</th>
              <th scope="col" className="p-2">Requirement</th>
              <th scope="col" className="p-2">Estimated value</th>
              <th scope="col" className="p-2">Plan</th>
            </tr>
          </thead>
          <tbody>
            {panel.missingPlans.map((r) => (
              <tr key={r.acquisitionId} className="border-b border-border last:border-0">
                <td className="p-2">
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: r.acquisitionId }}
                    className="text-primary underline"
                  >
                    {r.acquisitionId}
                  </Link>
                </td>
                <td className="p-2">{r.center}</td>
                <td className="p-2">{r.title}</td>
                <td className="p-2" data-numeric>
                  {money(r.value)}
                </td>
                <td className="p-2">
                  <StatusMark color="var(--attention)">No plan on file</StatusMark>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <h4 className="mt-8 text-[15px] leading-[22px] font-medium">Market research: who subcontracts to whom</h4>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
        Reads the SAM.gov subaward reporting records for a NAICS code and shows, for recent prime awards, the
        subcontractors they used.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="subaward-naics" className="block text-[13px] text-muted-foreground">
            NAICS code
          </label>
          <input
            id="subaward-naics"
            value={naics}
            onChange={(e) => setNaics(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-40 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            data-numeric
          />
        </div>
        <button
          type="button"
          disabled={!naics.trim() || research.isPending}
          onClick={() => research.mutate()}
          className="rounded-lg bg-primary px-3 py-2 text-[14px] text-primary-foreground disabled:opacity-50"
        >
          {research.isPending ? "Running the lookup" : "Run subaward research"}
        </button>
      </div>
      {message ? <p className="mt-2 text-[13px] text-muted-foreground">{message}</p> : null}
      {view ? (
        <>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {view.sourceLabel} · NAICS {view.naicsCode} · {view.rows.length} records · run{" "}
            {view.checkedAt.slice(0, 10)}
          </p>
          {view.rows.length === 0 ? (
            <p className="mt-2 text-muted-foreground">No subaward records came back for this NAICS code.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
              <caption className="sr-only">Subaward records for NAICS {view.naicsCode}</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-2">Prime</th>
                  <th scope="col" className="p-2">Buying agency</th>
                  <th scope="col" className="p-2">Subcontractor</th>
                  <th scope="col" className="p-2">Place</th>
                  <th scope="col" className="p-2">Amount</th>
                  <th scope="col" className="p-2">Date</th>
                  <th scope="col" className="p-2">Work</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r, i) => (
                  <tr key={`${r.primeName}-${r.subName}-${i}`} className="border-b border-border last:border-0">
                    <td className="p-2">{r.primeName}</td>
                    <td className="p-2">{r.primeAgency}</td>
                    <td className="p-2">{r.subName}</td>
                    <td className="p-2">{r.subLocation}</td>
                    <td className="p-2" data-numeric>
                      {money(r.amount)}
                    </td>
                    <td className="p-2" data-numeric>
                      {r.actionDate}
                    </td>
                    <td className="p-2">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
