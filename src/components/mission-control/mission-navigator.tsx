import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Window event fired by Expand all / Collapse secondary; detail is { open: boolean }. */
export const MISSION_NAV_SET_ALL = "mission-nav:set-all";
/**
 * Window event fired before a jump; detail is { id, target }. A page that keeps
 * sections in tabs listens and shows the tab that holds the target, so the
 * jump lands on a visible section.
 */
export const MISSION_NAV_REVEAL = "mission-nav:reveal";
/**
 * Window event a page fires after it shows a section itself (a hash link, a
 * tab, a rail link); detail is { id }. The navigator marks the item that holds
 * that element, or the first item inside it, as current.
 */
export const MISSION_NAV_CURRENT = "mission-nav:current";

function decodedHash(): string {
  const h = window.location.hash.replace(/^#/, "");
  try {
    return decodeURIComponent(h);
  } catch {
    return h;
  }
}

export type MissionNavItem = {
  id: string;
  label: string;
  badge?: { tone: "hold" | "watch" | "neutral"; text: string } | null;
  /** Optional group heading (for example the tab that holds the section). */
  group?: string;
};

/** A section in a hidden tab has no boxes; the spy skips it. */
function isShown(el: HTMLElement) {
  return el.getClientRects().length > 0;
}

function openContainingDetails(target: HTMLElement) {
  const details = target.matches("details") ? target : target.closest("details");
  if (details instanceof HTMLDetailsElement) details.open = true;
  const containedDetails = target.querySelector<HTMLDetailsElement>(":scope > details");
  if (containedDetails) containedDetails.open = true;
}

/**
 * Space taken at the top of the window by sticky chrome: the app header and,
 * on the file page, the identity strip. Sections land just below it, and the
 * scroll spy reads a section as current once its top passes this line.
 */
export function stickyOffset(): number {
  const header = document.querySelector("header.sticky");
  const strip = document.querySelector<HTMLElement>("[data-file-strip]");
  return (header?.getBoundingClientRect().bottom ?? 0) + (strip?.offsetHeight ?? 0) + 12;
}

function focusSection(target: HTMLElement) {
  const focusTarget =
    target.querySelector<HTMLElement>("h1, h2, h3, summary") ?? target;
  focusTarget.tabIndex = -1;
  focusTarget.focus({ preventScroll: true });
}

export function MissionNavigator({
  items,
  label = "On this file",
  ariaLabel = "Sections on this file",
}: {
  items: MissionNavItem[];
  label?: string;
  ariaLabel?: string;
}) {
  const [availableIds, setAvailableIds] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const frameRef = useRef<number | null>(null);
  // After a jump the clicked item stays current until the reader scrolls on
  // their own. A short section near the end of the page can never reach the
  // top of the window, so the spy alone would name the section above it.
  const lockRef = useRef<string | null>(null);

  const recomputeCurrent = useCallback(() => {
    const targets = availableIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element) && isShown(element as HTMLElement));
    if (!targets.length) return;
    if (lockRef.current && targets.some((t) => t.id === lockRef.current)) {
      const locked = lockRef.current;
      setCurrentId((value) => value === locked ? value : locked);
      return;
    }
    const threshold = stickyOffset() + 8;
    const current = targets.reduce<HTMLElement | null>(
      (last, target) => target.getBoundingClientRect().top <= threshold ? target : last,
      null,
    ) ?? targets[0];
    if (!current) return;
    setCurrentId((value) => value === current.id ? value : current.id);
  }, [availableIds]);

  const scheduleRecompute = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      recomputeCurrent();
    });
  }, [recomputeCurrent]);

  useEffect(() => {
    const refresh = () => {
      const ids = items.map((item) => item.id).filter((id) => document.getElementById(id));
      setAvailableIds((current) =>
        current.length === ids.length && current.every((id, index) => id === ids[index]) ? current : ids,
      );
      setCurrentId((current) => current && ids.includes(current) ? current : ids[0] ?? null);
    };
    refresh();
    const mutationObserver = new MutationObserver(refresh);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => mutationObserver.disconnect();
  }, [items]);

  useEffect(() => {
    const release = () => {
      if (lockRef.current === null) return;
      lockRef.current = null;
      scheduleRecompute();
    };
    const events = ["wheel", "touchstart", "keydown"] as const;
    for (const ev of events) window.addEventListener(ev, release, { passive: true });
    return () => {
      for (const ev of events) window.removeEventListener(ev, release);
    };
  }, [scheduleRecompute]);

  useEffect(() => {
    recomputeCurrent();
    window.addEventListener("scroll", scheduleRecompute, { passive: true });
    window.addEventListener("resize", scheduleRecompute);
    document.addEventListener("toggle", scheduleRecompute, true);
    return () => {
      window.removeEventListener("scroll", scheduleRecompute);
      window.removeEventListener("resize", scheduleRecompute);
      document.removeEventListener("toggle", scheduleRecompute, true);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [recomputeCurrent, scheduleRecompute]);

  // Name the item that holds an element (or the first item inside it), so the
  // highlight follows a hash link or a tab the page opened on its own.
  const resolveItem = useCallback((elementId: string): string | null => {
    const el = elementId ? document.getElementById(elementId) : null;
    if (!el) return null;
    const ids = items.map((item) => item.id);
    let node: HTMLElement | null = el;
    while (node) {
      if (node.id && ids.includes(node.id)) return node.id;
      node = node.parentElement;
    }
    for (const id of ids) {
      const target = document.getElementById(id);
      if (target && el.contains(target)) return id;
    }
    return null;
  }, [items]);

  const markCurrent = useCallback((elementId: string) => {
    const id = resolveItem(elementId);
    if (!id) return;
    lockRef.current = id;
    setCurrentId(id);
  }, [resolveItem]);

  useEffect(() => {
    const onCurrent = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (id) markCurrent(id);
    };
    const onHash = () => {
      const h = decodedHash();
      if (h) markCurrent(h);
    };
    window.addEventListener(MISSION_NAV_CURRENT, onCurrent);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener(MISSION_NAV_CURRENT, onCurrent);
      window.removeEventListener("hashchange", onHash);
    };
  }, [markCurrent]);

  // On load, a hash in the address names the current item once its section exists.
  const loadHashDone = useRef(false);
  useEffect(() => {
    if (loadHashDone.current || !availableIds.length) return;
    const h = decodedHash();
    if (!h) {
      loadHashDone.current = true;
      return;
    }
    if (!document.getElementById(h)) return;
    loadHashDone.current = true;
    markCurrent(h);
  }, [availableIds, markCurrent]);

  const visibleItems = useMemo(
    () => items.filter((item) => availableIds.includes(item.id)),
    [availableIds, items],
  );

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    window.dispatchEvent(new CustomEvent(MISSION_NAV_REVEAL, { detail: { id, target } }));
    openContainingDetails(target);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - stickyOffset());
    // A long trip is instant: a smooth scroll across many screens of loading
    // sections lands short. Short trips stay smooth.
    const far = Math.abs(top - window.scrollY) > window.innerHeight * 2;
    lockRef.current = id;
    window.scrollTo({ top, behavior: reducedMotion || far ? "auto" : "smooth" });
    history.replaceState(null, "", `#${id}`);
    focusSection(target);
    setCurrentId(id);
    // Land again once sections above have settled, in case they grew.
    window.setTimeout(() => {
      if (lockRef.current !== id || !target.isConnected) return;
      const settled = Math.max(0, target.getBoundingClientRect().top + window.scrollY - stickyOffset());
      if (Math.abs(settled - window.scrollY) > 4) window.scrollTo({ top: settled, behavior: "auto" });
    }, reducedMotion || far ? 120 : 700);
  };

  const setAll = (open: boolean) => {
    document.querySelectorAll<HTMLDetailsElement>("details[data-mission-nav-collapsible]").forEach((details) => {
      details.open = open;
    });
    // Sections that collapse with their own toggle (the launch sequence window
    // and the rail's "Show all") follow Expand all and Collapse secondary too.
    window.dispatchEvent(new CustomEvent(MISSION_NAV_SET_ALL, { detail: { open } }));
  };

  return (
    <nav aria-label={ariaLabel} className="mc-nav">
      <p className="mc-nav-label">{label}</p>
      <ol className="mc-nav-list">
        {visibleItems.map((item, index) => (
          <li key={item.id} className={item.group && item.group !== visibleItems[index - 1]?.group ? "mc-nav-grouped" : undefined}>
            {item.group && item.group !== visibleItems[index - 1]?.group ? (
              <span className="mc-nav-group" aria-hidden="true">{item.group}</span>
            ) : null}
            <a
              href={`#${item.id}`}
              aria-current={currentId === item.id ? "location" : undefined}
              onClick={(event) => jump(event, item.id)}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className={cn("mc-nav-badge", `is-${item.badge.tone}`)}>{item.badge.text}</span>
              ) : null}
            </a>
          </li>
        ))}
      </ol>
      <div className="mc-nav-actions">
        <Button type="button" variant="link" size="sm" onClick={() => setAll(true)}>Expand all</Button>
        <Button type="button" variant="link" size="sm" onClick={() => setAll(false)}>Collapse secondary</Button>
      </div>
    </nav>
  );
}

export function MissionNavSection({
  id,
  label,
  collapsible = false,
  defaultOpen = false,
  summary,
  children,
}: {
  id: string;
  label: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  summary?: string;
  children: ReactNode;
}) {
  if (!collapsible) {
    return <div id={id} className="mc-nav-section" aria-label={label}>{children}</div>;
  }

  return (
    <details
      id={id}
      className="mc-nav-section mc-nav-section-collapsible"
      data-mission-nav-collapsible
      open={defaultOpen || undefined}
    >
      <summary>
        <span>{label}</span>
        {summary ? <span className="mc-nav-section-summary">{summary}</span> : null}
        <span className="mc-nav-section-toggle" aria-hidden="true" />
      </summary>
      <div className="mc-nav-section-content">{children}</div>
    </details>
  );
}