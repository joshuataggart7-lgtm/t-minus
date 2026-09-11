import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "Files — T-Minus" },
      { name: "description", content: "Every acquisition file, its clock line, and its launch sequence." },
      { property: "og:title", content: "Files — T-Minus" },
      {
        property: "og:description",
        content: "Every acquisition file, its clock line, and its launch sequence.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Files" lead="Every acquisition, with its clock line and launch sequence." />
      <Placeholder note="Acquisition files load once the database schema and seed are applied." />
    </AppShell>
  ),
});
