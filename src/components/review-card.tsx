import type { ReactNode } from "react";
import type { BoardEntry } from "@/lib/launch-sequence";
import { DECISION_LABEL, DECISIONS_FOR, RATIONALE_REQUIRED, REVIEW_KIND_LABEL } from "@/lib/review-decisions";
import { StatusChip } from "@/components/ui-mc";
import { dueView } from "@/lib/file-timeline";

/**
 * One reviewer's formal decision, read as the board holds it: the review type,
 * the decision in its own words (Concur or Nonconcur, Approve or Disapprove,
 * Legally sufficient or Not legally sufficient), the written reason as stored,
 * the due date and the citation. Display only; the page passes any action in.
 */
export function ReviewCard({
  entry,
  explain,
  action,
  showPhase = false,
  showOverdue = true,
  launched = false,
}: {
  entry: BoardEntry;
  explain?: ReactNode;
  action?: ReactNode;
  showPhase?: boolean;
  /** Off on a launched file, where a pending entry is history, not a late task. */
  showOverdue?: boolean;
  /** A launched file: an entry with no decision reads as history, not as Pending. */
  launched?: boolean;
}) {
  const noRecord = launched && !entry.decision && entry.vote === "pending";
  const outcome = entry.decision ? DECISION_LABEL[entry.decision] : noRecord ? "No decision recorded in T-Minus" : "Pending";
  const tone = entry.vote === "favorable" ? "ontrack" : entry.vote === "unfavorable" ? "atrisk" : noRecord ? "neutral" : "attention";
  const due = showOverdue && entry.vote === "pending" ? dueView(entry.due_date) : null;
  const reasonLabel = entry.decision && RATIONALE_REQUIRED.has(entry.decision) ? "Written reason" : "Comments";
  return (
    <article className={`mc-review is-${entry.vote}`} aria-label={`${entry.reviewer_role}: ${outcome}`}>
      <div className="mc-review-head">
        <div className="min-w-0">
          <p className="mc-review-kind">
            {REVIEW_KIND_LABEL[entry.kind]}
            {showPhase ? ` · ${entry.phase}` : ""}
          </p>
          <h4 className="mc-review-role">{entry.reviewer_role}</h4>
          <p className="mc-review-name">{entry.reviewer_name}</p>
        </div>
        <StatusChip label={outcome} tone={tone} />
      </div>
      {entry.poll_id || noRecord ? null : <p className="mc-review-note">Review not requested yet</p>}
      {entry.reason ? (
        <div className="mc-review-reason">
          <p className="mc-review-label">{reasonLabel}</p>
          <p>{entry.reason}</p>
        </div>
      ) : null}
      <dl className="mc-review-meta">
        <div>
          <dt>Due</dt>
          <dd data-numeric>
            {entry.due_date ?? "Not set"}
            {due?.overdue ? <span className="mc-due is-overdue">{due.text}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Decisions on this review</dt>
          <dd>{DECISIONS_FOR[entry.kind].map((d) => DECISION_LABEL[d]).join(" or ")}</dd>
        </div>
        <div>
          <dt>Citation</dt>
          <dd>{entry.citation ?? "Not recorded"}</dd>
        </div>
      </dl>
      {explain || action ? (
        <div className="mc-review-actions">
          {explain}
          {action}
        </div>
      ) : null}
    </article>
  );
}
