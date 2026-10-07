// Display-only actor aliasing for the Audit Log. Pure: no React, no database.

export const SYSTEM_ACTORS = new Set<string>([
  "scheduled job",
  "system migration",
  "demo-seed",
  "signed-in user",
  "demo user",
]);

export type ProfileAliasRow = { email: string | null; display_name: string | null };

/** Map login-id forms and display names to one display name. Ambiguous keys are dropped. */
export function buildActorAliases(rows: ProfileAliasRow[]): Map<string, string> {
  const map = new Map<string, string>();
  const ambiguous = new Set<string>();
  const put = (key: string, name: string) => {
    if (!key || ambiguous.has(key)) return;
    const existing = map.get(key);
    if (existing === undefined) map.set(key, name);
    else if (existing !== name) {
      map.delete(key);
      ambiguous.add(key);
    }
  };
  for (const row of rows) {
    const name = (row.display_name ?? "").trim();
    if (!name) continue;
    const email = (row.email ?? "").trim().toLowerCase();
    if (email) {
      put(email.split("@")[0] ?? email, name);
      put(email, name);
    }
    put(name.toLowerCase(), name);
  }
  return map;
}

export function displayActor(
  raw: string,
  aliases: Map<string, string>,
): { name: string; loginId: string | null } {
  const key = raw.trim().toLowerCase();
  const name = SYSTEM_ACTORS.has(key) ? raw : aliases.get(key) ?? raw;
  return { name, loginId: name !== raw ? raw : null };
}
