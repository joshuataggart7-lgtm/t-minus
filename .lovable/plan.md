# Sample 1/2 cold-path UX polish

## Goal
Make the acquisition file and document entry feel calmer and easier to scan without changing acquisition rules, required gates, seeded data, or specialized Sample 3/IDIQ behavior.

## What will change
- Refine the acquisition clock area so it presents one clear primary next action, stronger spacing and hierarchy, and a quiet More menu for secondary commands.
- Add a restrained hold message with the reason, owner, a direct Fix action, and a Why? disclosure for the governing rule and citation.
- Default the launch sequence to the previous, current, and next phases; retain the complete sequence behind Show full sequence and preserve phase details, documents, citations, and novice navigation.
- Soften missing requirement language to “Needs …” and make blocked phase exit guide the user to the first missing required row rather than presenting a long list.
- Keep Save version as the primary document action, group Word/PDF under a quiet Export control, and replace the provenance wall with compact Live, Sample, Draft, and Reviewed indicators plus Details.
- Show required-field guidance inline after interaction, and place a calm “Drafted from the record — confirm.” hint beside drafted-field metadata.
- Add the requested dated BUILD_NOTES entry with shipped and deferred scope.

## Technical details
- Limit implementation primarily to `src/routes/files_.$acquisitionId.tsx` and `src/routes/documents.$templateKey.$acquisitionId.tsx`, using the existing explanation helper and semantic design tokens.
- Reuse the existing `heroAction`, `ExplainThis`, document satisfaction, phase sequence, validation, export, and dialog flows; change presentation only.
- Keep all lifecycle calculations, required-only gating, role permissions, audit behavior, and vehicle-specific phase plans unchanged.
- Verify A-2027-0101 and A-2027-0102 at desktop and mobile widths, including one document from each, then publish after the preview passes.

## Explicitly deferred
- Sample 3 and IDIQ behavior changes, seed changes, security/RLS work, broader regulation or work-queue redesign, and any NCMS write-back, FedRAMP, or FPDS claims.
