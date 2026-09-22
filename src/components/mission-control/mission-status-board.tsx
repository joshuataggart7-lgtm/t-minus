import type { AcqMetrics } from "@/lib/metrics";
import { countdownView } from "@/components/launch-countdown";
import { McStatBlock } from "./primitives";

export type MissionControlState = "GO" | "WATCH" | "HOLD" | "LAUNCHED";

export function missionControlState(metric: AcqMetrics): MissionControlState {
  const view = countdownView(metric);
  if (view.mode === "launched") return "LAUNCHED";
  if (view.mode === "hold" || (metric.status === "At Risk" && metric.clockState === "hold")) return "HOLD";
  if (metric.status === "Needs Attention" || metric.status === "At Risk" || view.mode === "forecast" || view.mode === "overdue") return "WATCH";
  return "GO";
}

export function MissionStatusBoard({ metrics }: { metrics: AcqMetrics[] }) {
  const counts = metrics.reduce<Record<MissionControlState, number>>(
    (current, metric) => {
      current[missionControlState(metric)] += 1;
      return current;
    },
    { GO: 0, WATCH: 0, HOLD: 0, LAUNCHED: 0 },
  );

  return (
    <section aria-labelledby="mission-status-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="mc-label">Portfolio state</p>
          <h2 id="mission-status-heading" className="mt-1 text-[18px] font-medium text-mc-foreground">
            Mission status board
          </h2>
        </div>
        <p className="text-[12px] text-mc-muted" data-numeric>{metrics.length} acquisition files</p>
      </div>
      <div className="grid grid-cols-2 border-y border-mc-line sm:grid-cols-4">
        <McStatBlock label="GO" value={counts.GO} tone="green" />
        <McStatBlock label="WATCH" value={counts.WATCH} tone="amber" />
        <McStatBlock label="HOLD" value={counts.HOLD} tone="red" />
        <McStatBlock label="LAUNCHED" value={counts.LAUNCHED} tone="cyan" />
      </div>
    </section>
  );
}