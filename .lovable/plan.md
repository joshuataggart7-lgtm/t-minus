# Consistency pass

## Goal
Make acquisition status, lifecycle dates, clause-change impacts, and loading messages consistent across every named screen, then verify the three requested records and fresh-load behavior.

## Changes

1. **One acquisition decision function**
   - Replace the duplicated blocker logic with one pure function that computes the current blocker, owner, next action, deadline, status, and clock display.
   - Inputs will be the acquisition record, open record flags, launch sequence, and polls for the current phase only.
   - Use its result on Executive Overview rows, Work Queue cards/list, the file clock line, and leadership callouts.
   - Separate future-phase review requirements into an “Upcoming reviews” list on the file; they will not affect blocker, hold, status, or queue placement.

2. **Lifecycle enforcement and seed correction**
   - For Launched files, derive the award date from the launch audit entry with the recorded award date as fallback, display days since award, and suppress all days-to-award and pre-award blocker/vote language.
   - Restrict Launched next actions to Administration and Closeout.
   - Prevent launch while a current pre-award poll is pending or any required pre-award phase work is incomplete; a successful launch advances the file into Administration.
   - Correct A-2027-0103 in both the seed source and live data to an active Award-stage file, and check every other seeded Launched row against the same rule.
   - Treat scrubbed files as stopped: no decision or award countdown.

3. **Successor clock**
   - Sum only Intake through Award plus FPDS-NG Report from the matching phase plan.
   - Add the required 30-day transition allowance.
   - Recompute successor start dates and overdue flags everywhere that shared successor logic is used, and update the displayed method text.

4. **Truthful loading states**
   - Gate Overview callouts, file clock messages, forecast messaging, Work Queue, Watch, and supporting panels on loaded data.
   - Show “Loading” placeholders instead of positive/empty conclusions until their facts are available.

5. **Clause-change candidates and direction**
   - Add effective-dated change-direction fields for whether existing contracts must be modified and its deadline, available when HQ records a clause change.
   - Classify rows as exactly: “Potentially affected,” “Applicability unverified,” or “Modification required.”
   - Create modification tasks only when the recorded direction requires modification; count stored-list matches as affected and show unknown clause lists separately.
   - Replace the page explanation with the supplied RFO FAR 1.107(d) statement and update Center counts accordingly.

6. **Overview wrapping**
   - Remove truncation from mission names and blocker/next-action text while preserving the current compact hierarchy.

7. **Watch and exclusions clarity**
   - Mark fallback feed rows “Sample.”
   - Track whether GAO and Federal Register have ever completed successfully and show “Live feed not yet run” for a source until then.
   - Show exactly “Exclusions sweep: never run” on the Acquisitions tab when no sweep audit exists.

8. **Option exercise dates**
   - Read option periods only from the contract schedule stored on the acquisition record; do not synthesize annual periods.
   - Read the preliminary-notice lead from the contract’s 52.217-9 fill-in, defaulting to 60 days only when the fill-in is absent.
   - Show a clear not-recorded state when the contract schedule has no option dates.

9. **Verification and report**
   - Confirm the Unitary Wind Tunnel Overview row, A-2027-0109 Work Queue card, and A-2027-0109 file show the identical blocker and owner.
   - Confirm A-2027-0103 is not Launched and shows days to award.
   - Capture a fresh-load state proving “Loading” appears instead of “On Track.”
   - Verify successor arithmetic, clause labels/counts, Watch/exclusions wording, scrubbed clocks, launch guard, and option date behavior.
   - Report each completed change separately, including the seed/live-data correction.

## Technical details
- Extend existing JSON-backed post-award schedule data for option dates rather than inventing annual periods.
- Add narrowly scoped database columns for clause-change direction/deadline and preserve existing row-level access rules.
- Update seed/reset logic so corrected lifecycle data remains stable after “Reset demo.”
- Keep all calculations deterministic and table/record-driven; no model-generated decisions.
