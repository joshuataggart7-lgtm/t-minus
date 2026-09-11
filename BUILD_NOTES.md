# T-Minus build notes

## B1. Foundation

Decisions taken where the specification left room, kept to the simplest option
that preserves the demo path.

- **Backend.** The existing Supabase project `aookxvqwvyezrkjunqdb` is used. No new
  project or managed backend was created. The browser holds only the publishable key
  (`src/lib/supabase.ts`).
- **Schema.** `supabase/schema.sql` creates every table in the KNOWLEDGE.md data model
  plus two matrix tables (`clause_matrix_2603b`, `nfs_clause_matrix`) and `nf1707_fields`,
  which the model describes as seed sources. The file is idempotent.
- **RLS.** Every table: read for all five signed-in seeded users; insert, update and
  delete for specialists and HQ only (`public.is_specialist()`). `audit_log` is append
  only, with no update or delete policy. Reviewers may update their own `polls` rows and
  insert comments. Users acknowledge only their own announcements.
- **Seeding.** `scripts/seed.ts` reads `t-minus-seed/` and loads it exactly, inventing no
  records. Run with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment;
  the service role key is never bundled. Auth users are created with a shared demo
  password (`SEED_USER_PASSWORD`, default `t-minus-demo-2027`).
- **Role toggle.** The header toggle signs in as one of the five seeded Supabase Auth
  users. If those accounts do not exist yet, the shell still renders and shows a plain
  line pointing at Seed status rather than failing.
- **Landing pages.** Executive and HQ land on the Executive Overview; specialist,
  reviewer and requester land on the Work Queue.
- **Rail.** Executive Overview, Work Queue, Files, Templates, Checks, Audit Log, Watch,
  Announcements, with Estimate present and marked reserved for later. Seed status sits
  below the rail as a utility link, outside the eight named entries.

### Applying the schema

DDL cannot be issued with a publishable key. Apply `supabase/schema.sql` once through the
Supabase SQL editor (or `psql` with the project connection string), then run the seed
script.
