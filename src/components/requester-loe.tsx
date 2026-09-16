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

export function RequesterLoe({
  acq,
  plan,
  awardRange,
  missingCount,
}: {
  acq: Record<string, unknown>;
  plan: PhasePlanRow[];
  /** The honest days-to-award range for this file, or null when withheld. */
  awardRange: string | null;
  /** Items the requesting organization still owes on this file. */
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
    const type = acquisitionType(acq as unknown as AcqRow);
    return plan.filter((p) => p.acquisition_type === type && p.phase);
  }, [plan, acq]);

  const plannedByPhase = useMemo(() => {
    const out = new Map<string, number>();
    for (const r of planRows) {
      const key = (r.phase ?? "").toLowerCase();
      if (r.planned_days != null) out.set(key, (out.get(key) ?? 0) + r.planned_days);
    }
    return out;
  }, [planRows]);

  const totalPlannedDays = useMemo(
    () => planRows.reduce((sum, r) => sum + (r.planned_days ?? 0), 0),
    [planRows],
  );
  const hasPlan = planRows.length > 0 && totalPlannedDays > 0;

  return (
    <div>
      <h3 className="text-[15px] font-medium">What this buy costs in contracting work</h3>
      <p className="mt-2 max-w-[70ch] text-[15px] leading-[22px]">
        About {est.hours.total.toLocaleString("en-US")} hours of contracting work to award, across{" "}
        {inWords(byPhase.length)} phases and about {inWords(est.monthsToAward)} month
        {est.monthsToAward === 1 ? "" : "s"}. Of those hours, about{" "}
        {est.hours.co.toLocaleString("en-US")} fall to the contracting officer and{" "}
        {est.hours.cs.toLocaleString("en-US")} to the contracting specialist.
      </p>

      <dl className="mt-3 grid max-w-[70ch] grid-cols-[minmax(0,16rem)_1fr] gap-x-4 gap-y-1 text-[15px] leading-[22px]">
        {byPhase.map(([phase, hours]) => (
          <div key={phase} className="contents">
            <dt className="text-muted-foreground">{phase}</dt>
            <dd data-numeric>{hours.toLocaleString("en-US")} hours</dd>
          </div>
        ))}
      </dl>

      <h4 className="mt-4 text-[15px] font-medium">What drives it on this file</h4>
      <ul className="mt-2 max-w-[70ch] space-y-2 text-[15px] leading-[22px]">
        {drivers.map((t) => (
          <li key={`${t.phase}-${t.name}`}>
            <span data-numeric>{t.hours} hours</span> · {t.name}
            <span className="block text-[13px] leading-[18px] text-muted-foreground">{t.why}</span>
          </li>
        ))}
      </ul>

      {awardRange ? (
        <p className="mt-3 max-w-[70ch] text-[13px] leading-[18px] text-muted-foreground">{awardRange}</p>
      ) : null}

      <p className="mt-4 max-w-[70ch] text-[15px] leading-[22px]">
        Technical team — provide a work breakdown structure covering the procurement support work.
        The hours above are the reason for the ask: evaluation coordination, fact-finding, answers to
        questions and the technical write-ups all land on the requesting organization, and the award
        date moves with them.
      </p>

      <p className="mt-2 max-w-[70ch] text-[13px] leading-[18px] text-muted-foreground">
        {atIntake
          ? `An estimate was saved with the intake on ${atIntake.estimated_at.slice(0, 10)}. The figures above are the same model run against the record as it stands today.`
          : "No estimate was saved with the intake for this file. The figures above are the seeded level-of-effort model run against the record as it stands today."}{" "}
        <Link to="/estimate" className="text-primary hover:text-primary-hover">
          Open the estimate
        </Link>
        .
      </p>
    </div>
  );
}
