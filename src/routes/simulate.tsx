import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import type { RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, ReviewRuleRow } from "@/lib/launch-sequence";
import { money, simulate, type SimChange } from "@/lib/simulate";

export const Route = createFileRoute("/simulate")({
  head: () => ({
    meta: [
      { title: "Policy impact simulator — T-Minus" },
      {
        name: "description",
        content:
          "Change a threshold or a review trigger and see how many days move across the active files, without changing anything.",
      },
      { property: "og:title", content: "Policy impact simulator — T-Minus" },
      {
        property: "og:description",
        content: "See what a threshold or review trigger change would do to the files in flight.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SimulatePage,
});

function SimulatePage() {
  const { authState, role } = useRole();
  const mayUse = role === "executive" || role === "hq";

  const [kind, setKind] = useState<"threshold" | "review_trigger">("review_trigger");
  const [target, setTarget] = useState("Legal review");
  const [value, setValue] = useState("1000000");
  const [applied, setApplied] = useState<SimChange | null>(null);

  const q = useQuery({
    queryKey: ["simulate"],
    enabled: authState === "signed-in" && mayUse,
    queryFn: async () => {
      const [acqs, plan, rules, overrides, thresholds, strategies] = await Promise.all([
        supabase.from("acquisition_facts").select("*").order("acquisition_id"),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("review_rules").select("*").order("reviewer_role"),
        supabase.from("center_overrides").select("*"),
        supabase.from("thresholds").select("*").order("name"),
        supabase.from("enterprise_strategies").select("*"),
      ]);
      return {
        acqs: (acqs.data ?? []) as unknown as AcqRow[],
        plan: (plan.data ?? []) as PhasePlanRow[],
        rules: (rules.data ?? []) as ReviewRuleRow[],
        overrides: overrides.data ?? [],
        thresholds: thresholds.data ?? [],
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

  const result = useMemo(() => {
    if (!q.data || !applied) return null;
    return simulate(q.data.acqs, q.data.rules, q.data.plan, ref, applied);
  }, [q.data, applied, ref]);

  const thresholdNames = useMemo(
    () => (q.data?.thresholds ?? []).map((t) => String(t.name ?? "")).filter(Boolean),
    [q.data],
  );
  const roles = useMemo(
    () => Array.from(new Set((q.data?.rules ?? []).map((r) => r.reviewer_role).filter(Boolean))),
    [q.data],
  );

  const loadedNow = useMemo(() => {
    if (kind === "threshold") {
      const row = (q.data?.thresholds ?? []).find((t) => String(t.name ?? "") === target);
      return row?.value === null || row?.value === undefined ? null : Number(row.value);
    }
    return null;
  }, [kind, target, q.data]);

  if (!mayUse) {
    return (
      <AppShell>
        <PageHeader
          title="Policy impact simulator"
          lead="Change a threshold or a review trigger and see how many days move across the files in flight."
        />
        <p className="text-muted">
          The simulator is open to executives and HQ. Nothing here changes a record.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Policy impact simulator"
        lead="Change a threshold value or a review trigger and see, across every active file, how many days move and where. Nothing is written."
      />

      {q.isLoading ? <LoadingNote what="the rules and the files" /> : null}
      {q.error ? <ErrorNote message="The rules and files could not be read. Reload the page to try again." /> : null}

      {q.data ? (
        <>
          <section className="mb-8 max-w-3xl">
            <h2 className="section-heading">What to change</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sim-kind" className="field-label">
                  Kind of rule
                </label>
                <select
                  id="sim-kind"
                  className="field-control"
                  value={kind}
                  onChange={(e) => {
                    const k = e.target.value as "threshold" | "review_trigger";
                    setKind(k);
                    setTarget(k === "threshold" ? (thresholdNames[0] ?? "") : (roles[0] ?? ""));
                    setApplied(null);
                  }}
                >
                  <option value="review_trigger">Review rule trigger</option>
                  <option value="threshold">Threshold</option>
                </select>
              </div>
              <div>
                <label htmlFor="sim-target" className="field-label">
                  {kind === "threshold" ? "Threshold" : "Reviewer"}
                </label>
                <select
                  id="sim-target"
                  className="field-control"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setApplied(null);
                  }}
                >
                  {(kind === "threshold" ? thresholdNames : roles).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sim-value" className="field-label">
                  Proposed value in dollars
                </label>
                <input
                  id="sim-value"
                  className="field-control tabular-nums"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setApplied(null);
                  }}
                />
                {kind === "threshold" && loadedNow !== null ? (
                  <p className="mt-1 text-sm text-muted">Loaded today: {money(loadedNow)}.</p>
                ) : null}
                {kind === "review_trigger" ? (
                  <p className="mt-1 text-sm text-muted">
                    The reviewer's trigger as written is shown in the review rules; the proposed value is
                    read as if every Center carried it.
                  </p>
                ) : null}
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const n = Number(String(value).replace(/[^0-9.]/g, ""));
                    if (!Number.isFinite(n)) return;
                    setApplied({ kind, target, value: n });
                  }}
                >
                  Run the simulation
                </button>
              </div>
            </div>
          </section>

          {result ? (
            <section>
              <h2 className="section-heading">What would move</h2>
              <p className="mb-2 text-lg">{result.headline}</p>
              <p className="mb-6 text-sm text-muted">
                {result.filesConsidered} active files considered. {result.method}
              </p>

              {result.filesAffected.length === 0 ? (
                <EmptyState sentence="Every active file keeps the same review steps and the same planned days under this value." />
              ) : (
                <table className="data-table">
                  <caption className="sr-only">Files whose planned days change under the proposed value</caption>
                  <thead>
                    <tr>
                      <th scope="col">File</th>
                      <th scope="col">Center</th>
                      <th scope="col">Estimated value</th>
                      <th scope="col">Planned days now</th>
                      <th scope="col">Planned days then</th>
                      <th scope="col">Difference</th>
                      <th scope="col">Review steps that change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.filesAffected.map((f) => (
                      <tr key={f.acquisition_id}>
                        <th scope="row" className="font-normal">
                          <Link to="/files/$acquisitionId" params={{ acquisitionId: f.acquisition_id }}>
                            {f.acquisition_id}
                          </Link>
                          <span className="block text-muted">{f.title}</span>
                        </th>
                        <td>{f.center_code ?? "not recorded"}</td>
                        <td className="tabular-nums">{money(f.estimated_value)}</td>
                        <td className="tabular-nums">{f.daysNow}</td>
                        <td className="tabular-nums">{f.daysThen}</td>
                        <td className="tabular-nums">
                          {f.daysSooner > 0
                            ? `${f.daysSooner} days sooner`
                            : `${Math.abs(f.daysSooner)} days longer`}
                        </td>
                        <td>
                          {f.removed.length ? <span className="block">Loses {f.removed.join(", ")}</span> : null}
                          {f.added.length ? <span className="block">Gains {f.added.join(", ")}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
