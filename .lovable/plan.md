# Phase exits and confirmation dialogs

## What will change

- Make phase gates use only rows labeled **Required**. Offered rows will be excluded from blockers, holds, hero actions, and exit refusal checks.
- Add a real **Exit [phase]** action when the current phase has no missing Required rows or pending required reviews.
- Replace the native and inline confirmation flows for Exit phase, Scrub, Remove, Record vote, and Open poll with accessible in-page dialogs.
- When exit is refused, keep the dialog open and list every missing Required row with a direct link to its document, form, upload row, check, or packet action.
- On a successful exit, move the record to the next phase, clear the completed phase hold, keep the clock running, and write `Phase exited: Market Research → Synopsis` with the entered reason and signed-in account name.
- Rewrite memorandum hold, vote, and saved-version sentences from structured audit fields rather than copying raw audit reasons.

## Dialog behavior

Each dialog will show:

- a one-line description of the exact result;
- a labeled reason field only when the action requires one;
- **Cancel** and **Confirm** controls;
- a pending state that prevents duplicate submission;
- an explicit error inside the dialog if the action fails.

Exit and Scrub require a reason. No-go requires a reason; Go may include a note. Remove records a reason. Open poll needs confirmation but no reason.

## Phase-exit rules

1. Read the effective current phase from the launch sequence.
2. Evaluate only non-optional rows in that phase.
3. Treat generated documents as complete only when saved or externally attached.
4. Treat attached-document rows as complete only when the file is present.
5. Include pending required review seats in the refusal list.
6. If anything is missing, show linked items in the dialog and make no database change.
7. Otherwise update `current_phase` to the next planned phase, set the clock to running, clear derived hold fields, and insert the phase-exit audit row.

## Memorandum wording

- Holds will read like: “The clock was held on 15 September until the IGCE was attached.”
- Recorded votes will read like: “Legal review (K. Bramwell) concurred on 15 September; the vote was received by email and recorded by Joshua Taggart.”
- Saved documents will read: “The [title] was saved as version N.”
- Engine implementation phrases and raw audit reasons will not appear in the memorandum.

## Verification

- Verify A-2027-0101 can exit Market Research when only offered NF 1787A is missing.
- Verify a genuinely missing Required row refuses exit and provides a working link.
- Verify successful exit updates the phase, clock state, and audit history.
- Verify every requested action uses an in-page dialog and no native `prompt()` or `confirm()` remains.
- Verify memorandum output for a hold, an emailed vote, and saved document versions.
- Check desktop and narrow layouts, keyboard focus, Cancel, Confirm, and error states.
