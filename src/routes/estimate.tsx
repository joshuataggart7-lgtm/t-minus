import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/estimate")({
  head: () => ({
    meta: [
      { title: "Estimate — T-Minus" },
      { name: "description", content: "Level of effort and timeline estimate. Reserved for a later build." },
      { property: "og:title", content: "Estimate — T-Minus" },
      {
        property: "og:description",
        content: "Level of effort and timeline estimate. Reserved for a later build.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Estimate" lead="Level of effort and timeline estimate." />
      <Placeholder note="Nothing to do here yet." />
    </AppShell>
  ),
});
