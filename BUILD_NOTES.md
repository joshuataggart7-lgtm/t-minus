# T-Minus build notes

## B1. Foundation

Decisions taken where the specification left room, kept to the simplest option
that preserves the demo path.

- **Backend.** Lovable Cloud (Supabase project `zgrgfkpfkhocljoqhknv`) is used.
  The browser client is the generated `@/integrations/supabase/client` which
  reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`.
  The service role key is bound as a managed secret and never reaches the
  browser.
- **Schema.** `supabase/schema.sql` creates every table in the KNOWLEDGE.md
  data model plus two matrix tables (`clause_matrix_2603b`, `nfs_clause_matrix`)
  and `nf1707_fields`, which the model describes as seed sources. The file is
  idempotent. Applied via the migration tool. Helper functions `t_minus_role()`
  and `is_specialist()` live in a `private` schema (security definer) to avoid
  the public `SECURITY DEFINER` linter warning.
- **RLS.** Every table: read for all five signed-in seeded users; insert,
  update and delete for specialists and HQ only (`private.is_specialist()`).
  `audit_log` is append only, with no update or delete policy. Reviewers may
  update their own `polls` rows and insert comments. Users acknowledge only
  their own announcements.
- **Seeding.** `scripts/seed.ts` reads `t-minus-seed/` and loads it exactly,
  inventing no records. Run with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
  in the environment; the service role key is never bundled. Auth users are
  created with a shared demo password (`SEED_USER_PASSWORD`, default
  `t-minus-demo-2027`).
- **Role toggle.** The header toggle signs in as one of the five seeded
  Supabase Auth users. If those accounts do not exist yet, the shell still
  renders and shows a plain line pointing at Seed status rather than failing.
- **Landing pages.** Executive and HQ land on the Executive Overview;
  specialist, reviewer and requester land on the Work Queue.
- **Rail.** Executive Overview, Work Queue, Files, Templates, Checks, Audit
  Log, Watch, Announcements, with Estimate present and marked reserved for
  later. Seed status sits below the rail as a utility link, outside the eight
  named entries.

### Verified seed counts

| Table | Source rows | Loaded | Notes |
|-------|------------|--------|-------|
| users | 5 | 5 | Seeded Auth users |
| centers | 4 | 4 | |
| branches | 8 | 8 | |
| missions | 5 | 5 | |
| acquisition_facts | 12 | 12 | |
| thresholds | 27 | 27 | |
| phase_plan | 25 | 25 | |
| review_rules | 14 | 14 | |
| enterprise_strategies | 28 | 28 | |
| regulatory_refs | 62 | 62 | Spec said 63; source CSV has 62 data rows |
| templates | 98 | 98 | |
| clauses | 1,359 | 1,359 | Surrogate `row_id` primary key; `clause_number` indexed, non-unique |
| clause_matrix_2603b | 819 | 819 | |
| nfs_clause_matrix | 125 | 125 | |
| nf1707_fields | 271 | 271 | |

### Known deviations

- **Clauses (resolved).** The `clauses` table now uses a surrogate `row_id`
  primary key with `clause_number` as an indexed, non-unique column, so all
  1,359 rows load exactly as written and every prescription variant is kept.
- **Backend replacement.** The original spec called for the existing Supabase
  project `wczndteslofhtxbazhnj`. Lovable Cloud provisioning created a new
  managed project (`zgrgfkpfkhocljoqhknv`) instead. All schema, RLS, seeds, and
  auth users were applied to this managed project. The old `src/lib/supabase.ts`
  file remains in the repo but is no longer imported by any component.

## B5. SAM.gov entity checks

- **Server boundary.** The SAM.gov Entity Management API v3 lookup is an
  authenticated TanStack server function rather than a Supabase Edge Function,
  matching the application runtime. `SAM_GOV_API_KEY` remains server-only.
- **Demo data.** Seeded UEIs beginning with `DEMO` never call the network. They
  create a labeled fictional sample response in `sam_checks`. Live failures use
  the latest stored payload for the UEI and display it as cached.

## B6. Audit log, comments, polls, provenance

- `audit_log` gained a `phase` column; every comment, vote, poll opening, save,
  and review writes an entry with its phase.
- Polls are created per review phase (JOFOC, Go/No-go Poll) from `review_rules`,
  with due dates from each rule's planned days. The prototype has one seeded
  reviewer account, so every review seat is assigned to it.
- A No-go holds the file immediately with `No-go: <role> — <reason>` and the
  reviewer as owner; a pending vote holds once its phase has been exited.
  Changing the vote to Go resumes the clock.
- Documents carry provenance (model, generated at, reviewed by, reviewed at).
  Until a specialist marks a version reviewed, the header reads
  "AI draft, not yet reviewed".
- Verified in the browser: poll opened, No-go held the file with reason and
  owner, entry visible in the audit log, Go resumed it, comment thread saved,
  and the provenance block updated. Test rows were removed afterward.

## B7 — Executive Overview (Mission Clock)

- `src/lib/metrics.ts` computes days to award, days to the next decision,
  forecast award date, schedule impact, time saved, status word, blocker, and
  the callout sentence exactly as KNOWLEDGE.md defines them. Nothing is stored.
- `src/routes/index.tsx`: Mission Clock panel (one row per mission in priority
  order, driven by its critical-path acquisition), the "What leadership needs
  to know now" block sorted most urgent first, and the Acquisitions and
  Enterprise tabs. Every row and card links to the acquisition file.
- Enterprise tab embeds `public/orbit-prototype.html` (a copy of
  `t-minus-seed/orbit_prototype_fictional.html` with an appended overlay
  script). The workforce tabs are untouched; Executive Dashboard, Project
  Status, and Recurring Actions are re-rendered from live T-Minus data sent by
  the parent page over postMessage.
- `docSatisfied` now treats a null attachment field as "not recorded" instead
  of "missing". Ten seeded acquisitions carry no attachment flags, and reading
  null as missing put every mission At Risk. An explicit false still holds the
  file, so the B3 remove-a-document check is unchanged.
- Verified: mission rows, callouts, clock board counts, holds by reason, the
  ten longest holds, lead time by phase, drill-down to the file, the live ORBIT
  tabs, and an unchanged Hiring & Workforce tab. Attaching the IGCE on
  A-2027-0101 flipped its mission row from At Risk to On Track and removed its
  callout; the seed value was restored afterwards.

## B8. Work Queue (execution)
- `src/routes/work-queue.tsx` is a five-column board (Ready, In progress, Blocked, Awaiting Go/No-go, Launched) plus a list toggle over the same computed data.
- Column is derived, never dragged: launched -> Launched, hold -> Blocked, any pending poll -> Awaiting Go/No-go, started -> In progress, otherwise Ready. Scrubbed files are not shown.
- Card fields: title, mission, owner (co_name), current phase, next task, dependency (hold reason/owner or pending reviewer), days in phase, days to award, status word.
- Filters: mine, my branch, my Center, by mission. Seeded users carry a Center but no branch, so "My branch" reads the branch of the files the signed-in person owns; recorded here as the simplest choice that keeps the demo path working.
- Verified as the specialist: A-2027-0101 sits in Blocked with the missing IGCE as the dependency; putting A-2027-0102 on hold moved it to Blocked with the hold reason and owner, and the record was restored afterwards.


## B9. Accessibility and polish

Accessibility
- Skip link ("Skip to main content") as the first tab stop on every page; `<main id="main-content" tabIndex={-1}>` receives focus when it is used.
- Global `:focus-visible` ring (2px NASA blue, 2px offset) confirmed on all focusable elements; a scripted pass over every focusable control found none without a visible ring.
- Collapsed left rail now keeps the full label for screen readers (`sr-only`) behind the visible single letter.
- `scope="col"` added to every table header cell across all routes.
- Status is never colour alone: new `StatusMark` component pairs a small colour marker with the status word. The word renders in text colour #1D1D1F, so every status label clears 4.5:1; the marker carries the palette colour and clears 3:1 as a graphic. Applied to Executive Overview status words, document attachment state, both poll boards, the templates catalogue, and seed status.
  - Reason: #1E8E3E as text on white measures 4.37:1, below AA for body text. The palette is unchanged; only where it was used as text has it moved to a marker.
- Go / No-go buttons changed from filled #1E8E3E / #C8321E with white text to white with a 2px status border and #1D1D1F text, for the same contrast reason.
- The file-page back link is underlined (axe `link-in-text-block`).
- axe-core 4.10 run on Executive Overview, Work Queue, Files, an acquisition file, Templates, a JOFOC document, Checks, Audit Log, Intake, and Seed status: zero violations remaining, no console errors.
- Keyboard-only pass along the demo path: skip link → rail → role toggle → filters → file → poll controls, all reachable and operable.

Polish
- Loading, error, and empty states standardised through `LoadingNote`, `ErrorNote`, and `EmptyState`. Every error names the next step (refresh, clear the filters, check Seed status). Every empty state is one sentence and one action (Clear the filters, Show everything, Start an intake).
- Consistent page padding (16px on small screens, 32px from `sm` up) on main and footer; header wraps instead of overflowing.
- Executive Overview mission rows collapse to two columns from `sm` and to the full five-column clock from `lg`; checked at 834x1112 with no horizontal overflow.
- Print: app-level `@media print` block puts pages on white with black text, hides the header and rail, and avoids breaking inside sections and tables. The template PDF export already produced white/black output; sections now carry `break-inside: avoid`.

## B10. Announcements

- HQ posts an announcement from the Announcements page: title, body, severity (notice / action required / urgent), audience by role and by Center (blank means everyone / all Centers), effective from and until, optional link, and whether acknowledgment is required.
- Banner renders in the app shell above every page for anyone in the audience while the announcement is current and unacknowledged. Urgent and action-required notices with acknowledgment required have no Dismiss control — only Acknowledge clears them. Plain notices can be dismissed for the session.
- The tab lists Current and Past (past = outside the effective window). HQ additionally sees acknowledgment counts by Center per announcement, derived by joining acknowledgments to the seeded users' Center.
- Posting and acknowledging each write an audit entry (`Announcement posted` / `Announcement acknowledged`).
- Three seeded notices live in `SEED_ANNOUNCEMENTS` in `src/lib/seed-load.server.ts` with fixed identifiers, so the HQ demo reset restores them instead of duplicating them: PCD 26-03B issuance (notice, no acknowledgment), the JOFOC HQ 04/2026 template revision (action required, specialist / reviewer / HQ), and an urgent data call on critical-path acquisitions.
- Verified: HQ posted an urgent notice; the specialist saw a non-dismissible banner, acknowledged it, and the banner cleared; HQ then read one acknowledgment for it. Test rows were removed afterwards.

## B11. Watch

- Four feeds render on one page, newest first, filterable by source and tag: GAO bid protest decisions, Federal Register documents, PCDs/PICs/PNs read live from `regulatory_refs`, and OP notices HQ enters by hand.
- The two fetchers live in `src/lib/watch-fetch.server.ts` (`fetchGaoDecisions`, `fetchFederalRegister`). Deviation from the brief, same as B5: this stack runs server functions and server routes, not Supabase Edge Functions, so they are exposed as `runWatchFetch` (`src/lib/watch.functions.ts`, contracting and HQ only) and as the scheduled route `POST /api/public/hooks/watch-refresh`, guarded by the `WATCH_CRON_SECRET` bearer token. A pg_cron job `watch-refresh-daily` calls that route every day at 07:15 UTC.
- GAO: parses B-number, title, decision date, and outcome (sustained / denied / dismissed / in part) from gao.gov's recent decisions page and stores only that plus the link — never the decision text. gao.gov blocks server-to-server requests from this environment (HTTP 403), so on failure the fetcher loads three clearly labelled sample rows tagged "Sample data" and records the provider error in the audit entry, keeping the demo off the network.
- Federal Register: the free API, terms "Federal Acquisition Regulation" and "NASA FAR Supplement", last 90 days; stores title, type, publication date, agency, abstract, and link.
- Rows are de-duplicated on `source` + `external_id`, so repeated fetches add only what is new. Every fetch and every hand-entered notice writes an audit entry.
- The Executive Overview carries a small Watch line with the count of items in the last 14 days, linking to the page.
- Template badges: each live template now carries a machine-readable HQ revision date. When a PCD or Federal Register item dated after that revision touches a FAR or NFS part the template cites (parts parsed from the citation and from item titles, plus `far_part` / `nfs_part` on regulatory references), the badge shows "Newer guidance published; review" with a link to the item. Verified by adding a FAR Part 6 class deviation dated after the JOFOC 4/27/2026 revision; the JOFOC badge picked it up. The test row was removed afterwards.

## B12 addition: the requester sees the estimate at intake

- `src/lib/estimator.ts` ports the pre-award model from
  `t-minus-seed/Procurement_LOE_Estimator.html` (same thresholds, scale factors,
  calendar-month timeline, CO/CS task hours). Inputs are derived from the intake
  answers: value, competition, pricing, instrument, requirement type. Phase names
  and planned days come from the seeded `phase_plan`, not from the estimator.
- Pressing "Start the clock" runs the model, stores the result in the new
  `acquisition_facts.intake_estimate` (jsonb), writes an audit entry
  "Intake estimate recorded", and opens a confirmation page at
  `/intake/{acquisition_id}` (`src/routes/intake_.$acquisitionId.tsx`) with the
  plain-words sentence, months to award, the phase list, and the CO/specialist hours.
- The same summary appears on the acquisition file under "Estimate at intake", and
  as an "Estimate at intake" column in the Files list (the requester's status view).
- Verified end to end with the Commercial Aviation Services sample: about six months,
  nine phases, 89 contracting hours; confirmation page, file page, and audit entry all
  present. The test record was removed afterwards.

## Nonresponsibility memorandum (NF 1098 tab 0045)

- `acquisition_facts.responsibility_finding` records the contracting officer's
  finding: empty, `responsible`, or `nonresponsibility`.
- The Responsibility Check phase on the acquisition file carries a Finding
  control (specialist and HQ only). On `responsible` the file states that the
  CO's signature on the SF 1449 is the affirmative determination
  (FAR 9.105-2(a)(1)) and no memorandum is offered. On `nonresponsibility` the
  phase links to the memorandum. Every change writes an audit entry.
- The template `nonresponsibility` (tab 0045, HQ 05/2026, FAR 9.104-1 /
  9.105-2(a), binding) pre-fills legal name, UEI, CAGE, registration status and
  expiration, exclusion result, integrity records count, and the check
  timestamp from the newest `sam_checks` row for the acquisition, and carries
  the FAR 9.104-1(a)-(g) factors as sections the CO completes. Version badge,
  DOCX/PDF export, versioned saves, and audit entries work as on the other
  live templates.
- Opening the memorandum on a file whose finding is not `nonresponsibility`
  shows the SF 1449 statement instead of the form.
- `t-minus-seed/templates.csv` marks the row live so a demo reset keeps it.

## D2. Price Negotiation Memorandum with comparables

- The PNM (NF 1098 tab 065, HQ effective 4/7/2026) is a live template keyed
  `pnm`, governed by FAR 12.204(b)(1) and FAR 15.406-3, binding tier. It is
  the determination of record for price reasonableness under simplified
  commercial procedures; no separate price reasonableness determination is
  generated. `phaseForTemplate` maps it to Price Reasonableness and the file
  page links to it from that phase.
- Pre-fill comes from the record (title, Center, requisition, NAICS, PSC,
  contract type, competition, estimated value) and from the stored SAM.gov
  entity check (legal name, UEI, CAGE). The IGCE and quote are read from the
  intake answers in `nf1707_answers`; the estimated value backs the IGCE when
  the requester recorded no separate figure. Nothing is invented.
- `src/lib/sam-contract-awards.functions.ts` is the `sam_contract_awards`
  handler: authenticated, restricted to contracting, reviewer, and HQ roles,
  reads `SAM_GOV_API_KEY` from the server secret store (presence and length
  are logged, never the value), and searches by the record's NAICS, PSC, and
  a dollar range from half to double the estimated value, up to ten awards.
  Each run stores the raw response and the normalized view in `sam_checks`
  under check type `Contract awards comparables` and writes an audit entry.
- Deviation, recorded per the stack rules: SAM.gov answers the contract
  awards paths with HTTP 404 for a public API key (the same key returns 200
  on entity management and opportunities), so the demo path shows the
  clearly labeled `Sample data, fictional prior awards` rows. A cached live
  response is preferred over the sample whenever one exists, and the source
  label on the table always says which of the three was used.
- Verified on A-2027-0102: record and vendor fields pre-filled, comparables
  ran and wrote the summary into the memorandum, and Export .docx produced
  `pnm-A-2027-0102.docx`.

## D3. Check-out label and NF 1707 question text

- New table `document_checkouts` (acquisition, template, user, checked out at,
  released at) with one active check-out per document. Any signed-in user may
  clear a check-out older than thirty minutes; before that only its owner can.
- Opening a document as a writer claims the check-out. Everyone else sees
  "Checked out by [name] since [time]" and reads the fields read-only until the
  holder saves or closes the document, or thirty minutes pass. No stronger
  locking: the label refreshes every ten seconds and on page reload.
- Audit entries on check-out, on release (saved, closed) and on a lapse.
- NF 1707 labels: the export leaves `items=['1','0','2']` in the caption of every
  check button, so `fieldLabel` now falls back to the nearest form text (the real
  question) and only then to a humanized field name, so raw names such as
  `S3s3n1` no longer appear on the intake page.

## D4. Regulation sidebar

- `src/lib/regulation-sidebar.ts` selects rows, nothing is generated. A
  `regulatory_refs` row applies to a phase when `applies_to_phase` names it,
  when its `far_part`/`nfs_part` matches a part the phase citation cites
  (parsed from `PHASE_CITATIONS`), or when it is scoped `all` (labelled
  "Applies to every phase"). Sorted phase-specific first, then newest
  effective date first.
- Thresholds at the top: the core three (micro-purchase, simplified
  acquisition threshold, commercial simplified ceiling) plus the rows the
  phase bears on, matched on name and citation. Superseded rows are omitted;
  conflict notes are shown as written.
- `src/components/regulation-sidebar.tsx` renders a collapsible right-hand
  aside. On a template it follows the template's phase; on the acquisition
  file it starts at the current phase with a phase selector.
- Verified: JOFOC shows PCD 25-10 (FAR Part 6 / NFS 1806, binding) and the
  NFS Companion Guide (guidance); the Award phase shows FAR 6.301 posting and
  both CICA stay rows.

## D5. NEAR export bundle

- `src/lib/near-export.ts` builds a zip in the browser (jszip) for one acquisition:
  `index.html`, one page per saved document version under `documents/`, the SAM.gov
  check responses, the comments and poll votes, the audit log, and the NF 1707 as filed.
- Document pages are ordered by NF 1098 tab (numeric rank; untabbed last), then template
  name, then version, and each file name carries the tab. Values render through the
  template engine when the template is live, otherwise as field/value rows.
- Every page carries the acquisition ID and the export timestamp in the header and the
  prototype footer.
- The action sits on the acquisition file page ("Export file for NEAR") and writes one
  audit entry with the file name and the counts included.
- Verified on A-2027-0102: index lists the JOFOC versions, the TER, the SAM.gov checks
  and the audit log in tab order. Temporary test documents and audit rows were removed.

## Days returned to missions

- The Acquisitions tab on the Executive Overview shows a "Days returned to missions"
  counter: the sum of each launched file's planned-minus-actual days (the same
  timeSavedDays figure shown on mission rows) over files launched this quarter,
  grouped by Center, with the method stated in one line above the figure.
- Quarter membership follows the existing "Launched this quarter" rule: target
  award date between the quarter start and today. Completed phases record actual
  equal to planned, so the counter is 0 until phase actuals diverge from plan;
  it then shows days ahead of or behind plan per Center.
- Verified: ARC shows 0 ahead of plan for A-2027-0112 (launched 2026-09-01),
  matching the sum of time_saved_days on launched files this quarter.

## E1. Protest window clock

- `src/lib/protest-window.ts` computes the GAO filing deadline and the CICA stay
  deadline from the award date and the debriefing date. Day counts are read from
  the `thresholds` rows (4 CFR 21.2(a)(2); 31 U.S.C. 3553(d)(4) award and
  debriefing rows), never hard-coded.
- The award date is the date of the "Launched" audit entry, falling back to the
  target award date when a seeded file was launched before the log existed.
- New column `acquisition_facts.debriefing_date`. The contracting officer enters
  it on the Award phase; each change writes an audit entry and moves the CICA
  date to 5 days after the debriefing (10 days after award when blank).
- The panel appears on the Award phase only once the file is Launched, shows the
  citations and notes from the threshold rows, and links to the Watch items
  filtered to the "Bid protest" tag (`/watch?tag=Bid protest`).

## E2. Determinations library

Eight new live templates in `src/lib/template-engine.ts`, each pre-filled from
the acquisition record, with conditional sections, a version badge carrying the
HQ effective date from templates.csv, DOCX/PDF export, versioned saves, and an
audit entry (all handled by the existing document page):

- Commerciality Determination and Findings (FAR 2.101, 10.002(e), 12.102).
  Not in templates.csv and no HQ template exists in the NF 1098 list, so the row
  was added with tab N/A and the badge states "T-Minus form; no HQ template
  issued". Conditional sections on COTS, catalog pricing, and a noncommercial
  conclusion.
- Fair Opportunity Exception - Brand Name Justification, tab 072, 4/10/2026.
  Brand name section shows only when the order specifies a brand name; urgency
  and logical follow-on fields show on those exceptions.
- Option Justification, tab 024, 7/21/2026 (FAR 17.202, 17.205(a)).
- Option Exercise Determination, tab 24, 7/21/2026 (FAR 17.207(c),(d),(f)),
  with the preliminary-notification block.
- Option Exercise Contractor Preliminary Notification, tab 072, 7/21/2026.
- Determination and Findings for Consolidation of Requirements, tab 002,
  4/21/2026, and for Bundled Requirements, tab 002, 4/21/2026. Shared section
  builder; bundling adds the FAR 7.107-4 substantial-bundling field.
- Determination and Findings Interagency Acquisitions Economy Act, tab 003,
  4/21/2026; the interagency agreement field shows on assisted acquisitions.
- Determination and Findings Commercial Time and Materials or Labor Hour
  Contract / Order, tab 003, 4/20/2026 (FAR 12.207(b), 16.601(d)).

`phaseForTemplate` maps the commerciality, fair opportunity, consolidation,
bundling, Economy Act, and commercial T&M/LH forms to Market Research, the
option justification to Solicitation/Quote, and both option-exercise documents
to Administration, so the regulation sidebar and poll board follow the phase.
templates.csv and the templates table now mark these rows live with their
governing citations. Verified: all nine open on A-2027-0101 with the record
fields filled and the badge showing the HQ effective date.

## E3. Post-award modules

- New `acquisition_facts.post_award` jsonb block holds the option notice and exercise dates, COR appointment and cancellation dates, the CPARS entry date, the NASA closeout requisition number, and the final payment date. Every change writes an audit entry with phase Administration or Closeout.
- `src/lib/post-award.ts`: option schedule (base period from the recorded period of performance, or one year from the award date when none is recorded; option years follow it; preliminary notice due 60 days before each option period, FAR 52.217-9 fill-in), CPARS view (applies above the CPARS threshold row; period is the twelve months after award, input due 120 days after that period ends), retention view (years read from a new thresholds row), FAR 4.804-5 closeout checklist, and the SF 30 clause delta computed from the disposition/status recorded in the clause matrices.
- New thresholds row "Contract file records retention after final payment (years)" = 6, FAR 4.805 Table 4-1, added to the database and to `t-minus-seed/thresholds.csv` so a demo reset keeps it.
- Four templates marked live and defined: COR appointment and COR cancellation (tab 074, HQ 5/22/2026), CPARS Input (tab 099, HQ 4/21/2026), Closeout Transfer Checklist (HQ 6/10/2026). Option exercise notice and determination were already live from E2.
- Administration phase now shows the option-exercise panel with the option-year dates and an SF 30 handoff packet for the modification, the COR panel, the CPARS panel with the computed due date, and the SF 30 clause delta with its packet. Closeout shows the checklist, the NASA closeout PR field, the final payment date, and the computed records retention date.
- Verified: A-2027-0112 (launched) shows the checklist and a retention date of 2032-09-01 from the 2026-09-01 award; A-2027-0111 shows option period 1 starting 2028-02-24 with the preliminary notice due 2027-12-26.

## E4. Directive compliance tracker

- Two new fields on `acquisition_facts`: `right_to_repair_statement` (boolean) and `restrictive_clause_review` (not reviewed, reviewed, modified). Both are read straight from the record; nothing is generated.
- New page `/directives` lists every file where `hardware_deliverable` is true, with the acquisition ID (linked to the file), title, Center, phase, statement state, and clause review status, plus filters on both answers and an "Export to CSV" action. The export carries the directive citation and the export timestamp on every row and writes an audit entry.
- The same two fields appear on the file page under "Directive compliance", along with a hardware-deliverable switch so a buy can be marked as hardware. Each change writes an audit entry with the reason "OP memo, March 17, 2026". If the signed-in role cannot write, the page now says so instead of appearing to save.
- A-2027-0105 carries the seeded note "Hardware deliverable; right-to-repair statement included"; the seed loader never mapped it to columns, so `hardware_deliverable` and `right_to_repair_statement` are now set true for that record in the database and in `t-minus-seed/acquisitions.json`, with the clause review starting at not reviewed. No other record was changed.
- Verified: A-2027-0105 appears on the tracker as attached / not reviewed; setting the review to reviewed as the contracting specialist re-exports the CSV with "reviewed"; the record was restored to not reviewed and test audit rows were removed.

## E5. Report a template defect

- New table `public.template_defects`: template key and name, the revision shown on the badge, the citation, the defect wording, an optional correction, status (open, corrected, reported to PGPD, closed), the acquisition it was seen on, and the reporter's name and role. Everyone signed in can read and report; specialists and HQ can change status or remove an item.
- `src/components/defect-report.tsx` adds a "Report a template defect" button to every template, both on the filled document and on the choose-an-acquisition page. It captures the defect and citation, prefills the citation from the template badge, and writes one audit entry per report.
- New page `/pgpd-queue`, in the rail for HQ only, lists the queue newest first with filters by status, a status control, and a Remove action; status changes and removals are audited.
- Seeded with the three JOFOC citation defects already corrected and reported to PGPD (FAR 6.1030 to FAR 6.103; six areas to eleven items at FAR 6.104-1(a)(1)-(a)(11); Subpart 5.2 and "synopsized" to Subpart 5.1 and "publicized"). They carry fixed identifiers, load through `reloadSeed`, and are cleared and restored by the HQ demo reset.
- Verified: a test defect reported on the Technical Evaluation Report as the specialist appeared on the queue as HQ (4 reported, 1 open) and removing it returned the queue to the three seeded items; test audit rows were deleted.

## E6. Small business panel with subawards

- New Small business panel on the Executive Overview's Acquisitions tab, computed from the seed: set-aside rate (files with a small business set-aside over all files), awards to small business by Center (launched files with a set-aside, count and recorded value), and files above the subcontracting plan threshold with no plan or waiver on file.
- The threshold is read from the `thresholds` row "Subcontracting plan" ($900,000, RFO FAR 19.702) rather than hard-coded; set-aside files are excluded because the plan requirement falls on other-than-small primes. With the seed, three files are listed: A-2027-0109, A-2027-0107, A-2027-0105.
- `src/lib/small-business.ts` holds the computation and the plan-on-file lookup, which matches documents written from a subcontracting plan template.
- New server handler `fetch_subawards` (`src/lib/sam-subawards.functions.ts`) calls the SAM.gov Acquisition Subaward Reporting Public API for a NAICS code and returns prime, buying agency, subcontractor, place, amount, date, and work. Raw responses are cached in `sam_checks` under "Subaward market research <NAICS>" and each run writes an audit entry. On failure it falls back to the newest cached live response, then to a clearly labeled fictional sample.
- Verified for NAICS 481219: `api.sam.gov` answered 404 Page Not Found for the public subaward search path (the same behaviour as the contract awards endpoint on this key), so the view showed four labeled sample subaward relationships. Test check and audit rows were removed afterwards.

## E6a. Nightly exclusions sweep

- `src/lib/exclusions-sweep.server.ts` holds the sweep: every open file (clock state other than launched or scrubbed) with a vendor of record is checked against the SAM.gov entity exclusion flag, one `sam_checks` row is written per vendor, and each run writes one `Exclusions sweep` audit entry. Demo UEIs (prefix `DEMO`) use a clearly labeled fictional sample so the demo never depends on the network; a live failure falls back to the newest cached response, then to the sample.
- A vendor with an exclusion puts its file on hold with `hold_reason` "vendor excluded; CO review" and the contracting officer as `hold_owner`, plus its own audit entry.
- Same deviation as B5/B11: this stack runs server functions and server routes, not Edge Functions. HQ runs it on demand through `runExclusionsSweepNow` (`src/lib/exclusions-sweep.functions.ts`); the schedule calls `POST /api/public/hooks/exclusions-sweep` guarded by the `WATCH_CRON_SECRET` bearer token. pg_cron job `exclusions-sweep-nightly` runs at 06:30 UTC daily.
- The Executive Overview Acquisitions tab shows the last sweep time and result (`src/components/exclusions-sweep-panel.tsx`), with the run button for HQ only.
- Verified: on-demand run as HQ produced one vendor check for A-2027-0102 (Meridian Flight Sciences, DEMOMFS00001), labeled "Sample data, fictional vendor", no exclusion, no hold.

## E7. Deviation and waiver routing

- `deviation_requests` and `deviation_votes` tables hold each request and its three votes, so a deviation can stand alone (no acquisition) or hang off one.
- `src/lib/deviations.ts` holds the template metadata (NF 1098 tab 33, HQ effective 4/27/2026, guidance tier, FAR 1.402/1.403/1.404 and NFS 1801.4), the three reviewers (legal 5 days, policy 5, HCA 7), the clock reading and the poll board.
- `/deviations` lists requests with their clock and state and carries the request form; `/deviations/$deviationId` shows the clock line, the request, the legal/policy/HCA poll with Go/No-go (a No-go needs a reason), the HCA decision and a delete action.
- Start the clock sets the decision date 17 days out (the sum of the reviewer days) and opens the three votes with staggered due dates.
- Every create, clock start, vote, decision and delete writes an audit entry with phase "Deviation request".
- `templates.csv` row for tab 33 is now `live` and the catalog links it to `/deviations`.
- Reviewer days are constants in `deviations.ts` rather than table rows; `review_rules.csv` carries no deviation rows to read from.

## E9. Ask T-Minus

- `src/lib/ask.functions.ts` — authenticated server function `askTMinus`. It
  loads the regulatory references (FAR, NFS, PCDs, the NFS Companion Guide,
  PICs and PNs), the current thresholds, the review rules and the templates
  list from the tables, turns each row into a labelled reference line, and asks
  the gateway model `openai/gpt-6-astra` to answer strictly from those lines,
  returning JSON with an answer and citations.
- No answer without a citation: returned citations are matched back against the
  rows actually loaded. If nothing matches, or the model returns no citations,
  the box says so instead of showing an answer. Citations the model invents
  cannot appear, because only matched rows are rendered.
- `src/components/ask-tminus.tsx` — the question box, mounted in the header of
  `src/components/app-shell.tsx`, so it is on every page. The answer carries the
  "AI draft, not yet reviewed" label, the model name and time, and each source
  with its tier (binding or guidance), kind, origin and effective date, linked
  where the row has a URL.
- Thresholds render day counts as days and dollar figures as dollars.
- Check: "when must a JOFOC be posted after award" returns the 14-day posting
  answer citing RFO FAR 6.301 (formerly 6.305), tier binding, effective
  2026-03-01, with the 30-day urgency and minimum posting period noted.

## E10. Successor clock

- `src/lib/successor.ts` computes, for every launched file with a period of
  performance end, the date its successor must start: the end date less the
  summed `phase_plan.planned_days` for that acquisition type (all phases of the
  plan, as written in the prompt). Nothing is hard-coded.
- `acquisition_facts.successor_of` links a new file to the one it replaces; the
  intake has a "Successor of" field listing existing files.
- The Executive Overview Acquisitions tab shows a Successor clock panel with the
  count of launched files past their successor start date with nothing linked,
  and a table of end date, planned days, start-by date, linked successor, and
  standing. The acquisition file shows the same line.
- The seeds record no period of performance end for the two launched files, so a
  launched file without one shows a control for the CO to record it; the entry
  is audited and the clock computes from it. Nothing was invented in the seed.

## E11. Aging holds and escalation

- `centers.aging_threshold_days` (default 5) is the Center-configured window;
  `users.supervisor_name` / `supervisor_email` name the supervisor a digest entry
  goes to; `acquisition_facts.hold_started_at` and `polls.opened_at` give each
  hold and each pending poll its age. Existing holds were backfilled from the
  audit log.
- `src/lib/aging.ts` computes each item's age, whether it is aging (age at or
  past the Center's window), counts by Center, and the digest grouped by
  supervisor. A hold owner who is not a user record escalates to the file's
  contracting officer's supervisor.
- `/escalations` lists open holds and pending polls with age, owner and standing,
  shows the supervisor digest, and lets HQ set each Center's window (Center
  policy); the change is audited. The Executive Overview Acquisitions tab shows
  aging counts by Center, and the file's clock line shows the hold's age.
- Checked by setting every Center's window to 0 days: both on-hold files read
  Aging and appeared in the digest; the window was set back to 5.

## E13. Leadership digest

- `src/lib/digest.ts` builds the weekly digest from the same computed metrics
  and aging items the Executive Overview reads: launched this week (Monday to
  today), at risk, aging holds, holds by reason within each Center, days
  returned to missions this quarter, and the running/on hold/launched/scrubbed
  counts. No text in the digest is editable.
- `/digest` renders it, exports it to PDF through the print dialog on white,
  and lets HQ post it as an announcement (body generated from the same lines);
  the send is audited.
- Checked against the Acquisitions tab: running 5, on hold 5, launched this
  quarter 1, scrubbed 0, days returned 0 (ARC), and the same holds-by-reason
  counts.

## E14. NF 1098 file index
- `src/lib/file-index.ts` builds the contract file index from saved documents, keyed on each template's NF 1098 tab.
- Required tabs are derived, not hard-coded: core tabbed records (JOFOC 015, Technical Evaluation Report 054, PNM 065, COR appointment 074, CPARS input 099) whose phase appears in the acquisition type's phase plan sequence.
- The index appears on every acquisition file (tabs present with version counts, then required tabs with no document) and in the NEAR export index page.
- Fixed `phaseForTemplate` to recognise the actual `technical-evaluation-report` template key.

## E16. Agency backfill from Contract Awards

- `src/lib/agency-backfill.functions.ts` (`agencyBackfill`, HQ only) calls the SAM.gov
  Contract Awards API by agency code for a date range with `includeSections=nasaSpecific`,
  reading `SAM_GOV_API_KEY` server-side (presence and length logged, never the value).
- Awards land in `acquisition_facts` as post-award records: `current_phase` Administration,
  `clock_state` launched, `status` Launched, `source_tag` "backfilled", raw award kept in
  `backfill_source`. New columns: `contract_number` (partial unique index), `source_tag`,
  `backfill_source`. De-duplication is by contract number.
- The public contract awards endpoint still answers 404 for this key, so the run falls back to
  two clearly labeled fictional NASA awards ("Sample data, fictional NASA awards").
- Files and global search show the "Backfilled" tag and the contract number; the demo reset
  now deletes only untagged non-seed acquisitions, so backfilled records survive a reset.
- Test run: agency 080, 2026-06-01 to 2026-06-30 — 2 records added, re-run added 0 (2 already
  on file), and both remained after a demo reset (14 files total).

## E17. Reporting views and Center configuration

Five read-only views, all `security_invoker = on` so the existing row-level
rules still apply: `v_report_missions`, `v_report_acquisitions` (days to award,
days to need, planned days to award, forecast delivery, schedule impact against
the mission milestone, hold age, open polls, audit entries, status word),
`v_report_holds`, `v_report_polls`, `v_report_audit_counts`.

The status word in the view mirrors the application rule except the "behind the
planned phase exit" case, which needs per-phase actuals that the view does not
carry; that refinement stays in `src/lib/metrics.ts`. The view returns 14 rows:
the twelve seeded acquisitions plus the two backfilled records from E16.

Nightly extract: `src/routes/api/public/hooks/reporting-extract.ts`. A GET with
the extract token returns one view as CSV for Power BI; the nightly POST
(`reporting-extract-nightly`, 06:45 UTC) writes one audit entry per view with its
row count. `/reporting` lists the views, their counts, a preview, and a CSV
download.

Center configuration (`/center-config`, HQ and contracting specialists/officers)
writes `public.center_overrides`: Center, kind (threshold or review trigger),
target, value, citation, note, effective date, superseded date. The rules engine
reads the row in effect today for the acquisition's Center in
`reviewApplies`; a Center trigger replaces the seeded dollar figure and a Center
threshold override replaces the thresholds row. Every set and end is logged.

Verified: `v_report_acquisitions` returns the acquisitions with their metrics; a
$5,000,000 legal review trigger at ARC removed legal review from A-2027-0101's
Go/No-go poll while GSFC's A-2027-0107 kept it; the test override was removed.

## E18. HQ regulatory data intake

`/reg-intake`, HQ only (read-only sentence for every other role). HQ picks what
is in the file — template list, thresholds, PCD list and regulatory references,
clause matrix 26-03B, or the NFS clause matrix — uploads the comma separated
file, and sets the effective date of the change.

The file is read exactly as written; nothing is filled in for it. Rows are
matched to what is loaded on a natural key (tab and name for templates, name and
effective date for thresholds, citation and phase for references, clause number
and title for the matrices), and the difference names the row, the column, the
value loaded now, and the value in the file. Rows only in the file are new; rows
only in the table are shown as no longer in the file.

Apply writes the difference row by row, logs one summary entry plus one entry per
changed field (capped at 200 rows of detail), and posts an announcement
summarizing the change with its effective date and the file it came from.

Verified: uploaded templates.csv with the Consolidation of Requirements date
moved from 4/21/2026 to 5/21/2026; the page showed 0 added, 1 changed, 0 removed,
98 unchanged; applying it posted "Regulatory data updated: Template list." The
test change, its notice, and its log entries were removed afterwards.

## E19. Policy impact simulator

`/simulate`, open to executives and HQ, read-only for everyone else. Pick a
threshold or a review rule trigger, type a proposed dollar value, and run it.
Nothing is written; the page re-runs the same review rules and phase plan the
engine already uses, once against the values loaded today and once against the
proposed value.

Planned days for a file are the phase plan days through award for its
acquisition type plus the planned days of every review rule that applies, so
the difference is the planned days of the review steps that appear or
disappear. Only active files count; launched and scrubbed files are left out. A
proposed review trigger is read as if every Center carried it.

The answer reads "If the legal review trigger were $1,000,000, 1 file clears 5
days sooner," with the affected files listed: file, Center, estimated value,
planned days now and then, the difference, and which review steps are lost or
gained.

Verified: raising the legal review trigger to $1,000,000, above the simplified
acquisition threshold, dropped legal review from A-2027-0106 (JSC, $380,000),
113 planned days down to 108. Sole-source files keep legal review because the
rule also triggers on a JOFOC, and files under the trigger never carried it.

## E21. Acquisition Forecast as a byproduct

- Every file above the simplified acquisition threshold (read from `thresholds`, not hard-coded) shows an NFS 1807.72 Acquisition Forecast entry built from the record: title, estimated value range, NAICS, PSC, anticipated award date, competition, set-aside, place of performance (standardized value when accepted).
- The published value bands ($350K–$1M, $1M–$5M, $5M–$10M, $10M–$50M, $50M–$100M, over $100M) are a T-Minus display choice; no band table exists in the seeds.
- "Export forecast entry to CSV" writes the forecast's column format and logs an audit entry.
- When the entry exists, the NF 1707 forecast affirmation (`acquisition_forecast_verified`) is set true by a specialist or HQ viewing the file, with one audit entry.
- Verified: A-2027-0101 shows the entry ($1 million to $5 million, NAICS 481219, award 2027-03-01); A-2027-0103 ($42,000) shows no entry.

## E23. Public scorecard

`/scorecard` is readable without signing in. `src/lib/scorecard.functions.ts`
runs server-side and returns aggregates only: median days to award overall and
by acquisition method, competition rate, small business set-aside share, holds
grouped into generalised reasons, and files launched this quarter. It never
returns an acquisition id, title, requester, vendor, or dollar amount, and hold
reasons are bucketed rather than shown verbatim. Categories with fewer than
three records are folded into "Other categories combined" so one file cannot be
read out of a group; no dollar value is published at all, which satisfies the
$1M floor. Days to award are measured from the recorded regulatory clock start
to the award date. The page is labelled as fictional prototype data and carries
the prototype footer.

## E25. Center scoreboard
A Centers tab on the Executive Overview (`src/components/centers-tab.tsx`). All figures are
computed from the files: lead time by phase by Center from recorded phase actuals against the
phase plan, holds by reason by Center from each file's hold reason, template currency (a saved
document counts as behind when its template's HQ revision date is later than the document's save
date), and aging counts from `agingByCenter`. Centers with no files still appear with "No recorded
time" rather than an invented figure. Verified: ARC, GSFC, JSC and MSFC show computed figures;
KSC has no files loaded.

## E24. Set-aside evidence assistant
Verified on A-2027-0101: SAM.gov returned live entities for NAICS 481219 in CA; the SBA size
status is read from `assertions.goodsAndServices.naicsList[].sbaSmallBusiness` ("Y" small,
"E" small under a NAICS exception, "N" other than small). Nine small businesses found, Rule of
Two met (FAR 19.502-2). The subaward endpoint returned 404, so labelled fictional subawards were
shown. Test rows were removed after the check.
