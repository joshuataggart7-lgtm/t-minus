create schema if not exists private;

create or replace function private.t_minus_role()
returns text
language sql
stable
security definer
set search_path = public
as $$ select role from public.users where user_id = auth.uid() $$;

create or replace function private.is_specialist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(private.t_minus_role() in ('specialist','hq'), false) $$;

grant usage on schema private to authenticated;
grant execute on function private.t_minus_role() to authenticated;
grant execute on function private.is_specialist() to authenticated;

-- update all policies to use private schema
do $$
declare t text;
begin
  foreach t in array array[
    'users','centers','branches','missions','acquisition_facts','phase_plan','thresholds',
    'review_rules','enterprise_strategies','regulatory_refs','templates','clauses',
    'clause_matrix_2603b','nfs_clause_matrix','nf1707_fields','polls','documents','sam_checks',
    'comments','announcements','announcement_acks','watch_items'
  ]
  loop
    execute format('drop policy if exists specialist_insert on public.%I', t);
    execute format('drop policy if exists specialist_update on public.%I', t);
    execute format('drop policy if exists specialist_delete on public.%I', t);
    execute format('create policy specialist_insert on public.%I for insert to authenticated with check (private.is_specialist())', t);
    execute format('create policy specialist_update on public.%I for update to authenticated using (private.is_specialist()) with check (private.is_specialist())', t);
    execute format('create policy specialist_delete on public.%I for delete to authenticated using (private.is_specialist())', t);
  end loop;
end $$;

-- drop public versions
drop function if exists public.t_minus_role();
drop function if exists public.is_specialist();