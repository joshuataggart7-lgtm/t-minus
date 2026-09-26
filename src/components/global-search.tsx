import { useNavigate, useRouterState } from "@tanstack/react-router";
import { usePresenter } from "@/lib/presenter";
import { matchCommands, type CommandContext, type ShellCommand } from "@/components/commands/command-registry";
import { SHELL_COMMAND_PROVIDERS } from "@/components/commands/providers";
import { useOperationalDisplay } from "@/components/mission-control/use-operational-display";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/components/role-context";
import { Search } from "lucide-react";
import { countdownText } from "@/components/launch-countdown";

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
  contract_clauses?: unknown;
  missions?: { mission_id: string; name: string | null } | null;
};

type OperationalDisplay = ReturnType<typeof useOperationalDisplay>["byId"] extends Map<string, infer T> ? T : never;

/** One plain sentence of operational state, using the same derivation as Files. */
function clockLine(display: OperationalDisplay | undefined, loading: boolean) {
  if (!display) return loading ? "Status loading" : "Status unavailable";
  const view = display.countdown;
  const caption = view.caption === view.badge ? "" : ` · ${view.caption}`;
  const countdown = view.pastTarget
    ? countdownText(view, { omitBadge: view.badge === display.readiness })
    : view.days === null
      ? view.caption
      : `${view.prefix} ${view.days} days${view.badge ? ` ${view.badge}` : ""}${caption}`;
  return [
    display.readiness,
    countdown,
    display.phase,
    display.readiness === "HOLD" && display.holdReason ? `Hold: ${display.holdReason}` : null,
  ].filter(Boolean).join(" · ");
}

type AuditRow = {
  acquisition_id: string | null;
  action: string | null;
  field: string | null;
  reason: string | null;
  new_value: string | null;
  logged_at: string;
};

