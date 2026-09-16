// FAR vs statute threshold conflicts — advisory only. Rows and notes are
// shown exactly as seeded; nothing here holds a file or blocks a phase exit.

import { useQuery } from "@tanstack/react-query";
import {
  NO_CONFLICTS_NOTE,
  conflictRows,
  formatThresholdValue,
  loadThresholdRows,
} from "@/lib/threshold-conflicts";

export function ThresholdConflictsPanel() {
  const q = useQuery({ queryKey: ["threshold-rows"], queryFn: loadThresholdRows });
  const rows = conflictRows(q.data ?? []);

  return (
    <section
      id="threshold-conflicts"
      aria-label="Threshold conflicts"
      className="mb-10 max-w-[80ch] rounded-xl border border-border bg-background p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] leading-6 font-medium">Threshold conflicts: FAR text vs statute</h2>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">{NO_CONFLICTS_NOTE}</p>
      ) : (
        <ul className="mt-3 list-none space-y-3">
          {rows.map((r) => (
            <li key={r.threshold_id} className="border-t border-border pt-2">
              <p className="text-[15px] leading-[22px]">
                <span className="font-medium">{r.name}</span>{" "}
                <span data-numeric>{formatThresholdValue(r.value)}</span>
              </p>
              <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                {r.citation ?? "Citation not recorded"}
                {r.tier ? ` · ${r.tier}` : ""}
              </p>
              {r.note ? (
                <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{r.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
