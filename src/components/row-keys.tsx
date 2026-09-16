import { useEffect, useRef } from "react";

/**
 * Keyboard movement over a list of acquisition rows. J and K move focus row to
 * row, E follows the row's exit control, W follows the row's write control.
 * Rows opt in with data-row-nav; a row's controls opt in with
 * data-row-action="exit" or data-row-action="write". Nothing here changes a
 * record, and a row without a control simply does nothing on that key.
 */
export function useRowKeys(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) return;
        if (target.closest("[role='dialog']")) return;
      }
      const key = event.key.toLowerCase();
      if (!["j", "k", "e", "w"].includes(key)) return;
      const root = containerRef.current;
      if (!root) return;
      const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-row-nav]"));
      if (rows.length === 0) return;
      const current = target?.closest<HTMLElement>("[data-row-nav]") ?? null;
      const index = current ? rows.indexOf(current) : -1;

      if (key === "j" || key === "k") {
        const next =
          key === "j"
            ? rows[Math.min(index + 1, rows.length - 1)]
            : rows[Math.max(index - 1, 0)];
        if (next) {
          event.preventDefault();
          next.focus();
          next.scrollIntoView({ block: "nearest" });
        }
        return;
      }

      const row = current ?? rows[0];
      if (!row) return;
      const action = row.querySelector<HTMLElement>(`[data-row-action="${key === "e" ? "exit" : "write"}"]`);
      if (!action) return;
      event.preventDefault();
      action.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [containerRef]);
}

/** The quiet one-line hint that tells an officer the keys exist. */
export function RowKeysHint() {
  return (
    <p className="text-[13px] leading-[18px] text-muted-foreground">
      Keyboard: J and K move between rows, E opens the launch sequence for the focused file, W opens its write
      action. Keys are ignored while you are typing.
    </p>
  );
}

/** A ref helper so a page can mark its list container in one line. */
export function useRowKeysContainer<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useRowKeys(ref);
  return ref;
}
