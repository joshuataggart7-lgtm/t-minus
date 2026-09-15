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
