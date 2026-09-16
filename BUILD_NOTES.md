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

## E26. Teams bot (production path)
- Added a card on the Executive Overview Enterprise tab describing the production Microsoft Teams bot as planned (not built).
- The card includes a description of the production behavior (mention bot with a PR number, answers with clock line/status/owner/file link, reads the same role-based data as the Overview, nothing stored in Teams) and a mock transcript using sample acquisition A-2027-0101 (PR 4200999101).
- Marked with a "Planned" badge.
- Verified: card renders, Planned badge present, mock transcript references PR 4200999101 and A-2027-0101.

## E27. Clause change impact list

- New page "Clause changes" (`/clause-changes`) and `src/lib/clause-impact.ts`. The change list is read, never authored: clause rows whose disposition is Removed or Moved (52.247-26 is the one Removed row in the seeded matrix, "removed by RFO (PCD 26-03B)"), plus Watch items tagged "clause change" that name a clause number, which cover a newly required clause. HQ regulatory data intake writes the clauses table, so a new PCD upload flows straight into this list.
- The deadline shown is the date the change itself sets (its effective date, or the recorded update date when no effective date exists); a date already past is marked "already due". Nothing is hard-coded.
- Affected contracts are launched or active files (running, hold, launched), sorted by months of performance remaining, files with no recorded end date last. New column `acquisition_facts.contract_clauses` (jsonb array of clause numbers) holds a stored clause list; the seeded files have none, so they read "clause list not in T-Minus; pull from NCMS" — the exact wording asked for — and still appear so the CO can check them against NCMS.
- "Create mod tasks on every affected file" writes one `clause_mod_tasks` row per file with the CO as owner and the change's deadline, and one audit entry each. Marking a mod complete is audited too. Tasks also show on the acquisition file page.
- "SF 30 handoff packet" builds the existing modification packet with the clause delta for that clause. NCMS remains the modification of record (NFS CG 1804.11).
- Mods done against mods due, by Center, appears on the Executive Overview Acquisitions tab and at the foot of the clause change page.
- Check: 52.247-26 (Removed) listed 14 launched or active contracts; creating tasks produced 14, and completing one moved ARC to "1 done of 7 due". Test tasks and their audit rows were removed afterward.

## Feature status

The About page reads this list at build time. Keep the format
`- status | name | one line`, where status is live, next, planned, or not built.

<!-- feature-status:start -->
- live | Executive Overview (Mission Clock) | Priority projects, statuses, blockers, callouts, Centers and Enterprise tabs.
- live | Work Queue | Five-column board and list view for the team, with filters.
- live | Intake (NF 1707) | The form, validation, red flags, the estimate, and Start the clock.
- live | The acquisition file | Launch sequence, polls, holds, thresholds, NCMS handoff, contract file index.
- live | Template engine | Versioned HTML forms with binding, exports, defect reporting, and the regulation sidebar.
- live | Checks | SAM.gov entity, exclusions sweep, set-aside evidence, comparables.
- live | Audit log | Every action, with actor and phase filters.
- live | Watch | GAO decisions, Federal Register, and regulatory references.
- live | Announcements and leadership digest | HQ notices and the weekly digest.
- live | Clause change impact list | Affected contracts, mod tasks, SF 30 handoff packets.
- live | Reporting views and Center configuration | Read-only views, nightly extracts, Center overrides.
- next | Estimate | The level-of-effort estimator as its own page for the team.
- next | Ask T-Minus citations | Widening the answer set to the full Companion Guide text.
- planned | Teams bot | "@T-Minus where is PR 4200999101" in Microsoft Teams.
- planned | NCMS write-back | Sending the handoff packet into NCMS rather than downloading it.
- not built | Solicitation and contract authoring | NCMS remains the document of record (NFS CG 1804.11).
- not built | Payments, invoicing, and property | Handled by the systems of record.
<!-- feature-status:end -->

## E28. About page, sources, build stamp, feedback

- `/about`, linked from the footer on every page, so any role can reach it. Sections: what T-Minus is and is not; what is built; data sources and their dates; live feeds; the build stamp; send feedback.
- "What is built" is generated: the four status groups come from the feature list kept above in this file between the `feature-status` markers (read at build time from BUILD_NOTES.md), and the live forms list comes from the templates table with each form's NF 1098 tab, HQ revision date, and governing citation. Forms carried in the list but not yet built are counted, not invented.
- Data sources show the seed dates (NFS interim July 23, 2026; Companion Guide August 5, 2026; PCD 26-03B clause matrix June 25, 2026; NFS applicability matrix July 23, 2026; OP template list September 10, 2026; thresholds verified September 11, 2026) followed by the regulatory_refs rows with tier, source, and effective date, newest first.
- Build stamp: `__BUILD_STAMP__` is defined in `vite.config.ts` at build time, so it is the date and time of the current deploy, not page load.
- "Send feedback" writes a `template_defects` row with template key `feedback`, the reporter's name and role, and the build stamp as the revision, plus the same audit entry a defect report writes. It lands on the HQ PGPD queue unchanged.
- Executive Overview shows "Computed at [time]" under the Mission Clock panel, set in an effect on load so server and browser render the same first pass.
- Check: opened About from the footer as the requester, all sections present; test feedback appeared on the HQ queue as "T-Minus feedback"; the test row and its audit entry were removed; the Overview shows the computed-at time.

## Signed-in session and role display (15 September 2026)

- A real session now ends only on a definite `SIGNED_OUT` event. Token
  refreshes and client-side navigations no longer null the session, so the
  sign-in screen cannot flash mid-browse.
- Profile and `user_roles` are read by account id and retried once. A failed
  read keeps the last known name and roles instead of falling back to a
  generic account.
- Roles are ordered administrator first; `profiles.is_admin` always adds the
  administrator role. The header shows the strongest role, never Contracting
  for an administrator.
- The display name comes from `profiles.display_name`, then the account
  metadata name, then the email local part. Seeded persona names are used only
  for anonymous demo sessions, which alone show the Demo badge.

**How to verify.** Sign in as the administrator account, then walk Executive
Overview, Files, Intake, Center configuration and Watch: the header name stays
"Joshua Taggart" and the first role chip stays "Administrator" on every page.
Hard refresh on any of those pages: still signed in, same name and chip, no
sign-in screen in between.

## Public data feeds, hardening pass (16 September 2026)

Every panel still shows whether what you see is a live result, a cached result
from the last successful call, or clearly labeled sample data. No sample
fallback was removed.

