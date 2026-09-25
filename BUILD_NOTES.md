# IA Fix R1 — responsive layout and labels — September 25, 2026

- a) Below 1440px, acquisition files and document/form shells use their existing top jump list instead of the left navigator/rail; file clock content stacks and the current-hold actions wrap. At 1440px and above, the sticky aside returns unchanged.
- b/e) Work Queue List now fits eight fluid columns by folding Mission into Acquisition and the displayed workflow column into Status. T± displays atomically in List and Board. The internal `Ready` value and `columnFor()` remain unchanged; only its visible label reads `Not started`.
- c) Top-header identity and administrator controls now shrink or truncate below 1440px, while full values remain available through controls and title text. The product subtitle starts at 1440px.
- d) Mission Navigator scroll-spy now deterministically recomputes from section positions after scroll, resize, details toggles, DOM changes, and settled jumps; available IDs update only when their list changes.
- f) Acquisition Forecast retains the existing anticipated-award value, adding a display-only note when it comes from mission need date because no target award date is recorded. Forecast exports and clock derivation are unchanged.
- Untouched: document/form generation, mappings, prefill, values/editing, export bytes and filenames, signatures, refusal behavior, method gates, citations, audit writes, fixtures, checkouts, operational/readiness/countdown helpers, workflow rules/assignment/counts, rail internals, migrations, and all `src/lib/*` files.
- IA Fix R1 corrective: reverted the Executive Overview `.mc-status-rail` / `.mc-stat-block:last-child` media query back to 1024px (out of scope; 1440px kept only for `mc-shell-*`); removed `table-fixed` from the Work Queue List table so columns size to content, added `whitespace-nowrap` to the Priority header and cell, and kept the T± `whitespace-nowrap` wrapper and folded Mission/Column lines.

# IA Slice 3 — Document/form shells — September 25, 2026

- Added `src/components/mission-control/work-surface-shell.tsx`, the optional `MissionNavigator.ariaLabel`, and additive `mc-shell-*` styles for compact light-surface status strips plus desktop/mobile section navigation.
- Document save state derives only from the existing checkout, role, save mutation, and latest-version values. Its completion note and section badges derive from the existing `validate(def, values)` errors and visible fields.
- Form save state derives only from the existing save mutation and latest version. Form section badges count the exact existing non-boolean empty-value `Not recorded` condition, preserving the SF-30 AmendmentNo exception.
- Neither page has dirty tracking, so the shell adds no Unsaved state. No new effects, queries, or writes were added.
- Untouched paths: document `awardDate`, `exportHeaderLine`, `documentValues`, rendered/export context, all Word/PDF/memo calls, prefill/edit values, validation rules, generation, signatures, refusals, method gates, citations, AI provenance, save mutation bodies/callback semantics, and checkout acquire/release/take-over/heartbeat; form `headerLine`, countdown inputs, PDF header/footer use, export handlers, pinned revision, respondents, SF 1449 CLIN reconciliation, lineage, save bodies/callbacks, fixtures, and public form masters.

# IA Slice 2 — Work Queue triage — September 25, 2026

- Added `src/components/mission-control/work-triage.tsx` and additive `mc-triage-*` styles for reusable READY/BLOCKED signals and neutral priority bands on light Work Surfaces.
- `src/routes/work-queue.tsx` uses only its existing query and derived card record: identity, title, value, method, and owner come from `acquisition_facts`; mission name and priority come from the linked `missions` row; readiness and next action come from one `explainWorkReadiness(computeMetrics(...))` result; phase, days in phase, dependency, countdown, and confidence retain their existing metric helpers.
- Priority bands reuse the Executive Overview's recorded-priority tier helper and cutoffs: priority 1 → P1, 2–3 → P2–3, 4+ → P4+, missing or invalid → Priority not recorded. Board cards sort stably by that band within their unchanged workflow columns; List adds the same priority sort.
- READY/BLOCKED is presentation-only: HOLD → BLOCKED, GO or WATCH → READY, and LAUNCHED shows neither. Reasons come only from the first existing readiness trigger; no raw `clock_state` drives the signal.
- The acquisition-file follow-up changes only the invalid narrow-width navigator class from `border-block` to `border-y`. No queries, writes, state rules, countdown logic, Soft Walk behavior, generators, exports, signatures, roles, fixtures, schema, or Executive Overview code changed.
- CSS-only corrective: `mc-triage-signal-label` READY text now uses `--foreground` (GO stays the border) for 4.5:1 contrast; blocked label text uses `--chrome` (dark on HOLD fill) instead of the undefined `--mc-mission-surface`.

# IA Slice 1 — Mission Navigator — September 25, 2026

- Added `src/components/mission-control/mission-navigator.tsx`: reusable in-page navigation, scroll-spy, accessible focus transfer, conditional target filtering, and controls limited to navigator-owned collapsible sections.
- Wired `src/routes/files_.$acquisitionId.tsx` only. Desktop places the navigator above the unchanged Launch Sequence rail; smaller widths receive a non-sticky jump list. Existing content order, IDs, print markers, and panel behavior remain intact.
- Badges use existing values only: current HOLD state, current-phase missing requirements plus pending reviews, open applicable companion gates, missing file-index rows, and existing audit-log count. Zero or unknown values render no badge.
- `src/styles.css` adds only light Work Surface `mc-nav-*` rules using existing Lock D tokens, including print visibility for collapsed navigator sections.
- Soft Walk-adjacent FLAG: the acquisition file route changed wrapping and navigation chrome only. No queries, writes, state derivation, launch rail logic, generators, exports, signatures, roles, fixtures, or regulatory logic changed.
- Reverse by removing the navigator wrappers/imports, restoring the rail as the aside's direct child, and deleting the additive `mc-nav-*` stylesheet block and primitive.

## Overnight propagate P0/P1 fix — Work Queue + document shell award remap — September 24, 2026

- `src/routes/work-queue.tsx` now derives every card through `deriveOverviewAcquisitionState`, computes metrics from that remapped record, buckets workflow columns from shared readiness, and renders the shared Overview countdown. Phase and target-day sorting come only from remapped metrics; raw `clock_state`, Administration, and `need_date` can no longer manufacture Launched, T+, AWARDED, or target days.
- FLAG Soft Walk-adjacent display only: `src/routes/documents.$templateKey.$acquisitionId.tsx` now builds its visible header clock through the same operational state, stored attachment/saved-document evidence, metrics, and Overview countdown used by form chrome. Its pre-existing draft/export `awardDate` and export header remain isolated and unchanged, so generators, body fills, signatures, exports, citations, checkout behavior, writes, and document bytes are untouched.
- The observed `document_checkouts` 409 remains FLAG-only and was not changed. Reverse by restoring the Work Queue raw metric/countdown callers and the document shell's former visible `daysToAward` header; no schema, stored `clock_state`, Soft Walk brain, Lock D system, or audit-write semantics changed, and no self-GREEN claim is made.

## Overnight §6 Tip 4 — Review/oversight — September 24, 2026

- `src/routes/reviewer-inbox.tsx` now presents each pending review as a light work strip with the shared `explainWorkReadiness` chip and matching accent. Textarea/button radii use the Lock D control token, and No-go uses the HOLD token; vote mutation, audit payload, matching, hero-document, and receipt behavior are unchanged.
- `src/routes/checks.tsx`, `src/routes/deviations.tsx`, and `src/routes/deviations_.$deviationId.tsx` now use shared warm summaries, table wrappers, control radii, and existing readiness color tokens where their recorded status already has a direct visual equivalent. Check/deviation rules and writes are unchanged.
- Optional light-only polish also applied to `src/routes/digest.tsx` and `src/routes/escalations.tsx`: shared toolbar/table wrappers, control radius, and GO/WATCH display tokens without changing digest posting, escalation calculations, or threshold writes. FLAG review/write-adjacent presentation files: reviewer inbox, checks, both deviation routes, digest, and escalations. Reverse by restoring the former classes and legacy color variables; no schema/data changes and no self-GREEN claim.

## Overnight §6 Tip 3 — Requester surfaces — September 24, 2026

- `src/routes/requester.tsx` now derives GO / WATCH / HOLD / LAUNCHED through `explainWorkReadiness`, renders the shared readiness chip and light work-card accent, and maps recorded Present / Missing and hold callouts to Lock D readiness tokens. Owed-item logic, requester filtering, effort display, and writes are unchanged.
- `src/routes/estimate.tsx` uses the shared light toolbar, control radius, summary surface, spacing, and table wrapper without changing estimator inputs, calculations, queries, or stored intake estimates. `src/styles.css` adds only reusable light `mc-work-summary` and `mc-work-form-section` utilities from the existing token map.
- FLAG Soft Walk-adjacent: `src/routes/intake.tsx` changed presentation classes only for the sample toolbar, T-Minus record section, controls, scan section, estimate summary, and submit panel. NF 1707 fields, validation, methods, authorities, persistence, uploads, fixtures, and all write paths are untouched. Reverse by restoring the former route classes and removing the two additive CSS utilities; no schema/data changes and no self-GREEN claim.

## Overnight §6 Tip 2 — Files + file chrome — September 24, 2026

- `src/routes/files.tsx` now derives each row through `deriveOverviewAcquisitionState`, `computeMetrics`, stored attachment/document evidence, and `explainWorkReadiness`. Phase, GO / WATCH / HOLD / LAUNCHED chip, readiness accent, and compact award clock all read the remapped operational record; raw `clock_state` and `current_phase` are no longer displayed.
- FLAG Soft Walk-adjacent: `src/routes/files_.$acquisitionId.tsx` changed display chrome only. Its hero now shows the shared readiness chip, its light summary uses the shared control radius, and phase-dot colors use the already-proven effective state plus Lock D readiness tokens. Launch rail/countdown/invite props and logic, writes, generators, signatures, exports, methods, authorities, fixtures, and stored state were untouched.
- Reverse by restoring the prior Files query/raw columns and removing the hero chip/radius plus readiness-token phase-dot display mapping. No schema or data changes; no self-GREEN claim.

## Overnight §6 Tip 1 — Today + Work Queue readiness propagate — September 24, 2026

- `src/components/mission-control/readiness.ts` adds the shared `explainWorkReadiness` wrapper around the existing rules, standard watch window, phase-plan aging fallback, and current date; it makes no unproven missing-evidence claim.
- `src/routes/today.tsx` and `src/routes/work-queue.tsx` now show GO / WATCH / HOLD / LAUNCHED chips and matching Lock D accents on light Work Surfaces. Ownership, filtering, workflow columns, queries, and shared countdown rendering are unchanged.
- `src/styles.css` adds reversible light-only `mc-work-*` utilities using the existing warm surfaces, spacing, radius, shadow, and readiness tokens. Reverse by removing those utilities and restoring legacy status chrome in the two routes. Soft Walk logic, exports, fixtures, stored clocks, and data writes were untouched; no self-GREEN claim was made.

## Lock D componentize — September 24, 2026

- Consolidated the additive Lock D map in `src/styles.css`: Executive typography, spacing, radii, shadows, Work/Mission surfaces, cyan focus/instrumentation, readiness colors, loading/empty roles, and identity-only NASA red. Executive readiness strips, chips, and clocks now consistently use GO `#2ECC8A`, WATCH `#F0B429`, HOLD `#FF8A3D`, and LAUNCHED `#6BA3FF`.
- `src/components/mission-control/primitives.tsx` now exports `MissionReadinessChip`, `ProvenanceChip`, `MissionStripTable`, `GateDisclosureShell`, `GateGlance`, `LeadershipExceptionList`, `LeadershipExceptionStrip`, and `AnalystTableShell`, alongside the existing panel/stat primitives. Overview scan, gate progressive disclosure, Nova/state provenance, and leadership exceptions consume those shared parts.
- Reverse by restoring the local wrappers/chips in the consuming mission-control files and removing the additive Lock D variables. State derivation, filters, countdown helpers, data paths, Soft Walk files, forms, exports, fixtures, schema, and stored `clock_state` were not changed.

## Executive Overview reconciliation foundation D — September 24, 2026

- Recast Executive exceptions as leadership-first compressed strips with a Leadership / Analyst view toggle. Each item still comes only from the existing overdue gate, award risk, mandatory evidence, reviewer, approval, and blocker rules.
- Only WATCH and HOLD acquisitions can appear. Identity is acquisition-title first, schedule uses the shared reconciled countdown, and the dense analyst table exposes missing evidence and gate age without manufacturing values.
- Lock D chrome, A+B+C reconciliation, Soft Walk write paths, schema, fixtures, and other pages were unchanged.

## Executive Overview reconciliation foundation C — September 24, 2026

- Changed the featured trajectory's selected-gate evidence into progressive disclosure: the default leadership scan shows record-derived readiness, evidence, approvals, blocker, downstream award rule, next action, and responsible role; the expansion retains the full forensic evidence and event detail.
- The downstream Administration relationship is explicitly labeled as a rule and remains pre-award only. Missing record values continue to read “Not recorded” or “None recorded.”
- Lock D chrome, A+B state reconciliation, shared award-date gating, Soft Walk write paths, schema, and other pages were unchanged.

## Executive Overview reconciliation foundations A+B — September 24, 2026

- Hardened the shared countdown face so T+ and AWARDED require `awardDate`; a stored launched clock state without a recorded actual award falls through to the pre-award target, forecast, hold, or not-recorded paths.
- Added a restrained record/rule model note, six-row state contract, and acquisition identity assurance to the frozen Lock D Executive Overview. Portfolio readiness totals remain a live reduction across all loaded acquisitions.
- No stored `clock_state`, schema, Soft Walk method, citation, document, signature, role, audit write, export, fixture, form, or other-page presentation was changed.

## Executive Overview operational pass · Phase 1 — September 24, 2026

- Added one Overview-only derived operational state. A recorded `Launched` audit event is now the sole source for actual award, LAUNCHED readiness, T+, and post-award timeline position.
- Pre-award files count down only against the target award date. Once awarded, the recorded actual award date replaces the target for elapsed time and quarter reporting; award day reads T+0.
- The same derived state feeds Overview status, current phase, readiness, countdown, trajectory, acquisition strips, and Days Returned. Every acquisition resolves to exactly one readiness bucket.
- No schema, stored `clock_state`, Soft Walk method, citation, document, signature, role, audit, export, fixture, form, or non-Overview page was changed.

## ORBIT Executive Overview Lock D · Fidelity QA — September 23, 2026

- Restored the frozen Craft R3 hierarchy on the Executive Overview only: equal-width wrapping trajectory gates, semantic GO/WATCH/HOLD/LAUNCHED values and underlines, more deliberate mission-surface spacing, and laptop-safe acquisition strips.
- Reduced surrounding shell emphasis only for the Executive Overview while retaining every search, notice, Nova, presenter, role, account, and navigation capability.
- Removed Phase Movement and its decorative percentages from the Overview. Days Returned remains record-derived and keeps the factual “No returns recorded” zero state.
- Soft Walk methods, citations, documents, signatures, roles, audit behavior, schema, clocks, refusals, exports, fixtures, data logic, and every other page were unchanged.

## ORBIT Executive Overview Lock D · Craft R3 — September 23, 2026

- Matched the approved Craft R3 direction on the Executive Overview only: compressed mission strips, explicit trajectory states, gate-linked evidence, scope architecture preview, and Nova provenance disclosure.
- Priority Mission Flow uses only the existing computed status, clock, phase, next decision, variance, blocker, owner, and action fields. Preview labels identify visual affordances that do not claim a connected service or write path.
- Days Returned keeps its prove-only calculation; zero now reads “No returns recorded.”
- Soft Walk methods, citations, documents, signatures, roles, audit behavior, schema, clocks, refusals, exports, fixtures, and all other pages were not changed.

## ORBIT Executive Overview Lock D — September 23, 2026

- Applied the locked D recipe only to the Executive Overview: B's navy mission surface, A's light NASA masthead and warm work surface, and C's airier progressive hierarchy.
- Portfolio Flight Path now features one selectable acquisition and selectable lifecycle gates. It reveals only phase evidence already derived from the record and links to the real acquisition file; no state or telemetry was added.
- Mission Readiness, the featured path, Nova attention, and anomaly operations remain navy. Portfolio Scan, Days Returned, phase movement, and detail tabs sit on a warm light executive surface with fewer equal-weight borders.
- The authorized masthead asset remains `public/brand/nasa-insignia.png`. NASA red `#FC3D21` remains identity-only under the masthead; HOLD, OVERDUE, errors, and destructive actions continue to use operational red.
- Soft Walk logic, countdown math, documents, forms, citations, fixtures, roles, audit behavior, and other pages were not changed.

## ORBIT Phase 2 product-design north star — September 22, 2026

- Raised the Executive Overview command surface toward a best-in-class commercial product standard while retaining the NASA Mission Control identity.
- Improved hierarchy, status instrumentation, scan density, and interaction detail using only existing record-derived metrics.
- Kept the change visual-only and confined to the Executive Overview; Soft Walk behavior, clocks, documents, fixtures, and meters remain unchanged.

## ORBIT Chunk 4 — Nova

- Renamed the visible cited-draft assistant to Nova without changing the cite-or-refuse answer path.
- Added quiet, click-only Nova controls to the top strip, document and form page tops, and key acquisition-file Why clusters.
- Nova panels name their workspace, file, document, or row scope; show sources; and state that drafts are not written to the record.
- Nova has no automatic opening, avatar, animation, microphone, speech, or record mutation. Orby remains a separate hidden easter egg.

## ORBIT Phase 2 — Executive Overview Mission Control POC

- Replaced the Executive Overview's single SaaS-style clock band with a near-black mission-control scanning field: a GO / WATCH / HOLD / LAUNCHED status board, mission-first acquisition scans, and compact countdown faces.
- Extracted the new visual composition into `src/components/mission-control/` with reusable panel, stat, and bar primitives. Phase distribution and leadership attention now read as visual rows rather than long callout prose.
- Every displayed state, countdown, phase, blocker, owner, and next action still comes from the existing `computeMetrics` and `countdownView` results. Queries, clock math, tabs, records, roles, forms, exports, and Soft Walk paths were not changed.

# T-Minus build notes

- Soft SEB / briefing polish: the Evaluation cockpit and exported briefing book now share one Board readiness summary for L↔M findings, clarifications, and evaluation-factor evidence. Empty states are brief and honest; all results remain advisory and never hold a file or phase exit. Sample records, clocks, seeds, external-write boundaries, and form export paths were unchanged.

## DRFP cover letter OP Word master (Soft Walk P1-1)

- The attached HQ Draft Request For Proposal cover letter is copied into a marker master; the HQ source remains unchanged. Instruction pages and the Document History Log are removed while the letterhead, styles, relationships, footer version identifier, and blank signature line remain.
- `drfp-cover-letter` exports through `applyMarkers` as `drfp-cover-{acquisition-id}.docx`. Only recorded or saved values print; unresolved optional passages are removed instead of emitting placeholders.
- The Word path is limited to competed FAR Part 15 negotiated acquisitions. Commercial, simplified, and sole-source files show an honest refusal instead of receiving Part 15 language. Readiness meters, clocks, external-write boundaries, and all existing form and memorandum export paths are unchanged.
- A fictional competed Part 15 fixture, `A-2027-0121` (cryospheric field campaign science support, Ames Research Center, contracting officer Joshua Taggart), carries the draft RFP cover proof. `A-2027-0103` keeps its own recorded officer and is never relabelled; recorded officers always take precedence over sample defaults.

## Option justification OP Word master (Soft Walk P1-2)

- The attached HQ Option Justification template is copied into a marker master at `public/forms/OPTION_JUST_MASTER.docx` by `scripts/build-option-just-master.py`; the HQ source is not edited. Instruction pages and the Document History Log are removed; letterhead, styles, footer version identifier and the blank signature line remain.
- `option-justification` exports through `applyMarkers` as `option-justification-{acquisition-id}.docx`. The face carries the HQ citations only: FAR 17.201-1, FAR 17.201-2 and the NFS CG 1817.25 format. Empty passages drop their paragraph instead of printing a stand-in, and the signature ink stays blank.
- The Word path is limited to negotiated or sealed bid solicitation records. Commercial and simplified files — including Soft Walk Samples 1 and 2 — show an honest refusal.
- `A-2027-0121` (contracting officer Joshua Taggart) carries the proof. `A-2027-0103` keeps its own recorded officer, J. Rivera, and is never relabelled.

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

| Table                 | Source rows | Loaded | Notes                                                               |
| --------------------- | ----------- | ------ | ------------------------------------------------------------------- |
| users                 | 5           | 5      | Seeded Auth users                                                   |
| centers               | 4           | 4      |                                                                     |
| branches              | 8           | 8      |                                                                     |
| missions              | 5           | 5      |                                                                     |
| acquisition_facts     | 12          | 12     |                                                                     |
| thresholds            | 27          | 27     |                                                                     |
| phase_plan            | 25          | 25     |                                                                     |
| review_rules          | 14          | 14     |                                                                     |
| enterprise_strategies | 28          | 28     |                                                                     |
| regulatory_refs       | 62          | 62     | Spec said 63; source CSV has 62 data rows                           |
| templates             | 98          | 98     |                                                                     |
| clauses               | 1,359       | 1,359  | Surrogate `row_id` primary key; `clause_number` indexed, non-unique |
| clause_matrix_2603b   | 819         | 819    |                                                                     |
| nfs_clause_matrix     | 125         | 125    |                                                                     |
| nf1707_fields         | 271         | 271    |                                                                     |

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

## Tier-1 #4 — "Why this row" on the launch sequence (16 Sep 2026)

