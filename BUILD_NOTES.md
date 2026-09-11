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
| clauses | 1,359 | 932 | See deviation below |
| clause_matrix_2603b | 819 | 819 | |
| nfs_clause_matrix | 125 | 125 | |
| nf1707_fields | 271 | 271 | |

### Known deviations

- **Clauses deduplication.** The `clauses` CSV has 1,359 rows but only 932
  unique `clause_number` values (253 duplicates with different dates/sources).
  The `clauses` table uses `clause_number` as its primary key, so duplicates
  cannot coexist. The seed script keeps the first occurrence per clause
  number. To load all 1,359 rows exactly, the schema would need a surrogate
  row ID and a non-unique `clause_number` column. Deferred to a later
  milestone unless required sooner.
- **Backend replacement.** The original spec called for the existing Supabase
  project `wczndteslofhtxbazhnj`. Lovable Cloud provisioning created a new
  managed project (`zgrgfkpfkhocljoqhknv`) instead. All schema, RLS, seeds, and
  auth users were applied to this managed project. The old `src/lib/supabase.ts`
  file remains in the repo but is no longer imported by any component.
