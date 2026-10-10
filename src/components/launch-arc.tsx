import type { PhaseView } from "@/lib/launch-sequence";
import { phaseDone, phaseLabel, phaseOverrunDays, phaseStateWord } from "@/lib/launch-sequence";
import type { CountdownView } from "@/components/launch-countdown";
import { dayWord } from "@/lib/pluralize";
import { cn } from "@/lib/utils";

/**
 * The file's clock and its phases as one picture: the countdown over a horizon,
 * every phase a point on it. Completed phases are lit, the phase in work is
 * marked, and Award carries the word Launch. Display only: it reads the same
 * countdown view and phases the rest of the page reads, and a click on a phase
 * asks the page to show it in the launch sequence. Nothing here writes or
 * decides a gate.
 *
 * The horizon needs room for twelve names. In a narrow column the points are
 * hidden and the phase row under the header takes over (see .mc-arc in
 * styles.css).
 */

// Geometry in viewBox units. One circle, drawn as a shallow horizon.
const VB_W = 1000;
const VB_H = 205;
const RADIUS = 1440;
const HALF_SPAN = 456;
const APEX_Y = 30;
const CENTER_X = VB_W / 2;
const CENTER_Y = APEX_Y + RADIUS;
const MAX_ANGLE = Math.asin(HALF_SPAN / RADIUS);
const LIMB_ANGLE = Math.asin((VB_W / 2 + 40) / RADIUS);

function pointAt(index: number, count: number): { x: number; y: number } {
  const t = count > 1 ? index / (count - 1) : 0.5;
  const angle = -MAX_ANGLE + 2 * MAX_ANGLE * t;
  return { x: CENTER_X + RADIUS * Math.sin(angle), y: CENTER_Y - RADIUS * Math.cos(angle) };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function arcPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  return `M ${r1(from.x)} ${r1(from.y)} A ${RADIUS} ${RADIUS} 0 0 1 ${r1(to.x)} ${r1(to.y)}`;
}

