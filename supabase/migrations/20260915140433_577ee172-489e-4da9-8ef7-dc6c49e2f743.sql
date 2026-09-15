ALTER TABLE public.acquisition_facts ADD COLUMN IF NOT EXISTS scenario jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.scenario_trigger_config (
  config_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_key text NOT NULL,
  doc_key text NOT NULL,
  condition_label text NOT NULL,
  label text NOT NULL,
  citation text NOT NULL,
  phase text NOT NULL,
  state text NOT NULL DEFAULT 'required',
  enabled boolean NOT NULL DEFAULT true,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (trigger_key, doc_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_trigger_config TO authenticated;
GRANT ALL ON public.scenario_trigger_config TO service_role;

ALTER TABLE public.scenario_trigger_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY scenario_trigger_config_read ON public.scenario_trigger_config FOR SELECT TO authenticated USING (true);
CREATE POLICY scenario_trigger_config_create ON public.scenario_trigger_config FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'hq'::public.app_role) OR private.is_admin() OR private.is_demo());
CREATE POLICY scenario_trigger_config_edit ON public.scenario_trigger_config FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'hq'::public.app_role) OR private.is_admin() OR private.is_demo()) WITH CHECK (private.has_role(auth.uid(), 'hq'::public.app_role) OR private.is_admin() OR private.is_demo());
CREATE POLICY scenario_trigger_config_remove ON public.scenario_trigger_config FOR DELETE TO authenticated USING (private.is_admin());

CREATE TRIGGER update_scenario_trigger_config_updated_at BEFORE UPDATE ON public.scenario_trigger_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();