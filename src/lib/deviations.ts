/**
 * FAR & NFS Deviation Request (NF 1098 tab 33).
 *
 * A deviation request is its own small file: it has its own form, its own
 * review board (legal, policy, HCA) recording Approve or Disapprove, and its
 * own clock to the decision date. It can hang off an acquisition or stand on
 * its own.
 *
 * Authority (verified on acquisition.gov and in the NFS CG, Sept 11, 2026):
 * RFO FAR 1.303 "The agency head may authorize individual deviations."
 * RFO FAR 1.304(b) "Agency heads may authorize class deviations from the FAR."
 * NFS CG 1801.31(b) "The Assistant Administrator for Procurement is the
 * approval authority for deviations to the FAR, NFS, and this NFS CG, unless
 * otherwise stated." The three-seat review board before that decision is
 * T-Minus practice; no source prescribes it.
 */

import { writeAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { dayWord } from "@/lib/pluralize";

export const DEVIATION_TEMPLATE = {
  key: "far-nfs-deviation",
  name: "FAR & NFS Deviation Request",
  tab: "33",
  citation: "RFO FAR 1.302; RFO FAR 1.303; RFO FAR 1.304; NFS CG 1801.3",
  tier: "guidance" as const,
  revision: "HQ 04/2026 revision, effective 4/27/2026",
  effective: "2026-04-27",
};

export type DeviationType = "individual" | "class";

export const DEVIATION_TYPES: { value: DeviationType; label: string; citation: string }[] = [
  { value: "individual", label: "Individual deviation (this acquisition only)", citation: "RFO FAR 1.303" },
  { value: "class", label: "Class deviation (a class of contracts)", citation: "RFO FAR 1.304" },
];

/** The three reviewers every deviation request goes to, with their planned days. */
export const DEVIATION_REVIEWERS: { role: string; who: string; plannedDays: number; citation: string }[] = [
  { role: "Legal", who: "Office of the Chief Counsel", plannedDays: 5, citation: "Center policy (T-Minus practice)" },
  { role: "Policy", who: "Center procurement policy", plannedDays: 5, citation: "Center policy (T-Minus practice)" },
  { role: "HCA", who: "Head of the contracting activity", plannedDays: 7, citation: "Center policy (T-Minus practice)" },
];

/** Who decides a deviation, by type, with the verified authority. */
export function deviationAuthority(type: string | null | undefined) {
  const cite = type === "class" ? "RFO FAR 1.304(b)" : "RFO FAR 1.303";
  return {
    citation: `${cite}; NFS CG 1801.31(b)`,
    official: "the designated approving official (the Assistant Administrator for Procurement unless otherwise stated, NFS CG 1801.31(b))",
  };
}

/** Board seats record Approve or Disapprove. Old Go / No-go values still read. */
export type DeviationVote = "approve" | "disapprove" | "pending";

export function normalizeDeviationVote(raw: string | null | undefined): DeviationVote {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "approve" || v === "approved" || v === "go") return "approve";
  if (v === "disapprove" || v === "disapproved" || v === "no-go" || v === "nogo") return "disapprove";
  return "pending";
}

export const DEVIATION_VOTE_LABEL: Record<DeviationVote, string> = {
  approve: "Approve",
  disapprove: "Disapprove",
  pending: "No decision yet",
};

/** The request decision: stored "approved" or "disapproved"; old "denied" reads as disapproved. */
export function isDisapproved(decision: string | null | undefined) {
  const v = String(decision ?? "").toLowerCase();
  return v === "disapproved" || v === "denied";
}

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
      : "Disapproved"
    : row.clock_state === "running"
      ? "Running"
      : "Not started";
  const reading = decided
    ? `${state} on ${row.decided_at?.slice(0, 10)}`
    : days === null
      ? "No decision date set"
      : days < 0
        ? `${Math.abs(days)} ${dayWord(Math.abs(days))} past the decision date`
        : `${days} ${dayWord(days)} to the decision`;

  return { days, state, reading, decided };
}

export type DeviationBoardRow = {
  reviewer_role: string;
  who: string;
  citation: string;
  vote: DeviationVote;
  reviewer_name: string | null;
  reason: string | null;
  due_date: string | null;
  voted_at: string | null;
  vote_id: string | null;
};

export function deviationBoard(votes: DeviationVoteRow[]): DeviationBoardRow[] {
  return DEVIATION_REVIEWERS.map((r) => {
    const row = votes.find((v) => v.reviewer_role.toLowerCase() === r.role.toLowerCase());
    return {
      reviewer_role: r.role,
      who: r.who,
      citation: r.citation,
      vote: normalizeDeviationVote(row?.vote),
      reviewer_name: row?.reviewer_name ?? null,
      reason: row?.reason ?? null,
      due_date: row?.due_date ?? null,
      voted_at: row?.voted_at ?? null,
      vote_id: row?.vote_id ?? null,
    };
  });
}

/** One line describing where the review board stands. */
export function boardSummary(board: DeviationBoardRow[]) {
  const against = board.find((b) => b.vote === "disapprove");
  if (against) return `Disapprove from ${against.reviewer_role}${against.reason ? `: ${against.reason}` : ""}`;
  const pending = board.filter((b) => b.vote === "pending");
  if (pending.length === 0) return "All three reviewers recorded Approve. The approving official's decision can be recorded.";
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
  await writeAudit({
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
