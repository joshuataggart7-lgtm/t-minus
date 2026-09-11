import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, Placeholder } from "@/components/app-shell";

export const Route = createFileRoute("/work-queue")({
  head: () => ({
    meta: [
      { title: "Work Queue — T-Minus" },
      {
        name: "description",
        content: "Files you own, what each one is waiting on, and when the next decision is due.",
      },
      { property: "og:title", content: "Work Queue — T-Minus" },
      {
        property: "og:description",
        content: "Files you own, what each one is waiting on, and when the next decision is due.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader
        title="Work Queue"
        lead="Files you own, what each one is waiting on, and when the next decision is due."
      />
      <Link
        to="/intake"
        className="mb-6 inline-block rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground"
      >
        Start an intake
      </Link>
      <Placeholder note="Acquisition rows load in a later milestone. Open Files to see every acquisition on the clock." />
    </AppShell>
  ),
});
