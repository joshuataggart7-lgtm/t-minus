import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { daysBetween, todayISO } from "@/lib/intake";

/**
 * Orby: a small line-drawn astronaut easter egg. Off by default, never shown on
 * load. Appears for five seconds with one line drawn from the file the user was
 * on, then fades. Respects reduced motion (no fade, just appears and leaves).
 */
export function Orby({
  acquisitionId,
  onDone,
}: {
  acquisitionId: string | null;
  onDone: () => void;
}) {
  const [line, setLine] = useState("Standing by.");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!acquisitionId) {
      setLine("No file open. Pick one and I will read its clock.");
    } else {
      void (async () => {
        const { data } = await supabase
          .from("acquisition_facts")
          .select("acquisition_id,clock_state,target_award_date")
          .eq("acquisition_id", acquisitionId)
          .maybeSingle();
        if (cancelled) return;
        if (!data) {
          setLine(`${acquisitionId}: no clock recorded.`);
        } else if (data.clock_state === "launched") {
          setLine(`${data.acquisition_id}: Launched.`);
        } else if (data.target_award_date) {
          const d = daysBetween(todayISO(), data.target_award_date);
          setLine(`${data.acquisition_id}: ${d < 0 ? `${Math.abs(d)} days past target` : `${d} days to award`}.`);
        } else {
          setLine(`${data.acquisition_id}: no target award date yet.`);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [acquisitionId]);

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
