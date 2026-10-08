import { useEffect, type RefObject } from "react";

/**
 * Marks a horizontal scroll strip with data-fade="left" | "right" | "both" |
 * "none" so the stylesheet can fade the edge that still has more to scroll.
 * Display only: it never moves the strip or changes what it holds.
 */
export function useScrollFade<T extends HTMLElement>(ref: RefObject<T | null>, deps: readonly unknown[] = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const left = el.scrollLeft > 2;
      const right = max > 2 && el.scrollLeft < max - 2;
      el.dataset["fade"] = left && right ? "both" : left ? "left" : right ? "right" : "none";
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
