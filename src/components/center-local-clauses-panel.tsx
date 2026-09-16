// Center-local clauses (source = local) — kept in their own group so they are
// never mixed into the HQ FAR/NFS matrix lists. Advisory only; no clause is
// invented and no matrix is rewritten.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const NO_LOCAL_CLAUSES_NOTE = "No Center-local clauses are loaded.";

type LocalClauseRow = {
  row_id: string;
  clause_number: string | null;
  title: string | null;
  source: string | null;
  ucf_section: string | null;
};

async function loadLocalClauses(): Promise<LocalClauseRow[]> {
  const { data, error } = await supabase
    .from("clauses")
    .select("row_id, clause_number, title, source, ucf_section")
    .ilike("source", "local")
    .order("clause_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LocalClauseRow[];
}

export function CenterLocalClausesPanel() {
  const q = useQuery({ queryKey: ["center-local-clauses"], queryFn: loadLocalClauses });
  const rows = q.data ?? [];

  return (
    <section
      id="center-local-clauses"
      aria-label="Center-local clauses"
      className="mb-10 max-w-[80ch] rounded-xl border border-border bg-background p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] leading-6 font-medium">Center-local (local)</h2>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">{NO_LOCAL_CLAUSES_NOTE}</p>
      ) : (
        <ul className="mt-3 list-none space-y-1">
          {rows.map((r) => (
            <li key={r.row_id} className="text-[13px] leading-[18px] text-muted-foreground">
              <span className="text-foreground" data-numeric>
                {r.clause_number ?? "Not recorded"}
              </span>{" "}
              {r.title ?? "Not recorded"}
              {r.ucf_section ? ` · Section ${r.ucf_section}` : ""}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 border-t border-border pt-2 text-[13px] leading-[18px] text-muted-foreground">
        Center-local clauses are listed separately and are never merged into the HQ FAR or NFS matrix lists.
      </p>
    </section>
  );
}
