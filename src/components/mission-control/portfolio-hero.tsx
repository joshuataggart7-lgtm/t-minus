import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { AcquisitionScanCard } from "./acquisition-scan-card";
import { MissionStatusBoard } from "./mission-status-board";

export function PortfolioHero({ metrics, missions }: { metrics: AcqMetrics[]; missions: MissionRow[] }) {
  return (
    <section className="mc-command-field mc-grid mc-glow-rim" aria-label="Mission control portfolio">
      <div className="mc-command-beacon" aria-hidden="true" />
      <div className="relative z-10">
        <MissionStatusBoard metrics={metrics} />
        <div className="mt-8 flex items-end justify-between gap-4 border-b border-mc-line pb-3">
          <div>
            <p className="mc-label">Acquisition scan</p>
            <h2 className="mt-1 text-[22px] leading-7 font-medium text-mc-foreground">Priority mission flow</h2>
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-mc-muted sm:flex">
            <span className="mc-live-marker" aria-hidden="true" />
            Record-derived portfolio scan
          </div>
        </div>
        <div className="mt-4 grid gap-px overflow-hidden border border-mc-line bg-mc-line sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <AcquisitionScanCard
              key={metric.acq.acquisition_id}
              metric={metric}
              mission={missions.find((mission) => mission.mission_id === metric.acq.mission_id) ?? null}
              index={index + 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}