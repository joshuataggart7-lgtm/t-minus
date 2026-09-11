import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/watch")({
  head: () => ({
    meta: [
      { title: "Watch — T-Minus" },
      { name: "description", content: "Protest decisions, rule changes, and notices worth watching." },
      { property: "og:title", content: "Watch — T-Minus" },
      {
        property: "og:description",
        content: "Protest decisions, rule changes, and notices worth watching.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Watch" lead="Protest decisions, rule changes, and notices worth watching." />
      <Placeholder note="Watch items appear once the database schema and seed are applied." />
    </AppShell>
  ),
});
