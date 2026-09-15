/**
 * Clause change impact.
 *
 * When a PCD, a deviation, or an executive order changes a clause's status in
 * the clauses table, or a Watch item marked "clause change" adds a required
 * clause, every launched or active contract that carries the affected clause
 * (or lacks the newly required one) needs a modification. Nothing here is
 * generated: the change list is read from the clauses table and watch_items,
 * the deadline is the date the change itself sets, and the owner is the CO
 * recorded on the file.
 */

import { supabase } from "@/integrations/supabase/client";
import { clauseDelta, buildModificationPacket, type ClauseRow } from "@/lib/post-award";
import { todayISO } from "@/lib/intake";

export type ClauseChangeKind = "removed" | "moved" | "updated" | "required";

export type ClauseChange = {
  id: string;
  clause_number: string;
  title: string;
  kind: ClauseChangeKind;
  status: string;
  source: string;
  effective_date: string | null;
  url: string | null;
  modification_required: boolean;
  change_deadline: string | null;
};

export type ImpactRow = {
  acquisition_id: string;
  title: string | null;
  center_code: string | null;
  co_name: string | null;
  contract_number: string | null;
  clock_state: string | null;
  period_of_performance_end: string | null;
  monthsRemaining: number | null;
  /** null when the contract's clause list is not stored in T-Minus. */
  clauseListKnown: boolean;
  /** Why this contract is on the list. */
  reason: string;
  task: ModTaskRow | null;
  label: "Potentially affected" | "Applicability unverified" | "Modification required";
  /** True only when a contract number is recorded; otherwise this is still a solicitation. */
  hasContract: boolean;
};

export type ModTaskRow = {
  task_id: string;
  acquisition_id: string;
  clause_number: string;
  change_kind: string;
  change_source: string | null;
  center_code: string | null;
  owner_name: string | null;
  deadline_date: string | null;
  status: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
};

export const NO_CLAUSE_LIST = "clause list not in T-Minus; pull from NCMS";

/** Clause lists are stored as an array of clause numbers on the record. */
export function storedClauseList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.map((v) => String(v).trim()).filter(Boolean);
  return list.length > 0 ? list : null;
}

function kindOf(disposition: string | null, status: string | null): ClauseChangeKind | null {
  const t = `${disposition ?? ""} ${status ?? ""}`.toLowerCase();
  if (/removed|deleted/.test(t)) return "removed";
  if (/moved|renumbered/.test(t)) return "moved";
  if (/updated|revised/.test(t)) return "updated";
  return null;
}

