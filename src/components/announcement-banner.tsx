import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, X } from "lucide-react";
import { useRole } from "@/components/role-context";
import {
  acknowledge,
  currentUserId,
  inAudience,
  isBlocking,
  isCurrent,
  loadAcks,
  loadAnnouncements,
  severityWord,
  type Announcement,
} from "@/lib/announcements";

/** Compact header notification control plus one dismissible urgent line. */
export function AnnouncementBanner() {
  const { role, user, authState } = useRole();
  const [items, setItems] = useState<Announcement[]>([]);
  const [ackedIds, setAckedIds] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
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
    (a) => isCurrent(a) && inAudience(a, role, user.center_code) && !ackedIds.includes(a.announcement_id),
  );
  const urgent = visible.find((a) => isBlocking(a) && !dismissed.includes(a.announcement_id));

  const onAck = async (a: Announcement) => {
    setBusy(a.announcement_id);
    setError(null);
    try {
      await acknowledge(a, user.name);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The acknowledgment did not save. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`${visible.length} unacknowledged announcements`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {visible.length > 0 ? (
          <span className="absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[11px] leading-4 text-destructive-foreground" data-numeric>
            {visible.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[min(420px,calc(100vw-32px))] rounded-xl border border-border bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-medium">Announcements</h2>
            <Link to="/announcements" onClick={() => setOpen(false)} className="text-[13px] text-primary">
              View all
            </Link>
          </div>
          {visible.length === 0 ? <p className="text-[13px] text-muted-foreground">No unacknowledged announcements.</p> : null}
          <ul className="divide-y divide-border">
            {visible.map((a) => (
              <li key={a.announcement_id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[13px] font-medium">{severityWord(a.severity)}: {a.title}</p>
                {a.body ? <p className="mt-1 text-[13px] text-muted-foreground">{a.body}</p> : null}
                {a.requires_acknowledgment ? (
                  <button type="button" onClick={() => void onAck(a)} disabled={busy === a.announcement_id} className="mt-2 text-[13px] text-primary">
                    {busy === a.announcement_id ? "Saving" : "Acknowledge"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {error ? <p role="alert" className="mt-3 text-[13px] text-destructive">{error}</p> : null}
        </div>
      ) : null}

      {urgent ? (
        <div role="alert" className="fixed left-0 right-0 top-14 z-30 grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background px-4 text-[13px] sm:px-6">
          <p className="truncate"><span className="font-medium">{severityWord(urgent.severity)}:</span> {urgent.title}</p>
          <button type="button" onClick={() => setDismissed((value) => [...value, urgent.announcement_id])} aria-label="Dismiss urgent announcement" className="grid size-7 place-items-center text-muted-foreground hover:text-foreground">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}