- **Contract awards (PNM comparables).** Now calls the Contract Awards API at
  `api.sam.gov/contract-awards/v1/search` with the NAICS code, the product or
  service code, and a dollar range around the estimated value. The reader takes
  the `awardSummary` records and still understands rows cached under the old
  shape.
- **Subawards (market research).** Calls
  `api.sam.gov/prod/contract/v1/subcontracts/search` first and falls back to
  the same path without `/prod` on a 404. The query carries `pageNumber=0`,
  `pageSize=100`, `status=Published` and a five-year `fromDate`/`toDate`
  window. That search has no NAICS parameter, so the requested code is matched
  client-side against the returned prime and subcontractor NAICS fields; the
  panel still shows at most 25 rows.
- **USAspending.** Retried up to three attempts with backoff of roughly
  500 ms, 1500 ms and 3500 ms (plus jitter) on HTTP 525, other 5xx responses,
  and network failures; a 429 gets one backoff retry, other 4xx responses are
  not retried. The outcome string is written into the research log
  ("Returned awards.", "Returned no awards under this code.", or a failure
  line naming the last status after 3 attempts), and a total failure leaves
  the awards list empty. No award is ever invented.
- **GSA CALC+.** The retired CALC v1 rates endpoint is gone. Ceiling rates now
  come from `api.gsa.gov/acquisition/calc/v3/api/ceilingrates/`, which needs no
  API key; a key is sent only if one is configured. CALC+ now runs for any
  services or labour requirement, not only FAR 8.4 buys, and the rate count is
  recorded in the research log.
- **Exclusions.** The nightly sweep calls the dedicated exclusions endpoint,
  `api.sam.gov/entity-information/v4/exclusions`, for every non-demo UEI. A
  vendor is excluded when the exclusions list is not empty. Demo UEIs keep the
  labeled sample path, and the entity registration exclusion flag remains a
  secondary signal on entity checks.
- **Product and service codes.** Intake can check a PSC against the SAM.gov
  Public PSC API and shows the official name. An unknown or retired code is
  warned about; if SAM.gov cannot be reached the code is still saveable with a
  note saying it was not confirmed.
- **Sample 3 wording.** A-2027-0103 is a cost-plus-fixed-fee Part 15 buy. The
  file header no longer calls it commercial, and the Synopsis, Solicitation,
  Technical Evaluation, Price Reasonableness and Award phases cite Part 15
  (FAR 5.203, 15.203, 15.305, 15.406-3, 15.504) instead of the simplified
  acquisition citations.
- **Sample 1 evaluation record.** A-2027-0101 now carries a saved Evaluation of
  Quotations Record with three fictional quoters, so the postaward letters fill
  from it: Corsair Aviation Services successful, Strategic Aviation Partners
  and SciFly Research Aviation unsuccessful.

## Security / RLS tightening (16 September 2026)

Four critical findings were closed with a single migration. Reads stay open to
signed-in users everywhere the demo lists these records; writes now require a
role check using the existing `private.*` helpers.

- **`center_overrides`** — select authenticated; insert/update/delete require
  `private.is_specialist() OR private.is_admin()`.
- **`deviation_requests`** — select authenticated; insert/update/delete require
  specialist/hq or administrator. **`deviation_votes`** — select authenticated;
  insert/delete specialist or administrator; update also allows the `reviewer`
  and `hq` roles so reviewers can record their own vote.
- **`document_attachments`** — select authenticated; insert for specialist,
  administrator or requester; update and delete limited to those roles or the
  uploader, and delete still refuses seeded rows. Storage bucket `attachments`
  mirrors this: read for authenticated, upload for specialist/administrator/
  requester, update by owner, delete by owner or specialist/administrator. The
  old "any signed-in user may delete any attachment" storage policy is gone.
- **`users`** — select stays authenticated for the Center config contact
  roster; insert and delete are administrator-only; update allows specialist,
  administrator, or the person's own row. `user_roles` was not touched.

## Overnight continue pack (16 September 2026)

- **CALC+ always logs.** The GSA CALC+ ceiling-rate step now runs on a wider
  services/labour reading (service PSC, FAR 8.4, and services keywords now
  including aviation, flight, charter, survey, inspection, training, repair,
  research). When it is not applicable it writes an explicit skip row to the
  research log instead of writing nothing. Zero-result runs still write a row
  with count 0. No rates are ever invented.
- **Batch 6 templates are live in launch sequences.** `HQ6`, `HQ6B`, and `HQ6C`
  template keys were missing from the live-template set, so their rows showed
  "Template planned; attach an external copy". They now open the drafted form.
  The postaward successful and unsuccessful notification letters prefill from
  the evaluation of quotations record (selected offeror plus one letter per
  unsuccessful offeror). No NCMS write-back.
- **Public UEI for the exclusions smoke test.** A-2026-0090 carries public SAM
  UEI `G1THVER8BNL4`, labelled "University of Mississippi (public SAM UEI for
  exclusions smoke test — not a DEMO vendor)". DEMO* vendors are unchanged.
- **Contract awards entitlement errors are visible.** When the live SAM.gov
  Contract Awards call fails, the comparables panel keeps its sample or cached
  label and adds a plain sentence naming the cause (401 key rejected, 403 key
  not entitled, 404 address, 429 rate limit, otherwise the status). Live,
  cached, and sample labels remain accurate; no live awards are invented and no
  FedRAMP claim is made.

## Market research run repair (16 September 2026)

- Empty orphan `research_runs` could hide the latest completed log and produce
  the incorrect “has not been run yet” message. Public-source work now finishes
  before the run is created, failed log persistence removes the new run, and
  reads ignore any incomplete historical runs.
- CALC+ always persists a count, zero-result, failure, or explicit skip row.
  CALC+ v3 Elasticsearch `hits` are parsed directly, service searches use a
  short matched keyword such as “aviation,” and public-source calls stop after
  18 seconds so a stalled source can be recorded as a failure.

## Sample 1 walk fixes, A-2027-0101 (16 September 2026)

- **Work Queue reads the same source of truth as the file.** `savedDocKeys`
  now recognises the generated forms (NF 1787, NF 1787A) the same way the file
  page does, so a saved form clears its Required row on the queue, the
  overview, the digest and the escalations list. Every state change on the file
  page (phase exit, launch, hold, scrub, research confirmation, document save,
  attachment) invalidates the `work-queue` query as well. The queue clock falls
  back to the need date when no target award date is recorded, so a running
  clock no longer reads "Clock not started".
