import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatDate, type AcqMetrics, type MissionRow } from "@/lib/metrics";
import { todayISO } from "@/lib/intake";
import { cn } from "@/lib/utils";
import { overviewCountdownView } from "./operational-state";
import { countdownText } from "@/components/launch-countdown";
import type { ReadinessExplanation } from "./readiness";
import { AnalystTableShell, LeadershipExceptionList, LeadershipExceptionStrip, ProvenanceChip } from "./primitives";

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
type ExceptionMetric = AcqMetrics & { readiness?: ReadinessExplanation };
const APPROVAL_ROLE = /approv|contracting officer|procurement officer|source selection|board|\bpeb\b|head of contracting/i;
const NR = "Not recorded";

export function deriveExceptions(metrics: AcqMetrics[]): Exception[] {
  const today = todayISO();
  const out: Exception[] = [];
  for (const m of metrics) {
    if (m.awardDate) continue;
    const id = m.acq.acquisition_id;
    const r = (m as ExceptionMetric).readiness;
    if (r?.state !== "HOLD" && r?.state !== "WATCH") continue;
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

function scheduleFor(metric: AcqMetrics, readiness: ReadinessExplanation) {
  const view = overviewCountdownView(metric);
  const clock = view.days === null
    ? NR
    : view.mode === "forecast" && !view.pastTarget
      ? `${countdownText(view, { omitBadge: true })} forecast`
      : countdownText(view);
  const target = readiness.targetAward ? formatDate(readiness.targetAward) : NR;
  return `${clock} · target ${target}`;
}

function primaryBlocker(metric: AcqMetrics, exception: Exception, readiness: ReadinessExplanation) {
  if (metric.hold?.reason?.trim()) return metric.hold.reason;
  if (metric.blocker?.trim() && metric.blocker !== "None") return metric.blocker;
  if (readiness.missingEvidence[0]?.trim()) return readiness.missingEvidence[0];
  return exception.detail?.trim() || NR;
}

function blockerProvenance(metric: AcqMetrics, readiness: ReadinessExplanation): "FACT" | "RULE" {
  return metric.hold?.reason?.trim() || (metric.blocker?.trim() && metric.blocker !== "None") || readiness.missingEvidence.length
    ? "FACT"
    : "RULE";
}

export function ExecutiveExceptions({ metrics }: { metrics: AcqMetrics[] }) {
  const [mode, setMode] = useState<"leadership" | "analyst">("leadership");
  const items = deriveExceptions(metrics);
  const rows = items.flatMap((exception) => {
    const metric = (metrics as ExceptionMetric[]).find((item) => item.acq.acquisition_id === exception.id);
    const readiness = metric?.readiness;
    if (!metric || !readiness || (readiness.state !== "HOLD" && readiness.state !== "WATCH")) return [];
    const title = String(metric.acq.title ?? "").trim() || "Untitled acquisition";
    const owner = readiness.nextOwner?.trim() || metric.blockerOwner?.trim() || String(metric.acq.co_name ?? "").trim() || NR;
    return [{
      exception,
      metric,
      readiness,
      title,
      owner,
      gate: metric.currentPhase?.trim() || NR,
      schedule: scheduleFor(metric, readiness),
      blocker: primaryBlocker(metric, exception, readiness),
      blockerProvenance: blockerProvenance(metric, readiness),
      next: readiness.nextAction?.trim() || NR,
    }];
  });

  return (
    <section className="mc-exec-exceptions" aria-labelledby="exec-exceptions-heading">
      <div className="mc-exception-heading">
        <div>
          <p className="mc-label">Leadership attention</p>
          <h3 id="exec-exceptions-heading" className="mc-heading">Executive exceptions <span data-numeric>{rows.length}</span></h3>
        </div>
        <div className="mc-exception-mode" aria-label="Exception view">
          <Button type="button" variant="ghost" size="sm" aria-pressed={mode === "leadership"} onClick={() => setMode("leadership")}>Leadership</Button>
          <Button type="button" variant="ghost" size="sm" aria-pressed={mode === "analyst"} onClick={() => setMode("analyst")}>Analyst</Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mc-exception-empty">No active exceptions</p>
      ) : mode === "leadership" ? (
        <LeadershipExceptionList>
          {rows.map((row, index) => (
            <LeadershipExceptionStrip state={row.readiness.state as "WATCH" | "HOLD"} key={`${row.exception.id}-${row.exception.kind}-${index}`}>
              <div className="mc-exception-severity">
                <ProvenanceChip kind="RULE" light />
                <strong>{row.readiness.state}</strong>
                <span>{row.exception.kind}</span>
              </div>
              <div className="mc-exception-identity">
                <Link to="/files/$acquisitionId" params={{ acquisitionId: row.exception.id }} data-numeric>{row.exception.id}</Link>
                <strong>{row.title}</strong>
              </div>
              <dl className="mc-exception-scan">
                <div><dt>Owner / role</dt><dd>{row.owner}</dd></div>
                <div><dt>Gate</dt><dd>{row.gate}</dd></div>
                <div><dt><ProvenanceChip kind={row.readiness.targetAward ? "FACT" : "RULE"} light /> Schedule impact</dt><dd data-numeric>{row.schedule}</dd></div>
                <div><dt><ProvenanceChip kind={row.blockerProvenance} light /> Blocker</dt><dd>{row.blocker}</dd></div>
                <div><dt><ProvenanceChip kind="RULE" light /> Next action</dt><dd>{row.next}</dd></div>
              </dl>
            </LeadershipExceptionStrip>
          ))}
        </LeadershipExceptionList>
      ) : (
        <AnalystTableShell>
            <thead>
              <tr>
                <th scope="col">Sev</th><th scope="col">Acq #</th><th scope="col">Title</th><th scope="col">Owner</th><th scope="col">Gate</th><th scope="col">Schedule</th><th scope="col">Missing #</th><th scope="col">Missing / age</th><th scope="col">Blocker</th><th scope="col">Next</th><th scope="col">Rule kind</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.exception.id}-${row.exception.kind}-analyst-${index}`}>
                  <td><span className={cn("mc-exception-table-severity", `is-${row.readiness.state.toLowerCase()}`)}>{row.readiness.state}</span></td>
                  <td><Link to="/files/$acquisitionId" params={{ acquisitionId: row.exception.id }} data-numeric>{row.exception.id}</Link></td>
                  <td>{row.title}</td>
                  <td>{row.owner}</td>
                  <td>{row.gate}</td>
                  <td data-numeric>{row.schedule}</td>
                  <td data-numeric>{row.readiness.missingEvidence.length}</td>
                  <td>{row.readiness.missingEvidence.length ? row.readiness.missingEvidence.join(", ") : "None recorded"}<span>{row.readiness.gateAgeDays === null ? NR : `${row.readiness.gateAgeDays} days in gate`}</span></td>
                  <td>{row.blocker}</td>
                  <td>{row.next}</td>
                  <td>{row.exception.kind}</td>
                </tr>
              ))}
            </tbody>
        </AnalystTableShell>
      )}
    </section>
  );
}
