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
  const value = Number(acq?.estimated_value ?? 0);
  if (value > SIMPLIFIED_ACQUISITION_THRESHOLD)
    return commercial
      ? "For a commercial buy over the SAT the notice is combined with the solicitation (RFO FAR 5.101(d), Table 5-2)."
      : "Post at least 15 days before the solicitation is issued (RFO FAR 5.101(d), Table 5-2).";
  if (value > 25_000) return `15 days before solicitation (RFO FAR 5.101(d), Table 5-2).${GPE_EXEMPT_NOTE}`;
  if (value > 20_000) return `10 days (RFO FAR 5.101(d), Table 5-2).${GPE_EXEMPT_NOTE}`;
  return "Post at least 15 days before the solicitation is issued (RFO FAR 5.101(d), Table 5-2), unless the solicitation is posted in the GPE and allows electronic offers (RFO FAR 5.101(b)(1)(i)).";
}
