CREATE TABLE public.acquisition_cdrl (
  cdrl_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id text NOT NULL REFERENCES public.acquisition_facts(acquisition_id) ON DELETE CASCADE,
  item_number text NOT NULL,
  title text NOT NULL,
  frequency text,
  as_of text,
  distribution text,
  drd_ref text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  is_seed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acquisition_cdrl TO authenticated;
GRANT ALL ON public.acquisition_cdrl TO service_role;

ALTER TABLE public.acquisition_cdrl ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read CDRL items"
  ON public.acquisition_cdrl FOR SELECT TO authenticated USING (true);

CREATE POLICY "Specialists can add CDRL items"
  ON public.acquisition_cdrl FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role, 'administrator'::public.app_role]));

CREATE POLICY "Specialists can edit CDRL items"
  ON public.acquisition_cdrl FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role, 'administrator'::public.app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role, 'administrator'::public.app_role]));

CREATE POLICY "Specialists can remove CDRL items"
  ON public.acquisition_cdrl FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role, 'administrator'::public.app_role]));

CREATE INDEX idx_acquisition_cdrl_acq ON public.acquisition_cdrl (acquisition_id, sort_order);

CREATE TRIGGER set_origin_acquisition_cdrl
  BEFORE INSERT ON public.acquisition_cdrl
  FOR EACH ROW EXECUTE FUNCTION public.set_record_origin();

CREATE TRIGGER update_acquisition_cdrl_updated_at
  BEFORE UPDATE ON public.acquisition_cdrl
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();