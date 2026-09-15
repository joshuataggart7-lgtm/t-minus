import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  confirmResearchFindings,
  readMarketResearch,
  runMarketResearch,
  type ResearchLogEntry,
} from "@/lib/market-research.functions";
import { confirmSetAside } from "@/lib/set-aside-evidence.functions";
import { PROVENANCE, type ResearchFinding, type ResearchRespondent } from "@/lib/research-findings";

/** The respondents value is stored as JSON; render it as a table, never raw. */
function parseRespondents(value: string): ResearchRespondent[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as ResearchRespondent[]) : [];
  } catch {
    return [];
  }
}

/**
 * Market research evidence engine.
 *
 * The set-aside evidence search is its first step. Everything runs on the
 * contracting officer's click; the log shows every source, query, date and
 * result count, including the sources that returned nothing.
 */
export function MarketResearchEngine({
  acquisitionId,
  canWrite,
  onConfirmed,
}: {
  acquisitionId: string;
  canWrite: boolean;
  onConfirmed?: () => void;
}) {
  const [findings, setFindings] = useState<ResearchFinding[] | null>(null);
  const [log, setLog] = useState<ResearchLogEntry[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [setAside, setSetAside] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [latestRanAt, setLatestRanAt] = useState<string | null>(null);
  const [previousRuns, setPreviousRuns] = useState<
    { runId: string; ranAt: string; log: ResearchLogEntry[] }[]
  >([]);

  const read = useServerFn(readMarketResearch);
  const run = useServerFn(runMarketResearch);
  const confirm = useServerFn(confirmResearchFindings);
  const recordSetAside = useServerFn(confirmSetAside);

  useEffect(() => {
    let live = true;
    void read({ data: { acquisitionId } })
      .then((result) => {
        if (!live) return;
        setFindings(result.findings);
        setLog(result.log);
        setLatestRanAt(result.latestRanAt);
        setPreviousRuns(result.previousRuns);
      })
      .catch(() => {
        if (live) {
          setFindings([]);
          setLog([]);
        }
      });
    return () => {
      live = false;
    };
  }, [acquisitionId, read]);

  const search = useMutation({
    mutationFn: async () => run({ data: { acquisitionId } }),
    onSuccess: (result) => {
      setFindings(result.findings);
      // A run replaces the previous values; the earlier run moves to history.
      setPreviousRuns((runs) =>
        log && log.length && latestRanAt
          ? [{ runId: `${latestRanAt}`, ranAt: latestRanAt, log }, ...runs]
          : runs,
      );
      setLog(result.log);
      setLatestRanAt(result.ranAt);
      setSuggested(result.suggestedSetAside);
      setSummary(
        `${result.entityCount} registrants, ${result.noticeCount} notices, ${result.awardCount} prior awards. ${result.smallBusinessCount} small business under NAICS ${result.naics}; Rule of Two ${
          result.ruleOfTwoMet ? "met" : "not met"
        } (FAR 19.502-2).`,
      );
      setMessage(null);
    },
    onError: (e: Error) => setMessage(`The research did not run: ${e.message}. Try again.`),
  });

  const accept = useMutation({
    mutationFn: async (targets: string[]) => confirm({ data: { acquisitionId, targets } }),
    onSuccess: (result) => {
      setFindings((current) =>
        (current ?? []).map((f) =>
          result.confirmed.includes(f.target) ? { ...f, confirmed: true, confirmedBy: result.confirmedBy } : f,
        ),
      );
      setMessage(null);
    },
    onError: (e: Error) => setMessage(`The value was not confirmed: ${e.message}. Try again.`),
  });

  const decide = useMutation({
    mutationFn: async (decision: string) => recordSetAside({ data: { acquisitionId, decision } }),
    onSuccess: (result) => {
      setSetAside(result.decision);
      onConfirmed?.();
    },
    onError: (e: Error) => setMessage(`The decision was not saved: ${e.message}. Try again.`),
  });

  const unconfirmed = (findings ?? []).filter((f) => !f.confirmed).map((f) => f.target);

  return (
    <section aria-label="Market research" className="mt-3 max-w-[80ch] border border-border p-4">
      <h4 className="text-[15px] font-medium">Market research</h4>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Searches public sources for this record's NAICS code and place of performance: SAM.gov registrants and notices,
        USAspending awards, the SBA size standard, GSA CALC and eLibrary on FAR 8.4 buys, and prior T-Minus actions on
        the same code. It fills the market research memorandum, NF 1787 and NF 1787A. Every value stays marked with its
        source and date until you confirm it, and nothing runs on its own.
      </p>

      <button
        type="button"
        onClick={() => search.mutate()}
        disabled={search.isPending || !canWrite}
        className="mt-3 rounded-lg border border-input px-3 py-2 text-[15px] text-primary"
      >
        {search.isPending ? "Searching public sources" : "Run market research"}
      </button>

      {message ? (
        <p role="status" className="mt-3 text-[13px] text-[color:var(--status-at-risk,#C8321E)]">
          {message}
        </p>
      ) : null}
      {summary ? (
        <p role="status" className="mt-3 text-[15px] leading-[22px]">
          {summary}
        </p>
      ) : null}

      {findings === null || log === null ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Loading</p>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <h5 className="text-[15px] font-medium">
              Research log{latestRanAt ? `, most recent run ${latestRanAt.slice(0, 10)}` : ""}
            </h5>
            {log.length ? (
              <table className="mt-2 w-full border border-border text-[13px] leading-[18px]">
                <caption className="sr-only">Every source searched, with its query, date and result count</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-2">Source</th>
                    <th scope="col" className="p-2">Date</th>
                    <th scope="col" className="p-2">Results</th>
                    <th scope="col" className="p-2">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={`${l.source}-${i}`} className="border-b border-border align-top">
                      <td className="p-2">
                        {l.source}
                        <span className="block break-all text-muted-foreground">{l.query}</span>
                      </td>
                      <td className="p-2" data-numeric>{l.ranAt.slice(0, 10)}</td>
                      <td className="p-2" data-numeric>
                        {l.resultCount === null ? "Not run" : l.resultCount}
                      </td>
                      <td className="p-2">{l.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">
                The research has not been run on this file yet.
              </p>
            )}
            {previousRuns.length ? (
              <details className="mt-3 border border-border p-3">
                <summary className="cursor-pointer text-[15px]">
                  Previous runs ({previousRuns.length})
                </summary>
                <div className="mt-3 space-y-4">
                  {previousRuns.map((r) => (
                    <div key={r.runId}>
                      <p className="text-[13px] font-medium">Run of {r.ranAt.slice(0, 10)}</p>
                      <ul className="mt-1 space-y-1 text-[13px] leading-[18px] text-muted-foreground">
                        {r.log.map((l, i) => (
                          <li key={`${r.runId}-${i}`}>
                            {l.source}; {l.ranAt.slice(0, 10)};{" "}
                            {l.resultCount === null ? l.outcome : `${l.resultCount} results`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <div>
            <h5 className="text-[15px] font-medium">Values written to the memorandum and the forms</h5>
            {findings.length ? (
              <>
                <ul className="mt-2 space-y-3">
                  {findings.map((f) => (
                    <li key={f.target} className="border border-border p-3 text-[13px] leading-[18px]">
                      <p className="text-[15px] leading-[22px]">{f.label}</p>
                      {f.target === "nf1787a.respondents" ? (
                        <table className="mt-2 w-full border border-border text-[13px] leading-[18px]">
                          <caption className="sr-only">Respondents identified by the search</caption>
                          <thead>
                            <tr className="border-b border-border text-left">
                              <th scope="col" className="p-2">UEI</th>
                              <th scope="col" className="p-2">Name</th>
                              <th scope="col" className="p-2">Category</th>
                              <th scope="col" className="p-2">Assessment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parseRespondents(f.value).map((r, i) => (
                              <tr key={`${r.uei}-${i}`} className="border-b border-border align-top">
                                <td className="p-2" data-numeric>{r.uei}</td>
                                <td className="p-2">{r.name}</td>
                                <td className="p-2">{r.category}</td>
                                <td className="p-2">{r.assessment}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap">{f.value}</p>
                      )}
                      <p className="mt-1 text-muted-foreground">
                        {f.confirmed
                          ? `Confirmed${f.confirmedBy ? ` by ${f.confirmedBy}` : ""}`
                          : PROVENANCE(f)}
                      </p>
                      {canWrite && !f.confirmed ? (
                        <button
                          type="button"
                          disabled={accept.isPending}
                          onClick={() => accept.mutate([f.target])}
                          className="mt-2 rounded-lg border border-input px-3 py-2 text-[15px] text-primary"
                        >
                          Confirm this value
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {canWrite && unconfirmed.length ? (
                  <button
                    type="button"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate(unconfirmed)}
                    className="mt-3 rounded-lg border border-input px-3 py-2 text-[15px]"
                  >
                    Confirm every remaining value
                  </button>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">
                No value has been drafted yet. Run the research to fill the memorandum and the forms.
              </p>
            )}
          </div>

          {suggested ? (
            <div className="border border-border p-3">
              <h5 className="text-[15px] font-medium">Set-aside decision</h5>
              <p className="mt-1 text-[15px] leading-[22px]">{suggested}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Recorded on the file: {setAside ?? "unchanged until you confirm"}
              </p>
              {canWrite ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate(suggested)}
                    className="rounded-lg border border-input px-3 py-2 text-[15px] text-primary"
                  >
                    Confirm the suggested decision
                  </button>
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate("No set-aside; unrestricted")}
                    className="rounded-lg border border-input px-3 py-2 text-[15px]"
                  >
                    Record no set-aside instead
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-muted-foreground">The contracting officer confirms this decision.</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
