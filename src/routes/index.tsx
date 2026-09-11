import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";
import { useRole } from "@/components/role-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Executive Overview — T-Minus" },
      {
        name: "description",
        content:
          "T-Minus turns acquisition time into mission readiness: phase, next decision, days to award, and the blocker for every priority project.",
      },
      { property: "og:title", content: "Executive Overview — T-Minus" },
      {
        property: "og:description",
        content: "Mission readiness, next decision, and days to award for every priority project.",
      },
    ],
  }),
  component: ExecutiveOverview,
});

function ExecutiveOverview() {
  const { role } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (role !== "executive" && role !== "hq") {
      navigate({ to: "/work-queue", replace: true });
    }
  }, [role, navigate]);

  return (
    <AppShell wide>
      <PageHeader title="Executive Overview" lead="T-Minus turns acquisition time into mission readiness." />

      <section
        aria-label="Mission clock"
        className="mb-10 rounded-xl bg-panel px-8 py-8 text-panel-foreground"
      >
        <p className="text-[13px] text-panel-muted">Priority projects on the clock</p>
        <div className="mt-4 grid gap-8 sm:grid-cols-3">
          <div>
            <p className="clock-figure" data-numeric>
              —
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">Days to the next decision</p>
          </div>
          <div>
            <p className="clock-figure" data-numeric>
              —
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">Days to award</p>
          </div>
          <div>
            <p className="clock-figure" data-numeric>
              —
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">Projects needing a decision</p>
          </div>
        </div>
      </section>

      <Placeholder note="Mission rows load once the database schema and seed are applied. Open Seed status to see row counts." />
    </AppShell>
  );
}
