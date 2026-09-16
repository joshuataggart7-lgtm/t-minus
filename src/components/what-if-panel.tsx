import { useMemo, useState } from "react";
import { buildSequence, type AcqRow, type PhaseView } from "@/lib/launch-sequence";
import { selectPacketClauses } from "@/lib/clause-packet";
import { daysBetween, formatMoney, todayISO } from "@/lib/intake";

type PlanRow = { acquisition_type: string; phase: string | null; planned_days: number | null; order: number | null; note?: string | null };
type ThresholdRow = { threshold_id?: string; name: string; value: number | string | null; citation?: string | null; tier?: string | null; note?: string | null };

const SET_ASIDES = [
  "None",
  "Total small business",
  "8(a)",
  "HUBZone",
  "Service-disabled veteran-owned",
  "Women-owned small business",
];

/**
 * A sandbox: change the estimated value or the set-aside and see what the
 * launch sequence, the thresholds, and the clause count would do. Nothing is
 * saved; the acquisition record is never written from this panel.
 */
export function WhatIfPanel({
  acq,
  plan,
  thresholds,
  clauseRows,
}: {
  acq: AcqRow;
  plan: PlanRow[];
  thresholds: ThresholdRow[];
  clauseRows: Parameters<typeof selectPacketClauses>[1];
}) {
  const baseValue = acq.estimated_value == null ? "" : String(acq.estimated_value);
  const baseSetAside = String((acq as Record<string, unknown>)["set_aside"] ?? "None");
  const [value, setValue] = useState(baseValue);
  const [setAside, setSetAside] = useState(baseSetAside);

  const changed = value !== baseValue || setAside !== baseSetAside;

  const sandboxAcq = useMemo(() => {
    const n = value.trim() === "" ? null : Number(value);
    return {
      ...(acq as Record<string, unknown>),
      estimated_value: n !== null && Number.isFinite(n) ? n : null,
      set_aside: setAside,
    } as unknown as AcqRow;
  }, [acq, value, setAside]);

  const view = useMemo(() => {
    const rowsFor = (a: AcqRow): PhaseView[] => buildSequence(a, plan as never, todayISO(), daysBetween);
    const base = rowsFor(acq);
    const next = rowsFor(sandboxAcq);
    const clausesBase = selectPacketClauses(acq, clauseRows, thresholds as never).length;
    const clausesNext = selectPacketClauses(sandboxAcq, clauseRows, thresholds as never).length;
    const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
    const crossed = thresholds
      .map((t) => {
        const tv = num(t.value);
        if (tv === null) return null;
        const nowAbove = num(acq.estimated_value) !== null && Number(acq.estimated_value) >= tv;
        const thenAbove = num(sandboxAcq.estimated_value) !== null && Number(sandboxAcq.estimated_value) >= tv;
        if (nowAbove === thenAbove) return null;
        return { name: t.name, value: tv, citation: t.citation ?? "", thenAbove };
      })
      .filter(Boolean) as { name: string; value: number; citation: string; thenAbove: boolean }[];
    const baseNames = new Set(base.map((p) => p.phase));
    const nextNames = new Set(next.map((p) => p.phase));
    return {
      added: next.filter((p) => !baseNames.has(p.phase)).map((p) => p.phase),
      dropped: base.filter((p) => !nextNames.has(p.phase)).map((p) => p.phase),
      rows: next.length,
      baseRows: base.length,
      clausesBase,
      clausesNext,
      crossed,
    };
  }, [acq, sandboxAcq, plan, thresholds, clauseRows]);

  return (
    <details aria-label="What-if sandbox" className="mb-8 max-w-[80ch] rounded-xl border border-border bg-background">
      <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">
        What-if sandbox <span className="ml-2 text-[13px] font-normal text-muted-foreground">Sandbox — not saved</span>
      </summary>
      <div className="border-t border-border px-5 py-4">
        <p className="mb-4 text-[13px] leading-[18px] text-muted-foreground">
          Change a number here to see what the file would look like. Nothing on this panel is written to the record.
        </p>
        <div className="mb-4 flex flex-wrap gap-4">
          <div>
            <label htmlFor="whatif-value" className="mb-1 block text-[13px] text-muted-foreground">
              Estimated value
            </label>
            <input
              id="whatif-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
              data-numeric
            />
          </div>
          <div>
            <label htmlFor="whatif-setaside" className="mb-1 block text-[13px] text-muted-foreground">
              Set-aside
            </label>
            <select
              id="whatif-setaside"
              value={SET_ASIDES.includes(setAside) ? setAside : "None"}
              onChange={(e) => setSetAside(e.target.value)}
              className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            >
              {SET_ASIDES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="self-end">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px]"
              onClick={() => {
                setValue(baseValue);
                setSetAside(baseSetAside);
              }}
            >
              Reset to the record
            </button>
          </div>
        </div>

        {!changed ? (
          <p className="text-[15px] leading-[22px] text-muted-foreground">
            These are the values on the record. Change one to see the effect.
          </p>
        ) : (
          <ul className="max-w-[80ch] space-y-2 border-t border-border pt-3 text-[15px] leading-[22px]">
            <li>
              Launch sequence: {view.baseRows} phases now, {view.rows} in the sandbox.
              {view.added.length ? ` Added: ${view.added.join(", ")}.` : ""}
              {view.dropped.length ? ` Dropped: ${view.dropped.join(", ")}.` : ""}
              {!view.added.length && !view.dropped.length ? " The phases do not change." : ""}
            </li>
            <li>
              Clause packet: {view.clausesBase} clauses now, {view.clausesNext} in the sandbox.
            </li>
            <li>
              {view.crossed.length ? (
                <>
                  Thresholds that change:
                  <ul className="mt-1 space-y-1 text-[13px] leading-[18px] text-muted-foreground">
                    {view.crossed.map((t) => (
                      <li key={t.name}>
                        {t.name} ({formatMoney(t.value)}) — would read {t.thenAbove ? "at or above" : "below"}
                        {t.citation ? ` · ${t.citation}` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                "No threshold on the table changes side."
              )}
            </li>
          </ul>
        )}
      </div>
    </details>
  );
}
