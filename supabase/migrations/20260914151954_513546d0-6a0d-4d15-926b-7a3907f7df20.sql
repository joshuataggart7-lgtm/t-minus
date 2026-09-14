alter table public.centers add column if not exists address_line text;

update public.centers set address_line = v.addr from (values
  ('HQ','Washington, DC 20546-0001'),
  ('ARC','Moffett Field, CA 94035-1000'),
  ('AFRC','Edwards, CA 93523-0273'),
  ('GRC','Cleveland, OH 44135-3191'),
  ('GSFC','Greenbelt, MD 20771-0001'),
  ('JPL','Pasadena, CA 91109-8099'),
  ('JSC','Houston, TX 77058-3696'),
  ('KSC','Kennedy Space Center, FL 32899-0001'),
  ('LaRC','Hampton, VA 23681-2199'),
  ('MSFC','Marshall Space Flight Center, AL 35812-0001'),
  ('SSC','Stennis Space Center, MS 39529-6000')
) as v(code, addr) where public.centers.center_code = v.code;

create table if not exists public.memo_routing (
  routing_id uuid primary key default gen_random_uuid(),
  center_code text not null,
  document_key text not null,
  approving_official_title text not null,
  thru_chain text[] not null default '{}',
  memo_default boolean,
  note text,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (center_code, document_key)
);
grant select, insert, update, delete on public.memo_routing to authenticated;
grant all on public.memo_routing to service_role;
alter table public.memo_routing enable row level security;
create policy memo_routing_read on public.memo_routing for select to authenticated using (true);
create policy memo_routing_create on public.memo_routing for insert to authenticated with check (private.is_specialist() or private.is_admin() or private.is_demo());
create policy memo_routing_edit on public.memo_routing for update to authenticated using (private.is_specialist() or private.is_admin() or private.is_demo()) with check (private.is_specialist() or private.is_admin() or private.is_demo());
create policy memo_routing_remove on public.memo_routing for delete to authenticated using (private.is_admin());

insert into public.memo_routing (center_code, document_key, approving_official_title, thru_chain, memo_default, note) values
  ('ARC','market-research-memo','Branch Chief (placeholder)', array['Contract Specialist Team Lead (placeholder)'], true, 'Placeholder titles; edit in Center configuration.'),
  ('ARC','commerciality','Branch Chief (placeholder)', array['Contract Specialist Team Lead (placeholder)'], true, 'Placeholder titles; edit in Center configuration.'),
  ('ARC','jofoc','Procurement Officer (placeholder)', array['Branch Chief (placeholder)'], false, 'ARC JOFOC template is not a memorandum; flag off by default.'),
  ('ARC','pnm','Branch Chief (placeholder)', array['Contract Specialist Team Lead (placeholder)'], true, 'Placeholder titles; edit in Center configuration.'),
  ('ARC','waiver-deviation-request','Procurement Officer (placeholder)', array['Branch Chief (placeholder)'], true, 'Placeholder titles; edit in Center configuration.'),
  ('ARC','coordination-memo','Branch Chief (placeholder)', array[]::text[], true, 'Placeholder titles; edit in Center configuration.'),
  ('ARC','packet-transmittal-memo','Branch Chief (placeholder)', array['Contract Specialist Team Lead (placeholder)'], true, 'Placeholder titles; edit in Center configuration.')
on conflict (center_code, document_key) do nothing;

alter table public.documents add column if not exists issue_on_nf1858 boolean;
alter table public.documents add column if not exists memo_header jsonb;