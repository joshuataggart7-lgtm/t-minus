# Sample 1 companion DOCX prefetch remediation

## Scope
- Make only the Sample 1/commercial/simplified postaward companion downloads persist with stable `.docx` filenames.
- Keep both approved completion messages, all citations, the Part 15 master path, and every held form/export unchanged.

## Implementation
- Prebuild the applicable successful or unsuccessful companion DOCX after the page data and draft fields are ready.
- Store the completed bytes in a ref, replacing them whenever the draft fields change and discarding stale asynchronous results.
- On Export Word, use the ready bytes and invoke the existing named download helper synchronously within the menu selection event, with no promise or `await` before the click.
- If prebuilding is still in progress or failed, show the existing export failure message rather than falling back to the asynchronous click path.

## Validation
- In Chrome, export both Sample 1 letters and confirm stable filenames, persisted files, valid DOCX packages, and SHA-256 hashes.
- Inspect both companion faces for the held citations, blank signature ink, Joshua Taggart, no Part 15-only text, and no unresolved markers.
- Recheck the untouched A-2027-0118 Part 15 exports and run the focused type check.
- Publish only after the tip advances from `219e414`.
