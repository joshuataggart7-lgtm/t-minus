// Presenter mode: a demo-only view switch for administrators.
//
// It hides the Setup group, the seed status and Simulate pages and the
// Novice/Veteran switch, and prints the file header and launch sequence one
// step larger. Nothing else changes and it is off by default.

import { useEffect, useSyncExternalStore } from "react";

const KEY = "tminus-presenter";
let on = false;
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

export function setPresenter(next: boolean) {
  on = next;
  try {
    window.sessionStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* session storage is not required for the toggle to work */
  }
  emit();
}

/** Reads the toggle. Always false on the server and on first paint. */
export function usePresenter(): boolean {
  const value = useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  );
  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    try {
      if (window.sessionStorage.getItem(KEY) === "1") {
        on = true;
        emit();
      }
    } catch {
      /* ignore */
    }
  }, []);
  return value;
}
