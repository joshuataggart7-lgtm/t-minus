// Effort picture for the requesting organization.
//
// The hours come from the seeded level-of-effort model run against this
// record's own facts: value, competition, pricing, instrument and requirement
// type. Nothing here is a Center average and nothing is rounded down to look
// friendlier. The point of showing it is the ask underneath: the technical team
// owes a work breakdown structure covering the procurement support work, and
// these hours are the reason why.

import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { RefData } from "@/lib/intake";
import { estimate, inputsFromAcq, inWords, type StoredEstimate } from "@/lib/estimator";
import { acquisitionType, type AcqRow, type PhasePlanRow } from "@/lib/launch-sequence";
import { plannedDaysToAward } from "@/lib/file-timeline";
import { workingDaysIn, type AwardConfidence } from "@/lib/confidence";
import { phaseAlias } from "@/lib/phase-alias";

const STAGE_BY_PHASE = new Map<string, string>([
  ["intake", "Acquisition planning"],
  ["market research", "Acquisition planning"],
  ["jofoc", "Acquisition planning"],
  ["fair opportunity", "Acquisition planning"],
  ["synopsis", "Solicitation"],
  ["solicitation/quote", "Solicitation"],
  ["technical evaluation", "Evaluation and award"],
  ["price reasonableness", "Evaluation and award"],
  ["responsibility check", "Evaluation and award"],
  ["go/no-go poll", "Evaluation and award"],
  ["reviews and approvals", "Evaluation and award"],
  ["award", "Evaluation and award"],
  ["fpds-ng report", "Evaluation and award"],
]);

