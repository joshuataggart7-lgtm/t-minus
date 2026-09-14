# Intake record block correction

## Scope
Update only the T-Minus record block above the NF 1707 form. Leave every NF 1707 section, label, control, and answer mapping unchanged.

## Intake changes
- Replace Center with the fixed NASA/HQ list: HQ, ARC, AFRC, GRC, GSFC, JPL, JSC, KSC, LaRC, MSFC, SSC, and Other. Persist both the selected code and display name.
- Rename Branch to Organization code. Use a free-text field with autocomplete from organization codes already stored in T-Minus; accept new values.
- Default Center and Organization code from the signed-in user’s last submitted Intake, falling back to their profile/persona defaults.
- Split Mission supported into:
  - Mission directorate, storing both acronym and display name from the requested list.
  - Program / project, using the existing project records and supporting an inline Add new project flow with name and mission need date.
- Prefill Mission need date when a project is selected, while keeping the date editable by the CO.
- Require Sponsoring agency and store a reimbursable-agreement flag for “Reimbursable or other-agency.” Require specification text for “Other.”
- Replace Contract type with the requested primary list and an optional Hybrid with second type.
- Replace Acquisition method, Competition, and Set-aside choices exactly as requested.
- Show the authority field only for Limited sources, Sole source, or Brand name. Make it a dropdown filtered by acquisition method and populated from structured options sourced from the seeded RFO FAR material.
- Rework Attachments and conditions as an accessible checklist with concise labels and one-line “why this matters” tooltips.
- Show Package complete / Package incomplete at the top from Funds certified, IGCE attached, and SOW/PWS attached.
- Keep all help text to one line.

## Data and seed updates
- Extend acquisition records for Center display name, mission-directorate code/name, sponsoring agency, reimbursable flag, other-directorate text, hybrid contract type, and package-complete state inputs.
- Extend project records with mission-directorate code/name and preserve each project’s need date on that record.
- Extend profiles with last-used Center and Organization code, updated after a successful Intake submission.
- Add a secured, read-only reference table for method-specific competition authorities, seeded only from the project’s RFO FAR source material.
- Keep the existing `branch_code` data path compatible while treating it as Organization code throughout the Intake.
- Migrate ESDMD/SOMD to HSMD and ARMD/STMD to RTMD.
- Set every seeded sample acquisition to ARC / JAZ for now and remove “fictional label” from Center/organization seed text everywhere.
- Update both normal seed loading and Reset demo so these values return consistently.

## Sample loaders
- Rename the first loader copy to: “Sample A-2027-0101 loads as a requester would send it: IGCE not yet attached.”
- Add a second, adjacent loader for the competed Sample 2 record, preserving its stored facts and NF 1707 answers.

## Validation and compatibility
- Update Intake validation and red-flag rules for the new competition values, conditional authority, directorate details, sponsoring agency, and hybrid type.
- Update estimator mappings so the expanded contract types and acquisition methods continue producing the existing estimate and clock behavior.
- Preserve red-flag scanning, attachments, audit entries, confirmation, and Start the clock behavior.
- Keep existing downstream reads working by retaining current mission and acquisition identifiers.

## Verification
- Confirm the fixed Center list, last-used defaults, free-form/autocomplete Organization code, project date prefill/override, and inline project creation.
- Confirm conditional Sponsoring agency, Other specification, Hybrid with, and method-specific authority options.
- Confirm both sample loaders, ARC / JAZ sample migration, package gate state, and Reset demo behavior.
- Confirm the NF 1707 section DOM and answer behavior are unchanged.
- Test the complete Intake flow on desktop and mobile, including validation, red-flag scan, and clock start.
