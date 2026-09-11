// Aging holds and pending polls. Every hold and every open poll carries an age
// in days. Past the Center's configured number of days (default 5) the item is
// aging, and it goes to a digest for the owner's supervisor.

import type { AcqRow, PollRow } from "@/lib/launch-sequence";

export const DEFAULT_AGING_DAYS = 5;

export type CenterRow = {
  center_code: string;
  center_name?: string | null;
  aging_threshold_days?: number | null;
};

export type UserRow = {
  name: string;
  role?: string | null;
  center_code?: string | null;
  supervisor_name?: string | null;
  supervisor_email?: string | null;
};

export type AgingItem = {
  kind: "hold" | "poll";
  acquisitionId: string;
  centerCode: string;
  title: string;
  /** what is waiting: the hold reason or the reviewer role on the open poll */
  subject: string;
  /** who owns it */
  owner: string;
  /** the supervisor the digest entry goes to, when the owner is a known user */
  supervisor: string | null;
  supervisorEmail: string | null;
  ageDays: number;
  thresholdDays: number;
  aging: boolean;
  phase: string | null;
};

/** Whole days between an ISO timestamp and now, never negative. */
export function ageInDays(since: string | null | undefined, now = new Date()): number | null {
  if (!since) return null;
  const started = new Date(since).getTime();
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.floor((now.getTime() - started) / 86_400_000));
}

/** The Center's configured number of days before an item is aging. */
export function thresholdFor(centerCode: string | null | undefined, centers: CenterRow[]): number {
  const row = centers.find((c) => c.center_code === centerCode);
  const value = row?.aging_threshold_days;
  return typeof value === "number" ? value : DEFAULT_AGING_DAYS;
}

function supervisorOf(owner: string, users: UserRow[]) {
  const match = users.find((u) => u.name === owner);
  return {
    supervisor: match?.supervisor_name ?? null,
    supervisorEmail: match?.supervisor_email ?? null,
  };
}

/** Every hold and every pending poll, with its age and whether it is aging. */
export function agingItems(
  acqs: AcqRow[],
  polls: PollRow[],
  centers: CenterRow[],
  users: UserRow[],
  now = new Date(),
): AgingItem[] {
  const byId = new Map(acqs.map((a) => [a.acquisition_id, a]));
  const items: AgingItem[] = [];

  for (const acq of acqs) {
    if (String(acq.clock_state ?? "") !== "hold") continue;
    const centerCode = String(acq.center_code ?? "");
    const owner = String(acq.hold_owner ?? "Unassigned");
    const thresholdDays = thresholdFor(centerCode, centers);
    const ageDays = ageInDays(acq['hold_started_at'] as string | null, now) ?? 0;
    items.push({
      kind: "hold",
      acquisitionId: acq.acquisition_id,
      centerCode,
      title: String(acq.title ?? ""),
      subject: String(acq.hold_reason ?? "On hold"),
      owner,
      ...supervisorOf(owner, users),
      ageDays,
      thresholdDays,
      aging: ageDays >= thresholdDays,
      phase: acq.current_phase ? String(acq.current_phase) : null,
    });
  }

  for (const poll of polls) {
    if (poll.vote) continue;
    const acq = byId.get(String(poll.acquisition_id ?? ""));
    if (!acq) continue;
    if (String(acq.clock_state ?? "") === "launched") continue;
    const centerCode = String(acq.center_code ?? "");
    const owner = poll.reviewer_name ?? poll.reviewer_role ?? "Unassigned";
    const thresholdDays = thresholdFor(centerCode, centers);
    const ageDays = ageInDays((poll as Record<string, unknown>)['opened_at'] as string | null, now) ?? 0;
    items.push({
      kind: "poll",
      acquisitionId: acq.acquisition_id,
      centerCode,
      title: String(acq.title ?? ""),
      subject: `${poll.reviewer_role ?? "Reviewer"} has not voted`,
      owner,
      ...supervisorOf(owner, users),
      ageDays,
      thresholdDays,
      aging: ageDays >= thresholdDays,
      phase: poll.phase ?? null,
    });
  }

  return items.sort((a, b) => b.ageDays - a.ageDays);
}

/** Aging counts by Center, for the Executive Overview. */
export function agingByCenter(items: AgingItem[]) {
  const map = new Map<string, { centerCode: string; holds: number; polls: number; thresholdDays: number }>();
  for (const item of items) {
    if (!item.aging) continue;
    const row =
      map.get(item.centerCode) ??
      { centerCode: item.centerCode, holds: 0, polls: 0, thresholdDays: item.thresholdDays };
    if (item.kind === "hold") row.holds += 1;
    else row.polls += 1;
    map.set(item.centerCode, row);
  }
  return [...map.values()].sort((a, b) => b.holds + b.polls - (a.holds + a.polls));
}

/** The digest: aging items grouped by the supervisor they escalate to. */
export function digestBySupervisor(items: AgingItem[]) {
  const map = new Map<string, { supervisor: string; supervisorEmail: string | null; items: AgingItem[] }>();
  for (const item of items) {
    if (!item.aging) continue;
    const key = item.supervisor ?? "No supervisor recorded";
    const row = map.get(key) ?? { supervisor: key, supervisorEmail: item.supervisorEmail, items: [] };
    row.items.push(item);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}
