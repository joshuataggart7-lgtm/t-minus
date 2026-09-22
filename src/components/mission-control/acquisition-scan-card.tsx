import { Link } from "@tanstack/react-router";
import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { countdownView } from "@/components/launch-countdown";
import { cn } from "@/lib/utils";
import { missionControlState } from "./mission-status-board";

export function AcquisitionScanCard({ metric, mission }: { metric: AcqMetrics; mission: MissionRow | null }) {
  const view = countdownView(metric);
  const state = missionControlState(metric);
  const acquisitionTitle = String(metric.acq.title ?? "").trim();
  const title = mission?.name || acquisitionTitle || "Untitled mission";
  const statusLine = metric.hold
    ? `${metric.hold.reason} · ${metric.hold.owner}`
    : metric.blocker !== "None"
      ? metric.blocker
      : metric.nextAction;

  return (
    <Link
      to="/files/$acquisitionId"
      params={{ acquisitionId: metric.acq.acquisition_id }}
      className={cn("mc-scan-card group", view.mode === "hold" && "mc-scan-card-hold")}
      aria-label={`${title}, ${state}, ${view.caption}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[15px] leading-5 font-medium text-mc-foreground group-hover:text-accent-cyan">
            {title}
          </h3>
          <p className="mt-1 truncate text-[11px] text-mc-muted" data-numeric>
            {metric.acq.acquisition_id}{acquisitionTitle && acquisitionTitle !== title ? ` · ${acquisitionTitle}` : ""}
          </p>
        </div>
        <span className={cn("mc-state", `mc-state-${state.toLowerCase()}`)}>{state}</span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          {view.days === null ? (
            <p className="text-[20px] font-semibold text-mc-muted">{view.mode === "stopped" ? "Stopped" : "Not started"}</p>
          ) : (
            <p className={cn("mc-countdown", view.tone === "red" && "text-atrisk", view.tone === "muted" && "text-mc-muted")} data-numeric>
              {view.prefix}{view.days}
            </p>
          )}
          <p className="mt-1 text-[11px] text-mc-muted">{view.caption}</p>
        </div>
        {view.badge ? <span className={cn("mc-badge", view.mode === "hold" && "mc-badge-hold", view.mode === "overdue" && "mc-badge-overdue")}>{view.badge}</span> : null}
      </div>

      <div className="mt-4 border-t border-mc-line pt-3">
        <p className="mc-label">{metric.currentPhase ?? "Not started"}</p>
        <p className="mt-1 truncate text-[12px] text-mc-muted" title={statusLine}>{statusLine}</p>
      </div>
    </Link>
  );
}