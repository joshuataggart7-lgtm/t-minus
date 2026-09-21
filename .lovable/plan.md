# DRFP Cover Letter OP Word Master

## Scope
- Create `public/forms/DRFP_COVER_MASTER.docx` from the attached HQ Draft Request For Proposal cover letter without modifying the uploaded original.
- Strip the instruction pages and Document History Log while preserving the HQ letterhead, styles, footer version identifier, and clean black body text.
- Replace active fill-ins with isolated markers and leave signature underscore areas blank; the active contracting officer name resolves to Joshua Taggart for protected Soft Walk samples.
- Add a dedicated DRFP Word generator using the existing `applyMarkers` pipeline and the working named-download path.

## Method and content rules
- Apply the DRFP method gate to competed negotiated work only; commercial, simplified, and sole-source paths refuse rather than receiving Part 15 DRFP prose.
- Populate only recorded acquisition or saved-template values. Optional and unresolved items are omitted instead of printing blank placeholders or invented text.
- Preserve the HQ source’s cited authority stack; do not add authorities beyond the source and existing verified DRFP definition.
- Keep the DRFP disclaimer explicit: it is not a solicitation and does not request proposals.

## App wiring
- Route `drfp-cover-letter` Word export through the new master generator.
- Download as `drfp-cover-{acquisition-id}.docx` through the existing persistent data-URL/File download helper.
- Show an honest not-available state when the acquisition fails the DRFP method gate.
- Record the shipped DRFP export in `roadmap.md` and the implementation decision in `BUILD_NOTES.md`; leave readiness meters unchanged.

## Verification and release
- Validate the marker master and generated Samples 1 and 2 documents as DOCX packages.
- Extract generated Word text to confirm instruction/history removal, no unresolved markers or blank-dump text, retained letterhead/version styling, exact disclaimer, expected citation content, Joshua on the active CO band only, and blank signature ink.
- Verify the named browser download and method refusal path without changing any held form or memorandum pipeline.
- Confirm only DRFP-related files changed, advance the tip from `b1bfd92e`, and publish for Soft Walk QA. Report HEAD, files, and STOP without a GREEN claim.

## Technical details
- Mirror `src/lib/rfp-cover-docx.ts`: `fetch` the dedicated master, lint markers, apply markers, and return DOCX bytes.
- Build the marker master by editing only `word/document.xml` in a copied package; preserve package parts for letterhead, styles, relationships, and footers.
- Reuse `downloadDocxBytes`; do not alter the existing Final RFP, Postaward, PPM/PNM, JOFOC/LSJ, Set-Aside, or official-form generators.