- **JOFOC opens honestly on a competed file.** `jofocAuthorityDefault` returns
  nothing unless the record is sole source or brand name. On a competed file
  the authority rationale is a gap for the officer, the notice date stays
  empty, and the notice status reads "Not applicable — competitive
  acquisition". No notice of intent is invented.
- **Unsuccessful offeror letters map Offeror N to quoter N** on the evaluation
  of quotations record, so the label and the body name the same company. The
  letter opens on the first unsuccessful offeror instead of defaulting to
  Offeror 1. The successful letter also carries the contract number and the
  requisition already on the file; nothing is invented.
- **Handoff packet confirms its download.** The control reads "Download the
  handoff packet", states that this is a local file, and confirms the file name
  after the download. NCMS write-back is planned and not available in this
  prototype; no write-back is implemented or implied.
- **PNM draft/demo completeness.** On a competed file the negotiated price,
  technique, negotiation summary, determination and comparables summary open as
  clearly labelled draft text derived only from the recommended quotation and
  the estimate on the file. The draft states that no negotiation has been
  recorded, the determination date stays blank, and no award or rate is
  invented.
- **Security.** Storage reads on the attachments bucket are now scoped to files
  that belong to a document record. The broad authenticated SELECT on `users`
  is intentional: the fictional demo roster is the Center contact list the
  reviewer routing, poll boards and Center configuration read on every page.
  The remaining linter warning is the pre-existing anonymous-access notice.

## CoS refinement follow-up (16 September 2026)

- **Handoff packet download still works.** The control builds the packet from
  the record, downloads it as `ncms-handoff-<acquisition id>.json`, and then
  confirms the file name in the page banner. It is a real local file, not an
  aspirational control. NCMS write-back remains planned and not implemented,
  and no FedRAMP status is claimed.
- **Share links are no longer readable by everyone.** A document share row,
  including its link token and the recipient address, is readable only by the
  person who issued it and by contracting or administrator accounts.
- **Self-service privilege escalation closed.** Triggers on `profiles` and
  `users` hold `role`, `is_admin` and `warrant_limit` at their stored values
  unless the change is made by an administrator (HQ on profiles, contracting
  or administrator on users). Editing one's own name or telephone still works.
- **Left as intentional.** The broad authenticated read on `users` stays: the
  fictional roster is the Center contact list the poll boards, reviewer routing
  and Center configuration read. Attachment storage reads are already scoped to
  files linked to a document record; the remaining notice on that bucket is the
  pre-existing anonymous-access warning.

## Sample 2 smoke fixes, A-2027-0102 (16 September 2026)

- Solicitation/Quote seed: `funds_certified` true, proposed price $812,400 received
  2026-09-10. Fictional quote from Meridian Flight Sciences LLC, consistent with the
  $820,000 IGCE on the file. Not a live market rate.
- `docSatisfied` now reads "Funds certified for the period" from the record
  (31 U.S.C. 1502 certification), not from an attachment, the same way the proposed
  price row already read from the record. The seed loader no longer forces
  `funds_certified` to false; it still forces `igce_attached` and `sow_attached`
  to false because those are file flags.
- The acquisition file page carries a Mark funds certified / Withdraw control for
  that row, audited and recomputing the hold and clock like the price control.
- JOFOC item 4: the two FAR 12.102 commercial options now name the
  only-one-responsible-source basis under RFO FAR 6.103-1, matching
  competition_authorities.csv. Help text on the authority field explains the choice,
  and a warning shows when a sole-source action carries an authority that is not the
  only-one-responsible-source basis. Prefill defaults a sole-source file to the
  matching option when the stored citation is empty or is not one of the options.
  No new citations were invented and no tier changed.
- NCMS handoff packet: kept as a working local file download. Hardened with
  setAttribute("download") and appending the link to the page before the click so
  Chrome keeps `ncms-handoff-A-2027-0102.json`. No server route, no
  Content-Disposition, no NCMS write-back. No FedRAMP claim.
- Sample 2 JOFOC, export and packet path is done; the Solicitation seed is fixed.

## 16 Sep 2026 — A-2027-0102 funds-certified hold, root cause

- Traced every hold path: `computeHold` / `resolveHold` / `holdFromRecord`,
  `buildSequence` unfinished-row gate, Work Queue and Overview blockers, and the
  file-page required-row status. All of them read a row's state through the single
  `docSatisfied` helper, and every page selects the whole `acquisition_facts` row,
  so the column is always present in the record the helper reads.
- Root cause of the report: the running preview build already clears the hold —
  A-2027-0102 reads "Clock running, ready to exit Solicitation/Quote" with no hold
  and no missing funds row. The published site was still serving a build made
  before commit 5379a400, so the live page kept showing the old reason. The fix
  needed a publish, not another code path.
- Hardening kept: `docSatisfied` treats "Funds certified for the period" as a
  record certification under 31 U.S.C. 1502, accepting a true boolean or a true /
  yes / 1 value, and never lets a missing attachment override it — the same
  robustness the proposed-price row has. Live row verified unchanged:
  funds_certified true, proposed_price 812400 received 2026-09-10, hold fields null.
- No NCMS write-back. No FedRAMP claim. Demo persona list untouched. Security
  findings deferred.

## 16 Sep 2026 — JOFOC item 6 notice status (A-2027-0102)

- Item 6 of the justification now derives its notice line from the live state
  of the Synopsis SAM.gov notice plus the publication date on the form
  (`notice_date`), through one shared helper `jofocNoticeStatus`.
- Saving a notice is no longer treated as posting it. `NoticeFacts` carries
  `saved`/`savedAt` separately, and `postedOn` is read only from a real
  publication date on the saved notice's values.
- Three-way status: competitive reads not applicable; a publication date reads
  posted with the closing date; a saved notice with no publication date reads
  "Notice of intent saved as a draft; not yet posted to SAM.gov."; nothing on
  file reads "Notice of intent not yet posted." The stale "(Synopsis phase)"
  wording is gone.
- A stored JOFOC version no longer keeps a stale status line: the status (and
  the notice part of item 10) is recomputed when the document opens. No
  publication date is invented; a blank `notice_date` stays blank.
- The printed justification follows the same distinction.
- No NCMS write-back. No FedRAMP claim. Security deferred. Sample 3 unchanged.

## 16 Sep 2026 — A-2027-0104 IDIQ order Intake/FO seed

Fictional demo seed on order **A-2027-0104** (Snow depth flights, second
campaign, $640,000) under parent IDIQ **A-2026-0090** / contract
**80ARC26D0090**, applied directly to the live database:

