import {
  DECISION_LABEL,
  RATIONALE_REQUIRED,
  rationaleLabel,
  type ReviewDecision,
} from "@/lib/review-decisions";

/** True when the chosen decision needs a written rationale that is still blank. */
export function rationaleMissing(decision: ReviewDecision | null, rationale: string): boolean {
  return Boolean(decision && RATIONALE_REQUIRED.has(decision) && !rationale.trim());
}

/**
 * The formal decision choices for one review, and the rationale field. The
 * rationale is required for Nonconcur, Disapprove, Not legally sufficient, any
 * "with comments" decision and a nonconcurrence resolved on elevation.
 */
export function ReviewDecisionFields({
  idPrefix,
  options,
  decision,
  onDecision,
  rationale,
  onRationale,
  kindLabel,
  disabled = false,
}: {
  idPrefix: string;
  options: readonly ReviewDecision[];
  decision: ReviewDecision | null;
  onDecision: (d: ReviewDecision) => void;
  rationale: string;
  onRationale: (text: string) => void;
  kindLabel?: string;
  disabled?: boolean;
}) {
  const required = Boolean(decision && RATIONALE_REQUIRED.has(decision));
  return (
    <div className="space-y-3">
      <fieldset disabled={disabled}>
        <legend className="mb-2 text-[13px] font-medium">Decision{kindLabel ? ` (${kindLabel})` : ""}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {options.map((d) => (
            <label key={d} className="flex items-center gap-2 text-[15px]">
              <input type="radio" name={`${idPrefix}-decision`} checked={decision === d} onChange={() => onDecision(d)} />
              {DECISION_LABEL[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-[13px]" htmlFor={`${idPrefix}-rationale`}>
        {rationaleLabel(decision)}
        <textarea
          id={`${idPrefix}-rationale`}
          value={rationale}
          onChange={(e) => onRationale(e.target.value)}
          required={required}
          aria-required={required}
          disabled={disabled}
          className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px]"
        />
      </label>
    </div>
  );
}
