/**
 * What moved since this browser last opened Today or a file.
 * The marker stays in local storage. Nothing is written to the database.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { auditActionLabel, auditPhaseLabel } from "@/lib/audit-display";

export type LookRow = {
  log_id: string;
  acquisition_id: string | null;
  action: string | null;
  field: string | null;
  phase: string | null;
  logged_at: string | null;
  new_value: string | null;
};

export type ChangeKind = "save" | "decision" | "hold" | "phase";

export type SinceChange = {
  id: string;
  acquisitionId: string;
  at: string;
  kind: ChangeKind;
  sentence: string;
};

const SAVE = /document saved|section k saved|document attached|document filed|document removed/i;
const DECISION = /decision|document reviewed|go recorded|no-go recorded|review opened|approve|disapprove|concur|nonconcur|legally sufficient/i;

export function changeKind(row: { action: string | null; field: string | null; new_value?: string | null }): ChangeKind | null {
  const field = (row.field ?? "").trim().toLowerCase();
  const action = row.action ?? "";
  const next = (row.new_value ?? "").trim().toLowerCase();
  if (field === "current_phase") return "phase";
  if (field === "clock_state" || field === "hold_reason" || /\bhold\b/i.test(action)) {
    if (next === "launched" || next === "scrubbed") return null;
    return "hold";
  }
  if (DECISION.test(action)) return "decision";
  if (SAVE.test(action)) return "save";
  return null;
}

export function changeSentence(row: LookRow): string | null {
  const kind = changeKind(row);
  if (!kind) return null;
  if (kind === "phase") {
    const next = auditPhaseLabel(row.new_value) || String(row.new_value ?? "").trim();
    return next ? `The phase moved to ${next}.` : "The phase moved.";
  }
  if (kind === "hold") {
    const next = (row.new_value ?? "").trim().toLowerCase();
    if (next === "running" || /clear/i.test(row.action ?? "")) return "The hold was cleared.";
    if (next === "hold" || /\bhold\b/i.test(row.action ?? "")) return "The file was placed on hold.";
    return "A hold was recorded.";
  }
  if (kind === "decision") {
    const label = auditActionLabel(row.action);
    return label ? `${label.replace(/\.$/, "")}.` : "A decision was recorded.";
  }
  const label = auditActionLabel(row.action);
  return label ? `${label.replace(/\.$/, "")}.` : "A document was saved.";
}

export function changesSince(rows: LookRow[], sinceIso: string): SinceChange[] {
  const since = Date.parse(sinceIso);
  if (Number.isNaN(since)) return [];
  const out: SinceChange[] = [];
  for (const row of rows) {
    const at = row.logged_at ?? "";
    const when = Date.parse(at);
    if (!at || Number.isNaN(when) || when <= since) continue;
    const sentence = changeSentence(row);
    const kind = changeKind(row);
    if (!sentence || !kind || !row.acquisition_id) continue;
    out.push({ id: row.log_id, acquisitionId: row.acquisition_id, at, kind, sentence });
  }
  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return out;
}

export function lookStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${formatted} CT`;
}

type Book = { desk?: string; files: Record<string, string> };

function storageKey(user: string): string {
  return `tminus-last-look:${user.trim().toLowerCase()}`;
}

function readBook(user: string): Book {
  try {
    const raw = window.localStorage.getItem(storageKey(user));
    if (!raw) return { files: {} };
    const parsed = JSON.parse(raw) as Book;
    const files = parsed.files ?? {};
    return parsed.desk ? { desk: parsed.desk, files } : { files };
  } catch {
    return { files: {} };
  }
}

function writeBook(user: string, book: Book) {
  try {
    window.localStorage.setItem(storageKey(user), JSON.stringify(book));
  } catch {
    /* a full or blocked store just means the next visit reads as a first look */
  }
}

/** Read the previous look once, then stamp this visit after a short stay. */
export function useLastLook(user: string, fileId: string | null): { since: string | null; ready: boolean } {
  const [since, setSince] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const book = readBook(user);
    setSince(fileId ? book.files[fileId] ?? null : book.desk ?? null);
    setReady(true);
    const now = new Date().toISOString();
    const timer = window.setTimeout(() => {
      const fresh = readBook(user);
      if (fileId) fresh.files[fileId] = now;
      else fresh.desk = now;
      writeBook(user, fresh);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [user, fileId]);
  return { since, ready };
}

/** Read-only. Only the four kinds of change, and only after a stored look. */
export async function loadChangesSince(acquisitionIds: string[], sinceIso: string): Promise<LookRow[]> {
  if (acquisitionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("audit_log")
    .select("log_id,acquisition_id,action,field,phase,logged_at,new_value")
    .in("acquisition_id", acquisitionIds)
    .gt("logged_at", sinceIso)
    .order("logged_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as LookRow[];
}
