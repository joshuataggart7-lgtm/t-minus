ALTER TABLE public.acquisition_facts
  ADD COLUMN IF NOT EXISTS successor_of text REFERENCES public.acquisition_facts(acquisition_id);

CREATE INDEX IF NOT EXISTS acquisition_facts_successor_of_idx
  ON public.acquisition_facts (successor_of);