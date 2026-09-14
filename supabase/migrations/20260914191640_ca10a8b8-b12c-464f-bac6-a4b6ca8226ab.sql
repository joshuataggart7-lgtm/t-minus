create table if not exists public.naics_size_standards (
  naics_code text primary key,
  naics_title text,
  standard_type text not null,
  employees integer,
  receipts_usd numeric,
  citation text,
  effective_date date,
  note text
);
grant select on public.naics_size_standards to anon;
grant select, insert, update, delete on public.naics_size_standards to authenticated;
grant all on public.naics_size_standards to service_role;
alter table public.naics_size_standards enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'naics_size_standards' and policyname = 'Anyone can read size standards') then
    create policy "Anyone can read size standards" on public.naics_size_standards for select using (true);
  end if;
end $$;
insert into public.naics_size_standards (naics_code, naics_title, standard_type, receipts_usd, citation, effective_date, note)
values ('481219','Other Nonscheduled Air Transportation','receipts',18000000,'13 CFR 121.201, SBA Table of Small Business Size Standards','2023-03-17','confirm')
on conflict (naics_code) do update set naics_title = excluded.naics_title, standard_type = excluded.standard_type,
  receipts_usd = excluded.receipts_usd, citation = excluded.citation, effective_date = excluded.effective_date, note = excluded.note;