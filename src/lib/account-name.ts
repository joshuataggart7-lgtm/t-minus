/**
 * One account name for every record we write, so the audit log never shows the
 * same person under two different labels.
 */
export function accountName(displayName?: string | null, email?: string | null, fallback = "Signed-in user") {
  const display = (displayName ?? "").trim();
  if (display) return display;
  const mail = (email ?? "").trim();
  if (mail) return mail.split("@")[0] ?? mail;
  return fallback;
}

/**
 * The account name to write on a record. When the caller's copy is still the
 * placeholder, the signed-in account decides, so one person never appears in
 * the audit log under two labels.
 */
export async function signedInName(given?: string | null): Promise<string> {
  const name = (given ?? "").trim();
  if (name && name !== "Signed-in user") return name;
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return name || "Demo user";
  if (user.is_anonymous) return "Demo user";
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const display = typeof meta['display_name'] === "string" ? meta['display_name'] : null;
  if (display && display.trim()) return display.trim();
  let profileName: string | null = null;
  try {
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const dn = (prof as { display_name?: string | null } | null)?.display_name;
    if (typeof dn === "string" && dn.trim()) profileName = dn.trim();
  } catch {
    profileName = null;
  }
  return accountName(profileName, user.email ?? null, name || "Signed-in user");
}