/** Clause numbers stored on the file, if the record holds a readable list. */
function clauseNumbers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : typeof v === "object" && v ? String((v as Record<string, unknown>)["clause_number"] ?? "") : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,;\s]+/).filter(Boolean);
  }
  return [];
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
    ...clauseNumbers(r.contract_clauses),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function GlobalSearch() {
  const { authState, role, roles } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const presenter = usePresenter();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const operational = useOperationalDisplay(authState === "signed-in" && open);

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

  useEffect(() => setActiveIndex(-1), [q]);

  const rows = useQuery({
    queryKey: ["global-search-index"],
    enabled: authState === "signed-in" && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_facts")
        .select(
          "acquisition_id,title,pr_number,requester_name,vendor_legal_name,vendor_uei,vendor_cage,mission_id,contract_number,contract_clauses,source_tag,current_phase,clock_state,status,hold_reason,target_award_date,missions(mission_id,name)",
        )
        .order("acquisition_id");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // Prototype: a bounded slice of recent audit rows, not the whole trail.
  const AUDIT_LIMIT = 600;
  const audit = useQuery({
    queryKey: ["global-search-audit", AUDIT_LIMIT],
    enabled: authState === "signed-in" && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("acquisition_id,action,field,reason,new_value,logged_at")
        .order("logged_at", { ascending: false })
        .limit(AUDIT_LIMIT);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];

    const auditHit = new Map<string, string>();
    for (const a of audit.data ?? []) {
      if (!a.acquisition_id || auditHit.has(a.acquisition_id)) continue;
      const text = [a.action, a.field, a.reason, a.new_value].filter(Boolean).join(" ");
      if (text.toLowerCase().includes(needle)) auditHit.set(a.acquisition_id, text);
    }

    const hits: { row: Row; hint: string | null }[] = [];
    for (const r of rows.data ?? []) {
      const clause = clauseNumbers(r.contract_clauses).find((c) => c.toLowerCase().includes(needle));
      const fieldMatch = haystack(r).includes(needle);
      const auditText = auditHit.get(r.acquisition_id) ?? null;
      if (!fieldMatch && !auditText) continue;
      let hint: string | null = null;
      if (clause) hint = `matched clause ${clause}`;
      else if (r.vendor_uei && r.vendor_uei.toLowerCase().includes(needle)) hint = "matched vendor UEI";
      else if (r.vendor_cage && r.vendor_cage.toLowerCase().includes(needle)) hint = "matched vendor CAGE";
      else if (!fieldMatch && auditText) hint = `matched audit: ${auditText.slice(0, 90)}`;
      hits.push({ row: r, hint });
      if (hits.length >= 20) break;
    }
    return hits;
  }, [q, rows.data, audit.data]);

  const commandCtx: CommandContext = {
    roles,
    role,
    pathname,
    openAcquisitionId: /^\/(?:files|documents\/[^/]+|forms\/[^/]+)\/([^/]+)/.exec(pathname)?.[1] ?? null,
    presenter,
    navigate: (to: string) => void navigate({ to }),
  };
  const commands = matchCommands(commandCtx, q, { providers: SHELL_COMMAND_PROVIDERS, limit: 40 });
  const commandGroups = commands.reduce<Record<string, ShellCommand[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  function runCommand(c: ShellCommand) {
    setOpen(false);
    setQ("");
    c.run(commandCtx);
  }

  function openFile(id: string) {
    setOpen(false);
    setQ("");
    void navigate({ to: "/files/$acquisitionId", params: { acquisitionId: id } });
  }
  const optionCount = results.length + commands.length;
  const activeOptionId = activeIndex < 0 ? undefined : `global-search-option-${activeIndex}`;

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
                Prototype search. It reads titles, acquisition IDs, PR numbers, requesters, vendors,
                UEI and CAGE, contract numbers, missions, clause numbers on the file, and a capped
                 slice of recent audit text. It also lists the pages in your sidebar; choose one with
                 the arrow keys and Enter, the mouse, or Tab.
              </label>
              <input
                id="global-search-input"
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                   if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                     e.preventDefault();
                     if (optionCount === 0) return;
                     setActiveIndex((current) => e.key === "ArrowDown"
                       ? (current + 1) % optionCount
                       : current <= 0 ? optionCount - 1 : current - 1);
                     return;
                   }
                   if (e.key !== "Enter" || !q.trim()) return;
                   e.preventDefault();
                   const activeResult = activeIndex >= 0 && activeIndex < results.length ? results[activeIndex] : undefined;
                   const activeCommand = activeIndex >= results.length ? commands[activeIndex - results.length] : undefined;
                   if (activeResult) {
                     openFile(activeResult.row.acquisition_id);
                   } else if (activeCommand) {
                     runCommand(activeCommand);
                   } else if (results[0]) {
                     openFile(results[0].row.acquisition_id);
                   } else if (commands[0]) {
                     runCommand(commands[0]);
                   }
                }}
                 role="combobox"
                 aria-controls="global-search-options"
                 aria-expanded="true"
                 aria-activedescendant={activeOptionId}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px] text-foreground"
                placeholder="4200999102"
                autoComplete="off"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              <div aria-live="polite">
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
                  Type to find an acquisition and open its file, or choose a page below.
                </p>
              ) : results.length === 0 && !rows.isLoading ? (
                <p className="p-3 text-[13px] text-muted-foreground">
                  No file matches "{q.trim()}". Try the PR number or the mission name.
                </p>
              ) : null}
              </div>

              <div id="global-search-options" role="listbox">
              {results.length > 0 ? (
              <div role="group" aria-labelledby="global-search-files-heading">
              <p id="global-search-files-heading" className="sr-only">Files</p>
              <ul role="presentation">
                {results.map(({ row: r, hint }, index) => (
                  <li key={r.acquisition_id} role="presentation">
                    <button
                      type="button"
                      id={`global-search-option-${index}`}
                      role="option"
                      aria-selected={activeIndex === index}
                      onClick={() => openFile(r.acquisition_id)}
                      className={`block w-full rounded-lg px-3 py-3 text-left hover:bg-canvas ${activeIndex === index ? "border-l-2 border-primary bg-canvas font-semibold text-foreground" : ""}`}
                    >
                      <span className="block text-[15px] leading-[22px] text-foreground">
                        {r.acquisition_id} — {r.title ?? "Untitled"}
                      </span>
                      <span className="block text-[13px] leading-[18px] text-muted-foreground">
                        {clockLine(operational.byId.get(r.acquisition_id), operational.isLoading)}
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
                      {hint ? (
                        <span className="block text-[13px] leading-[18px] text-muted-foreground">{hint}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              </div>
              ) : null}

              {Object.entries(commandGroups).map(([group, list], i) => (
                <div key={group} role="group" aria-labelledby={`global-search-group-${i}`} className="mt-2 border-t border-border pt-2">
                  <p id={`global-search-group-${i}`} role="presentation" className="px-3 py-1 text-[13px] text-muted-foreground">{group}</p>
                  <ul role="presentation">
                    {list.map((c) => {
                      const index = results.length + commands.indexOf(c);
                      return (
                      <li key={c.id} role="presentation">
                        <button
                          type="button"
                          id={`global-search-option-${index}`}
                          role="option"
                          aria-selected={activeIndex === index}
                          onClick={() => runCommand(c)}
                          className={`block w-full rounded-lg px-3 py-3 text-left text-[15px] leading-[22px] text-foreground hover:bg-canvas ${activeIndex === index ? "border-l-2 border-primary bg-canvas font-semibold text-foreground" : ""}`}
                        >
                          {c.label}
                        </button>
                      </li>
                    )})}
                  </ul>
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
