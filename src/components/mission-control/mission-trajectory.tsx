import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatDate, type AcqMetrics, type MissionRow } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { missionControlState } from "./mission-status-board";
import { overviewCountdownView } from "./operational-state";
import { priorityTier } from "./executive-exceptions";
import { summarizeGate, type PhaseEvidence } from "./gate-evidence";
import { GateDisclosureShell, GateGlance, MissionReadinessChip, ProvenanceChip } from "./primitives";
import { dayWord } from "@/lib/pluralize";
import { methodDisplayLabel } from "@/lib/rfo-simplified-cites";
import { phaseDone, phaseLabel } from "@/lib/launch-sequence";
import { executiveBlocker } from "@/lib/executive-wording";

const NR = "Not recorded";
const list = (items: string[]) => (items.length ? <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul> : <span>None recorded</span>);
const READINESS_WORD: Record<string, string> = { READY: "Ready", ATTENTION: "Needs attention", BLOCKED: "Blocked" };
const evidenceOf = (m: AcqMetrics) => (m as AcqMetrics & { phaseEvidence?: PhaseEvidence[] }).phaseEvidence;

type Step = { label: string; phases: string[] };

/**
 * The featured file's steps are the file's own phases, named exactly as the
 * file page phase row names them (phaseLabel over the phase plan names). No
 * grouping and no Executive-only names.
 */
function stepsFor(metric: AcqMetrics): Step[] {
  return metric.phases.map((phase) => ({ label: phaseLabel(phase), phases: [phase.phase] }));
}

function stageIndex(metric: AcqMetrics, steps: Step[]) {
  return steps.findIndex((stage) => stage.phases.some((phase) => phase === metric.currentPhase));
}

const FEATURED_DEFAULT_ID = "A-2027-0101";
const featuredDefault = (metrics: AcqMetrics[]) =>
  (metrics.find((item) => item.acq.acquisition_id === FEATURED_DEFAULT_ID) ?? metrics[0])?.acq.acquisition_id ?? "";

