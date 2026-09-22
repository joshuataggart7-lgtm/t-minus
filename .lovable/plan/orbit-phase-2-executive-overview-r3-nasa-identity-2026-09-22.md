# ORBIT Phase 2 Executive Overview r3 — NASA identity

## Scope
Strengthen only the Executive Overview’s identity and information hierarchy. Preserve all existing data queries, calculations, status mapping, navigation, workflows, and Soft Walk behavior.

## Build
- Add an Executive-only masthead using the authorized NASA insignia, with the identity line: NASA · T–MINUS · PROCUREMENT MISSION CONTROL · AMES RESEARCH CENTER · OFFICE OF PROCUREMENT.
- Add a dedicated NASA identity-red token for the masthead underline and rare brand details only; keep HOLD, OVERDUE, and errors on the existing operational red.
- Visually join the page masthead and Mission Control environment while retaining selective light areas for readability.
- Normalize the existing record-derived phases into the approved lifecycle labels without inventing stages or changing phase truth, and improve 1280px label legibility.
- Strengthen mission-card distance hierarchy while retaining all existing status, countdown, phase, next-gate, and desk-level record details.
- Reuse the authorized `public/letterhead/nasa-insignia.png` through `public/brand/nasa-insignia.png`; no fabricated or third-party branding.
- Append the NASA identity and red-usage rule to the ship notes.

## Validation
- Verify signed-in desktop and mobile rendering, phase-label readability, no page overflow, card hierarchy, navigation links, and browser errors.
- Confirm the prototype disclaimer remains visible.
- Do not publish.

## Technical constraints
- Change only `src/routes/index.tsx`, `src/styles.css`, `src/components/mission-control/*`, `public/brand/`, and `BUILD_NOTES.md`.
- No business logic, database, fixture, role, audit, document, form, clock, or other-page changes.
