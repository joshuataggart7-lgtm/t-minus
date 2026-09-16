/**
 * Other-office invitation (advisory).
 *
 * Reads only rows that already exist: `polls` for this acquisition and the
 * distinct reviewer roles seeded in `review_rules`. Nothing is sent, no poll
 * row is created here, and no staff name is invented.
 */
import { supabase } from "@/integrations/supabase/client";

export type InvitePoll = {
  poll_id: string;
  reviewer_role: string | null;
  reviewer_name: string | null;
  vote: string | null;
  due_date: string | null;
  phase: string | null;
};

export const NO_OPEN_REVIEW_NOTE = "No other-office review is open on this file.";
export const NO_SEND_NOTE = "T-Minus does not send email. Copy the text and send it yourself.";

export async function loadInviteData(acquisitionId: string): Promise<{
  polls: InvitePoll[];
  roles: string[];
}> {
  const [pollsRes, rulesRes] = await Promise.all([
    supabase
      .from("polls")
      .select("poll_id,reviewer_role,reviewer_name,vote,due_date,phase")
      .eq("acquisition_id", acquisitionId)
      .order("opened_at", { ascending: false }),
    supabase.from("review_rules").select("reviewer_role"),
  ]);
  if (pollsRes.error) throw new Error(pollsRes.error.message);
  if (rulesRes.error) throw new Error(rulesRes.error.message);

  const polls = (pollsRes.data ?? []).map((p) => ({
    poll_id: String(p.poll_id),
    reviewer_role: p.reviewer_role ?? null,
    reviewer_name: p.reviewer_name ?? null,
    vote: p.vote ?? null,
    due_date: p.due_date ?? null,
    phase: p.phase ?? null,
  }));

  const seeded = (rulesRes.data ?? [])
    .map((r) => String(r.reviewer_role ?? "").trim())
    .filter(Boolean);
  const used = polls.map((p) => (p.reviewer_role ?? "").trim()).filter(Boolean);
  const roles = Array.from(new Set([...seeded, ...used])).sort((a, b) => a.localeCompare(b));

  return { polls, roles };
}

/** Open invites are the poll rows with no recorded Go/No-go vote yet.
 *  A blank vote or a case-insensitive "pending" vote is still open. */
export function openPolls(polls: InvitePoll[]): InvitePoll[] {
  return polls.filter((p) => {
    const v = (p.vote ?? "").trim().toLowerCase();
    if (!v) return true; // blank — still open
    if (v === "pending") return true; // seeded pending reviews stay open
    return false; // any other recorded value (go/no-go/voted) is closed
  });
}

export function voteLabel(p: InvitePoll): string {
  const v = (p.vote ?? "").trim();
  if (!v) return "No vote recorded yet";
  if (v.toLowerCase() === "pending") return "Pending";
  return v;
}

export function inviteName(p: InvitePoll): string {
  const n = (p.reviewer_name ?? "").trim();
  return n || "Not assigned";
}

/** Copy-only invite text written from the record. Nothing is sent. */
export function inviteText(input: {
  acquisitionId: string;
  title: string | null | undefined;
  phase: string | null | undefined;
  role: string;
}): string {
  const title = (input.title ?? "").trim() || "Title not recorded";
  const phase = (input.phase ?? "").trim() || "Phase not recorded";
  return [
    `Subject: Review request — ${input.acquisitionId} (${input.role})`,
    "",
    `We are asking ${input.role} to review this acquisition file.`,
    "",
    `Acquisition: ${input.acquisitionId} — ${title}`,
    `Current phase: ${phase}`,
    `Office asked to review: ${input.role}`,
    "",
    `The file: /files/${input.acquisitionId}`,
    `The reviewer inbox: /reviewer-inbox`,
    "",
    "Please read the file and record your Go or No-go in the reviewer inbox.",
    "A No-go needs a reason.",
    "",
    NO_SEND_NOTE,
  ].join("\n");
}
