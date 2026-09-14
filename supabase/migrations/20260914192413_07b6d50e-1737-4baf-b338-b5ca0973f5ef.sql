create table if not exists public.research_runs (
  run_id uuid primary key default gen_random_uuid(),
  acquisition_id text not null,
  naics_code text,
  psc_code text,
  state_code text,
  acquisition_method text,
  ran_by text,
  ran_at timestamptz not null default now()
);
create table if not exists public.research_log (
  log_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs(run_id) on delete cascade,
  acquisition_id text not null,
  source text not null,
  query text not null,
  result_count integer,
  outcome text not null,
  ran_at timestamptz not null default now()
);
create table if not exists public.research_findings (
  finding_id uuid primary key default gen_random_uuid(),
  run_id uuid references public.research_runs(run_id) on delete set null,
  acquisition_id text not null,
  target text not null,
  label text not null,
  value text not null,
  source text not null,
  source_date date,
  confirmed boolean not null default false,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (acquisition_id, target)
);
create index if not exists research_log_acq_idx on public.research_log (acquisition_id, ran_at desc);
create index if not exists research_runs_acq_idx on public.research_runs (acquisition_id, ran_at desc);

grant select, insert, update, delete on public.research_runs to authenticated;
grant select, insert, update, delete on public.research_log to authenticated;
grant select, insert, update, delete on public.research_findings to authenticated;
grant all on public.research_runs to service_role;
grant all on public.research_log to service_role;
grant all on public.research_findings to service_role;

alter table public.research_runs enable row level security;
alter table public.research_log enable row level security;
alter table public.research_findings enable row level security;

create policy "Signed in users read research runs" on public.research_runs for select to authenticated using (true);
create policy "Signed in users read research log" on public.research_log for select to authenticated using (true);
create policy "Signed in users read research findings" on public.research_findings for select to authenticated using (true);
create policy "Signed in users confirm research findings" on public.research_findings for update to authenticated using (true) with check (true);