- **Intake.** NF 1707 answers seeded, with attachment keys
  `acquisition_forecast_verified`, `igce_attached`, and `sow_attached` set
  true against stored demo attachment rows (reusing the Sample 1 demo files;
  fictional). Hold cleared, clock running, phase Intake. This is the one case
  where `igce_attached`/`sow_attached` are true in the seed: they are treated
  as satisfied only because the corresponding files exist as stored
  `document_attachments` rows — a demo reset that drops those rows would
  re-stick Intake, so the attachments must be preserved alongside this seed.
- **Scenario/vehicle.** `scenario.vehicle = idiq_order`,
  `scenario.parent_contract_number = 80ARC26D0090`,
  `vehicle.fair_opportunity = competed`.
- **Fair Opportunity.** Attach-only `fair-opportunity-record` stub plus a
  saved NF 1787 naming the three fictional parent awardees already on
  A-2026-0090 (DEMO* UEIs). No FPDS pull, no real market rates.
- **Progress.** Intake deps clear so Fair Opportunity can start. The furthest
  honest gate is Solicitation/Quote funds certification; PNM and the NCMS
  handoff remain ahead and are **not** claimed done. No NCMS write-back, no
  FedRAMP claims, no end-to-end modification flow implied.
- **Parent.** A-2026-0090 ceiling unchanged ($50M); order obligated $640,000.
  No parent ceiling math touched.
- **Seed file.** `t-minus-seed/acquisitions.json` A-2027-0104 row realigned to
  the live record (it previously still carried the stale lidar calibration row
  from before the ID collision fix), so a future demo reset restores this
  order rather than re-sticking Intake.
- Security findings deferred to the security triage pass.

## A-2027-0104 Solicitation/Quote funds-certification seed unblock (2026-09-16)

Mirrors the A-2027-0102 pattern (commits 5379a400 / a7121d14): live DB row
for order **A-2027-0104** already has `funds_certified = true`,
`proposed_price = 632800`, `proposed_price_received = 2026-09-12`, with
`hold_reason`/`hold_owner` null and `clock_state` running (phase Intake).

- **Seed.** `t-minus-seed/acquisitions.json` A-2027-0104 row updated to match:
  `funds_certified: true` (was `null`), `proposed_price: 632800`,
  `proposed_price_received: "2026-09-12"`, and the `note` now states the demo
  provenance (funds certified yes for PoP (sample); proposed price $632,800 is
  a fictional quote consistent with the $640,000 order / parent IDIQ estimate,
  not a live market rate). A future demo reset restores this state.
- **Scope.** Seed + BUILD_NOTES only. No launch-sequence, UI, auth, demo
  persona, or other acquisition-row changes. No FPDS, no modifications, no
  end-to-end award, no NCMS write-back, no FedRAMP claims. Fictional data only.
- **Remaining gates.** The furthest honest gate after this seed is Fair
  Opportunity / further Solicitation docs / PNM / NCMS handoff — those are
  **not** claimed done.
- Security findings deferred to the security triage pass.

## 16 Sep 2026 (America/Chicago) — Launched files can no longer display a pre-award current phase

**Bug.** Parent IDIQ A-2026-0090 (`clock_state=launched`, `current_phase=Administration`, status Awarded) showed a contradictory header: "Launched / 0 days since award" and "Complete Administration" alongside **Current phase — Intake**.

**Root cause.** `buildSequence` in `src/lib/launch-sequence.ts` pulled the displayed phase back to the earliest phase with an unfinished required row (`earliestOpen`). A-2026-0090 has no `igce_attached`/`sow_attached` and no NF 1707 answers, so Intake read as unfinished and overrode the recorded post-award phase. `computeMetrics` reads `currentPhase` from that sequence, so hero, strip and overview all inherited it.

**Fix (shared logic, one place).** When `clock_state` is `launched` or `scrubbed`, `buildSequence` no longer applies the `earliestOpen` pullback. It trusts `current_phase`; if that is missing, unmatched, or still a pre-Administration phase, it coerces the effective index to Administration (Closeout when that is the recorded phase). Pre-award files are unchanged. No change to `metrics.ts` was needed since it derives `currentPhase` from the sequence.

**Seed.** `t-minus-seed/acquisitions.json` now contains the parent IDIQ A-2026-0090 (launched, Administration, multiple-award vehicle profile, $50M ceiling, three DEMO* awardees, fictional). `t-minus-seed/phase_plan.csv` gained the `idiq_parent`, `order_under_idiq`, `bpa` and `fss_order` rows copied from the live `phase_plan` table so a demo reset no longer drops vehicle plans.

**Not in scope / not claimed.** A-2027-0104 Exit Confirm reason gating unchanged. Samples 1 and 2 untouched except through the shared sequence logic. No NCMS write-back, no FedRAMP, no FPDS integration. Security findings deferred.

## Sample 1/2 cold-path UX polish (15 Sep 2026 CT)

**Shipped.** The acquisition file now presents one primary next action, with status explanation, memo, export, sample copy, view switch, scrub, and manual launch in a quiet More menu. The clock line has a clearer days/status/phase/next hierarchy. Holds use a restrained left-border banner with one reason, owner and aging context, a direct Fix action, and FAR/Center-policy detail behind Why?. The launch sequence opens to past/now/next in both views, with the complete sequence behind Show full sequence. Required rows use “Needs …” language, and blocked phase exit points to the first required item or vote.

**Documents.** Save version remains the primary action; Word and PDF are grouped under Export. Provenance is summarized as Live, Sample, Draft, and Reviewed indicators with model/timestamp details disclosed on request. Required fields show inline “Needs …” guidance after interaction, and record/AI-drafted text carries a quiet confirmation hint.

**Deferred.** No lifecycle, gate, Sample 3/IDIQ, seed, work-queue, regulation-sidebar, or security/RLS changes. No NCMS write-back, FedRAMP, or FPDS capability is claimed. Security remains deferred.

## Part A follow-up — Sample 1/2 file overview (16 Sep 2026)

**Shipped.** The file clock line now uses fluid columns and a wrapping Next/More action row so actions remain visible without page overflow. A missing current required document shows Why? beside its action when its own row carries a citation. On A-2027-0101 and A-2027-0102 only, Regulations, Thresholds, and Audit trail start collapsed with phase or entry counts while preserving their full content on disclosure.

**Deferred.** No D1–D6 or clause-engine work, lifecycle changes, Sample 3/IDIQ behavior changes, seed changes, or security work. No NCMS write-back, FedRAMP, or FPDS capability is claimed.

