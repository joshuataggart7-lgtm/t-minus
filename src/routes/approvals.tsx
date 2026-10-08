import { createFileRoute } from "@tanstack/react-router";
import { ReviewInbox } from "@/components/review-inbox";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals · T-Minus" },
      {
        name: "description",
        content: "Approvals waiting on you, the document to read, and your Approve or Disapprove decision.",
      },
      { property: "og:title", content: "Approvals · T-Minus" },
      {
        property: "og:description",
        content: "Approvals waiting on you, the document to read, and your Approve or Disapprove decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return <ReviewInbox mode="approvals" />;
}
