CREATE TABLE public.clarifications (
  clarification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id text NOT NULL REFERENCES public.acquisition_facts(acquisition_id) ON DELETE CASCADE,
  sent_on date,
  topic text NOT NULL,
  recipients text,
  notes text,
  is_seed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clarifications TO authenticated;
GRANT ALL ON public.clarifications TO service_role;

ALTER TABLE public.clarifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read clarifications"
  ON public.clarifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Specialists can add clarifications"
  ON public.clarifications FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role, 'administrator'::public.app_role]));

CREATE POLICY "Specialists can edit clarifications"
  ON public.clarifications FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role, 'administrator'::public.app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role, 'administrator'::public.app_role]));

CREATE POLICY "Specialists can remove clarifications"
  ON public.clarifications FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role, 'administrator'::public.app_role]));

CREATE INDEX idx_clarifications_acq ON public.clarifications (acquisition_id, sent_on);

CREATE TRIGGER set_origin_clarifications
  BEFORE INSERT ON public.clarifications
  FOR EACH ROW EXECUTE FUNCTION public.set_record_origin();

CREATE TRIGGER update_clarifications_updated_at
  BEFORE UPDATE ON public.clarifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.solicitation_m_factors ADD COLUMN evidence_note text;