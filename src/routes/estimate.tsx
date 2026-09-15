import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import type { RefData } from "@/lib/intake";
import { estimate, inputsFromAcq, type StoredEstimate } from "@/lib/estimator";

export const Route = createFileRoute("/estimate")({
  head: () => ({
    meta: [
      { title: "Estimate — T-Minus" },
      {
        name: "description",
        content: "Contracting hours by phase and months to award for one acquisition, from the record.",
      },
      { property: "og:title", content: "Estimate — T-Minus" },
      {
        property: "og:description",
        content: "Contracting hours by phase and months to award for one acquisition, from the record.",
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
            "acquisition_id,title,estimated_value,competition,contract_type,acquisition_method,description_of_requirement,psc_code,intake_estimate",
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
    <AppShell>
      <PageHeader
        title="Estimate"
        lead="Contracting hours by phase and months to award, read from the record with the seeded level-of-effort model."
      />

      {q.isLoading ? <LoadingNote what="the acquisitions and the phase plan" /> : null}
      {q.isError ? <ErrorNote message="The estimate did not load. Refresh the page to try again." /> : null}

      {q.data && !q.data.acqs.length ? (
        <EmptyState sentence="No acquisition has been entered yet. Start one on Intake." />
      ) : null}

      {q.data && acq && est ? (
        <>
          <label className="mb-6 block max-w-[60ch] text-[15px]">
            Acquisition
            <select
              value={acq.acquisition_id}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2"
            >
              {q.data.acqs.map((a) => (
                <option key={a.acquisition_id} value={a.acquisition_id}>
                  {a.acquisition_id} — {a.title}
                </option>
              ))}
            </select>
          </label>

          <p className="mb-6 max-w-[80ch] text-[15px] leading-[22px]">{est.sentence}</p>

          <dl className="mb-8 grid max-w-[80ch] grid-cols-2 gap-4 text-[15px] sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Months to award</dt>
              <dd data-numeric>{est.monthsToAward}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Planned working days in the launch sequence</dt>
              <dd data-numeric>{est.plannedDaysToAward}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contracting hours</dt>
              <dd data-numeric>{est.hours.total.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Specialist / officer split</dt>
              <dd data-numeric>
                {est.hours.cs.toLocaleString("en-US")} / {est.hours.co.toLocaleString("en-US")}
              </dd>
            </div>
          </dl>

          <h2 className="section-title text-[18px] leading-6 font-medium">Hours by phase</h2>
          <table className="mt-3 w-full max-w-[80ch] border border-border text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-2">Phase</th>
                <th scope="col" className="p-2">Hours</th>
                <th scope="col" className="p-2">Work counted</th>
              </tr>
            </thead>
            <tbody>
              {byPhase.map(([phase, row]) => (
                <tr key={phase} className="border-b border-border align-top">
                  <td className="p-2">{phase}</td>
                  <td className="p-2" data-numeric>{row.hours}</td>
                  <td className="p-2 text-muted-foreground">{row.names.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="section-title mt-8 text-[18px] leading-6 font-medium">Phases to award</h2>
          <p className="mt-2 max-w-[80ch] text-[15px] leading-[22px]">
            {est.phases.length ? est.phases.join(" · ") : "The seeded phase plan has no entry for this type."}
          </p>

          <h2 className="section-title mt-8 text-[18px] leading-6 font-medium">Estimate at intake</h2>
          <p className="mt-2 max-w-[80ch] text-[15px] leading-[22px]">
            {atIntake
              ? `${atIntake.months_to_award} months, ${atIntake.hours_total.toLocaleString("en-US")} contracting hours, recorded ${String(atIntake.estimated_at).slice(0, 10)}.`
              : "No estimate was recorded when this file was submitted."}
          </p>
        </>
      ) : null}
    </AppShell>
  );
}
