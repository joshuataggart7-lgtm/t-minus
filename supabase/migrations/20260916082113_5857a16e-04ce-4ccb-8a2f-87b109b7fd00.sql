create table public.acquisition_clins (
  clin_id uuid primary key default gen_random_uuid(),
  acquisition_id text not null references public.acquisition_facts(acquisition_id),
  clin_number text not null,
  description text not null,
  quantity numeric,
  unit_of_issue text,
  unit_price numeric,
  extended_price numeric,
  source text not null default 'officer',
  sort_order integer not null default 0,
  created_by uuid,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.acquisition_clins to authenticated;
grant all on public.acquisition_clins to service_role;
alter table public.acquisition_clins enable row level security;
create policy acquisition_clins_read on public.acquisition_clins for select to authenticated using (true);
create policy acquisition_clins_insert on public.acquisition_clins for insert to authenticated with check (private.is_specialist());
create policy acquisition_clins_update on public.acquisition_clins for update to authenticated using (private.is_specialist()) with check (private.is_specialist());
create policy acquisition_clins_delete on public.acquisition_clins for delete to authenticated using (private.is_admin() or private.is_specialist());
create trigger set_origin_acquisition_clins before insert on public.acquisition_clins for each row execute function public.set_record_origin();
create trigger update_acquisition_clins_updated_at before update on public.acquisition_clins for each row execute function public.update_updated_at_column();
create index acquisition_clins_acquisition_idx on public.acquisition_clins(acquisition_id, sort_order, clin_number);