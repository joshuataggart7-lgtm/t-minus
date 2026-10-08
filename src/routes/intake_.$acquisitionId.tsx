import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, LoadingNote, ErrorNote } from "@/components/app-shell";
import { McPageHeader, StatusChip, WithDetailsPanel, DetailsSection, DetailsList } from "@/components/ui-mc";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import type { StoredEstimate } from "@/lib/estimator";
import { useDeskData } from "@/lib/desk-data";
import { countdownView } from "@/components/launch-countdown";
import { formatDate } from "@/lib/metrics";
import { dayWord } from "@/lib/pluralize";
import { contractingHours, phasePosition, phasePositionText, planToAward } from "@/lib/file-timeline";
import { isPostAward, owedRows } from "@/lib/requester-owed";

export const Route = createFileRoute("/intake_/$acquisitionId")({
  head: () => ({
    meta: [
      { title: "Request submitted — T-Minus" },
      {
        name: "description",
        content: "What the request is expected to take: planned days to award, the phases, and the contracting hours behind it.",
      },
      { property: "og:title", content: "Request submitted — T-Minus" },
      {
        property: "og:description",
        content: "Planned days to award, the phases the request passes through, and the contracting hours behind it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { acquisitionId } = Route.useParams();
  const { authState, roles } = useRole();
  const signedIn = authState === "signed-in";

  const q = useQuery({
    queryKey: ["intake-confirmation", acquisitionId],
    enabled: signedIn,
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
  // The live file, read the way the requester portal reads it, so the dates,
  // countdown and phase count match the file page.
  const { desk, isLoading: deskLoading } = useDeskData(signedIn);
  const card = desk?.cards.find((c) => c.m.acq.acquisition_id === acquisitionId) ?? null;

  const est = (q.data?.intake_estimate ?? null) as StoredEstimate | null;
  const title = q.data?.title ?? (card ? String((card.m.acq as Record<string, unknown>)["title"] ?? "") : "");
  const backTo = roles.includes("requester") ? { to: "/requester" as const, label: "Back to your requests" } : { to: "/files" as const, label: "See all files" };

  const view = card ? countdownView(card.m) : null;
  const position = card ? phasePosition(card.m.phases) : null;
  const plan = card ? planToAward(card.m.acq, desk?.plan ?? []) : null;
  const hours = card
    ? contractingHours({ ...(card.m.acq as Record<string, unknown>), intake_estimate: est ?? (card.m.acq as Record<string, unknown>)["intake_estimate"] ?? null }, desk?.plan ?? [])
    : null;
  const owed = card ? owedRows(card) : [];
  const needed = owed.filter((o) => !o.present);
  const awarded = card ? isPostAward(card) : false;
  const target = card?.m.acq.target_award_date ? String(card.m.acq.target_award_date) : (q.data?.target_award_date ?? null);
  const needDate = (card?.m.acq.need_date ? String(card.m.acq.need_date) : null) ?? q.data?.need_date ?? null;
  const opened = card ? ((card.m.acq as Record<string, unknown>)["created_at"] as string | null) : null;

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Request submitted"
        title="Your request is in"
        lead={title ? `${acquisitionId} · ${title}` : acquisitionId}
        actions={
          <Link to="/files/$acquisitionId" params={{ acquisitionId }} className="mc-req-button">
            Open the file
          </Link>
        }
      />

      {q.isLoading || (deskLoading && !card) ? <LoadingNote what="your request" /> : null}
      {q.isError ? (
        <ErrorNote message="The request did not load. Refresh the page; if it fails again, open the request from Files." />
      ) : null}

      {card && view && position && plan ? (
        <WithDetailsPanel
          panelLabel="Contact and dates"
          panel={
            <>
              <DetailsSection title="Who to contact">
                <p className="mc-req-panel-text">Your contracting officer</p>
                <p className="mc-confirm-contact">{card.owner}</p>
              </DetailsSection>
              <DetailsSection title="Dates">
                <DetailsList
                  items={[
                    { term: "Clock started", value: <span data-numeric>{opened ? formatDate(opened.slice(0, 10)) : "Not recorded"}</span> },
                    { term: "Target award date", value: <span data-numeric>{target ? formatDate(target) : "Not set yet"}</span> },
                    ...(card.m.forecastAwardDate && !target ? [{ term: "Forecast award", value: <span data-numeric>{formatDate(card.m.forecastAwardDate)}</span> }] : []),
                    { term: "Mission need date", value: <span data-numeric>{needDate ? formatDate(needDate) : "Not recorded"}</span> },
                  ]}
                />
              </DetailsSection>
              <DetailsSection title="Your request">
                <DetailsList
                  items={[
                    { term: "Acquisition", value: <span data-numeric>{acquisitionId}</span> },
                    { term: "Requester", value: card.requester || "Not recorded" },
                    { term: "Mission", value: card.mission },
                  ]}
                />
              </DetailsSection>
            </>
          }
        >
          <div className="mc-confirm">
            <p className="mc-confirm-lead">
              {awarded
                ? `This request is awarded. ${card.owner} runs the contract from here.`
                : `It is with ${card.owner}. The file is in ${position.name ?? "its first phase"}, and the countdown below is the same one the file page shows.`}
            </p>

            <div className="mc-confirm-stats">
              <div className="mc-confirm-stat">
                <p className="mc-confirm-stat-label">When</p>
                <p className="mc-confirm-stat-value" data-numeric>
                  {view.days === null ? (view.mode === "stopped" ? "Stopped" : "Not started") : `${view.prefix ?? ""}${view.days}`}
                  {view.days !== null ? <span className="mc-confirm-stat-unit">{view.pastTarget ? `${dayWord(view.days)} past target` : dayWord(view.days)}</span> : null}
                </p>
                <p className="mc-confirm-stat-note">
                  {view.mode === "launched"
                    ? "Since award."
                    : view.mode === "forecast"
                      ? "To the forecast award date. No target date is on file yet."
                      : view.mode === "hold"
                        ? "The clock is on hold."
                        : target
                          ? `To the target award date, ${formatDate(target)}.`
                          : view.caption}
                </p>
                {view.badge ? <StatusChip label={view.badge} tone={view.badge === "OVERDUE" || view.badge === "HOLD" ? "atrisk" : view.badge === "AWARDED" ? "launched" : "neutral"} className="mt-2" /> : null}
              </div>
              <div className="mc-confirm-stat">
                <p className="mc-confirm-stat-label">Planned time to award</p>
                <p className="mc-confirm-stat-value" data-numeric>
                  {plan.plannedDays}
                  <span className="mc-confirm-stat-unit">calendar days</span>
                </p>
                <p className="mc-confirm-stat-note" data-numeric>
                  {plan.phases.length} phases up to award. The file is at {phasePositionText(position).toLowerCase()}, counting the phases after award.
                </p>
              </div>
              <div className="mc-confirm-stat">
                <p className="mc-confirm-stat-label">Contracting hours (estimate)</p>
                <p className="mc-confirm-stat-value" data-numeric>
                  {hours ? hours.total.toLocaleString("en-US") : "Not available"}
                  {hours ? <span className="mc-confirm-stat-unit">hours</span> : null}
                </p>
                <p className="mc-confirm-stat-note" data-numeric>
                  {hours
                    ? `${hours.source === "intake" ? "Saved with the intake." : "Current estimate; none was saved with this intake."} Specialist ${hours.cs.toLocaleString("en-US")} · officer ${hours.co.toLocaleString("en-US")}.`
                    : "No estimate could be worked from the record yet."}
                </p>
              </div>
            </div>

            <h2 className="mc-confirm-h">What happens next</h2>
            <ol className="mc-confirm-steps">
              <li>
                <span className="mc-confirm-step-n" aria-hidden="true">1</span>
                <div>
                  <p className="font-medium">{awarded ? "The contract is running" : `Your contracting officer works the file: ${card.m.nextDecision}`}</p>
                  <p className="mc-req-meta">
                    {card.m.nextDecisionDate
                      ? `Planned by ${formatDate(card.m.nextDecisionDate)} in the phase plan.`
                      : "No date is planned for this step yet."}
                  </p>
                </div>
              </li>
              <li>
                <span className="mc-confirm-step-n" aria-hidden="true">2</span>
                <div>
                  {awarded || needed.length === 0 ? (
                    <p className="font-medium">Nothing is needed from you right now.</p>
                  ) : (
                    <>
                      <p className="font-medium">Send what is still needed from you</p>
                      <ul className="mc-confirm-needed">
                        {needed.map((o) => (
                          <li key={o.label}>
                            {o.label}
                            <StatusChip label="Needed" tone="attention" />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </li>
              <li>
                <span className="mc-confirm-step-n" aria-hidden="true">3</span>
                <div>
                  <p className="font-medium">Follow progress</p>
                  <p className="mc-req-meta">
                    The countdown, phase and anything owed stay current on{" "}
                    <Link to={backTo.to} className="text-primary underline underline-offset-2">
                      {roles.includes("requester") ? "your requests page" : "the files list"}
                    </Link>
                    .
                  </p>
                </div>
              </li>
            </ol>

            <h2 className="mc-confirm-h">Phases to award</h2>
            <ol className="mc-confirm-phases">
              {plan.phases.map((p, i) => {
                const pv = card.m.phases.find((x) => x.phase === p);
                return (
                  <li key={`${i}-${p}`} className={pv?.status === "current" ? "is-current" : pv?.status === "complete" ? "is-complete" : undefined}>
                    <span className="mc-confirm-phase-n" data-numeric>{i + 1}</span>
                    <span>{p}</span>
                    {pv?.status === "current" ? <StatusChip label="Now" tone="info" className="ml-auto" /> : null}
                  </li>
                );
              })}
            </ol>

            <p className="mc-confirm-note">
              Planned days come from the phase plan for this kind of buy. They are a plan, not a promise; a
              protest, an audit, or a change in the requirement moves them.
            </p>

            <Link to={backTo.to} className="mc-req-button is-secondary">
              {backTo.label}
            </Link>
          </div>
        </WithDetailsPanel>
      ) : !q.isLoading && !deskLoading && !card ? (
        <div className="mc-confirm">
          <p className="mc-confirm-lead">
            {q.data ? "This request is on the record, but its live details did not load." : "No request with this number was found."}
          </p>
          <Link to={backTo.to} className="mc-req-button is-secondary">
            {backTo.label}
          </Link>
        </div>
      ) : null}
    </AppShell>
  );
}
