ALTER TABLE public.acquisition_facts
  ADD COLUMN IF NOT EXISTS center_name text,
  ADD COLUMN IF NOT EXISTS mission_directorate_code text,
  ADD COLUMN IF NOT EXISTS mission_directorate_name text,
  ADD COLUMN IF NOT EXISTS mission_directorate_other text,
  ADD COLUMN IF NOT EXISTS sponsoring_agency text,
  ADD COLUMN IF NOT EXISTS is_reimbursable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hybrid_contract_type text,
  ADD COLUMN IF NOT EXISTS is_package_complete boolean NOT NULL DEFAULT false;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS mission_directorate_code text,
  ADD COLUMN IF NOT EXISTS mission_directorate_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_center_code text,
  ADD COLUMN IF NOT EXISTS last_organization_code text;

CREATE TABLE IF NOT EXISTS public.competition_authorities (
  authority_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_method text NOT NULL,
  competition_type text NOT NULL,
  citation text NOT NULL,
  description text NOT NULL,
  source_tier text NOT NULL DEFAULT 'binding',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (acquisition_method, competition_type, citation)
);
GRANT SELECT ON public.competition_authorities TO anon, authenticated;
GRANT ALL ON public.competition_authorities TO service_role;
ALTER TABLE public.competition_authorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competition_authorities_read" ON public.competition_authorities
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "competition_authorities_admin_insert" ON public.competition_authorities
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "competition_authorities_admin_update" ON public.competition_authorities
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "competition_authorities_admin_delete" ON public.competition_authorities
  FOR DELETE TO authenticated USING (private.is_admin());

CREATE INDEX IF NOT EXISTS acquisition_facts_org_code_idx
  ON public.acquisition_facts (branch_code)
  WHERE branch_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS competition_authorities_method_idx
  ON public.competition_authorities (acquisition_method, competition_type);