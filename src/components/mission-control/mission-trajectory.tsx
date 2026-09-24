import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatDate, type AcqMetrics, type MissionRow } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { missionControlState } from "./mission-status-board";
import { overviewCountdownView } from "./operational-state";
import { summarizeGate, type PhaseEvidence } from "./gate-evidence";

const NR = "Not recorded";
const list = (items: string[]) => (items.length ? <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul> : <span>None recorded</span>);
const evidenceOf = (m: AcqMetrics) => (m as AcqMetrics & { phaseEvidence?: PhaseEvidence[] }).phaseEvidence;

const LIFECYCLE = [
  { label: "Requirement / Intake", phases: ["Intake"] },
  { label: "Market Research", phases: ["Market Research"] },
  { label: "Strategy", phases: ["JOFOC", "Fair Opportunity"] },
  { label: "Solicitation", phases: ["Synopsis", "Solicitation/Quote"] },
  { label: "Evaluation", phases: ["Technical Evaluation"] },
  { label: "Negotiation", phases: ["Price Reasonableness", "Responsibility Check"] },
  { label: "Go / No-go", phases: ["Go/No-go Poll"] },
  { label: "Award", phases: ["Award", "FPDS-NG Report"] },
  { label: "Administration", phases: ["Administration"] },
  { label: "Closeout", phases: ["Closeout"] },
] as const;

function stageIndex(metric: AcqMetrics) {
  return LIFECYCLE.findIndex((stage) => stage.phases.some((phase) => phase === metric.currentPhase));
}

