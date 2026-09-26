# P0d past-target countdown consistency

## Goal
Give every human-facing pre-award countdown one consistent reading once its target or forecast date has passed, without changing stored facts, acquisition logic, machine exports, forms, or styling.

## Implementation

1. **Normalize the shared countdown display model**
   - Add `pastTarget` to `CountdownView`, defaulting to `false` for launched, stopped, not-started, and future countdowns.
   - Preserve signed date arithmetic internally, but expose absolute day counts with no prefix for past-target HOLD, OVERDUE, and past-forecast displays.
   - Remove the HOLD and forecast zero-flooring.
   - Keep `T+` exclusively on the recorded-launch path.
   - Add and export `countdownText(view, { omitBadge? })` as the single plain-text formatter for countdown consumers.

2. **Update the two shared countdown faces without layout or style changes**
   - Full face: show the absolute number without a prefix and reuse the existing unit slot for `days past target`; retain the existing caption slot and badge behavior.
   - Compact face: show the absolute number, `days past target`, and the existing badge chip.
   - Keep all existing elements, classes, colors, dimensions, and launched/future behavior.

3. **Remove the Executive overdue prefix rewrite**
   - Make `overviewCountdownView()` return `countdownView()` unchanged so overdue pre-award records cannot regain a `T−` prefix.

4. **Adopt the shared text across human-facing surfaces**
   - Executive Overview schedule impact, trajectory strip, featured clock, and acquisition scan accessibility text.
   - Global search.
   - Acquisition file summary and briefing-book handoff text, omitting a duplicate badge where readiness already supplies it.
   - Document workspace operational line and visible document header.
   - Flattened form footer only.
   - Briefing-book status wording and figure.
   - Preserve future forecast suffix behavior and all current null/stopped/not-started wording.

## Files expected to change

- `src/components/launch-countdown.tsx`
- `src/components/mission-control/operational-state.ts`
- `src/components/mission-control/acquisition-scan-card.tsx`
- `src/components/mission-control/mission-trajectory.tsx`
- `src/components/mission-control/executive-exceptions.tsx`
- `src/components/global-search.tsx`
- `src/routes/files_.$acquisitionId.tsx`
- `src/routes/documents.$templateKey.$acquisitionId.tsx`
- `src/routes/forms.$formKey.$acquisitionId.tsx`
- `src/lib/briefing-book.ts`

No CSS, migrations, database records, form builders, generated auth storage, readiness rules, hold derivation, or machine-export fields will change.

## Verification

- Run TypeScript checks and the project build.
- Inspect the final diff and confirm only the scoped files changed, with no CSS, migration, data, or auth-storage edits.
- Search human-facing countdown formatting to ensure no overdue pre-award path can emit `T+`, `T−0`, `T− 0`, or `T−N … OVERDUE`.
- Verify representative output for past-target HOLD, overdue, future HOLD, future FORECAST, ordinary future target, and launched modes.
- Confirm signed `days_to_award` values in Reporting CSV and Overview JSON remain unchanged.
