# ORBIT Phase 2 Executive Overview r2

## Scope
Unify only the Executive Overview into one dark Mission Control environment. Preserve all data queries, metric calculations, clocks, workflows, records, and frozen Soft Walk behavior.

## Build
- Add a lifecycle trajectory derived from each acquisition’s existing phase sequence and current phase, showing accumulation, holds, and approaching awards without invented telemetry.
- Rework the GO/WATCH/HOLD/LAUNCHED summary into a flight-director rail rather than KPI cards.
- Deepen acquisition scan cards with existing target award, next gate, hold duration, schedule impact, owner, and phase timing where recorded.
- Replace phase bars with a lifecycle accumulation visualization based on existing phase distribution.
- Recast attention items as an anomaly rail with mission, condition, severity, time in condition, phase, and next action.
- Add a days-returned visualization using the already-computed launched-this-quarter metric, including an honest zero state.
- Carry the dark navy/cyan Mission Control visual language through the overview’s operational sections and tab handoff, with restrained motion and reduced-motion support.

## Technical constraints
- Changes stay within `src/routes/index.tsx`, `src/styles.css`, `src/components/mission-control/*`, plus the ship notes.
- Reuse `computeMetrics`, `countdownView`, phase records, and existing dates only; no new calculations that alter clock truth.
- No changes to documents, forms, database, fixtures, roles, audit, navigation, or other pages.
- Validate signed-in desktop and mobile rendering, overflow, navigation links, and browser errors.
- Do not publish.
