import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, X } from "lucide-react";
import { useRole } from "@/components/role-context";
import { usePresenter } from "@/lib/presenter";
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

const DISMISS_KEY = "tminus-dismissed-announcements";

/** Dismissals read back from the browser session; empty when storage is unavailable. */
function readDismissed(): string[] {
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  } catch {
    /* session storage is not required for the dismissal to work */
  }
}

/** Compact header notification control plus one dismissible urgent line at a time. */
export function AnnouncementBanner() {
  const presenter = usePresenter();
  const { role, roles, user, authState } = useRole();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [urgentExpanded, setUrgentExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The urgent line sits in the page flow under the header so it never covers
  // the navigation headings.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById("urgent-announcement-slot")), []);
  // Inside a document or form editor the urgent pill steps aside; the bell
  // still carries it.
  const inEditor = useRouterState({ select: (s) => /^\/(documents|forms)\//.test(s.location.pathname) });
  // Read prior dismissals on mount only; sessionStorage does not exist on the server.
  useEffect(() => setDismissed(readDismissed()), []);

  // Announcements and this user's acknowledgments live in the query cache, so
  // the banner and bell badge stay in place across route changes instead of
  // emptying on every remount. Later re-fetches keep the list in place.
  const qc = useQueryClient();
  const queryKey = ["announcements", user.name, role] as const;
  const announcementsQ = useQuery({
    queryKey,
    enabled: authState === "signed-in",
    staleTime: 60_000,
    queryFn: async () => {
      const [all, acks, uid] = await Promise.all([loadAnnouncements(), loadAcks(), currentUserId()]);
      return {
        items: all,
        ackedIds: acks.filter((a) => a.user_id === uid).map((a) => a.announcement_id),
      };
    },
  });
  const items: Announcement[] = announcementsQ.data?.items ?? [];
  const ackedIds: string[] = announcementsQ.data?.ackedIds ?? [];
  const status: "loading" | "ready" | "error" = announcementsQ.isError
    ? "error"
    : announcementsQ.data
      ? "ready"
      : "loading";
  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ["announcements"] }),
    [qc],
  );

  const visible = items.filter(
    (a) => isCurrent(a) && inAudience(a, roles, user.center_code) && !ackedIds.includes(a.announcement_id),
  );
  const blocking = visible.filter((a) => isBlocking(a) && !dismissed.includes(a.announcement_id));
  const urgent = blocking[0] ?? null;

  // Dismissal is per announcement id and lives in the browser session, so a closed
  // line stays closed across routes and a new announcement still shows.
  const dismiss = (ids: string[]) => {
    const next = Array.from(new Set([...dismissed, ...ids]));
    setDismissed(next);
    writeDismissed(next);
  };

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

  if (presenter) return null;
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
          {status === "loading" ? (
            <p className="text-[13px] text-muted-foreground" role="status">Loading announcements</p>
          ) : status === "error" ? (
            <p className="text-[13px] text-muted-foreground">Announcements did not load. Close this and open it again, or use View all.</p>
          ) : (
            <>
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
            </>
          )}
          {error ? <p role="alert" className="mt-3 text-[13px] text-destructive">{error}</p> : null}
        </div>
      ) : null}

      {urgent && slot && !inEditor
        ? createPortal(
            <div className="mc-urgent-row">
              <div role="alert" className={`mc-urgent-pill${urgentExpanded ? " is-open" : ""}`}>
                <span className="mc-urgent-dot" aria-hidden="true" />
                <p className="mc-urgent-text" title={`${severityWord(urgent.severity)}: ${urgent.title}`}>
                  <span className="font-semibold">{severityWord(urgent.severity)}:</span> {urgent.title}
                </p>
                {blocking.length > 1 ? (
                  <span className="mc-urgent-count" data-numeric>
                    {blocking.indexOf(urgent) + 1} of {blocking.length}
                  </span>
                ) : null}
                {/* Below 640px the pill stays one row until opened. */}
                <button
                  type="button"
                  onClick={() => setUrgentExpanded((v) => !v)}
                  aria-expanded={urgentExpanded}
                  aria-label={urgentExpanded ? "Show less" : "Show the full announcement"}
                  className="mc-urgent-btn sm:hidden"
                >
                  <ChevronDown className={`size-4 transition-transform ${urgentExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {blocking.length > 1 ? (
                  <button type="button" onClick={() => dismiss(blocking.map((a) => a.announcement_id))} className="mc-urgent-all">
                    Dismiss all
                  </button>
                ) : null}
                <button type="button" onClick={() => dismiss([urgent.announcement_id])} aria-label="Dismiss urgent announcement" className="mc-urgent-btn">
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>,
            slot,
          )
        : null}
    </div>
  );
}