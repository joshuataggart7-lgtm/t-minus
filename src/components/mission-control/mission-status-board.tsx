import type { AcqMetrics } from "@/lib/metrics";
import { McStatBlock, type MissionReadiness } from "./primitives";
import { overviewCountdownView } from "./operational-state";
import type { ReadinessExplanation } from "./readiness";
import { StateModelNote } from "./state-contract";

export type MissionControlState = MissionReadiness;

export function missionControlState(metric: AcqMetrics): MissionControlState {
  const derived = (metric as AcqMetrics & { readiness?: ReadinessExplanation }).readiness;
  if (derived) return derived.state;
  const view = overviewCountdownView(metric);
  if (view.mode === "launched") return "LAUNCHED";
  if (view.mode === "hold" || (metric.status === "At Risk" && metric.clockState === "hold")) return "HOLD";
  if (metric.status === "Needs Attention" || metric.status === "At Risk" || view.mode === "forecast" || view.mode === "overdue") return "WATCH";
  return "GO";
}

export function MissionStatusBoard({
  metrics,
  active = null,
  onSelect,
}: {
  metrics: AcqMetrics[];
  active?: MissionControlState | null;
  onSelect?: (state: MissionControlState | null) => void;
}) {
  const pick = (state: MissionControlState) => onSelect?.(active === state ? null : state);
  const counts = metrics.reduce<Record<MissionControlState, number>>(
    (current, metric) => {
      current[missionControlState(metric)] += 1;
      return current;
    },
    { GO: 0, WATCH: 0, HOLD: 0, LAUNCHED: 0 },
  );

  return (
    <section aria-labelledby="mission-status-heading">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mc-label">Portfolio state</p>
          <h2 id="mission-status-heading" className="mt-1 text-[22px] leading-7 font-medium text-mc-foreground">
            Mission readiness
          </h2>
        </div>
        <p className="mc-board-total" data-numeric><strong>{metrics.length}</strong><span>acquisition files</span></p>
      </div>
      <div className="mc-status-rail">
        <McStatBlock label="GO" value={counts.GO} pressed={active === "GO"} onSelect={onSelect ? () => pick("GO") : undefined} readiness="GO" index="01" description="On trajectory" />
        <McStatBlock label="WATCH" value={counts.WATCH} pressed={active === "WATCH"} onSelect={onSelect ? () => pick("WATCH") : undefined} readiness="WATCH" index="02" description="Attention required" />
        <McStatBlock label="HOLD" value={counts.HOLD} pressed={active === "HOLD"} onSelect={onSelect ? () => pick("HOLD") : undefined} readiness="HOLD" index="03" description="Evidence gate" />
        <McStatBlock label="LAUNCHED" value={counts.LAUNCHED} pressed={active === "LAUNCHED"} onSelect={onSelect ? () => pick("LAUNCHED") : undefined} readiness="LAUNCHED" index="04" description="Post-award" />
      </div>
      <StateModelNote />
    </section>
  );
}