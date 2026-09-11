ALTER TABLE public.acquisition_facts ADD COLUMN IF NOT EXISTS responsibility_finding text;

UPDATE public.templates
SET status = 'live'
WHERE name = 'Determination of Responsibility Nonresponsibility';