import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/checks")({
  head: () => ({
    meta: [
      { title: "Checks — T-Minus" },
      { name: "description", content: "Entity and exclusion checks recorded against each acquisition." },
      { property: "og:title", content: "Checks — T-Minus" },
      {
        property: "og:description",
        content: "Entity and exclusion checks recorded against each acquisition.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Checks" lead="Entity and exclusion checks recorded against each acquisition." />
      <Placeholder note="Checks load once the database schema and seed are applied." />
    </AppShell>
  ),
});
