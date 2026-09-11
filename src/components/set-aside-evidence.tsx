import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  runSetAsideEvidence,
  confirmSetAside,
  type SetAsideEvidence,
} from "@/lib/set-aside-evidence.functions";

function money(n: number | null) {
  if (n === null) return "Not recorded";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function SetAsideEvidencePanel({
  acquisitionId,
  canWrite,
  onConfirmed,
}: {
  acquisitionId: string;
  canWrite: boolean;
  onConfirmed?: () => void;
}) {
  const [view, setView] = useState<SetAsideEvidence | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const run = useServerFn(runSetAsideEvidence);
  const confirm = useServerFn(confirmSetAside);

  const research = useMutation({
    mutationFn: async () => run({ data: { acquisitionId } }),
    onSuccess: (result) => {
      setView(result);
      setMessage(null);
    },
    onError: (e: Error) => setMessage(`The search did not run: ${e.message}. Try again.`),
  });

  const decide = useMutation({
    mutationFn: async (decision: string) => confirm({ data: { acquisitionId, decision } }),
    onSuccess: (result) => {
      setConfirmed(result.decision);
      setMessage(null);
      onConfirmed?.();
    },
    onError: (e: Error) => setMessage(`The decision was not saved: ${e.message}. Try again.`),
  });

  return (
    <section aria-label="Set-aside evidence" className="mt-3 max-w-[80ch] border border-border p-4">
      <h4 className="text-[15px] font-medium">Set-aside evidence</h4>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Searches SAM.gov for registered entities under this record's NAICS code and place of performance, with their
        small business flag, and recent subaward history for the same code. The Rule of Two evidence is assembled from
        those results; the contracting officer confirms the decision (FAR 19.502-2).
      </p>

      <button
        type="button"
        onClick={() => research.mutate()}
        disabled={research.isPending}
        className="mt-3 rounded-lg border border-input px-3 py-2 text-[15px] text-primary"
      >
        {research.isPending ? "Searching SAM.gov" : "Run the set-aside evidence search"}
      </button>

      {message ? (
        <p role="status" className="mt-3 text-[13px] text-[color:var(--status-at-risk,#C8321E)]">
          {message}
        </p>
      ) : null}

      {view ? (
        <div className="mt-4 space-y-5">
          <div className="text-[13px] leading-[18px] text-muted-foreground">
            <p>
              NAICS {view.naicsCode} · place of performance {view.placeOfPerformance}
              {view.stateCode ? ` · searched in ${view.stateCode}` : ""} · estimated value{" "}
              <span data-numeric>{money(view.estimatedValue)}</span>
            </p>
            <p>
              {view.entitiesSourceLabel} · {view.subawardsSourceLabel}
            </p>
            {view.providerError ? <p className="mt-1">{view.providerError}</p> : null}
          </div>

          <div>
            <h5 className="text-[15px] font-medium">Registered entities under this NAICS</h5>
            <table className="mt-2 w-full border border-border text-[13px] leading-[18px]">
              <caption className="sr-only">Entities returned by SAM.gov with their small business flag</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-2">Legal name</th>
                  <th scope="col" className="p-2">UEI</th>
                  <th scope="col" className="p-2">State</th>
                  <th scope="col" className="p-2">Small business flag</th>
                  <th scope="col" className="p-2">Reported types</th>
                </tr>
              </thead>
              <tbody>
                {view.entities.map((e) => (
                  <tr key={`${e.uei}-${e.legalName}`} className="border-b border-border">
                    <td className="p-2">{e.legalName}</td>
                    <td className="p-2" data-numeric>{e.uei}</td>
                    <td className="p-2">{e.state}</td>
                    <td className="p-2">{e.smallBusinessLabel}</td>
                    <td className="p-2">{e.socioeconomic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h5 className="text-[15px] font-medium">Subaward history under this NAICS</h5>
            {view.subawards.length ? (
              <table className="mt-2 w-full border border-border text-[13px] leading-[18px]">
                <caption className="sr-only">Recent subawards reported under this NAICS code</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-2">Prime</th>
                    <th scope="col" className="p-2">Subawardee</th>
                    <th scope="col" className="p-2">Location</th>
                    <th scope="col" className="p-2">Amount</th>
                    <th scope="col" className="p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {view.subawards.map((s, i) => (
                    <tr key={`${s.subName}-${i}`} className="border-b border-border">
                      <td className="p-2">{s.primeName}</td>
                      <td className="p-2">{s.subName}</td>
                      <td className="p-2">{s.subLocation}</td>
                      <td className="p-2" data-numeric>{money(s.amount)}</td>
                      <td className="p-2" data-numeric>{s.actionDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">No subaward records were returned.</p>
            )}
          </div>

          <div className="border border-border p-3">
            <h5 className="text-[15px] font-medium">Rule of Two</h5>
            <p className="mt-1 text-[15px] leading-[22px]">
              {view.ruleOfTwoMet ? "Met" : "Not met"}: <span data-numeric>{view.smallBusinessCount}</span> small
              business{view.smallBusinessCount === 1 ? "" : "es"} found. {view.suggestionReason}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Simplified acquisition threshold{" "}
              <span data-numeric>{money(view.simplifiedThreshold)}</span> · {view.simplifiedThresholdCitation}
            </p>
            <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
              {view.citations.map((c) => (
                <li key={c.citation}>
                  {c.citation} ({c.tier}): {c.note}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-[15px] font-medium">Suggested decision</h5>
            <p className="mt-1 text-[15px] leading-[22px]">{view.suggestedDecision}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Recorded set-aside on the file: {confirmed ?? view.currentSetAside}
            </p>
            {canWrite ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate(view.suggestedDecision)}
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
              <p className="mt-2 text-[13px] text-muted-foreground">
                The contracting officer confirms this decision.
              </p>
            )}
            {confirmed ? (
              <p role="status" className="mt-2 text-[13px]">
                Confirmed and logged: {confirmed}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
