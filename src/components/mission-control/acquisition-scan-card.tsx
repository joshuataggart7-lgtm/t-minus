import { Link } from "@tanstack/react-router";
import { formatDate, type AcqMetrics, type MissionRow } from "@/lib/metrics";
import { daysBetween, todayISO } from "@/lib/intake";
import { cn } from "@/lib/utils";
import { missionControlState } from "./mission-status-board";
import { overviewCountdownView } from "./operational-state";

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
  const view = overviewCountdownView(metric);
  const state = missionControlState(metric);
  const acquisitionTitle = String(metric.acq.title ?? "").trim();
  const title = mission?.name || acquisitionTitle || "Untitled mission";
  const current = metric.phases.find((phase) => phase.status === "current");
  const holdDays =
    metric.clockState === "hold" && metric.blockerSince
      ? Math.max(0, daysBetween(metric.blockerSince, todayISO()))
      : null;
  const owner =
    metric.blockerOwner ?? String(metric.acq.co_name ?? mission?.program_owner ?? "Unassigned");
  const variance = metric.scheduleImpactDays;
  const blocking = metric.hold?.reason ?? (metric.blocker !== "None" ? metric.blocker : "None recorded");
  const phaseSegments = metric.phases.length ? metric.phases : [];

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
      <span className="mc-strip-accent" aria-hidden="true" />
      <span className="mc-strip-id" data-numeric>{metric.acq.acquisition_id}</span>
      <span className={cn("mc-state", `mc-state-${state.toLowerCase()}`)}>{state}</span>
      <div className="mc-strip-mission">
        <h3>{title}</h3>
        <p>{acquisitionTitle && acquisitionTitle !== title ? acquisitionTitle : owner}</p>
      </div>
      <div className={cn("mc-strip-clock", `mc-strip-clock-${state.toLowerCase()}`)}>
          {view.days === null ? (
            <strong>
              {view.mode === "stopped" ? "Stopped" : "Not started"}
            </strong>
          ) : (
            <strong data-numeric>
              {view.prefix}
              {view.days}
            </strong>
          )}
        <small>{view.badge ?? view.caption}</small>
      </div>
      <div className="mc-strip-phase">
        <strong>{metric.currentPhase ?? "Not started"}</strong>
        <span className="mc-mini-lifecycle" aria-hidden="true">
          {phaseSegments.map((phase) => (
            <i key={phase.phase} className={cn(phase.status === "complete" && "is-complete", phase.status === "current" && "is-current")} />
          ))}
        </span>
      </div>
      <div className="mc-strip-next">
        <small>Next gate</small>
        <strong>{metric.nextDecision}</strong>
      </div>
      <div className="mc-strip-variance" data-numeric>
        {variance === null || variance === 0 ? "—" : `${variance > 0 ? "+" : ""}${variance}d`}
      </div>

      <div className="mc-strip-disclosure">
        <span className="mc-preview-label">Preview</span>
        <dl>
          <div><dt>Evidence</dt><dd>{current ? `${current.docs.length} required items in ${current.phase}` : "No current phase evidence"}</dd></div>
          <div><dt>Blocking</dt><dd>{blocking}</dd></div>
          <div><dt>Next action</dt><dd>{metric.nextAction}</dd></div>
          <div><dt>{metric.awardDate ? "Actual award" : "Target award"}</dt><dd>{formatDate(metric.awardDate ?? (metric.acq.target_award_date ? String(metric.acq.target_award_date) : null))}</dd></div>
          <div><dt>{holdDays === null ? "Phase time" : "Hold duration"}</dt><dd data-numeric>{holdDays === null ? (current?.actual_days === null || current?.actual_days === undefined ? `${current?.planned_days ?? 0}d planned` : `${current.actual_days}/${current.planned_days}d`) : `${holdDays}d`}</dd></div>
          <div><dt>Last event</dt><dd>{latestEvent ? `${latestEvent.action} · ${formatDate(latestEvent.loggedAt.slice(0, 10))}` : "Not recorded"}</dd></div>
        </dl>
        <p className="sr-only">Open acquisition file</p>
      </div>
      <span className="mc-card-sequence" aria-hidden="true" data-numeric>
        {String(index).padStart(2, "0")}
      </span>
    </Link>
  );
}
