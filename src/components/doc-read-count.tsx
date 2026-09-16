// A quiet read count for one document or form. Soft tracking: it shows only
// when receipts exist, it never blocks anything, and a failed read is silent.

import { useQuery } from "@tanstack/react-query";
import { loadReceiptsForDoc, type ReceiptKind } from "@/lib/read-receipts";

export function DocReadCount({
  acquisitionId,
  docKind,
  docKey,
}: {
  acquisitionId: string;
  docKind: ReceiptKind;
  docKey: string;
}) {
  const q = useQuery({
    queryKey: ["read-receipts-doc", acquisitionId, docKind, docKey],
    enabled: Boolean(acquisitionId && docKey),
    retry: false,
    queryFn: () => loadReceiptsForDoc(acquisitionId, docKind, docKey).catch(() => []),
  });
  const rows = q.data ?? [];
  if (rows.length === 0) return null;
  const readers = new Set(rows.map((r) => r.opened_by)).size;
  return (
    <span className="text-[13px] text-muted-foreground" data-numeric>
      Opened {rows.length} {rows.length === 1 ? "time" : "times"} by {readers}{" "}
      {readers === 1 ? "person" : "people"} — soft tracking, does not hold the file.
    </span>
  );
}
