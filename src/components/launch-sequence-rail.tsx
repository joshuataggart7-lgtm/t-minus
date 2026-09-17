// Launch sequence rail (ORBIT Chunk 3). A vertical scan view of the same
// phases array the file page already computes via buildSequence(). Display
// only: every figure is read from PhaseView; no date math, no hours/minutes.
//
// Node treatment:
//   complete → filled node (chrome structure, not red, not cyan)
//   current  → lit electric cyan #22D3EE
//   upcoming → outlined only (transparent fill, muted border)
// On the current node only, if a whole-day exit countdown is available from
// the metrics, show a compact T− N. Never fabricated, never red on a
// healthy current phase.

import type { PhaseView } from "@/lib/launch-sequence";
import { cn } from "@/lib/utils";

export function LaunchSequenceRail({
  phases,
  daysToPhaseExit,
  className,
}: {
  phases: PhaseView[];
  daysToPhaseExit: number | null;
  className?: string;
}) {
  if (!phases.length) return null;

  return (
    <nav
      aria-label="Launch sequence rail"
      className={cn(
        "min-w-0 lg:sticky lg:top-4 lg:self-start",
        className,
      )}
      data-numeric
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Launch Sequence
      </p>
      <ol className="relative min-w-0">
        {/* the vertical connecting line */}
        <span
          aria-hidden
          className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
        />
        {phases.map((p, i) => {
          const isCurrent = p.status === "current";
          const isComplete = p.status === "complete";
          const showExit = isCurrent && daysToPhaseExit !== null && daysToPhaseExit >= 0;
          return (
            <li
              key={`${p.phase}-${i}`}
              className="relative flex min-w-0 items-start gap-3 pb-4 last:pb-0"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 h-[15px] w-[15px] shrink-0 rounded-full border-2",
                  isCurrent
                    ? "border-accent-cyan bg-accent-cyan"
                    : isComplete
                      ? "border-chrome-structure bg-chrome-structure"
                      : "border-border bg-background",
                )}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[13px] leading-[18px]",
                    isCurrent
                      ? "font-semibold text-foreground"
                      : isComplete
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {p.phase}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-[14px] text-muted-foreground">
                  <span className="tabular-nums">
                    {p.planned_days} planned day{p.planned_days === 1 ? "" : "s"}
                  </span>
                  {isCurrent ? (
                    <span
                      className="rounded px-1 py-px text-[10px] font-semibold tracking-wide"
                      style={{ color: "var(--chrome)", backgroundColor: "var(--accent-cyan)" }}
                    >
                      NOW
                    </span>
                  ) : null}
                  {showExit ? (
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: "#0e7490" }}
                    >
                      T− {daysToPhaseExit} to exit
                    </span>
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
