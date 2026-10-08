import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { McPageHeader, DataTable } from "@/components/ui-mc";
import { planToAward } from "@/lib/file-timeline";
import type { PhasePlanRow } from "@/lib/launch-sequence";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import type { RefData } from "@/lib/intake";
import { estimate, inputsFromAcq, type StoredEstimate } from "@/lib/estimator";

export const Route = createFileRoute("/estimate")({
  head: () => ({
    meta: [
      { title: "Estimate · T-Minus" },
      {
        name: "description",
        content: "Contracting hours by phase and planned days to award for one acquisition, from the record.",
      },
      { property: "og:title", content: "Estimate · T-Minus" },
      {
        property: "og:description",
        content: "Contracting hours by phase and planned days to award for one acquisition, from the record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstimatePage,
});

function EstimatePage() {
  const { authState } = useRole();
  const [selected, setSelected] = useState<string>("");

  const q = useQuery({
    queryKey: ["estimate-page"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [acqs, plan, thresholds, overrides, strategies] = await Promise.all([
        supabase
          .from("acquisition_facts")
          .select(
            "acquisition_id,title,estimated_value,competition,contract_type,acquisition_method,contract_format,scenario,description_of_requirement,psc_code,intake_estimate",
          )
          .order("acquisition_id"),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("thresholds").select("*"),
        supabase.from("center_overrides").select("*"),
        supabase.from("enterprise_strategies").select("*"),
      ]);
      return {
        acqs: acqs.data ?? [],
        plan: plan.data ?? [],
        thresholds: thresholds.data ?? [],
        overrides: overrides.data ?? [],
        strategies: strategies.data ?? [],
      };
    },
  });

  const ref: RefData = useMemo(
    () => ({
      thresholds: (q.data?.thresholds ?? []).map((t) => ({
        name: t.name,
        value: t.value === null ? null : Number(t.value),
        citation: t.citation,
        note: t.note,
      })),
      overrides: (q.data?.overrides ?? []) as unknown as CenterOverrideRow[],
      phasePlan: (q.data?.plan ?? []).map((p) => ({
        acquisition_type: p.acquisition_type,
        phase: p.phase,
        planned_days: p.planned_days,
      })),
      strategies: (q.data?.strategies ?? []).map((s) => ({
        psl: s.psl,
        name: s.name,
        buying_location: s.buying_location,
        mandatory_vehicles: s.mandatory_vehicles,
        required_coordination: s.required_coordination,
      })),
    }),
    [q.data],
  );

  const acq = useMemo(
    () => (q.data?.acqs ?? []).find((a) => a.acquisition_id === selected) ?? (q.data?.acqs ?? [])[0] ?? null,
    [q.data, selected],
  );

  const est = useMemo(() => (acq ? estimate(inputsFromAcq(acq), ref) : null), [acq, ref]);
  const atIntake = (acq?.intake_estimate ?? null) as StoredEstimate | null;
  // Days and phases come from the one phase-plan source the file page uses.
  const plan = useMemo(
    () => (acq ? planToAward(acq as Record<string, unknown>, (q.data?.plan ?? []) as unknown as PhasePlanRow[]) : null),
    [acq, q.data],
  );

  const byPhase = useMemo(() => {
    const out = new Map<string, { hours: number; names: string[] }>();
    for (const task of est?.tasks ?? []) {
      const row = out.get(task.phase) ?? { hours: 0, names: [] };
      row.hours += task.hours;
      row.names.push(`${task.name} (${task.hours} h)`);
      out.set(task.phase, row);
    }
    return [...out.entries()];
  }, [est]);

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Level of effort"
        title="Estimate"
        lead="Contracting hours by phase and planned days to award, read from the record with the seeded level-of-effort model. Days and phases come from the same phase plan the file page uses."
      />

      {q.isLoading ? <LoadingNote what="the acquisitions and the phase plan" /> : null}
      {q.isError ? <ErrorNote message="The estimate did not load. Refresh the page to try again." /> : null}

      {q.data && !q.data.acqs.length ? (
        <EmptyState sentence="No acquisition has been entered yet. Start one on Intake." />
      ) : null}

      {q.data && acq && est && plan ? (
        <>
          <div className="mc-est-pick">
            <label htmlFor="estimate-acq" className="mc-field-label">Acquisition</label>
            <select id="estimate-acq" value={acq.acquisition_id} onChange={(e) => setSelected(e.target.value)} className="mc-input">
              {q.data.acqs.map((a) => (
                <option key={a.acquisition_id} value={a.acquisition_id}>
                  {a.acquisition_id} · {a.title}
                </option>
              ))}
            </select>
            <p className="mc-est-lead" data-numeric>
              {plan.plannedDays
                ? `The phase plan for this kind of buy runs ${plan.plannedDays} calendar days from intake to award, through ${plan.phases.length} phases, with about ${est.hours.total.toLocaleString("en-US")} hours of contracting work.`
                : `The seeded phase plan has no entry for this type. The model counts about ${est.hours.total.toLocaleString("en-US")} hours of contracting work.`}
            </p>
          </div>

          <div className="mc-today-stats mc-est-stats">
            <div className="mc-today-stat">
              <span className="mc-today-stat-value" data-numeric>{plan.plannedDays || "None"}</span>
              <span className="mc-today-stat-label">Planned calendar days to award</span>
            </div>
            <div className="mc-today-stat">
              <span className="mc-today-stat-value" data-numeric>{plan.phases.length}</span>
              <span className="mc-today-stat-label">Phases to award</span>
            </div>
            <div className="mc-today-stat">
              <span className="mc-today-stat-value" data-numeric>{est.hours.total.toLocaleString("en-US")}</span>
              <span className="mc-today-stat-label">Contracting hours (estimate)</span>
            </div>
            <div className="mc-today-stat">
              <span className="mc-today-stat-value" data-numeric>
                {est.hours.cs.toLocaleString("en-US")} / {est.hours.co.toLocaleString("en-US")}
              </span>
              <span className="mc-today-stat-label">Specialist / officer hours</span>
            </div>
          </div>

          <div className="mc-est-grid">
            <section aria-labelledby="est-hours-h">
              <h2 id="est-hours-h" className="mc-confirm-h">Hours by phase</h2>
              <DataTable
                label="Hours by phase"
                rows={byPhase}
                rowKey={([phase]) => phase}
                stackOnMobile
                columns={[
                  { key: "phase", header: "Phase", rowHeader: true, width: "28%", cell: ([phase]) => phase },
                  { key: "hours", header: "Hours", mobileLabel: "Hours", numeric: true, nowrap: true, width: "10%", cell: ([, row]) => row.hours },
                  { key: "work", header: "Work counted", mobileLabel: "Work counted", cell: ([, row]) => <span className="mc-files-meta mt-0">{row.names.join("; ")}</span> },
                ]}
              />
            </section>
            <aside className="mc-est-side" aria-label="Phases and the estimate at intake">
              <h2 className="mc-confirm-h">Phases to award</h2>
              {plan.phases.length ? (
                <ol className="mc-confirm-phases mc-est-phases">
                  {plan.phases.map((p, i) => (
                    <li key={`${i}-${p}`}>
                      <span className="mc-confirm-phase-n" data-numeric>{i + 1}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mc-files-meta">The seeded phase plan has no entry for this type.</p>
              )}
              <h2 className="mc-confirm-h mt-6">Estimate at intake</h2>
              <p className="text-[15px] leading-[22px]" data-numeric>
                {atIntake
                  ? `${atIntake.hours_total.toLocaleString("en-US")} contracting hours, recorded ${String(atIntake.estimated_at).slice(0, 10)}.`
                  : "No estimate was recorded when this file was submitted."}
              </p>
            </aside>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
