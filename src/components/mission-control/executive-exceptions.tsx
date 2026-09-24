import { Link } from "@tanstack/react-router";
import type { AcqMetrics, MissionRow } from "@/lib/metrics";
import { todayISO } from "@/lib/intake";
import type { ReadinessExplanation } from "./readiness";

export type PriorityTier = "Mission Critical" | "High Priority" | "Standard" | "Priority not recorded";

/** Tier from the linked mission's recorded priority: 1 critical, 2–3 high, 4+ standard. */
export function priorityTier(mission: MissionRow | null | undefined): PriorityTier {
  const p = mission?.priority;
  if (p === null || p === undefined) return "Priority not recorded";
  if (p <= 1) return "Mission Critical";
  if (p <= 3) return "High Priority";
  return "Standard";
}

type Exception = { kind: string; id: string; detail: string };
const APPROVAL_ROLE = /approv|contracting officer|procurement officer|source selection|board|\bpeb\b|head of contracting/i;

export function deriveExceptions(metrics: AcqMetrics[]): Exception[] {
  const today = todayISO();
  const out: Exception[] = [];
  for (const m of metrics) {
    if (m.awardDate) continue;
    const id = m.acq.acquisition_id;
    const r = (m as AcqMetrics & { readiness?: ReadinessExplanation }).readiness;
    const current = m.phases.find((p) => p.status === "current");
    if (current && current.actual_days !== null && current.actual_days > current.planned_days) {
      out.push({ kind: "Overdue gate", id, detail: `${current.phase}: ${current.actual_days} days against ${current.planned_days} planned` });
    }
    if (r?.targetAtRisk) {
      out.push({ kind: "Award at risk", id, detail: r.targetAward ? `Target award ${r.targetAward}` : "Target award not recorded" });
    }
    if (r?.missingEvidence.length) {
      out.push({ kind: "Missing mandatory evidence", id, detail: r.missingEvidence.join(", ") });
    }
    for (const b of m.board) {
      const who = `${b.reviewer_role} (${b.reviewer_name?.trim() || "Not recorded"})`;
      if (b.vote === "pending" && APPROVAL_ROLE.test(b.reviewer_role)) {
        out.push({ kind: "Unsigned approval", id, detail: who });
      } else if (b.vote === "pending" && b.due_date && b.due_date < today) {
        out.push({ kind: "Reviewer overdue", id, detail: `${who}, due ${b.due_date}` });
      }
    }
    const nogo = m.board.find((b) => b.vote === "no-go");
    if (m.hold || nogo) {
      out.push({
        kind: "Unresolved blocker",
        id,
        detail: m.hold ? `${m.hold.reason} · owner: ${m.hold.owner || "Not recorded"}` : `No-go: ${nogo!.reviewer_role}`,
      });
    }
  }
  return out;
}

export function ExecutiveExceptions({ metrics }: { metrics: AcqMetrics[] }) {
  const items = deriveExceptions(metrics);
  return (
    <section className="mc-exec-exceptions" aria-labelledby="exec-exceptions-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h3 id="exec-exceptions-heading" className="mc-heading">Executive exceptions</h3>
        <span className="mc-label" data-numeric>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px]">No active exceptions</p>
      ) : (
        <ul className="mt-2">
          {items.map((e, i) => (
            <li key={`${e.id}-${e.kind}-${i}`}>
              <span className="mc-exc-kind">{e.kind}</span>
              <Link to="/files/$acquisitionId" params={{ acquisitionId: e.id }} className="mc-exc-id" data-numeric>{e.id}</Link>
              <span className="mc-exc-detail">{e.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
