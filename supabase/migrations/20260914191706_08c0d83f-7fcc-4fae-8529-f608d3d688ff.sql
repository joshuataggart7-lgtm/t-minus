drop policy if exists "Anyone can read size standards" on public.naics_size_standards;
revoke select on public.naics_size_standards from anon;
create policy "Signed in users read size standards" on public.naics_size_standards for select to authenticated using (true);