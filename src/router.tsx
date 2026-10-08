import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installPolling, refreshPolled } from "./lib/poll";

export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    // A successful save refreshes the live screens right away (see lib/poll.ts).
    mutationCache: new MutationCache({
      onSuccess: () => {
        void refreshPolled(queryClient);
      },
    }),
  });
  installPolling(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
