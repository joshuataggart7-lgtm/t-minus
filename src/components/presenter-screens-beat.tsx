// Presenter-only beat card: names the screens a CO would otherwise bounce
// across, then points at this file and the Peer systems strip. Advisory copy
// only — no gating, no writes, no write-back claims.

import { useEffect, useRef, useState } from "react";
import { usePresenter } from "@/lib/presenter";

const DISMISS_KEY = "tminus-presenter-screens-beat";

export function PresenterScreensBeat() {
  const presenter = usePresenter();
  const [dismissed, setDismissed] = useState(true);
  const wasPresenter = useRef(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (presenter && !initialized.current) {
      // First time presenter reads as on (mount or hydration from
      // sessionStorage): respect an earlier dismiss in this session.
      initialized.current = true;
      wasPresenter.current = true;
      let done = false;
      try {
        done = window.sessionStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        /* session storage is optional */
      }
      setDismissed(done);
      return;
    }
    if (presenter && !wasPresenter.current) {
      // Real OFF→ON toggle: fresh demo pass, show the beat again even if
      // it was dismissed last time.
      try {
        window.sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        /* session storage is optional */
      }
      setDismissed(false);
    } else if (!presenter) {
      setDismissed(true);
    }
    wasPresenter.current = presenter;
  }, [presenter]);

  if (!presenter || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* session storage is optional */
    }
  };

  return (
    <section
      aria-label="Screens you’d open"
      className="mb-8 max-w-[70ch] rounded-lg border border-border bg-background p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[15px] font-medium text-foreground">Screens you’d open</h2>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
      <p className="mt-2 text-muted-foreground">
        Pause — count the screens. Today that’s NCMS · NEAR · email · a spreadsheet. Same facts,
        one file here. Not replacing NCMS — the desk that stops the bounce, then you key the
        packet top to bottom.
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        See the Peer systems strip under any file header for the local packet and NEAR export.
      </p>
      <p className="mt-3 border-t border-border pt-3 text-[13px] text-muted-foreground">
        Prototype. Local packet only — T-Minus writes nothing to NCMS, NEAR, or SAM.gov.
      </p>
    </section>
  );
}
