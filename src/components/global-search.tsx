import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/components/role-context";
import { daysBetween, todayISO } from "@/lib/intake";
import { Search } from "lucide-react";

type Row = {
  acquisition_id: string;
  title: string | null;
  pr_number: string | null;
  requester_name: string | null;
  vendor_legal_name: string | null;
  vendor_uei: string | null;
  vendor_cage: string | null;
  mission_id: string | null;
  contract_number: string | null;
  source_tag: string | null;
  current_phase: string | null;
  clock_state: string | null;
  status: string | null;
  hold_reason: string | null;
  target_award_date: string | null;
  missions?: { mission_id: string; name: string | null } | null;
};

/** One plain sentence of clock state for a hit, the same facts as the file page. */
function clockLine(r: Row) {
  const days = r.target_award_date ? daysBetween(todayISO(), r.target_award_date) : null;
  const parts: string[] = [];
  parts.push(days === null ? "No target award date" : `${days} days to award`);
  if (r.target_award_date) parts.push(`target ${r.target_award_date}`);
  parts.push(r.clock_state === "hold" ? "on hold" : (r.clock_state ?? "not started"));
  if (r.current_phase) parts.push(r.current_phase);
  if (r.clock_state === "hold" && r.hold_reason) parts.push(r.hold_reason);
  return parts.join(" · ");
}

function haystack(r: Row) {
  return [
    r.acquisition_id,
    r.pr_number,
    r.title,
    r.requester_name,
    r.vendor_legal_name,
    r.vendor_uei,
    r.vendor_cage,
    r.mission_id,
    r.missions?.name,
    r.contract_number,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function GlobalSearch() {
  const { authState } = useRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const rows = useQuery({
    queryKey: ["global-search-index"],
    enabled: authState === "signed-in" && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_facts")
        .select(
          "acquisition_id,title,pr_number,requester_name,vendor_legal_name,vendor_uei,vendor_cage,mission_id,contract_number,source_tag,current_phase,clock_state,status,hold_reason,target_award_date,missions(mission_id,name)",
        )
        .order("acquisition_id");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return (rows.data ?? []).filter((r) => haystack(r).includes(needle)).slice(0, 20);
  }, [q, rows.data]);

  function openFile(id: string) {
    setOpen(false);
    setQ("");
    void navigate({ to: "/files/$acquisitionId", params: { acquisitionId: id } });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-canvas px-3 text-[13px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="truncate">Search acquisitions</span>
        <span className="ml-auto hidden shrink-0 text-[11px] xl:inline">⌘K</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 p-4 pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search acquisitions"
            className="w-full max-w-[720px] rounded-xl border border-border bg-background shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border p-4">
              <label htmlFor="global-search-input" className="mb-2 block text-[13px] text-muted-foreground">
                Search by PR number, acquisition ID, title, requester, vendor, contract number, or mission
              </label>
              <input
                id="global-search-input"
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  // Enter opens a matched acquisition only; a query with no
                  // match never opens a blank file page.
                  if (e.key === "Enter" && q.trim() && results[0]) openFile(results[0].acquisition_id);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px] text-foreground"
                placeholder="4200999102"
                autoComplete="off"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {rows.isLoading ? (
                <p className="p-3 text-[13px] text-muted-foreground">Loading the acquisitions.</p>
              ) : null}
              {rows.isError ? (
                <p className="p-3 text-[13px] text-muted-foreground">
                  The search list did not load. Close this and refresh the page.
                </p>
              ) : null}
              {!q.trim() ? (
                <p className="p-3 text-[13px] text-muted-foreground">
                  Type to find an acquisition and open its file.
                </p>
              ) : results.length === 0 && !rows.isLoading ? (
                <p className="p-3 text-[13px] text-muted-foreground">
                  No file matches "{q.trim()}". Try the PR number or the mission name.
                </p>
              ) : null}

              <ul>
                {results.map((r) => (
                  <li key={r.acquisition_id}>
                    <button
                      type="button"
                      onClick={() => openFile(r.acquisition_id)}
                      className="block w-full rounded-lg px-3 py-3 text-left hover:bg-canvas"
                    >
                      <span className="block text-[15px] leading-[22px] text-foreground">
                        {r.acquisition_id} — {r.title ?? "Untitled"}
                      </span>
                      <span className="block text-[13px] leading-[18px] text-muted-foreground">
                        {clockLine(r)}
                      </span>
                      <span className="block text-[13px] leading-[18px] text-muted-foreground">
                        {[
                          r.pr_number ? `PR ${r.pr_number}` : null,
                          r.missions?.name ?? r.mission_id,
                          r.vendor_legal_name,
                          r.requester_name,
                          r.contract_number ? `Contract ${r.contract_number}` : null,
                          r.source_tag === "backfilled" ? "Backfilled" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
