# Round 9: chronology, hero action, and header roles

## Outcome
- The chronology memorandum uses document titles and preserved record capitalization, identifies actors by their recorded job title and display name, and gives market research its own complete narrative in the Market Research paragraph.
- The file header action follows the first missing required row in the current phase, with concise document-specific wording; phase exit appears only after all required rows are complete.
- Role chips remain directly beside the signed-in name at every supported width.

## Implementation
1. Add one canonical chronology-label formatter for audit fields and attachment labels, including “the NF 1707 requester sections,” “the IGCE,” and “the SOW/PWS.” Preserve names and abbreviations from records instead of lowercasing whole labels or reasons.
2. Resolve audit actors against both the Center user roster and signed-in profile records, then render the stored title plus display name (for example, “the contract specialist, Joshua Taggart”). Normalize only title casing, not names.
3. Build one latest-run market-research narrative from the research log and findings: run date, distinct source names searched, de-duplicated registrant and notice totals, the competition-appropriate Rule of Two or sole-source conclusion, and whether the contracting officer confirmed the finding. Keep it only in the Market Research phase and strip terminal punctuation before embedding audit reasons.
4. Restrict the hero lookup to the current phase’s required rows in displayed order. Add short action labels for the memorandum, NF 1787/NF 1787A, IGCE, SOW/PWS, and other generated or attached rows. Show “Exit [phase]” only after no current-phase required row is missing; retain “Run market research” only before the first run.
5. Keep the signed-in name and all assigned role chips in one adjacent header group. Allow wrapping without separating the chips from the name on narrow screens.
6. Add focused tests for chronology labeling/research narration and hero-action selection, then verify the two sample files and the header at desktop and mobile widths.

## Technical notes
- No schema or seed changes are required; the latest research run, findings confirmation fields, audit history, user roster, and profile rows already contain the needed facts.
- Existing role permissions, phase order, document requirements, and saved/attached-state rules remain unchanged.
