import { useMemo } from "react";
import type { AcqMetrics } from "@/lib/metrics";
import { McBarRow, McPanel } from "./primitives";

export function PhaseDistribution({ metrics }: { metrics: AcqMetrics[] }) {
  const phases = useMemo(() => {
    const counts = new Map<string, number>();
    for (const metric of metrics) {
      const phase = metric.currentPhase ?? "Not started";
      counts.set(phase, (counts.get(phase) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [metrics]);
  const max = Math.max(1, ...phases.map(([, value]) => value));

  return (
    <McPanel aria-labelledby="phase-distribution-heading" className="bg-background">
      <p className="mc-label-light">Portfolio distribution</p>
      <h2 id="phase-distribution-heading" className="mt-1 text-[18px] font-medium">Acquisitions by phase</h2>
      {phases.length ? (
        <ul className="mt-5 space-y-3">
          {phases.map(([phase, value]) => <McBarRow key={phase} label={phase} value={value} max={max} />)}
        </ul>
      ) : <p className="mt-4 text-muted-foreground">No acquisition phases are available.</p>}
    </McPanel>
  );
}