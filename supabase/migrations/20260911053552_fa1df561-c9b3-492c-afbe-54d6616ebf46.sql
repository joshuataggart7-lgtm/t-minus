ALTER TABLE public.clauses ADD COLUMN IF NOT EXISTS row_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.clauses DROP CONSTRAINT IF EXISTS clauses_pkey;
ALTER TABLE public.clauses ADD CONSTRAINT clauses_pkey PRIMARY KEY (row_id);
CREATE INDEX IF NOT EXISTS clauses_clause_number_idx ON public.clauses (clause_number);