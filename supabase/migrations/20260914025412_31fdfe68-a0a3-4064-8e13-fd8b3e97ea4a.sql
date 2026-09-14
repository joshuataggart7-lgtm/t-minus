create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'co',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

alter table public.acquisition_facts add column if not exists is_seed boolean not null default false;
alter table public.acquisition_facts add column if not exists created_by uuid;
alter table public.documents add column if not exists is_seed boolean not null default false;
alter table public.documents add column if not exists created_by uuid;
alter table public.clause_mod_tasks add column if not exists is_seed boolean not null default false;
alter table public.clause_mod_tasks add column if not exists created_by uuid;

create or replace function private.is_demo()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) $$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function private.is_specialist()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(private.t_minus_role() in ('specialist','hq'), false)
      or private.is_demo()
      or private.is_admin()
      or coalesce((select role from public.profiles where id = auth.uid()) in ('co','specialist','hq','admin'), false)
$$;

do $$
declare t text;
begin
  foreach t in array array['acquisition_facts','documents','clause_mod_tasks']
  loop
    execute format('drop policy if exists specialist_delete on public.%I', t);
    execute format('drop policy if exists "Signed-in users delete clause mod tasks" on public.%I', t);
    execute format('drop policy if exists delete_non_seed on public.%I', t);
    execute format('create policy delete_non_seed on public.%I for delete to authenticated using (private.is_admin() or (coalesce(is_seed, false) = false and private.is_specialist()))', t);
  end loop;
end $$;