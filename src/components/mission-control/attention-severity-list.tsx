import { Link } from "@tanstack/react-router";
import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { formatDate, urgencyRank } from "@/lib/metrics";
import { daysBetween, todayISO } from "@/lib/intake";
import { McPanel } from "./primitives";
import { missionControlState } from "./mission-status-board";
import { overviewCountdownView } from "./operational-state";

export function AttentionSeverityList({ metrics, missions }: { metrics: AcqMetrics[]; missions: MissionRow[] }) {
  const rows = [...metrics]
    .filter((metric) => missionControlState(metric) === "HOLD" || missionControlState(metric) === "WATCH")
    .sort((a, b) => urgencyRank(a) - urgencyRank(b));

  return (
    <McPanel aria-labelledby="attention-heading" className="mc-ops-panel mc-anomaly-panel">
      <p className="mc-label">Anomaly rail</p>
      <h2 id="attention-heading" className="mc-heading">Conditions requiring attention</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-mc-muted">No acquisition needs leadership attention.</p>
      ) : (
        <ul className="mc-anomaly-list">
          {rows.map((metric) => {
            const view = overviewCountdownView(metric);
            const state = missionControlState(metric);
            const mission = missions.find((item) => item.mission_id === metric.acq.mission_id);
            const daysInCondition = metric.blockerSince ? Math.max(0, daysBetween(metric.blockerSince, todayISO())) : null;
            const condition = metric.blocker !== "None" ? metric.blocker : metric.nextAction;
            return (
              <li key={metric.acq.acquisition_id}>
                <Link to="/files/$acquisitionId" params={{ acquisitionId: metric.acq.acquisition_id }} className="mc-anomaly-row">
                  <span className={`mc-severity mc-severity-${state.toLowerCase()}`}>{view.mode === "overdue" ? "OVERDUE" : state}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-mc-foreground" title={mission?.name || String(metric.acq.title ?? "").trim() || "Untitled acquisition"}>{mission?.name || String(metric.acq.title ?? "").trim() || "Untitled acquisition"}</span>
                    <span className="block truncate text-[12px] text-mc-muted" title={condition}>{condition}</span>
                  </span>
                  <span className="mc-anomaly-data"><small>Time in condition</small><strong data-numeric>{daysInCondition === null ? "Not recorded" : `${daysInCondition}d`}</strong></span>
                  <span className="mc-anomaly-data"><small>Phase</small><strong>{metric.currentPhase ?? "Not started"}</strong></span>
                  <span className="mc-anomaly-data"><small>Next gate</small><strong title={`${metric.nextAction}${metric.nextDecisionDate ? ` · ${formatDate(metric.nextDecisionDate)}` : ""}`}>{metric.nextAction}{metric.nextDecisionDate ? ` · ${formatDate(metric.nextDecisionDate)}` : ""}</strong></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </McPanel>
  );
}