// The Vehicle panel on a parent IDIQ or BPA file: every order issued under it,
// the obligated total against the ceiling, and the days left in the ordering
// period. On an order, the line that names the parent.

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { scenarioOf } from "@/lib/scenario";
import { acquisitionProfile, vehicleOf } from "@/lib/vehicles";

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? "not set" : `$${Number(n).toLocaleString("en-US")}`;

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function VehiclePanel({
  acq,
  todayISO,
}: {
  acq: Record<string, unknown> | null | undefined;
  todayISO: string;
}) {
  const acquisitionId = String(acq?.["acquisition_id"] ?? "");
  const contractNumber = String(acq?.["contract_number"] ?? "").trim();
  const profile = acq ? acquisitionProfile(acq) : "new_contract";
  const isParent = profile === "idiq_parent" || profile === "bpa";

  const orders = useQuery({
    queryKey: ["vehicle-orders", acquisitionId, contractNumber],
    enabled: isParent && Boolean(contractNumber),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_facts")
        .select("acquisition_id,title,estimated_value,current_phase,clock_state,target_award_date")
        .eq("parent_contract_number", contractNumber)
        .order("acquisition_id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (!acq) return null;

  if (profile === "order_under_idiq" || profile === "fss_order") {
    const parent = String(acq["parent_contract_number"] ?? scenarioOf(acq).parent_contract_number ?? "").trim();
    const raw = (acq["vehicle"] ?? {}) as Record<string, unknown>;
    const fair = String(raw["fair_opportunity"] ?? "").trim();
    const fairLine = !fair
      ? "Not recorded. Enter the fair opportunity decision or the exception relied on before the order is placed."
      : fair === "competed"
        ? "Fair opportunity given to every awardee under the vehicle, FAR 16.505(b)(1)."
        : `Exception recorded on this file: ${fair.replace(/_/g, " ")}, FAR 16.505(b)(2).`;
    const method = String(acq["acquisition_method"] ?? "").trim();
    return (
      <section aria-label="Parent vehicle" className="mb-10 max-w-[80ch] border-t border-border pt-4">
        <h2 className="text-[18px] leading-6 font-medium">Parent vehicle</h2>
        <p className="mt-2 text-[15px] leading-[22px]">
          {parent
            ? `This order is placed under ${parent}. The contract type options, clause set, NAICS and ordering period come from the parent.`
            : "No parent contract number is on this record yet. Enter it on the intake so the order can inherit the vehicle terms."}
        </p>
        <p className="mt-3 inline-block border border-border px-2 py-1 text-[13px] leading-[18px]">
          Order under an existing vehicle, not a stand-alone Part 15 award.
        </p>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-[15px] leading-[22px] sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-muted-foreground">Parent contract number</dt>
            <dd>{parent || "Not recorded"}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted-foreground">Fair opportunity</dt>
            <dd>{fairLine}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted-foreground">Format and method</dt>
            <dd>{method || "Not recorded"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] leading-[18px] text-muted-foreground">
          The order line items are order specific. The parent ceiling is not an order line item and
          is never carried onto the order schedule. Advisory only; nothing here holds the file.
        </p>
      </section>
    );
  }

  if (!isParent) return null;

  const v = vehicleOf(acq);
  const rows = orders.data ?? [];
  const obligated = rows.reduce((sum, r) => sum + Number(r.estimated_value ?? 0), 0);
  const left = v.ordering_end ? daysBetween(todayISO, v.ordering_end) : null;

  return (
    <section aria-label="Vehicle" className="mb-10 rounded-xl border border-border bg-background p-5">
      <h2 className="text-[18px] leading-6 font-medium">Vehicle</h2>
      <dl className="mt-3 grid gap-x-8 gap-y-2 text-[15px] leading-[22px] sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-muted-foreground">Award</dt>
          <dd>{v.award_type === "single" ? "Single award" : "Multiple award"}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Ceiling</dt>
          <dd data-numeric>{money(v.ceiling)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Minimum guarantee</dt>
          <dd data-numeric>{money(v.minimum_guarantee)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Ordering period</dt>
          <dd>
            {v.ordering_start ?? "not set"} to {v.ordering_end ?? "not set"}
            {left !== null ? `, ${Math.max(0, left).toLocaleString("en-US")} days left` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Order types allowed</dt>
          <dd>{v.order_types.length ? v.order_types.join(", ") : "not set"}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Fair opportunity</dt>
          <dd>
            {v.fair_opportunity === "competed"
              ? "Fair opportunity to every awardee, FAR 16.505(b)(1)"
              : `Exception relied on: ${String(v.fair_opportunity).replace(/_/g, " ")}`}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Clause set at award</dt>
          <dd>{v.clause_set || "not set"}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Obligated against the ceiling</dt>
          <dd data-numeric>
            {money(obligated)}
            {v.ceiling ? ` of ${money(v.ceiling)}, ${money(Number(v.ceiling) - obligated)} remaining` : ""}
          </dd>
        </div>
      </dl>

      {v.awardees.length ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Awardees: {v.awardees.map((a) => `${a.name} (${a.uei})`).join("; ")}
        </p>
      ) : null}

      <h3 className="mt-5 text-[15px] font-medium">Orders issued under this vehicle</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">
          No orders are recorded yet. An order is created at intake by choosing "Order under an
          existing IDIQ" and naming this contract number.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                <th scope="col" className="py-2 pr-4 font-medium">Title</th>
                <th scope="col" className="py-2 pr-4 font-medium">Value</th>
                <th scope="col" className="py-2 font-medium">Phase</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.acquisition_id} className="border-b border-border">
                  <td className="py-2 pr-4">
                    <Link to="/files/$acquisitionId" params={{ acquisitionId: r.acquisition_id }} className="text-primary">
                      {r.acquisition_id}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{r.title}</td>
                  <td className="py-2 pr-4" data-numeric>{money(Number(r.estimated_value ?? 0))}</td>
                  <td className="py-2">
                    {r.clock_state === "launched" ? "Launched" : (r.current_phase ?? "Intake")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