export function MissionTrajectory({ metrics, missions }: { metrics: AcqMetrics[]; missions: MissionRow[] }) {
  const [selectedId, setSelectedId] = useState(() => featuredDefault(metrics));
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [tipStage, setTipStage] = useState<number | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const defaultAppliedRef = useRef(Boolean(selectedId));
  const metric = metrics.find((item) => item.acq.acquisition_id === selectedId) ?? metrics[0];

  useEffect(() => {
    if (defaultAppliedRef.current || selectedId || metrics.length === 0) return;
    defaultAppliedRef.current = true;
    setSelectedId(featuredDefault(metrics));
  }, [metrics, selectedId]);

  useEffect(() => {
    setSelectedStage(null);
    setDetailExpanded(false);
  }, [selectedId]);

  useEffect(() => setDetailExpanded(false), [selectedStage]);

  const steps = useMemo(() => (metric ? stepsFor(metric) : []), [metric]);
  const evidence = useMemo(() => {
    if (!metric) return null;
    const index = selectedStage ?? Math.max(0, stageIndex(metric, steps));
    const stage = steps[index];
    if (!stage) return null;
    const phases = metric.phases.filter((phase) => stage.phases.some((name) => name === phase.phase));
    const summary = summarizeGate(metric, stage.phases, evidenceOf(metric), index === stageIndex(metric, steps));
    return { index, stage, phases, summary };
  }, [metric, steps, selectedStage]);

  if (!metric) return null;
  const mission = missions.find((item) => item.mission_id === metric.acq.mission_id);
  const view = overviewCountdownView(metric);
  const state = missionControlState(metric);
  const activeIndex = stageIndex(metric, steps);
  const nextIndex = activeIndex < 0 ? 0 : Math.min(activeIndex + 1, steps.length - 1);
  const title = String(metric.acq.title ?? "").trim() || "Untitled acquisition";
  const consequence = metric.hold
    ? `${executiveBlocker(metric.hold.reason)} · owner: ${metric.hold.owner}`
    : metric.blocker !== "None"
      ? executiveBlocker(metric.blocker)
      : metric.nextAction;
  const selectedPrimaryBlocker = evidence?.summary.blocking[0]?.trim() || NR;
  const administrationRule = metric.awardDate
    ? NR
    : "Administration opens only after the award step clears and the actual award is recorded.";
  const upcomingGate = evidence && evidence.index < steps.length - 1
    ? steps[evidence.index + 1]?.label ?? NR
    : NR;

  return (
    <section className="mc-featured-flight" aria-labelledby="trajectory-heading">
      <div className="mc-featured-heading">
        <div>
          <p className="mc-label">One file up close</p>
          <h2 id="trajectory-heading" className="mc-heading">Featured file: where it stands</h2>
        </div>
        <label className="mc-flight-select">
          <span>Choose a file to feature</span>
          <select value={metric.acq.acquisition_id} onChange={(event) => setSelectedId(event.target.value)}>
            {metrics.map((item) => {
              const itemMission = missions.find((row) => row.mission_id === item.acq.mission_id);
              return <option key={item.acq.acquisition_id} value={item.acq.acquisition_id}>{`${item.acq.acquisition_id}: ${String(item.acq.title ?? "").trim() || "Untitled acquisition"}${itemMission?.name ? ` (${itemMission.name})` : ""}`}</option>;
            })}
          </select>
        </label>
      </div>

      <div className="mc-featured-summary">
        <div className="min-w-0">
          <p className="mc-featured-id" data-numeric>{metric.acq.acquisition_id}</p>
          <h3>{title}</h3>
          <p>{mission?.name ? `Mission: ${mission.name}` : "Mission not recorded"}</p>
        </div>
        <div className="mc-featured-clock">
          <strong data-numeric>{view.days === null ? (view.mode === "stopped" ? "Stopped" : "Not started") : view.pastTarget ? view.days : `${view.prefix}${view.days}`}</strong>
          {view.pastTarget ? (
            <span>{`${dayWord(view.days)} past target`}</span>
          ) : view.caption === state ? null : <span>{view.caption}</span>}
        </div>
        <div className="mc-featured-state">
          <MissionReadinessChip state={state} />
          {/* Target award is shown once, in the critical path row. */}
          {metric.awardDate ? (
            <>
              <small>Actual award</small>
              <strong data-numeric>{formatDate(metric.awardDate)}</strong>
            </>
          ) : null}
        </div>
      </div>

      {(() => {
        const currentGate = summarizeGate(metric, steps[activeIndex]?.phases ?? [], evidenceOf(metric), true);
        const value = metric.acq.estimated_value;
        const valueText = value === null || value === undefined || value === "" ? NR : Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
        const org = String((metric.acq as Record<string, unknown>)["requester_org_code"] ?? "").trim();
        const target = metric.acq.target_award_date ? String(metric.acq.target_award_date) : null;
        const blocker = metric.hold ? executiveBlocker(metric.hold.reason) : metric.blocker && metric.blocker !== "None" ? executiveBlocker(metric.blocker) : "None recorded";
        const owner = metric.blockerOwner?.trim() || String(metric.acq.co_name ?? "").trim() || NR;
        const days = metric.awardDate ? null : metric.daysToAward;
        // With no target date the big clock counts to the forecast; say so here
        // with the same number instead of "Not recorded".
        const daysText = metric.awardDate
          ? "Awarded"
          : days !== null
            ? days < 0 ? `${Math.abs(days)} overdue` : String(days)
            : view.mode === "forecast" && view.days !== null
              ? view.pastTarget ? `${view.days} past the forecast award` : `${view.days} to the forecast award`
              : NR;
        // With no target date the clock runs to the forecast, so the target row
        // says "Not set" and points at the forecast instead of a bare "Not recorded".
        const targetText = target ? formatDate(target) : view.mode === "forecast" ? "Not set; counting to the forecast" : "Not set";
        const untracked = Math.max(0, currentGate.required.length - currentGate.completed.length - currentGate.missing.length);
        const readinessWord = READINESS_WORD[currentGate.readiness] ?? currentGate.readiness;
        const evidenceText = currentGate.required.length
          ? untracked
            ? `${currentGate.completed.length} of ${currentGate.required.length} recorded; ${untracked} not tracked in T-Minus yet. ${readinessWord} on what is recorded.`
            : `${currentGate.completed.length} of ${currentGate.required.length} recorded. ${readinessWord}.`
          : NR;
        const ordered = metric.phases;
        const currentAt = ordered.findIndex((phase) => phase.phase === metric.currentPhase);
        const nextPhaseRow = currentAt >= 0 ? ordered.slice(currentAt + 1).find((phase) => phase.status !== "complete") : undefined;
        const nextPhase = nextPhaseRow ? phaseLabel(nextPhaseRow) : undefined;
        return (
          <>
            <div className="mc-critical-path" aria-label="Critical path">
              <span className="mc-priority-tier" data-tier={priorityTier(mission)}>{priorityTier(mission)}</span>
              <p><span>Next step</span><strong>{metric.nextDecision?.trim() || NR}</strong></p>
              <p><span>Blocker</span><strong>{blocker}</strong></p>
              <p><span>Owner</span><strong>{owner}</strong></p>
              <p><span>Target award</span><strong data-numeric>{targetText}</strong></p>
              <p><span>Days remaining</span><strong data-numeric>{daysText}</strong></p>
            </div>
            <dl className="mc-featured-facts">
              <div><dt>CO</dt><dd>{String(metric.acq.co_name ?? "").trim() || NR}</dd></div>
              <div><dt>Requesting org</dt><dd>{org || NR}</dd></div>
              <div><dt>Est. value</dt><dd data-numeric>{valueText}</dd></div>
              <div><dt>Acquisition method</dt><dd>{methodDisplayLabel(String(metric.acq.acquisition_method ?? "").trim()) || NR}</dd></div>
              <div><dt>Current phase</dt><dd>{metric.currentPhaseLabel || NR}</dd></div>
              <div><dt>Next phase</dt><dd>{metric.awardDate ? (nextPhase ?? "None ahead") : (nextPhase ?? (activeIndex >= 0 && activeIndex < steps.length - 1 ? steps[nextIndex]!.label : NR))}</dd></div>
              <div><dt>Evidence status</dt><dd data-numeric>{evidenceText}</dd></div>
            </dl>
          </>
        );
      })()}

      <div className="mc-traj-legend" aria-label="Trajectory state legend">
        <span><i className="is-complete" />Completed</span>
        <span><i className="is-current" />Current</span>
        <span><i className="is-blocked" />Blocked</span>
        <span><i className="is-projected" />Projected</span>
      </div>

      {steps.length === 0 ? <p className="mc-exception-empty">No phase plan for this file.</p> : null}
      <div className="mc-featured-track" role="list" aria-label={`${title} phases`} style={{ ["--n" as string]: String(Math.max(1, steps.length)) }}>
        {steps.map((stage, index) => {
          const phases = metric.phases.filter((phase) => stage.phases.some((name) => name === phase.phase));
          const complete = phases.length > 0 && phases.every(phaseDone);
          const current = index === activeIndex;
          const future = index > activeIndex;
          const gate = summarizeGate(metric, stage.phases, evidenceOf(metric), current);
          return (
            <button
              key={stage.label}
              type="button"
              className={cn("mc-featured-gate", complete && "is-complete", current && "is-current", future && "is-future", index === nextIndex && "is-next", current && state === "HOLD" && "is-hold")}
              aria-pressed={evidence?.index === index}
              onClick={() => setSelectedStage(index)}
              onFocus={() => setTipStage(index)}
              onBlur={() => setTipStage(null)}
              onMouseEnter={() => setTipStage(index)}
              onMouseLeave={() => setTipStage(null)}
            >
              <span className="mc-gate-rail" aria-hidden="true"><span className="mc-gate-node" /></span>
              <span className="mc-gate-label">{stage.label.split("/").map((part, i, all) => (
                <span key={`${part}-${i}`}>{part}{i < all.length - 1 ? <><span aria-hidden="true">/</span><wbr /></> : null}</span>
              ))}</span>
              {gate.status !== "not on path" && !future ? (
                <span className={cn("mc-gate-readiness", `is-${gate.readiness.toLowerCase()}`)}>{gate.readiness}</span>
              ) : (
                <span className="mc-gate-readiness" />
              )}
              {tipStage === index ? (
                <span className="mc-gate-tip"><b>{`Phase ${index + 1} of ${steps.length}`}</b>{current ? consequence : index === nextIndex ? metric.nextAction : phases.length ? phases.map((phase) => phase.status).join("; ") : "Not on this file's path"}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {evidence ? (
        <GateDisclosureShell blocked={state === "HOLD" && evidence.index === activeIndex}>
          <div className="mc-gate-glance-heading">
            <div>
              <p className="mc-label">Selected step</p>
              <h3>{evidence.stage.label}</h3>
              <p>{evidence.phases.length ? evidence.phases.map((phase) => `${phase.phase} · ${phase.status}`).join(" · ") : "No phase is recorded for this acquisition path."}</p>
            </div>
            <button
              type="button"
              className="mc-req-button is-secondary"
              aria-expanded={detailExpanded}
              aria-controls="selected-gate-forensic-detail"
              onClick={() => setDetailExpanded((value) => !value)}
            >
              {detailExpanded ? "Hide the evidence detail" : "Show the evidence detail"}
            </button>
          </div>

          <GateGlance aria-label={`${evidence.stage.label} leadership scan`}>
            <div><dt>Step readiness</dt><dd className={cn("mc-gate-readiness", `is-${evidence.summary.readiness.toLowerCase()}`)}>{evidence.summary.status === "not on path" ? "Not on this path" : evidence.summary.readiness}</dd></div>
            <div><dt>Evidence completeness</dt><dd data-numeric>{evidence.summary.completed.length} of {evidence.summary.required.length}</dd></div>
            <div><dt>Approvals</dt><dd data-numeric>{evidence.summary.approvalsObtained.length} of {evidence.summary.approvalsRequired.length}</dd></div>
            <div className="mc-gate-glance-wide"><dt><ProvenanceChip kind="FACT" /> Primary blocker</dt><dd>{selectedPrimaryBlocker === NR ? "None recorded" : selectedPrimaryBlocker}</dd></div>
            <div className="mc-gate-glance-wide"><dt><ProvenanceChip kind="RULE" /> What this holds back</dt><dd>{administrationRule === NR ? "Nothing; the award is recorded" : administrationRule}</dd></div>
            <div className="mc-gate-glance-wide"><dt><ProvenanceChip kind="FACT" /> Next action</dt><dd>{evidence.summary.nextAction}</dd></div>
            <div><dt>Responsible role</dt><dd>{evidence.summary.responsibleRole}</dd></div>
          </GateGlance>

          {detailExpanded ? (
            <div id="selected-gate-forensic-detail" className="mc-gate-forensic">
              <div className="mc-gate-forensic-heading">
                <div>
                  <p className="mc-label">Evidence detail</p>
                  <h3>What the record shows for this step</h3>
                </div>
                <Button asChild size="lg" className={cn(state === "HOLD" && "mc-hold-cta")}>
                  <Link to="/files/$acquisitionId" params={{ acquisitionId: metric.acq.acquisition_id }}>
                    {state === "HOLD" ? "Open hold evidence" : "Open acquisition file"}
                  </Link>
                </Button>
              </div>
              <dl className="mc-stage-detail" aria-label={`${evidence.stage.label} forensic detail`}>
                <div><dt>Status</dt><dd>{evidence.summary.status === "not on path" ? "Not on this acquisition path" : evidence.summary.status}</dd></div>
                <div><dt>Entered</dt><dd data-numeric>{evidence.summary.enteredAt ? formatDate(evidence.summary.enteredAt) : NR}</dd></div>
                <div><dt>Completed (last recorded event)</dt><dd data-numeric>{evidence.summary.completedAt ? formatDate(evidence.summary.completedAt) : NR}</dd></div>
                <div><dt>Next action</dt><dd>{evidence.summary.nextAction}</dd></div>
                <div><dt>Responsible role</dt><dd>{evidence.summary.responsibleRole}</dd></div>
                <div><dt>Approvals required</dt><dd>{list(evidence.summary.approvalsRequired)}</dd></div>
                <div><dt>Evidence completeness</dt><dd data-numeric>{evidence.summary.completed.length} of {evidence.summary.required.length}</dd></div>
                <div><dt>Next step</dt><dd>{upcomingGate}</dd></div>
                <div><dt>Required evidence</dt><dd>{list(evidence.summary.required)}</dd></div>
                <div><dt>Completed evidence</dt><dd>{list(evidence.summary.completed)}</dd></div>
                <div><dt>Outstanding evidence</dt><dd>{list(evidence.summary.missing)}</dd></div>
                <div><dt>Approvals obtained</dt><dd>{list(evidence.summary.approvalsObtained)}</dd></div>
                <div><dt>Advisory issues</dt><dd>{list(evidence.summary.advisory)}</dd></div>
                <div><dt>Blocking issues</dt><dd>{list(evidence.summary.blocking)}</dd></div>
              </dl>
            </div>
          ) : null}
        </GateDisclosureShell>
      ) : null}
    </section>
  );
}