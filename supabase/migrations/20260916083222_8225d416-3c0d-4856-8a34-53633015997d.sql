create table public.solicitation_l (
  acquisition_id text primary key references public.acquisition_facts(acquisition_id),
  volumes text,
  page_limit text,
  submission_instructions text,
  response_due_note text,
  created_by uuid,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.solicitation_l to authenticated;
grant all on public.solicitation_l to service_role;
alter table public.solicitation_l enable row level security;
create policy solicitation_l_read on public.solicitation_l for select to authenticated using (true);
create policy solicitation_l_insert on public.solicitation_l for insert to authenticated with check (private.is_specialist());
create policy solicitation_l_update on public.solicitation_l for update to authenticated using (private.is_specialist()) with check (private.is_specialist());
create policy solicitation_l_delete on public.solicitation_l for delete to authenticated using (private.is_admin() or private.is_specialist());
create trigger set_origin_solicitation_l before insert on public.solicitation_l for each row execute function public.set_record_origin();
create trigger update_solicitation_l_updated_at before update on public.solicitation_l for each row execute function public.update_updated_at_column();

create table public.solicitation_m (
  acquisition_id text primary key references public.acquisition_facts(acquisition_id),
  lpta boolean not null default false,
  notes text,
  created_by uuid,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.solicitation_m to authenticated;
grant all on public.solicitation_m to service_role;
alter table public.solicitation_m enable row level security;
create policy solicitation_m_read on public.solicitation_m for select to authenticated using (true);
create policy solicitation_m_insert on public.solicitation_m for insert to authenticated with check (private.is_specialist());
create policy solicitation_m_update on public.solicitation_m for update to authenticated using (private.is_specialist()) with check (private.is_specialist());
create policy solicitation_m_delete on public.solicitation_m for delete to authenticated using (private.is_admin() or private.is_specialist());
create trigger set_origin_solicitation_m before insert on public.solicitation_m for each row execute function public.set_record_origin();
create trigger update_solicitation_m_updated_at before update on public.solicitation_m for each row execute function public.update_updated_at_column();

create table public.solicitation_m_factors (
  factor_id uuid primary key default gen_random_uuid(),
  acquisition_id text not null references public.acquisition_facts(acquisition_id),
  name text not null,
  relative_importance text,
  description text,
  sort_order integer not null default 0,
  created_by uuid,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.solicitation_m_factors to authenticated;
grant all on public.solicitation_m_factors to service_role;
alter table public.solicitation_m_factors enable row level security;
create policy solicitation_m_factors_read on public.solicitation_m_factors for select to authenticated using (true);
create policy solicitation_m_factors_insert on public.solicitation_m_factors for insert to authenticated with check (private.is_specialist());
create policy solicitation_m_factors_update on public.solicitation_m_factors for update to authenticated using (private.is_specialist()) with check (private.is_specialist());
create policy solicitation_m_factors_delete on public.solicitation_m_factors for delete to authenticated using (private.is_admin() or private.is_specialist());
create trigger set_origin_solicitation_m_factors before insert on public.solicitation_m_factors for each row execute function public.set_record_origin();
create trigger update_solicitation_m_factors_updated_at before update on public.solicitation_m_factors for each row execute function public.update_updated_at_column();
create index solicitation_m_factors_acq_idx on public.solicitation_m_factors(acquisition_id, sort_order);