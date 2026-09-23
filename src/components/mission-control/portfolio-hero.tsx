import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { AcquisitionScanCard } from "./acquisition-scan-card";
import { MissionStatusBoard } from "./mission-status-board";
import { MissionTrajectory } from "./mission-trajectory";
import { Nova } from "@/components/nova";

type LatestEvent = { action: string; loggedAt: string };

export function PortfolioHero({
  metrics,
  missions,
  latestEvents,
}: {
  metrics: AcqMetrics[];
  missions: MissionRow[];
  latestEvents: Record<string, LatestEvent>;
}) {
  return (
    <section className="mc-lock-d" aria-label="Mission control portfolio">
      <div className="mc-command-field mc-grid mc-glow-rim">
        <div className="mc-command-beacon" aria-hidden="true" />
        <div className="relative z-10">
        <MissionStatusBoard metrics={metrics} />
        <MissionTrajectory metrics={metrics} missions={missions} />
          <div className="mc-nova-strip">
            <div>
              <p className="mc-label">Nova attention</p>
              <p>Ask against loaded rules and records. Drafts are never written to the file.</p>
            </div>
            <Nova className="mc-nova-action" />
          </div>
        </div>
      </div>
      <div className="mc-scan-surface">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mc-label-light">Acquisition scan</p>
            <h2 className="mt-1 text-[22px] leading-7 font-medium text-foreground">
              Priority mission flow
            </h2>
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-muted-foreground sm:flex">
            <span className="mc-live-marker" aria-hidden="true" />
            Record-derived portfolio scan
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric, index) => (
            <AcquisitionScanCard
              key={metric.acq.acquisition_id}
              metric={metric}
              mission={
                missions.find((mission) => mission.mission_id === metric.acq.mission_id) ?? null
              }
              index={index + 1}
              latestEvent={latestEvents[metric.acq.acquisition_id] ?? null}
            />
          ))}
        </div>
        </div>
      </div>
    </section>
  );
}
