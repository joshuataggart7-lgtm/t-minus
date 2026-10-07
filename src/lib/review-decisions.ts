// Formal review decisions for the reviews and approvals on a file.
//
// Each review type records the decision its own source uses:
//   legal review          Legally sufficient / with comments / Not legally sufficient
//                         (the FAR term of art is "legal sufficiency", RFO FAR 42.902(f);
//                         the three labels are T-Minus practice)
//   small business (NF 1787)  Concur / Nonconcur (NF 1787 block 16 prints
//                         "Concurs" and "Non-concurs")
//   approval              Approve / Disapprove (RFO FAR 6.104-2(a): "must be approved
//                         in writing"; the negative label is T-Minus practice)
//   concurrence           Concur / Concur with comments / Nonconcur (NFS CG 1806.16
//                         "concurrences and approvals"; "with comments" is T-Minus practice)
//
// Stored values written before this change ("go", "no-go") still read: they map
// to the favorable or unfavorable decision for the review type. Nothing stored
// is rewritten by this module.

export type ReviewKind = "legal" | "small_business" | "approval" | "concurrence";

export type ReviewDecision =
  | "legally_sufficient"
  | "legally_sufficient_with_comments"
  | "not_legally_sufficient"
  | "concur"
  | "concur_with_comments"
  | "nonconcur"
  | "nonconcur_resolved"
  | "approve"
  | "disapprove";

/** Outcome class used by phase exit and hold logic. */
export type ReviewOutcome = "favorable" | "unfavorable" | "pending";

export const REVIEW_KIND_LABEL: Record<ReviewKind, string> = {
  legal: "Legal review",
  small_business: "Small business coordination",
  approval: "Approval",
  concurrence: "Concurrence",
};

export const DECISION_LABEL: Record<ReviewDecision, string> = {
  legally_sufficient: "Legally sufficient",
  legally_sufficient_with_comments: "Legally sufficient with comments",
  not_legally_sufficient: "Not legally sufficient",
  concur: "Concur",
  concur_with_comments: "Concur with comments",
  nonconcur: "Nonconcur",
  nonconcur_resolved: "Nonconcurrence resolved on elevation",
  approve: "Approve",
  disapprove: "Disapprove",
};

/** The decisions a reviewer chooses from, per review type, favorable first. */
export const DECISIONS_FOR: Record<ReviewKind, readonly ReviewDecision[]> = {
  legal: ["legally_sufficient", "legally_sufficient_with_comments", "not_legally_sufficient"],
  small_business: ["concur", "nonconcur"],
  approval: ["approve", "disapprove"],
  concurrence: ["concur", "concur_with_comments", "nonconcur"],
};

const FAVORABLE = new Set<ReviewDecision>([
  "legally_sufficient",
  "legally_sufficient_with_comments",
  "concur",
  "concur_with_comments",
  "nonconcur_resolved",
  "approve",
]);

/** A written rationale is required for these decisions. */
export const RATIONALE_REQUIRED = new Set<ReviewDecision>([
  "legally_sufficient_with_comments",
  "not_legally_sufficient",
  "concur_with_comments",
  "nonconcur",
  "nonconcur_resolved",
  "disapprove",
]);

const ALL_DECISIONS = new Set<string>(Object.keys(DECISION_LABEL));

/** The review type for a reviewer role on the board. */
export function reviewKindFor(role: string | null | undefined): ReviewKind {
  const r = String(role ?? "").toLowerCase();
  if (/legal|counsel/.test(r)) return "legal";
  if (/small business|nf 1787|\bsbs\b|\bpcr\b/.test(r)) return "small_business";
  if (
    /approving official|procurement strategy meeting|written acquisition plan|\bpsm\b|anosca|authorization/.test(r)
  )
    return "approval";
  return "concurrence";
}

/**
 * The decision a stored vote value stands for on this review type. Legacy
 * values read as the favorable or unfavorable decision for the type; an empty,
 * "pending" or unknown value reads as no decision yet.
 */
export function normalizeDecision(raw: string | null | undefined, kind: ReviewKind): ReviewDecision | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v || v === "pending") return null;
  if (ALL_DECISIONS.has(v)) return v as ReviewDecision;
  if (v === "go") return DECISIONS_FOR[kind][0]!;
  if (v === "no-go" || v === "nogo") return DECISIONS_FOR[kind][DECISIONS_FOR[kind].length - 1]!;
  return null;
}

