# T-Minus — pilot known gaps

For NASA IT handoff readers. T-Minus is a prototype. Not an official NASA system.
These are the limits we have not closed.

- **Official form field checks are done by a person.** Filled previews and PDF exports
  are for a human field check in desktop Adobe Acrobat Reader. A blank form in Chrome or
  PDF.js is expected for XFA files. Nothing in the app is an Adobe verification.
- **No write-back to NCMS.** T-Minus assembles a local handoff packet only. NCMS stays the
  system of record (NFS 1804.171); the officer keys the award there.
- **The FPDS sheet is a fill aid.** It lays out values in reading order to copy. It is not
  a submission and T-Minus does not write to FPDS.
- **A security finding is deferred.** Signed-in users can read staff contact details. It is
  recorded and open, not fixed. It is not a demo blocker.
- **Advisories never hold a phase.** Evaluation board notes, missing NF 1098 tabs and
  Table 12 fill-in confirmations are advisory only; none hold a file or block a phase exit.

All records in the prototype are fictional.

- **NF 1707 overlay is header only.** The official blank is now at
  `public/forms/NF1707.pdf` and the requisition header (Center, requisition number,
  requisitioning organization, description of requirement) binds from the record.
  Sections 1 to 12 are still answered on Intake and are not mapped to form paths;
  no path is guessed. Signature and approval blocks stay blank. The blank is
  Reader-extended, so the free-Reader path is the same as other XFA blanks:
  open the blank from this app and use Import Data with the companion data file.
  A desktop Adobe field check by a person is open.
- **No official blank for NF 1098.** `public/forms/` carries no agency blank for
  NF 1098, so T-Minus ships no field overlay and offers no re-typed lookalike. The
  contract-file index and Present/Missing assembly follow the NEAR File Structure
  Checklist, Crosswalk WSC (v3.3, Apr 24): mapped rows show the NEAR order,
  element title, and the checklist's What to File Here notes verbatim, and the
  checklist stays advisory — it never holds a phase exit. An overlay is possible
  once the official blank is added.
