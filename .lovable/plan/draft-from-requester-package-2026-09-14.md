# Draft from requester package

## Goal
Add a session-scoped drafting panel above the existing T-Minus record block. It reads only documents uploaded or pasted during the current browser session, proposes intake and NF 1707 values with evidence, and never saves an unconfirmed suggestion.

## User experience
- Add a collapsible **Draft from requester package** panel above the record block.
- Accept up to four labeled sources: PR, NF 1707, SOW/PWS, and IGCE, as PDF, Word, or text uploads or pasted text.
- Display: “Synthetic or non-sensitive documents only in this environment.”
- Keep selected files and extracted suggestions only in current page memory; leaving or refreshing clears them.
- Show each proposed value with an **AI-suggested** marker, editable value, source document and excerpt, and an individual **Confirm** control.
- Add **Confirm all**, protected by one confirmation dialog. Confirmed values flow into the existing Intake fields; unconfirmed values do not affect save, validation, or clock start.
- Preserve all existing record-block and NF 1707 layouts.

## Extraction and mapping
- Add an authenticated server function that receives only the current request’s uploaded/pasted content and returns a validated structured draft.
- Use Lovable AI’s default reasoning model through the streaming Responses API, with bounded error handling and no artificial timeout.
- Extract the requested title, scope summary, requester/organization, directorate, project, NAICS recommendation with rationale and two alternates, PSC, value, dates, place, contract indication, commercial-item assessment, competition indicators, and six NF 1707 gates.
- Require provenance for every proposal: source name plus an exact excerpt. Reject suggestions whose excerpt is absent from the submitted source text.
- Match directorates and projects against currently loaded Intake choices; preserve unmatched text as an editable suggestion instead of inventing a database record.
- Map a completed NF 1707 into canonical Intake answers and label those proposals **from requester’s 1707** while retaining the existing 271-field export mapping.

## IGCE handling
- Parse an included IGCE into draft CLINs and periods.
- When no IGCE is provided, derive a CLIN skeleton from SOW/PWS deliverables, leave all dollar cells blank, and propose **IGCE attached: No**.
- Add the minimum IGCE builder state/UI needed to review and confirm the generated CLINs and periods; confirmed totals/dates feed the existing estimated-value and period fields where applicable.
- Keep unconfirmed CLIN drafts session-only. Persist confirmed IGCE structure with the action when the clock starts, using a narrowly scoped table with authenticated RLS and explicit grants.

## NAICS and SAM.gov
- Extend the existing authenticated, server-side SAM.gov path to accept a proposed NAICS code before an acquisition record exists.
- Show the returned size-standard information beside the primary and alternate NAICS choices; preserve the existing sample/cache behavior and never expose the SAM.gov key.
- If SAM.gov cannot provide a size standard, show that plainly rather than fabricating one.

## Security and audit
- Do not upload package files to permanent storage and do not create reusable document records for them.
- Enforce file count, type, and 20 MB per-file limits; parse Word/text safely and pass PDFs as supported document input.
- Keep AI and SAM.gov calls server-side and authenticated.
- Record audit entries only when suggestions are confirmed/applied or confirmed IGCE rows are saved; do not audit or persist abandoned drafts.
- Surface Lovable AI gateway errors verbatim where actionable, following retry rules for only rate limits and transient failures.

## Verification
- Test PDF, DOCX, TXT, and pasted-text paths; mixed packages; missing IGCE skeleton generation; completed NF 1707 mapping; individual confirmation; edited confirmation; confirm-all cancellation/acceptance; refresh clearing drafts; and oversized/unsupported files.
- Verify no Intake field changes before confirmation and that confirmed values survive the existing red-flag scan and clock-start save.
- Verify NAICS size-standard display, authenticated access, Demo mode, mobile/desktop layout, keyboard use, labels, focus, and reduced motion.
- Run one real Lovable AI extraction request and one SAM.gov lookup through the exact production paths, then complete browser checks on Intake.
