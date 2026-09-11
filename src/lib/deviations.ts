/**
 * FAR & NFS Deviation Request (NF 1098 tab 33).
 *
 * A deviation request is its own small file: it has its own form, its own
 * go/no-go poll (legal, policy, HCA) and its own clock to the decision date.
 * It can hang off an acquisition or stand on its own.
 */

import { supabase } from "@/integrations/supabase/client";

export const DEVIATION_TEMPLATE = {
  key: "far-nfs-deviation",
  name: "FAR & NFS Deviation Request",
  tab: "33",
  citation: "FAR 1.402; FAR 1.403; FAR 1.404; NFS 1801.4",
  tier: "guidance" as const,
  revision: "HQ 04/2026 revision, effective 4/27/2026",
  effective: "2026-04-27",
};

export type DeviationType = "individual" | "class";

export const DEVIATION_TYPES: { value: DeviationType; label: string; citation: string }[] = [
  { value: "individual", label: "Individual deviation (this acquisition only)", citation: "FAR 1.403" },
  { value: "class", label: "Class deviation (a class of contracts)", citation: "FAR 1.404" },
];

/** The three reviewers every deviation request goes to, with their planned days. */
export const DEVIATION_REVIEWERS: { role: string; who: string; plannedDays: number; citation: string }[] = [
  { role: "Legal", who: "Office of the Chief Counsel", plannedDays: 5, citation: "NFS CG 1801.4; Center policy" },
  { role: "Policy", who: "Center procurement policy", plannedDays: 5, citation: "NFS 1801.404; Center policy" },
  { role: "HCA", who: "Head of the contracting activity", plannedDays: 7, citation: "FAR 1.404; NFS 1801.404" },
];

export type DeviationRow = {
  deviation_id: string;
  acquisition_id: string | null;
  center_code: string | null;
  title: string;
  citation: string;
  deviation_type: string;
  regulation_text: string | null;
  proposed_text: string | null;
  justification: string | null;
  requester_name: string;
  need_date: string | null;
  target_decision_date: string | null;
  clock_started_at: string | null;
  clock_state: string;
  status: string;
  decision: string | null;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type DeviationVoteRow = {
  vote_id: string;
  deviation_id: string;
  reviewer_role: string;
  reviewer_name: string | null;
  vote: string | null;
  reason: string | null;
  due_date: string | null;
  voted_at: string | null;
};

export const daysBetween = (from: Date, to: Date) =>
  Math.round((to.setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0)) / 86_400_000);

export function addDays(from: Date, days: number) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days to the decision date, and what the clock line should read. */
export function deviationClock(row: DeviationRow) {
  const decided = Boolean(row.decided_at);
  const days = row.target_decision_date ? daysBetween(new Date(), new Date(row.target_decision_date)) : null;
  const state = decided
    ? row.decision === "approved"
      ? "Approved"
      : "Denied"
    : row.clock_state === "running"
      ? "Running"
      : "Not started";
  const reading = decided
    ? `${state} on ${row.decided_at?.slice(0, 10)}`
    : days === null
      ? "No decision date set"
      : days < 0
        ? `${Math.abs(days)} days past the decision date`
        : `${days} days to the decision`;
  return { days, state, reading, decided };
}

export type DeviationBoardRow = {
  reviewer_role: string;
  who: string;
  citation: string;
  vote: "Go" | "No-go" | "pending";
  reviewer_name: string | null;
  reason: string | null;
  due_date: string | null;
  voted_at: string | null;
  vote_id: string | null;
};

export function deviationBoard(votes: DeviationVoteRow[]): DeviationBoardRow[] {
  return DEVIATION_REVIEWERS.map((r) => {
    const row = votes.find((v) => v.reviewer_role.toLowerCase() === r.role.toLowerCase());
    const raw = (row?.vote ?? "").toLowerCase();
    return {
      reviewer_role: r.role,
      who: r.who,
      citation: r.citation,
      vote: raw === "go" ? "Go" : raw === "no-go" ? "No-go" : "pending",
      reviewer_name: row?.reviewer_name ?? null,
      reason: row?.reason ?? null,
      due_date: row?.due_date ?? null,
      voted_at: row?.voted_at ?? null,
      vote_id: row?.vote_id ?? null,
    };
  });
}

/** One line describing where the poll stands. */
export function boardSummary(board: DeviationBoardRow[]) {
  const nogo = board.find((b) => b.vote === "No-go");
  if (nogo) return `No-go from ${nogo.reviewer_role}${nogo.reason ? ` — ${nogo.reason}` : ""}`;
  const pending = board.filter((b) => b.vote === "pending");
  if (pending.length === 0) return "All three reviewers voted Go. The HCA decision can be recorded.";
  return `Waiting on ${pending.map((p) => p.reviewer_role).join(", ")}`;
}

export async function loadDeviations() {
  const { data, error } = await supabase
    .from("deviation_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DeviationRow[];
}

export async function loadDeviation(deviationId: string) {
  const [reqRes, voteRes] = await Promise.all([
    supabase.from("deviation_requests").select("*").eq("deviation_id", deviationId).maybeSingle(),
    supabase.from("deviation_votes").select("*").eq("deviation_id", deviationId),
  ]);
  if (reqRes.error) throw new Error(reqRes.error.message);
  if (voteRes.error) throw new Error(voteRes.error.message);
  return {
    request: (reqRes.data ?? null) as unknown as DeviationRow | null,
    votes: (voteRes.data ?? []) as unknown as DeviationVoteRow[],
  };
}

export async function logDeviation(input: {
  acquisitionId: string | null;
  actor: string;
  action: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason: string;
}) {
  await supabase.from("audit_log").insert({
    acquisition_id: input.acquisitionId,
    actor: input.actor,
    action: input.action,
    field: input.field,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    reason: input.reason,
    phase: "Deviation request",
  } as never);
}
