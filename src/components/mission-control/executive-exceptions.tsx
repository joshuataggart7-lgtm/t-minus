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
import { DECISION_LABEL } from "@/lib/review-decisions";
import { executiveBlocker } from "@/lib/executive-wording";

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
    const nogo = m.board.find((b) => b.vote === "unfavorable");
    if (m.hold || nogo) {
      out.push({
        kind: "Unresolved blocker",
        id,
        detail: m.hold ? `${m.hold.reason} · owner: ${m.hold.owner || "Not recorded"}` : `${nogo!.decision ? DECISION_LABEL[nogo!.decision] : "Nonconcur"}: ${nogo!.reviewer_role}`,
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
  // Same words as the featured file: with no target the clock runs to the forecast.
  if (!readiness.targetAward) {
    if (view.mode === "forecast" && view.days !== null && view.prefix && !view.pastTarget) return `${view.prefix}${view.days} to forecast award; no target set`;
    return clock === NR ? "No target set" : `${clock}; no target set`;
  }
  const target = formatDate(readiness.targetAward);
  return view.pastTarget ? `${clock}; target was ${target}` : clock === NR ? `Target ${target}` : `${clock} to target award, ${target}`;
}

/**
 * Schedule impact used to rank the leadership list. Past-target files come
 * first (most days past target), then the nearest award. Display order only.
 */
function impactOf(metric: AcqMetrics): { rank: number; text: string } {
  const view = overviewCountdownView(metric);
  if (view.days === null) return { rank: 1e6, text: "No award date to measure against" };
  if (view.pastTarget) return { rank: -view.days, text: `${view.days} ${view.days === 1 ? "day" : "days"} past ${view.mode === "forecast" ? "the forecast award" : "target award"}` };
  return { rank: view.days, text: `${view.days} ${view.days === 1 ? "day" : "days"} to ${view.mode === "forecast" ? "the forecast award" : "target award"}` };
}

const LEADERSHIP_TOP = 5;

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
  const [showAll, setShowAll] = useState(false);
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
      gate: metric.currentPhaseLabel?.trim() || NR,
      schedule: scheduleFor(metric, readiness),
      blocker: primaryBlocker(metric, exception, readiness),
      blockerProvenance: blockerProvenance(metric, readiness),
      next: readiness.nextAction?.trim() || NR,
      impact: impactOf(metric),
    }];
  });

  // Leadership view: one strip per file. HOLD before WATCH, then schedule
  // impact (furthest past target, then nearest award), then the most signals.
  const fileGroups = groupExceptionsByFile(rows.map((row) => row.exception))
    .map((group) => ({ group, row: rows.find((row) => row.exception.id === group.id)! }))
    .sort((a, b) => {
      const state = (a.row.readiness.state === "HOLD" ? 0 : 1) - (b.row.readiness.state === "HOLD" ? 0 : 1);
      if (state) return state;
      const impact = a.row.impact.rank - b.row.impact.rank;
      if (impact) return impact;
      const signals = b.group.kinds.length - a.group.kinds.length;
      if (signals) return signals;
      return a.group.id.localeCompare(b.group.id);
    });
  const shownGroups = showAll ? fileGroups : fileGroups.slice(0, LEADERSHIP_TOP);
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
          <h3 id="exec-exceptions-heading" className="mc-heading">Files that need attention <span data-numeric>{plural(fileGroups.length, "file")} · {plural(rows.length, "signal")}</span></h3>
          {mode === "leadership" && fileGroups.length > LEADERSHIP_TOP ? (
            <p className="mc-exception-sub" data-numeric>
              {showAll
                ? `All ${fileGroups.length} files, held files first, then by schedule impact.`
                : `The ${LEADERSHIP_TOP} with the most schedule impact, held files first. ${fileGroups.length - LEADERSHIP_TOP} more are listed under Show all.`}
            </p>
          ) : null}
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
          {shownGroups.map(({ group, row }) => (
            <LeadershipExceptionStrip state={row.readiness.state as "WATCH" | "HOLD"} key={group.id}>
              <div className="mc-exception-severity">
                <strong>{row.readiness.state}</strong>
                <span className="mc-exception-impact" data-numeric>{row.impact.text}</span>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {group.kinds.slice(0, 3).map((kind, index) => (
                    <span key={`${kind}-${index}`} className="mc-chip">{chipLabel(kind)}</span>
                  ))}
                  {group.kinds.length > 3 ? <span className="mc-chip" data-numeric>{`+${group.kinds.length - 3} more`}</span> : null}
                </span>
              </div>
              <div className="mc-exception-identity">
                <Link to="/files/$acquisitionId" params={{ acquisitionId: row.exception.id }} data-numeric>{row.exception.id}</Link>
                <strong>{row.title}</strong>
              </div>
              <dl className="mc-exception-scan">
                <div><dt>Owner / role</dt><dd>{row.owner}</dd></div>
                <div><dt>Phase</dt><dd>{row.gate}</dd></div>
                <div><dt><ProvenanceChip kind={row.readiness.targetAward ? "FACT" : "RULE"} light /> Schedule impact</dt><dd data-numeric>{row.schedule}</dd></div>
                <div><dt><ProvenanceChip kind={row.blockerProvenance} light /> Blocker</dt><dd title={row.blocker}>{executiveBlocker(row.blocker)}</dd></div>
                <div><dt><ProvenanceChip kind="RULE" light /> Next action</dt><dd>{row.next}</dd></div>
              </dl>
            </LeadershipExceptionStrip>
          ))}
          {fileGroups.length > LEADERSHIP_TOP ? (
            <div className="mc-exception-more">
              <button type="button" className="mc-req-button is-secondary" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
                {showAll ? "Show fewer" : `Show all ${fileGroups.length} files`}
              </button>
            </div>
          ) : null}
        </LeadershipExceptionList>
      ) : (
        <AnalystTableShell>
            <thead>
              <tr>
                <th scope="col">State</th><th scope="col">File</th><th scope="col">Title</th><th scope="col">Owner</th><th scope="col">Phase</th><th scope="col">Schedule</th><th scope="col">Missing</th><th scope="col">Missing items, days in phase</th><th scope="col">Blocker</th><th scope="col">Next</th><th scope="col">Signal</th>
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
                  <td>{row.readiness.missingEvidence.length ? row.readiness.missingEvidence.join(", ") : "None recorded"}<span>{row.readiness.gateAgeDays === null ? NR : `${row.readiness.gateAgeDays} days in phase`}</span></td>
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

// Roles whose pending decision sits at leadership level, not with the CO.
const LEADERSHIP_ROLE = /approving official|head of (the )?contracting activity|\bhca\b|procurement officer|senior procurement executive|source selection authority/i;

type LeadershipDecision = { id: string; title: string; what: string; detail: string; order: number; rank: number };

/** Items where the next move is a leadership call. Read from the record; display only. */
export function deriveLeadershipDecisions(metrics: AcqMetrics[]): LeadershipDecision[] {
  const out: LeadershipDecision[] = [];
  for (const m of metrics) {
    if (m.awardDate || m.clockState === "scrubbed") continue;
    const id = m.acq.acquisition_id;
    const title = String(m.acq.title ?? "").trim() || "Untitled acquisition";
    const rank = impactOf(m).rank;
    for (const b of m.board) {
      if (b.vote === "unfavorable") {
        out.push({ id, title, what: "Unfavorable review to resolve", detail: `${b.decision ? DECISION_LABEL[b.decision] : "Nonconcur"} from the ${b.reviewer_role}`, order: 0, rank });
      } else if (b.vote === "pending" && LEADERSHIP_ROLE.test(b.reviewer_role)) {
        out.push({ id, title, what: "Approval waiting", detail: `${b.reviewer_role}${b.due_date ? `, due ${formatDate(b.due_date)}` : ""}`, order: 2, rank });
      }
    }
    if (m.hold && /fund/i.test(m.hold.reason)) {
      out.push({ id, title, what: "Funding hold", detail: executiveBlocker(m.hold.reason), order: 1, rank });
    }
  }
  return out.sort((a, b) => a.order - b.order || a.rank - b.rank || a.id.localeCompare(b.id));
}

export function LeadershipDecisions({ metrics }: { metrics: AcqMetrics[] }) {
  const [showAll, setShowAll] = useState(false);
  const items = deriveLeadershipDecisions(metrics);
  const shown = showAll ? items : items.slice(0, LEADERSHIP_TOP);
  return (
    <section className="mc-decisions" aria-labelledby="leadership-decisions-heading">
      <div className="mc-exception-heading">
        <div>
          <p className="mc-label">For leadership</p>
          <h3 id="leadership-decisions-heading" className="mc-heading">
            Decisions that may need you <span data-numeric>{plural(items.length, "item")}</span>
          </h3>
          <p className="mc-exception-sub">Unfavorable reviews, funding holds and approvals waiting at the approving-official level. Read from the record; nothing here changes a file.</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mc-exception-empty">Nothing is waiting on a leadership decision right now.</p>
      ) : (
        <ol className="mc-decision-list">
          {shown.map((item, index) => (
            <li key={`${item.id}-${item.what}-${index}`}>
              <span className="mc-decision-what">{item.what}</span>
              <span className="mc-decision-file">
                <Link to="/files/$acquisitionId" params={{ acquisitionId: item.id }} data-numeric>{item.id}</Link>
                <span>{item.title}</span>
              </span>
              <span className="mc-decision-detail">{item.detail}</span>
            </li>
          ))}
        </ol>
      )}
      {items.length > LEADERSHIP_TOP ? (
        <div className="mc-exception-more">
          <button type="button" className="mc-req-button is-secondary" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Show fewer" : `Show all ${items.length}`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
