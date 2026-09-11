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