Every launch-sequence row now carries a rationale, satisfied or not. `explainDocRow`
in `src/lib/explain.ts` pairs each row with its purpose in the contract file
(intake facts, IGCE, SOW/PWS, market research, NF 1787, JOFOC, notices, NCMS
handoff packet, funds certification, proposed price, evaluation record, PNM,
SAM/exclusions, SF 1449 signature, votes, FPDS, CPARS, COR, options, SF 30,
closeout, file retention), states whether the phase requires or merely offers it,
and says whether the record shows it. `explainMissingDoc` now delegates to the
same builder, so hero and row wording stay identical. Rows show "Why this row"
when satisfied and "Why?" when outstanding. Citations are unchanged and come from
the row (FAR/RFO binding, Interim NFS, NFS CG process-only). Presentation only:
no seed edits, no new auto-holds, no change to exits, clause packet, or claims.

Verify: sign in, open `/files/A-2027-0101` or `/files/A-2027-0102`, expand the
launch sequence and click "Why this row" / "Why?" on any row.

## 2026-09-16 — Tier-1 #5 file story line

- `fileStory` in `src/lib/explain.ts` renders one calm sentence under the file
  header, assembled from recorded facts (acquisition type words, mission name
  and milestone date, current phase/state) — the same facts the audit trail
  carries. No model text, no seed changes, no new holds.
