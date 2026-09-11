ALTER TABLE public.acquisition_facts ADD COLUMN IF NOT EXISTS contract_clauses jsonb;

CREATE TABLE IF NOT EXISTS public.clause_mod_tasks (
  task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id text NOT NULL REFERENCES public.acquisition_facts(acquisition_id) ON DELETE CASCADE,
  clause_number text NOT NULL,
  change_kind text NOT NULL,
  change_source text,
  center_code text,
  owner_name text,
  deadline_date date,
  status text NOT NULL DEFAULT 'open',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text,
  completed_at timestamp with time zone,
  completed_by text,
  UNIQUE (acquisition_id, clause_number, change_kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clause_mod_tasks TO authenticated;
GRANT ALL ON public.clause_mod_tasks TO service_role;

ALTER TABLE public.clause_mod_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users read clause mod tasks" ON public.clause_mod_tasks;
CREATE POLICY "Signed-in users read clause mod tasks" ON public.clause_mod_tasks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Signed-in users create clause mod tasks" ON public.clause_mod_tasks;
CREATE POLICY "Signed-in users create clause mod tasks" ON public.clause_mod_tasks
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Signed-in users update clause mod tasks" ON public.clause_mod_tasks;
CREATE POLICY "Signed-in users update clause mod tasks" ON public.clause_mod_tasks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Signed-in users delete clause mod tasks" ON public.clause_mod_tasks;
CREATE POLICY "Signed-in users delete clause mod tasks" ON public.clause_mod_tasks
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS clause_mod_tasks_acq_idx ON public.clause_mod_tasks (acquisition_id);