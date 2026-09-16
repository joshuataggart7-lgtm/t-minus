import { createFileRoute, redirect } from "@tanstack/react-router";

// Old sidebar links and bookmarks pointed at /requester-portal. The working
// page is /requester; this keeps the old address from returning a 404.
export const Route = createFileRoute("/requester-portal")({
  beforeLoad: () => {
    throw redirect({ to: "/requester" });
  },
});
