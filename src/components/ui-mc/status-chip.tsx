import { cn } from "@/lib/utils";

/** The six tones every status word maps to. Color is never the only signal: the word is always shown. */
export type StatusTone = "ontrack" | "attention" | "atrisk" | "launched" | "neutral" | "info";

/**
 * One mapping table for status words used across T-Minus. Pages pass the word they
 * already show; the tone comes from here so the same word always reads the same way.
 * Keys are lower case.
 */
export const STATUS_TONE: Record<string, StatusTone> = {
  go: "ontrack",
  watch: "attention",
  hold: "atrisk",
  launched: "launched",
  forecast: "neutral",
  "on track": "ontrack",
  "needs attention": "attention",
  "at risk": "atrisk",
  required: "attention",
  offered: "info",
  complete: "ontrack",
  completed: "ontrack",
  attached: "ontrack",
  "not attached": "atrisk",
  reviewed: "ontrack",
  modified: "ontrack",
  "not reviewed": "attention",
  approved: "ontrack",
  concur: "ontrack",
  "not started": "neutral",
  "in progress": "info",
  overdue: "atrisk",
};

export function toneForStatus(label: string, fallback: StatusTone = "neutral"): StatusTone {
  const key = label.trim().toLowerCase();
  if (STATUS_TONE[key]) return STATUS_TONE[key];
  if (key.startsWith("needs ")) return "attention";
  return fallback;
}

export function StatusChip({
  label,
  tone,
  surface = "light",
  className,
}: {
  label: string;
  /** Overrides the mapping table when a page needs a specific tone. */
  tone?: StatusTone;
  surface?: "light" | "dark";
  className?: string;
}) {
  const t = tone ?? toneForStatus(label);
  return (
    <span className={cn("mc-chip", `is-${t}`, surface === "dark" && "on-dark", className)}>
      <span aria-hidden="true" className="mc-chip-mark" />
      <span>{label}</span>
    </span>
  );
}
