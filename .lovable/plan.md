# Rebuild the NF 1707 intake from the complete field export

## Scope
- Load all NF 1707 definitions from `nf1707_fields_full.csv`, preserving full captions, full nearby form text, choice lists, Center restrictions, and answerability.
- Render only answerable controls. Checkbox and radio rows use Yes / No / Not applicable; selectable lists use their CSV choices. Instructions and paragraphs remain display-only.
- Keep the existing T-Minus record fields, remove the duplicate raw NF 1707 header, hide server fields and the retained prior-environmental block, and improve recorded-answer labels.
- Normalize the Commercial Aviation Services sample into the displayed contract type, competition, and set-aside choices without changing the red-flag scan, clock start, or confirmation page.

## Data changes
- Extend the existing NF 1707 field table with full-label, choice-list, and answerability columns.
- Update both normal seeding and demo reset to load the complete CSV exactly.

## Verification
- Confirm complete long labels render without truncation.
- Confirm ARC hides KSC-only approvals and changing Center updates Center-only fields.
- Confirm the sample selects FFP, Competitive (simplified procedures), Total small business set-aside, and preserves the aviation answer.
- Confirm no raw header duplication, server fields, retained prior-environmental block, or code-like Question 6.1 / 9.1 labels remain.
- Confirm red-flag scanning and Start the clock still behave unchanged.
