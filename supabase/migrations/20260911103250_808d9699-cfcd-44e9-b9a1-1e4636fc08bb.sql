CREATE TABLE public.template_defects (
  defect_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  template_name text NOT NULL,
  revision text,
  citation text,
  defect text NOT NULL,
  correction text,
  status text NOT NULL DEFAULT 'open',
  acquisition_id text,
  reporter_name text NOT NULL,
  reporter_role text,
  reported_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_defects TO authenticated;
GRANT ALL ON public.template_defects TO service_role;

ALTER TABLE public.template_defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON public.template_defects FOR SELECT TO authenticated USING (true);
CREATE POLICY "report_defect" ON public.template_defects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "specialist_update" ON public.template_defects FOR UPDATE TO authenticated USING (private.is_specialist()) WITH CHECK (private.is_specialist());
CREATE POLICY "specialist_delete" ON public.template_defects FOR DELETE TO authenticated USING (private.is_specialist());

CREATE TRIGGER update_template_defects_updated_at BEFORE UPDATE ON public.template_defects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();