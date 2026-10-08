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
/** A fetch that came back as a raw error page reads as one sentence. */
function plainSourceFailure(text: string): string | null {
  const decoded = text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
  const looksLikeMarkup = /<[a-z!/]/i.test(decoded);
  if (/gao\.gov/i.test(decoded) && (/403/.test(decoded) || /access denied/i.test(decoded))) {
    return "GAO did not return data (access denied).";
  }
  if (looksLikeMarkup && /403|access denied/i.test(decoded)) {
    return "The source did not return data (access denied).";
  }
  if (looksLikeMarkup) return "The source returned a page instead of a record.";
  return null;
}

export function auditTextLabel(text: string | null | undefined): string | null {
  if (text == null) return null;
  const plain = plainSourceFailure(text);
  if (plain) return plain;
  return text
    .replace(LEGACY_PHASE_TEXT, REVIEW_PHASE)
    .replace(/\bpoll votes\b/gi, "review decisions")
    .replace(/\bORBIT Power BI\b/g, "Power BI")
    // Read receipts written before plain labels named the route.
    .replace(/\bfrom the (reviewer-inbox|document-route|form-route)\b/g, (_m, src: string) =>
      `from the ${src === "reviewer-inbox" ? "reviewer inbox" : src === "document-route" ? "document page" : "form page"}`,
    );
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

/** Field names the old poll board wrote (internal table names), and the wording used now. */
const FIELD_RELABEL: Record<string, string> = {
  polls: "reviews",
  poll: "review",
  watch_items: "Watch items",
  v_report_polls: "Polls report",
  v_report_acquisitions: "Acquisitions report",
  v_report_holds: "Holds report",
  v_report_missions: "Missions report",
  v_report_audit_counts: "Audit counts report",
};

/** The field column: an internal table name reads in today's words. */
export function auditFieldLabel(field: string | null | undefined): string | null {
  if (field == null) return null;
  return FIELD_RELABEL[field.trim().toLowerCase()] ?? field;
}

/** The stored text, for a title attribute, only when the display differs. */
export function storedAs(stored: string | null | undefined, shown: string | null | undefined): string | undefined {
  return stored != null && shown != null && stored !== shown ? `Stored as: ${stored}` : undefined;
}
