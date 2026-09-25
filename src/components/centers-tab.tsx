import { useMemo } from "react";
import { agingByCenter, agingItems, type CenterRow, type UserRow } from "@/lib/aging";
import type { PollRow } from "@/lib/launch-sequence";
import type { AcqMetrics } from "@/lib/metrics";

export type CenterDocumentRow = {
  acquisition_id: string | null;
  template_id: string | null;
  saved_at: string | null;
  version: number | null;
};

export type CenterTemplateRow = {
  template_id: string;
  name: string;
  hq_revision_date: string | null;
};

/** Parses the HQ revision dates written as 4/7/2026 or 2026-04-07. */
function revisionDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = slash ? `${slash[3]}-${slash[1]!.padStart(2, "0")}-${slash[2]!.padStart(2, "0")}` : value;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function centerOf(m: AcqMetrics): string {
  return String(m.acq.center_code ?? "Not recorded");
}

export function CentersTab({
  metrics,
  polls,
  centers,
  users,
  documents,
  templates,
}: {
  metrics: AcqMetrics[];
  polls: PollRow[];
  centers: CenterRow[];
  users: UserRow[];
  documents: CenterDocumentRow[];
  templates: CenterTemplateRow[];
}) {
  const centerCodes = useMemo(() => {
    const set = new Set<string>();
    for (const m of metrics) set.add(centerOf(m));
    for (const c of centers) set.add(c.center_code);
    return [...set].sort();
  }, [metrics, centers]);

  const nameOf = useMemo(() => {
    const map = new Map(centers.map((c) => [c.center_code, c.center_name]));
    return (code: string) => map.get(code) ?? code;
  }, [centers]);

  /** Lead time by phase by Center, from the phases that recorded actual days. */
  const leadRows = useMemo(() => {
    const map = new Map<string, Map<string, { planned: number; actual: number; n: number }>>();
    for (const m of metrics) {
      const center = centerOf(m);
      const byPhase = map.get(center) ?? new Map();
      for (const p of m.phases) {
        if (p.actual_days === null) continue;
        const row = byPhase.get(p.phase) ?? { planned: 0, actual: 0, n: 0 };
        row.planned += p.planned_days;
        row.actual += p.actual_days;
        row.n += 1;
        byPhase.set(p.phase, row);
      }
      map.set(center, byPhase);
    }
    return map;
  }, [metrics]);

  /** Holds by reason by Center, taken from the file's own hold reason. */
  const holdRows = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const m of metrics) {
      if (!m.hold) continue;
      const center = centerOf(m);
      const reason = m.hold.reason || "Reason not recorded";
      const byReason = map.get(center) ?? new Map<string, number>();
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
      map.set(center, byReason);
    }
    return map;
  }, [metrics]);

  /** Template currency: saved documents written before the template's HQ revision. */
  const currencyRows = useMemo(() => {
    const centerByAcq = new Map(metrics.map((m) => [m.acq.acquisition_id, centerOf(m)]));
    const templateById = new Map(templates.map((t) => [t.template_id, t]));
    const map = new Map<string, { total: number; current: number; behind: number; names: Set<string> }>();
    for (const d of documents) {
      const center = centerByAcq.get(String(d.acquisition_id ?? ""));
      const template = d.template_id ? templateById.get(d.template_id) : undefined;
      if (!center || !template) continue;
      const row = map.get(center) ?? { total: 0, current: 0, behind: 0, names: new Set<string>() };
      row.total += 1;
      const revised = revisionDate(template.hq_revision_date);
      const saved = d.saved_at ? Date.parse(d.saved_at) : NaN;
      if (revised !== null && !Number.isNaN(saved) && saved < revised) {
        row.behind += 1;
        row.names.add(template.name);
      } else {
        row.current += 1;
      }
      map.set(center, row);
    }
    return map;
  }, [documents, templates, metrics]);

  const aging = useMemo(
    () => new Map(agingByCenter(agingItems(metrics.map((m) => m.acq), polls, centers, users)).map((r) => [r.centerCode, r])),
    [metrics, polls, centers, users],
  );

  if (centerCodes.length === 0) {
    return (
      <div>
        <h2 className="text-[18px] leading-6 font-medium">Centers</h2>
        <p className="mt-2 text-muted-foreground">No Center has files loaded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[18px] leading-6 font-medium">Centers</h2>
      <p className="mt-1 max-w-[70ch] text-muted-foreground">
        Every figure is computed from the files themselves: recorded phase time against the phase
        plan, current holds, the revision each saved document was written on, and the items past the
        Center's aging threshold.
      </p>

      <div className="overflow-x-auto">
      <table className="mt-6 w-full border border-border bg-background text-[13px] leading-[18px]">
        <caption className="sr-only">Center scoreboard</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="p-2">Center</th>
            <th scope="col" className="p-2">Files</th>
            <th scope="col" className="p-2">Phases measured</th>
            <th scope="col" className="p-2">Against plan</th>
            <th scope="col" className="p-2">Files on hold</th>
            <th scope="col" className="p-2">Documents on the current revision</th>
            <th scope="col" className="p-2">Aging items</th>
          </tr>
        </thead>
        <tbody>
          {centerCodes.map((code) => {
            const files = metrics.filter((m) => centerOf(m) === code);
            const phases = [...(leadRows.get(code)?.values() ?? [])];
            const planned = phases.reduce((n, r) => n + r.planned, 0);
            const actual = phases.reduce((n, r) => n + r.actual, 0);
            const delta = planned - actual;
            const holds = [...(holdRows.get(code)?.values() ?? [])].reduce((n, v) => n + v, 0);
            const cur = currencyRows.get(code);
            const age = aging.get(code);
            return (
              <tr key={code} className="border-b border-border last:border-0">
                <th scope="row" className="p-2 text-left font-normal">
                  {code} — {nameOf(code)}
                </th>
                <td className="p-2" data-numeric>{files.length}</td>
                <td className="p-2" data-numeric>{phases.reduce((n, r) => n + r.n, 0)}</td>
                <td className="p-2" data-numeric>
                  {phases.length === 0
                    ? "No recorded time"
                    : delta === 0
                      ? "On plan"
                      : `${Math.abs(delta)} days ${delta > 0 ? "ahead of" : "behind"} plan`}
                </td>
                <td className="p-2" data-numeric>{holds}</td>
                <td className="p-2" data-numeric>
                  {!cur || cur.total === 0 ? "No documents saved" : `${cur.current} of ${cur.total}`}
                </td>
                <td className="p-2" data-numeric>
                  {age ? age.holds + age.polls : 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <h3 className="mt-10 text-[18px] leading-6 font-medium">Lead time by phase by Center</h3>
      {centerCodes.every((c) => (leadRows.get(c)?.size ?? 0) === 0) ? (
        <p className="mt-2 text-muted-foreground">No phase has recorded time yet.</p>
      ) : (
        centerCodes
          .filter((c) => (leadRows.get(c)?.size ?? 0) > 0)
          .map((code) => (
            <div key={code} className="mt-6">
              <h4 className="text-[15px] leading-[22px] font-medium">
                {code} — {nameOf(code)}
              </h4>
              <div className="overflow-x-auto">
              <table className="mt-2 w-full border border-border bg-background text-[13px] leading-[18px]">
                <caption className="sr-only">Lead time by phase at {nameOf(code)}</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-2">Phase</th>
                    <th scope="col" className="p-2">Files measured</th>
                    <th scope="col" className="p-2">Planned days</th>
                    <th scope="col" className="p-2">Actual days</th>
                    <th scope="col" className="p-2">Against plan</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(leadRows.get(code) ?? new Map()).entries()].map(([phase, r]) => {
                    const d = r.planned - r.actual;
                    return (
                      <tr key={phase} className="border-b border-border last:border-0">
                        <td className="p-2">{phase}</td>
                        <td className="p-2" data-numeric>{r.n}</td>
                        <td className="p-2" data-numeric>{r.planned}</td>
                        <td className="p-2" data-numeric>{r.actual}</td>
                        <td className="p-2" data-numeric>
                          {d === 0 ? "On plan" : `${Math.abs(d)} days ${d > 0 ? "ahead of" : "behind"} plan`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          ))
      )}

      <h3 className="mt-10 text-[18px] leading-6 font-medium">Holds by reason by Center</h3>
      {holdRows.size === 0 ? (
        <p className="mt-2 text-muted-foreground">Nothing is on hold.</p>
      ) : (
        [...holdRows.entries()].map(([code, byReason]) => (
          <div key={code} className="mt-6 max-w-[70ch]">
            <h4 className="text-[15px] leading-[22px] font-medium">
              {code} — {nameOf(code)}
            </h4>
            <ul className="mt-2 space-y-1 border-t border-border pt-2">
              {[...byReason.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([reason, n]) => (
                  <li key={reason} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[13px] leading-[18px]">
                    <span>{reason}</span>
                    <span data-numeric>{n}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}

      <h3 className="mt-10 text-[18px] leading-6 font-medium">Template currency by Center</h3>
      <p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
        A saved document is behind when HQ revised its template after the document was saved.
      </p>
      {currencyRows.size === 0 ? (
        <p className="mt-2 text-muted-foreground">No document has been saved yet.</p>
      ) : (
        <ul className="mt-3 max-w-[70ch] space-y-2 border-t border-border pt-3">
          {[...currencyRows.entries()].map(([code, r]) => (
            <li key={code} className="text-[13px] leading-[18px]">
              <span className="font-medium">
                {code} — {nameOf(code)}
              </span>
              <span data-numeric>
                {" "}
                · {r.current} of {r.total} on the current revision
                {r.behind > 0 ? ` · ${r.behind} behind` : ""}
              </span>
              {r.behind > 0 ? (
                <span className="block text-muted-foreground">Behind: {[...r.names].join(", ")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
