import { Link } from "@tanstack/react-router";
import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { missionControlState } from "./mission-status-board";

const LIFECYCLE = [
  { label: "Requirement / Intake", phases: ["Intake"] },
  { label: "Market Research", phases: ["Market Research"] },
  { label: "Strategy", phases: ["JOFOC", "Fair Opportunity"] },
  { label: "Solicitation", phases: ["Synopsis", "Solicitation/Quote"] },
  { label: "Evaluation", phases: ["Technical Evaluation"] },
  { label: "Negotiation", phases: ["Price Reasonableness", "Responsibility Check"] },
  { label: "Go / No-go", phases: ["Go/No-go Poll"] },
  { label: "Award", phases: ["Award", "FPDS-NG Report"] },
  { label: "Administration", phases: ["Administration"] },
  { label: "Closeout", phases: ["Closeout"] },
] as const;

function lifecycleIndex(metric: AcqMetrics) {
  return LIFECYCLE.findIndex((stage) => stage.phases.some((phase) => phase === metric.currentPhase));
}

export function MissionTrajectory({ metrics, missions }: { metrics: AcqMetrics[]; missions: MissionRow[] }) {
  const rows = [...metrics].sort((a, b) => {
    const aIndex = lifecycleIndex(a);
    const bIndex = lifecycleIndex(b);
    return bIndex - aIndex;
  });

  return (
    <section className="mc-trajectory" aria-labelledby="trajectory-heading">
      <div className="mc-section-heading">
        <div>
          <p className="mc-label">Mission trajectory</p>
          <h2 id="trajectory-heading" className="mc-heading">Portfolio flight path</h2>
        </div>
        <p className="mc-section-note">Recorded phases grouped into the mission lifecycle</p>
      </div>

      <div className="mc-trajectory-scroll">
        <div className="mc-trajectory-grid">
          <div className="mc-trajectory-corner mc-label">Mission</div>
          {LIFECYCLE.map((stage) => <div key={stage.label} className="mc-trajectory-phase">{stage.label}</div>)}
          {rows.map((metric) => {
            const mission = missions.find((item) => item.mission_id === metric.acq.mission_id);
            const state = missionControlState(metric);
            return (
              <Link
                key={metric.acq.acquisition_id}
                to="/files/$acquisitionId"
                params={{ acquisitionId: metric.acq.acquisition_id }}
                className="contents group"
              >
                <span className="mc-trajectory-name">
                  <strong>{mission?.name || String(metric.acq.title ?? "Untitled mission")}</strong>
                  <span data-numeric>{metric.acq.acquisition_id} · {state}</span>
                </span>
                {LIFECYCLE.map((stage) => {
                  const groupedPhases = metric.phases.filter((item) => stage.phases.some((phase) => phase === item.phase));
                  const active = groupedPhases.some((phase) => phase.status === "current");
                  const complete = groupedPhases.length > 0 && groupedPhases.every((phase) => phase.status === "complete");
                  const recordedNames = groupedPhases.map((phase) => phase.phase).join(", ");
                  return (
                    <span
                      key={stage.label}
                      title={recordedNames || `${stage.label}: no phase recorded for this acquisition type`}
                      className={cn("mc-trajectory-cell", active && `mc-trajectory-current mc-trajectory-${state.toLowerCase()}`)}
                    >
                      <span className={cn("mc-trajectory-node", complete && "mc-trajectory-complete", active && "mc-trajectory-active")} />
                    </span>
                  );
                })}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}