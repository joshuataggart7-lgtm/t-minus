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
  const { authState, hasAnyRole } = useRole();
  const mayUse = hasAnyRole(["executive", "hq"]);

  const [kind, setKind] = useState<"threshold" | "review_trigger">("review_trigger");
  const [target, setTarget] = useState("");
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

  const options = kind === "threshold" ? thresholdNames : roles;
  const chosen = target || options[0] || "";

  const loadedNow = useMemo(() => {
    if (kind === "threshold") {
      const row = (q.data?.thresholds ?? []).find((t) => String(t.name ?? "") === chosen);
      return row?.value === null || row?.value === undefined ? null : Number(row.value);
    }
    return null;
  }, [kind, chosen, q.data]);

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

      <p
        role="note"
        className="mc-work-summary mt-4 max-w-[80ch] text-sm text-muted"
      >
        <strong className="text-foreground">Simulation · Sandbox — not saved.</strong>{" "}
        Advisory only — no open file is changed by this screen.
      </p>

      {q.isLoading ? <LoadingNote what="the rules and the files" /> : null}
      {q.error ? <ErrorNote message="The rules and files could not be read. Reload the page to try again." /> : null}

      {q.data ? (
        <>
          <section className="mt-8 max-w-[80ch] border-t border-border pt-6">
            <h2 className="text-lg font-medium">What to change</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sim-kind" className="block text-sm text-muted">
                  Kind of rule
                </label>
                <select
                  id="sim-kind"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                  value={kind}
                  onChange={(e) => {
                    const k = e.target.value as "threshold" | "review_trigger";
                    setKind(k);
                    setTarget("");
                    setApplied(null);
                  }}
                >
                  <option value="review_trigger">Review rule trigger</option>
                  <option value="threshold">Threshold</option>
                </select>
              </div>
              <div>
                <label htmlFor="sim-target" className="block text-sm text-muted">
                  {kind === "threshold" ? "Threshold" : "Reviewer"}
                </label>
                <select
                  id="sim-target"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                  value={chosen}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setApplied(null);
                  }}
                >
                  {options.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sim-value" className="block text-sm text-muted">
                  Proposed value in dollars
                </label>
                <input
                  id="sim-value"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
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
                  className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
                  onClick={() => {
                    const n = Number(String(value).replace(/[^0-9.]/g, ""));
                    if (!Number.isFinite(n)) return;
                    setApplied({ kind, target: chosen, value: n });
                  }}
                >
                  Run the simulation
                </button>
              </div>
            </div>
          </section>

          {result ? (
            <section className="mt-10">
              <h2 className="text-lg font-medium">What would move</h2>
              <p className="mb-2 text-lg">{result.headline}</p>
              <p className="mb-6 text-sm text-muted">
                {result.filesConsidered} active files considered. {result.method}
              </p>

              {result.filesAffected.length === 0 ? (
                <EmptyState sentence="No open file's rows would change under this what-if." />
              ) : (
                <div className="mc-work-table-wrap">
                <table className="mt-3 w-full border-collapse text-[13px] leading-[18px]">
                  <caption className="sr-only">Files whose planned days change under the proposed value</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th scope="col" className="py-2 pr-4 font-medium">File</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Center</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Estimated value</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Planned days now</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Planned days then</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Difference</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Review steps that change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.filesAffected.map((f) => (
                      <tr key={f.acquisition_id} className="border-b border-border align-top">
                        <th scope="row" className="py-2 pr-4 text-left font-normal">
                          <Link to="/files/$acquisitionId" params={{ acquisitionId: f.acquisition_id }}>
                            {f.acquisition_id}
                          </Link>
                          <span className="block text-muted">{f.title}</span>
                        </th>
                        <td className="py-2 pr-4">{f.center_code ?? "not recorded"}</td>
                        <td className="py-2 pr-4 tabular-nums">{money(f.estimated_value)}</td>
                        <td className="py-2 pr-4 tabular-nums">{f.daysNow}</td>
                        <td className="py-2 pr-4 tabular-nums">{f.daysThen}</td>
                        <td className="py-2 pr-4 tabular-nums">
                          {f.daysSooner > 0
                            ? `${f.daysSooner} days sooner`
                            : `${Math.abs(f.daysSooner)} days longer`}
                        </td>
                        <td className="py-2 pr-4">
                          {f.removed.length ? <span className="block">Loses {f.removed.join(", ")}</span> : null}
                          {f.added.length ? <span className="block">Gains {f.added.join(", ")}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
