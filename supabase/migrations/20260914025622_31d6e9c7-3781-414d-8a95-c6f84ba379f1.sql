create or replace function public.set_record_origin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  new.is_seed := coalesce(new.is_seed, false) or new.created_by is null;
  return new;
end;
$$;

revoke all on function public.set_record_origin() from public, anon, authenticated;

drop trigger if exists set_origin_acquisition_facts on public.acquisition_facts;
create trigger set_origin_acquisition_facts before insert on public.acquisition_facts
  for each row execute function public.set_record_origin();

drop trigger if exists set_origin_documents on public.documents;
create trigger set_origin_documents before insert on public.documents
  for each row execute function public.set_record_origin();

drop trigger if exists set_origin_clause_mod_tasks on public.clause_mod_tasks;
create trigger set_origin_clause_mod_tasks before insert on public.clause_mod_tasks
  for each row execute function public.set_record_origin();