import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type MissionNavItem = {
  id: string;
  label: string;
  badge?: { tone: "hold" | "watch" | "neutral"; text: string } | null;
};

function openContainingDetails(target: HTMLElement) {
  const details = target.matches("details") ? target : target.closest("details");
  if (details instanceof HTMLDetailsElement) details.open = true;
  const containedDetails = target.querySelector<HTMLDetailsElement>(":scope > details");
  if (containedDetails) containedDetails.open = true;
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

  const recomputeCurrent = useCallback(() => {
    const targets = availableIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!targets.length) return;
    const threshold = 80;
    const current = targets.reduce<HTMLElement | null>(
      (last, target) => target.getBoundingClientRect().top <= threshold ? target : last,
      null,
    ) ?? targets[0];
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

  const visibleItems = useMemo(
    () => items.filter((item) => availableIds.includes(item.id)),
    [availableIds, items],
  );

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    openContainingDetails(target);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    focusSection(target);
    setCurrentId(id);
    window.setTimeout(scheduleRecompute, reducedMotion ? 0 : 500);
  };

  const setAll = (open: boolean) => {
    document.querySelectorAll<HTMLDetailsElement>("details[data-mission-nav-collapsible]").forEach((details) => {
      details.open = open;
    });
  };

  return (
    <nav aria-label={ariaLabel} className="mc-nav">
      <p className="mc-nav-label">{label}</p>
      <ol className="mc-nav-list">
        {visibleItems.map((item) => (
          <li key={item.id}>
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