function sentence(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function LaunchArc({
  view,
  phases,
  daysToPhaseExit,
  onSelect,
  acquisitionId,
}: {
  view: CountdownView;
  phases: PhaseView[];
  daysToPhaseExit: number | null;
  onSelect: (index: number) => void;
  acquisitionId?: string;
}) {
  const count = phases.length;
  const currentIndex = phases.findIndex((p) => p.status === "current");
  const awardIndex = phases.findIndex((p) => p.phase === "Award");
  // The lit part of the horizon runs to the phase in work, or to the last
  // phase behind it when nothing is in work.
  let litIndex = currentIndex;
  if (litIndex < 0) {
    for (let i = count - 1; i >= 0; i--) {
      if (phases[i]?.status === "complete") {
        litIndex = i;
        break;
      }
    }
  }
  const limbLeft = {
    x: CENTER_X - RADIUS * Math.sin(LIMB_ANGLE),
    y: CENTER_Y - RADIUS * Math.cos(LIMB_ANGLE),
  };
  const limbRight = { x: CENTER_X + RADIUS * Math.sin(LIMB_ANGLE), y: limbLeft.y };
  const limb = arcPath(limbLeft, limbRight);
  const lit =
    count > 1 && litIndex > 0 ? arcPath(pointAt(0, count), pointAt(litIndex, count)) : null;
  const badgeTone =
    view.mode === "hold" ? "is-hold" : view.mode === "overdue" ? "is-overdue" : "is-plain";
  const caption = view.caption && view.caption !== view.badge ? sentence(view.caption) : null;

  return (
    <div className={cn("mc-arc", `is-${view.mode}`)} data-numeric>
      <div className="mc-arc-clock">
        <p className="mc-arc-kicker">
          {caption ? <span>{caption}</span> : null}
          {view.badge ? <span className={cn("mc-arc-badge", badgeTone)}>{view.badge}</span> : null}
        </p>
        {view.days === null ? (
          <p className="mc-arc-figure is-word">
            {view.mode === "stopped" ? "Stopped" : "Not started"}
          </p>
        ) : (
          <p
            className={cn(
              "mc-arc-figure",
              view.tone === "red" && "is-red",
              view.tone === "muted" && "is-muted",
            )}
          >
            <span className="sr-only">{acquisitionId ? `${acquisitionId}: ` : ""}</span>
            {view.prefix}
            {view.days}
            <span className="mc-arc-unit">
              {view.pastTarget ? `${dayWord(view.days)} past target` : dayWord(view.days)}
            </span>
          </p>
        )}
        {view.holdReason ? <p className="mc-arc-hold">Hold: {view.holdReason}</p> : null}
      </div>

      {count > 1 ? (
        <nav aria-label="Phases on this file" className="mc-arc-track no-print">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="mc-arc-limb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--arc-limb-top)" />
                <stop offset="0.4" stopColor="var(--arc-limb-mid)" />
                <stop offset="1" stopColor="var(--arc-limb-low)" />
              </linearGradient>
              <linearGradient id="mc-arc-lit" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="var(--arc-lit-from)" />
                <stop offset="1" stopColor="var(--arc-lit-to)" />
              </linearGradient>
              <filter id="mc-arc-glow" x="-20%" y="-300%" width="140%" height="700%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>
            <path
              d={`${limb} L ${r1(limbRight.x)} ${VB_H} L ${r1(limbLeft.x)} ${VB_H} Z`}
              fill="url(#mc-arc-limb)"
            />
            <path
              d={limb}
              fill="none"
              stroke="var(--arc-limb-line)"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
            {lit ? (
              <>
                <path
                  d={lit}
                  fill="none"
                  stroke="var(--arc-lit-from)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.5"
                  filter="url(#mc-arc-glow)"
                />
                <path
                  className="mc-arc-lit"
                  d={lit}
                  pathLength={1}
                  fill="none"
                  stroke="url(#mc-arc-lit)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
          </svg>
          <ol className="mc-arc-points">
            {phases.map((p, i) => {
              const at = pointAt(i, count);
              const isCurrent = p.status === "current";
              const isComplete = phaseDone(p);
              const overrun = isCurrent ? phaseOverrunDays(p) : null;
              const exitIn =
                isCurrent && daysToPhaseExit !== null && daysToPhaseExit >= 0 && overrun === null
                  ? daysToPhaseExit
                  : null;
              const note = isCurrent
                ? overrun !== null
                  ? `${overrun} day${overrun === 1 ? "" : "s"} past exit`
                  : exitIn !== null
                    ? `T− ${exitIn} to exit`
                    : "Now"
                : i === awardIndex
                  ? isComplete
                    ? "Launched"
                    : "Launch"
                  : null;
              return (
                <li
                  key={`${p.phase}-${i}`}
                  className={cn(
                    "mc-arc-point",
                    isComplete && "is-complete",
                    isCurrent && "is-current",
                    overrun !== null && "is-late",
                    isCurrent && view.mode === "hold" && "is-hold",
                    i === awardIndex && "is-award",
                  )}
                  style={{
                    left: `${r1((at.x / VB_W) * 100)}%`,
                    top: `${r1((at.y / VB_H) * 100)}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`${i + 1}. ${phaseLabel(p)}: ${phaseStateWord(p)}. Show it in the launch sequence.`}
                    title={`${phaseLabel(p)} · ${p.planned_days} planned day${p.planned_days === 1 ? "" : "s"}`}
                  >
                    <span className="mc-arc-dot" aria-hidden="true" />
                    <span className="mc-arc-n" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="mc-arc-name">
                      {phaseLabel(p)
                        .split("/")
                        .map((part, k) => (
                          <span key={k}>
                            {k ? "/" : ""}
                            {k ? <wbr /> : null}
                            {part}
                          </span>
                        ))}
                    </span>
                    {note ? <span className="mc-arc-note">{note}</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
    </div>
  );
}
