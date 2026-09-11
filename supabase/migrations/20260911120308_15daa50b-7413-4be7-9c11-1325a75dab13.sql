ALTER TABLE public.acquisition_facts
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS source_tag text,
  ADD COLUMN IF NOT EXISTS backfill_source jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS acquisition_facts_contract_number_key
  ON public.acquisition_facts (contract_number)
  WHERE contract_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS acquisition_facts_source_tag_idx
  ON public.acquisition_facts (source_tag);