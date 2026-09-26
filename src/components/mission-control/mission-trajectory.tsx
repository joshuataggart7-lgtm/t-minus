import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatDate, type AcqMetrics, type MissionRow } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { missionControlState } from "./mission-status-board";
import { overviewCountdownView } from "./operational-state";
import { priorityTier } from "./executive-exceptions";
import { summarizeGate, type PhaseEvidence } from "./gate-evidence";
import { GateDisclosureShell, GateGlance, MissionReadinessChip, ProvenanceChip } from "./primitives";

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
  const [detailExpanded, setDetailExpanded] = useState(false);
  const metric = metrics.find((item) => item.acq.acquisition_id === selectedId) ?? metrics[0];

  useEffect(() => {
    if (metric && !selectedId) setSelectedId(metric.acq.acquisition_id);
  }, [metric, selectedId]);

  useEffect(() => {
    setSelectedStage(null);
    setDetailExpanded(false);
  }, [selectedId]);

  useEffect(() => setDetailExpanded(false), [selectedStage]);

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
  const title = String(metric.acq.title ?? "").trim() || "Untitled acquisition";
  const consequence = metric.hold
    ? `${metric.hold.reason} · owner: ${metric.hold.owner}`
    : metric.blocker !== "None"
      ? metric.blocker
      : metric.nextAction;
  const selectedPrimaryBlocker = evidence?.summary.blocking[0]?.trim() || NR;
  const administrationRule = metric.awardDate
    ? NR
    : "Administration remains unavailable until Award clears and an actual award is recorded.";
  const upcomingGate = evidence && evidence.index < LIFECYCLE.length - 1
    ? LIFECYCLE[evidence.index + 1]?.label ?? NR
    : NR;

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
              return <option key={item.acq.acquisition_id} value={item.acq.acquisition_id}>{`${item.acq.acquisition_id} — ${String(item.acq.title ?? "").trim() || "Untitled acquisition"}${itemMission?.name ? ` (${itemMission.name})` : ""}`}</option>;
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
          <strong data-numeric>{view.days === null ? (view.mode === "stopped" ? "Stopped" : "Not started") : `${view.prefix}${view.days}`}</strong>
          {view.caption === state ? null : <span>{view.caption}</span>}
        </div>
        <div className="mc-featured-state">
          <MissionReadinessChip state={state} />
          <small>{metric.awardDate ? "Actual award" : "Target award"}</small>
          <strong data-numeric>{formatDate(metric.awardDate ?? (metric.acq.target_award_date ? String(metric.acq.target_award_date) : null))}</strong>
        </div>
      </div>

      <p className="mc-identity-assurance">
        <ProvenanceChip kind="FACT" />
        Identity match: ID, title, mission, value, method, gates and clock are read from this acquisition record.
      </p>

      {(() => {
        const r = (metric as AcqMetrics & { readiness?: { targetAward: string | null } }).readiness;
        const currentGate = summarizeGate(metric, LIFECYCLE[activeIndex]?.phases ?? [], evidenceOf(metric), true);
        const value = metric.acq.estimated_value;
        const valueText = value === null || value === undefined || value === "" ? NR : Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
        const org = String((metric.acq as Record<string, unknown>)["requester_org_code"] ?? "").trim();
        const target = metric.acq.target_award_date ? String(metric.acq.target_award_date) : null;
        const blocker = metric.hold ? metric.hold.reason : metric.blocker && metric.blocker !== "None" ? metric.blocker : "None recorded";
        const owner = metric.blockerOwner?.trim() || String(metric.acq.co_name ?? "").trim() || NR;
        const days = metric.awardDate ? null : metric.daysToAward;
        return (
          <>
            <div className="mc-critical-path" aria-label="Critical path">
              <span className="mc-priority-tier" data-tier={priorityTier(mission)}>{priorityTier(mission)}</span>
              <p><span>Next gate</span><strong>{metric.nextDecision?.trim() || NR}</strong></p>
              <p><span>Blocker</span><strong>{blocker}</strong></p>
              <p><span>Owner</span><strong>{owner}</strong></p>
              <p><span>Target award</span><strong data-numeric>{target ? formatDate(target) : NR}</strong></p>
              <p><span>Days remaining</span><strong data-numeric>{metric.awardDate ? "Awarded" : days === null ? NR : days < 0 ? `${Math.abs(days)} overdue` : String(days)}</strong></p>
            </div>
            <dl className="mc-featured-facts">
              <div><dt>CO</dt><dd>{String(metric.acq.co_name ?? "").trim() || NR}</dd></div>
              <div><dt>Requesting org</dt><dd>{org || NR}</dd></div>
              <div><dt>Est. value</dt><dd data-numeric>{valueText}</dd></div>
              <div><dt>Acquisition method</dt><dd>{String(metric.acq.acquisition_method ?? "").trim() || NR}</dd></div>
              <div><dt>{metric.awardDate ? "Actual award" : "Target award"}</dt><dd data-numeric>{metric.awardDate ? formatDate(metric.awardDate) : r?.targetAward ? formatDate(r.targetAward) : NR}</dd></div>
              <div><dt>Current gate</dt><dd>{LIFECYCLE[activeIndex]?.label ?? (metric.currentPhase || NR)}</dd></div>
              <div><dt>Next gate</dt><dd>{activeIndex >= 0 && activeIndex < LIFECYCLE.length - 1 ? LIFECYCLE[nextIndex]!.label : NR}</dd></div>
              <div><dt>Evidence status</dt><dd data-numeric>{currentGate.required.length ? `${currentGate.completed.length} of ${currentGate.required.length} complete · ${currentGate.readiness}` : NR}</dd></div>
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
        <GateDisclosureShell blocked={state === "HOLD" && evidence.index === activeIndex}>
          <div className="mc-gate-glance-heading">
            <div>
              <p className="mc-label">Selected gate</p>
              <h3>{evidence.stage.label}</h3>
              <p>{evidence.phases.length ? evidence.phases.map((phase) => `${phase.phase} · ${phase.status}`).join(" · ") : "No phase is recorded for this acquisition path."}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={detailExpanded}
              aria-controls="selected-gate-forensic-detail"
              onClick={() => setDetailExpanded((value) => !value)}
            >
              {detailExpanded ? "Collapse detail" : "Expand audit detail"}
            </Button>
          </div>

          <GateGlance aria-label={`${evidence.stage.label} leadership scan`}>
            <div><dt>Gate readiness</dt><dd className={cn("mc-gate-readiness", `is-${evidence.summary.readiness.toLowerCase()}`)}>{evidence.summary.status === "not on path" ? "Not on this path" : evidence.summary.readiness}</dd></div>
            <div><dt>Evidence completeness</dt><dd data-numeric>{evidence.summary.completed.length} of {evidence.summary.required.length}</dd></div>
            <div><dt>Approvals</dt><dd data-numeric>{evidence.summary.approvalsObtained.length} of {evidence.summary.approvalsRequired.length}</dd></div>
            <div className="mc-gate-glance-wide"><dt><ProvenanceChip kind="FACT" /> Primary blocker</dt><dd>{selectedPrimaryBlocker}</dd></div>
            <div className="mc-gate-glance-wide"><dt><ProvenanceChip kind="RULE" /> Downstream consequence</dt><dd>{administrationRule}</dd></div>
            <div className="mc-gate-glance-wide"><dt><ProvenanceChip kind="FACT" /> Next action</dt><dd>{evidence.summary.nextAction}</dd></div>
            <div><dt>Responsible role</dt><dd>{evidence.summary.responsibleRole}</dd></div>
          </GateGlance>

          {detailExpanded ? (
            <div id="selected-gate-forensic-detail" className="mc-gate-forensic">
              <div className="mc-gate-forensic-heading">
                <div>
                  <p className="mc-label">Audit detail</p>
                  <h3>Recorded gate evidence</h3>
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
                <div><dt>Upcoming gate</dt><dd>{upcomingGate}</dd></div>
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