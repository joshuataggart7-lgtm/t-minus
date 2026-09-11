# T-Minus — Initialization Plan (Foundation milestone)

T-Minus turns acquisition time into mission readiness. This plan covers the
**Foundation** milestone only: design system, Supabase schema + seed, auth
model, app shell, and the Mission Clock + Executive Overview skeleton. Full
operator screens (Work Queue, acquisition file, reviews, templates) come in
later passes.

## Prerequisites (user actions, before build)

1. **Provide the data model + seed data.** The spec says
   `KNOWLEDGE.md` (full data model, status rules, callout rule) and the
   `t-minus-seed` folder (missions, acquisitions, thresholds, phase_plan,
   review_rules, clauses, two clause matrices, templates, regulatory_refs,
   enterprise_strategies, centers_branches, nf1707_fields, etc.) live "in this
   project," but neither is present yet. The rules forbid inventing records, so
   **build cannot start until you point me to these files or paste their
   contents.** They define every table, field, and seed row.
2. **Connect the existing Supabase project.** Connect
   `dwddtfrjtsnnmesnnqfg.supabase.co` via **Project Settings → Connectors →
   Supabase (browser OAuth)** — the existing-project path, not "enable Lovable
   Cloud" (which would create a new project; forbidden by the spec). Once
   linked, the platform injects `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   / `SUPABASE_SERVICE_ROLE_KEY`, and I can create schema and seed through the
   platform. I will not hardcode the publishable key.

## Architecture reconciliation (recorded in BUILD_NOTES.md)

- **No Edge Functions.** The spec mentions Edge Functions for external calls,
  but this is a TanStack Start app: all server logic uses `createServerFn`;
  external calls (SAM.gov, GAO, Federal Register) go through server functions /
  server routes. Service role key is used server-side only, never in the browser.
- **Auth model.** "Roles are a header toggle backed by five seeded Supabase Auth
  users. No new auth provider." So the app uses Supabase Auth with five seeded
  users (one per role: Executive, Contracting, Reviewer, Requester, HQ). The
  header role toggle signs you in as the corresponding seeded user (seeded
  passwords stored as a Lovable secret). No separate login screen for the
  prototype; the toggle is the entry mechanism. Default landing depends on role
  (Executive → Executive Overview).

## Foundation scope

### 1. Design system (src/styles.css + root head)
- Replace the shadcn slate palette with the Mission Clock tokens: paper
  `#FFFFFF`, canvas `#F5F7FB`, text `#1D1D1F`, muted `#5B6478`, borders
  `#D9DEE8`, panel navy `#0F2A5B`, panel text `#FFFFFF`, panel muted `#B8C4DE`,
  action/link NASA blue `#0B3D91` (hover `#0F4FB8`). Status: On Track
  `#1E8E3E`, Needs Attention `#B45309`, At Risk `#C8321E`. Every status color
  paired with its word; contrast 4.5:1+.
- Load **IBM Plex Sans** via a `<link>` in `__root.tsx` head (not `@import` in
  styles.css). Enable tabular numerals (`font-variant-numeric: tabular-nums`)
  wherever numbers appear.
- Type scale: clock figures 48/52 semibold (40/44 tablet), page title 28/34,
  section 18/24, body 15/22, tables 13/18. Radius 8 controls / 12 dialogs.
  Shadows only under an open dialog. No rockets, seals, ticking seconds, all-caps
  labels, eyebrows, or arrows on buttons.

### 2. Supabase schema + RLS + seed (from KNOWLEDGE.md + seed files)
- Create every table the data model defines (missions, acquisition_facts,
  thresholds, phase_plan, review_rules, clauses + the two clause matrices,
  templates, regulatory_refs, enterprise_strategies, centers_branches,
  nf1707_fields, audit log for FAR 4.801, review votes, holds, etc.) — exact
  fields from `KNOWLEDGE.md`.
- `user_roles` table + `app_role` enum + `has_role()` security-definer function
  per the role-security rules. Roles live in their own table, never on profiles.
- `GRANT` + `ENABLE ROW LEVEL SECURITY` + policies on every public-schema
  table. Reviewers read/comment/vote; approval stays with CO. Every action logged.
- Seed all rows from the `t-minus-seed` files **exactly**; rows marked "confirm"
  load as-is with the note shown. Seed the five Supabase Auth users + their
  role rows (seeded passwords stored as a Lovable secret).
- Engine rules enforced as data, not code: clause status/date/applicability
  from the two matrices; removed clauses never appear; FAR 52.212-5 is Reserved
  (no checkbox block); thresholds show conflict notes; review triggers say
  "Center policy."

### 3. Supabase integration scaffolding
- Generated client (`@/integrations/supabase/client`), `auth-middleware`
  (`requireSupabaseAuth`), `client.server` (admin, service-role), and types.
- `auth-attacher` bearer middleware appended to `functionMiddleware` in
  `src/start.ts` (preserve existing CSRF + error middleware).
- Integration-managed `_authenticated/route.tsx` gate (`ssr: false`,
  redirect to `/auth`).

### 4. App shell (src/routes/__root.tsx + a layout)
- Wordmark "T-Minus" top left, "Mission Acquisition Acceleration" beneath.
- Left rail that collapses to icons; content left-aligned; max width 1440 on
  Executive Overview, 1280 elsewhere. Hierarchy by spacing/type, not cards.
- Header **role toggle** (Executive / Contracting / Reviewer / Requester / HQ)
  that signs you in as the matching seeded user.
- Footer on every page: "Prototype. Not an official NASA system." No seals.
- Wire `onAuthStateChange` once in `__root.tsx` (filter to identity transitions).

### 5. Mission Clock + Executive Overview (src/routes/index.tsx, rewritten)
- Replace the placeholder at `/` with the Executive Overview.
- Opens with "T-Minus turns acquisition time into mission readiness."
- **Mission Clock panel**: deep navy band, large still figures (days) and status
  words (On Track / Needs Attention / At Risk). Nothing animates on load.
- Priority project list: for each, show acquisition phase, next decision, days
  to that decision and to award, status, critical-path blocker + owner, time
  saved/impact vs. mission date, and one "leadership needs to know now" line.
- Status changes cross-fade 300ms; reduced motion respected. Empty state offers
  one action. Data read via a public-safe server function (executive is read-only).

## Out of scope (later milestones)
Work Queue, acquisition file with launch sequence + go/no-go poll, reviewer
voting, holds, HTML template forms, FAR 4.801 audit log views, external
integrations (SAM.gov/GAO/Federal Register), print templates.

## Verification
- Build + typecheck pass; `/` renders the Executive Overview (no placeholder).
- Mission Clock shows seeded days/status; status colors paired with words.
- Role toggle switches the signed-in seeded user and the visible data.
- WCAG: keyboard nav, visible focus, labeled inputs, no meaning by color alone.
- Update `BUILD_NOTES.md` with every reconciliation/decision made.