## 16 Sep 2026 — D1 + D2 clause engine picker and hard rules

Shipped (D1): a clause picker on the file page's NCMS handoff block
(Solicitation/Quote and Award). It lists the clauses `selectPacketClauses`
derives from the record with the reason, UCF section, source, matrix status,
effective date, and fill-ins where the matrices carry them. "Apply to file"
writes the selected clause numbers to `acquisition_facts.contract_clauses`
and logs an `audit_log` entry (action "Clause list applied to the file",
field `contract_clauses`, old and new lists, phase). Once a list is applied,
the packet table and the downloaded handoff JSON show only the applied
clauses, so Apply feeds generation rather than ending in a list.

Shipped (D2): `sanitizeClauseSelection` in `src/lib/clause-packet.ts` is the
single write gate — a clause may be applied only if the record recommends it,
the PCD 26-03B / NFS 1852 matrices do not show it removed or deleted, and it
is not FAR 52.212-5. Removed clauses are not offered in the picker and are
named in a short "Removed under the RFO and not available" line.
FAR 52.212-5 is Reserved under the RFO and is never offered, recommended, or
applied. Clauses that formerly rode inside 52.212-5 now carry
`formerly_bundled` on the rule and are shown with "Prescribed on its own;
52.212-5 is Reserved" so the material is prescribed independently rather than
smuggled back under the reserved paragraph.

Deferred, unchanged this turn: D3 UCF and SF 1449 streamlined format builder
from `contract_format`; D4 solicitation builder (CLINs, instructions,
evaluation factors); D5 award / modification / order writing scaffolding with
matrix fill-ins beyond the existing packet and mod delta tables; D6 NFS
Companion gates as first-class exits.

No NCMS write-back, no FedRAMP claim, no FPDS. The packet stays a local file
and NCMS remains the contract writing system of record (NFS CG 1804.11).
Sample 3 / IDIQ logic untouched. Security findings remain deferred.
Verified on A-2027-0102: picker opens, Apply writes 22 clauses with no
52.212-5 and no removed rows. TypeScript clean.

## 16 Sep 2026 — Briefing book export stub

- Added `src/lib/briefing-book.ts` and an "Export briefing book" item in the file page More menu (secondary; it does not compete with the primary Next action).
- The pack is four printable pages built only from the record: cover, clock/next action/blocker, key facts (value, method, competition, set-aside, contract type, NAICS, place of performance, need date), and clause position (recommended count, applied count, three example clauses with reasons).
- Every page footer reads "Synthetic / Prototype — not an official NASA system" and adds "Sample data" when `is_seed` is set. The clause page repeats that NCMS is the system of record and the handoff packet is local.
- The export writes an audit_log row ("Briefing book exported"). No NCMS write-back, no FedRAMP, no FPDS, no real SAM publish. Fictional/sample data only; security deferred.
- Verified on A-2027-0101: menu item present, file downloads, four marked pages render cleanly when printed to PDF.

## 16 Sep 2026 — D3–D6 contract format, solicitation basics, award/mod fill-ins, Companion gates

Shipped in one chunk on top of D1+D2. No seed changes to A-2027-0101 or A-2027-0102, no new automatic holds.

- D3 — `src/lib/format-scaffold.ts` reads `acquisition_facts.contract_format` (falling back to the commercial determination) and builds either an SF 1449 streamlined scaffold or a Uniform Contract Format A–M scaffold. `src/components/format-scaffold-panel.tsx` renders it inside the existing Solicitation/Quote and Award handoff block, collapsed by default. UCF sections with no prescribed clause read "None prescribed from this record." The handoff JSON now carries `contract_format` and a `format_scaffold` object; it is still a local packet.
- D4 — The scaffold carries one primary CLIN drawn from the record (title/description, estimated value, unit framed by contract type) plus a labelled placeholder line where an IGCE is on the file; instructions to offerors from the commercial path (52.212-1 reason when the clause engine recommends it) with citations; evaluation factors from 52.212-2 with the clause reason when competed, and honest sole-source messaging (technical evaluation and the PNM, not competitive factors) when the record is sole source. No invented CLIN catalogue and no market rates.
- D5 — The Award handoff shows matrix fill-ins for applied clauses that carry them, and the SF 30 modification block now lists fill-ins on the updated clauses beside the delta table. Order-specific writing UI is deferred; the shared format scaffold is what an order sees today.
- D6 — `src/lib/companion-gates.ts` evaluates gates from the seeded `review_rules` rows through `reviewApplies`, plus TER (`isTerRequired`) and NF 1787 above the micro-purchase threshold. Each gate shows applies yes/no, the trigger and citation from the row, and an honest status of Satisfied / Open / Not applicable; with no evidence it reads "Not yet evidenced on this file." Gates are a checklist, never a hold engine.
- Verified in the demo: A-2027-0101 reads "2 gates apply, 1 open" (NF 1787 satisfied, aviation safety open; TER, CIO, NPA and ANOSCA correctly not applicable) and its SF 1449 scaffold fills from the record. A-2027-0102 reads "3 gates apply, 2 open" and shows the sole-source evaluation messaging. The clause picker, Apply path and JOFOC path are untouched.
- No NCMS write-back, no FedRAMP, no FPDS, no real SAM publish. Fictional/sample data only; security deferred.

## 16 Sep 2026 — Clause/solicitation writing accuracy and briefing book substance

Accuracy pass on the D3–D5 scaffolds plus a two-page briefing book extension. No seed changes to A-2027-0101 or A-2027-0102, no new holds, D1/D2 sanitize rules untouched.

Shipped
- `src/lib/format-scaffold.ts` now reads sole source through the shared `isSoleSourceRecord` helper instead of its own regex, so the scaffold agrees with the memo, NF 1787 and research paths.
- CLIN 0001 no longer invents a quantity or unit of issue ("1 Lot"/"Each"); it carries the record's description and estimated value and says the officer sets quantity, unit and price. The IGCE placeholder line is unchanged and still labelled.
- The SF 1449 "Delivery/acceptance" block only claims the statement of work carries it when a SOW is on the file; otherwise it reads "Not recorded".
- New clause table in the scaffold (both SF 1449 and UCF modes): clause number, title, UCF section, the engine's reason, and the matrix fill-in. Where the matrices carry no fill-in it reads "No fill-in recorded in the matrices." — no fabricated values. `fillInText` is the shared helper.
- The handoff JSON `format_scaffold` now carries the same clause list with reasons and fill-ins, so the local packet and the UI agree.
- `src/lib/briefing-book.ts` gained two pages: "Format and solicitation" (format, CLIN summary, instructions and evaluation lines with citations, from the same scaffold helper) and "Companion gates" (applicable gates only, with status, trigger, citation, and what the file shows). Six pages total, every one keeping the Synthetic / Prototype footer and the Sample mark; the export audit row is unchanged.

