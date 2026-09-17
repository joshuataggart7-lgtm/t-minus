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

- **NF 1707 overlay is blank-driven, and the Adobe field check is still open.** The
  official blank is at `public/forms/NF1707.pdf`. It carries no widget layer, so its
  field paths are read from the blank's own XFA packets rather than from an AcroForm
  layer, and the export writes only paths the blank actually has. The requisition
  header (Center, requisition number, requisitioning organization, description of
  requirement) binds from the record, and Sections 1 to 12 answers from Intake are
  written wherever the blank carries a matching field. An answer with no field on the
  blank stays on Intake; no path is guessed. Signature, concurrence and approval
  blocks stay blank for the Approvals step. The free-Reader route is Import Data:
  open the blank from this app, then Forms or Manage Form Data, Import Data, and pick
  the companion `.xdp`. A desktop Adobe field check by a person is open; nothing here
  is an Adobe verification, and SF 1449 and SF 30 templates stay non-Live.
- **No official blank for NF 1098.** `public/forms/` carries no agency blank for
  NF 1098, so T-Minus ships no field overlay and offers no re-typed lookalike. The
  contract-file index and Present/Missing assembly follow the NEAR File Structure
  Checklist, Crosswalk WSC (v3.3, Apr 24): mapped rows show the NEAR order,
  element title, and the checklist's What to File Here notes verbatim, and the
  checklist stays advisory — it never holds a phase exit. An overlay is possible
  once the official blank is added.
