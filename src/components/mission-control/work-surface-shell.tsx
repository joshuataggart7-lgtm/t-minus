import type { ReactNode } from "react";
import { LaunchCountdownCompact, type CountdownView } from "@/components/launch-countdown";
import { MissionReadinessChip } from "@/components/mission-control/primitives";
import type { ReadinessExplanation } from "@/components/mission-control/readiness";

export type SaveState =
  | { kind: "saving" }
  | { kind: "error"; text: string }
  | { kind: "saved"; version: number; at?: string | null; by?: string | null }
  | { kind: "none" }
  | { kind: "readonly"; reason: string };

export function SaveStateNote({ state }: { state: SaveState }) {
  let text: string;
  if (state.kind === "saving") text = "Saving…";
  else if (state.kind === "error") text = state.text || "Save did not finish";
  else if (state.kind === "none") text = "No version saved yet";
  else if (state.kind === "readonly") text = `Read only: ${state.reason}`;
  else {
    const details = [
      `Saved · version ${state.version}`,
      state.at ? String(state.at).slice(0, 10) : null,
      state.by ? `by ${state.by}` : null,
    ].filter(Boolean);
    text = details.join(" · ");
  }
  return <span role="status" aria-live="polite" className="mc-shell-save">{text}</span>;
}

export function WorkShellHeader({
  acquisitionId,
  title,
  readiness,
  countdown,
  saveState,
  completion,
}: {
  acquisitionId: string;
  title?: string | null;
  readiness?: ReadinessExplanation | null;
  countdown?: CountdownView | null;
  saveState: SaveState;
  completion?: string | null;
}) {
  return (
    <section className="mc-shell-header" aria-label="Working document status">
      <div className="mc-shell-identity">
        <strong>{acquisitionId}</strong>
        {title ? <span>{title}</span> : null}
      </div>
      {readiness ? <MissionReadinessChip state={readiness.state} /> : null}
      {countdown ? <LaunchCountdownCompact view={countdown} /> : null}
      <SaveStateNote state={saveState} />
      {completion ? <span className="mc-shell-completion">{completion}</span> : null}
    </section>
  );
}

export function WorkShellLayout({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="mc-shell-layout">
      <aside className="mc-shell-nav-desktop no-print">{nav}</aside>
      <details className="mc-shell-nav-mobile no-print border-y">
        <summary>Jump to section</summary>
        <div>{nav}</div>
      </details>
      <div className="mc-shell-body">{children}</div>
    </div>
  );
}