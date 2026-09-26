// Read receipts — who opened which document on this file, and when.
//
// Soft tracking. No phase exit, hold, clock or required document reads from
// any of this, and nothing is seeded: the list stays empty until a real person
// opens a document.

import { TableScrollRegion } from "@/components/table-scroll-region";
import { useQuery } from "@tanstack/react-query";
import {
  loadReadReceipts,
  receiptStamp,
  READ_RECEIPTS_CHIP,
  READ_RECEIPTS_EMPTY,
} from "@/lib/read-receipts";

const kindWord = (kind: string): string =>
  kind === "template" ? "Document" : kind === "form" ? "Form" : "File record";

export function ReadReceiptsPanel({ acquisitionId }: { acquisitionId: string }) {
  const q = useQuery({
    queryKey: ["read-receipts", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadReadReceipts(acquisitionId),
  });

  const rows = q.data ?? [];

  return (
    <section className="mt-3 border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-[15px] font-medium">Read receipts</h4>
        <span className="text-[13px] text-muted-foreground">{READ_RECEIPTS_CHIP}</span>
      </div>

      {q.isError ? (
        <p className="mt-2 text-[13px] text-muted-foreground">
          The read receipts did not load. Refresh the page to try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{READ_RECEIPTS_EMPTY}</p>
      ) : (
        <TableScrollRegion baseClassName="overflow-x-auto" label="Documents opened table">
<table className="mt-2 w-full text-[13px] leading-[18px]">
          <caption className="sr-only">Documents opened on this file</caption>
          <thead>
            <tr className="border-y border-border text-left">
              <th scope="col" className="p-2">Opened by</th>
              <th scope="col" className="p-2">Document</th>
              <th scope="col" className="p-2">Opened</th>
              <th scope="col" className="p-2">From</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.receipt_id} className="border-b border-border align-top">
                <td className="p-2">{r.opened_by}</td>
                <td className="p-2">
                  {r.doc_label ?? r.doc_key}
                  <span className="block text-muted-foreground">{kindWord(r.doc_kind)}</span>
                </td>
                <td className="p-2" data-numeric>{receiptStamp(r.opened_at)}</td>
                <td className="p-2 text-muted-foreground">{r.source ?? "Not recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
</TableScrollRegion>
      )}
    </section>
  );
}