Verified in the demo: A-2027-0101 shows the competitive 52.212-1 / 52.212-2 path with reasons and no sole-source wording; A-2027-0102 keeps the sole-source evaluation wording with no 52.212-2 line. The exported pack is six marked pages with both new sections. FAR 52.212-5 appears only in the sentence saying it is Reserved.

Deferred: order-specific IDIQ/BPA writing screens, SEB suite / slide theater, SAM Awards entitlement, NCMS write-back, FedRAMP, security RLS finding.

## 16 Sep 2026 — Offered rows verified non-binding, research fix confirmed live, gate evidence from documents

Offered (optional) rows
- Audited every path that could make an offered row behave like a required one: the hero next action, the blocker on the metrics record, the hold cause, the phase-completion test that decides the current phase, the exit gate, and the exit dialog's missing list. All six already skip `optional` rows, so no behaviour change was needed; this round is the verification that closes the roadmap item rather than new code.
- Verified in the demo: A-2027-0101 shows two Offered rows and its blocker is the required price negotiation memorandum, not an offered row; A-2027-0102 shows two Offered rows and reads "Ready to exit Solicitation/Quote". Neither file gained a hold, and the No-go hold path on Sample 2 is untouched.

Market research persistence
- Confirmed the shipped fix is live rather than re-opening the architecture: the latest A-2027-0101 run (16 Sep 2026) carries ten log rows including "GSA CALC+ ceiling labour rates", alongside the SAM entity, SAM opportunities, SBA size standard, prior-actions and USAspending sources. Earlier runs retain their logs. No residual display bug was found, so nothing was changed.

Companion gate evidence
- `src/lib/companion-gates.ts`: gates that have a document of their own now read a saved or attached copy as evidence, the same way a recorded vote is. Notification of procurement action reads `npa-notification`, ANOSCA reads `anosca`, and the procurement strategy meeting reads the signature page, addendum, executive presentation or written acquisition plan. Gates without a document of their own (CIO/IT, Section 508, aviation safety) still read only the poll. Gates remain a checklist and still never place a hold.

Deferred: the fuller validated phase exit with linked requirements and audit beyond the offered-row rule, the confirmation-dialog rewrite, order-specific IDIQ/BPA screens, the SEB suite, SAM Awards entitlement, FOUO hierarchy, and the open security finding.

## 16 Sep 2026 — Validated phase exit

- Exit still runs only when every Required (non-Offered) row for the current phase is satisfied and every open review seat has voted. Offered rows continue to be excluded everywhere; the rule reuses `requiredDocs` and `docSatisfied`, so nothing new is invented.
- A refused exit now lists every missing Required row, not just the first, each linked to the document, form or launch-sequence row that satisfies it, with its citation underneath. Pending reviewer seats are listed the same way and link to the poll board.
- When exit is allowed, the dialog says how many required items are complete, and the successful exit audit row records them by name alongside who exited, the phase left and the phase entered.
- No new holds, no seed changes, and the Sample 2 JOFOC No-go hold path is untouched. No NCMS write-back, FedRAMP or SAM publish claims; security remains deferred.

## 16 Sep 2026 — In-page confirmations for every file action

- Audited the file page and the rest of the app for native browser confirmations: none remain. Exit, Scrub, Remove, Record vote and Open poll all run through the one in-page `actionDialog` pattern already on the file page; no new modal system was introduced.
- The confirm button now names the action it performs ("Exit Solicitation/Quote", "Scrub the acquisition", "Remove the file", "Record Go", "Record No-go", "Open the poll") instead of a generic Confirm, and reads as destructive for Scrub, Remove and a No-go vote.
- Reason fields say they are required and carry `required` / `aria-required`, so keyboard and screen-reader users learn the rule before the button refuses.
- Memorandum hold, vote and saved-version sentences were read again at these touch points and were already correct prose; nothing was rewritten, so that roadmap item stays open.
- Verification: TypeScript clean, Sample 1 and Sample 2 cold load with no console errors, and the validated-exit refusal links are unchanged. The exit dialog itself could not be opened under the read-only demo persona; the signed-in path is unchanged code. Sample 2's JOFOC No-go hold path, seeds and audit writes untouched.

## 16 Sep 2026 — RFO citation punch list

1. **NFS CG 1804.11 to NFS 1804.171 (fixed).** Every place that cited the Companion Guide as the binding authority for NCMS being the contract writing system of record now cites NFS 1804.171: phase citations and required-doc rows in `launch-sequence.ts`, the handoff packet note, the file page NCMS and modification copy, `post-award.ts` SF 30 packet note, `vehicles.ts` SF 30 row, `clause-impact.ts`, `clause-changes.tsx`, and the format-scaffold module and panel. The Companion Guide is still named elsewhere as guidance tier, which is correct; it is no longer the binding cite for NCMS-as-system-of-record.
2. **FAR 12.204(b)(1) no longer treated as the PNM mandate (fixed).** Price reasonableness now cites RFO FAR 12.204(a), with FAR 13.106-3 where simplified procedures apply: the Price Reasonableness phase citation, the PNM required-doc citation, the PNM badge and determination section in `template-engine.ts`, the sole-source format-scaffold line, and the file page PNM helper line. The "determination of record" wording was rewritten to say the memorandum records the finding, which is what the rule supports.
3. **52.212-3 dropped from the recommended commercial packet (fixed).** 52.212-5 is still never included. 52.212-3 is no longer packed or recommended for the commercial SF 1449 path, because its place in the engine came from the reserved 52.212-5 paragraph world rather than a current independent prescription; representations and certifications are made in SAM under FAR 52.204-7. The rule row stays in the table with an applies() that returns nothing, so the reasoning is visible rather than silently deleted. Apply/sanitize still blocks 52.212-5 and every RFO-removed clause.
4. **Sample 1 no longer carries Part 15 award-notice cites (fixed).** A commercial Part 12 / FAR 13.5 file now uses a commercial phase-citation map for Solicitation/Quote, Technical Evaluation, Price Reasonableness and Award (RFO FAR 12.201-1 commercial simplified procedures and the commercial simplified ceiling, not the simplified acquisition threshold story). The award and preaward notice document rows retarget to FAR 13.106-3(d) and FAR 19.302 on a commercial file, and the three HQ letter badges show the commercial cite on that path while the HQ master prose is left verbatim. Part 15 routing is unchanged for genuinely negotiated files.
5. **Sample 2 JOFOC (verified, no change).** The authority options and drafted prose already read 41 U.S.C. 1901 with FAR 12.102 procedures and the only-one-responsible-source basis under RFO FAR 6.103-1. Nothing was rewritten.

