/** RFO FAR 5.101(d), Table 5-2. Leaf module so it can be read without the launch sequence graph. */
const SIMPLIFIED_ACQUISITION_THRESHOLD = 350_000;

const GPE_EXEMPT_NOTE =
  " Not required if the solicitation is posted to the GPE and permits electronic responses (RFO FAR 5.101(b)(1)(i)).";

/**
 * The presolicitation notice timing by value, RFO FAR 5.101(d), Table 5-2:
 * >$20,000 to <=$25,000 posted for 10 days; >$25,000 to <=SAT 15 days before
 * solicitation issuance; over the SAT combined with the solicitation on a
 * commercial buy, otherwise 15 days before issuance. The GPE exemption
 * (5.101(b)(1)(i)) is the Table's footnote on the two lower rows.
 */
export function presolicitationNote(acq: { estimated_value?: unknown } | null | undefined, commercial: boolean): string {
  const raw = acq?.estimated_value;
  const value = Number(raw ?? NaN);
  // Audit 2026-10-25, M1. RFO FAR 5.101(a): "For proposed contract actions
  // expected to be greater than $20,000, post a presolicitation notice to the
  // GPE unless an exemption in paragraph (b) applies."
  if (raw === null || raw === undefined || raw === "" || !Number.isFinite(value) || value <= 0)
    return "Enter an estimated value to see whether a presolicitation notice is required (RFO FAR 5.101(a)).";
  if (value > SIMPLIFIED_ACQUISITION_THRESHOLD)
    return commercial
      ? "For a commercial buy over the SAT the notice is combined with the solicitation (RFO FAR 5.101(d), Table 5-2)."
      : "Post at least 15 days before the solicitation is issued (RFO FAR 5.101(d), Table 5-2).";
  if (value > 25_000) return `15 days before solicitation (RFO FAR 5.101(d), Table 5-2).${GPE_EXEMPT_NOTE}`;
  if (value > 20_000) return `10 days (RFO FAR 5.101(d), Table 5-2).${GPE_EXEMPT_NOTE}`;
  return "No presolicitation notice required at or below $20,000 (RFO FAR 5.101(a)).";
}

/** RFO FAR 5.101(a): no presolicitation notice at or below $20,000. False when the value is blank. */
export function presolicitationNotRequired(acq: { estimated_value?: unknown } | null | undefined): boolean {
  const raw = acq?.estimated_value;
  if (raw === null || raw === undefined || raw === "") return false;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= 20_000;
}
