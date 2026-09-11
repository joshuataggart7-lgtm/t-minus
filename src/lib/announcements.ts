import { supabase } from "@/integrations/supabase/client";
import type { RoleId } from "@/lib/roles";

export type Announcement = {
  announcement_id: string;
  title: string;
  body: string | null;
  severity: string | null;
  audience_roles: string[] | null;
  audience_centers: string[] | null;
  effective_from: string | null;
  effective_until: string | null;
  link: string | null;
  requires_acknowledgment: boolean | null;
  posted_by: string | null;
  posted_at: string;
};

export type Ack = { announcement_id: string; user_id: string; acknowledged_at: string };

export const SEVERITIES = ["notice", "action required", "urgent"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Urgent and action-required notices cannot be dismissed without acknowledging. */
export function isBlocking(a: Announcement): boolean {
  const s = (a.severity ?? "").toLowerCase();
  return Boolean(a.requires_acknowledgment) && (s === "urgent" || s === "action required");
}

export function severityColor(severity: string | null): string {
  switch ((severity ?? "").toLowerCase()) {
    case "urgent":
      return "var(--atrisk)";
    case "action required":
      return "var(--attention)";
    default:
      return "var(--ontrack)";
  }
}

export function severityWord(severity: string | null): string {
  const s = (severity ?? "notice").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isCurrent(a: Announcement, now = new Date()): boolean {
  const from = a.effective_from ? new Date(a.effective_from) : null;
  const until = a.effective_until ? new Date(a.effective_until) : null;
  if (from && from > now) return false;
  if (until && until < now) return false;
  return true;
}

export function inAudience(a: Announcement, role: RoleId, centerCode: string): boolean {
  const roles = a.audience_roles ?? [];
  const centers = a.audience_centers ?? [];
  const roleOk = roles.length === 0 || roles.includes(role);
  const centerOk = centers.length === 0 || centers.includes(centerCode) || centers.includes("All");
  return roleOk && centerOk;
}

export async function loadAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("posted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

export async function loadAcks(): Promise<Ack[]> {
  const { data, error } = await supabase.from("announcement_acks").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as Ack[];
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function acknowledge(a: Announcement, actor: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("You are not signed in yet. Reload the page and try again.");
  const acknowledged_at = new Date().toISOString();
  const { error } = await supabase
    .from("announcement_acks")
    .upsert({ announcement_id: a.announcement_id, user_id: userId, acknowledged_at });
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    acquisition_id: null,
    actor,
    action: "Announcement acknowledged",
    field: "announcement",
    old_value: null,
    new_value: a.title,
    reason: null,
    logged_at: acknowledged_at,
  });
}
