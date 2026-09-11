import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import type { StoredEstimate } from "@/lib/estimator";

export const Route = createFileRoute("/intake_/$acquisitionId")({
  head: () => ({
    meta: [
      { title: "Request submitted — T-Minus" },
      {
        name: "description",
        content: "What the request is expected to take: months to award, the phases, and the contracting hours behind it.",
      },
      { property: "og:title", content: "Request submitted — T-Minus" },
      {
        property: "og:description",
        content: "Months to award, the phases the request passes through, and the contracting hours behind it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { acquisitionId } = Route.useParams();
  const { authState } = useRole();

  const q = useQuery({
    queryKey: ["intake-confirmation", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_facts")
        .select("acquisition_id,title,need_date,target_award_date,intake_estimate")
        .eq("acquisition_id", acquisitionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const est = (q.data?.intake_estimate ?? null) as StoredEstimate | null;

  return (
    <AppShell>
      <PageHeader
        title="Your request is in"
        lead={`${acquisitionId} · ${q.data?.title ?? ""}`}
      />

      {q.isLoading ? <LoadingNote what="your estimate" /> : null}
      {q.isError ? (
        <ErrorNote message="The estimate did not load. Refresh the page; if it fails again, open the request from Files." />
      ) : null}

      {q.data && !est ? (
        <EmptyState
          sentence="No estimate was recorded for this request."
          actionLabel="Open the file"
          to="/files/$acquisitionId"
          params={{ acquisitionId }}
        />
      ) : null}

      {est ? (
        <>
          <p className="mb-8 max-w-[70ch] text-[18px] leading-[26px]">{est.sentence}</p>

          <div className="mb-8 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Months to award</p>
              <p className="text-[28px] font-semibold leading-[34px] tabular-nums">
                {est.months_to_award}
              </p>
              <p className="text-[13px] text-muted-foreground">
                About {est.planned_days_to_award} working days in the plan
              </p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Phases</p>
              <p className="text-[28px] font-semibold leading-[34px] tabular-nums">
                {est.phases.length}
              </p>
              <p className="text-[13px] text-muted-foreground">Intake through award</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Contracting hours</p>
              <p className="text-[28px] font-semibold leading-[34px] tabular-nums">
                {est.hours_total.toLocaleString("en-US")}
              </p>
              <p className="text-[13px] text-muted-foreground">
                Contracting officer {est.hours_co.toLocaleString("en-US")} · specialist{" "}
                {est.hours_cs.toLocaleString("en-US")}
              </p>
            </div>
          </div>

          <h2 className="mb-3 text-[18px] font-medium leading-[24px]">
            What the request passes through
          </h2>
          <ol className="mb-8 max-w-[70ch] border border-border bg-background text-[13px] leading-[18px]">
            {est.phases.map((p, i) => (
              <li key={p} className="flex gap-3 border-b border-border p-2 last:border-b-0">
                <span className="tabular-nums text-muted-foreground">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>

          <p className="mb-8 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">
            The estimate comes from the value, the competition approach, the pricing, the
            instrument, and the requirement type you entered. It is a planning figure, not a
            commitment; a protest, an audit, or a change in the requirement moves it.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/files/$acquisitionId"
              params={{ acquisitionId }}
              className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground"
            >
              Open the file
            </Link>
            <Link to="/files" className="rounded-lg border border-border px-4 py-2 text-[15px]">
              See all requests
            </Link>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