export function decisionOutcome(decision: ReviewDecision | null): ReviewOutcome {
  if (!decision) return "pending";
  return FAVORABLE.has(decision) ? "favorable" : "unfavorable";
}

/** Outcome straight from a stored vote value and the reviewer role. */
export function voteOutcome(raw: string | null | undefined, role: string | null | undefined): ReviewOutcome {
  return decisionOutcome(normalizeDecision(raw, reviewKindFor(role)));
}

/** True when a stored vote value is a recorded decision (old or new). */
export function isDecided(raw: string | null | undefined): boolean {
  const v = String(raw ?? "").trim().toLowerCase();
  return Boolean(v) && v !== "pending" && (ALL_DECISIONS.has(v) || v === "go" || v === "no-go" || v === "nogo");
}

/** True when a stored vote value is an unfavorable decision, whatever the role. */
export function isUnfavorableVote(raw: string | null | undefined): boolean {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "no-go" || v === "nogo" || v === "nonconcur" || v === "disapprove" || v === "not_legally_sufficient";
}

/** Screen label for a stored vote value on this reviewer role. */
export function decisionLabelFor(raw: string | null | undefined, role: string | null | undefined): string {
  const d = normalizeDecision(raw, reviewKindFor(role));
  return d ? DECISION_LABEL[d] : "Pending";
}

/** The options a decision control offers. A nonconcurrence can be closed on elevation. */
export function decisionOptions(kind: ReviewKind, current: ReviewDecision | null, allowElevation = false): ReviewDecision[] {
  const base = [...DECISIONS_FOR[kind]];
  if (allowElevation && current === "nonconcur") base.push("nonconcur_resolved");
  return base;
}

/** Hold text prefixes written for an unfavorable decision (legacy "No-go" included). */
export const UNFAVORABLE_HOLD_PREFIX = /^(No-go|Nonconcur|Disapprove|Not legally sufficient):\s*/i;

/** Wording on the rationale field. */
export function rationaleLabel(decision: ReviewDecision | null): string {
  if (decision === "nonconcur_resolved")
    return "Rationale (required): name the official who decided the elevation and the decision";
  return decision && RATIONALE_REQUIRED.has(decision) ? "Rationale (required)" : "Comments (optional)";
}

/** The audit entry for a recorded decision: decision, name, role, date and rationale. */
export function decisionAudit(input: {
  decision: ReviewDecision;
  reviewerName: string;
  reviewerRole: string;
  date: string;
  rationale: string | null;
  previousRaw: string | null | undefined;
  previousReason?: string | null;
  recordedBy?: string | null;
}): { action: string; old_value: string; new_value: string; reason: string } {
  const label = DECISION_LABEL[input.decision];
  const prevDecision = normalizeDecision(input.previousRaw, reviewKindFor(input.reviewerRole));
  const prev = prevDecision ? DECISION_LABEL[prevDecision] : "Pending";
  const by = input.recordedBy && input.recordedBy !== input.reviewerName
    ? `; recorded by ${input.recordedBy} on behalf of ${input.reviewerName}`
    : "";
  return {
    action: `Review decision recorded: ${label}`,
    old_value: `${prev}${input.previousReason ? `: ${input.previousReason}` : ""}`,
    new_value: input.decision,
    reason: `${label}. ${input.reviewerName}, ${input.reviewerRole}, ${input.date}${by}${input.rationale ? `. Rationale: ${input.rationale}` : ""}`,
  };
}

/** The phase exit rule, stated once for guidance and explanations. */
export const PHASE_EXIT_RULE =
  "Every required review needs a favorable decision before the phase is exited. An approval must read Approve. A legal review must read Legally sufficient, with or without comments. A concurrence or the NF 1787 coordination must read Concur, with or without comments. Disapprove, Not legally sufficient or Nonconcur holds the file. A nonconcurrence clears when the reviewer records Concur, or when the contracting officer records that it was resolved on elevation and names the official who decided it. A review still open when its phase is left also holds the file.";
