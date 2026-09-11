import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/work-queue")({
  head: () => ({
    meta: [
      { title: "Work Queue — T-Minus" },
      {
        name: "description",
        content: "Your acquisitions, owners, holds, and the next decision due on each file.",
      },
      { property: "og:title", content: "Work Queue — T-Minus" },
      {
        property: "og:description",
        content: "Your acquisitions, owners, holds, and the next decision due on each file.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Work Queue" lead="Files you own, what each one is waiting on, and when the next decision is due." />
      <Placeholder note="Acquisition rows load once the database schema and seed are applied." />
    </AppShell>
  ),
});
