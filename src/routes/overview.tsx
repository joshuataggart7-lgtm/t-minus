import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveOverview } from "./index";

export const Route = createFileRoute("/overview")({
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  return <ExecutiveOverview />;
}
