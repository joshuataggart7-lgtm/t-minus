// Appearance: Night (default) or Day. A view preference only. Nothing here
// touches a record, and print always uses the white Day palette.

import { useEffect, useSyncExternalStore } from "react";

export type Theme = "night" | "day";

export const THEME_KEY = "tminus-theme";
export const DEFAULT_THEME: Theme = "night";

/**
 * Runs in the document head before first paint so a saved Day preference
 * never flashes Night. Kept as a string because it ships inline.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="day"||t==="night"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

let current: Theme = DEFAULT_THEME;
let hydrated = false;
const subscribers = new Set<() => void>();

function emit() {
  for (const fn of subscribers) fn();
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function setTheme(next: Theme) {
  current = next;
  try {
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    /* storage is not required for the switch to work */
  }
  emit();
}

/** Reads the appearance. Night on the server and on first paint. */
export function useTheme(): Theme {
  const value = useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_THEME,
  );
  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    const attr = document.documentElement.getAttribute("data-theme");
    if ((attr === "day" || attr === "night") && attr !== current) {
      current = attr;
      emit();
    }
  }, []);
  return value;
}
