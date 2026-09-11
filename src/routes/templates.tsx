import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Templates — T-Minus" },
      {
        name: "description",
        content: "Versioned forms with their governing citation and whether it binds or guides.",
      },
      { property: "og:title", content: "Templates — T-Minus" },
      {
        property: "og:description",
        content: "Versioned forms with their governing citation and whether it binds or guides.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Templates" lead="Versioned forms, each with its governing citation and tier." />
      <Placeholder note="Templates load once the database schema and seed are applied." />
    </AppShell>
  ),
});
