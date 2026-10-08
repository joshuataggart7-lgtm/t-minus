import type { PhaseView } from "@/lib/launch-sequence";
import { phaseLabel, phaseOverrunDays } from "@/lib/launch-sequence";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useScrollFade } from "@/lib/use-scroll-fade";

/**
 * Every phase of the file in one horizontal row, read from the same phases the
 * launch sequence renders. Display only: a click asks the page to show that
 * phase in the launch sequence. Nothing here writes or decides a gate.
 */
export function FilePhaseStepper({
  phases,
  daysToPhaseExit,
  onSelect,
}: {
  phases: PhaseView[];
  daysToPhaseExit: number | null;
  onSelect: (index: number) => void;
}) {
  const listRef = useRef<HTMLOListElement | null>(null);
  useScrollFade(listRef, [phases.length]);
  const currentIndex = phases.findIndex((p) => p.status === "current");
  // On a narrow screen the row scrolls sideways; start it at the phase in work.
  useEffect(() => {
    const list = listRef.current;
    if (!list || currentIndex < 0 || list.scrollWidth <= list.clientWidth) return;
    const step = list.children[currentIndex] as HTMLElement | undefined;
    if (step) list.scrollLeft = Math.max(0, step.offsetLeft - list.offsetLeft - 16);
  }, [currentIndex, phases.length]);
  if (!phases.length) return null;
  const complete = phases.filter((p) => p.status === "complete").length;
  return (
    <nav aria-label="Phases on this file" className="mc-stepper no-print" data-numeric>
      <div className="mc-stepper-head">
        <p className="mc-stepper-title">Phases</p>
        <p className="mc-stepper-sum">
          {currentIndex >= 0
            ? `Phase ${currentIndex + 1} of ${phases.length} · ${complete} complete`
            : complete === phases.length
              ? `All ${phases.length} phases complete`
              : `${phases.length} phases, not started`}
        </p>
      </div>
      <ol
        ref={listRef}
        className="mc-stepper-list mc-scroll-fade"
        data-scroll-region=""
        style={{ ["--n" as string]: String(phases.length), ["--half" as string]: String(Math.ceil(phases.length / 2)) }}
      >
        {phases.map((p, i) => {
          const isCurrent = p.status === "current";
          const isComplete = p.status === "complete";
          const overrun = isCurrent ? phaseOverrunDays(p) : null;
          const exitIn = isCurrent && daysToPhaseExit !== null && daysToPhaseExit >= 0 && overrun === null ? daysToPhaseExit : null;
          const state = isComplete ? "Complete" : isCurrent ? "In work" : "Not started";
          return (
            <li key={`${p.phase}-${i}`} className={cn("mc-step", isComplete && "is-complete", isCurrent && "is-current", overrun !== null && "is-late")}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${i + 1}. ${phaseLabel(p)}: ${state}. Show it in the launch sequence.`}
                title={`${phaseLabel(p)} · ${p.planned_days} planned day${p.planned_days === 1 ? "" : "s"}`}
              >
                <span className="mc-step-bar" aria-hidden="true" />
                <span className="mc-step-n" aria-hidden="true">{i + 1}</span>
                <span className="mc-step-label">
                  {phaseLabel(p).split("/").map((part, k) => (
                    <span key={k}>
                      {k ? "/" : ""}
                      {k ? <wbr /> : null}
                      {part}
                    </span>
                  ))}
                </span>
                {isCurrent ? (
                  <span className="mc-step-note">
                    {overrun !== null ? `${overrun} day${overrun === 1 ? "" : "s"} past exit` : exitIn !== null ? `T− ${exitIn} to exit` : "Now"}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
