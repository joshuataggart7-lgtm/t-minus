# Sample 1 postaward Word export remediation

## Scope
- Make Sample 1 successful and unsuccessful companion Word downloads persist with stable `.docx` filenames.
- Correct each completion message so successful names RFO FAR 12.301 and unsuccessful names FAR 13.106-3(d).
- Preserve the existing Part 15 master path and all held document generators.

## Implementation
- Harden the shared browser download handoff so the object URL remains available until Chrome has saved the file.
- Keep the anchor in the document during the click, then remove it and revoke the URL after a delay.
- Update only the postaward export branch filenames and companion completion messages.

## Validation
- Verify both Sample 1 companion files are valid DOCX packages with stable names and required citation faces.
- Verify no Part 15-only or FAR 15.502-7 text appears in either companion.
- Recheck the Part 15 generators and run the TypeScript check.
- Publish only after validation passes and the tip advances from `0611635`.
