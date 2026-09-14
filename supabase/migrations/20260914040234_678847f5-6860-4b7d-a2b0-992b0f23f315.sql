create table public.igce_clins (
  clin_id uuid primary key default gen_random_uuid(),
  acquisition_id text not null references public.acquisition_facts(acquisition_id) on delete cascade,
  clin_number text not null,
  description text not null,
  quantity numeric,
  unit_of_issue text,
  unit_price numeric,
  extended_price numeric,
  period_start date,
  period_end date,
  created_by uuid,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.igce_clins to authenticated;
grant all on public.igce_clins to service_role;
alter table public.igce_clins enable row level security;
create policy igce_clins_read on public.igce_clins for select to authenticated using (true);
create policy igce_clins_insert on public.igce_clins for insert to authenticated with check (private.is_specialist());
create policy igce_clins_update on public.igce_clins for update to authenticated using (private.is_specialist()) with check (private.is_specialist());
create policy igce_clins_delete on public.igce_clins for delete to authenticated using (private.is_admin() or (coalesce(is_seed, false) = false and created_by = auth.uid()));
create trigger set_origin_igce_clins before insert on public.igce_clins for each row execute function public.set_record_origin();
create trigger update_igce_clins_updated_at before update on public.igce_clins for each row execute function public.update_updated_at_column();
create index igce_clins_acquisition_idx on public.igce_clins(acquisition_id, clin_number);