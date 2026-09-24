import { useState } from "react";
import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { ExecutiveExceptions } from "./executive-exceptions";
import { ReadinessQueue } from "./readiness-queue";
import type { MissionControlState } from "./mission-status-board";
import { AcquisitionScanCard } from "./acquisition-scan-card";
import { MissionStatusBoard } from "./mission-status-board";
import { MissionTrajectory } from "./mission-trajectory";
import { NovaProvenance } from "./nova-provenance";
import { StateContractPanel } from "./state-contract";

type LatestEvent = { action: string; loggedAt: string };

export function PortfolioHero({
  metrics,
  missions,
  latestEvents,
  watchWindowDays,
  onWatchWindowChange,
}: {
  watchWindowDays: number;
  onWatchWindowChange: (days: number) => void;
  metrics: AcqMetrics[];
  missions: MissionRow[];
  latestEvents: Record<string, LatestEvent>;
}) {
  const [filter, setFilter] = useState<MissionControlState | null>(null);
  return (
    <section className="mc-lock-d" aria-label="Mission control portfolio">
      <div className="mc-command-field mc-grid mc-glow-rim">
        <div className="mc-command-beacon" aria-hidden="true" />
        <div className="relative z-10">
        <MissionStatusBoard metrics={metrics} active={filter} onSelect={setFilter} />
        <MissionTrajectory metrics={metrics} missions={missions} />
          <ExecutiveExceptions metrics={metrics} />
          <NovaProvenance />
        </div>
      </div>
      <div className="mc-scan-surface">
        <StateContractPanel />
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
        {filter ? (
          <ReadinessQueue
            state={filter}
            metrics={metrics}
            missions={missions}
            watchWindowDays={watchWindowDays}
            onWatchWindowChange={onWatchWindowChange}
            onClear={() => setFilter(null)}
          />
        ) : null}
        <div className="mc-strip-table" role="table" aria-label="Priority acquisitions">
          <div className="mc-strip-head" role="row">
            <span>ID</span><span>Status</span><span>Mission</span><span>Clock</span><span>Phase</span><span>Next</span><span>Var</span>
          </div>
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
        <p className="mc-scan-consistency">
          <span className="mc-recon-chip is-light">RULE</span>
          The same recorded facts drive this scan, the file countdown and executive exceptions.
        </p>
      </div>
    </section>
  );
}
