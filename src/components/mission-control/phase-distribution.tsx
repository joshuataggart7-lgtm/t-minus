import { useMemo } from "react";
import type { AcqMetrics } from "@/lib/metrics";
import { McPanel } from "./primitives";

export function PhaseDistribution({ metrics }: { metrics: AcqMetrics[] }) {
  const phases = useMemo(() => {
    const counts = new Map<string, number>();
    for (const metric of metrics) {
      const phase = metric.currentPhase ?? "Not started";
      counts.set(phase, (counts.get(phase) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [metrics]);
  const total = Math.max(1, phases.reduce((sum, [, value]) => sum + value, 0));

  return (
    <McPanel aria-labelledby="phase-distribution-heading" className="mc-ops-panel">
      <p className="mc-label">Lifecycle accumulation</p>
      <h2 id="phase-distribution-heading" className="mc-heading">Phase movement</h2>
      {phases.length ? (
        <ul className="mc-phase-accumulation">
          {phases.map(([phase, value], index) => (
            <li key={phase} style={{ flexGrow: Math.max(1, value) }}>
              <span className="mc-phase-step" aria-hidden="true"><i /></span>
              <span className="mc-phase-index" data-numeric>{String(index + 1).padStart(2, "0")}</span>
              <strong>{phase}</strong>
              <span data-numeric>{value} · {Math.round((value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-mc-muted">No acquisition phases are available.</p>}
    </McPanel>
  );
}