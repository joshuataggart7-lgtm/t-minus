// Dates this file owes. Everything reads from the record; nothing is sent
// anywhere. A row with an unverified rule says so on its face.

import { TableScrollRegion } from "@/components/table-scroll-region";
import { deadlineRows } from "@/lib/deadlines";

export function DeadlinesPanel({
  acq,
  awardDate,
  debriefingDate,
  thresholds,
  noticePostedDate,
  quoteDueDate,
}: {
  acq: Record<string, unknown> | null | undefined;
  awardDate: string | null;
  debriefingDate: string | null;
  thresholds: { name?: string | null; value?: number | string | null; citation?: string | null; note?: string | null }[];
  noticePostedDate: string | null;
  quoteDueDate: string | null;
}) {
  if (!acq) return null;
  const rows = deadlineRows({ acq, awardDate, debriefingDate, thresholds, noticePostedDate, quoteDueDate });

  return (
    <details aria-label="Dates this file owes" className="mb-8 rounded-xl border border-border bg-background">
      <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">Dates this file owes</summary>
      <div className="border-t border-border px-5 py-4">
        <p className="mb-4 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">
          Each date is computed from this record. The count says whether the rule runs in calendar
          or business days, and the citation says where it comes from.
        </p>
        <TableScrollRegion baseClassName="overflow-x-auto" label="Deadline calculations table">
<table className="w-full border border-border text-[13px] leading-[18px]">
          <caption className="sr-only">Dates computed from this record, with the rule behind each one</caption>
          <thead>
            <tr className="border-b border-border bg-canvas text-left">
              <th scope="col" className="px-3 py-2 font-medium">Date owed</th>
              <th scope="col" className="px-3 py-2 font-medium">Computed</th>
              <th scope="col" className="px-3 py-2 font-medium">Counted from</th>
              <th scope="col" className="px-3 py-2 font-medium">Count</th>
              <th scope="col" className="px-3 py-2 font-medium">Citation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border align-top">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2" data-numeric>
                  {r.date ?? "not computed yet"}
                </td>
                <td className="px-3 py-2">{r.from}</td>
                <td className="px-3 py-2">{r.count}</td>
                <td className="px-3 py-2">
                  {r.citation}
                  {r.verified ? "" : " · rule shown as a stub, not verified"}
                  {r.note ? <span className="block text-muted-foreground">{r.note}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</TableScrollRegion>
      </div>
    </details>
  );
}