Verification: TypeScript clean; both samples walked in demo mode with no console errors; no occurrence of "CG 1804.11", "12.204(b)(1)", FAR 15.503/15.504 or 52.212-5 on either file page. No seed record edits, no new holds, no NCMS write-back, FedRAMP or real SAM publish claims; security still deferred.

## 16 Sep 2026 — FPDS filling sheet (fill aid)

Shipped
- New helper `src/lib/fpds-filling-sheet.ts` builds an FPDS field list from
  `acquisition_facts` only: document identity (PIID, parent IDV, PR, title),
  vendor (legal name, UEI, CAGE), classification (PSC with its note, NAICS,
  contract type, format, commercial determination, method), competition
  (extent competed, set-aside, JOFOC authority, fair opportunity), dollars,
  dates and place of performance, and the contracting office.
- Every field carries a state: Recorded, Blank ("Not recorded on this file"),
  or Confirm ("Uncertain — confirm before keying"). Nothing is invented: no
  PIIDs, UEIs, vendors, dollars or dates are synthesised. Action obligation is
  only suggested from a recorded proposed price, never from the estimate.
  Date signed is only Recorded when the file is launched; before award the
  target date is shown as Confirm. Fair opportunity is only shown on orders
  under an existing vehicle.
- Printable HTML sheet with the banner "Fill aid for FPDS — not a live FPDS
  submission", the prototype line on every page footer, and the sample mark on
  seeded records. Downloaded from the file page More menu, secondary to Next.
- Audit entry "FPDS filling sheet exported" with recorded/confirm/blank counts.

Not claimed / deferred
- No FPDS connection or submission, no NCMS write-back, no FedRAMP, no real
  SAM publish. NCMS stays the peer system for the award document; the binding
  citation remains NFS 1804.171.
- No seed edits to A-2027-0101 or A-2027-0102; no new holds; RFO citation fixes
  (12.204(a), no 52.212-5, no packed 52.212-3, Part 12 framing) untouched.
- Deferred: PDF-native output, FPDS-NG code validation, obligation tracking.

Verified
- Sample 2 (A-2027-0102): 24 recorded, 2 to confirm, 3 blank — vendor name,
  UEI DEMOMFS00001 and CAGE DEMO1 all read from the record.
- Sample 1 (A-2027-0101): 19 recorded, 0 to confirm, 10 blank — vendor, PIID,
  proposed price, obligation and award date all print as blanks honestly.

## 16 Sep 2026 — Memorandum sentence rewrite and Sample 1/2 exit-path verification

Copy only; no seed edits, no new automatic holds, no NCMS write-back / FedRAMP /
live FPDS / real SAM publish. RFO citation fixes (NFS 1804.171, FAR 12.204(a),
52.212-5 blocked, 52.212-3 not packed, Part 12 framing on Sample 1) untouched.

Rewritten (`src/lib/memo-draft.ts`, `src/lib/explain.ts`):
- Saved versions: a save with no recorded version number now reads "A new
  version of the X was saved on <date> by <person>" instead of "saved as version
  not recorded".
