// Launch Countdown face. Display only: every number is read from the
// AcqMetrics object the file, Work Queue, and Today pages already compute.
// Metrics are days-only — the face never fabricates hours or minutes.
//
// Color rules (ORBIT Chunk 2): cyan for a healthy running countdown, muted
// digits with an amber HOLD badge on hold, cyan with a FORECAST badge when
// the forecast stands in, cyan (never red) for T+ after launch, NASA red
// only for OVERDUE past the target, muted when the clock is stopped.

import { calendarDaysBetween, todayCT } from "@/lib/calendar-date";
import type { AcqMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export type CountdownMode =
  | "running"
  | "hold"
  | "forecast"
  | "launched"
  | "overdue"
  | "stopped"
  | "not-started";

export type CountdownView = {
  mode: CountdownMode;
  /** Whole days. Negative never leaves this helper; OVERDUE carries abs(). */
  days: number | null;
  /** "T−" or "T+". */
  prefix: "T−" | "T+" | null;
  badge: string | null;
  caption: string;
  holdReason: string | null;
  tone: "cyan" | "muted" | "red";
};

/** Same UTC whole-day math the file header already uses. */
function daysUntilISO(iso: string): number {
  return calendarDaysBetween(todayCT(), iso);
}

/**
 * Reads an AcqMetrics object and returns what the face should show.
 * The only arithmetic allowed here is days-to-forecastAwardDate, and only
 * when daysToAward is null and the forecast date is already on the metrics —
 * the same fallback the file header performs today.
 */
export function countdownView(m: AcqMetrics): CountdownView {
  const base = { badge: null, holdReason: null };
  // A stored clock state is not an award. The shared operational normalizer
  // supplies awardDate only from the recorded actual-award event.
  if (m.awardDate) {
    return {
      ...base,
      mode: "launched",
      days: m.daysSinceAward ?? 0,
      prefix: "T+",
      // Cyan AWARDED, so elapsed-since-award never reads like red OVERDUE.
      badge: "AWARDED",
      caption: "days since award",
      tone: "cyan",
    };
  }
  if (m.clockState === "scrubbed") {
    return { ...base, mode: "stopped", days: null, prefix: null, caption: "Clock stopped", tone: "muted" };
  }
  if (m.clockState === "hold" || m.hold) {
    const days = m.daysToAward ?? (m.forecastAwardDate ? daysUntilISO(m.forecastAwardDate) : null);
    return {
      ...base,
      mode: "hold",
      days: days === null ? null : Math.max(0, days),
      prefix: days === null ? null : "T−",
      badge: "HOLD",
      holdReason: m.hold?.reason ?? null,
      caption: "HOLD",
      tone: "muted",
    };
  }
  if (m.daysToAward !== null) {
    if (m.daysToAward < 0) {
      return {
        ...base,
        mode: "overdue",
        days: Math.abs(m.daysToAward),
        prefix: "T+",
        badge: "OVERDUE",
        caption: "days past the target award date",
        tone: "red",
      };
    }
    return {
      ...base,
      mode: "running",
      days: m.daysToAward,
      prefix: "T−",
      caption: "days to the target award date",
      tone: "cyan",
    };
  }
  if (m.forecastAwardDate) {
    return {
      ...base,
      mode: "forecast",
      days: Math.max(0, daysUntilISO(m.forecastAwardDate)),
      prefix: "T−",
      badge: "FORECAST",
      caption: "days to the forecast award date; no target recorded",
      tone: "cyan",
    };
  }
  return { ...base, mode: "not-started", days: null, prefix: null, caption: "No target award date recorded", tone: "muted" };
}

const toneDigit: Record<CountdownView["tone"], string> = {
  cyan: "text-accent-cyan",
  muted: "text-chrome-muted",
  red: "text-atrisk",
};

function Badge({ children, amber }: { children: string; amber?: boolean }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide"
      style={
        amber
          ? { color: "#1d1d1f", backgroundColor: "#f5c36b" }
          : { color: "var(--chrome)", backgroundColor: "var(--accent-cyan)" }
      }
    >
      {children}
    </span>
  );
}

/** Full countdown face for the acquisition file clock panel. */
export function LaunchCountdown({
  view,
  acquisitionId,
  className,
}: {
  view: CountdownView;
  acquisitionId?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-chrome p-5 text-chrome-foreground", className)} data-numeric>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-chrome-muted">
          Launch Countdown
        </p>
        {acquisitionId ? <p className="text-[11px] tracking-wide text-chrome-muted">{acquisitionId}</p> : null}
        {view.badge ? <Badge amber={view.mode === "hold"}>{view.badge}</Badge> : null}
      </div>
      {view.days === null ? (
        <p className="mt-2 text-[40px] leading-[44px] font-semibold text-chrome-muted">
          {view.mode === "stopped" ? "Stopped" : "Not started"}
        </p>
      ) : (
        <p className={cn("mt-2 text-[48px] leading-[52px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]", toneDigit[view.tone])}>
          {view.prefix} {view.days}
          <span className="ml-2 text-[15px] font-medium text-chrome-muted">days</span>
        </p>
      )}
      {view.caption === view.badge ? null : <p className="mt-1 text-[13px] text-chrome-muted">{view.caption}</p>}
      {view.holdReason ? (
        <p className="mt-1 text-[13px] text-chrome-foreground">Hold: {view.holdReason}</p>
      ) : null}
    </div>
  );
}

/** Compact face for Work Queue rows and Today rows. */
export function LaunchCountdownCompact({
  view,
  className,
}: {
  view: CountdownView;
  className?: string;
}) {
  if (view.days === null) {
    return (
      <span className={cn("text-muted-foreground", className)} data-numeric>
        {view.caption}
      </span>
    );
  }
  const digitColor =
    view.tone === "red"
      ? "var(--atrisk)"
      : view.tone === "muted"
        ? "var(--muted-foreground)"
        : "#0e7490"; /* darker cyan for legibility on the light canvas */
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)} data-numeric>
      <span className="text-[17px] font-semibold [font-variant-numeric:tabular-nums]" style={{ color: digitColor }}>
        {view.prefix} {view.days}
      </span>
      <span className="text-[12px] text-muted-foreground">days</span>
      {view.badge ? (
        <span
          className="rounded px-1 text-[10px] font-semibold tracking-wide"
          style={
            view.mode === "hold"
              ? { color: "#1d1d1f", backgroundColor: "#f5c36b" }
              : view.mode === "overdue"
                ? { color: "#ffffff", backgroundColor: "var(--atrisk)" }
                : { color: "var(--chrome)", backgroundColor: "var(--accent-cyan)" }
          }
        >
          {view.badge}
        </span>
      ) : null}
    </span>
  );
}
