INSERT INTO public.templates (template_id, name, nf_1098_tab, status, governing_citation, citation_tier, hq_revision_date)
SELECT gen_random_uuid(), 'Memorandum for Record', 'N/A', 'live', 'FAR 4.801; FAR 4.803', 'guidance', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE name = 'Memorandum for Record');