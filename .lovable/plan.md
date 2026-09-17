# Soft Walk value-gate fixes

## Build
- Add the honest `P00001` modification to A-2026-0090 through the existing modification data path, retaining Block 10A’s contract number and Ready status.
- Render an empty SF 30 Block 2 as blank with its existing gap note, never as “Not recorded.”
- Bind the market-research Word signature to the same record-based contracting officer as the FROM line.
- Clean repeated trailing source words and explain existing source-count de-duplication without changing totals.
- Suppress stale uploaded SF 1449 rows when a generated official SF 1449 is present.

## Guardrails
- Do not change OF 347 face/math, the SF 1449 schedule packer or continuation marker, clocks, phases, citations, ORBIT, or regulation corpus.
- Preserve Sample 1/2 facts except the requested A-2026-0090 demo modification.

## Validation
- Verify SF 30 preview/export values, memo export text/signature, and file-index behavior.
- Recheck OF 347 `$1,385,000` Lot/Grand Total and protected SF 1449 schedule output remain unchanged.
- Run the focused type check, append BUILD_NOTES, publish once, and report the resulting revision.
