import { createFileRoute } from "@tanstack/react-router";
import { ReviewInbox } from "@/components/review-inbox";

export const Route = createFileRoute("/reviewer-inbox")({
  head: () => ({
    meta: [
      { title: "Reviewer inbox · T-Minus" },
      {
        name: "description",
        content: "Reviews waiting on you, the one document to read, and your formal decision.",
      },
      { property: "og:title", content: "Reviewer inbox · T-Minus" },
      {
        property: "og:description",
        content: "Reviews waiting on you, the one document to read, and your formal decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewerInbox,
});

function ReviewerInbox() {
  return <ReviewInbox mode="reviews" />;
}