export function MissionTrajectory({ metrics, missions }: { metrics: AcqMetrics[]; missions: MissionRow[] }) {
  const [selectedId, setSelectedId] = useState(metrics[0]?.acq.acquisition_id ?? "");
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [tipStage, setTipStage] = useState<number | null>(null);
  const metric = metrics.find((item) => item.acq.acquisition_id === selectedId) ?? metrics[0];

  useEffect(() => {
    if (metric && !selectedId) setSelectedId(metric.acq.acquisition_id);
  }, [metric, selectedId]);

  useEffect(() => setSelectedStage(null), [selectedId]);

  const evidence = useMemo(() => {
    if (!metric) return null;
    const index = selectedStage ?? Math.max(0, stageIndex(metric));
    const stage = LIFECYCLE[index];
    if (!stage) return null;
    const phases = metric.phases.filter((phase) => stage.phases.some((name) => name === phase.phase));
    const summary = summarizeGate(metric, stage.phases, evidenceOf(metric), index === stageIndex(metric));
    return { index, stage, phases, summary };
  }, [metric, selectedStage]);

  if (!metric) return null;
  const mission = missions.find((item) => item.mission_id === metric.acq.mission_id);
  const view = overviewCountdownView(metric);
  const state = missionControlState(metric);
  const activeIndex = stageIndex(metric);
  const nextIndex = activeIndex < 0 ? 0 : Math.min(activeIndex + 1, LIFECYCLE.length - 1);
  const title = mission?.name || String(metric.acq.title ?? "Untitled mission");
  const consequence = metric.hold
    ? `${metric.hold.reason} · owner: ${metric.hold.owner}`
    : metric.blocker !== "None"
      ? metric.blocker
      : metric.nextAction;

  return (
    <section className="mc-featured-flight" aria-labelledby="trajectory-heading">
      <div className="mc-featured-heading">
        <div>
          <p className="mc-label">Featured mission trajectory</p>
          <h2 id="trajectory-heading" className="mc-heading">Portfolio flight path</h2>
        </div>
        <label className="mc-flight-select">
          <span>Featured acquisition</span>
          <select value={metric.acq.acquisition_id} onChange={(event) => setSelectedId(event.target.value)}>
            {metrics.map((item) => {
              const itemMission = missions.find((row) => row.mission_id === item.acq.mission_id);
              return <option key={item.acq.acquisition_id} value={item.acq.acquisition_id}>{itemMission?.name || String(item.acq.title ?? item.acq.acquisition_id)}</option>;
            })}
          </select>
        </label>
      </div>

      <div className="mc-featured-summary">
        <div className="min-w-0">
          <p className="mc-featured-id" data-numeric>{metric.acq.acquisition_id}</p>
          <h3>{title}</h3>
          <p>{String(metric.acq.title ?? "")}</p>
        </div>
        <div className="mc-featured-clock">
          <strong data-numeric>{view.days === null ? (view.mode === "stopped" ? "Stopped" : "Not started") : `${view.prefix}${view.days}`}</strong>
          <span>{view.caption}</span>
        </div>
        <div className="mc-featured-state">
          <span className={cn("mc-state", `mc-state-${state.toLowerCase()}`)}>{state}</span>
          <small>{metric.awardDate ? "Actual award" : "Target award"}</small>
          <strong data-numeric>{formatDate(metric.awardDate ?? (metric.acq.target_award_date ? String(metric.acq.target_award_date) : null))}</strong>
        </div>
      </div>

      <div className="mc-traj-legend" aria-label="Trajectory state legend">
        <span><i className="is-complete" />Completed</span>
        <span><i className="is-current" />Current</span>
        <span><i className="is-blocked" />Blocked</span>
        <span><i className="is-projected" />Projected</span>
      </div>

      <div className="mc-featured-track" role="list" aria-label={`${title} lifecycle`}>
        {LIFECYCLE.map((stage, index) => {
          const phases = metric.phases.filter((phase) => stage.phases.some((name) => name === phase.phase));
          const complete = phases.length > 0 && phases.every((phase) => phase.status === "complete");
          const current = index === activeIndex;
          const future = index > activeIndex;
          const gate = summarizeGate(metric, stage.phases, evidenceOf(metric), current);
          return (
            <Button
              key={stage.label}
              type="button"
              variant="ghost"
              className={cn("mc-featured-gate", complete && "is-complete", current && "is-current", future && "is-future", index === nextIndex && "is-next", current && state === "HOLD" && "is-hold")}
              aria-pressed={evidence?.index === index}
              onClick={() => setSelectedStage(index)}
              onFocus={() => setTipStage(index)}
              onBlur={() => setTipStage(null)}
              onMouseEnter={() => setTipStage(index)}
              onMouseLeave={() => setTipStage(null)}
            >
              <span className="mc-gate-node" aria-hidden="true" />
              <span className="mc-gate-label">{stage.label}</span>
              {gate.status !== "not on path" ? (
                <span className={cn("mc-gate-readiness", `is-${gate.readiness.toLowerCase()}`)}>{gate.readiness}</span>
              ) : null}
              {tipStage === index ? (
                <span className="mc-gate-tip"><b>Preview</b>{current ? consequence : index === nextIndex ? metric.nextAction : phases.length ? phases.map((phase) => phase.status).join(" · ") : "No recorded phase evidence"}</span>
              ) : null}
            </Button>
          );
        })}
      </div>

      {evidence ? (
        <div className={cn("mc-gate-evidence", state === "HOLD" && evidence.index === activeIndex && "is-blocked-evidence") }>
          <div>
            <p className="mc-label">Selected gate</p>
            <h3>{evidence.stage.label}</h3>
            <p>{evidence.phases.length ? evidence.phases.map((phase) => `${phase.phase} · ${phase.status}`).join(" · ") : "No phase is recorded for this acquisition path."}</p>
            {state === "HOLD" && evidence.index === activeIndex ? <p className="mc-gate-consequence">{consequence}</p> : null}
          </div>
          <div className="mc-evidence-facts">
            <p><span>Gate readiness</span><strong>{evidence.summary.status === "not on path" ? "Not on this path" : evidence.summary.readiness}</strong></p>
            <p><span>Evidence</span><strong data-numeric>{evidence.summary.completed.length} of {evidence.summary.required.length} complete</strong></p>
            <p><span>Approvals</span><strong data-numeric>{evidence.summary.approvalsObtained.length} of {evidence.summary.approvalsRequired.length} obtained</strong></p>
          </div>
          <dl className="mc-stage-detail" aria-label={`${evidence.stage.label} stage detail`}>
            <div><dt>Status</dt><dd>{evidence.summary.status === "not on path" ? "Not on this acquisition path" : evidence.summary.status}</dd></div>
            <div><dt>Entered</dt><dd data-numeric>{evidence.summary.enteredAt ? formatDate(evidence.summary.enteredAt) : NR}</dd></div>
            <div><dt>Completed (last recorded event)</dt><dd data-numeric>{evidence.summary.completedAt ? formatDate(evidence.summary.completedAt) : NR}</dd></div>
            <div><dt>Responsible role</dt><dd>{evidence.summary.responsibleRole}</dd></div>
            <div><dt>Next action</dt><dd>{evidence.summary.nextAction}</dd></div>
            <div><dt>Required evidence</dt><dd>{list(evidence.summary.required)}</dd></div>
            <div><dt>Completed evidence</dt><dd>{list(evidence.summary.completed)}</dd></div>
            <div><dt>Outstanding evidence</dt><dd>{list(evidence.summary.missing)}</dd></div>
            <div><dt>Approvals required</dt><dd>{list(evidence.summary.approvalsRequired)}</dd></div>
            <div><dt>Approvals obtained</dt><dd>{list(evidence.summary.approvalsObtained)}</dd></div>
            <div><dt>Blocking issues</dt><dd>{list(evidence.summary.blocking)}</dd></div>
            <div><dt>Advisory issues</dt><dd>{list(evidence.summary.advisory)}</dd></div>
          </dl>
          <Button asChild size="lg" className={cn(state === "HOLD" && "mc-hold-cta")}>
            <Link to="/files/$acquisitionId" params={{ acquisitionId: metric.acq.acquisition_id }}>
              {state === "HOLD" ? "Open hold evidence" : "Open acquisition file"}
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}