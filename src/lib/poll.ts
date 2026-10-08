import type { Query, QueryClient } from "@tanstack/react-query";

/**
 * Shared refresh cadence for the live screens (overview, work queue, acquisition
 * file, document pages). These used to refetch every 5 seconds whether anyone was
 * looking or not. Now:
 * - while someone is using the page (a click or key press in the last minute): every 15 seconds;
 * - when the page sits untouched: every 60 seconds;
 * - a hidden tab does not poll at all (React Query default), and coming back to the
 *   tab refreshes at once (refetchOnWindowFocus);
 * - shortly after a click or key press the live screens refresh once, and every
 *   successful save refreshes them right away, so your own changes still show at
 *   once instead of waiting for the next poll.
 */
export const POLL_ACTIVE_MS = 15_000;
export const POLL_IDLE_MS = 60_000;
export const ACTIVE_WINDOW_MS = 60_000;
/** Wait after the last click or key press before the one catch-up refresh. */
export const SETTLE_MS = 1_500;

/** Query keys (first element) that poll on this cadence. */
export const POLLED_QUERY_ROOTS = ["executive-overview", "work-queue", "acquisition-file", "document-context"] as const;

let lastActivity = 0;

export function markActivity(now: number = Date.now()) {
  lastActivity = now;
}

/** Interval for the next poll, in milliseconds. */
export function pollInterval(now: number = Date.now()): number {
  return lastActivity > 0 && now - lastActivity < ACTIVE_WINDOW_MS ? POLL_ACTIVE_MS : POLL_IDLE_MS;
}

/** Spread into a useQuery options object in place of `refetchInterval: 5000`. */
export const pollOptions = {
  refetchInterval: () => pollInterval(),
  refetchOnWindowFocus: true,
} as const;

export function isPolledQuery(query: Pick<Query, "queryKey">): boolean {
  const root = query.queryKey[0];
  return typeof root === "string" && (POLLED_QUERY_ROOTS as readonly string[]).includes(root);
}

/** Refetch the live screens that are on screen now. Hidden or unused queries just go stale. */
export function refreshPolled(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: isPolledQuery, refetchType: "active" });
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

const installed = new WeakSet<QueryClient>();

/** Browser only. Tracks activity and schedules the one catch-up refresh after interaction. */
export function installPolling(queryClient: QueryClient) {
  if (typeof window === "undefined" || installed.has(queryClient)) return;
  installed.add(queryClient);
  let timer: number | undefined;
  const onActivity = (event: Event) => {
    markActivity();
    // Typing in a field only counts as activity; it does not trigger the catch-up refresh.
    if (event instanceof KeyboardEvent && event.key !== "Enter" && isEditable(event.target)) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      void refreshPolled(queryClient);
    }, SETTLE_MS);
  };
  window.addEventListener("pointerdown", onActivity, { capture: true, passive: true });
  window.addEventListener("keydown", onActivity, { capture: true, passive: true });
}
