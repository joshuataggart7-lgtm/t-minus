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

/**
 * One entry per file, in first-seen order, with the rule kinds and details
 * that file hit. deriveExceptions() still returns one item per rule hit.
 */
export function groupExceptionsByFile(items: Exception[]): { id: string; kinds: string[]; details: string[] }[] {
  const byId = new Map<string, { id: string; kinds: string[]; details: string[] }>();
  for (const item of items) {
    const group = byId.get(item.id) ?? { id: item.id, kinds: [], details: [] };
    group.kinds.push(item.kind);
    group.details.push(item.detail);
    byId.set(item.id, group);
  }
  return [...byId.values()];
}

const KIND_CHIP: Record<string, string> = {
  "Missing mandatory evidence": "Missing evidence",
  "Unresolved blocker": "Blocker",
};
const chipLabel = (kind: string) => KIND_CHIP[kind] ?? kind;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function scheduleFor(metric: AcqMetrics, readiness: ReadinessExplanation) {
  const view = overviewCountdownView(metric);
  const clock = view.pastTarget
    ? countdownText(view)
    : view.days === null || !view.prefix
      ? NR
      : `${view.prefix}${view.days}${view.mode === "forecast" ? " forecast" : ""}`;
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

  // Leadership view: one strip per file. HOLD before WATCH, then the files
  // with the most signals, then the nearest target award.
  const fileGroups = groupExceptionsByFile(rows.map((row) => row.exception))
    .map((group) => ({ group, row: rows.find((row) => row.exception.id === group.id)! }))
    .sort((a, b) => {
      const state = (a.row.readiness.state === "HOLD" ? 0 : 1) - (b.row.readiness.state === "HOLD" ? 0 : 1);
      if (state) return state;
      const signals = b.group.kinds.length - a.group.kinds.length;
      if (signals) return signals;
      const ta = a.row.readiness.targetAward ?? "9999-12-31";
      const tb = b.row.readiness.targetAward ?? "9999-12-31";
      return ta.localeCompare(tb);
    });
  const fileOrder = new Map(fileGroups.map((entry, index) => [entry.group.id, index]));
  // Analyst view: every signal, grouped by file in the same order, then by kind.
  const analystRows = [...rows].sort(
    (a, b) =>
      (fileOrder.get(a.exception.id) ?? 0) - (fileOrder.get(b.exception.id) ?? 0) ||
      a.exception.kind.localeCompare(b.exception.kind),
  );

  return (
    <section className="mc-exec-exceptions" aria-labelledby="exec-exceptions-heading">
      <div className="mc-exception-heading">
        <div>
          <p className="mc-label">Leadership attention</p>
          <h3 id="exec-exceptions-heading" className="mc-heading">Executive exceptions <span data-numeric>{plural(fileGroups.length, "file")} · {plural(rows.length, "signal")}</span></h3>
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
          {fileGroups.map(({ group, row }) => (
            <LeadershipExceptionStrip state={row.readiness.state as "WATCH" | "HOLD"} key={group.id}>
              <div className="mc-exception-severity">
                <ProvenanceChip kind="RULE" light />
                <strong>{row.readiness.state}</strong>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {group.kinds.slice(0, 3).map((kind, index) => (
                    <span key={`${kind}-${index}`} className="rounded-full border border-current px-2 text-[12px] leading-5">{chipLabel(kind)}</span>
                  ))}
                  {group.kinds.length > 3 ? <span className="px-1 text-[12px] leading-5" data-numeric>+{group.kinds.length - 3}</span> : null}
                </span>
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
              {analystRows.map((row, index) => (
                <tr
                  key={`${row.exception.id}-${row.exception.kind}-analyst-${index}`}
                  style={index > 0 && analystRows[index - 1]!.exception.id !== row.exception.id ? { borderTop: "2px solid var(--border)" } : undefined}
                >
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
