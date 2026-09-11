create policy requester_intake_insert on public.acquisition_facts
  for insert to authenticated
  with check (private.t_minus_role() = 'requester');