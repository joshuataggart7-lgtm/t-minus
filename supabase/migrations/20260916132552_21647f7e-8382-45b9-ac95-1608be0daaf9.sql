CREATE TABLE public.solicitation_k (
  acquisition_id text PRIMARY KEY REFERENCES public.acquisition_facts(acquisition_id) ON DELETE CASCADE,
  sam_status text,
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitation_k TO authenticated;
GRANT ALL ON public.solicitation_k TO service_role;

ALTER TABLE public.solicitation_k ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read section K"
  ON public.solicitation_k FOR SELECT TO authenticated USING (true);

CREATE POLICY "Specialists can insert section K"
  ON public.solicitation_k FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['specialist']::public.app_role[]));

CREATE POLICY "Specialists can update section K"
  ON public.solicitation_k FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['specialist']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['specialist']::public.app_role[]));

CREATE POLICY "Specialists can delete section K"
  ON public.solicitation_k FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['specialist']::public.app_role[]));

CREATE TRIGGER update_solicitation_k_updated_at
  BEFORE UPDATE ON public.solicitation_k
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_origin_solicitation_k
  BEFORE INSERT ON public.solicitation_k
  FOR EACH ROW EXECUTE FUNCTION public.set_record_origin();