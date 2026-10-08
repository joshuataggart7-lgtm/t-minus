import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { McPageHeader } from "@/components/ui-mc";
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
    <AppShell kit>
      <McPageHeader
        eyebrow="Request submitted"
        title="Your request is in"
        lead={q.data?.title ? `${acquisitionId} · ${q.data.title}` : acquisitionId}
        actions={
          <Link to="/files/$acquisitionId" params={{ acquisitionId }} className="mc-req-button">
            Open the file
          </Link>
        }
      />

      {q.isLoading ? <LoadingNote what="your estimate" /> : null}
      {q.isError ? (
        <ErrorNote message="The estimate did not load. Refresh the page; if it fails again, open the request from Files." />
      ) : null}

      {q.data && !est ? (
        <EmptyState
          sentence="No estimate was recorded for this request."
          action={
            <Link to="/files/$acquisitionId" params={{ acquisitionId }} className="underline">
              Open the file
            </Link>
          }
        />
      ) : null}

      {est ? (
        <div className="mc-confirm">
          <p className="mc-confirm-lead">{est.sentence}</p>

          <div className="mc-confirm-stats">
            <div className="mc-confirm-stat">
              <p className="mc-confirm-stat-label">Estimated months to award</p>
              <p className="mc-confirm-stat-value" data-numeric>{est.months_to_award}</p>
              <p className="mc-confirm-stat-note" data-numeric>
                The phase plan for this type plans {est.planned_days_to_award} calendar days to award.
              </p>
            </div>
            <div className="mc-confirm-stat">
              <p className="mc-confirm-stat-label">Phases to award</p>
              <p className="mc-confirm-stat-value" data-numeric>{est.phases.length}</p>
              <p className="mc-confirm-stat-note">Intake through award, as estimated when the clock started.</p>
            </div>
            <div className="mc-confirm-stat">
              <p className="mc-confirm-stat-label">Contracting hours</p>
              <p className="mc-confirm-stat-value" data-numeric>{est.hours_total.toLocaleString("en-US")}</p>
              <p className="mc-confirm-stat-note" data-numeric>
                Contracting officer {est.hours_co.toLocaleString("en-US")} · specialist{" "}
                {est.hours_cs.toLocaleString("en-US")}
              </p>
            </div>
          </div>

          <h2 className="mc-confirm-h">What the request passes through</h2>
          <ol className="mc-confirm-phases">
            {est.phases.map((p, i) => (
              <li key={p}>
                <span className="mc-confirm-phase-n" data-numeric>{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>

          <p className="mc-confirm-note">
            The estimate comes from the value, the competition approach, the pricing, the
            instrument, and the requirement type you entered. It is a planning figure, not a
            commitment; a protest, an audit, or a change in the requirement moves it. The file
            page shows the live phase count and countdown from here on.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to="/files/$acquisitionId" params={{ acquisitionId }} className="mc-req-button">
              Open the file
            </Link>
            <Link to="/files" className="mc-req-button is-secondary">
              See all requests
            </Link>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
