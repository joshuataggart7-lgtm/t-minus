import { LEGACY_REVIEW_PHASE, REVIEW_PHASE, phaseAlias } from "@/lib/phase-alias";

/**
 * Display-time wording for audit rows written before the review phase was
 * renamed (round I). The stored audit row is never edited: these helpers only
 * change what a page shows, and each page keeps the stored text available
 * ("Stored as: ...") so the record stays checkable.
 */

const LEGACY_PHASE_TEXT = new RegExp(LEGACY_REVIEW_PHASE.replace(/[/]/g, "\\/"), "gi");

/** Action names the old poll board wrote, and the wording used now. */
const ACTION_RELABEL: Record<string, string> = {
  "poll opened": "Review opened",
  "go recorded": "Favorable decision recorded (stored as Go)",
  "no-go recorded": "Unfavorable decision recorded (stored as No-go)",
};

export function auditActionLabel(action: string | null | undefined): string | null {
  if (action == null) return null;
  const mapped = ACTION_RELABEL[action.trim().toLowerCase()];
  return mapped ?? auditTextLabel(action);
}

export function auditPhaseLabel(phase: string | null | undefined): string | null {
  if (phase == null) return null;
  return String(phaseAlias(phase));
}

/** Free text (reason, values): the old phase name and "poll votes" read in today's words. */
export function auditTextLabel(text: string | null | undefined): string | null {
  if (text == null) return null;
  return text
    .replace(LEGACY_PHASE_TEXT, REVIEW_PHASE)
    .replace(/\bpoll votes\b/gi, "review decisions");
}

/** A legacy vote value on a "Go recorded" or "No-go recorded" row. */
export function auditValueLabel(action: string | null | undefined, value: string | null | undefined): string | null {
  if (value == null) return null;
  const a = String(action ?? "").trim().toLowerCase();
  if (a === "go recorded" || a === "no-go recorded") {
    const v = value.trim().toLowerCase();
    if (v === "go") return "Favorable (stored as Go)";
    if (v === "no-go" || v === "nogo") return "Unfavorable (stored as No-go)";
  }
  return auditTextLabel(value);
}

/** The stored text, for a title attribute, only when the display differs. */
export function storedAs(stored: string | null | undefined, shown: string | null | undefined): string | undefined {
  return stored != null && shown != null && stored !== shown ? `Stored as: ${stored}` : undefined;
}
