/**
 * Who is acting, and in which role.
 *
 * Seeded demo personas live in public.users. A real signed-in account has a
 * profiles row instead, so the role is read from there and normalised onto the
 * five prototype roles. A signed-in account with no role recorded works the
 * contracting queue, which is the default for the first user in an org.
 */

import { accountName } from "@/lib/account-name";

export type ActorRole = "administrator" | "executive" | "specialist" | "reviewer" | "requester" | "hq";

export type Actor = { name: string; roles: ActorRole[]; role: ActorRole };

type Ctx = {
  supabase: { from: (table: string) => any };
  userId: string;
};

/** 'contracting', 'co' and anything unrecognised work the contracting queue. */
export function normalizeRole(value: string | null | undefined): ActorRole {
  switch ((value ?? "").trim().toLowerCase()) {
    case "executive":
      return "executive";
    case "reviewer":
      return "reviewer";
    case "requester":
      return "requester";
    case "hq":
      return "hq";
    case "administrator":
    case "admin":
      return "administrator";
    default:
      return "specialist";
  }
}

export async function currentActor(context: Ctx): Promise<Actor> {
  const memberships = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (memberships.error) throw new Error(memberships.error.message);
  const assigned = ((memberships.data ?? []) as { role: string }[]).map((row) => normalizeRole(row.role));
  const seeded = await context.supabase
    .from("users")
    .select("name,role")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (seeded.error) throw new Error(seeded.error.message);
  if (seeded.data) {
    const role = normalizeRole(seeded.data.role as string);
    const roles = assigned.length ? assigned : [role];
    return { name: seeded.data.name as string, roles, role: roles[0] ?? role };
  }

  const profile = await context.supabase
    .from("profiles")
    .select("display_name,email,role,is_admin")
    .eq("id", context.userId)
    .maybeSingle();
  if (profile.error) throw new Error(profile.error.message);
  if (!profile.data) throw new Error("Your account was not found. Sign out and back in to try again.");

  const legacyRole = profile.data.is_admin ? "administrator" : normalizeRole(profile.data.role as string);
  const roles = assigned.length ? assigned : [legacyRole];
  const role = roles[0] ?? legacyRole;
  const name = accountName(profile.data.display_name as string | null, profile.data.email as string | null);
  return { name, roles, role };
}

/** The actor, or an error naming the roles that may take this action. */
export async function requireRole(context: Ctx, allowed: ActorRole[], message: string): Promise<Actor> {
  const actor = await currentActor(context);
  if (!actor.roles.includes("administrator") && !allowed.some((role) => actor.roles.includes(role))) {
    throw new Error(message);
  }
  return actor;
}
