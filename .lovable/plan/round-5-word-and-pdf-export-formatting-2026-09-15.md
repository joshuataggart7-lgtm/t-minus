# Round 5: Word and PDF export formatting

## Scope
Change export output only. Keep every screen form, field, route, rule, calculation, and saved value unchanged.

## Implementation

1. **Create a template-aware export model**
   - Separate printable document content from the current screen rendering so exports no longer inherit screen labels, citations, Source marks, badges, or placeholders.
   - Use acquisition-record actors for FROM and signatures, including J. Rivera on the seeded samples.
   - Render missing values as the template calls for: blank underscore lines, omission, or TER-specific `N/A`.

2. **Standardize Word and PDF page furniture**
   - Remove debug/version/citation banners and all “not an official system” body/footer text.
   - Add a centered `Page X of Y` footer and an 8pt grey, left-aligned `Prototype, synthetic data` footer note.
   - Apply US Letter sizing and template-specific margins/fonts in both formats.
   - Use Times New Roman 12 with one-inch margins and 6pt paragraph spacing for NF 1858 memoranda.
   - Preserve seeded-template typography and margins where a source file exists; use Times New Roman 12 otherwise. TER will follow the seeded 07/2026 Word file’s page settings and typography.

3. **Rebuild NF 1858 exports**
   - Use the Rev 12/24 agency header and aligned TO/THRU/FROM/SUBJECT/REF block.
   - Remove the acquisition record block and renumber remaining body paragraphs from 1.
   - Emit signature, concurrence, enclosures, distribution, and cc only where applicable.
   - For the market research memo, read a saved commerciality determination; otherwise use the requested complete sentence with no bracketed instruction.

4. **Add dedicated JOFOC export layout**
   - Render the HQ 04/2026 title/header and three-line identification block.
   - Convert items 1–11 into titled numbered prose paragraphs with record values written into sentences.
   - Render notice status/dates in sentence form.
   - Finish with Technical Representative, Contracting Officer, and value-tier approving-official certification blocks using record/routing names and titles, with blank signature/date lines.

5. **Add dedicated TER export layout**
   - Render the seeded HQ 07/2026 memorandum header.
   - Print sections 1–8 as numbered bold headings with prose or `N/A`; print section 8 items a–f on separate lines.
   - Add the technical evaluator signature block.

6. **Route exports by document type**
   - NF 1858 documents use the memorandum exporter.
   - JOFOC and TER use their dedicated exporters.
   - Remaining OP documents use the cleaned generic template exporter with template metadata for formatting.

## Verification and deliverables

- Export Word and PDF for:
  - Market Research Memorandum — A-2027-0101
  - Pre-award Package Transmittal Memorandum — A-2027-0101
  - JOFOC — A-2027-0102
  - Technical Evaluation Report — A-2027-0101
- Validate all four Word files structurally.
- Convert every Word and PDF page to images and inspect every page for clipping, overlap, incorrect fonts/margins, placeholders, labels, citations, actor names, footer text, and page numbering.
- Correct any issues found, then provide page 1 previews for each requested document and format.
