import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { daysBetween, formatMoney, todayISO } from "@/lib/intake";

export const Route = createFileRoute("/files_/$acquisitionId")({
  head: () => ({
    meta: [
      { title: "Acquisition file — T-Minus" },
      {
        name: "description",
        content: "The clock line, the facts of record, and the audit trail for one acquisition.",
      },
      { property: "og:title", content: "Acquisition file — T-Minus" },
      {
        property: "og:description",
        content: "Clock line, facts of record, and audit trail for one acquisition.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <PageHeader title="This file could not be loaded" lead="Go back to Files and open it again." />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <PageHeader title="File not found" lead="Go back to Files and choose an acquisition." />
    </AppShell>
  ),
  component: FilePage,
});

function FilePage() {
  const { acquisitionId } = Route.useParams();
  const { authState } = useRole();

  const q = useQuery({
    queryKey: ["acquisition", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [acq, log] = await Promise.all([
        supabase.from("acquisition_facts").select("*").eq("acquisition_id", acquisitionId).maybeSingle(),
        supabase
          .from("audit_log")
          .select("*")
          .eq("acquisition_id", acquisitionId)
          .order("logged_at", { ascending: false }),
      ]);
      let mission = null as { name: string | null; milestone_date: string | null } | null;
      if (acq.data?.mission_id) {
        const m = await supabase
          .from("missions")
          .select("name,milestone_date")
          .eq("mission_id", acq.data.mission_id)
          .maybeSingle();
        mission = m.data;
      }
      return { acq: acq.data, log: log.data ?? [], mission };
    },
  });

  const acq = q.data?.acq;
  const days = acq?.target_award_date ? daysBetween(todayISO(), acq.target_award_date) : null;

  return (
    <AppShell>
      <PageHeader
        title={acq?.title ?? acquisitionId}
        lead={acq ? `${acquisitionId} · ${acq.center_code ?? ""}` : "Loading the file."}
      />

      <section aria-label="Clock line" className="mb-10 rounded-xl bg-panel px-8 py-8 text-panel-foreground">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="clock-figure" data-numeric>
              {days === null ? "—" : days}
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">Days to award</p>
          </div>
          <div>
            <p className="text-[18px] leading-6 font-medium" data-numeric>
              {acq?.target_award_date ?? "—"}
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">Target award date</p>
          </div>
          <div>
            <p className="text-[18px] leading-6 font-medium">
              {acq?.clock_state === "running"
                ? "Clock running"
                : acq?.clock_state === "hold"
                  ? "On hold"
                  : acq?.clock_state === "launched"
                    ? "Launched"
                    : (acq?.clock_state ?? "—")}
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">
              {acq?.hold_reason ? `${acq.hold_reason} — owner ${acq.hold_owner ?? "unassigned"}` : "No hold"}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Facts of record</h2>
        <dl className="grid max-w-[80ch] gap-x-8 md:grid-cols-2">
          {(
            [
              ["Mission", q.data?.mission?.name ?? acq?.mission_id ?? "—"],
              ["Mission need date", acq?.need_date ?? "—"],
              ["Estimated value", acq?.estimated_value ? formatMoney(Number(acq.estimated_value)) : "—"],
              ["Contract type", acq?.contract_type ?? "—"],
              ["Acquisition method", acq?.acquisition_method ?? "—"],
              ["Competition", acq?.competition ?? "—"],
              ["Set-aside", acq?.set_aside ?? "—"],
              ["NAICS", acq?.naics_code ?? "—"],
              ["PSC", acq?.psc_code ?? "—"],
              ["Place of performance", acq?.place_of_performance ?? "—"],
              [
                "Period of performance",
                `${acq?.period_of_performance_start ?? "—"} to ${acq?.period_of_performance_end ?? "—"}`,
              ],
              ["Regulatory baseline date", acq?.regulatory_baseline_date ?? "—"],
              ["Current phase", acq?.current_phase ?? "—"],
              ["IGCE attached", acq?.igce_attached ? "Yes" : "No"],
              ["SOW or PWS attached", acq?.sow_attached ? "Yes" : "No"],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="mb-3">
              <dt className="text-[13px] text-muted-foreground">{k}</dt>
              <dd className="text-[15px]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Audit trail</h2>
        {q.data?.log.length ? (
          <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2">Logged</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Action</th>
                <th className="p-2">Field</th>
                <th className="p-2">New value</th>
                <th className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {q.data.log.map((row) => (
                <tr key={row.log_id} className="border-b border-border align-top">
                  <td className="p-2">{new Date(row.logged_at).toLocaleString()}</td>
                  <td className="p-2">{row.actor}</td>
                  <td className="p-2">{row.action}</td>
                  <td className="p-2">{row.field}</td>
                  <td className="p-2">{row.new_value}</td>
                  <td className="p-2">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground">No entries yet for this file.</p>
        )}
      </section>

      <Link to="/files" className="text-primary">
        Back to Files
      </Link>
    </AppShell>
  );
}
