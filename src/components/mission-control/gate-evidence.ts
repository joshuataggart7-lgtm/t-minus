import type { AcqMetrics } from "@/lib/metrics";
import type { PhaseView, RequiredDoc } from "@/lib/launch-sequence";

/** Per-phase evidence read from the record. Nothing is inferred beyond the recorded rows. */
export type PhaseEvidence = {
  phase: string;
  status: PhaseView["status"];
  required: string[];
  completed: string[];
  missing: string[];
  /** Offered (optional) rows not done: advisory only, never blocking. */
  advisoryDocs: string[];
  /** Earliest audit event logged in this phase. */
  enteredAt: string | null;
  /** Latest audit event logged in this phase, shown only once the phase is complete. */
  lastEventAt: string | null;
};

export type GateReadiness = "READY" | "ATTENTION" | "BLOCKED";

export type GateSummary = {
  readiness: GateReadiness;
  phases: PhaseEvidence[];
  required: string[];
  completed: string[];
  missing: string[];
  approvalsRequired: string[];
  approvalsObtained: string[];
  blocking: string[];
  advisory: string[];
  enteredAt: string | null;
  completedAt: string | null;
  status: "complete" | "current" | "upcoming" | "not on path";
  responsibleRole: string;
  nextAction: string;
};

type LogRow = { acquisition_id?: string | null; phase?: string | null; logged_at?: string | null };

export function derivePhaseEvidence(
  metric: AcqMetrics,
  log: LogRow[],
  isSatisfied: (doc: RequiredDoc) => boolean | null,
): PhaseEvidence[] {
  const id = metric.acq.acquisition_id;
  return metric.phases.map((p) => {
    const events = log
      .filter((r) => r.acquisition_id === id && r.phase === p.phase && r.logged_at)
      .map((r) => String(r.logged_at))
      .sort();
    const required = p.docs.filter((d) => !d.optional);
    // A row with no field and no generator has no recorded state; it is neither completed nor missing.
    const judged = required.map((d) => ({ d, ok: isSatisfied(d) }));
    return {
      phase: p.phase,
      status: p.status,
      required: required.map((d) => d.label),
      completed: judged.filter((j) => j.ok === true).map((j) => j.d.label),
      missing: judged.filter((j) => j.ok === false).map((j) => j.d.label),
      advisoryDocs: p.docs.filter((d) => d.optional && isSatisfied(d) === false).map((d) => d.label),
      enteredAt: events[0]?.slice(0, 10) ?? null,
      lastEventAt: events.length ? events[events.length - 1]!.slice(0, 10) : null,
    };
  });
}

export function summarizeGate(
  metric: AcqMetrics,
  phaseNames: readonly string[],
  evidence: PhaseEvidence[] | undefined,
  isCurrentStage: boolean,
): GateSummary {
  const phases = (evidence ?? []).filter((e) => phaseNames.includes(e.phase));
  const reviews = [...metric.board, ...metric.upcomingReviews].filter((b) => phaseNames.includes(b.phase));
  const label = (b: (typeof reviews)[number]) => `${b.reviewer_role} (${b.reviewer_name?.trim() || "Not recorded"})`;
  const required = phases.flatMap((p) => p.required);
  const completed = phases.flatMap((p) => p.completed);
  const missing = phases.flatMap((p) => p.missing);
  const status: GateSummary["status"] = !phases.length
    ? "not on path"
    : phases.every((p) => p.status === "complete")
      ? "complete"
      : phases.some((p) => p.status === "current")
        ? "current"
        : "upcoming";

  const blocking: string[] = [];
  if (isCurrentStage && metric.hold) blocking.push(`Hold: ${metric.hold.reason}`);
  for (const b of reviews.filter((r) => r.vote === "no-go")) blocking.push(`No-go: ${label(b)}${b.reason ? `: ${b.reason}` : ""}`);
  if (status === "current") for (const m of missing) blocking.push(`${m} is missing`);

  const advisory: string[] = phases.flatMap((p) => p.advisoryDocs.map((d) => `Offered, not done: ${d}`));
  if (status !== "current") for (const m of missing) advisory.push(`${m} not yet complete`);
  const pending = reviews.filter((r) => r.vote === "pending");
  if (status === "current") for (const b of pending) advisory.push(`Vote outstanding: ${label(b)}`);

  const readiness: GateReadiness = blocking.length
    ? "BLOCKED"
    : status === "complete" || (!pending.length && !missing.length && !advisory.length)
      ? "READY"
      : "ATTENTION";

  const co = String(metric.acq.co_name ?? "").trim();
  const firstPending = pending[0];
  const responsibleRole = isCurrentStage && metric.blockerOwner
    ? metric.blockerOwner
    : firstPending
      ? firstPending.reviewer_role
      : co
        ? `Contracting officer (${co})`
        : "Not recorded";

  const nextAction = status === "complete"
    ? "None. Stage complete."
    : isCurrentStage
      ? metric.nextAction?.trim() || "Not recorded"
      : missing[0]
        ? `Complete ${missing[0]}`
        : firstPending
          ? `${firstPending.reviewer_role} vote`
          : "Not recorded";

  return {
    readiness,
    phases,
    required,
    completed,
    missing,
    approvalsRequired: reviews.map(label),
    approvalsObtained: reviews.filter((r) => r.vote === "go").map(label),
    blocking,
    advisory,
    enteredAt: phases.map((p) => p.enteredAt).filter(Boolean).sort()[0] ?? null,
    completedAt: status === "complete" ? (phases.map((p) => p.lastEventAt).filter(Boolean).sort().pop() ?? null) : null,
    status,
    responsibleRole,
    nextAction,
  };
}
