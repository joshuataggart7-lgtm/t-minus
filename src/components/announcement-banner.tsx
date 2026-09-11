import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useRole } from "@/components/role-context";
import {
  acknowledge,
  currentUserId,
  inAudience,
  isBlocking,
  isCurrent,
  loadAcks,
  loadAnnouncements,
  severityColor,
  severityWord,
  type Announcement,
} from "@/lib/announcements";

/**
 * Banner shown at the top of every page to everyone in the audience,
 * until they acknowledge or the announcement expires.
 */
export function AnnouncementBanner() {
  const { role, user, authState } = useRole();
  const [items, setItems] = useState<Announcement[]>([]);
  const [ackedIds, setAckedIds] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [all, acks, uid] = await Promise.all([loadAnnouncements(), loadAcks(), currentUserId()]);
    setItems(all);
    setAckedIds(acks.filter((a) => a.user_id === uid).map((a) => a.announcement_id));
  }, []);

  useEffect(() => {
    if (authState !== "signed-in") return;
    setDismissed([]);
    void refresh().catch(() => setItems([]));
  }, [authState, role, refresh]);

  const visible = items.filter(
    (a) =>
      isCurrent(a) &&
      inAudience(a, role, user.center_code) &&
      !ackedIds.includes(a.announcement_id) &&
      !dismissed.includes(a.announcement_id),
  );
  if (visible.length === 0) return null;

  const onAck = async (a: Announcement) => {
    setBusy(a.announcement_id);
    setError(null);
    try {
      await acknowledge(a, user.name);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} Reload the page and acknowledge again.`
          : "The acknowledgment did not save. Reload the page and try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="border-b border-border bg-background">
      {visible.map((a) => (
        <div
          key={a.announcement_id}
          role={isBlocking(a) ? "alert" : "status"}
          className="flex flex-wrap items-start gap-x-6 gap-y-2 border-l-4 px-4 py-3 sm:px-6"
          style={{ borderLeftColor: severityColor(a.severity) }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-foreground">
              {severityWord(a.severity)}: {a.title}
            </p>
            {a.body ? <p className="mt-1 max-w-[80ch] text-[14px] text-muted-foreground">{a.body}</p> : null}
            {a.link ? (
              <a
                href={a.link}
                className="mt-1 inline-block text-[14px] text-primary underline underline-offset-2 hover:text-primary-hover"
              >
                Open the notice
              </a>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {a.requires_acknowledgment ? (
              <button
                type="button"
                onClick={() => void onAck(a)}
                disabled={busy === a.announcement_id}
                className="rounded-lg border-2 border-border px-3 py-2 text-[13px] text-foreground hover:border-primary"
              >
                {busy === a.announcement_id ? "Saving" : "Acknowledge"}
              </button>
            ) : null}
            {isBlocking(a) ? (
              <span className="text-[13px] text-muted-foreground">Acknowledgment required</span>
            ) : (
              <button
                type="button"
                onClick={() => setDismissed((d) => [...d, a.announcement_id])}
                className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            )}
            <Link to="/announcements" className="text-[13px] text-primary underline underline-offset-2">
              All announcements
            </Link>
          </div>
        </div>
      ))}
      {error ? (
        <p role="alert" className="px-4 pb-3 text-[13px] sm:px-6" style={{ color: "var(--atrisk)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