/** "Feb 9, 2024 2:44 AM" or an ISO date; anything else returns null. */
function toISODate(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export type ClauseTableRow = {
  row_id: string;
  clause_number: string;
  title: string | null;
  status: string | null;
  disposition: string | null;
  source: string | null;
  effective_date: string | null;
  last_updated: string | null;
  pcd_reference: string | null;
  rfo_number_or_pcd: string | null;
  ucf_section: string | null;
  prescription_citation: string | null;
  fill_ins: unknown;
  modification_required: boolean;
  change_deadline: string | null;
};

export type WatchClauseItem = {
  item_id: string;
  title: string | null;
  summary: string | null;
  source: string | null;
  url: string | null;
  decided_or_published_date: string | null;
  tags: string[] | null;
  modification_required: boolean;
  change_deadline: string | null;
};

const CLAUSE_PATTERN = /\b(?:52|1852)\.\d{3}-\d{1,2}(?:\s*Alt\.?\s*[IVX]+)?/i;

/** A Watch item tagged "clause change" adds a required clause when it names one. */
export function changesFromWatch(items: WatchClauseItem[]): ClauseChange[] {
  return items
    .filter((i) => (i.tags ?? []).some((t) => /clause change/i.test(t)))
    .map((i): ClauseChange | null => {
      const found = CLAUSE_PATTERN.exec(`${i.title ?? ""} ${i.summary ?? ""}`);
      if (!found) return null;
      return {
        id: `watch:${i.item_id}`,
        clause_number: found[0].replace(/\s+/g, " ").trim(),
        title: i.title ?? "",
        kind: "required" as const,
        status: "required by a Watch item marked clause change",
        source: i.source ?? "Watch",
        effective_date: i.decided_or_published_date,
        url: i.url,
        modification_required: i.modification_required,
        change_deadline: i.change_deadline,
      };
    })
    .filter((c): c is ClauseChange => c !== null);
}

export function changesFromClauses(rows: ClauseTableRow[]): ClauseChange[] {
  const out: ClauseChange[] = [];
  for (const r of rows) {
    const kind = kindOf(r.disposition, r.status);
    if (!kind) continue;
    out.push({
      id: r.row_id,
      clause_number: r.clause_number,
      title: r.title ?? "",
      kind,
      status: r.status ?? r.disposition ?? "",
      source: r.pcd_reference || r.rfo_number_or_pcd || r.source || "clauses table",
      effective_date: toISODate(r.effective_date) ?? toISODate(r.last_updated),
      url: null,
      modification_required: r.modification_required,
      change_deadline: r.change_deadline,
    });
  }
  // The clause tables carry one row per variant, so the same change can appear
  // several times. One entry per clause number and kind.
  const seen = new Set<string>();
  const deduped = out.filter((c) => {
    const key = `${c.clause_number}|${c.kind}|${c.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.sort(
    (a, b) =>
      Number(b.kind === "removed") - Number(a.kind === "removed") ||
      a.clause_number.localeCompare(b.clause_number),
  );
}

/**
 * The deadline the change sets: the change's own effective date. When that date
 * has already passed the modification is due now, and the date is still shown.
 */
export function deadlineFor(change: ClauseChange): { date: string | null; overdue: boolean } {
  const date = change.change_deadline ?? change.effective_date;
  if (!date) return { date: null, overdue: false };
  return { date, overdue: date < todayISO() };
}

export function monthsRemaining(end: string | null, today = todayISO()): number | null {
  if (!end) return null;
  const a = new Date(today + "T00:00:00Z");
  const b = new Date(end + "T00:00:00Z");
  if (Number.isNaN(b.getTime())) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return Math.round((days / 30.44) * 10) / 10;
}

export type ContractRow = {
  acquisition_id: string;
  title: string | null;
  center_code: string | null;
  co_name: string | null;
  contract_number: string | null;
  clock_state: string | null;
  period_of_performance_end: string | null;
  contract_clauses: unknown;
};

/** Launched or active files: anything not scrubbed and not still in intake. */
export function isLaunchedOrActive(row: ContractRow) {
  const state = String(row.clock_state ?? "").toLowerCase();
  return state === "launched" || state === "running" || state === "hold";
}

export function impactedContracts(
  change: ClauseChange,
  contracts: ContractRow[],
  tasks: ModTaskRow[],
  today = todayISO(),
): ImpactRow[] {
  const rows: ImpactRow[] = [];
  for (const c of contracts) {
    if (!isLaunchedOrActive(c)) continue;
    const list = storedClauseList(c.contract_clauses);
    let reason: string | null = null;
    let known = true;
    if (list === null) {
      known = false;
      reason = NO_CLAUSE_LIST;
    } else if (change.kind === "required") {
      if (!list.includes(change.clause_number)) reason = `The required clause ${change.clause_number} is not in the contract's clause list.`;
    } else if (list.includes(change.clause_number)) {
      reason = `The contract's clause list carries ${change.clause_number}, now ${change.status}.`;
    }
    if (!reason) continue;
    const task =
      tasks.find(
        (t) =>
          t.acquisition_id === c.acquisition_id &&
          t.clause_number === change.clause_number &&
          t.change_kind === change.kind,
      ) ?? null;
    rows.push({
      acquisition_id: c.acquisition_id,
      title: c.title,
      center_code: c.center_code,
      co_name: c.co_name,
      contract_number: c.contract_number,
      hasContract: Boolean(String(c.contract_number ?? "").trim()),
      clock_state: c.clock_state,
      period_of_performance_end: c.period_of_performance_end,
      monthsRemaining: monthsRemaining(c.period_of_performance_end, today),
      clauseListKnown: known,
      reason,
      task,
      label: !known ? "Applicability unverified" : change.modification_required ? "Modification required" : "Potentially affected",
    });
  }
  // Sorted by months of performance remaining, least first; unknown end dates last.
  return rows.sort((a, b) => {
    if (a.monthsRemaining === null && b.monthsRemaining === null)
      return a.acquisition_id.localeCompare(b.acquisition_id);
    if (a.monthsRemaining === null) return 1;
    if (b.monthsRemaining === null) return -1;
    return a.monthsRemaining - b.monthsRemaining;
  });
}

// ------------------------------------------------------------------ loaders

export async function loadClauseChanges(): Promise<ClauseChange[]> {
  const [{ data: clauses, error: e1 }, { data: watch, error: e2 }] = await Promise.all([
    supabase
      .from("clauses")
      .select(
        "row_id,clause_number,title,status,disposition,source,effective_date,last_updated,pcd_reference,rfo_number_or_pcd,ucf_section,prescription_citation,fill_ins,modification_required,change_deadline",
      )
      .in("disposition", ["Removed", "Moved"]),
    supabase
      .from("watch_items")
      .select("item_id,title,summary,source,url,decided_or_published_date,tags,modification_required,change_deadline"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return [
    ...changesFromClauses((clauses ?? []) as unknown as ClauseTableRow[]),
    ...changesFromWatch((watch ?? []) as unknown as WatchClauseItem[]),
  ];
}

export async function loadContracts(): Promise<ContractRow[]> {
  const { data, error } = await supabase
    .from("acquisition_facts")
    .select(
      "acquisition_id,title,center_code,co_name,contract_number,clock_state,period_of_performance_end,contract_clauses",
    )
    .order("acquisition_id");
  if (error) throw error;
  return (data ?? []) as unknown as ContractRow[];
}

export async function loadModTasks(): Promise<ModTaskRow[]> {
  const { data, error } = await supabase.from("clause_mod_tasks").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as ModTaskRow[];
}

export async function createModTasks(
  change: ClauseChange,
  rows: ImpactRow[],
  actor: string,
): Promise<number> {
  const { date } = deadlineFor(change);
  if (!change.modification_required) return 0;
  const fresh = rows.filter((r) => r.clauseListKnown && r.task === null);
  if (fresh.length === 0) return 0;
  const payload = fresh.map((r) => ({
    acquisition_id: r.acquisition_id,
    clause_number: change.clause_number,
    change_kind: change.kind,
    change_source: change.source,
    center_code: r.center_code,
    owner_name: r.co_name ?? "Contracting officer not recorded",
    deadline_date: date,
    status: "open",
    note: r.reason,
    created_by: actor,
  }));
  const { error } = await supabase.from("clause_mod_tasks").insert(payload as never);
  if (error) throw error;
  await supabase.from("audit_log").insert(
    fresh.map((r) => ({
      acquisition_id: r.acquisition_id,
      actor,
      action: "Clause change mod task created",
      field: "clause_mod_task",
      old_value: null,
      new_value: `${change.clause_number} (${change.kind}), due ${date ?? "no date set"}`,
      reason: change.source,
      phase: "Administration",
    })) as never,
  );
  return fresh.length;
}

export async function completeModTask(task: ModTaskRow, actor: string) {
  const { error } = await supabase
    .from("clause_mod_tasks")
    .update({ status: "complete", completed_at: new Date().toISOString(), completed_by: actor } as never)
    .eq("task_id", task.task_id);
  if (error) throw error;
  await supabase.from("audit_log").insert({
    acquisition_id: task.acquisition_id,
    actor,
    action: "Clause change mod task completed",
    field: "clause_mod_task",
    old_value: "open",
    new_value: "complete",
    reason: `${task.clause_number} (${task.change_kind})`,
    phase: "Administration",
  } as never);
}

/** Mods done against mods due, by Center. */
export function modsByCenter(tasks: ModTaskRow[]) {
  const map = new Map<string, { due: number; done: number }>();
  for (const t of tasks) {
    const key = t.center_code ?? "Unassigned";
    const row = map.get(key) ?? { due: 0, done: 0 };
    row.due += 1;
    if (t.status === "complete") row.done += 1;
    map.set(key, row);
  }
  return [...map.entries()]
    .map(([center, v]) => ({ center, ...v }))
    .sort((a, b) => a.center.localeCompare(b.center));
}

/**
 * SF 30 handoff packet for one file, showing the clause delta this change
 * makes. NCMS writes the modification of record (NFS CG 1804.11).
 */
export async function sf30PacketFor(change: ClauseChange, row: ImpactRow) {
  const { data: acq, error } = await supabase
    .from("acquisition_facts")
    .select("*")
    .eq("acquisition_id", row.acquisition_id)
    .maybeSingle();
  if (error) throw error;
  const { data: clauseRows } = await supabase
    .from("clauses")
    .select("clause_number,title,ucf_section,source,status,effective_date,disposition,fill_ins")
    .eq("clause_number", change.clause_number);
  const delta = clauseDelta((clauseRows ?? []) as unknown as ClauseRow[]);
  const packet = buildModificationPacket(
    acq as never,
    "administrative",
    `Clause change: ${change.clause_number} — ${change.status} (${change.source})`,
    delta,
    null,
  );
  return {
    ...packet,
    clause_change: {
      clause_number: change.clause_number,
      kind: change.kind,
      status: change.status,
      source: change.source,
      effective_date: change.effective_date,
      deadline: deadlineFor(change).date,
    },
    clause_list_note: row.clauseListKnown ? null : NO_CLAUSE_LIST,
  };
}
