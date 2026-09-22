import { Link } from "@tanstack/react-router";
import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { countdownView } from "@/components/launch-countdown";
import { urgencyRank } from "@/lib/metrics";
import { McPanel } from "./primitives";
import { missionControlState } from "./mission-status-board";

export function AttentionSeverityList({ metrics, missions }: { metrics: AcqMetrics[]; missions: MissionRow[] }) {
  const rows = [...metrics]
    .filter((metric) => missionControlState(metric) === "HOLD" || missionControlState(metric) === "WATCH")
    .sort((a, b) => urgencyRank(a) - urgencyRank(b));

  return (
    <McPanel aria-labelledby="attention-heading" className="bg-background">
      <p className="mc-label-light">Decision pressure</p>
      <h2 id="attention-heading" className="mt-1 text-[18px] font-medium">Attention by severity</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted-foreground">No acquisition needs leadership attention.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {rows.map((metric) => {
            const view = countdownView(metric);
            const state = missionControlState(metric);
            const mission = missions.find((item) => item.mission_id === metric.acq.mission_id);
            return (
              <li key={metric.acq.acquisition_id}>
                <Link to="/files/$acquisitionId" params={{ acquisitionId: metric.acq.acquisition_id }} className="grid gap-2 py-3 hover:bg-muted/60 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:px-2">
                  <span className={`mc-severity mc-severity-${state.toLowerCase()}`}>{view.mode === "overdue" ? "OVERDUE" : state}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-foreground">{String(metric.acq.title ?? "").trim() || mission?.name || "Untitled acquisition"}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{metric.blocker !== "None" ? metric.blocker : metric.nextAction}{metric.blockerOwner ? ` · ${metric.blockerOwner}` : ""}</span>
                  </span>
                  <span className="text-[12px] text-muted-foreground sm:text-right" data-numeric>{metric.acq.acquisition_id} · {metric.currentPhase ?? "Not started"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </McPanel>
  );
}