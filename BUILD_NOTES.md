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
