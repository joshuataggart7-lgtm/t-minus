import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/intake";
import {
  formatRefDate,
  loadRegulationRefs,
  refsForPhase,
  thresholdsForPhase,
  tierLabel,
  type ThresholdRow,
} from "@/lib/regulation-sidebar";

/**
 * Right-hand collapsible sidebar. It reads regulatory_refs and thresholds and
 * shows what applies to the phase in view. Nothing here is generated.
 */
export function RegulationSidebar({
  phase,
  phases,
  onPhaseChange,
}: {
  phase: string;
  phases?: string[];
  onPhaseChange?: (phase: string) => void;
}) {
  const { authState } = useRole();
  const [open, setOpen] = useState(false); // references start collapsed; thresholds stay open

  const q = useQuery({
    queryKey: ["regulation-sidebar"],
    enabled: authState === "signed-in",
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [refs, thresholds] = await Promise.all([
        loadRegulationRefs(),
        supabase.from("thresholds").select("*"),
      ]);
      return { refs, thresholds: (thresholds.data ?? []) as ThresholdRow[] };
    },
  });

  const refs = useMemo(() => refsForPhase(q.data?.refs ?? [], phase), [q.data, phase]);
  const thresholds = useMemo(() => thresholdsForPhase(q.data?.thresholds ?? [], phase), [q.data, phase]);

  return (
    <details
      aria-label="Regulations for this phase"
      className="mb-8 max-w-[80ch] rounded-xl border border-border bg-background"
    >
      <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">
        Regulations
      </summary>
      <div className="hidden">
        <button
          type="button"
          className="text-[13px] underline"
          style={{ color: "var(--action)" }}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide references" : "Show references"}
        </button>
      </div>

      <div className="border-t border-border px-4 py-4">
          {phases && phases.length > 0 ? (
            <div className="mb-4">
              <label htmlFor="reg-phase" className="block text-[13px] text-muted-foreground">
                Phase
              </label>
              <select
                id="reg-phase"
                className="mt-1 w-full border border-border bg-background px-2 py-1 text-[13px]"
                style={{ borderRadius: 8 }}
                value={phase}
                onChange={(e) => onPhaseChange?.(e.target.value)}
              >
                {phases.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="mb-4 text-[13px] text-muted-foreground">Phase: {phase}</p>
          )}

          {q.isPending ? <p className="text-[13px] text-muted-foreground">Loading regulations.</p> : null}
          {q.isError ? (
            <p role="alert" className="text-[13px]">
              The regulations could not be loaded. Refresh the page to try again.
            </p>
          ) : null}

          <h3 className="text-[13px] font-medium">Thresholds that apply</h3>
          {thresholds.length === 0 && !q.isPending ? (
            <p className="mt-1 text-[13px] text-muted-foreground">No threshold rows apply to this phase.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {thresholds.map((t) => (
                <li key={`${t.name}-${t.citation}`} className="text-[13px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{t.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {t.numeric === null
                        ? "No dollar figure"
                        : t.numeric < 1000
                          ? `${t.numeric} days`
                          : formatMoney(t.numeric)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{t.citation}</p>
                  <p className="text-muted-foreground">Tier: {tierLabel(t.tier)}</p>
                  {t.note ? <p className="text-muted-foreground">{t.note}</p> : null}
                </li>
              ))}
            </ul>
          )}

        </div>

      {open ? (
        <div className="border-t border-border px-4 pb-4">
          <h3 className="pt-4 text-[13px] font-medium">References, newest first</h3>
          {refs.length === 0 && !q.isPending ? (
            <p className="mt-1 text-[13px] text-muted-foreground">No references are recorded for this phase.</p>
          ) : (
            <ul className="mt-2 space-y-4">
              {refs.map((r) => (
                <li key={r.ref_id} className="text-[13px]">
                  <p className="font-medium">{r.citation}</p>
                  <p>{r.title}</p>
                  <p className="text-muted-foreground">
                    Tier: {tierLabel(r.tier)} · Source: {r.source ?? "Not recorded"}
                  </p>
                  <p className="tabular-nums text-muted-foreground">
                    Effective {formatRefDate(r.effective_date)}
                  </p>
                  {r.scope === "all" ? (
                    <p className="text-muted-foreground">Applies to every phase.</p>
                  ) : null}
                  {r.url ? (
                    <p>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                        style={{ color: "var(--action)" }}
                      >
                        Open the source
                      </a>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </details>
  );
}
