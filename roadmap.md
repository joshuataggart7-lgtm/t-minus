# Roadmap

- [x] Unify blocker, owner, next action, and deadline logic across all screens
- [x] Enforce launched and scrubbed lifecycle rules and correct inconsistent seed records
- [x] Correct successor clock to pre-award days plus 30-day transition
- [x] Add truthful loading placeholders
- [x] Correct clause-change labels, direction field, counts, and explanatory statement
- [x] Wrap Overview mission and blocker text
- [x] Clarify Watch sample/live state and exclusions sweep never-run state
- [x] Correct option preliminary notice calculation from contract dates and clause fill-in
- [ ] Verify A-2027-0109 consistency, A-2027-0103 lifecycle, and fresh-load behavior
- [x] Reorder mission seeds and reload the five mission rows
- [x] Correct the Intake record block without changing NF 1707 sections
- [x] Verify both sample loaders, defaults, project creation, and package gate

- [x] Rebuild NF 1707 Intake sections, mapping, tracked approvals, and 271-field export preview
- [x] Add session-only requester-package drafting, confirmations, provenance, IGCE CLINs, and NAICS lookup

- [x] Add the NF 1858 memorandum layout, routing table, memo exports, and packet index column
- [x] Draft memo bodies from the record, file-addressed routing, clean Word/PDF exports, NF 1787/1787A forms, cited document requirements

## NF 1707 sign-offs (requested 2026-09-15)
- [x] Read signature/concurrence blocks from the NF 1707 form in seed/forms; one Approvals row per block, form order, exact printed block name.
- [x] Show a row only when the record makes it apply (funds certification always; others on their gate = yes), with citation.
- [x] Row fields: reviewer title from center routing, assigned person, status (Not sent / Sent / Concurred / Non-concurred with comment), date, link to the section.
- [x] Concurred writes name/title/date into the exported 1707 signature fields, signature line left blank.
- [x] Non-concurrence blocks the phase and shows the comment on the file page.
- [ ] Ask the user which section triggers any block that does not map to a gate.