- Holds in the chronology: cause is stated as prose — missing document ("was not
  yet on the file"), a recorded No-go, or the reason a person typed — and the
  clearance reads "and resumed on ...". The stored field code is never printed.
- Votes in the chronology: "K. Bramwell recorded a No-go for the legal review
  seat on <date>, recorded by J. Rivera, noting that ..." replaces the
  "Seat: No-go recorded ..." label form. No-go reason is carried when present.
- Hold banner "Why?": "Intake: IGCE is missing" is restated as a sentence
  ("The IGCE is not yet on the file for the intake phase."); No-go and unvoted
  seats get their own sentence. Banner reason text itself is unchanged.

Verified on A-2027-0101 and A-2027-0102 (demo mode, 1440px, no console errors):
- Both files load clean; A-0101 shows the PNM as the current blocker, A-0102
  shows "Ready to exit Solicitation/Quote". Neither is on hold.
- Validated exit refusal list, exit audit of completed requirements, and the
  in-page dialogs for Exit / Scrub / Remove / Record vote / Open poll are all
  still in place in `files_.$acquisitionId.tsx`; they render only for a
  write-capable account, and the demo personas are read-only, so this pass was
  code-level plus read-only UI. No authenticated browser session could be minted
  in this environment (`auth-session --user` needs approval), so interactive
  exit/vote clicks remain unverified since the last authenticated pass.
- FPDS filling sheet (fill aid) still present in the quiet More menu on both
  samples, alongside NEAR export and briefing book.
- Companion gates still read "A gate is a checklist for the officer, not a
  hold" on both samples.

No regressions found, so nothing beyond the copy above was changed. Security
(staff-profile read finding), IDIQ/BPA order screens, SEB suite, SAM Awards
entitlement, FOUO hierarchy, live FPDS and PDF-native FPDS remain deferred.

## C — regulatory line-up on the Sample 1 walk (16 Sep 2026)

Authoritative stack: FAR as overhauled (RFO), interim NFS carrying PCD 26-03B
(2026-07-23) as binding NASA text, NFS Companion Guide (2026-09-11) as
process/guidance only, active PIC/PN/PCD overlays.

Fixes in this chunk:
- Technical evaluation gate (`src/lib/companion-gates.ts`) no longer cites
  "NFS CG 1815.3". It now cites FAR 13.106-2 for the evaluation itself and
  NFS CG 1815.45(b) labelled as guidance (Companion Guide process for the
  technical evaluation report on a sole source above the threshold).
  `isTerRequired` behaviour is unchanged: Sample 1 competed -> not applicable;
  Sample 2 sole source -> applies.
- NF 1787 gate cites NFS 1819.202-70 as binding with NFS CG 1819.11 labelled
  as guidance, matching the seeded review_rules row.
- Aviation gate keeps the seeded NPR 7900.3 / NPD 7900.4E / NPR 8715.3
  citation; it is presented as agency process, not as binding NFS.
- Re-verified the commercial SF 1449 pack: 52.212-5 is never packed or
  selectable, 52.212-3 never applies, removed clauses are filtered from both
  the recommendation and the saved selection, reasons read under RFO FAR 12/13.5.
- Swept src for binding claims of NFS CG 1804.11 and for FAR 12.204(b)(1) as
  the price-reasonableness mandate: none remain (NCMS is cited as NFS 1804.171,
  price reasonableness as RFO FAR 12.204(a) with FAR 13.106-3 where simplified
  procedures apply). Sample 1 phase citations stay on the commercial Part 12
  simplified path; Part 15 award notices only appear on genuine Part 15 files.

Verified in the demo walk: Sample 1 shows two Companion gates (aviation safety
and NF 1787 small business coordination) with no false TER, CIO or NPA gate;
Sample 2 shows three with the sole-source TER applying. No console errors, no
seed edits, no new holds, no NCMS write-back / FedRAMP / live FPDS claims.
Deferred: Track D GSA SF/FPDS forms, IDIQ/BPA screens, SEB, staff-profile RLS.

## P0.3 — RFO reserved-clause reason note (no 52.212-3/5)

- Added `RFO_RESERVED_212_NOTE` to `src/lib/clause-packet.ts`: a single
  citation-backed reason surfaced to the contracting officer stating that
  FAR 52.212-5 is Reserved under the RFO / PCD 26-03B, commercial clause
  content is prescribed via FAR Tables 12-2 and 12-3 (and each clause's own
  prescription) rather than the old 52.212-5 checkbox paragraph, and offeror
  reps/certs for commercial buys are made in SAM (with FAR 52.204-7 on the
  packet) rather than by packing FAR 52.212-3.
- `sanitizeClauseSelection` now blocks both 52.212-5 (Reserved) and 52.212-3
  (reps/certs made in SAM) explicitly, so neither can be applied even if
  somehow selected. `selectPacketClauses` already skips 52.212-5 and 52.212-3
  `applies: () => null`, so neither is recommended or offered.
- Surfaced the note once via a progressive-disclosure `<details>` ("Why FAR
  52.212-3 and 52.212-5 are not on the packet") in the clause picker, visible
  on Sample 1/2. Added a `clause_policy_note` field to the NCMS handoff packet
  JSON for the same reason.
- No seed edits, no new holds, no NCMS write-back / FedRAMP / live FPDS
  claims, no Track D forms, no 52.212-3/5 packed anywhere.

## 2026-09-16 — P0.2 PNM Ref, export cleanliness, P0.4 demo note, Tier-1 #3 postaward letters

- **P0.2 memo Ref.** `documents.$templateKey.$acquisitionId.tsx` now seeds `__method`
  from `acquisition_method` + `contract_format` when building the memorandum header,
  so `badgeCitation` resolves before the prefill runs. On A-2027-0101 the PNM Ref
  reads RFO FAR 12.204(a); FAR 13.106-3(b)(3), never bare FAR 15.406-3.
- **Export cleanliness.** `cleanExportText` (template-engine) and `memoParagraphs`
  (nf1858) strip the literal "Draft, confirm." from exported Word/PDF/NF 1858 bodies.
  The on-screen "Drafted from the record — confirm." flag is unchanged.
- **P0.1** vendor/quoter data (CORSAIR AVIATION, LLC HCH5G9HLMVZ5 / CAGE 7K7J6;
  Strategic SK4DHMRD7M13; SciFly R7LBZTAG8N98) is already in the database; no seed edits.
- **P0.3** `RFO_RESERVED_212_NOTE`, picker disclosure and sanitize blocks on
  52.212-3 / 52.212-5 are untouched.
- **P0.4 demo note.** Do not open the clause delta on A-2026-0090 (IDIQ vehicle):
  the seeded clause set is contradictory. No IDIQ rewrite in this chunk.
- **Tier-1 #3 postaward letters (A-2027-0101).** Successful letter carries an
  award amount field filled from the evaluation record's recommended price
  ($1,385,000 to CORSAIR AVIATION, LLC). The unsuccessful-offeror row now yields one
  letter per unsuccessful quoter: choosing Offeror 1..4 redrafts the letter for that
  quoter, filling company name, UEI and a quotation summary (price quoted and rating)
  from the evaluation record, with item 4 reporting the value awarded. Citation stays
  FAR 13.106-3(d) on the commercial simplified file. No vendors invented.

## P0.2 — PNM reference and export cleanliness (16 Sep 2026)
- PNM reference line and visible citation badge on simplified files read RFO FAR 12.204(a); FAR 13.106-3(b)(3), seeded from the record's acquisition method and contract format. Genuine Part 15 files still route to FAR 15.406-3.
- Exported PNM / Word / PDF / NF 1858 text strips the literal "Draft, confirm." flags; the on-screen "Drafted from the record — confirm." hints remain.
- Verified on A-2027-0101 and A-2027-0102 PNM routes; no console errors.

## P0.4 IDIQ clause note (16 Sep 2026)
- A-2026-0090 / orders under IDIQ: full vehicle clause reconciliation deferred as risky this turn.
- Instead the Solicitation/Quote and Award clause packet on IDIQ parent and order files shows a calm on-screen note: "Demo note: clause reconciliation for this IDIQ vehicle is not complete. Don't open the clause delta on this file during the walkthrough."
- Sample 1/2 seeds untouched; no new holds; no NCMS/FedRAMP/live FPDS claims.

## Tier-1 #3 Sample 1 postaward letters (16 Sep 2026)
- A-2027-0101 postaward letters are drawn from the saved evaluation of quotations, never invented.
  - Successful: CORSAIR AVIATION, LLC, award amount $1,385,000 (recommended quoter / recommended price).
  - Unsuccessful: one letter per unsuccessful quoter — STRATEGIC AVIATION LLC (UEI SK4DHMRD7M13, $1,462,000, Acceptable) and SCIFLY, LLC (UEI R7LBZTAG8N98, $1,521,500, Acceptable).
- The unsuccessful letter now names each company in the chooser, accepts ?offeror=N on the URL, opens on the first unsuccessful quoter, and reports the awarded value from the evaluation record rather than the intake estimate.
- Click path: file A-2027-0101 → Award phase → "Postaward notification letters to the unsuccessful offerors", or directly /documents/postaward-letter-unsuccessful/A-2027-0101?offeror=2 and ?offeror=3; successful letter at /documents/postaward-letter-successful/A-2027-0101.
- Citation stays FAR 13.106-3(d) on this commercial simplified file. No seed edits, no new holds, no NCMS/FedRAMP/live FPDS claims.
