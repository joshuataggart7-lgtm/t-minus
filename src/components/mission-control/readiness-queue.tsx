import { useNavigate } from "@tanstack/react-router";
import { formatDate, type AcqMetrics, type MissionRow } from "@/lib/metrics";
import { todayISO } from "@/lib/intake";
import type { MissionControlState } from "./mission-status-board";
import { sortHoldQueue, WATCH_RULES, type ReadinessExplanation } from "./readiness";

type Row = AcqMetrics & { readiness: ReadinessExplanation };

const NR = "Not recorded";

function daysLabel(m: AcqMetrics) {
  if (m.awardDate) return m.daysSinceAward !== null ? `T+${m.daysSinceAward} since award` : NR;
  if (m.daysToAward === null) return NR;
  return m.daysToAward < 0 ? `${Math.abs(m.daysToAward)} days past target` : `T−${m.daysToAward} to award`;
}

export function ReadinessQueue({
  state,
  metrics,
  missions,
  watchWindowDays,
  onWatchWindowChange,
  onClear,
}: {
  state: MissionControlState;
  metrics: AcqMetrics[];
  missions: MissionRow[];
  watchWindowDays: number;
  onWatchWindowChange: (days: number) => void;
  onClear: () => void;
}) {
  const navigate = useNavigate();
  const today = todayISO();
  const rows = (metrics as Row[]).filter((m) => m.readiness?.state === state);
  const sorted =
    state === "HOLD"
      ? sortHoldQueue(rows, today)
      : [...rows].sort((a, b) => (a.daysToAward ?? 1e9) - (b.daysToAward ?? 1e9));
  const isHold = state === "HOLD";
  const open = (id: string) => navigate({ to: "/files/$acquisitionId", params: { acquisitionId: id } });

  return (
    <section className="mc-readiness-queue" aria-labelledby="readiness-queue-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 id="readiness-queue-heading" className="text-[18px] leading-6 font-medium text-foreground">
            {isHold ? "Leadership exception queue" : `${state} acquisitions`}
            <span className="ml-2 text-muted-foreground" data-numeric>({sorted.length})</span>
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {isHold
              ? "Sorted by overdue target award, then nearest target award, then longest blocked."
              : "Each row lists the rule that placed it here. Select a row to open the file."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {state === "WATCH" ? (
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              Watch window (days)
              <input
                type="number"
                min={0}
                max={365}
                value={watchWindowDays}
                onChange={(e) => onWatchWindowChange(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-foreground"
                data-numeric
              />
            </label>
          ) : null}
          <button type="button" onClick={onClear} className="rounded-md border border-border px-3 py-1 text-[13px] text-primary hover:bg-muted">
            Clear filter
          </button>
        </div>
      </div>

      {state === "WATCH" ? (
        <details className="mt-3 text-[13px] text-muted-foreground">
          <summary className="cursor-pointer">Watch rules</summary>
          <ul className="mt-2 list-disc pl-5">
            {WATCH_RULES.map((r) => (
              <li key={r.label}>{r.label}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {sorted.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">No acquisitions are in {state}.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-[13px] leading-[18px]" data-numeric>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">Acq #</th>
                <th className="p-2 font-medium">Title</th>
                <th className="p-2 font-medium">Current gate</th>
                <th className="p-2 font-medium">{isHold ? "Next-action owner" : "CO / owner"}</th>
                <th className="p-2 font-medium">Target award</th>
                <th className="p-2 font-medium">Days to / since</th>
                <th className="p-2 font-medium">Readiness</th>
                <th className="p-2 font-medium">{isHold ? "Blocked because" : "Reason"}</th>
                <th className="p-2 font-medium">Missing evidence</th>
                <th className="p-2 font-medium">{isHold ? "Time blocked" : "Age in gate"}</th>
                <th className="p-2 font-medium">Next required action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const r = m.readiness;
                const mission = missions.find((x) => x.mission_id === m.acq.mission_id);
                const title = String(m.acq.title ?? "").trim() || mission?.name || NR;
                const id = m.acq.acquisition_id;
                return (
                  <tr
                    key={id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open acquisition file ${id}`}
                    onClick={() => open(id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(id);
                      }
                    }}
                    className="cursor-pointer border-b border-border align-top hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <td className="p-2 font-medium text-primary">{id}</td>
                    <td className="p-2 text-foreground">{title}</td>
                    <td className="p-2">{m.currentPhase ?? NR}</td>
                    <td className="p-2">{isHold ? r.nextOwner : String(m.acq.co_name ?? "").trim() || r.nextOwner}</td>
                    <td className="p-2">
                      {r.targetAward ? formatDate(r.targetAward) : NR}
                      {isHold && r.targetAtRisk ? <span className="block text-destructive">Target award at risk</span> : null}
                    </td>
                    <td className="p-2">{daysLabel(m)}</td>
                    <td className="p-2 font-medium">{r.state}</td>
                    <td className="p-2">
                      {r.state === "GO" ? (
                        "No watch rule met"
                      ) : (
                        <ul className="space-y-0.5">
                          {r.triggers.map((t) => (
                            <li key={t.code + t.text}>{t.text}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="p-2">
                      {r.missingEvidence.length}
                      {r.missingEvidence.length ? (
                        <span className="block text-muted-foreground">{r.missingEvidence.join(", ")}</span>
                      ) : null}
                    </td>
                    <td className="p-2">
                      {isHold
                        ? r.blockedDays !== null ? `${r.blockedDays} days` : NR
                        : r.gateAgeDays !== null ? `${r.gateAgeDays} days` : NR}
                    </td>
                    <td className="p-2">{r.nextAction}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
