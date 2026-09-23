import { Link } from "@tanstack/react-router";
import { formatDate, type AcqMetrics, type MissionRow } from "@/lib/metrics";
import { daysBetween, todayISO } from "@/lib/intake";
import { countdownView } from "@/components/launch-countdown";
import { cn } from "@/lib/utils";
import { missionControlState } from "./mission-status-board";

export function AcquisitionScanCard({
  metric,
  mission,
  index,
  latestEvent,
}: {
  metric: AcqMetrics;
  mission: MissionRow | null;
  index: number;
  latestEvent: { action: string; loggedAt: string } | null;
}) {
  const view = countdownView(metric);
  const state = missionControlState(metric);
  const acquisitionTitle = String(metric.acq.title ?? "").trim();
  const title = mission?.name || acquisitionTitle || "Untitled mission";
  const statusLine = metric.hold
    ? `${metric.hold.reason} · ${metric.hold.owner}`
    : metric.blocker !== "None"
      ? metric.blocker
      : metric.nextAction;
  const current = metric.phases.find((phase) => phase.status === "current");
  const holdDays =
    metric.clockState === "hold" && metric.blockerSince
      ? Math.max(0, daysBetween(metric.blockerSince, todayISO()))
      : null;
  const owner =
    metric.blockerOwner ?? String(metric.acq.co_name ?? mission?.program_owner ?? "Unassigned");
  const variance = metric.scheduleImpactDays;

  return (
    <Link
      to="/files/$acquisitionId"
      params={{ acquisitionId: metric.acq.acquisition_id }}
      className={cn(
        "mc-scan-card group",
        `mc-scan-card-${state.toLowerCase()}`,
        view.mode === "hold" && "mc-scan-card-hold",
      )}
      aria-label={`${title}, ${state}, ${view.caption}`}
    >
      <span className="mc-card-sequence" aria-hidden="true" data-numeric>
        {String(index).padStart(2, "0")}
      </span>
      <div className="mc-card-primary flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[17px] leading-6 font-semibold text-mc-foreground group-hover:text-accent-cyan">
            {title}
          </h3>
          <p className="mt-1 truncate text-[11px] text-mc-muted" data-numeric>
            {metric.acq.acquisition_id}
            {acquisitionTitle && acquisitionTitle !== title ? ` · ${acquisitionTitle}` : ""}
          </p>
        </div>
        <span className={cn("mc-state", `mc-state-${state.toLowerCase()}`)}>{state}</span>
      </div>

      <div className="mc-card-clock mt-6 flex items-end justify-between gap-3">
        <div>
          {view.days === null ? (
            <p className="text-[20px] font-semibold text-mc-muted">
              {view.mode === "stopped" ? "Stopped" : "Not started"}
            </p>
          ) : (
            <p
              className={cn(
                "mc-countdown",
                view.tone === "red" && "text-atrisk",
                view.tone === "muted" && "text-mc-muted",
              )}
              data-numeric
            >
              {view.prefix}
              {view.days}
            </p>
          )}
          <p className="mt-1 text-[11px] text-mc-muted">{view.caption}</p>
        </div>
        {view.badge ? (
          <span
            className={cn(
              "mc-badge",
              view.mode === "hold" && "mc-badge-hold",
              view.mode === "overdue" && "mc-badge-overdue",
            )}
          >
            {view.badge}
          </span>
        ) : null}
      </div>

      <div className="mc-card-phase mt-4 border-t border-mc-line pt-3">
        <div className="flex items-center gap-2">
          <span className="mc-phase-rule" aria-hidden="true" />
          <p className="mc-card-phase-name">{metric.currentPhase ?? "Not started"}</p>
        </div>
        <p className="mt-1 truncate text-[12px] text-mc-muted" title={statusLine}>
          {statusLine}
        </p>
      </div>

      <div className="mc-card-disclosure">
        <p>Work · audit detail</p>
        <dl className="mc-microgrid">
        <div>
          <dt>Target award</dt>
          <dd>
            {formatDate(metric.acq.target_award_date ? String(metric.acq.target_award_date) : null)}
          </dd>
        </div>
        <div>
          <dt>{holdDays === null ? "Phase time" : "Hold duration"}</dt>
          <dd data-numeric>
            {holdDays === null
              ? current?.actual_days === null || current?.actual_days === undefined
                ? `${current?.planned_days ?? 0}d planned`
                : `${current.actual_days}/${current.planned_days}d`
              : `${holdDays}d`}
          </dd>
        </div>
        <div>
          <dt>Variance</dt>
          <dd data-numeric>
            {variance === null ? "No mission date" : `${variance >= 0 ? "+" : ""}${variance}d`}
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd title={owner}>{owner}</dd>
        </div>
        <div>
          <dt>Next gate</dt>
          <dd title={metric.nextDecision}>
            {metric.nextDecision}
            {metric.nextDecisionDate ? ` · ${formatDate(metric.nextDecisionDate)}` : ""}
          </dd>
        </div>
        <div>
          <dt>Last event</dt>
          <dd title={latestEvent?.action}>
            {latestEvent
              ? `${latestEvent.action} · ${formatDate(latestEvent.loggedAt.slice(0, 10))}`
              : "Not recorded"}
          </dd>
        </div>
        </dl>
      </div>
    </Link>
  );
}
