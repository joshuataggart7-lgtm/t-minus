ALTER TABLE public.acquisition_facts
  ADD COLUMN IF NOT EXISTS proposed_price numeric,
  ADD COLUMN IF NOT EXISTS proposed_price_received date;