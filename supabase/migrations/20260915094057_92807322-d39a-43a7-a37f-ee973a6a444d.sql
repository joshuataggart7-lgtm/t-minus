insert into public.templates (name, nf_1098_tab, governing_citation, citation_tier, hq_revision_date, status, applies_when)
select 'Evaluation of Quotations Record', '054', 'FAR 13.106-2', 'binding', '09/2026', 'live',
  '{"acquisition_method":"FAR 13.5 commercial simplified procedures","competition":"competed"}'::jsonb
where not exists (select 1 from public.templates where name = 'Evaluation of Quotations Record');