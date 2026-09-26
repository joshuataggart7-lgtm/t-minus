import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { daysBetween, todayISO } from "@/lib/intake";
import { loadLaunchEvents, launchedIdSet } from "@/lib/launch-events";
import { useOperationalDisplay } from "@/components/mission-control/use-operational-display";

/**
 * Orby: a small line-drawn astronaut easter egg. Off by default, never shown on
 * load. Appears for five seconds with one line drawn from the file the user was
 * on, then fades. Respects reduced motion (no fade, just appears and leaves).
 *
 * The line is derived the same way the file header and global search derive it:
 * a recorded Launched audit row is the only fact that reads "Launched.", and the
 * shared operational display supplies the hold state. Raw clock_state is never
 * shown as "Launched." and a scrubbed clock reads "Clock stopped · scrubbed."
 */

// Fetch result for one acquisition. `id` is tagged on every state so a stale
// result from a previous acquisition is treated as still loading.
type FetchState =
  | { id: string; status: "loading" }
  | { id: string; status: "error" }
  | { id: string; status: "norow" }
  | {
      id: string;
      status: "row";
      clock_state: string | null;
      target_award_date: string | null;
      launched: Set<string>;
    };

function orbyLine(
  acquisitionId: string | null,
  fetch: FetchState | null,
  operational: ReturnType<typeof useOperationalDisplay>,
): string {
  if (!acquisitionId) {
    return "No file open. Pick one and I will read its clock.";
  }
  if (!fetch || fetch.id !== acquisitionId || fetch.status === "loading") {
    return "Reading the clock.";
  }
  if (fetch.status === "error") {
    return `${acquisitionId}: clock could not be read.`;
  }
  if (fetch.status === "norow") {
    return `${acquisitionId}: no clock recorded.`;
  }
  // fetch.status === "row": the acquisition_facts row exists, so the shared
  // operational display must hold its countdown. If it is still loading or its
  // entry is missing, the read failed — never fall back to raw clock_state.
  if (operational.isLoading) {
    return "Reading the clock.";
  }
  if (!operational.byId.has(acquisitionId)) {
    return `${acquisitionId}: clock could not be read.`;
  }
  const launched = fetch.launched;
  if (launched.has(acquisitionId)) {
    return `${acquisitionId}: Launched.`;
  }
  if (fetch.clock_state === "scrubbed") {
    return `${acquisitionId}: Clock stopped · scrubbed.`;
  }
  const d = fetch.target_award_date ? daysBetween(todayISO(), fetch.target_award_date) : null;
  if (d !== null && d < 0) {
    return `${acquisitionId}: ${Math.abs(d)} days past target.`;
  }
  const countdown = operational.byId.get(acquisitionId)?.countdown;
  if (countdown?.mode === "hold") {
    return countdown.days === null
      ? `${acquisitionId}: HOLD.`
      : `${acquisitionId}: ${countdown.prefix}${countdown.days} HOLD.`;
  }
  if (d !== null && d >= 0) {
    return `${acquisitionId}: ${d} days to award.`;
  }
  return `${acquisitionId}: no target award date yet.`;
}

export function Orby({
  acquisitionId,
  onDone,
}: {
  acquisitionId: string | null;
  onDone: () => void;
}) {
  const [fetch, setFetch] = useState<FetchState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const operational = useOperationalDisplay(!!acquisitionId);

  useEffect(() => {
    let cancelled = false;
    if (!acquisitionId) {
      setFetch(null);
      return;
    }
    setFetch({ id: acquisitionId, status: "loading" });
    void (async () => {
      try {
        const [result, events] = await Promise.all([
          supabase
            .from("acquisition_facts")
            .select("acquisition_id,clock_state,target_award_date")
            .eq("acquisition_id", acquisitionId)
            .maybeSingle(),
          loadLaunchEvents(),
        ]);
        if (cancelled) return;
        if (result.error) {
          setFetch({ id: acquisitionId, status: "error" });
          return;
        }
        const data = result.data as
          | { acquisition_id: string; clock_state: string | null; target_award_date: string | null }
          | null;
        const launched = launchedIdSet(events);
        if (!data) {
          setFetch({ id: acquisitionId, status: "norow" });
        } else {
          setFetch({
            id: acquisitionId,
            status: "row",
            clock_state: data.clock_state,
            target_award_date: data.target_award_date,
            launched,
          });
        }
      } catch {
        if (!cancelled) setFetch({ id: acquisitionId, status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [acquisitionId]);

  const line = orbyLine(acquisitionId, fetch, operational);

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 4700);
    const gone = setTimeout(onDone, 5000);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-6 bottom-6 z-50 flex items-end gap-3 transition-opacity duration-300 motion-reduce:transition-none"
      style={{ opacity: leaving ? 0 : 1 }}
    >
      <p className="max-w-[32ch] rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-[18px] text-foreground">
        {line}
      </p>
      <svg
        width="56"
        height="72"
        viewBox="0 0 56 72"
        fill="none"
        role="img"
        aria-label="Orby, a small astronaut"
      >
        <circle cx="28" cy="20" r="14" stroke="var(--panel)" strokeWidth="2" />
        <path d="M20 17a8 8 0 0 1 8-6" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
        <rect x="16" y="36" width="24" height="24" rx="8" stroke="var(--panel)" strokeWidth="2" />
        <path d="M16 44H8v10" stroke="var(--panel)" strokeWidth="2" strokeLinecap="round" />
        <path d="M40 44h8v10" stroke="var(--panel)" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 60v8M34 60v8" stroke="var(--panel)" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 46h8v6h-8z" stroke="var(--primary)" strokeWidth="2" />
      </svg>
    </div>
  );
}
