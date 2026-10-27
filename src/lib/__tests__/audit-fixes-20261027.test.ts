import { describe, expect, it } from "vitest";
import "@/lib/template-engine"; // load order: breaks the templates/launch-sequence import cycle
import { acquisitionType, buildSequence, phaseOverrunDays } from "@/lib/launch-sequence";
import { daysBetween } from "@/lib/intake";

const plan = [
  { acquisition_type: "simplified_competed", phase: "Intake", planned_days: 5, order: 1, note: null },
  { acquisition_type: "simplified_competed", phase: "Market Research", planned_days: 10, order: 2, note: null },
];

describe("LA3: baseline-estimated phase days are not an overrun", () => {
  it("marks the current phase estimate and reports no overrun", () => {
    const acq = {
      acquisition_id: "T-1",
      acquisition_type: "simplified_competed",
      current_phase: "Market Research",
      clock_state: "running",
      regulatory_baseline_date: "2026-01-01",
    } as never;
    const type = acquisitionType(acq, null);
    const rows = plan.map((r) => ({ ...r, acquisition_type: type }));
    const phases = buildSequence(acq, rows as never, "2026-10-27", daysBetween);
    const current = phases.find((p) => p.status === "current");
    expect(current?.actual_estimated).toBe(true);
    expect(phaseOverrunDays(current!)).toBeNull();
  });
  it("still reports an overrun from a recorded start", () => {
    expect(phaseOverrunDays({ actual_days: 30, planned_days: 10 })).toBe(20);
  });
});
