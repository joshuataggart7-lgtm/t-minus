import { priorityTier } from "./executive-exceptions";
import type { ReadinessExplanation } from "./readiness";
import type { MissionRow } from "@/lib/metrics";

export type PriorityBandValue = "P1" | "P2–3" | "P4+";

export function triageSignal(readiness: ReadinessExplanation): "BLOCKED" | "READY" | null {
  if (readiness.state === "HOLD") return "BLOCKED";
  if (readiness.state === "GO" || readiness.state === "WATCH") return "READY";
  return null;
}

export function WorkTriageSignal({ readiness }: { readiness: ReadinessExplanation }) {
  const signal = triageSignal(readiness);
  if (!signal) return null;

  const reason = readiness.triggers[0]?.text;
  return (
    <div className={`mc-triage-signal is-${signal.toLowerCase()}`}>
      <span className="mc-triage-signal-label">{signal}</span>
      {signal === "BLOCKED" ? (
        <span className="mc-triage-reason">{reason ?? "Hold reason not recorded"}</span>
      ) : readiness.state === "WATCH" && reason ? (
        <span className="mc-triage-watch">Watch: {reason}</span>
      ) : null}
    </div>
  );
}

export function priorityBand(priority: number | null | undefined): PriorityBandValue | null {
  if (priority === null || priority === undefined || !Number.isFinite(priority) || priority < 1) return null;
  const tier = priorityTier({ priority } as MissionRow);
  if (tier === "Mission Critical") return "P1";
  if (tier === "High Priority") return "P2–3";
  return "P4+";
}

export function PriorityBand({ priority }: { priority: number | null | undefined }) {
  const band = priorityBand(priority);
  return band ? (
    <span className="mc-triage-priority">{band}</span>
  ) : (
    <span className="mc-triage-priority-missing">Priority not recorded</span>
  );
}