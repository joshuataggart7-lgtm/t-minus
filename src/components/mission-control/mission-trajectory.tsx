import { Link } from "@tanstack/react-router";
import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { missionControlState } from "./mission-status-board";

export function MissionTrajectory({ metrics, missions }: { metrics: AcqMetrics[]; missions: MissionRow[] }) {
  const phaseOrder = new Map<string, number>();
  for (const metric of metrics) {
    for (const phase of metric.phases) {
      const current = phaseOrder.get(phase.phase);
      if (current === undefined || phase.order < current) phaseOrder.set(phase.phase, phase.order);
    }
  }
  const phases = [...phaseOrder].sort((a, b) => a[1] - b[1]).map(([phase]) => phase);
  const rows = [...metrics].sort((a, b) => {
    const aIndex = phases.indexOf(a.currentPhase ?? "");
    const bIndex = phases.indexOf(b.currentPhase ?? "");
    return bIndex - aIndex;
  });

  return (
    <section className="mc-trajectory" aria-labelledby="trajectory-heading">
      <div className="mc-section-heading">
        <div>
          <p className="mc-label">Mission trajectory</p>
          <h2 id="trajectory-heading" className="mc-heading">Portfolio flight path</h2>
        </div>
        <p className="mc-section-note">Recorded lifecycle position</p>
      </div>

      <div className="mc-trajectory-scroll">
        <div className="mc-trajectory-grid" style={{ gridTemplateColumns: `minmax(13rem, 1.35fr) repeat(${Math.max(phases.length, 1)}, minmax(4.5rem, 1fr))` }}>
          <div className="mc-trajectory-corner mc-label">Mission</div>
          {phases.map((phase) => <div key={phase} className="mc-trajectory-phase">{phase}</div>)}
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
                {phases.map((phaseName) => {
                  const phase = metric.phases.find((item) => item.phase === phaseName);
                  const active = phase?.status === "current";
                  return (
                    <span key={phaseName} className={cn("mc-trajectory-cell", active && `mc-trajectory-current mc-trajectory-${state.toLowerCase()}`)}>
                      <span className={cn("mc-trajectory-node", phase?.status === "complete" && "mc-trajectory-complete", active && "mc-trajectory-active")} />
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