- Verified on A-2027-0101 ("Commercial FFP, FAR 13.5, competed … Arctic Snow
  Depth Campaign 2027") and A-2027-0102 ("… sole source … Coastal Aerosol
  Validation"). FAR/RFO → Interim NFS → NFS CG process-only authority order
  unchanged.

## Tier-1 #6 — citation stubs (16 Sep 2026)

Added `src/lib/cite-stub.ts`. Where a citation renders, the app now checks the loaded
`regulatory_refs` corpus for a matching token (FAR / RFO / NFS / U.S.C.). With no match, or
with no corpus loaded in the session, a plain stub line is shown instead of implying the
authority text is on hand:

- "Why this row" / "Why?" disclosures (`src/components/explain-this.tsx`).
- Document version badge (`src/routes/documents.$templateKey.$acquisitionId.tsx`), on screen only; exports unchanged.
- Regulation panel references without a source URL (`src/components/regulation-sidebar.tsx`).

No citation text is invented or altered. Authority order unchanged: FAR/RFO, Interim NFS,
NFS CG process-only. No seed edits, no new auto-holds, no NCMS write-back, FedRAMP, or live
FPDS claims. Sample 1 and Sample 2 seeds untouched.

## GSA SF 1449 and SF 30 as generated forms (16 Sep 2026)

- Official blank forms downloaded from GSA and served unchanged as local static
  assets: `public/forms/SF1449.pdf` (gsa.gov/system/files/SF1449-21.pdf) and
  `public/forms/SF30.pdf` (gsa.gov/system/files/SF30-16c.pdf). No stubs were
  needed; no PDF bytes were invented or edited.
- `src/lib/sf-forms.ts` builds both forms from the acquisition record only
  (blocks left blank where the record is silent, with a plain gap note). Field
  paths are the forms' own XFA paths, so the populated export is the official
  form carrying the record's data.
- Registered in the existing generated-form engine (`FormKey`, `FORM_NAMES`,
  `GENERATED_FORM_KEYS`, `buildForm`) and the `/forms/$formKey/$acquisitionId`
  route. Two library rows added (SF 1449, SF 30) so versions can be saved.
- Click path: `/forms/sf-1449/A-2027-0101` and `/forms/sf-30/A-2027-0102`.
- No external writes. The solicitation and contract of record are built in NCMS
  (NFS 1804.171); T-Minus produces a fill and a handoff only. Sample 1/2 seeds
  untouched; no new auto-holds; no FedRAMP, live FPDS or SAM publish claims.
- Known limits: SF 1449 continuation lines beyond item 0001 and the SF 30
  block 14 continuation page are not populated; the CO completes them.

## Wave 1 W1.3 — evidence pack zip (16 Sep 2026)

Added a one-click evidence pack export on the file page (More → "Export evidence
pack (zip)"), built entirely from the record in the browser:

- `index.html` cover listing the documents in NF 1098 name order (tab, then
  document name, then version) with a synthetic-prototype caveat.
- `documents/` every saved document version rendered from the template engine,
  each with its provenance block (tab, citation, tier, HQ revision, saved by/at).
- `research/research-findings.csv` and `research/research-log.csv` from the
  recorded findings and run log (run id, run start, source, query, count, outcome).
- `audit/audit-log.csv` full audit trail for the acquisition.
- `clauses/clauses.csv` the recommended packet with reason, UCF section, status,
  effective date and whether the clause is applied on the file, plus
  `clauses/reserved-52-212-5-note.txt` carrying RFO_RESERVED_212_NOTE.
- `fpds/fpds-filling-sheet.html` the existing fill aid, honest blanks retained.

Implementation: `src/lib/evidence-pack.ts` (jszip, already a dependency), wired
in `src/routes/files_.$acquisitionId.tsx`. The export writes one audit row
("Evidence pack exported") with the counts. No external writes, no NCMS
write-back, no FedRAMP or live FPDS claims. No seed edits, no new auto-holds.

Verified on Sample 1 (A-2027-0101): downloaded `evidence-pack-A-2027-0101.zip`,
19 entries, documents ordered by NF 1098 tab, CSVs populated, no console errors.

## Wave 1 W1.4 — NCMS handoff packet in SF 1449 screen order (16 Sep 2026)

- Added `src/lib/ncms-handoff.ts`. The handoff packet downloaded from the file
  page now leads with `sf_1449_screen_order`: SF 1449 blocks in screen order,
  each with the fill-in value taken from the acquisition record, and a short
  note where the record cannot answer the block.
- Signature blocks (31b contracting officer, 30b offeror signer and title) are
  carried empty and flagged `signature: true` with "The contracting officer
  signs in NCMS." `signature_note` states this at the top of the packet.
- Files on an IDIQ vehicle or carrying a recorded modification also get
  `sf_30_screen_order` (A-2026-0090).
- Clauses are ordered by UCF section then clause number, with fill-in values
  printed. FAR 52.212-3 / 52.212-5 remain excluded; `RFO_RESERVED_212_NOTE`
  wording is unchanged.
- No writes outside the browser. NCMS remains the contract writing system of
  record (NFS 1804.171); the packet is a local JSON file the officer keys from.
  No seed edits, no new auto-holds.
- Verified by download: A-2027-0101 (five SF 1449 sections, three blank
  signature blocks, requisition 4200999101) and A-2026-0090 (SF 1449 plus
  SF 30 screen order, contract number 80ARC26D0090).
- Click path: open /files/A-2027-0101 → "Download the handoff packet".

- UX P1 (CoS green light): button className merged via cn(buttonVariants({variant,size}),className) so hero CTAs wrap; heroAction maps PNM to "Write the PNM"; Overview MissionClockRow status now sentence case (no uppercase tracking-wide). CSS/copy only.

## Walk-critical QA batch 2 (16 Sep 2026)

- A-2026-0090 (IDIQ): the SF 30 clause delta is now hard-hidden on IDIQ parent and
  order-under-IDIQ files. The counts, delta table and clause fill-ins are not rendered;
  a strengthened demo note states the vehicle clause set is not reconciled and the delta
  is withheld. Nothing is reconciled or invented.
- Sample 2 synopsis: the SAM.gov notice badge and the Synopsis phase citation drop
  FAR 12.603 / combined synopsis language on a sole-source record and read
  "RFO FAR 5.203; RFO FAR 6.104 (notice of intent to sole source)".
- Sample 2 market research: the conclusion prose cites RFO FAR 12.201-1 (Table 12-1);
  the stale saved version on A-2027-0102 was rewritten to the same prose. No method or
  competition code prints inside prose.
- Sample 2 JOFOC: a stored authority written before the option list was refined is now
  matched back to its option on load, so item 4 opens on
  "41 U.S.C. 1901 (FAR 12.102 procedures; only one responsible source basis under RFO FAR 6.103-1)"
  instead of "Choose one". The saved A-2027-0102 justification value was aligned to that option.
- PNM: "Draft, confirm." / "Drafted from the record, confirm." are stripped from every drafted
  field body; the confirmation stays as the chip beside the field. Basis of the IGCE,
  Certified cost or pricing data (Not required; commercial products or services, FAR 15.403-1(b)(3)
  on a commercial simplified file) and Date of determination now prefill from the record.
- Unchanged and verified: Corsair UEI HCH5G9HLMVZ5, PNM citations RFO FAR 12.204(a); FAR 13.106-3(b)(3),
  and the RFO Reserved note for 52.212-3 / 52.212-5 in the clause picker.
- No seed rewrites of Sample 1/2 acquisition facts, no new auto-holds, no NCMS write-back,
  no FedRAMP or live FPDS claims.

## Wave 1 W1.5 polish (16 Sep 2026)

- Spelling: "labour" corrected to "labor" throughout the market research runner, including
  the CALC+ source label written to the research log.
- CALC+ scope: the research log entry and the conclusion sentence now say what the numbers
  are — awarded ceiling hourly rates on GSA schedule contracts, a labor comparison point,
  not a price for this requirement and not inclusive of materials, travel or other direct costs.
- Sample 2 leftover cite: the SAM.gov notice response rule no longer cites FAR 12.603(c) on a
  sole-source record; it cites RFO FAR 5.203; RFO FAR 6.104. FAR 12.603 remains on competitive
  combined synopsis/solicitation files only.
- PPM label: the template reads "Prenegotiation Position Memorandum (PPM), before negotiations"
  and both the lead and the badge note state that the PNM is the separate record written after
  negotiations and is the price reasonableness determination of record.
- Clause "applied": the picker now reads "N on the file of M recommended" with one line saying
  what that means — the clause is recorded on the acquisition and carries into the handoff
  packet, while the solicitation and contract of record are written in NCMS.
- CO name consistency: A-2027-0103 carried "J. Rivera" while every other synthetic file carried
  "J. Rivera (fictional CO)". The one record was aligned; no other facts changed.
- No external writes, no new auto-holds, no seed rewrites on Sample 1/2. P0.1 UEI, P0.2 PNM
  citations, P0.3 Reserved note and the QA batch 2 IDIQ clause-delta hide are unchanged.

## Wave 2 W2.1–W2.3 multi-role desk

Three role desks ship together. Each reads the record only; nothing is
inferred and no external system is written.

- `src/lib/desk-data.ts` — one shared loader over missions, acquisition
  facts, phase plan, review rules, Center overrides, thresholds, enterprise
  strategies, polls, audit log, users, Centers, attachments, saved documents
  and open clause change tasks. Derives each card through the existing
  `computeMetrics`, so phase, clock, status, blocker and next action match
  the Overview, the Work Queue and the file page exactly. Helpers:
  `daysSince`, `daysUntil`, `heroDocForPhase` (the required generated
  document for the phase, falling back to the last document the file
  produced before a review phase opened) and `pollMatchesReviewer`.
- `/requester` (W2.1, requester portal) — lists only files whose
  `requester_name` matches the signed-in persona. Panels: Your file, What
  you owe (PR number, NF 1707 answers, SOW, IGCE, present vs missing from
  the record flags), Days costing (days since the file opened, days on
  hold, days to award), What happens next (next action or blocker with the
  phase authority beside it). Links into the file and the NF 1707 intake.
- `/reviewer-inbox` (W2.2) — open polls matched to the reviewer by name or
  roster title. Where the persona is not named on any open poll the list is
  every open review with the reviewer of record shown on each row, stated
  on screen. Each row links to the one document to read and records the
  vote into the same `polls` row and `audit_log` entry the file page uses.
  A No-go without a reason is refused.
- `/today` (W2.3, CO landing) — Waiting on me, Waiting on someone else,
  Reviews due, Regulation changes touching my files (only rows in
  `clause_mod_tasks`; otherwise an honest empty state linking to Clause
  changes) and Three things to do next, ranked by the Overview urgency.
  The Work Queue board is unchanged and still available.
- `src/lib/roles.ts` — landings: specialist `/today`, reviewer
  `/reviewer-inbox`, requester `/requester`. Work Queue nav is now
  specialist and HQ; a requester or reviewer opening `/work-queue`
  is redirected to their own desk. Administrator sees all desks.

Click paths (Try the demo, then the role toggle in the header):

- Requester: role toggle → Requester → left rail → Requester portal.
- Reviewer: role toggle → Reviewer → left rail → Reviewer inbox →
  Vote on this review → Go or No-go with a note.
- CO: role toggle → Contracting specialist / officer → left rail → Today.

Protected and unchanged: Sample 1 A-2027-0101 Corsair UEI HCH5G9HLMVZ5 and
the live SAM path, the PNM citations RFO FAR 12.204(a) and FAR 13.106-3(b)(3),
the P0.3 Reserved 52.212-3 / 52.212-5 note, and the hidden A-2026-0090
SF30 clause delta. No seed facts were rewritten, no holds added and no
NCMS, SAM, FPDS or email write was introduced.

## UX Presenter declutter (CoS green light)

- When Presenter mode is ON, AnnouncementBanner is not rendered in the header (bell control and urgent portal both hidden); urgent-announcement-slot stays empty so no "Urgent: ..." line appears under the header. Non-Presenter behavior unchanged.
- Click path: Admin toggle Presenter on -> no bell/urgent banner under header; Presenter off -> banner and urgent line work as before.

## Wave 2 polish + W2.4 email drafts + W2.5 what-if sandbox

- Comparables fallback (W2.7): when SAM.gov contract awards and the cached run are
  both unavailable, the comparables run now falls back to prior T-Minus actions on the
  same NAICS or PSC before any fictional sample. The screen and the PNM summary read
  "USAspending unavailable; showing prior T-Minus actions on NAICS X / PSC Y." and say
  the rows are files in this system, not external awards. Nothing is invented.
  Click path: Files → A-2027-0101 → Documents → Price Negotiation Memorandum → Run comparables.
- Market research prior actions now match NAICS or PSC and label the source honestly on
  NF 1787A procurement history when USAspending returned nothing.
- Peer-link strip (A2): file page, under the clock hero — NEAR export, NCMS handoff packet,
  Checks link, and the last recorded check stamp from sam_checks. Local downloads only;
  no NEAR, NCMS, or SAM write.
  Click path: Files → any file → strip under the hero.
- Sole-source synopsis residual (A3): phaseCitation now returns RFO FAR 5.203 / RFO FAR 6.104
  for the Solicitation/Quote row on a sole-source file, so FAR 12.603 and combined
  synopsis wording no longer appear on A-2027-0102. Competitive combined-synopsis paths unchanged.
- W2.4 Email drafts: file page, "Draft an email" — requester nudge from the owed Required rows,
  reviewer nudge from pending polls, vendor notice stub when the record supports it. Copy button
  only; T-Minus sends no mail and there is no server send.
  Click path: Files → any file → Draft an email → Copy the draft.
- W2.5 What-if sandbox: file page, "What-if sandbox — not saved" — change estimated value or
  set-aside and see phases, clause count, and thresholds that would change. Never writes
  acquisition_facts; Reset restores the record.
  Click path: Files → any file → What-if sandbox.

- Executive Overview: navy Mission Clock hero — full-width navy band with large still day figures, status word paired with its color, mission links and blocker lines on the panel; status summary counts quieted to an inline strip below. No other routes touched.

## Wave 2 W2.6 + W2.8

- W2.6 Days to award with confidence range. New `src/lib/confidence.ts` computes planned calendar days from the seeded phase plan, the same run with weekends removed, and the spread of days prior launched files of the same acquisition type actually took (Center first when at least three peers there, otherwise agency-wide). Fewer than three peers reads "confidence range not yet enough history"; nothing is invented and no citation is attached. Shown on the file page clock line, under the Work Queue "Days to award" cell, and under each of CO Today's three next actions. Click paths: Files → A-2027-0101 (clock line); Work queue → list view; Today → Three things to do next.
- W2.8 Center configuration CSV import. New `src/components/routing-csv-import.tsx` lets HQ and specialists upload a routing CSV (center_code, document_key, approving_official_title, optional thru_chain and memo_default), validates columns and every row against known Centers and routed documents, previews the rows, and only then upserts `memo_routing` and writes one audit row per applied row. No seed files are touched and no external system is written. Click path: Center configuration → Import routing from a CSV.

- P0 exclusions false-hold: the nightly exclusions sweep is UEI-exact and read-only. Entity registration payloads no longer count as exclusions (totalRecords removed from the test); cache fallback reuses only prior Exclusions sweep rows carrying an exclusions payload for the same UEI; the sweep never writes clock_state or hold fields — it records a flag for CO review with cause, UEI, source and time, and a newer clean check on the same UEI clears it. "Last check" now renders a real date and time (no Invalid Date). Unsuccessful postaward letter sections cite FAR 13.106-3(d) on simplified files.

## Method-specific unsuccessful offeror letter body

Sections can now carry `standingTextFor(values)` beside `citationFor`, and the
form, the printable view and both exports render it. On a FAR 13.5 or Part 12
commercial file the Postaward Notification Letter Unsuccessful Offeror now
states the notice under FAR 13.106-3(d), replaces the Part 15 debriefing
paragraph with the brief explanation available under FAR 13.106-3(d), and drops
the Source Selection Statement enclosure and rationale sentence; the price
negotiation memorandum is named as the record instead. A genuine Part 15 file
keeps FAR 15.207-2(b), FAR 15.301-1 and the enclosure unchanged. The letter's
organization code reads `co_code` first (JAZ on the sample files) and the
contracting officer e-mail and telephone continue to come from the users row
matching the record's `co_name`. Exclusions sweep behaviour (SHA cce3fec) and
the hidden A-2026-0090 clause delta are untouched.

## Wave 2 exit polish

The clause packet on a Part 12 commercial file now states the Reserved
position in plain sight, above the picker: FAR 52.212-5 is Reserved under the
RFO / PCD 26-03B, so clause content is prescribed through FAR Tables 12-2 and
12-3 and representations are made in SAM, and neither 52.212-3 nor 52.212-5 is
recommended or apply-able. The same note now rides in the NCMS handoff packet
as `reserved_52_212_5_note` for commercial files. Nothing was invented: the
wording is the existing RFO_RESERVED_212_NOTE, surfaced rather than collapsed.

Regression checks this turn: /requester, /reviewer-inbox and /today all render;
the peer-link strip's "Last check" runs through formatStamp, which prints
"no date" and never "Invalid Date"; what-if remains an unsaved sandbox and the
email drafts remain copy-only. The A-2026-0090 clause delta stays withheld on
IDIQ vehicle and order profiles, the exclusions sweep still writes no
clock_state or hold fields, and the postaward unsuccessful letter cites only
FAR 13.106-3(d) on a FAR 13.5 or Part 12 file.

## Wave 3.1–3.4

**W3.1 modification wizard → SF 30 block 13.** The modification form is now five
questions — what changes, why, who asked, funded or not, within scope or not —
and it prints the SF 30 block 13A–D choice with the authority read from the
clause already in the instrument. Administrative changes take the form cite at
FAR 43.103(b); form use is RFO 43.401 and the types are RFO 43.203. A
commercial SF 1449 file takes FAR 52.212-4(c) Changes and never the 52.243
series; a noncommercial file takes the 52.243 clause as awarded; an option
takes the 52.217 clause in the instrument; a bilateral supplemental agreement
takes the covering clause, with mutual agreement of the parties as the last
resort. Where the covering clause cannot be read from the record the wizard
prints "authority from record / RFO-pending" rather than a citation nobody can
stand behind. A negotiation memorandum or a justification is a triggered row,
never block 13 authority, and the simplified path cites FAR 13.106-3 rather
than 15.406-3. NASA Interim NFS 1843 and the Companion Guide are process only
and are not printed in the block 13 blank. The wizard also offers an FPDS fill
sheet to copy; T-Minus does not write to FPDS. The clause delta stays withheld
on IDIQ vehicle and order profiles, so A-2026-0090 is unchanged.

**W3.2 closeout autopilot.** The closeout panel now builds its checklist from
the record — final invoice, final payment, CPARS, property, release of claims,
deobligation — each with its FAR 4.804-5 cite, says plainly whether the file is
ready for transfer, and offers a memorandum to file listing what is still open
with the FAR 4.805 six-year retention date. Nothing is marked complete that the
record does not show, and the panel still appears only on a launched or
Closeout file.

**W3.3 deadline calculus.** A new "Dates this file owes" panel computes the
synopsis response date, size protest window (FAR 19.302(d)(1), five business
days), both CICA stay windows (FAR 33.104(c)(1); 31 U.S.C. 3553(d)(4)), the
option preliminary notice (FAR 52.217-9 as filled in), the CPARS due date and
the retention date, each with calendar or business day counting shown. The
synopsis response period is labelled honestly as a stub because the minimum
period for this method is not verified against the seeded RFO text.

**W3.4 NF 1098 checklist as cover sheet.** The contract file index now reads as
the NF 1098 checklist: every tab, whether it is required for this record,
whether it is present, and the version and date of the latest document, with a
print action for the cover sheet. Missing tabs are still shown as missing;
nothing absent is shown as present.

No external writes were added. Sample 1 and Sample 2 facts, UEIs and evaluation
rows are unchanged, the exclusions sweep still never writes clock or hold
fields, and the Mission Clock Overview was not touched.

## Level-of-effort polish (optional, after Wave 3)

**Requester-visible effort.** Each file card on /requester now carries "What
this buy costs in contracting work": total hours to award, the contracting
officer and specialist split, hours by phase, and the five lines that drive the
effort with the reason each one applies to this record — sole source above the
simplified acquisition threshold, the value tier, cost reimbursement pricing,
services, an order under an existing vehicle. The numbers are the seeded
level-of-effort model run against this record's own facts; they are not Center
averages and they are not rounded to look friendlier. Every task in the model
now carries a plain-words reason alongside its hours. Under the figures sits the
ask this exists for: the technical team provides a work breakdown structure
covering the procurement support work, with the hours as the why. Where no
estimate was saved with the intake the card says so and links to Estimate rather
than implying one was run.

**Days costing.** The requester card's days line now also carries the planned
working days and the honest history range from the confidence model, withheld
where fewer than three comparable prior files exist.

**Queued, not built.** GSA SF 33, SF 26, OF 347 and OF 348 official blanks for
Part 15 fills, on the same pattern as the SF 1449 and SF 30 public forms.
Contracting officer name to Joshua Taggart where a single-name gap appears; the
walked Sample 1 and Sample 2 files keep J. Rivera (fictional CO) so nothing
changes under the demo.

No Sample 1 or Sample 2 facts changed, the SF 30 block 13 authority lock is
untouched, the A-2026-0090 clause delta stays hidden, and no external system is
written.

## Standalone drafts and the situation-memo starter (optional polish after LOE)

Any live template in the catalog can now be drafted onto any open file without
a Required launch-sequence row. On the acquisition file, "Draft a document
outside the sequence" lists every live template; choosing one opens the normal
document writer at `/documents/{templateKey}/{acquisitionId}?standalone=1`,
which drafts from the record and saves versions and exports exactly as today.
The page carries a standalone label so the draft is never read as a required
beat, and no new Required rows are added to any sequence, including Sample 1
and Sample 2.

The situation-memo starter opens a Memorandum for Record on a new purpose,
"Record of an unexpected event affecting the schedule"
(`?standalone=1&situation=1`). The scaffold pulls acquisition id, phase, clock
state, hold reason and owner, target award date and today from the record, and
leaves honest gap prompts for the event, the schedule effect and the action
taken. No citation beyond the template's own FAR 4.801/4.803 badge is asserted.

Not changed: W3.1 SF 30 Item 13 authority rules, the requester LOE/WBS ask,
the Mission Clock Overview, the hard-hidden A-2026-0090 clause delta, Sample
1/2 acquisition facts. No external writes.

Still queued, not built: GSA SF 33 / SF 26 / OF 347 / OF 348 official blanks
for Part 15 fills; CO name to Joshua Taggart where a single-name gap appears
(walked Sample 1/2 Rivera display untouched).

## Unsuccessful-offeror letter: header citation and office code (QA fix)

The page header of the Postaward Notification Letter Unsuccessful Offeror now
follows the method on the record, as the body sections already did. A template
may carry `leadFor` beside `citationFor`, and the document page prints the
method-aware lead and badge once the record has loaded. On A-2027-0101
(FAR 13.5 commercial simplified) the header reads FAR 13.106-3(d) only; the
genuine Part 15 lead and badge still stand on a Part 15 file. The defect-report
citation follows the same value.

Procurement Office code now binds to the contracting office code first and the
requester organization code only as a fallback (`co_code|requester_org_code`),
and a full office code such as ARC-JAZ-01 prints as the office code JAZ.
Verified in the browser: header FAR 13.106-3(d), Procurement Office code JAZ.

Not changed: exclusions sweep stays flag-only, W3.1 SF 30 Item 13 authorities,
the requester LOE/WBS ask, the hidden A-2026-0090 clause delta, and Sample 1/2
evaluation and UEI facts.

## AC-W4-CLIN — editable schedule of line items (Wave 4 P0 #1)

- New table `acquisition_clins` (line item number, description, optional quantity/unit/unit price/amount, source, sort order). Read by anyone signed in; specialists add, edit and remove. Audit log records "CLIN added", "CLIN edited" and "CLIN deleted".
- New `src/lib/clin-schedule.ts`: load, seed-once from `igce_clins` when the schedule is empty (never overwrites an existing schedule), CRUD with audit entries, and `scheduleToScaffoldClins` for the scaffold and packet.
- `buildFormatScaffold` no longer invents CLIN 0001 or an IGCE placeholder 0002. It takes the schedule; an empty schedule prints as empty with an honest line.
- New `ClinSchedulePanel` on the file page beside the format scaffold: add/edit/delete, "Load from the estimate" when the schedule is empty, read-only outside the specialist gate. Estimate-sourced rows are marked "Estimate-sourced (IGCE)".
- Format scaffold and NCMS handoff packet `format_scaffold.clins` now read the same schedule — one source of truth.
- Sample 1 (A-2027-0101) and Sample 2 (A-2027-0102): first open seeds the schedule from their existing IGCE lines, so the scaffold shows the real lines and quantities and narrative-only lines keep blank quantity, unit and price. No invented quantities, no clock or hold changes, no NCMS write-back.
- Cheap W3 polish: "L/M are handoff stubs — not the solicitation of record" chip above Instructions and Evaluation. No authorable L/M.

## AC-W4-LM + AC-W4-METHOD — authorable Section L/M and the method split (Wave 4 P0 #2–3)

- New `solicitation_l`, `solicitation_m`, `solicitation_m_factors` tables: signed-in read,
  specialist write, audit entries "Section L saved", "Section M saved",
  "Evaluation factor added/edited/deleted".
- `src/lib/solicitation-lm.ts` reads the method shell from the record:
  SF 1449 / FAR Parts 12 and 13, or Uniform Contract Format / FAR Part 15.
- `SolicitationKlmPanel` is a first-class workspace on the file in Solicitation/Quote and
  Award — visible without opening the scaffold. K is thin (reps/certs bucket from the
  selected clauses; the Reserved 52.212-5 note stays honest on commercial, no checkbox
  block). L is authorable (volumes, page limit, submission instructions, response note;
  blanks print "Not recorded"). M is authorable (LPTA flag, notes, factors with relative
  importance).
- Sample 1 (A-2027-0101, FAR 13.5 / SF 1449): Part 12/13 voice; the award basis already on
  the file is offered as an LPTA suggestion the officer confirms — nothing is set for them.
- Sample 2 (A-2027-0102, sole source): competitive Section M suppressed in the workspace,
  the scaffold and the packet; the sole-source evaluation path stays.
- Sample 3 (A-2027-0103, FAR 15): UCF and Part 15 voice (FAR 15.203 / 15.304 / 15.305);
  no FAR 13.106-2(b)(3) best-value line on a Part 15 file.
- One source of truth: the scaffold and `format_scaffold` in the handoff packet read the
  saved L/M. The packet now carries `method_label`, `part_family`, `format_source`,
  `section_l` and `section_m`. The chip upgrades to "L/M drafted in T-Minus for handoff —
  NCMS remains the solicitation of record" once anything is saved.
- No clock or hold writes, no invented quantities/awards/rates, no NCMS write-back.
- Cite hygiene: Part 15 LPTA line in `sectionMLines` now cites `FAR 15.305` (already on the
  Sample 3 path) instead of `FAR 15.101-2`; Part 12/13 LPTA cite stays `FAR 13.106-2(b)`.

## AC-W4-ATTACH-J — Section J is the list of attachments (Wave 4 P0)

- New `src/lib/section-j.ts`: `attachmentsForSectionJ` orders the file's real `document_attachments` rows by NF 1098 tab, then label, then when they were attached; blank tabs read "—". Empty list wording is "None attached." — never clause wording.
- New `SectionJPanel` on the file page in Solicitation/quote and Award, visible without opening the scaffold. Columns: NF 1098 tab | Label | File name. Title reads "Attachments for the handoff" on SF 1449 files, "Section J — List of attachments" on UCF files.
- Format scaffold carries `attachments`; the scaffold panel prints the same table, and the UCF A–M table's Section J cell now summarises the attachments ("N files on the record; see the list of attachments below.") and only mentions clauses separately as "Clauses placed in Section J by the matrices" when the matrices actually placed any.
- NCMS handoff packet JSON carries `section_j: { attachments: [...] }`, with `empty_note: "None attached."` only when there are none. Same content as the panel.
- Sample 1 (A-2027-0101) shows its existing attachments (IGCE, SOW, NF 1707, funds certification) with their labels, file names and NF 1098 tab. No attachments invented, no clock or hold change, no NCMS write-back.
- AC-W4-CDRL deferred: not shipped this turn.

## AC-W4-CDRL — CDRL / data requirements (Wave 4)

- New table `acquisition_cdrl`: item number, title, frequency, as-of, distribution, DRD reference, note, order. Signed-in users read; specialists, officers and administrators write. RLS mirrors `acquisition_clins`.
- New `CdrlPanel` sits immediately under the Section J attachments panel on Solicitation/quote and Award, visually distinct (tinted block, heading "CDRL / data requirements"). Add, edit and delete with the specialist write gate; blanks print "Not recorded".
- Empty state reads "No CDRL items on this file." — never clause wording. Section J attachments list is untouched.
- Audit trail: "CDRL item added", "CDRL item edited", "CDRL item deleted" (insert-only audit_log, same pattern as CLINs).
- NCMS handoff packet carries `cdrl: { items: [...] }` beside `section_j`, with `empty_note: "No CDRL items on this file."` only when empty. The format scaffold prints the count under the attachments block.
- Samples 1 and 2 (A-2027-0101, A-2027-0102) have no CDRL rows: nothing seeded, no deliverables, DRD text or citations invented anywhere. No clock or hold change, no NCMS write-back.

## AC-W4-AWARD — Award handoff view (Wave 4)

- New `AwardHandoffPanel` on the Solicitation/quote and Award phases, sitting between the format scaffold and the "Download the handoff packet" link. Collapsed by default on Solicitation/quote, open by default on Award.
- Assembles, in the same order as the local NCMS handoff packet, from the existing sources only: (1) SF 1449 blocks or UCF cover blocks with the format source and method label, (2) line items from `acquisition_clins`, (3) Sections L and M from `solicitation_l` / `solicitation_m` / `solicitation_m_factors` with the sole-source suppression already in place, (4) the ordered clause selection with each reason and matrix fill-in, (5) Section J attachments from `document_attachments`, (6) CDRL rows from `acquisition_cdrl`, (7) an unsigned signature block.
- Nothing is invented: empty schedule, attachments and CDRL print their honest empty wording; signature rows read "Signed in NCMS" and carry no name or date. Chip on the panel: NCMS is the system of record, T-Minus does not write to NCMS.
- Reads the same `formatScaffold` object the download uses, so the view and the downloaded packet cannot disagree. No new packet key was added.
- No SF 33 / SF 26 / OF 347 fill, no payment milestones, no clock or hold change, no Sample 1/2 fact change. Method citations unchanged (FAR 12/13 on simplified, Part 15 voice only on Part 15 files).
- Verify: Files → A-2027-0101 → Award → Award handoff → Open the Award handoff; compare with Download the handoff packet.

## AC-W4-PAY — payment milestones tied to CLINs

- New table `payment_milestones` (event required; due_logic, clin_id/clin_number, amount, percent, notes, sort_order optional). RLS mirrors `acquisition_clins`: authenticated read, specialist/administrator write. Origin + updated_at triggers.
- `src/lib/payment-milestones.ts`: load/create/update/delete, blank fields print "Not recorded", rows with neither amount nor percent are flagged "Neither an amount nor a percentage is recorded."
- `PaymentMilestonesPanel` sits above the CDRL panel on the solicitation/quote and award area; CLIN picker offers only line items already on the schedule — no CLIN is invented.
- One source of truth: the same rows feed the format scaffold count line, the Award handoff panel (new section after CDRL, before signatures), and the packet key `payment_milestones: { items, empty_note? }`.
- Audit: "Payment milestone added/edited/deleted" (insert-only audit_log).
- Walk protection: no milestones seeded on A-2027-0101 or A-2027-0102 — both read "No payment milestones on this file." No clock/hold changes, no invented amounts or rates, no NCMS write-back, no SF33/26/OF347 work.
- Verify: Files → A-2027-0101 → Documents/handoff area → Payment milestones; Open the Award handoff → Payment milestones section.

## WALK 99 P1 — identity, portal redirect, reviewer hero doc

- `t-minus-seed/acquisitions.json`: `co_name` = Joshua Taggart on A-2027-0101 and A-2027-0102 only. Rivera unchanged on 0090/0104 and the rest. No phase, clock_state, hold, or requester change.
- `src/routes/requester-portal.tsx` (new): `/requester-portal` redirects to `/requester`. The working route is unchanged.
- `src/routes/today.tsx`: administrator with no CO-owned files and no files at their Center now sees all prototype files, with a muted note; owner of record stays visible on each row.
- `src/routes/requester.tsx`: same administrator fallback in place of the empty state, with a muted note.
- `src/lib/desk-data.ts`: `heroDocForReviewer(m, reviewerRole, phase)` picks the document of the reviewer's own office across phases — small business → NF 1787, flight operations / aviation → Statement of work, legal → JOFOC/justification, pricing → PNM — else falls back to `heroDocForPhase`. Attachment-only rows return kind `file` and link to the file page.
- `src/routes/reviewer-inbox.tsx`: uses `heroDocForReviewer`, so rows no longer all show the PNM.
- Untouched: A-2026-0090 clause set and hidden clause delta, CDRL/Award/payment work, holds and clock states, NCMS write-back, rates.

## WALK 99 check-in 2 — IDIQ clause packet, Reserved note, Show me the text

- `src/lib/clause-packet.ts`: the vehicle now reaches clause selection. Indefinite
  delivery is read from `scenario.vehicle` (`idiq_award` / `idiq_order` / order
  under), from a recorded parent contract number, or from vehicle/title text —
  not from `contract_type` alone. Commercial is also read from
  `vehicle.clause_set`. A-2026-0090 (FFP, `idiq_award`) now recommends
  52.216-18, 52.216-19, 52.216-22 and the commercial 52.212-* set, with the
  reason naming the source from the record. 52.212-4's reason repeats the
  recorded clause set when it mentions Alternate I; no Alt I clause row was
  invented. 52.212-5 stays excluded (Reserved) and 52.212-3 stays excluded.
  52.216-7 stays cost-reimbursement only. SF 30 clause delta remains hard-hidden
  for IDIQ parent and order profiles.
- `src/lib/explain.ts`: a parent indefinite-delivery vehicle no longer claims a
  single mission. A-2026-0090 reads as a parent vehicle that orders are placed
  against; child orders keep their mission support line.
- `t-minus-seed/acquisitions.json`: A-2026-0090 only — `commercial_determination:
"commercial service"`, matching the vehicle panel. Samples 1 and 2 untouched.
- `src/routes/files_.$acquisitionId.tsx`: the FAR 52.212-5 Reserved note now
  shows on every simplified commercial file regardless of phase, above the launch
  sequence. Sample 1 shows it at Price Reasonableness. The note inside the NCMS
  handoff block is unchanged.
- `src/components/show-the-text.tsx` (new): "Show me the text" shows the
  reference row the prototype holds — citation, tier, source, effective date,
  official link — and states that the regulation paragraph is not loaded. No FAR,
  RFO or NFS body text is generated. Wired into Explain this and the document
  version badge.
- Not published this turn, by instruction.

## AC-W4.5 — Official forms stretch: SF 33, SF 26, OF 347

- Blanks added byte for byte: `public/forms/SF33.pdf`, `public/forms/SF26.pdf`, `public/forms/OF347.pdf`. Field maps kept at `docs/forms/*_FIELD_MAP.md`.
- `src/lib/sf-forms.ts`: `buildSf33`, `buildSf26`, `buildOf347` on the same generator path as SF 1449 and SF 30 (`xfaDatasets` + `exportXfaIncremental` / `exportXdp`). Part 53 prescriptions shown as FAR 53.214(c), FAR 53.214(a) and FAR 53.213(f), each with "Confirm RFO Part 53 if adopted." No FAR or NFS cite invented.
- `src/lib/nf1787.ts`: `FormKey`, `FORM_NAMES`, `GENERATED_FORM_KEYS` and `buildForm` extended; `FormCtx.clins` added as `FormClin[]`.
- `src/routes/forms.$formKey.$acquisitionId.tsx`: the three keys allow-listed; the schedule loads through `ensureClinScheduleFromIgce` / `loadClinSchedule`, never re-typed and never estimated. SF 26 prints rows 1 to 5, OF 347 rows 1 to 13, SF 33 has no face grid.
- Suggested form (`recommendedOfficialForm`): streamlined commercial 1449 files stay on SF 1449 (Sample 1 unchanged, never forced to SF 33); Part 15 uniform format goes to SF 33 (A-2027-0103); an order under an existing contract or a simplified purchase goes to OF 347 with the purchase vs delivery box set from the record; a recorded modification goes to SF 30. Shown as a link on the Award handoff; all other form links stay.
- SF 33: only the primary `LIABILITY1` is filled; `LIABILITY1[1]` is left alone. Offeror blocks 12 to 18 and every signature block stay empty.
- OF 347: page 2 stays empty, `QUANTACCEPTn` stays empty (filled on receipt). WOSB and EDWOSB are left unchecked — the duplicate `WOMEN` / `DISADVANTAGE` instances are ambiguous and the XFA instance binding is a recorded gap. More than thirteen lines: continuation noted in the packet, OF 348 is not generated.
- SF 26: effective date binds `EFECTDATE3`; contractor block 19 and signatures stay empty; total is `F15TOTAL` only when every line carries a recorded amount.
- No NCMS write-back, no FedRAMP claim, no live FPDS. Sample 1 and Sample 2 facts untouched; A-2026-0090 clause delta stays hidden. SF 18 and Wave 5 SEB out of scope. Security findings still deferred.

## AC-W5-SEB (Wave 5 tranche 1) — advisory SEB cockpit

- New `src/lib/lm-consistency.ts`: `lmConsistencyCheck({shell,l,m,factors})` returns `{status,findings}`. Soft reads only — LPTA vs best-value wording mismatch between L and M, best-value with no factors recorded, competitive L/M content on a sole-source shell. Never gates phase exit, hold, clock or required docs. Empty L/M stays quiet ("L and M look consistent on the record").
- New `clarifications` table (acquisition_id, sent_on, topic, recipients, notes) + `src/lib/clarifications.ts`. Read for signed-in; insert/update/delete for specialist/administrator, matching CDRL policy pattern. Audit entries are insert-only. No traffic seeded — Sample 1/2 are empty with "No clarifications recorded on this file."
- `solicitation_m_factors.evidence_note` (nullable text) added; `FactorRow`/`FactorInput` extended, `saveFactorEvidence` writes only that column with an audit line. Soft warn text: "Advisory: no evidence linked to this factor yet — does not hold the file."
- New `src/components/seb-cockpit-panel.tsx` mounted directly under `SolicitationKlmPanel` on the file page — same phase visibility as L/M, no new phase gate. Lamp chip is green Consistent / amber Advisory, always labelled "Advisory — does not hold the file."
- No NCMS write-back, no invented cites, no Part 15 bleed on the simplified Sample 1 path (the lamp quotes no authority text at all). Forms, Walk 99, CLIN/L/M/J/CDRL/Award/Pay untouched.

## Wave 5 remainder — read receipts + briefing polish (AC-W5-RECEIPTS, AC-W5-BRIEF)

- New table `document_read_receipts` (acquisition_id, doc_kind, doc_key, doc_label,
  opened_by, opened_at, poll_id, source). RLS: SELECT/INSERT/UPDATE for signed-in
  users. No seed rows — Sample 1/2 stay empty until a real person opens a document.
- `src/lib/read-receipts.ts`: `recordReadReceipt`, `recordReadReceiptQuietly`,
  `loadReadReceipts`, `loadReceiptsForDoc`, `loadReceiptsForAcquisitions`.
  Dedupe rule chosen: same user + same document within two minutes refreshes
  `opened_at` on the existing row rather than inserting a second row. Audit entry
  "Document opened" is insert-only and best effort; a failed receipt never blocks
  reading the document.
- Opens recorded from: reviewer inbox hero link (carries poll_id, source
  `reviewer-inbox`), `documents/$templateKey/$acquisitionId` on mount
  (`document-route`), `forms/$formKey/$acquisitionId` on mount (`form-route`).
- UI: `ReadReceiptsPanel` on the file page under the evaluation cockpit; empty text
  "No read receipts on this file yet."; chip "Soft tracking — does not hold the file."
  Reviewer inbox rows show "Opened by … · <time>" only when a receipt exists.
- Receipts are advisory: no phase exit, hold, clock or required-doc code reads them.
- Briefing book: new "Schedule and handoff" page with the CLIN count and table
  (empty reads "No line items drawn from this record yet."), the method shell label
  (SF 1449 / Part 12-13 or UCF / Part 15) with competitive vs sole source, the
  Section J attachment count from `attachmentsForSectionJ`, and the Award handoff
  pointer line. Existing pages, chips and the "Synthetic / Prototype — not an
  official NASA system" footer mark are unchanged.
- SF33 Block 11 honesty: the A–M table-of-contents boxes are no longer all checked.
  Only Section B is checked, and only when a schedule exists on the record; every
  other section is left unchecked with a gap note. Citation still FAR 14.201-1 /
  FAR 15.204-1 with confirm-RFO wording.
- No NCMS write-back, no invented traffic, no invented FAR body text. Security
  findings remain deferred.

## Wave 6 — pilot harden + regulation change banner stub

Pilot harden (smoke first, code only where something was actually wrong):

- Signed-in browser pass over A-2027-0101, A-2027-0102, /requester, /today,
  /reviewer-inbox, /clause-changes and /forms/sf-1449/A-2027-0101. No console or
  page errors on any of them. Sample 1 and Sample 2 both still read
  co_name Joshua Taggart and clock_state running; nothing was written to either
  record this wave.
- Wave 4/5 panels (CLIN schedule, Solicitation K/L/M, evaluation cockpit, read
  receipts, Section J, payment milestones, CDRL, Award handoff) render on
  A-2027-0102 with no throw on empty L/M. They sit inside the NCMS handoff block,
  which is still gated to the Solicitation/Quote and Award phases, so Sample 1 at
  Price Reasonableness does not show them. That gate is unchanged and is a
  deliberate phase behaviour, not a break.
- Requester portal: added a soft fallback for a signed-in requester or specialist
  who is named on no request — the two demo files only, with the line
  "Demo files — you are not the requester of record." No requester name was
  invented on either sample; the requester of record still reads from the record.
  The administrator "all files" fallback is unchanged, as is the Today desk and
  the reviewer inbox fallback to open polls.

Regulation change banner stub (`src/components/clause-change-banner.tsx`):

- Reads only open rows from clause_mod_tasks for that acquisition_id. Zero open
  rows renders nothing at all; loading and error states render nothing.
- One line naming the count and up to three clause numbers with their change kind,
  then a link to /clause-changes, then the chip
  "Advisory — does not hold the file."
- Never calls computeHold, never touches clock_state, never gates a phase exit or
  a required document. Hidden in presenter mode, like the other chrome.
- Mounted on the file page above the launch sequence, beside the companion gates.

Unchanged: A-2026-0090 SF 30 clause delta stays hard hidden, no NCMS write-back,
no FedRAMP claim, no invented FAR or NFS body text, no Adobe forms QA claim.
Security findings remain deferred.

## Walk — factory panels visible at Price Reasonableness

The NCMS handoff / factory block on the file page (CLIN schedule, Solicitation
K/L/M, SEB evaluation cockpit, Section J, CDRL, payment milestones, Award
handoff, read receipts, clause packet) was gated only to Solicitation/Quote and
Award. Sample 1 (A-2027-0101) sits at Price Reasonableness, so the factory was
invisible during the walk. Widened that single phase check in
`src/routes/files_.$acquisitionId.tsx` to also render for Technical Evaluation and
Price Reasonableness. Visibility change only — the panels remain advisory, are
not required docs, and do not gate phase exit, hold, or clock. Samples untouched:
A-2027-0101 and A-2027-0102 still read co_name Joshua Taggart and clock_state
running; no acquisition_facts were written. A-2026-0090 clause-delta stays
hard-hidden. Verified via signed-in browser: Sample 1 body now contains the
factory block ("NCMS is the system of record", CLIN, Evaluation cockpit, Read
receipts, Award handoff) at Price Reasonableness; Sample 2 unchanged.

## UX — Mission Clock craft

Visual-only polish of the Overview Mission Clock navy band:

- Status words now render in sentence case on the navy band and the quiet
  status summary below it ("At risk", "On track", "Needs attention",
  "Launched"). Color+word pairing and StatusMark/statusColor are unchanged.
- Lightened `--panel-muted` from #b8c4de to #ccd6f0 so the secondary lines on
  navy read a little brighter, still calm — not white-on-navy.
- Modest row breathing: each priority row on the Mission Clock moved from
  py-5 to py-6 (first/last trimmed) for a bit more gap between the five rows.
  Day figures unchanged at ~48/600 feel. Navy stays the one bold element;
  no seals, rockets, or chrome added.
  No logic changes: urgency ranking, metrics, clocks, holds, and Walk paths are
  untouched. Samples unchanged (Joshua Taggart, running); factory panels stay
  visible at Price Reasonableness. Verified via signed-in browser on the Overview.

## Walk polish — desk demo fixtures

- Today desk: after CO-owned matching, a signed-in requester sees files where they are the requester of record, labelled "Showing files where you are the requester of record." Marsh → Sample 1 only. Specialist/Admin paths unchanged; Joshua Taggart stays CO.
- Reviewer inbox: all-pending fallback copy softened ("No open review names you as the reviewer of record … listed for the walk. The reviewer of record on each row is shown beside it. The hero document still follows that office."). No poll seeds rewritten; heroDocForReviewer and read-receipts unchanged.
- Requester portal own-file match for Dr. Elena Marsh (fictional) → A-2027-0101 verified as already correct; no seed or record changes. Advisories remain non-gating.

## UX — panel-muted contrast bump

- src/styles.css `--panel-muted` `#ccd6f0` → `#dce4f7` for clearer secondary lines on navy `#0f2a5b`, still calm. Visual only; no logic, Walk, or Sample changes.

## Innovator leftover #4 — peer-link strip polish

- `src/routes/files_.$acquisitionId.tsx` Related actions section: `aria-label` "Peer systems" + quiet "Peer systems" lead in muted 13px; NCMS button label "NCMS packet (local — planned write-back)"; footer honesty line "NEAR export and NCMS packet are local files. T-Minus writes nothing to NEAR, NCMS, or SAM.gov." NEAR export, Checks link, last-check stamp kept. Strip not hidden in Presenter mode. Walk, Samples, holds, clocks unchanged.

## Presenter screens-you'd-open beat card (2026-09-16)

- New `PresenterScreensBeat` mounted at main content start in AppShell; visible only in Presenter mode, dismissible, calm border card.
- Copy names NCMS · NEAR · email · spreadsheet vs one T-Minus file; honesty footer: local packet only, T-Minus writes nothing to NCMS, NEAR, or SAM.gov. No write-back claim; Peer systems strip untouched.
- Dismiss remembered via sessionStorage `tminus-presenter-screens-beat`; resets on Presenter OFF→ON so each demo pass shows the beat again.
- No changes to Samples, clocks, phases, holds, factory gate, or 0090 clause delta.

- P1 (2026-09-16): Today next step now speaks the file hero words ("Write the PNM") when a Required document is missing; file header labels the forecast award date honestly when no target_award_date is recorded (A-2027-0101 has none); A-2026-0090 clause packet made visible in Administration so 52.216-18/19/22 and commercial 52.212-4 read on screen, clause delta stays hidden; PNM comparables field now drafts from the recorded comparables check (local prior actions, honestly labelled) instead of "No comparable awards are loaded."

- P0 (2026-09-16): Today desk matching fixed. The contracting officer is matched case-insensitively on full name or surname, an administrator who is on no file as CO now sees every prototype file (not only when their Center holds none), any other account with no Center files falls back to all files with the same "all prototype files are shown" note, and Waiting on me now includes files whose next step is the officer writing or attaching a missing required document, whoever the blocker names. Reviews due, metrics, hero wording, A-2026-0090 and the PNM comparables are untouched; Joshua Taggart stays CO and no clock state changed.

- P2 (2026-09-16): Overview Mission Clock status summary now shows a standalone "Launched" count (all launched files in view, paired with the On track color) before the quieter "Launched this quarter" chip. Visual/copy only; no metrics ranking or urgency logic changed; Sample 1/2 and the Today fix are untouched.

- SF33/SF26 XFA datasets paths flattened to match blank packets: removed the erroneous `topmostSubform.Page1` nest so fields are direct children of `topmostSubform` (e.g. `topmostSubform.CONTRACTNUM`, `topmostSubform.CONTR2`). The SF26 page-number leaf `topmostSubform.PAGE1` keeps its field name. OF347 (`F.P1.*`), SF1449, SF30, NF 1787, pdf-out, and the forms route are untouched. Adobe Reader human check still required before any binding claim; Chrome PDF.js cannot verify XFA binding.

- Walk fix (2026-09-16): Restored Joshua Taggart (Administrator) as the first demo persona in the Try-the-demo switcher. `PersonaRole` now includes `administrator`, `SEEDED_USERS` leads with Joshua (administrator@t-minus.demo, ARC, lands on /today), `userForRole("administrator")` returns Joshua directly, and role-context no longer remaps admin to HQ. The picker now shows six options with Joshua first; demo admin persona gets `roles: ["administrator"]` so Presenter toggle, Today, and admin privileges work via existing `hasRole`. Christina and Roger remain email/password-only and were not added to the switcher. Sample 1/2 clock_state, today.tsx logic, and the auth-screen password path are unchanged. Administrator persona name is now exactly "Joshua Taggart" (matches Sample 1/2 co_name).

- P1 idle polish: PNM comparables field now reports the recorded comparables run (4 prior T-Minus actions, checked Sep 16 08:07) instead of the "no comparable awards are loaded" opener until the officer edits it; file header no longer pairs a day count with "No target award date recorded" (forecast labelled, stand-in stated on its own line); Today's three-things line names target vs forecast award date. Sample 1/2 clocks, phases and CO untouched; no new cites, no external writes.

- Forms route: honest Adobe guidance under the export buttons (export preview vs official blank with data replaced; Chrome/Edge blank face is expected; data-file/Import Data fallback; signatures stay empty; no Adobe field QA claimed) and matching success message after Export form PDF.
- Peer systems strip: added one quiet sentence that the handoff is a local packet and writing into NCMS is planned and not available in this prototype (NCMS system of record, NFS 1804.171). No write-back added.

- Forms route: "View filled preview" outline button added before Export form PDF; scrolls/focuses `#export-preview` heading (id + tabIndex). Export form PDF carries a desktop-Adobe tooltip; short "Prefer the preview below" line sits above the Adobe help copy. Honest Adobe help copy and export/XFA logic unchanged.

- Requester portal: RequesterLoe now receives the honest days-to-award range (conf.sentence) instead of null; "Days to award" cell shows "{n} calendar days" for a number, "No target award date recorded" when null/forecast-only, and launched wording unchanged. No invented hours/rates/peer history; estimator formulas untouched.

- LOE finish: requester cards compute `awardConfidence` once and pass it to `RequesterLoe` as `awardRange`; days-to-award reads `{n} calendar days`, `No target award date recorded` when null, launched wording unchanged. No hours/rates invented; estimator formulas untouched.
- CDRL polish: `CDRL / data requirements` stays distinct from document attachments, now labelled optional with blanks printing "Not recorded" and no Word sidecar; packet keeps `cdrlForPacket` with the honest `No CDRL items on this file.` empty line; Samples 1/2 left empty. Panel already shows at Price Reasonableness / Technical Evaluation alongside the other factory panels.
- W4.1 MVP: new `src/lib/sow-clause-assist.ts` + `SowClauseAssistPanel` suggest only clauses already in the matrix-backed recommendation, from method / contract format / requirement text / SOW-attached cues. Confirm records an audit row and applies nothing; clause application stays in the clause picker. Sample 1 keeps its Part 12 / SF 1449 path — no Part 15 UCF clauses pushed onto it.

- Wave 5 SEB deepen: clarifications ledger is now editable in place (add / edit / delete, each logged) and keeps its honest empty line; the cockpit header states plainly that the panel is advisory and soft and holds no phase exit, hold or required document. L↔M lamp and evidence map unchanged and still warn-only.
- Read receipts: quiet per-document count ("Opened N times by N people — soft tracking") on the document and form pages, hidden when there are no receipts and silent on failure. No sample clock, phase, clause or seed data touched; Samples 0101/0102/0090 unchanged.

- Wave 4 depth #1: payment milestone CLIN picker now shows "number — description"; advisory-only notes for unlinked-when-CLINs-exist and orphaned links appear in the panel, the packet and the handoff table.
- These notes never hold a file or block a phase exit; Samples 0101/0102 keep zero payment rows and an honest empty state with a soft CLIN-schedule hint.

## Wave 4 depth #2 — Award handoff polish (2026-09-16)

- Soft readiness strip on open: cover "K of N not recorded", schedule/attachments/CDRL/payment counts or honest empties, "Signatures: blank on purpose — signed in NCMS"; advisory only, never holds or gates.
- Honest human Adobe Reader field-check sentence beside the suggested-form link; blank XFA in Chrome/PDF.js expected; no Adobe-verified or Roger-ready claim. NCMS chip kept; no invented rows, no clock/seed changes.

## Wave 4 P1 pair — IDIQ order scaffold + situation memo

- Order profiles (order_under_idiq / fss_order) now show an order scaffold: parent contract number or "Not recorded", fair opportunity or recorded exception with FAR 16.505(b) cite (never invented), format/method from the record, a soft "not a stand-alone Part 15 award" chip, and a note that order line items are order specific and the parent ceiling is never an order CLIN. Advisory only; no clause delta surfaced, 0090 delta stays hidden.
- New `src/lib/situation-memo.ts` + `SituationMemoPanel` on the file page: five fixed events, memo shell from record facts only (id, title, CO, center, phase, vendor), blank narrative lines, RFO-pending citation placeholders, copy to clipboard with an optional audit_log entry. Honest "No situation memo started." before a pick.
- No sample clock_state/phase/seed changes, no invented CLINs or payments, no external writes.

## Wave 4 P1 — Tables 12-2 / 12-3 fill-ins

- New `src/lib/table-12-fillins.ts` + `Table12FillinsPanel` under the clause packet: for commercial / SF 1449 / Part 12 files only, rows are a strict subset of the matrix-backed recommended clauses (52.212-3 and Reserved 52.212-5 excluded), tagged Table 12-2 (provision), Table 12-3 (clause), or "Table not confirmed — verify in RFO Part 12" when placement is not settled. NFS clauses carry Interim NFS matrix wording and an "NFS matrix: fill-in required" flag read from `nfs_clause_matrix.fill_in = 'X'`.
- Fill-in slots read from the record only (period of performance, place, CO, value, NAICS, set-aside, contract type, parent contract number, ordering period); anything missing reads "Not recorded". No FAR or NFS body is written.
- Confirm writes audit only (`Table 12 fill-ins confirmed`, field `table_12_fillins`) with a blanks summary; it never applies clauses, never writes to NCMS, and never holds phase exit. Non-commercial files show the honest empty line. No sample clock/phase/seed changes.

## Wave 5 SEB/board light deepen (2026-09-16)

- Evaluation cockpit gains an advisory board-readiness snapshot: clarifications count, evidence-note coverage, L↔M lamp state, and quiet read-receipt note. Counts only; never gates board, file, hold, or phase exit.
- Empty fairness ledger adds a soft line: "Fairness ledger is empty until the office records a clarification." No clarifications, evidence, or scores invented on Samples; clocks, phases, seeds unchanged.

- Wave 4 P1 Section K: added `solicitation_k` (authenticated read, specialist-only write) and `src/lib/solicitation-k.ts`; the K panel now records SAM status, a method-split reps checklist and notes, keeps the matrix K clause list, keeps 52.212-3/52.212-5 out, and keeps `RFO_RESERVED_212_NOTE` on simplified commercial files. Save is specialist-gated and audits "Section K saved"; nothing gates phase exit.
- The handoff packet and Award handoff panel print the same Section K (new section 3, before L/M); NCMS remains the system of record and no external write is made.

- Briefing book now prints "Representations and certifications (Section K)" on the format page from the same `scaffold.sectionK` object the Award handoff view reads: method voice (SAM path vs UCF), SAM status, checklist labels/statuses, K clause numbers, honest empty lines, and the quoted Reserved note on commercial files.
- `AWARD_HANDOFF_POINTER` now names Section K alongside CLIN, L/M, clauses, Section J and signatures. Soft only; nothing gates phase exit and NCMS remains the system of record.

## W4.6 — NF 1098 full assembly polish

- Added `src/lib/nf1098-assembly.ts` and `Nf1098AssemblyPanel`: NF 1098 tabs present (version/date) and required tabs with nothing filed, plus advisory enclosure rows from the record (line items, Section K, L/M, Section J, CDRL, payment milestones, clauses applied of recommended, signatures blank on purpose — signed in NCMS).
- Evidence pack now carries `assembly/nf1098-assembly-checklist.html` and `.csv` from the same builder, and the cover `index.html` gained a Contract-file assembly section with counts and a pointer.
- Advisory only: missing tabs never hold phase exit, no documents or enclosures invented on Samples, no NCMS write-back.

- 2026-09-16: Briefing book now carries a Contract-file assembly counts block (present/missing tabs, recorded/not recorded enclosures) from the same buildNf1098Assembly input as the file page; Award handoff pointer mentions the NF 1098 assembly checklist beside Section K and L/M. Advisory only — NCMS is SoR, no write-back, no gates. Sample clocks/seeds unchanged.

## Wave 6 — pilot harden (2026-09-16)

- Smoke read of Samples: A-2027-0101 running / Price Reasonableness, A-2027-0102 running / Solicitation-Quote, both CO Joshua Taggart with 12 and 10 CLINs; A-2026-0090 launched / Administration. Payment, CDRL and Section K rows are zero on all three — honest empty, nothing invented, no clock/phase/seed change.
- Award handoff reads every scaffold list defensively (blocks, CLINs, attachments, CDRL, payment) so a partial record renders instead of throwing, and adds one soft line when no enclosures are recorded: the packet prints cover blocks only. Advisory, never gates a phase.
- The Adobe honesty line now shows whether or not a form is suggested — one quiet line, no duplicate, no Adobe verification claim and no field-binding work reopened.
- New `PilotKnownGaps` card on About plus `docs/PILOT_KNOWN_GAPS.md`: human-only Adobe field QA, no NCMS write-back (NFS 1804.171 SoR), FPDS sheet is a fill aid not a submission, staff-PII finding deferred and open, advisories never hold a phase exit.

## Wave 6 follow-on — Pilot known gaps on file walk

- File page Peer systems strip now carries a quiet muted 13px Pilot known gaps line + link to /about (Adobe human-only · no NCMS write-back · FPDS fill aid · advisories never hold exit); PresenterScreensBeat adds one bullet pointing at About. Presenter mode keeps it visible.

- Option exercise: SF 30 block 13 authority now reads from modAuthorityText("option_exercise") instead of the administrative FAR 43.103(b)(1) string; Administration block adds the advisory FAR 17.207 checklist (notice, determination, FPDS, SF 30 handoff) with status read only from recorded dates, an honest exercise-window line, and a pointer to Modifications > New modification > Option exercise. Soft only; no phase gate, no NCMS or FPDS write.

- Comparables fallback: local rows label "from T-Minus prior actions — live feed unavailable"; PNM drafts comparables_summary from the recorded check or, when none, prior T-Minus actions on the same NAICS/PSC (draft only, no writes, no invented figures).

## Successor-clock polish (#24)

- Launched files with a PoP end and no linked successor now state the follow-on must start by the computed date (same phase-plan formula) with a pointer to Intake; Overview method copy and the file section both state the clock is advisory only — no holds, no auto-created files.
- Clause fill-ins now read from the record (CO, period of performance, place, ordering period, 52.217-9 notice lead) via src/lib/clause-fillins.ts; shown in the clause picker, format scaffold, handoff packet and Award handoff, with honest "Not recorded" blanks. 52.212-3 / 52.212-5 stay off. Advisory only; NCMS remains the system of record.
- COR / task order request scaffold on awarded, IDIQ and launched Administration files: requester and appointed COR read from the record, short ask plus narrative saved under post_award.cor_to_request with an audit line, copyable memo to file. Advisory only; no NCMS write-back.

## Claude 07:30 P1 — seed persistence for Sample 3, Reserved note verify

- Seed fixtures now carry mission M6 "NOAA Airborne Lidar Support FY27–FY31" and A-2027-0103 retargeted to M6 with need_date 2026-11-01, PoP 2026-11-01/2031-12-31, reimbursable IAA-NOAA-27-0114 scenario. A reseed no longer puts 0103 back on M1 / Arctic Snow Depth / 2027-03-15.
- Verified A-2027-0101 and A-2027-0102 unchanged (0101 M1 / need 2027-03-01, 0102 M2); no clock, phase, CO or mission edits.
- Verified RFO_RESERVED_212_NOTE still renders on the Sample 1 commercial Part 12 / SF 1449 path (file page Reserved clause note and handoff clause list). No checkbox block; 52.212-3 and 52.212-5 stay off the packet.
- Auth untouched. Note for the record: a Lovable publish can drop signed-in sessions; that is a publish side effect, not a Wave 4 change.

## Claude #18 — email drafts from the record, deepened

- New "Requester — missing IGCE" draft, written from the record (id, title, phase, need date, target award date, the Required row's own citation) and offered first when the estimate is outstanding. Unavailable with an honest note when the file already carries an IGCE (A-2027-0101 and A-2027-0102); available on A-2027-0103, where igce_attached is false.
- Added `emailCiteForMethod(acq)` so draft citations stay method-correct in one place: simplified/commercial files use FAR 13.106-3(d) and FAR 13.106-3; negotiated files use FAR 15.506(a) and FAR 15.404-1. No Part 15 citation ever lands on a simplified file.
- Requester nudge now orders the IGCE row first; vendor notice uses the method-correct unsuccessful line, and the successful line stays a courtesy with NCMS as the document of record.
- Copy only — no send, no NCMS/FPDS write, advisory only and never holds a phase exit. Sample clocks, COs, phases and seeds untouched.

## UX story polish (2026-09-16)

- `fileStory` now labels the mission date as "mission milestone" and states "need date / PoP start" separately from the record (one phrase when the ISO dates match, both when they differ); the trailing audit boilerplate moved to a quiet muted provenance line (`fileStoryProvenance`) under the story. The primary story paragraph is `text-[15px] leading-[22px] text-foreground` with `max-w-[80ch]`; no `text-muted-foreground` on the primary line. Global — every file benefits. No seed, clock, CO, phase, or external-write changes.
- Search deepen: clause numbers on the file and a capped slice of recent audit text now match in global search, with a match hint per hit and a prototype label. Print: file page yields story + launch sequence + contract file index only, page break before the index.

- Clause picker calm copy: the none-applied branch now reads "N recommended from the matrix for this method" with a plain sentence (recommended from the PCD/NFS matrices for this buy type; CO chooses; nothing applied until chosen and applied). Soft copy only — never holds a Walk exit. 52.212-3/5 remain Reserved/absent. No seed, clock, phase, or external-write changes.

## Claude #32–#35 (soft)

- #32 One CO per file: documents now take the contracting officer from `acquisition_facts.co_name` always. When no user row matches that name the name still prints and email/phone stay blank; the signed-in persona is never substituted as the file's CO. Audit `actor` still records who clicked.
- #33 CALC+ now runs only for FSS/FAR 8.4 schedule buys or labor-hour / T&M priced requirements. Service PSC and "services/flights" title triggers removed, so Sample 1 (V1A1 aviation charter) records the honest skip line instead of fetching schedule hourly rates. Other market-research paths unchanged.
- #34 "Explain this" now opens a right-side panel (Escape or Close to dismiss) instead of expanding inline, so the officer never loses their place. Same content: why / rule / citation / what clears it.
- #35 Keyboard on Today "Waiting on me" and the Work Queue list: J/K move between rows, E opens that file's launch sequence, W opens its write action when the next step is a write. Ignored in inputs, selects, textareas, contenteditable, and dialogs. Quiet hint line above each list. Advisory only; no clock, phase, seed, or external-system change.

- NFS Companion Guide not-loaded note: ShowTheText now surfaces a quiet muted line ("NFS Companion Guide text is not loaded in this prototype.") whenever a citation names the Companion Guide (NFS CG / Companion Guide). Soft advisory only; no body text invented; no Walk holds. HEAD ~8382cd3b.

## CoS priority — award honesty, SEB brief, requester LOE

- Award handoff: completeness strip is now "Packet completeness — advisory" and adds clause count with the number carrying a Not recorded fill-in, L/M line count, and Section K checklist/SAM status; it states no form is Adobe verified. Clause fill-ins render as label/value lines with blanks flagged "Not recorded — blank" (advisory only; 52.212-3 / 52.212-5 stay Reserved and absent). Signature values read "Blank — signed in NCMS" / "Not recorded — completed in NCMS" with one note that T-Minus stores no signature and does not write to NCMS.
- Capacity item skipped: no FPDS handoff sheet status or NF1098 missing-tab count added — neither exists on the format scaffold, and nothing was invented.
- SEB cockpit: board readiness snapshot compressed into one scannable "Board brief" list (L↔M state plus finding count, clarifications count or none recorded, factor evidence n/n or sole-source/no factors, read receipts "Per-document status below" — no aggregate number invented). Empty states tightened; detail sections unchanged; print-friendly with break-inside-avoid.
- Requester LOE: shows total planned calendar days from the phase plan for this file's type, planned days beside each phase's hours, the award range once, and the count of items still owed. Honest "Phase-plan days are not loaded for this file" when no plan rows match. The duplicate award-range sentence was removed from "Days costing". Display only — no clock recalculation and no write.
- Line item Amount is derived for display as quantity times unit price when the extended price is blank; nothing is written back (schedule table and handoff packet share one helper).
- NF 1098 counts now appear in the Award handoff completeness strip with a Present/Missing explanation on the checklist; a compact FPDS fill-aid summary (recorded / confirm / blank) sits on the file page with the no-submission banner visible; Sources Sought notices are named as their own read-only group in market research with an honest empty state.
- Center configuration: routing CSV gained a downloadable template and a note that applying replaces only matching routing rows; a new reviewer roster CSV (center_code, reviewer_role, name; optional title, email) validates centers and existing reviewer roles, previews every line, skips seeded demo roster names without overwriting them, and audits each applied change. No review rule citation is created and no acquisition is touched.

## Policy-impact simulator advisory banner

- Added a calm advisory banner "Advisory only — no open file is changed by this screen." on /simulate; tightened the no-files-affected empty state to "No open file's rows would change under this what-if." Soft only; no seed/clock changes.

## Class deviation / PCD adoption tracker (advisory) — 2026-09-16

- New "Regulatory baseline & deviations (advisory)" panel on the file page (src/lib/pcd-adoption.ts, src/components/pcd-adoption-panel.tsx): shows the file's regulatory_baseline_date and any linked deviation_requests (type, citation, status/decision) exactly as recorded; empty state "No deviation request is on this file." Never claims RFO Part adoption (links acquisition.gov/far-overhaul); PCD 26-03B noted as the locked clause-matrix/Reserved source only. Never holds a file or blocks a phase exit.
- Companion gates panel now states Companion Guide citations are process guidance, not binding NFS. Typecheck passed; sample files 0101/0102/0103/0090 all 200. Sample seeds/clocks untouched.

- Blackout notice and Draft RFP alert added as named local aids on the acquisition file; PCD panel now says RFO Part overlay not loaded and names the Jul 23 2026 matrix date. Advisory only: no hold, no SAM publish, no email.
- Enterprise PSL above-SAT advisory panel, FAR-vs-statute threshold conflict panel (seeded notes only), and Center-local (local) clause group added to the acquisition file page. Soft advisory; never hold a file or block a phase exit.
- Buying guides & practice guidance panel (RFO hub only; NASA/GSA guides honestly not loaded) and plain-language determination helpers (commerciality / competition / price reasonableness) added to the acquisition file page. Advisory only; no new citations or URLs invented.
- Added Invite another office and Who signed / saved what advisory panels on the acquisition file page. Both read existing polls, review_rules, documents, templates, and audit rows only; invite text is copy-only and no poll rows are created.

- openPolls treats blank or case-insensitive "pending" votes as open (seeded A-2027-0101 pending reviews no longer read as closed); voteLabel shows pending as "Pending" / "No vote recorded yet". No seed changes.

- buildSequence now trusts the recorded current_phase while the clock runs, so Work Queue, Overview, Today, and the file header all show the same phase and next step. Earlier unfinished required rows still show honestly in the sequence; nothing holds a file. Calmer empty copy on CDRL, payment milestones, and Section L/M factors.

- P0.1 Contract file index: one index now lists every document on the file — generated/saved documents (documents + templates) and uploaded attachments. A template with no tab of its own is listed under an honest "N/A" instead of being dropped. Each present row shows tab, document, source (Generated/Uploaded), version, saved date and saver, and opens the official version: the document route for a drafted template, the form route for a generated form (NF 1787 etc.), the stored file for an upload. Missing required tabs stay as advisory rows.
- P0.2 Signed memorandum prose: new shared sanitizer `src/lib/memo-prose.ts` (`humanMemoProse`) strips API/endpoint/URL/query jargon and `[from public data, ...]` tags from memo body fields and rewrites source lines as plain English, keeping counts, dates, NAICS and place of performance. Applied when drafting (`memo-draft.ts`) and when rendering/exporting the NF 1858 body (`nf1858.ts`). One-time cleanup of the saved A-2027-0101 Market Research Memorandum `field_values.research` / `.findings` (document row only; no acquisition_facts or clock change). The research log keeps full source detail.
- P1-A: NF 1858 memorandum exports now carry the agency insignia from the official blank on the first page only (top right, 27.2mm x 24.0mm, public/letterhead/nasa-insignia.png), a blank signature line above the typed name and title, keep-together handling for numbered paragraphs, signature and concurrence blocks, a subject-line running head on continuation pages, and a footer on every page with "Prototype, synthetic data" left and "Page X of Y" right, in Word and PDF.
- P1-C: The insignia is referenced only by the NF 1858 memorandum exporter; no app chrome, Templates page, dashboard or non-letterhead export uses it. Official form overlays keep their own insignia. SF 1449 and SF 30 remain non-Live on the Templates page pending Adobe overlay QA.
- P1-D: humanMemoProse also removes JSON, endpoint and remaining bracketed source tags, reads "query" as "search", "engine" as T-Minus, and "record row" as "record". The research log keeps its source detail unchanged.
- P1-B: NF 1707 and NF 1098 have no official blank in public/forms, so no overlay is shipped and no re-typed lookalike is offered; recorded in docs/PILOT_KNOWN_GAPS.md.
- Official file copy: a saved document version can be filed as the official copy (stored in field_values, one per template per file, audit line). File index, Who signed / saved what, evidence pack and NEAR export prefer the official copy; drafts stay on the record.
- Official file loop: document page shows Route (memo_routing / memo header), concurrence ("Record concurrence" sets reviewed_by/at) and "This is the final version — file it"; filing marks one version per template per file, clears any earlier mark, audits, and offers a soft Unfile. Never holds a file or blocks a phase exit.
- NF 1707 and NF 1098 still have no public blank; the pilot known gaps note stands.

## 2026-09-16

- Official file copy Route: omit empty THRU row (no "Not recorded") per NF 1858 formatting prompt §A.2.

## 2026-09-16

- Official file copy Route: omit empty THRU row (no "Not recorded") per NF 1858 formatting prompt §A.2.

- NEAR crosswalk landed as `src/lib/near-crosswalk.ts` (NEAR File Structure Checklist.xlsx · Crosswalk WSC v3.3, Apr 24) with the honest template-to-unique-id map and lookup helpers.
- Contract file index prefers the Crosswalk tab only where the template carries no tab (NF 1707 intake now reads Tab 13) and sorts by NEAR visual order when mapped; real tabs are never overwritten and no required tab is invented.
- NF 1098 assembly rows show `Tab N · NEAR order N` with the NEAR file element title; the chip states Crosswalk order, advisory only, NCMS remains the system of record. No NF 1098 PDF or lookalike.
- NF 1707 official blank landed at `public/forms/NF1707.pdf`; `nf-1707` wired as a generated form with a header-only overlay (Center, ReqNumber, ReqOrg, RequirementDescription). Sections 1 to 12 still bind from Intake; Adobe field check by a person remains open.
- SF 1449 Adobe QA fail fix: the official blank is Reader-extended (`/Perms` → `/UR3`), so an incremental update left free Adobe Reader treating the fill as tampered and closing it. `buildXfaIncremental` now appends a fresh Catalog copying every key except `/Perms` with raw values (nested refs stay refs), points the update trailer `/Root` at it, and writes `/ID[<hex><hex>]` in the blank's compact form. Behaviour is unchanged for blanks without Perms.
- `exportXfaIncremental` now also writes the companion `.xdp` whenever the blank was rights-enabled, and the forms screen names Import Data as the recommended free Adobe Reader route. No Adobe verification is claimed; SF 1449 and SF 30 stay non-Live.
- File index and NF 1098 assembly now surface Crosswalk WSC "What to File Here" notes verbatim on mapped rows (NEAR order, element title, notes) — advisory only, never holds a phase; NF 1707 form help notes the header-only overlay; pilot known gaps updated (NF 1707 blank landed, NF 1098 blank still N/A, no lookalike).

- P0 form bind fix: exported XFA data now nests each field under the page subform the blank uses (derived from the blank field names, so SF 1449 Page1/Page2 and SF 30 follow the same rule). Booleans still export 1/0; no AcroForm widget fill path exists, so no state mapping was needed. SF 1449 blocks 21 to 23 read line 0001 of the schedule on the file. Perms-strip and Import Data path unchanged; SF 1449 and SF 30 stay non-Live and are not Adobe-verified.

## Forms: checkbox layers and blank-driven page nesting (2026-09-16)

- Added `checkboxXfaValue` (`"1"`/`"0"`) and `checkboxAcroValue` (`"/1"`/`"/Off"`) next to `xfaDatasets` in `src/lib/nf1787.ts`; `xfaDatasets` now calls `checkboxXfaValue`. Reader Import Data binds the XFA datasets layer; the AcroForm widget states on the GSA blanks are `/1` and `/Off`. No AcroForm widget fill engine was added.
- Page-subform nesting is driven by the blank's own field names (`blankPagePaths` / `withPagePaths`), not a hardcoded Page1, and `boundDatasets` applies it to every form: SF 1449, SF 30, SF 33, SF 26, OF 347. Smoke: SF30 `CheckBox9` -> `Page1`, SF33 `SEALED` -> `Page1`, SF26 `FOBORIGIN` -> `Page1`, OF347 `SMALL` -> `F.P1` (OF 347 uses `F/P1`, handled without a special case).
- CLIN smoke on A-2027-0101: `buildSf1449` + `blankPagePaths` + `withPagePaths` + `xfaDatasets` nests under `topmostSubform > Page1` and writes `quantity1` 160, `unit1` hour, `unitprice1` $3,600 from schedule CLIN 0001. Recorded values only; blank when the schedule does not carry them.
- Perms-strip and the Import Data companion path are unchanged. SF 1449, SF 30 and templates remain non-Live; no Adobe desktop verification is claimed.

- W4.3 deepen: payment milestones framed as the invoice plan on the panel, format scaffold, packet JSON and Award handoff section 8. Soft plan advisories only (percent total, not-100% note, plan summary of count/linked/missing value). No gating, no invented rows, samples untouched.

- W4.4: CDRL / data requirements labelled as a distinct block beside document attachments in the panel, format scaffold, handoff packet JSON and Award handoff section 7; soft DRD completeness notes (items, DRD refs, missing frequency/as-of/distribution) and a muted method-aware line (commercial streamlined vs services/R&D). Advisory only — never holds Walk or a phase exit; no DRD text or cites invented; Samples left empty.

## Handoff honesty polish

- Award handoff, NF 1098 assembly, payment milestones, and CDRL empty/advisory lines now use the same calm record-first wording. NF 1098 explicitly remains a checklist from the record, not a filled agency form; Adobe field checks stay human-only, NCMS remains the system of record, and no advisory holds a file or phase exit.

- Wave 5 Board path deepen: boardReadiness now carries a real read-receipt count (null when unread, never invented); cockpit shows a Read receipts line and pointer to the panel below; briefing book Board readiness page prints the same snapshot. Advisory only — nothing holds a file or phase exit.
- W5 fidelity: the shared Board snapshot now carries the record-derived method voice across cockpit and briefing, separates factor and evidence empties, keeps sole-source evaluation explicit, uses an exact uncapped record count for receipts, and omits that line when the count read fails. Advisory only; no clock, hold, phase, required-document, seed, form, or external-write behavior changed.

- Wave 6 pilot harden: shared Pilot known gaps line on Today and Work queue; calm empty states on the weekly digest and reporting views (CSV download disabled when a view holds no rows). Advisory only; no seeds, clocks, forms, or external writes touched.
- NF 1707 overlay is blank-driven: paths read from the blank's own XFA packets, Intake answers written only where the blank carries the field, Import Data companion unchanged.
- Copy finish: stripped engineer internals (widget layer, XFA packets, AcroForm, XFA files) from NF 1707 help, Award handoff, and Pilot known gaps copy. Reads calm to a CO; no logic, cites, or forms touched.
- SF 1449: CLIN line prints only when quantity x unit price equals the amount; commercial single-line files print one lot at the face amount, block 20 narrative wraps across the schedule rows, block 9 code and office name are separate, block 10 carries a percent, and TOTALAWARD is filled. Data file now emits sibling occurrences so indexed fields bind.

## SF 1449 Lot gate fix (soft follow-up)

- `buildSf1449` Lot packaging now fires for any commercial FFP face whose first CLIN does not multiply out, regardless of how many IGCE estimate rows sit behind the file (A-2027-0101 has many). The `length <= 1` check is removed; the face still prints ITEM 0001 = qty 1 / Lot / unit price = amount / amount, and no quantity is invented from hours.
- Block 20 narrative keeps the requirement description and period of performance only; the CLIN description is no longer appended when the requirement description already carries the narrative.

- Soft §1: SF 1449 now exports through a pdf-lib AcroForm pipeline on the official blank (load, deleteXFA, fill, updateFieldAppearances, save) so values show in Reader, Chrome and Preview. XFA/XDP Import Data demoted to a labelled secondary route. Non-Live until a human Adobe check; no Adobe claim.

- Soft: SF 1449 AcroForm field mappings now live as data rows (`src/lib/form-field-mappings.ts`, shaped like a future `form_field_mappings` table) and are applied by `src/lib/apply-form-mappings.ts`; the generator reads the rows instead of a hard-coded field list, keeps the deleteXFA-before-fill pipeline and the Lot CLIN rule, and stays non-Live with no Adobe check.
- Soft: the SF 1449 / SF 30 / OF 347 field mappings now sit in `src/lib/form-field-mappings.json` (229 rows: sf1449 105, sf30 39, of347 85), every pdf_field checked against the official blank at generation time; the SF 1449 adapter emits the nested record paths those rows read. SF 30 and OF 347 are data only, no export button; forms stay non-Live with no Adobe check.

## §3 + §4 — SF 1449 block 9/10/20 defects and CLIN reconciliation (soft)

- Block 9: code box carries the short centre code only; the centre name and branch go in the name/address block.
- Block 10: percent is a number ("100") or empty, never prose.
- Set-aside boxes now come from an explicit programme enum (edwosb > wosb > sdvosb > hubzone > 8(a) > small business), one box only. EDWOSB no longer also ticks WOSB. 8(a) mapped to ACHECKBOX[0]; the substring and roger_sb2 rows are gone.
- Block 20: short requirement title on the priced row, narrative wrapped across the rows beneath.
- Face line: quantity x unit price when it reconciles, else 1/Lot/face for commercial firm fixed price, else all priced columns blank. A quantity is never invented from hours.
- validateSf1449ClinReconciliation compares schedule amounts to the total; the official AcroForm export asks before generating a draft that does not add up.

## §5 — RFP cover letter in Word from the genuine NASA master (Soft)

- Added `public/forms/RFP_COVER_MASTER.docx` (sha256 4e5e9a04…c1c3a, 58,571 bytes) — Roger's genuine NASA RFP cover master, 38 `[[MARKER]]` runs. Not embedded as base64 in source.
- Added `src/lib/apply-docx-markers.ts`: `applyMarkers` (JSZip → rewrite only `word/document.xml` → DEFLATE rezip; empty value deletes the ancestor `<w:p>`), Soft `lintMarkersSplit` naming any marker split across runs, and `readDocumentXml`.
- Added `src/lib/rfp-cover-docx.ts`: marker map ported Softly from Roger's `rfpMarkers` onto FormCtx/acquisition fields; optional passages (phase-in, property, site visit, OCI, security, AI, draft RFP, past performance, SEB, CAGE, price exhibits, blackout) stay empty so their paragraphs disappear. `generateRfpCoverDocx` + `downloadDocxBytes`.
- Forms page: secondary button "Export RFP cover (Word)". SF 1449 AcroForm export stays the primary PDF route; SF 1449/SF 30 remain non-Live and no Adobe verification is claimed.
- Verified in-browser against A-2027-0101-shaped fields: no split markers, 0 markers left in the output, letterhead/styles/footers untouched.
- Honest gap: the 97 HQ templates on disk carry prose "Insert …" placeholders, not `[[MARKER]]` masters. This ship proves the technique on the one genuine master only; authoring or converting markers into the remaining masters is later work.

## Soft §6 — Field scope (one ship)

- `FormFieldMapping` now carries optional `scope` ("organization" | "acquisition" |
  "contract" | "transaction"). Future table column: form_field_mappings(..., scope).
  Missing scope reads as `transaction`, so nothing inherits by accident.
- Every row in `src/lib/form-field-mappings.json` is tagged (230 rows, 0 untagged),
  from the supplied path→scope list; unlisted paths fall to the prefix rules
  (issuing/administering/payment office = organization; acquisition._, requisition._,
  solicitation.number/method = acquisition; contract.number/id_code, contractor.*,
  award.total_amount = contract; everything else transaction).
  Counts: transaction 169, acquisition 27, contract 18, organization 16.
  SF1449 77/16/7/6, SF30 30/1/4/4, OF347 62/10/7/6 (transaction/acquisition/contract/organization).
- `src/lib/field-scope.ts`: INHERIT_ON_NEW_DOCUMENT (acquisition + contract),
  INHERIT_ON_NEW_ORDER (organization + acquisition + contract), scopeOf,
  mappingsInheritable, mappingsTransactionOnly, shouldInheritPath, pathScopeTable,
  splitPathsByInheritance, countByScope.
- PDF fill is unchanged: applyFormMappings ignores scope. Scope is inheritance only.
- Soft UI: `NewOrderPanel` on the acquisition file page, shown when a contract number
  is recorded. "Start a new order from this contract" opens the plan (what copies vs
  what starts blank, with example paths). "Record this plan" writes one audit row:
  "Prototype: inheritance plan ready; full create follows." No acquisition is created,
  no sample file is written, no clock or hold changes.

## Soft §7 — Canonical record and per-form adapters (one ship)

- `src/lib/canonical-adapters.ts`: CanonicalRecord (contract, contractor,
  issuing_office, administering_office, payment_office, delivery, terms,
  classification), `toCanonical(formId, data, { samEntity })`,
  `fromCanonical(formId, canonical)`, `joinNameAddress` (outbound only),
  `partyFromSam` (structured parts when an entity payload is on the record,
  `{}` when absent), `mergeAdapted`, `withCanonical`, `adapterPaths`.
- Address rule: Roger Forms Studio used `splitNameAddress` to break a block
  address back into parts. T-Minus forbids that as the primary inbound path —
  it guesses at the record. Discrete fields and SAM structured components come
  first; a block-only address stays whole on `name_address`; the block a form
  prints is joined on the way out.
- `mergeAdapted` is an empty-safe deep merge: an unrecorded adapted value never
  blanks a value the bag already carries.
- SF1449: `sf1449CtxToRogerData` now ends with
  `withCanonical("sf1449", data, { samEntity: acq.sam_entity ?? null })`, so
  contractor / issuing office / administering office / deliver-to / payment
  office / NAICS and size standard read through the canonical record. Schedule,
  CLIN face-line arithmetic, set-aside flags and Block 9/10 logic from §3–§4 are
  untouched. No address is invented; an empty record stays empty.
- OF347 and SF30 adapters are exported and data-ready; no export UI this ship.
- Forms remain non-Live. No Adobe verification claim.

## §8 Lineage overlay

The form preview can outline where each filled value came from. Scope comes from the §6 mapping rows, joined by field name; a recorded research finding names its source and date when one is stored. The overlay is off by default, is preview only, and changes no exported bytes. Turning it on writes one audit row with the counts. Nothing invents a person, a date or a citation.

## Soft §9 — Pinned blank revision (form_templates registry)

- `src/lib/form-templates.ts` holds the registry in the shape a future table
  `form_templates (form_id, revision, storage_path, sha256, effective_date, superseded_at, mapping_profile, source)` will carry.
- Builtin revisions: SF 1449 11/2021 (`/forms/SF1449.pdf`), SF 30 11/2016 (`/forms/SF30.pdf`), OF 347 02/2012 (`/forms/OF347.pdf`).
- Save version on sf-1449 / sf-30 / of-347 records `__form_revision` in `documents.field_values` (no migration this ship).
- `generateOfficialSf1449Pdf` resolves the blank through `resolveFormTemplate('sf1449', pin)` and passes that revision into `mappingsFor`; an unknown pin falls back to the current builtin rather than naming a blank that does not exist.
- The form page shows "blank revision 11/2021" in the header line and names it in the export message.
- SF 1449 and SF 30 remain non-Live; no Adobe field-by-field check has been made. §10 not started.

## Soft §10 — Generated draft into the evidence pack

- After the SF 1449 official AcroForm export, the same bytes are filed on the contract file through `uploadAttachment` (`sf-1449-official`, "SF 1449 official draft (prototype)"), with an extra `Official form draft filed` audit row naming the blank revision from §9. The RFP cover letter follows the same path (`rfp-cover`).
- The download always happens first. A failed pack write reports honestly and never loses the file.
- This is prototype retention on the file, not a write-back to NCMS. A true server-side (Edge) generate remains a follow-on; this ship generates in the browser and writes into the pack.

## Roger Soft Walk §§1–10 complete — remaining gaps

1. SF Live / Adobe field-by-field verification gate: not done. SF 1449 and SF 30 stay non-Live and no Adobe claim is made.
2. Edge vs client generate: this ship generates in the browser and files into the pack; server-side generate is a follow-on.
3. OF 347 and SF 30 official export: data and mappings only, no export UI.
4. About 96 HQ OP templates still carry prose "Insert…" wording rather than `[[MARKER]]` masters; only the RFP cover master is marker-driven.

## SF 1449 pass — official AcroForm Live, OF 347 and SF 30 shipped

- SF 1449 official AcroForm export is marked **Live** on the form page header; OF 347 and SF 30 read **Ready**. The Adobe claim is unchanged in kind: no field-by-field Adobe verification is asserted, only that the blank's own AcroForm fields carry the values.
- Legacy XFA/XDP exports for SF 1449, SF 30 and OF 347 are demoted behind a collapsed "Legacy XFA and data file routes (not recommended)" panel. They still work; nothing on the Sample walk was removed.
- Block 20: the narrative prints on the face schedule rows. `delivery.see_schedule` is ticked only when the wrapped narrative truly runs past the eight face rows, not on every commercial file.
- Blocks 27a and 27b: the ARE / ARE NOT pairs are read from the record (`sf1449_27a`, `sf1449_27b`, `clauses_are_attached`, `addenda_attached`). When the record says nothing, both boxes stay empty for the contracting officer. The old hardcode from the commercial flag is gone.
- `src/lib/official-acroform-forms.ts` adds `of347CtxToRogerData`, `sf30CtxToRogerData` and `generateOfficialFormPdf`, using the same pipeline: resolve blank by revision, `deleteXFA()`, `applyFormMappings` from the existing mapping rows, appearances, save. Roger's imperative mappers were used as shape reference only; no field names were re-derived.
- Pack retention as in §10: `of-347-official` and `sf-30-official` keys, with the audit row and the honest failure message.
- Signature and contracting officer date blocks stay empty on all three.

## ORBIT visual identity — Chunk 1 frame

Ship SHA: `e1c76d74279f96dfe305ca9f37bbaa3c3c771254` (HEAD).

- The authenticated application frame now uses a near-black console surface for the top strip and left navigation, with NASA blue reserved for structural borders.
- The work area remains a dense, near-white canvas with existing page, table, form, and document layouts unchanged.
- Electric cyan is `#22D3EE` and is reserved for the active navigation marker/text and keyboard focus outlines.
- Open acquisition files show a compact file-context link beneath the primary navigation. The prototype disclaimer remains visible in high-contrast text on the dark footer strip.
- No countdown, phase rail, assistant rename, Executive Overview imagery, form/export behavior, record data, citations, or clock behavior changed in this chunk.

## ORBIT Chunk 2 — Launch Countdown face

- New `src/components/launch-countdown.tsx`: `countdownView(m: AcqMetrics)` pure read-only helper plus `LaunchCountdown` (full face, dark chrome panel, tabular digits) and `LaunchCountdownCompact` (Work Queue / Today rows). Days-only honesty: metrics carry whole days, so the face renders `T− N days` and never fabricates hours/minutes.
- Color rules: running = cyan #22D3EE (digits; darker cyan #0e7490 for compact digits on the light canvas for legibility); hold = muted digits + amber HOLD badge + reason from `hold.reason`; no target date = cyan T− with FORECAST badge (days to the existing `forecastAwardDate`, same fallback math the file header already used); launched = T+ days since award, never red; past target while not launched = T+ N with OVERDUE badge in NASA/at-risk red; scrubbed = muted "Clock stopped". A healthy countdown never renders red; `T− -N` never renders (clamped).
- Wired: acquisition file header (replaces the plain calendar-days figure; acquisition number sits beside the label), Work Queue table cells and card faces, Today "Three things to do next" rows. Executive Overview Mission Clock hero untouched. Successor clock left as-is (shown only where already computed). No clock, hold, award, citation, form, export, or seed logic changed; no new data fetches.

## Claude P0 honesty batch (items 1–4)

- **P0-1 OF 347 mappings.** All 85 `of347` rows retagged `04/2006` → `02/2012` to match the blank and `BUILTIN_FORM_REVISIONS`. `CONTRACTNAME[0]` now reads `contractor.name`; `COMPANYNAME[0]` reads `contractor.company_name`. `mappingsFor` falls back to every row for a form when the named revision carries none — no field name is invented. The form page reads "official PDF export: Ready" only when mapping rows exist; otherwise "Planned".
- **P0-2 SF 30 block 2.** `AmendmentNo[0]` → `modification.number`, `AmendmentNo[1]` → `solicitation.number`, `ModificationNo[0]` → `contract.number`. `sf30CtxToRogerData` no longer writes the contract number into block 2; block 13 checks come from the recorded `sf30_13a/b/c/d`. The form route loads `contract_modifications` for the file; the table is empty today, so block 2 prints empty, which is honest. No mod is seeded.
- **P0-3 SF 1449 schedule overflow.** Face narrative is packed from whole sentences only. When something will not fit, `delivery.see_schedule` is set and the last face line reads `(see continuation sheet)`. CLIN arithmetic and faceLine rules unchanged.
- **P0-4 Templates status truth.** SF 1449, SF 30, NF 1787 and NF 1787A are `live` in the library; `statusLabel`/`statusColor` and the counts read `live` and `current` (case-insensitive) as Live.

## Soft Walk P1 follow-on (after P0 27c72d39)

- P1-A One CO source of truth: the Enterprise/ORBIT Teams transcript no longer
  hardcodes "J. Rivera (fictional CO)"; it prints the title, center and
  `co_name` recorded on A-2027-0101 (Joshua Taggart). Memo Route/From, SF 1449
  `contractingofficer`, SF 30 `NameandTitleOfficer` and Overview owner were
  already record-derived from `acquisition_facts.co_name`; the signed-in person
  is never substituted. Files outside Sample 1/2/0090 keep their own recorded CO.
- P1-B Market research findings prose: when the searches return the same entity
  in more than one geography or source, the paragraph 5 sentence now says the
  figure is de-duplicated and an entity found more than once is counted once.
  No new number is introduced. The stored A-2027-0101 finding carries the same
  sentence.
- P1-C Official exports file as Generated: `fileGeneratedExport` stores the
  bytes and writes a `documents` row against the form's template with
  `field_values.kind = "official-export"`, so the contract file index shows
  origin Generated. No `document_attachments` row is written for these.
- P1-D Legacy XFA/XDP block is quieter: smaller label and buttons, with a line
  saying those routes produce the blank-face path and are not for the recording.
- P1-E `/files/$acquisitionId` shows the loading note until the record is in
  hand, so a client navigation no longer flashes an empty file.

## Soft Walk METHOD GATE (after P0 27c72d39, P1 1e68866c)

- Postaward notification, successful offeror: the letter was the last notice
  still fixed on part 15. It now reads the file's method like the unsuccessful
  letter does. On a commercial simplified / FAR 13.5 / part 12 file the lead,
  the selection, debriefing and closing citations, and the debriefing and
  closing text print under FAR 13.106-3(d): no part 15 debriefing period is
  promised, and the enclosure help says a simplified acquisition has no source
  selection statement, so the line stays blank rather than naming a document
  that does not exist. A real part 15 file keeps the part 15 wording.
- Price negotiation memorandum and unsuccessful letter were already
  method-aware (RFO FAR 12.204(a) / FAR 13.106-3(b)(3) and FAR 13.106-3(d));
  no change was needed and none was made.
- NASA Notification of Procurement Action: interim NFS part 1805 is reserved,
  so the 1805.3 / 1805.302 citations now read NFS CG and the sections are
  marked guidance, with the badge note saying why. No NFS section number was
  invented or added.
- Checked and already correct, so left alone: the Limited Sources Justification
  cites FAR 8.401(b) with the GSAM pointers, not FAR 8.104(b); no generator
  cites FAR 6.301(b)(2) for urgency; the JOFOC badge already records the
  FAR 6.1030 to FAR 6.103 correction; the ANOSCA / notification scenario rows
  already cite NFS CG 1805.31 and 1805.32.
- Honest gap left standing: where a commercial companion citation is not loaded
  in the app's regulatory rows, the letter leaves the line for the contracting
  officer rather than borrowing a part 15 citation.

## ORBIT Chunk 3 — Launch sequence rail

- Added `src/components/launch-sequence-rail.tsx` exporting `LaunchSequenceRail`
  that reads the existing `PhaseView[]` from `buildSequence()` (no new date math,
  no invented hours/minutes). Complete phases show a filled structure node;
  the current phase is lit electric cyan `#22D3EE` with a NOW badge and, only
  when `lifecycle.nextDecision` begins with "Exit", a compact `T− N to exit`
  read from `lifecycle.daysToNextDecision`; upcoming phases are outlined only.
- Wired the rail as a left-side vertical scan on the acquisition file page
  (`src/routes/files_.$acquisitionId.tsx`) via a `lg:grid-cols-[200px_minmax(0,1fr)]`
  layout; the rail is hidden below `lg` (no-print) and sticky on wide screens.
  The existing `<details id="launch-sequence">` panel is untouched.
- Visual/interaction only: no citations, clause logic, AcroForm, export layout,
  seed data, clock/hold/award math, or record writes changed. Prototype footer
  and NASA-insignia-free chrome preserved. FLAG-only clocks; no Clock B.
- Accent cyan `#22D3EE` reserved for the current node and existing countdown/nav
  accents already shipped in Chunks 1–2.

## Soft Walk P0 ship — order, amendment, check-out, index

- OF 347 (P0-1): one row per line item number; a commercial firm fixed price
  file prints one lot at the award face, so the printed lines sum to the grand
  total and to the SF 1449 total (A-2027-0101: 1 Lot, $1,385,000). Estimate
  figures that disagree with the face are never used. Place of performance is
  no longer printed as consignee, inspection point or acceptance point; those
  blocks stay empty unless a ship-to is recorded. Preview and AcroForm export
  share `of347Face` in `src/lib/of347-face.ts`.
- SF 30 (P0-2): block 2 carries the recorded modification number only, with an
  honest note when none is recorded. Block 10A remains the contract number.
  A-2026-0090 has no modification, so block 2 prints empty and the form stays
  Ready. Empty blocks read "Not recorded" rather than an em dash.
- Check-out (P0-3): saved prose stays readable while held. The same person
  under a second account row takes their own document back; another holder is
  named with the time and can be taken over deliberately, recorded in the audit
  log with both names. Nothing saved is deleted.
- Official export status (fold-in): Ready now requires mapping rows and a
  blank that actually loads; otherwise it reads Planned with the reason, and
  the export button says so instead of producing nothing.
- SF 1449 schedule (P1-5): the continuation marker gets a row of its own, so
  the schedule never ends mid-sentence, and it points at the requirement on the
  file rather than a continuation sheet the prototype does not generate.
- File index (P1-6): retired versions are skipped, and a stale hand-uploaded
  SF 1449 is not listed once the official export is on the file.

## Soft Walk value gates — SF 30, memorandum, file index

- A-2026-0090 now carries fictional demo modification P00001 through the
  existing modification record. SF 30 Block 2 receives P00001, while Block
  10A remains contract 80ARC26D0090. No authority or citation was invented,
  and the template remains Ready.
- The A-2027-0101 market-research memorandum now takes its signature name from
  the same record-derived contracting officer as FROM: Joshua Taggart. Source
  prose collapses repeated USAspending history wording, and explains that the
  unique entity figure is de-duplicated across sources and geographies.
- A Generated official SF 1449 now suppresses stale Uploaded SF 1449 rows in
  the contract file index, including older prototype uploads.
- OF 347 face arithmetic and delivery blocks, SF 1449 sentence packing, and
  the continuation marker were not changed.

## Regulation text corpus via /reg-intake (Soft Walk GREEN)

- New table `regulation_sections` holds verbatim regulation and guidance text
  with corpus, corpus_revision, citation, parent_citation, heading, binding,
  source_url, retrieved_at, effective_date, superseded_at and sha256. Live
  indexes on (corpus, citation), (citation) and (corpus, retrieved_at).
  Read: any signed-in user. Write: HQ or administrator only.
- Rows are never updated in place. A new load stamps `superseded_at` on the
  live rows it replaces and inserts the new text, so documents written under
  earlier text stay readable.
- `/reg-intake` keeps all five CSV datasets and the staged-diff-before-write
  pipe, and adds two JSONL types: Regulation text (binding, corpora far_rfo /
  nfs / pcd) and Practice guidance (never binding, corpora far_companion /
  nfs_companion / buying_guide). sha256 is computed when the file omits it.
  The page shows the oldest live retrieved_at per corpus as a reminder; there
  is no fetch on a schedule. On accept it lists live files citing a section
  whose text changed and writes the audit line.
- "Show me the text" now resolves a citation against live sections by exact
  citation string, shows verbatim text with corpus, retrieval date, source
  link and a binding or "Non-binding practice guidance" badge. A precise
  paragraph citation is never widened to its parent section, so FAR 10.002(e)
  stays honestly unresolved while naming FAR 10.002 as what is loaded.
  Unresolved citations keep the official regulatory_refs link; no regulation
  text is ever generated.
- Seeded FAR Part 10 from the public RFO PDF (10 sections, corpus far_rfo,
  revision RFO-PDF-2026-09-17) and one non-binding FAR Companion excerpt.
- Untouched: OF347, SF30, memo, file index, SF1449 schedule, clocks (FLAG-only),
  samples.

## Soft Walk Batch 2 — cite honesty and Show me the text FAR 10 coverage

- `citationTokens()` in `src/lib/cite-stub.ts` now recognises part-level
  citations (`FAR Part 10`, `FAR part 10`, `NFS Part N`, `NFS CG Part N`) in
  addition to numbered sections. The Market Research Memorandum badge
  `FAR Part 10; NFS 1810` now resolves the loaded `far_rfo` row for
  **FAR Part 10** and shows its verbatim text; **NFS 1810** stays unresolved
  with the official link, because no NFS corpus is loaded.
- Precise paragraph citations still never widen to a parent section:
  `FAR 10.002(e)` and `FAR 10.001(a)(3)` remain unresolved, with the
  nearby-loaded-sections note only. `NFS CG 1810.12` remains the honest
  "not loaded" stub. No regulation or NFS text was invented.
- Generators re-checked for the Batch 1 hard cite defects: LSJ is
  `FAR 8.401(b)` + GSAM, urgency JOFOC carries no `FAR 6.301(b)(2)`, no
  `FAR 6.1030` remains outside the correction log, and NPA / ANOSCA cite
  `NFS CG 1805.31` / `NFS CG 1805.32`. No generator change was needed.
  The four HQ Word masters were corrected on the box, outside the app.
- RFP cover master polish skipped: the only "Not recorded" values are the
  required Center, title, and CO fields, where the honest blank is correct.
  No change to `public/forms/RFP_COVER_MASTER.docx` or its marker fill.
- `[fill from template header]` governing-citation stubs left as stubs.
- Untouched: OF347, SF30, memo checkout, file index, SF1449 schedule and
  `packSentences`, clocks (FLAG-only), samples, regulation corpus seed.

## ORBIT Chunk 5 — Executive Overview data hero

Visual-only evolution of the navy Mission Clock band on the Executive Overview. Above the priority-mission rows, the same navy surface now carries a portfolio scan strip: a Launch countdown · Portfolio row of per-acquisition chips (acquisition id, T−/T+ days in tabular numerals, HOLD/FORECAST/OVERDUE badges) driven by the existing countdownView() honesty rules — cyan healthy, muted+amber HOLD, cyan FORECAST, cyan T+ after award, red OVERDUE T+ only; each chip links to the acquisition file. Below it a quiet phase-distribution list (phase label, bar, count) derived only from metrics[].currentPhase — no new date math, no invented hours/minutes. The quiet status summary remains below the band; no competing white hero card, no decorative imagery. Soft Walk forms, regulation corpus, Nova, clocks, seeds, and exports untouched.

## Official blanks and signature-ready fills (Joshua green light)

- Masters in the repo, verified byte-identical to the GSA originals on this date:
  - `public/forms/SF1449.pdf` — SF 1449, current revision **11/2021** (FAR 53.212). Source: https://www.gsa.gov/system/files/SF1449-21.pdf (md5 bfaf2c5cad05246dfd7184b45aa03a4e). Not the SF1449-12a variant.
  - `public/forms/SF30.pdf` — SF 30, current revision **11/2016** (FAR 53.243). Source: https://www.gsa.gov/system/files/SF30-16c.pdf (md5 9d0076c2f99b0eab84901bc4e0bb59a7).
- Filled SF 1449 and SF 30 are generated on those official blanks (XFA layer removed, AcroForm fields written from `acquisition_facts`). Signature and CO date blocks stay empty. Nothing is invented: PIID, UEI, vendor, dollars and dates print only when the record carries them.
- Demo click path added to the file page More menu: "Filled SF 1449 for signature" on SF 1449-shell files (Sample 1 A-2027-0101) and "Filled SF 30 for signature" once a contract number is recorded (A-2026-0090).
- Every form page now carries the banner: prototype, sample where seeded, filled from the T-Minus record for review and signature, not the NCMS document of record (NFS 1804.171).
- FPDS filling sheet (SHA 40f9f05c) unchanged; it remains a fill aid, not a live FPDS submission.

## P0 before morning (Claude audit)

- P0.1 (data, applied outside code — honored by code, not undone): Evaluation of
  Quotations v2 on A-2027-0101 carries real public UEIs — Corsair Aviation, LLC
  (recommended) UEI HCH5G9HLMVZ5, CAGE 7K7J6; Strategic Aviation LLC UEI
  SK4DHMRD7M13; SciFly, LLC UEI R7LBZTAG8N98. acquisition_facts for A-2027-0101
  carries vendor_legal_name / vendor_uei / vendor_cage and proposed_price
  1,385,000, so Checks -> Record vendor lists A-2027-0101 - CORSAIR AVIATION,
  LLC - HCH5G9HLMVZ5.
- P0.2 Ref line: the PNM memo header seeds __method from acquisition_method +
  contract_format before badgeCitation runs, so a simplified file prints
  "RFO FAR 12.204(a); FAR 13.106-3(b)(3)" and never FAR 15.406-3 alone.
  Verified in place this chunk.
- P0.2 export strip: cleanExportText (template-engine.ts) and the memoParagraphs
  clean (nf1858.ts) strip the literal "Draft, confirm." prefix and mid-string
  occurrences as well as "Drafted from the record, confirm." On-screen drafted
  field flags and AI-draft banners are unchanged. Verified in place this chunk.
- P0.3 reserved note: the clause picker now shows, unfolded under the intro,
  "52.212-3 and 52.212-5 are Reserved under RFO FAR Part 12/52; statutory and EO
  terms are prescribed independently via Tables 12-2 and 12-3 (NASA PCD 26-03B /
  clause matrix disposition)." It is a note, not a selectable clause line. No
  52.212-5 checkbox shell, no claim that content folded into 52.212-4.
- P0.3 reasons: each formerly bundled clause reason now adds "Prescribed on its
  own under RFO FAR 12.205; see FAR Tables 12-2 (provisions) and 12-3
  (clauses)." No table row numbers are invented. 52.212-1, 52.212-2 and
  52.212-4 stay on the Sample 1 packet.
- Funds check: acquisition_facts.funds_certified is true for A-2027-0102 and
  docSatisfied reads true/yes/1 from the record regardless of attachments, so
  the Solicitation/Quote row reads certified. No hold was invented.
- P0.4: demo - don't open clause delta on A-2026-0090 / IDIQ vehicle
  (contradictory seeded clause set). Documented rather than re-seeded, to keep
  the Sample walk safe.

## Verify chunk — Sample 1 regulatory walk (read-only, no regressions found)

Checked against the seeded record; no code changes were needed.

1. Companion gates on A-2027-0101 (value 1,450,000; competitive; no IT; no
   hardware deliverable): aviation safety applies (NF 1707 Section 5.V answered
   yes — NPR 7900.3 / NPD 7900.4E / NPR 8715.3 Ch. 7) and NF 1787 small business
   coordination applies (value above the micro-purchase threshold), cited
   "NFS 1819.202-70 (binding); NFS CG 1819.11, guidance". No false positives:
   technical evaluation report reads Not applicable (not sole source above the
   threshold), CIO / IT authorization and Section 508 read Not applicable
   (includes_it false), NPA reads Not applicable (below $7M), ANOSCA Not
   applicable (below $30M).
2. Clause picker: 52.212-5 is skipped in the packet builder and the sanitizer;
   52.212-3 has no applying rule and is skipped as well, so neither can be
   selected. The P0.3 reserved line is visible under the picker intro and the
   fuller RFO_RESERVED_212_NOTE disclosure (Tables 12-2 / 12-3, PCD 26-03B, reps
   and certs in SAM under FAR 52.204-7) is available beside it.
3. NCMS handoff and format scaffold cite NFS 1804.171 throughout; no NFS CG
   1804.11 reference remains anywhere in the app. Price reasonableness reads
   RFO FAR 12.204(a) (with FAR 13.106-3 where simplified procedures apply). The
   commercial simplified phase citations use FAR 12.603 / RFO FAR 12.201-1 /
   FAR 13.302-3; the only FAR 15.504 citation sits in the Part 15 negotiated
   phase map and never reaches a commercial file.
4. Sample 2 (A-2027-0102): JOFOC authority on the record reads 41 U.S.C. 1901
   (FAR 12.102 procedures; only one responsible source under RFO FAR 6.103-1);
   the technical evaluation report gate applies (sole source at $820,000, above
   the simplified acquisition threshold); the P0.3 reserved note is the same
   shared string and shows on this file too.

No residual citation bugs found in this pass.

## P0.2 / P0.4 — PNM Ref citation + export strip + demo note

- NF 1858 memo header Ref/badge on simplified files resolves to **RFO FAR 12.204(a); FAR 13.106-3(b)(3)** — never bare FAR 15.406-3. Verified live on A-2027-0101 in demo mode (badge line reads "RFO FAR 12.204(a); FAR 13.106-3(b)(3) · Binding", no pair leak, no Part 15 citation).
- Export stripping of "Draft, confirm." present in both `template-engine.ts` `cleanExportText` and `nf1858.ts` `memoParagraphs`; on-screen "Drafted from the record — confirm." stays UI-only.
- demo: don't open clause delta on A-2026-0090 / IDIQ vehicle (contradictory seeded clause set).

## UX P1 — Button merge / PNM hero label / Overview status casing

- `button.tsx`: `cn(buttonVariants({ variant, size }), className)` — className no longer passed into `buttonVariants`, so caller `whitespace-normal` wins over base `whitespace-nowrap` via twMerge. Hero CTAs no longer truncate/cramp.
- File hero action labels: `pnm` generator → "Write the PNM"; `market-research-memo` → "Write the memorandum"; `nf-1787`/`nf-1787a` retained; IGCE/SOW-PWS attach labels retained. Labels only — no attach/generate behavior changed.
- Executive Overview `MissionClockRow`: status rendered via `statusWord()` (sentence case: "At risk" / "Needs attention" / "On track" / "Launched"), no `uppercase`/`tracking-wide` on the status word; color marker paired with the word. Summary cards already sentence case.
- Smoke: `/` and `/files/A-2027-0101` returned 200. Sample 1/2 seeds untouched.

## Sample 1 QA — PNM draft chips, prefill, index tab 065

- Draft wording ("Drafted from the record, confirm." / "Draft, confirm.") is stripped from prefilled and stored field bodies on the document form; the flag stays as a chip beside the field. Applies to the PNM negotiation summary and determination statement.
- PNM prefill on simplified commercial files already fills Basis of the IGCE, Certified cost or pricing data ("Not required; commercial products or services (FAR 15.403-1(b)(3))") and Date of determination from the record; unchanged.
- PNM cites unchanged: RFO FAR 12.204(a); FAR 13.106-3(b)(3) on simplified files, never a bare FAR 15.406-3.
- NF 1098 tab 065 is display-only and gates nothing; saving the generated PNM satisfies it. No seed change.
- CO of record on A-2027-0101 stays J. Rivera (fictional CO); the signed-in admin name is never substituted.
- P0.3 reserved-clause note stays visible on the Sample 1 clause packet UI.

## Walk QA Sample 1 — unstick

- PNM body text carries no draft wording; the "Drafted from the record — confirm." flag is a chip beside the field only (document form, prefilled and stored values alike).
- A saved PNM version 1 now exists on A-2027-0101, drafted from the record (IGCE basis, technique, negotiation summary, certified cost or pricing data "Not required; commercial products or services (FAR 15.403-1(b)(3))", determination, date of determination). NF 1098 tab 065 is satisfied for the Walk. No seed row rewritten; the evaluation record, UEI HCH5G9HLMVZ5, prices and clock are untouched.
- Contracting officer of record on A-2027-0101 restored to J. Rivera (fictional CO) on the file header, evaluation and PNM sign-off; the signed-in admin name is never written onto the synthetic file.
- P0.3 reserved-clause note stays visible on the Sample 1 clause packet.
- PNM citations unchanged: RFO FAR 12.204(a); FAR 13.106-3(b)(3) on simplified files.

## P0 Walk fix — exclusions, Why panel, dates

- The nightly exclusions sweep matches by exact UEI only and never reads an entity registration response as exclusion evidence. It never writes clock_state, hold_reason, hold_owner or hold_started_at. A real exclusion record now raises a review flag on the record (scenario._exclusion_review with cause, UEI, source and time) and audits "Exclusion review flag set — CO review".
- A clean live SAM.gov read ("No active exclusion") on the record clears that review flag automatically and audits the UEI and the time — from the live check on the file page and from the sweep itself. Neither path touches the clock.
- Why, for an exclusion question, names cause, vendor UEI, source and the time read, with the clearing step, instead of the generic hold text.
- Calendar formatting accepts a full timestamp as well as a date, so "Last check" shows a real date on Sample 1 and Sample 2 instead of Invalid Date.
- Unchanged and confirmed: FAR 13.106-3(d) on the simplified unsuccessful-quoter letters with no Part 15 debriefing or Source Selection Statement, JAZ procurement office, CO email bound from the users row, the 52.212-5 Reserved note on the Sample 1 clause packet, and the withheld clause delta on A-2026-0090.

## AC-W4.5 — SF 33 / SF 26 / OF 347 official fills

- Official blanks in public/forms/ (SF33.pdf, SF26.pdf, OF347.pdf) are byte-identical to the supplied GSA files; field maps kept under docs/forms/.
- buildSf33, buildSf26 and buildOf347 sit beside buildSf1449 and buildSf30 on the same XFA path (xfaDatasets, incremental export and companion data file). No second PDF stack.
- recommendedOfficialForm: a recorded modification points at SF 30; a record naming SF 26 points at SF 26; commercial streamlined (Sample 1) points at SF 1449, never forced to SF 33; an order under an existing contract or a simplified purchase points at OF 347; everything else negotiated in the uniform format points at SF 33. A suggestion only — every other form stays reachable.
- Signature fields are never filled on any of the three; offeror and contractor blocks stay empty; missing government fields are flagged as gaps rather than guessed.
- The forms page description now names SF 33, SF 26 and OF 347.

## Today desk — administrator view (QA fail fix)

- `src/routes/today.tsx`: an administrator now always sees every prototype file,
  with the files that list them as contracting officer read first. The previous
  rule only fell back to all files when no file named them as CO, so
  A-2027-0101 (CO J. Rivera, fictional) disappeared from Joshua's desk while
  A-2027-0102 (CO Joshua Taggart) stayed. Note copy states which view is shown.
- CO match stays case-insensitive on full name or surname; no `co_name` rewrite,
  no clock or phase change.
- Verified in the record: A-2027-0101 running / Price Reasonableness /
  no target award date; A-2027-0102 running / Solicitation/Quote.

## Checks this turn

- nextAction already resolves to the file hero label when a Required document is
  missing (`metrics.ts:326`, `nextAction: heroLabel ?? nextDecision`).
- File header never claims a target award date it does not have: with none
  recorded the countdown reads `FORECAST · days to the forecast award date; no
target recorded`, or `No target award date recorded` when no forecast exists.
- A-2026-0090: vehicle `idiq_award` → profile `idiq_parent` → clause delta stays
  hard-hidden on the file page and the modifications panel. Story text is the
  multiple-award IDIQ vehicle, no Arctic campaign wording.
- A-2027-0101 comparables: the recorded check (16 Sep 2026 14:34 UTC) carries five
  T-Minus prior actions, labelled "from T-Minus prior actions — live feed
  unavailable". The PNM paragraph reports them; nothing invented.

## PCD adoption deepening + Blackout / Draft RFP notice groups

- `src/lib/pcd-adoption.ts`: added `PCD_MATRIX_BASELINE` (read from `about.ts`
  `SEED_SOURCES` — NFS interim rule Jul 23 2026, PCD 26-03B clause matrix,
  NFS applicability matrix; no new date invented), `PCD_BASELINE_VS_FILE_NOTE`
  distinguishing the policy issuance date from the file's
  `regulatory_baseline_date`, and `COMPANION_GUIDE_TIER_NOTE` which states the
  Companion Guide is process guidance, never binding, and reuses
  `NFS_CG_NOT_LOADED_NOTE`.
- `deviationStatusLine` now reports open/pending/blank status as "still open —
  no decision is recorded". No votes counted, no board outcome inferred. Empty
  case still reads "No deviation request is on this file."
- `src/components/pcd-adoption-panel.tsx`: shows the matrix baseline rows plus
  both notes alongside the file baseline date. Advisory; no holds.
- `src/lib/market-research.functions.ts`: `blackoutNotices` and
  `draftRfpNotices` filtered out of the same read-only SAM.gov notice search.
- `src/components/market-research-engine.tsx`: shared `NoticeGroup` renders
  Sources Sought, Blackout notice and Draft RFP groups, each with the honest
  empty state "No Blackout / Draft RFP notices loaded for this ... window" and
  the reminder that T-Minus never posts to SAM.gov. Soft advisory only.
- No seed rewrites (0101/0102/0103), no clock or hold changes.

## P0 form BIND fix (SF1449 / SF30 Import Data)

- Verified the data file nests each field under the page subform read from the
  official blank: `<topmostSubform><Page1><reqnumber>…`. Page comes from the
  blank's own field names, so SF30 (and any page-2 field) binds without a
  separate rule.
- Checkbox values in the datasets are `1`/`0`; the AcroForm layer maps to
  `/1`/`/Off`.
- `faceLine` now reconciles the priced row against the first schedule line's
  own extended price as well as the face amount. A-2027-0101 block 21 to 24
  prints 160 / hour / $3,600 / $576,000 from CLIN 0001; block 26 still carries
  the face amount. Nothing reconciling stays blank; the commercial single-lot
  fallback is unchanged.
- Perms-strip and the companion Import Data path are unchanged. SF1449 and
  SF30 remain non-Live and are not Adobe-verified.

## Soft §2 — form_field_mappings as data

- `src/lib/form-field-mappings.json` now carries 233 rows: sf1449 109, sf30 39,
  of347 85. Added the three date boxes the SF 1449 list named (Date[0], Date[1],
  Date[2]); each stays empty until a person signs or a date is recorded.
- Every sf1449 row was checked against the official blank: no row names a field
  the blank does not carry.
- `form-field-mappings.ts` (types, FORM_FIELD_MAPPINGS, mappingsFor) and
  `apply-form-mappings.ts` (applyFormMappings, pdfText/pdfMoney/pdfCheck,
  match rules eq | includes | includes_any | truthy | array_includes |
  roger_sb2) are the only path the SF 1449 fill uses.
- `official-acroform-sf1449.ts` deletes the XFA layer before writing and fills
  through `mappingsFor('sf1449', revision)` against nested record paths.
- SF 30 and OF 347 rows remain data only; no UI. Forms stay non-Live and are
  not Adobe-verified. Clocks stay FLAG-only.

## Soft Walk P0 — Joshua Taggart output lock

- Live records verified: A-2026-0090, A-2027-0101 and A-2027-0102 name
  Joshua Taggart as contracting officer; A-2027-0103 remains J. Rivera
  (fictional CO). No clock or phase changed.
- The 0090 fixture now also names Joshua Taggart, matching the already-correct
  0101 and 0102 fixtures so a reset cannot regress the Soft Walk outputs.
- Market Research Memorandum headers force both FROM and `signatureName` from
  the file's current `co_name`; the saved 0101 header already names Joshua.
- SF 1449, OF 347 and SF 30 continue to read their officer name only from
  `co_name`. The commercial SF 1449 face remains 1 Lot at the recorded face
  amount when CLIN 0001 is only part of that amount.

- Exec Overview portfolio scan chips: mission/title heading, quieter tabular A-number, phase chip, existing countdownView face (T-/HOLD/FORECAST/T+ tones unchanged), optional hold reason. Dense dark console cards with cyan hover accent. No form, clock, seed, or citation changes.

- Soft Walk: JOFOC Word fills the NASA OP master `public/forms/JOFOC_MASTER.docx` instead of building docx from scratch. Who signs is amount-driven: `selectJofocSigBand` reads the live JOFOC approval-tier thresholds (same names as `jofocApprovalTier`, fallbacks 900,000 / 20,000,000 / 150,000,000) and prints exactly one `SIG_BAND_*` page — the three unused bands delete. Signature lines stay blank (typed name and title only, never auto-inked). Soft Walk `co_name` fills `[[CO_NAME]]` on the active band only; it does not collapse the ladder. Prototype footer retained; PDF path unchanged; Soft Walk forms untouched.

## Soft Walk #2 — ORBIT chrome + scanning (chrome only)

Left rail: clearer meaning-mapped icons, labels always visible (icon-only only when
the rail is collapsed), letterspaced group headings, electric-cyan active item with a
quiet cyan wash. Chrome: layered near-black gradient on the top strip, rail and footer;
top strip sticky. Scanning: Mission Clock band is now a deep console panel with depth;
portfolio chips carry inner-light/elevation. Landing: dark mission entry with cyan
primary action; "Prototype. Not an official NASA system." stays legible. Countdown
chips: awarded-elapsed now carries a cyan AWARDED badge so T+ never reads as red
OVERDUE. Work surfaces: page-title accent rule and a whisper of elevation only.
No forms, exports, citations, clocks, holds or record logic touched.

## Soft Walk — clause-delta note + Show-me-the-text honesty

- A-2026-0090 (IDIQ parent and orders under it): the two conflicting notes are consolidated into one
  shared `IDIQ_CLAUSE_DELTA_WITHHELD_NOTE` (clause-packet.ts), used on the clause packet, the SF 30
  panel, and the modifications panel. The delta is withheld and not shown; the "don't open" /
  "illustrative delta" wording is removed. No clause-delta UI was re-enabled.
- Show me the text: when `regulation_sections` resolves a heading for a citation, the global
  "full FAR/RFO/NFS text is not loaded" stub is no longer shown. Body present renders verbatim with
  corpus, retrieved_at, binding badge and official link; heading-only says "heading loaded; body text
  not yet ingested". Unresolved citations stay unresolved with the official link; NFS CG stays honest.
- FAR Part 10 verbatim bodies (Part 10, 10.000, 10.001, 10.001(a)-(f), 10.002, corpus far_rfo,
  revision RFO-PDF-2026-09-17) were already ingested and match the supplied seed file; no re-ingest
  and no invented FAR 10.002(e).
- Forms untouched: AcroForm/pdf-lib, SF1449/SF30/OF347, packSentences, file index, JOFOC Word master.

## Soft Walk P0-1 — JOFOC OP master and Item 6 honesty

- `public/forms/JOFOC_MASTER.docx` was rebuilt from the authoritative HQ OP JOFOC (7) package while keeping no headers and no word/media. The live export still fetches `/forms/JOFOC_MASTER.docx`, lints marker runs, and applies marker replacement only.
- The JOFOC Word export now writes Item 6 as named-source sentences: System for Award Management (SAM.gov), USAspending, SBA size standards, and prior T-Minus actions under the record NAICS when present. Raw dates, counts, service errors, API labels, and endpoint tags stay out of the signed body.
- The amount-driven signature ladder remains live-threshold based. Sample 2 at the recorded $820,000 value selects Band 1 only: L. Park technical representative and Joshua Taggart contracting officer, with other signature bands removed and signature lines blank.
- Protected surfaces stayed locked: no SF1449/OF347/SF30/pdf-lib/packSentences/file-index changes, no sample fact/clock/citation/clause changes, no external writes, and no Clock B.

## Soft Walk — SF 30 dense fill for A-2026-0090

- SF 30 keeps the deleteXFA to pdf-lib AcroForm path on the official blank; no XFA write path, no invented field names.
- Mapping rows aligned to the blank's own geometry: Code[0] issued by, Code[2] administered by, Code[1] contractor.
- Block 8 stays empty on a multiple-award vehicle; no holder is named.
- Block 14 continuation writes to page 2 only when the recorded prose runs past block 14.
- Accounting reads a recorded funding line only; no money or accounting string is invented.
- A "Blocks left empty, and why" list on the SF 30 form page names each honest blank.

## Soft Walk JOFOC residual — Item 8 and authority correction

- Replaced `public/forms/JOFOC_MASTER.docx` with the supplied residual HQ JOFOC (7) markerized master. It has no headers and no `word/media`; the footer carries `Rev.: 4/2026`.
- Market research remains under Item 8 / `FAR 6.104-1(a)(8)` with named-source prose only: SAM.gov, USAspending, SBA size standards, and prior T-Minus actions under the record NAICS. Raw dates, counts, service errors, API labels, and endpoint tags stay out of the signed body.
- Item 4 now accepts recorded `41 U.S.C. 1901` or `41 U.S.C. 1903`; the empty fallback is neutral (`41 U.S.C. 1901 or 1903 (FAR 12.102 procedures)`).
- Bracketed drafting instructions such as “DO NOT delete the FAR references...” are stripped from JOFOC marker values and are absent from the master.
- Protected surfaces stayed locked: SF1449, OF347, SF30, sample clocks, sample facts, ORBIT chrome, regulation corpus, clauses, and external-write boundaries were not touched.

## Soft Walk JOFOC Item 4 — single statutory authority

- `jofocMarkers` on the commercial FAR 12.102 / 41 U.S.C. path now prints exactly one statute (1901 or 1903) in `[[AUTHORITY_41USC_LINE]]`; `[[AUTHORITY_10USC_STEM]]`, `[[AUTHORITY_10USC_LINE]]`, and `[[AUTHORITY_OR_TOKEN]]` stay empty so applyMarkers deletes those paragraphs. Embedded FAR 6.103-1 basis text no longer implies a Title 10 path, and no dangling 10 U.S.C. 3204(a) stem can print.
- Item 8: "prior T-Minus actions" is normalized to one label (no duplicate), and the recorded search date plus headline result count are written as prose when the record holds them.
- Untouched: SF1449 / OF347 / SF30, Band 1 signature ladder, sample money, clocks, corpus, ORBIT.

## Soft Walk — P0 generator fixes (SF1449 continuation, SF30 block 13, JOFOC Item 4)

- SF 1449: the official back-page rows (schedule 9 to 36) are now mapped. Text that does not fit on the face prints there and the face marker reads "(continued on the schedule, block 20, page 2)". Where everything fits, no continuation marker is printed at all. Receiving report blocks 32-42 are untouched.
- SF 30: block 13 boxes and the authority blank beside them are derived together. A recorded flag rules; a named modification type selects its own block and authority text; an unnamed type stays in 13D with the blank left empty rather than a guess.
- JOFOC: a commercial sole source under FAR 12.102 prints exactly one statute, 41 U.S.C. 1901, with the 10 U.S.C. stem, line and "or" markers empty so those paragraphs delete.

## Soft Walk — SF 30 block 13 honesty (P0-2 residual)

- Block 13D is ticked only when the record carries the authority the block asks the writer to specify. Where the authority is genuinely unknown, block 13 is left unmarked rather than ticked and blank; the gap shows on the form page. A named modification type still selects its own block and authority. Nothing is invented; block 14 description is separate.

## Soft Walk — LSJ Word (limited-sources-justification)

- Installed `public/forms/LSJ_MASTER.docx` (sha256 b6d7cde219931fdcf0c0fa9ccb29fd0eea3ea00f8b7df828e6caa210dfe71950) and `src/lib/lsj-docx.ts`.
- Export Word on `/documents/limited-sources-justification/<id>` now writes into the NASA OP master via applyMarkers; the scratch Packer path no longer runs for LSJ.
- Amount-driven signature ladder: exactly one SIG_BAND_* prints, inactive bands delete. Signature underscore lines stay blank.
- Authority lines are the Batch2 FAR 8.401(b)/GSAM face strings only; FAR 8.104(b) never printed.
- SF1449, SF30, OF347, JOFOC master and generator untouched.

## ORBIT Chunk 4 — Nova (visual/interaction only)

Nova ships as a quiet, click-only cited-answer panel: outline control (no auto-open, no audio, no avatar),
scoped label from acquisition / document / row context, AI-draft disclosure, source list with tier and
effective date, keyboard focus on open and Escape to close. Nova makes no record writes and reuses the
existing cite-or-refuse server behavior. Placed in the app-shell header, document and form action areas,
and beside acquisition-file hold/document rows. Orby untouched. Soft Walk forms (OF347, SF30, market
research memo, SF1449 schedule packSentences) and the regulatory corpus untouched.

## Soft Walk P0 — JOFOC Item 4 single authority

- Commercial sole source (41 U.S.C. 1901/1903 or FAR 12.102 face) prints exactly one statute, taken from the record: 1903 when the record cites 1903, otherwise 1901. The FAR 12.102 override that forced 1901 is gone.
- An embedded FAR 6.103-n basis mention inside a 41 U.S.C./12.102 authority no longer selects the Title 10 path; AUTHORITY_10USC_STEM, AUTHORITY_10USC_LINE and AUTHORITY_OR_TOKEN stay empty so applyMarkers deletes those paragraphs.
- Item 8 prose keeps one "prior T-Minus actions" label and states the search date and headline result count in a sentence.
- No letterhead, no word/media, no headers on the JOFOC master. SF1449, OF347, SF30 and corpus untouched.

## Soft Walk — LSJ Word verification (tip after 0ad0725c)

Verified by generating real LSJ_MASTER.docx bytes and reading word/document.xml back:

- 0 unresolved `[[...]]` markers remain after applyMarkers (master holds 193 markers, all resolved).
- Exactly one SIG_BAND_* survives; the rest resolve to "" and their paragraphs delete.
  $1,385,000 selects GT_900K_LE_20M (CO + Competition Advocate); HCA/SPE pages absent.
- Exactly one authority line prints, FAR 8.401(b)/GSAM 538.7104-*; zero 8.104(b).
- LSJ_AUTH_CITATIONS matches the Soft Walk Batch2 pack verbatim for all six keys.
- [[CO_NAME]] = record co_name (Joshua Taggart on the samples); signature rules stay blank.
  Export path: /documents/limited-sources-justification/<id> -> Export Word -> generateLsjDocx -> applyMarkers.
  No Scratch Packer. SF1449 / OF347 / SF30 / JOFOC untouched.

## Soft Walk P1 stretch (after fe4c60a1) — Batch2 cite verify + Part-token check

Ship A — verified on the live tip, no rewrite needed (verify-only; nothing was edited):

- LSJ face lines are FAR 8.401(b) / GSAM 538.7104-*. Zero occurrences of 8.104(b) as a face cite
  (src/lib/lsj-docx.ts, src/lib/templates-hq4.ts).
- No FAR 6.301(b)(2) exists anywhere in src; the urgency JOFOC path cites 10 U.S.C. 3204(a)(2),
  FAR 6.103-2 and FAR 6.104-1(a)(n). Nothing emits the wrong 30-day posting paragraph.
- JOFOC badge and face cite FAR 6.103. "FAR 6.1030" survives only as a recorded HQ-template
  correction entry ("FAR 6.1030 to FAR 6.103") and in the seed defect note — never as a live cite.
- NPA/ANOSCA carry NFS Companion Guide process labels and say Interim NFS part 1805 is reserved,
  so the 1805 process language is guidance, not binding CFR text.
- Sample 1 (A-2027-0101, FAR 13.5 commercial simplified, SF 1449 streamlined) resolves the PNM
  price-reasonableness cite to RFO FAR 12.204(a) with FAR 13.106-3; the Part 15 (15.406-3 /
  15.404-1) branch is not taken. Same for Sample 2.

Ship B — citationTokens() already recognises "FAR Part N", "NFS Part N" and "NFS CG Part N"
(the Part keyword is optional in the token regex, and the token keeps the Part form so it matches
the corpus row). Live corpus check: FAR Part 10 resolves to a loaded far_rfo row; NFS 1810 /
NFS Part 1810 and NFS CG 1810.12(c) resolve to their own loaded rows. resolveSections still refuses
to widen a precise cite such as FAR 10.002(e) to its parent, so missing paragraphs stay honest
stubs. No body text was invented and no corpus row was added or edited in this ship.

- Soft Walk P1-1: the Unusual and Compelling Urgency JOFOC now exports Word from the NASA OP cite-fixed master `public/forms/JOFOC_URGENCY_MASTER.docx` through `src/lib/jofoc-urgency-docx.ts` (`generateJofocUrgencyDocx` -> `applyMarkers`), never scratch OOXML. The installed master has the instruction pages and the Document History Log removed, HQ Artemis example prose removed, and marker runs in their place; signature underscores stay blank ink. Who signs stays the amount-driven ladder — the shared `selectJofocSigBand` prints exactly one `SIG_BAND_*` page and deletes the other three, and Soft Walk `co_name` (Joshua Taggart on Soft Walk samples) fills `[[CO_NAME]]` on the active band only. Face authority is the recorded urgency authority or the OP line 10 U.S.C. 3204(a)(2) / FAR 6.103-2; the general JOFOC 10/41 U.S.C. split markers are not in this master. The urgency template now carries a posting section citing FAR 6.301(b)(1) for the 30-day post-award availability, with NFS CG 1804.102 / 1806.15(a) named as process guidance and Interim NFS Part 1806 noted reserved; brand-name FAR 6.301(b)(2) stays off this path. Method gate: Export Word on `jofoc-urgency` refuses when the record carries no unusual and compelling urgency authority, so a competitive file (Sample 1) is never forced onto this form. SF1449/OF347/SF26/SF33/SF30/LSJ and the general JOFOC path untouched.

## 2026-09-20 — Urgency JOFOC exportable fixture

- Added fictional urgency demonstration record A-2027-0118 (FAR 15 negotiated, sole source, 10 U.S.C. 3204(a)(2) / RFO FAR 6.103-2, CO Joshua Taggart) to t-minus-seed/acquisitions.json and the live table so the urgency justification path can be exported.
- documents.$templateKey: jofoc-urgency prefill now carries the recorded authority (jofoc_authority_citation / acquisition_method) and competition into the form values so isUrgencyJofocPath evaluates the record instead of an empty form. Competitive Sample 1 still refuses (gate reads full-and-open without 6.103-2).
- jofoc-urgency-docx.ts: default notice text now records the FAR 6.301(b)(1) urgency justification with 30-day posting per FAR 6.305. Verified exported .docx: zero leftover markers, one amount-driven signature page, Joshua Taggart on the active band, no 6.301(b)(2), no history log.

## Soft Walk P1-5 — Postaward notification letters (successful and unsuccessful)

- Masters installed from the HQ OP Word templates: `public/forms/POSTAWARD_SUCCESS_MASTER.docx`
  and `public/forms/POSTAWARD_UNSUCCESS_MASTER.docx`. Instruction pages, colour-coded drafter
  notes and the document history logs are stripped; the letterhead, styles, footers and the
  template version identifier stay as the masters write them. Build script:
  `scripts/build-postaward-masters.py`.
- `src/lib/postaward-letters-docx.ts` fills the masters through `applyMarkers` (no scratch OOXML)
  and carries the method gate: `isPart15NotificationPath` is false on a commercial or simplified
  file, and `simplifiedNoticeCitation` names RFO FAR 12.301 (commercial) or FAR 13.301
  (simplified noncommercial) instead.
- Citations corrected on the two letters: successful = FAR 15.207-1(a) / FAR 15.301-1(a)(1) with
  NFS CG 1815.29, 1815.31, 1815.32; unsuccessful = FAR 15.207-2(b) / FAR 15.301-1 with NFS CG
  1815.28. The stale FAR 15.502-7, 15.506 and 15.504 references on these letters are gone
  (`templates-hq6.ts`, `email-drafts.ts`, `scenario.ts`).

## Set-aside preaward notification master (Soft Walk P0)

- Source: HQ "Set-Aside Preaward Apparent Successful Offeror Notification" Word master (base issuance 01/2021, revision 04/2026), supplied as an upload.
- Installed as `public/forms/SETASIDE_PREAWARD_MASTER.docx`, built by `scripts/build-setaside-master.py`:
  instruction pages and the document history log removed, red drafter notes and highlights stripped,
  fill-ins turned into whole `[[MARKER]]` runs, footer template version identifier kept, signature ink blank.
- Filled by `src/lib/setaside-preaward-docx.ts` through `applyMarkers`, the same pattern as the Postaward and PPM OP masters.
- Face: FAR 15.206-1(b)(1), FAR 19.201-2 and 19.201-2(d)(1), NFS CG 1815.28.
- Method gate: Part 15 negotiated plus a small business set-aside on the record. Commercial and simplified
  files (Sample 1, A-2027-0101) are refused. Demonstration fixture: A-2027-0120.
- Word-face citation repair: both successful and unsuccessful retained letter prose prints the exact text
  `NFS CG 1815.28`; the citation is not confined to the on-screen regulatory card.

## Option exercise determination master (Soft Walk P1-3)

- Source: HQ "Option Exercise Determination" Word master, supplied as an upload; the HQ original is not edited.
- Installed as `public/forms/OPTION_EXERCISE_MASTER.docx`, built by `scripts/build-option-exercise-master.py`
  (body starts at the determination heading; instruction pages and the Document History Log removed,
  red drafter notes and highlights stripped, findings turned into whole `[[MARKER]]` runs, letterhead,
  styles and footer version identifier kept, both signature lines left blank).
- Filled by `src/lib/option-exercise-docx.ts` through `applyMarkers`, mirroring the option justification pipeline.
- Face citations come from the HQ source only: FAR 17.204, FAR 17.204-1(b)(2) and (b)(3)(i)-(vi), FAR Part 5,
  FAR Part 6, NFS CG 1817.27 and NFS CG 1817.28. The consideration paragraph drops when nothing is recorded.
- Gate: an awarded contract carrying an option. Protected commercial samples A-2027-0101 and A-2027-0102 refuse
  with an honest not-available page; A-2027-0103 keeps its recorded officer and refuses for want of a contract option.
- Demonstration fixture: A-2027-0122 (Joshua Taggart, contract 80SAMPLE2026C0122, Option Year 2).
- Named download: `option-exercise-<acquisition id>.docx` through the existing `downloadDocxBytes` path.

- Soft Walk P1-4: Fair Opportunity Exception, Brand Name Justification wired to the HQ marker master at public/forms/FOE_BRAND_MASTER.docx (scripts/build-foe-brand-master.py, src/lib/foe-brand-docx.ts). Generic FAR 16.507-6(b)(1)-(6) exception block removed on the brand-name path; one signature band prints, chosen by order value; fixture A-2027-0123 (Joshua Taggart, order value $750,000, band up to $900K). Samples 1 and 2 refuse; A-2027-0103 keeps its recorded officer. No meter change.

## Soft Walk P1-5 — UCA / Letter Contract Justification (HQ 05/2026)

`public/forms/UCA_JUST_MASTER.docx` is built by `scripts/build-uca-just-master.py`
from the HQ original (body starts at paragraph 87). Instruction pages and the
Document History Log are removed; letterhead, styles and the footer version
identifier are kept. The master takes the letter-contract branch of the HQ face:
the UCA-only purpose paragraphs, scope statement, government estimate,
contract-type not-to-exceed language, the FAR 52.243-6 block and the UCA
signature page are removed there. `src/lib/uca-just-docx.ts` fills the markers;
`isUcaJustPath` refuses the protected commercial samples and Part 12/13 files.
Export Word on template key `uca-letter-contract` writes
`uca-just-{acquisitionId}.docx`. Fixture `A-2027-0124` (Joshua Taggart,
letter contract, $2,500,000) seeds through
`drizzle/migrations/0003_seed_uca_joshua_fixture_a_2027_0124.sql`. Face cites
are FAR 16.603 and NFS CG 1816.65 / 1816.66 only. Signature ink stays blank.

## Soft Walk P1-6 — Blackout Notice (HQ 04/2026)

`public/forms/BLACKOUT_MASTER.docx` is built from the supplied HQ original by
`scripts/build-blackout-master.py`. The instruction pages and Document History
Log are removed; letterhead, styles, footer version identifier, and blank
signature underscore remain. `src/lib/blackout-docx.ts` fills isolated markers
and gates the existing `blackout-notice` key to a competed Part 15 final-RFP or
solicitation path. Fixture `A-2027-0121` is reused without changing its record.
Export Word writes `blackout-{acquisitionId}.docx`. The Word face uses only the
HQ references FAR 15.101, NFS CG 1815.11(i), NFS CG 1815.27(b), and NASA Source
Selection Guide §3.24. This closes Soft Walk P1 OP Word-master row 6. No meter change.

- Soft Walk Blackout r1: live `/documents/blackout-notice/{id}` now gates on `isBlackoutPath` with the exact refusal sentence and no download on Samples 1 and 2; Word export is always `blackout-{id}.docx` from BLACKOUT_MASTER; prepared date reads the America/Chicago calendar date; UI citations reconciled to the HQ face (FAR 15.101; NFS CG 1815.11(i); NFS CG 1815.27(b)). Fixture A-2027-0121. No meter change.

## ORBIT Phase 2 — Executive Overview r2

Presentation-only Mission Control refinement. The Executive Overview now carries one dark operational environment from the flight-director GO/WATCH/HOLD/LAUNCHED rail through a record-derived lifecycle trajectory, deeper T− mission cards, lifecycle accumulation, anomaly rows, and an honest days-returned visualization. All values continue to come from existing acquisition, phase, hold, award, and `computeMetrics` data. Motion is limited to scanning and state cues and respects reduced-motion preferences. No workflow, clock, document, role, schema, seed, audit, or Soft Walk behavior changed.

## ORBIT Phase 2 — Executive Overview r3 NASA identity

- Added an Executive-only NASA / T-Minus procurement mission-control masthead using the authorized `public/brand/nasa-insignia.png` asset, with Ames Research Center and Office of Procurement identity.
- Reserved NASA red `#FC3D21` for the masthead underline and rare identity marks only. HOLD, OVERDUE, errors, and destructive actions continue to use the separate operational red token.
- Grouped recorded Soft Walk phases into a readable procurement lifecycle trajectory without changing phase records or creating telemetry. Mission cards now expose the latest existing audit event alongside their existing clock, phase, gate, award, variance, and owner details.
- No workflow, clock math, document, form, fixture, role, schema, audit-write, or Soft Walk behavior changed.

## Exec Overview Phase 2 — readiness reasoning + interactive cards
- New `src/components/mission-control/readiness.ts`: rule-driven GO/WATCH/HOLD/LAUNCHED with trigger text. LAUNCHED = recorded award; HOLD = hold on record; WATCH = any rule met (target award within N days, target passed, reviewer vote outstanding, approval pending, required document incomplete, days in gate over Center aging threshold or phase planned days, forecast misses mission date); else GO. No scores or percentages.
- Watch window N defaults to 30 days, adjustable in the WATCH list (session only, not stored).
- "Unresolved question" has no field in the record; it is listed as not tracked rather than invented.
- Approval vs reviewer split is by reviewer role name (approval/CO/board roles = approval pending).
- Readiness cards are filter buttons (same look); HOLD opens the leadership exception queue sorted overdue → nearest target → longest blocked. Missing values read "Not recorded".
- WATCH subtitle renamed to "Attention required". No schema, Soft Walk, or other-page changes.

## Exec Overview Phase 3 — gate evidence readiness + stage detail
- New `gate-evidence.ts`: per phase required/completed/missing Required rows (same satisfaction check as metrics; rows with no recorded state count as neither), offered rows = advisory. Approvals = review board entries for the stage's phases; obtained = Go votes.
- Gate readiness: BLOCKED = hold on current stage, any No-go, or missing Required row on the current stage; READY = complete or nothing outstanding; else ATTENTION.
- Entered = earliest audit event logged in the phase; Completed = last audit event in a completed phase (labeled "last recorded event"). Absent → "Not recorded".
- Stage labels 8px → 9.5px, max-width 80px, equal-column wrap grid kept.

## Exec Overview Phase 4 — critical path, Executive exceptions, featured panel
- Priority tier derived from the linked mission's recorded priority (1 Mission Critical, 2–3 High Priority, 4+ Standard; none → "Priority not recorded"). No schema change.
- Critical path line: next gate, blocker, owner, target award, days remaining; missing → "Not recorded".
- Executive exceptions (pre-award only): overdue gate (days in phase > planned), award at risk, missing mandatory evidence, reviewer overdue (pending vote past due date), unsigned approval (pending approval-role vote), unresolved blocker (hold or No-go). Empty: "No active exceptions".
- Featured panel facts: CO, requesting org (requester_org_code), est. value, method, target/actual award, current/next gate, evidence status.

## Exec Ops P0 follow-up
- P0-A: Overview featured selector/scan strips use the acquisition's own title as identity; options read `ID — title (mission)`; mission shown secondary.
- P0-B: File page lifecycle normalizes via `deriveOverviewAcquisitionState`; awardDate only from recorded `Launched` audit event (no target fallback); countdown face uses `overviewCountdownView`. Stored clock_state untouched.

## Exec recon P1 fixes (state consistency, reversible)
- P1-1 FLAG Soft Walk-adjacent: `src/routes/forms.$formKey.$acquisitionId.tsx` summary headerLine now uses deriveOverviewAcquisitionState + computeMetrics + overviewCountdownView (launch-countdown caller). need_date no longer stands in as award. Display only; masters/exports/signing unchanged. Revert: restore the target_award_date ?? need_date block.
- P1-2 FLAG: `src/routes/files_.$acquisitionId.tsx` phases (rail, file index, sidebar) built from the operational remap, so clock_state=launched without a Launched audit no longer marks Administration NOW. No DB writes.
- P1-1b FLAG: form countdown now passes the same attachedKeys/savedKeys evidence as Overview/file, so a false HOLD (and holdDays inflated by "Hold cleared" matching /hold/i) cannot diverge the form header from Overview FORECAST. Revert: drop the three evidence loads and the two opts.
- P1-2b FLAG: `src/components/office-invite-panel.tsx` invite draft phase from deriveOverviewAcquisitionState (Launched audit read), not raw current_phase. Revert: restore acq['current_phase'].

## Overnight §6 Tip 5 — Documents/Forms light Work Surface — September 24, 2026

- `src/routes/templates.tsx`: Live and Build next markers now use Lock D GO and WATCH tokens; template tables use the shared light table wrapper. Registry, aliases, lookup, and queries are unchanged.
- FLAG Soft Walk-adjacent — `src/routes/forms.$formKey.$acquisitionId.tsx`: form header metadata, toolbar, notices, and preview sections use shared light Work Surface classes and control radius only. Countdown helpers, form masters, fill/export/sign paths, evidence bytes, fixtures, and writes are unchanged.
- FLAG Soft Walk-adjacent — `src/routes/documents.$templateKey.index.tsx`: acquisition chooser uses the shared light summary surface; selection data and links are unchanged.
- FLAG Soft Walk-adjacent — `src/routes/documents.$templateKey.$acquisitionId.tsx`: document header, version metadata, editing sections, signature/memo shells, checkout notice, and action toolbar use shared light Work Surface classes only. Generators, exports, signatures, votes, audits, authorities, method/citation logic, and document writes are unchanged.
- Reverse: restore the former border/background/radius classes and legacy template status variables. No schema or data reversal is required. No self-GREEN claim.

## IA Slice 4 — Density pass

- `/today`: live state and waiting items remain first, followed by the ranked next actions; regulation-change history is collapsed with its recorded count.
- `/work-queue`: Board cards now keep identity, readiness, T±, priority, and next action in the scan path; owner, dependency, mission, value, method, and phase remain as quieter supporting lines. List stays the Fix R1 eight-column structure.
- `/files`: rows now lead with identity, readiness, T±, owner, and next action; mission, Center, value, method, intake estimate, and phase remain folded into secondary lines. The table no longer requires a minimum width.
- `/files/$acquisitionId`: facts of record, thresholds, reference links, contract-file index, and audit trail are collapsed by default with counts where recorded. Navigator targets and print expansion remain intact.
- `/documents/$templateKey/$acquisitionId`: provenance, saved-version history, and defect support are collapsed by default. All document fields, comments, reviews, regulations, save/export actions, and official-file controls remain present.
- `/forms/$formKey/$acquisitionId`: the existing action bar remains available and About this export stays collapsed by default; all form fields, empty-block explanations, preview content, and export controls remain present.
- Nothing was removed. This is presentation and ordering only; state derivation, workflows, writes, generators, exports, signatures, citations, fixtures, and Soft Walk behavior are unchanged.
- IA Slice 4 corrective: previewAuthStorage.ts restored byte-identical to 0b10b2d7; form-actions toolbar wrapped back in `form ?` guard; file-page audit/thresholds inner `<details>` unwrapped (no nested double collapse); facts-of-record summary reads "13 fields"; beforeprint opens `details[data-mission-nav-collapsible]` on file and today pages; Board card phase line regains "Phase: " prefix.

## IA Slice 5 — Command providers
- Registry: `src/components/commands/command-registry.ts` — `CommandContext`, `ShellCommand`, `CommandProvider`, `registerCommandProvider`, `listCommandProviders`, `matchCommands(ctx, query, limit = 8)` (case-insensitive substring on label + keywords; provider and command `when` gates; empty query → []). Plain module state; no telemetry, analytics, or storage.
- Shared sidebar model: `src/components/commands/sidebar-nav.ts` `sidebarNavGroups(roles, presenter)` (NAV_GROUPS + `navFor` + presenter filter: hides Seed status, Simulate, and the Setup group). Used by BOTH the sidebar and the navigation provider; sidebar output unchanged.
- Providers (`src/components/commands/providers.ts`, imported once by global-search): `navigation` ("Go to") — one command per sidebar item, run = navigate(item.to); `open-file` ("Current file") — "Open file <ID>" → /files/<ID>, only when a file is open. Nothing else.
- Global search: acquisition queries, matching, 20-hit cap, rendering, Enter (opens results[0] only; never runs a command), ⌘K/Ctrl+K/Escape, labels and empty states unchanged. Commands render below acquisition results when the query matches; help label gains "and the names of pages you can open."
- File page: cold-path Thresholds table wrapped in `overflow-x-auto`. previewAuthStorage.ts byte-identical to f7c2667d.
