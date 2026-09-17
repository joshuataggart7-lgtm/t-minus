INSERT INTO public.contract_modifications (
  acquisition_id,
  mod_number,
  mod_type,
  sf30_13a,
  sf30_13b,
  sf30_13c,
  sf30_13d,
  authority_text,
  description,
  clause_delta,
  state,
  is_seed
)
SELECT
  'A-2026-0090',
  'P00001',
  'other',
  false,
  false,
  false,
  false,
  NULL,
  'Fictional demo modification recorded for SF 30 value verification.',
  '[]'::jsonb,
  'draft',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.contract_modifications
  WHERE acquisition_id = 'A-2026-0090'
    AND mod_number = 'P00001'
);

UPDATE public.templates
SET status = 'Ready'
WHERE name = 'SF 30, Amendment of Solicitation/Modification of Contract';

UPDATE public.documents AS d
SET memo_header = jsonb_set(
  COALESCE(d.memo_header, '{}'::jsonb),
  '{signatureName}',
  to_jsonb('Joshua Taggart'::text),
  true
)
FROM public.templates AS t
WHERE d.template_id = t.template_id
  AND d.acquisition_id = 'A-2027-0101'
  AND t.name = 'Market Research Memorandum';