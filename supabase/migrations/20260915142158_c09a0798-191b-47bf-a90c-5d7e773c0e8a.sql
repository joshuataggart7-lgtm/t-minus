ALTER TABLE public.acquisition_facts
  ADD COLUMN IF NOT EXISTS vehicle jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_contract_number text,
  ADD COLUMN IF NOT EXISTS closeout jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.contract_modifications (
  mod_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id text NOT NULL REFERENCES public.acquisition_facts(acquisition_id),
  mod_number text NOT NULL,
  mod_type text NOT NULL,
  sf30_13a boolean NOT NULL DEFAULT false,
  sf30_13b boolean NOT NULL DEFAULT false,
  sf30_13c boolean NOT NULL DEFAULT false,
  sf30_13d boolean NOT NULL DEFAULT false,
  authority_text text,
  description text,
  value_change numeric,
  period_change_end date,
  funds_line text,
  clause_delta jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL DEFAULT 'draft',
  is_seed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_modifications TO authenticated;
GRANT ALL ON public.contract_modifications TO service_role;

ALTER TABLE public.contract_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_modifications_read ON public.contract_modifications
  FOR SELECT TO authenticated USING (true);
CREATE POLICY contract_modifications_insert ON public.contract_modifications
  FOR INSERT TO authenticated WITH CHECK (private.is_specialist());
CREATE POLICY contract_modifications_update ON public.contract_modifications
  FOR UPDATE TO authenticated USING (private.is_specialist()) WITH CHECK (private.is_specialist());
CREATE POLICY contract_modifications_delete ON public.contract_modifications
  FOR DELETE TO authenticated
  USING (private.is_admin() OR (COALESCE(is_seed, false) = false AND created_by = auth.uid()));

CREATE TRIGGER update_contract_modifications_updated_at
  BEFORE UPDATE ON public.contract_modifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_origin_contract_modifications
  BEFORE INSERT ON public.contract_modifications
  FOR EACH ROW EXECUTE FUNCTION public.set_record_origin();

INSERT INTO public.phase_plan (acquisition_type, phase, planned_days, "order", note) VALUES
  ('idiq_parent','Intake',5,1,'Requirement, funding and ordering period confirmed'),
  ('idiq_parent','Market Research',20,2,NULL),
  ('idiq_parent','Solicitation/Quote',30,3,NULL),
  ('idiq_parent','Technical Evaluation',20,4,NULL),
  ('idiq_parent','Price Reasonableness',15,5,NULL),
  ('idiq_parent','Responsibility Check',3,6,NULL),
  ('idiq_parent','Go/No-go Poll',7,7,NULL),
  ('idiq_parent','Award',10,8,NULL),
  ('idiq_parent','FPDS-NG Report',3,9,NULL),
  ('idiq_parent','Administration',1825,10,'Ordering period'),
  ('idiq_parent','Closeout',90,11,NULL),
  ('order_under_idiq','Intake',3,1,NULL),
  ('order_under_idiq','Fair Opportunity',5,2,'FAR 16.505(b)(1)'),
  ('order_under_idiq','Solicitation/Quote',10,3,NULL),
  ('order_under_idiq','Technical Evaluation',7,4,NULL),
  ('order_under_idiq','Price Reasonableness',5,5,NULL),
  ('order_under_idiq','Responsibility Check',2,6,NULL),
  ('order_under_idiq','Award',5,7,NULL),
  ('order_under_idiq','FPDS-NG Report',3,8,NULL),
  ('order_under_idiq','Administration',365,9,NULL),
  ('order_under_idiq','Closeout',60,10,NULL),
  ('bpa','Intake',3,1,NULL),
  ('bpa','Market Research',10,2,NULL),
  ('bpa','Solicitation/Quote',10,3,NULL),
  ('bpa','Price Reasonableness',5,4,NULL),
  ('bpa','Responsibility Check',2,5,NULL),
  ('bpa','Award',5,6,NULL),
  ('bpa','FPDS-NG Report',3,7,NULL),
  ('bpa','Administration',365,8,'Calls under the agreement and the annual review'),
  ('bpa','Closeout',60,9,NULL),
  ('fss_order','Intake',3,1,NULL),
  ('fss_order','Fair Opportunity',5,2,'FAR 8.405-1 or 8.405-2 by value'),
  ('fss_order','Solicitation/Quote',7,3,NULL),
  ('fss_order','Technical Evaluation',5,4,NULL),
  ('fss_order','Price Reasonableness',5,5,NULL),
  ('fss_order','Responsibility Check',2,6,NULL),
  ('fss_order','Award',5,7,NULL),
  ('fss_order','FPDS-NG Report',3,8,NULL),
  ('fss_order','Administration',365,9,NULL),
  ('fss_order','Closeout',60,10,NULL);