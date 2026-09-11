import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log — T-Minus" },
      { name: "description", content: "Who did what, when, and why, kept for the contract file." },
      { property: "og:title", content: "Audit Log — T-Minus" },
      {
        property: "og:description",
        content: "Who did what, when, and why, kept for the contract file.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Audit Log" lead="Who did what, when, and why. Kept for the contract file under FAR 4.801." />
      <Placeholder note="Log entries appear once the database schema and seed are applied." />
    </AppShell>
  ),
});
