# Rebuild the NF 1707 intake sections

## Scope
Rebuild only the NF 1707 portion below the existing T-Minus record block. Preserve the record block, red-flag scan, sample loaders, package gate, and clock-start behavior.

## Intake experience
- Replace the flat field dump with six one-line Yes/No gate questions.
- Render only applicable NF 1707 sections; keep Sections 1, 3, 9, 10, and 11 always available but initially collapsed.
- Show progress as `Section n of total` across the sections applicable to the current request.
- Render each section as a compact collapsible card with its form title, citation, and one question per row.
- Remove standalone `OR`/`AND`, headings, instructions, citations, signatures, typed-name fields, and reviewer-only routing blocks from requester questions.
- Use checkboxes for independent selections, radio groups for mutually exclusive choices, and blank-by-default Yes/No/Not applicable only where the form asks that question.

## Section behavior
- Build curated, deduplicated question groups for Sections 1–12 using the exact seeded form wording and citations.
- Implement the requested IT authorization, environmental/GPC and NEPA, service affirmations, technical subsections, software classes, SCaN/communications/EVM/aviation/SCV choices, quality/GIDEP flow, hazard checklist, property, center approval, travel, extraneous-items, and fee-limitation rules.
- Read the EVM display threshold from a new seeded `$50M` threshold row citing NFS 1834.201 / NFS CG 1807.12(a)(6), rather than hard-coding it in the page.
- Keep conditional questions out of view and derive their export values when their gate is No.

## Full form mapping and export preview
- Reconcile the two seed exports to the requested 271-cell inventory. Preserve the 269 complete form rows and restore the two identified server-value cells as export-only metadata, never requester inputs.
- Add one normalized mapping layer that maps each intake answer, gate answer, derived value, or approval sign-off to every NF 1707 cell it feeds.
- Store canonical intake answers alongside all derived cell values so existing roadmap, review-trigger, sample, and export behavior remains compatible.
- Replace the reduced NF 1707 document summary with a filled, sectioned 1707 preview that uses the complete mapping and familiar form labels.
- Add an `Export preview` link on Intake. Before a record exists, it previews the current unsaved answers; after save, the standard versioned document route remains available.

## Approvals step
- Add a dedicated `nf1707_approvals` table for sign-offs with acquisition, mapped form field, approval role, owner, status, due date, and completed date.
- Apply authenticated/demo/admin access rules consistent with existing working records, with explicit grants and row-level security.
- Add an Approvals step to each action’s launch sequence. Create only the sign-offs triggered by that action’s answers and center.
- Render owner, due date, and completion date there; keep signatures and reviewer routing off Intake.
- Fill removed signature/name/date cells in the 1707 export from completed approval records.

## Data and compatibility
- Update seed/reset loading for the 271 mapping rows, EVM threshold, and any seeded approval definitions without inventing sample acquisitions.
- Normalize existing sample answers into the new canonical keys while retaining legacy keys required by current review and red-flag logic.
- Keep all regulation, threshold, and routing decisions data-driven.

## Verification
- Verify all six gates and every conditional section, blank tri-state defaults, deduplication, no orphan connectors, no requester signatures, and progress counts.
- Verify service, IT, hardware, space systems, aviation, hazards, software, SCV, quality exemptions, EVM threshold, and fee-limitation branches.
- Verify Sample 1 and Sample 2, red-flag scanning, clock start, Approvals creation/completion, 271-cell preview mapping, and export values.
- Check keyboard use, focus visibility, labels, contrast, desktop, and mobile without changing the T-Minus record block.
