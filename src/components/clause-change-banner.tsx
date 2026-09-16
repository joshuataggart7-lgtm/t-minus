// Regulation change banner — advisory only.
//
// Reads open rows from clause_mod_tasks for this acquisition and says so in one
// line. Nothing is invented: with no open rows the banner renders nothing. It
// never calls computeHold, never writes clock_state, and never gates an exit.

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePresenter } from "@/lib/presenter";

export const CLAUSE_CHANGE_CHIP = "Advisory — does not hold the file.";

type OpenTask = { clause_number: string; change_kind: string };

async function loadOpenClauseTasks(acquisitionId: string): Promise<OpenTask[]> {
  const { data, error } = await supabase
    .from("clause_mod_tasks")
    .select("clause_number,change_kind,status")
    .eq("acquisition_id", acquisitionId)
    .neq("status", "complete")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    clause_number: (r as { clause_number: string }).clause_number,
    change_kind: (r as { change_kind: string }).change_kind,
  }));
}

export function ClauseChangeBanner({ acquisitionId }: { acquisitionId: string }) {
  const presenter = usePresenter();
  const q = useQuery({
    queryKey: ["open-clause-tasks", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadOpenClauseTasks(acquisitionId),
  });

  const rows = q.data ?? [];
  // Quiet by design: loading, an error, presenter mode or no open task all
  // render nothing rather than a placeholder.
  if (presenter || rows.length === 0) return null;

  const listed = rows
    .slice(0, 3)
    .map((r) => `${r.clause_number} (${r.change_kind})`)
    .join(", ");
  const more = rows.length > 3 ? `, and ${rows.length - 3} more` : "";

  return (
    <section
      aria-label="Clause changes open on this record"
      className="mb-6 border border-border bg-muted/40 p-4"
    >
      <p className="max-w-[80ch] text-[15px] leading-[22px]">
        Since this file was last touched, {rows.length} clause change{rows.length === 1 ? "" : "s"} {rows.length === 1 ? "task is" : "tasks are"} open on the record: {listed}
        {more}.{" "}
        <Link to="/clause-changes" className="text-primary underline underline-offset-2">
          Open Clause changes
        </Link>
        .
      </p>
      <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{CLAUSE_CHANGE_CHIP}</p>
    </section>
  );
}