function plannedStages(rows: PhasePlanRow[]) {
  const ordered = [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const last = ordered.reduce(
    (index, row, i) => row.phase === "Award" || row.phase === "FPDS-NG Report" ? i : index,
    -1,
  );
  const stages = new Map<string, { days: number; phases: string[] }>();
  for (const row of ordered.filter((_, i) => last < 0 || i <= last)) {
    if (row.planned_days == null || !row.phase) continue;
    const phase = phaseAlias(row.phase).trim();
    const stage = STAGE_BY_PHASE.get(phase.toLowerCase());
    if (!stage) continue;
    const entry = stages.get(stage) ?? { days: 0, phases: [] };
    entry.days += row.planned_days;
    entry.phases.push(phase);
    stages.set(stage, entry);
  }
  return stages;
}

function joinPhases(phases: string[]) {
  if (phases.length < 2) return phases.join("");
  return `${phases.slice(0, -1).join(", ")} and ${phases[phases.length - 1]}`;
}

export function RequesterLoe({
  acq,
  plan,
  confidence,
}: {
  acq: Record<string, unknown>;
  plan: PhasePlanRow[];
  /** The planned duration and history confidence for this file, when available. */
  confidence: AwardConfidence | null;
  /** Kept for callers; the requester card now shows what is owed itself. */
  missingCount?: number;
}) {
  const ref: RefData = useMemo(
    () => ({
      thresholds: [],
      overrides: [],
      strategies: [],
      phasePlan: plan.map((p) => ({
        acquisition_type: p.acquisition_type,
        phase: p.phase,
        planned_days: p.planned_days,
      })),
    }),
    [plan],
  );

  const est = useMemo(() => estimate(inputsFromAcq(acq as never), ref), [acq, ref]);
  const atIntake = (acq['intake_estimate'] ?? null) as StoredEstimate | null;

  const drivers = useMemo(() => [...est.tasks].sort((a, b) => b.hours - a.hours).slice(0, 5), [est]);

  const byPhase = useMemo(() => {
    const out = new Map<string, number>();
    for (const t of est.tasks) out.set(t.phase, (out.get(t.phase) ?? 0) + t.hours);
    return [...out.entries()];
  }, [est]);

  // Planned calendar days from the seeded phase plan for this file's type.
  // Display only: nothing here recomputes a clock or writes to the record.
  const planRows = useMemo(() => {
    const type = acquisitionType(acq as unknown as AcqRow, plan);
    return plan.filter((p) => p.acquisition_type === type && p.phase);
  }, [plan, acq]);

  const plannedByStage = useMemo(() => plannedStages(planRows), [planRows]);
  const stageCoverage = byPhase.flatMap(([stage]) => {
    const entry = plannedByStage.get(stage);
    return entry ? [`${stage} covers ${joinPhases(entry.phases)}`] : [];
  });

  // Pre-award planned days only, from the one shared helper (lib/file-timeline.ts).
  const totalPlannedDays = useMemo(() => plannedDaysToAward(acq, plan), [acq, plan]);
  const hasPlan = totalPlannedDays > 0;

  return (
    <div className="mc-loe">
      <p className="max-w-[72ch] type-body">
        About {est.hours.total.toLocaleString("en-US")} hours of contracting work to award, in{" "}
        {inWords(byPhase.length)} {byPhase.length === 1 ? "stage" : "stages"}
        {hasPlan ? `, over ${totalPlannedDays} planned calendar days` : ""}. Of those hours, about{" "}
        {est.hours.co.toLocaleString("en-US")} fall to the contracting officer and{" "}
        {est.hours.cs.toLocaleString("en-US")} to the contracting specialist.
      </p>

      <dl className="mc-loe-facts">
        <div>
          <dt>Planned time to award</dt>
          <dd data-numeric>
            {hasPlan ? (
              <>
                {`${totalPlannedDays} calendar days, about ${workingDaysIn(totalPlannedDays)} working days`}
                <span className="mc-loe-note">
                  From the phase plan for this acquisition type.{confidence ? ` ${confidence.rangeNote}` : ""}
                </span>
              </>
            ) : "No phase plan for this acquisition type"}
          </dd>
        </div>
      </dl>

      <div className="mc-loe-grid">
        <div>
          <h4 className="mc-loe-h">Hours and planned days by stage</h4>
          <table className="mc-loe-table">
            <caption className="sr-only">Contracting hours and planned calendar days by stage</caption>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col" className="is-numeric">Hours</th>
                <th scope="col" className="is-numeric">Planned days</th>
              </tr>
            </thead>
            <tbody>
              {byPhase.map(([phase, hours]) => {
                const planned = plannedByStage.get(phase);
                return (
                  <tr key={phase}>
                    <th scope="row">{phase}</th>
                    <td className="is-numeric" data-numeric>{hours.toLocaleString("en-US")}</td>
                    <td className="is-numeric" data-numeric>{planned ? planned.days : "Not planned"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {stageCoverage.length > 0 ? (
            <p className="mc-loe-note">
              Stages group this file's phase plan: {stageCoverage.join("; ")}.
            </p>
          ) : null}
        </div>

        <div>
          <h4 className="mc-loe-h">What drives it on this file</h4>
          <ul className="mc-loe-drivers">
            {drivers.map((t) => (
              <li key={`${t.phase}-${t.name}`}>
                <span className="font-medium"><span data-numeric>{t.hours} hours</span>, {t.name}</span>
                <span className="mc-loe-note">{t.why}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 max-w-[72ch] type-body">
        What the contracting office may ask of your technical team: a work breakdown structure covering the
        procurement support work. Evaluation coordination, fact-finding, answers to questions and the technical
        write-ups all land on the requesting organization, and the award date moves with them.
      </p>

      <p className="mc-loe-note mt-2 max-w-[72ch]">
        {atIntake
          ? `An estimate was saved with the intake on ${atIntake.estimated_at.slice(0, 10)}. The figures above are the same model run against the record as it stands today.`
          : "No estimate was saved with the intake for this file. The figures above are the seeded level-of-effort model run against the record as it stands today."}{" "}
        <Link to="/estimate" className="text-primary underline underline-offset-2 hover:text-primary-hover">
          Open the estimate
        </Link>
        .
      </p>
    </div>
  );
}
