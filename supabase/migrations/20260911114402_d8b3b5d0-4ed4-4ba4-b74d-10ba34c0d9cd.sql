ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS aging_threshold_days integer NOT NULL DEFAULT 5;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS supervisor_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS supervisor_email text;
ALTER TABLE public.acquisition_facts ADD COLUMN IF NOT EXISTS hold_started_at timestamp with time zone;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone NOT NULL DEFAULT now();