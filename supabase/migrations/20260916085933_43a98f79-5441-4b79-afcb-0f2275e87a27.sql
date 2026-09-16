CREATE TABLE public.payment_milestones (
  milestone_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  acquisition_id text NOT NULL REFERENCES public.acquisition_facts(acquisition_id) ON DELETE CASCADE,
  event text NOT NULL,
  due_logic text,
  clin_id uuid REFERENCES public.acquisition_clins(clin_id) ON DELETE SET NULL,
  clin_number text,
  amount numeric,
  percent numeric,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  is_seed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_milestones TO authenticated;
GRANT ALL ON public.payment_milestones TO service_role;

ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_milestones_select" ON public.payment_milestones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "payment_milestones_insert" ON public.payment_milestones
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role,'administrator'::public.app_role]));
CREATE POLICY "payment_milestones_update" ON public.payment_milestones
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role,'administrator'::public.app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role,'administrator'::public.app_role]));
CREATE POLICY "payment_milestones_delete" ON public.payment_milestones
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['specialist'::public.app_role,'administrator'::public.app_role]));

CREATE INDEX idx_payment_milestones_acq ON public.payment_milestones(acquisition_id, sort_order);

CREATE TRIGGER set_origin_payment_milestones BEFORE INSERT ON public.payment_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_record_origin();
CREATE TRIGGER update_payment_milestones_updated_at BEFORE UPDATE ON public.payment_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();