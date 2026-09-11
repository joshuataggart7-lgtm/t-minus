import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — T-Minus" },
      { name: "description", content: "Notices posted by HQ, with the action each one asks for." },
      { property: "og:title", content: "Announcements — T-Minus" },
      {
        property: "og:description",
        content: "Notices posted by HQ, with the action each one asks for.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Announcements" lead="Notices posted by HQ, with the action each one asks for." />
      <Placeholder note="Announcements appear once the database schema and seed are applied." />
    </AppShell>
  ),
});
