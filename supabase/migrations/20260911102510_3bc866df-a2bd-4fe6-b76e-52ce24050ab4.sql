ALTER TABLE public.acquisition_facts
  ADD COLUMN IF NOT EXISTS right_to_repair_statement boolean,
  ADD COLUMN IF NOT EXISTS restrictive_clause_review text;