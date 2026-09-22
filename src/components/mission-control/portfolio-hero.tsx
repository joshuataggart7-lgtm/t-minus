import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { AcquisitionScanCard } from "./acquisition-scan-card";
import { MissionStatusBoard } from "./mission-status-board";

export function PortfolioHero({ metrics, missions }: { metrics: AcqMetrics[]; missions: MissionRow[] }) {
  return (
    <section className="mc-command-field mc-grid mc-glow-rim" aria-label="Mission control portfolio">
      <div className="relative z-10">
        <MissionStatusBoard metrics={metrics} />
        <div className="mt-7 flex items-end justify-between gap-4 border-b border-mc-line pb-3">
          <div>
            <p className="mc-label">Acquisition scan</p>
            <h2 className="mt-1 text-[18px] font-medium text-mc-foreground">Priority mission flow</h2>
          </div>
          <p className="hidden max-w-[40ch] text-right text-[12px] text-mc-muted sm:block">
            Current phase, countdown, and next required action from the acquisition record.
          </p>
        </div>
        <div className="mt-4 grid gap-px overflow-hidden border border-mc-line bg-mc-line sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <AcquisitionScanCard
              key={metric.acq.acquisition_id}
              metric={metric}
              mission={missions.find((mission) => mission.mission_id === metric.acq.mission_id) ?? null}
            />
          ))}
        </div>
      </div>
    </section>
  );
}