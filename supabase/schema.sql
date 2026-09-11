-- T-Minus foundation schema (B1)
-- Data model from KNOWLEDGE.md. Run once against the connected Supabase project.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users/roles
create table if not exists public.users (
  user_id uuid primary key,
  name text not null,
  email text unique,
  role text not null check (role in ('executive','specialist','reviewer','requester','hq')),
  title text,
  center_code text,
  branch_code text,
  created_at timestamptz not null default now()
);

create or replace function public.t_minus_role()
returns text
language sql
stable
security definer
set search_path = public
as $$ select role from public.users where user_id = auth.uid() $$;

create or replace function public.is_specialist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.t_minus_role() in ('specialist','hq'), false) $$;

-- ---------------------------------------------------------------- reference
create table if not exists public.centers (
  center_code text primary key,
  center_name text not null
);

create table if not exists public.branches (
  center_code text not null references public.centers(center_code) on delete cascade,
  branch_code text not null,
  branch_name text not null,
  primary key (center_code, branch_code)
);

create table if not exists public.missions (
  mission_id text primary key,
  name text not null,
  program text,
  center_code text,
  milestone text,
  milestone_date date,
  priority int,
  program_owner text,
  leadership_note text
);

create table if not exists public.acquisition_facts (
  acquisition_id text primary key,
  mission_id text references public.missions(mission_id) on delete set null,
  is_critical_path boolean default false,
  title text,
  center_code text,
  branch_code text,
  requester_name text,
  requester_org_code text,
  pr_number text,
  description_of_requirement text,
  estimated_value numeric,
  period_of_performance_start date,
  period_of_performance_end date,
  place_of_performance text,
  naics_code text,
  psc_code text,
  psc_note text,
  contract_type text,
  acquisition_method text,
  competition text,
  set_aside text,
  jofoc_authority_citation text,
  commercial_determination text,
  contract_format text,
  funding_fiscal_year text,
  funds_certified boolean,
  igce_attached boolean,
  sow_attached boolean,
  hardware_deliverable boolean,
  includes_it boolean,
  enterprise_psl_check text,
  vendor_legal_name text,
  vendor_uei text,
  vendor_cage text,
  co_name text,
  co_code text,
  cor_name text,
  regulatory_baseline_date date,
  need_date date,
  target_award_date date,
  lead_to_delivery_days int,
  clock_state text,
  hold_reason text,
  hold_owner text,
  status text,
  current_phase text,
  acquisition_forecast_verified boolean,
  nf1707_answers jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phase_plan (
  plan_id uuid primary key default gen_random_uuid(),
  acquisition_type text not null,
  phase text not null,
  planned_days int,
  "order" int,
  note text,
  unique (acquisition_type, phase)
);

create table if not exists public.thresholds (
  threshold_id uuid primary key default gen_random_uuid(),
  name text not null,
  value numeric,
  citation text,
  effective_date text,
  superseded_date text,
  tier text,
  note text
);

create table if not exists public.review_rules (
  rule_id uuid primary key default gen_random_uuid(),
  reviewer_role text not null,
  trigger text,
  citation text,
  planned_days int,
  note text
);

create table if not exists public.enterprise_strategies (
  psl text primary key,
  name text,
  buying_location text,
  mandatory_vehicles text,
  required_coordination text,
  applies text
);

create table if not exists public.regulatory_refs (
  ref_id uuid primary key default gen_random_uuid(),
  citation text not null,
  title text,
  tier text,
  source text,
  effective_date text,
  far_part text,
  nfs_part text,
  url text,
  applies_to_phase text
);

create table if not exists public.templates (
  template_id uuid primary key default gen_random_uuid(),
  nf_1098_tab text,
  name text not null,
  governing_citation text,
  citation_tier text,
  hq_revision_date text,
  status text,
  applies_when jsonb,
  html_source text
);

create table if not exists public.clauses (
  row_id uuid primary key default gen_random_uuid(),
  clause_number text,
  title text,
  ucf_section text,
  source text,
  prescription_citation text,
  applies_when jsonb,
  fill_ins jsonb,
  last_updated text,
  last_sync text,
  effective_date text,
  status text,
  pcd_reference text,
  disposition text,
  rfo_number_or_pcd text,
  post_rfo_date text
);
create index if not exists clauses_clause_number_idx on public.clauses (clause_number);

create table if not exists public.clause_matrix_2603b (
  row_id uuid primary key default gen_random_uuid(),
  codified_number text,
  name text,
  effective_date text,
  prescribed_in text,
  p_or_c text,
  rfo_rx text,
  rfo_number text,
  rfo_title text,
  nasa_date_post_rfo text,
  disposition text,
  notes text
);

create table if not exists public.nfs_clause_matrix (
  row_id uuid primary key default gen_random_uuid(),
  clause_number text,
  title text,
  clause_date text,
  prescribed_in text,
  provision_or_clause text,
  ucf text,
  ibr_or_ft text,
  fill_in text,
  mod_or_sub text,
  app_dev text,
  applicability jsonb
);

create table if not exists public.nf1707_fields (
  field_id uuid primary key default gen_random_uuid(),
  section text,
  subform text,
  field_name text,
  field_kind text,
  caption text,
  nearest_form_text text,
  caption_full text,
  nearest_form_text_full text,
  choice_items text,
  is_answerable text,
  center_specific text
);

-- ---------------------------------------------------------------- working data
create table if not exists public.polls (
  poll_id uuid primary key default gen_random_uuid(),
  acquisition_id text references public.acquisition_facts(acquisition_id) on delete cascade,
  phase text,
  reviewer_role text,
  reviewer_name text,
  vote text check (vote in ('go','no-go','pending')) default 'pending',
  reason text,
  due_date date,
  voted_at timestamptz
);

create table if not exists public.documents (
  document_id uuid primary key default gen_random_uuid(),
  acquisition_id text references public.acquisition_facts(acquisition_id) on delete cascade,
  template_id uuid references public.templates(template_id) on delete set null,
  field_values jsonb,
  version int default 1,
  ai_model text,
  ai_generated_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  saved_by text,
  saved_at timestamptz
);

create table if not exists public.sam_checks (
  check_id uuid primary key default gen_random_uuid(),
  acquisition_id text references public.acquisition_facts(acquisition_id) on delete cascade,
  vendor_uei text,
  check_type text,
  response_json jsonb,
  checked_by text,
  checked_at timestamptz default now()
);

create table if not exists public.audit_log (
  log_id uuid primary key default gen_random_uuid(),
  acquisition_id text,
  actor text,
  action text,
  field text,
  old_value text,
  new_value text,
  reason text,
  phase text,
  logged_at timestamptz not null default now()
);

create index if not exists polls_acq_phase_idx on public.polls (acquisition_id, phase);

create table if not exists public.comments (
  comment_id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(document_id) on delete cascade,
  author text,
  body text,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  announcement_id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  severity text,
  audience_roles text[],
  audience_centers text[],
  effective_from timestamptz,
  effective_until timestamptz,
  requires_acknowledgment boolean default false,
  link text,
  posted_by text,
  posted_at timestamptz not null default now()
);

create table if not exists public.announcement_acks (
  announcement_id uuid references public.announcements(announcement_id) on delete cascade,
  user_id uuid,
  acknowledged_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table if not exists public.watch_items (
  item_id uuid primary key default gen_random_uuid(),
  source text,
  external_id text,
  title text,
  decided_or_published_date date,
  outcome_or_type text,
  agency text,
  url text,
  summary text,
  fetched_at timestamptz default now(),
  tags text[]
);

-- ---------------------------------------------------------------- grants + RLS
do $$
declare t text;
begin
  foreach t in array array[
    'users','centers','branches','missions','acquisition_facts','phase_plan','thresholds',
    'review_rules','enterprise_strategies','regulatory_refs','templates','clauses',
    'clause_matrix_2603b','nfs_clause_matrix','nf1707_fields','polls','documents','sam_checks',
    'audit_log','comments','announcements','announcement_acks','watch_items'
  ]
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    -- every signed-in seeded user reads
    execute format('drop policy if exists read_all on public.%I', t);
    execute format('create policy read_all on public.%I for select to authenticated using (true)', t);
    -- specialists (and HQ) write
    execute format('drop policy if exists specialist_insert on public.%I', t);
    execute format('drop policy if exists specialist_update on public.%I', t);
    execute format('drop policy if exists specialist_delete on public.%I', t);
    execute format('create policy specialist_insert on public.%I for insert to authenticated with check (public.is_specialist())', t);
    execute format('create policy specialist_update on public.%I for update to authenticated using (public.is_specialist()) with check (public.is_specialist())', t);
    execute format('create policy specialist_delete on public.%I for delete to authenticated using (public.is_specialist())', t);
  end loop;
end $$;

-- audit_log is insert only: any signed-in actor may append, nobody may change history
drop policy if exists specialist_insert on public.audit_log;
drop policy if exists specialist_update on public.audit_log;
drop policy if exists specialist_delete on public.audit_log;
create policy audit_append on public.audit_log for insert to authenticated with check (true);

-- reviewers vote on their own poll rows
drop policy if exists reviewer_vote on public.polls;
create policy reviewer_vote on public.polls for update to authenticated
  using (reviewer_name = (select name from public.users where user_id = auth.uid()))
  with check (reviewer_name = (select name from public.users where user_id = auth.uid()));

-- reviewers comment
drop policy if exists reviewer_comment on public.comments;
create policy reviewer_comment on public.comments for insert to authenticated with check (true);

-- everyone acknowledges their own announcements
drop policy if exists own_ack on public.announcement_acks;
create policy own_ack on public.announcement_acks for insert to authenticated with check (user_id = auth.uid());
