CREATE TABLE public.nf1707_approvals (
  approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id text NOT NULL REFERENCES public.acquisition_facts(acquisition_id) ON DELETE CASCADE,
  form_section text NOT NULL,
  form_field_name text NOT NULL,
  approval_role text NOT NULL,
  owner_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'not required')),
  due_date date,
  completed_at timestamptz,
  completed_by text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (acquisition_id, form_section, form_field_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nf1707_approvals TO authenticated;
GRANT ALL ON public.nf1707_approvals TO service_role;
ALTER TABLE public.nf1707_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY nf1707_approvals_read ON public.nf1707_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY nf1707_approvals_create ON public.nf1707_approvals FOR INSERT TO authenticated WITH CHECK (private.is_specialist() OR private.is_admin() OR private.is_demo());
CREATE POLICY nf1707_approvals_edit ON public.nf1707_approvals FOR UPDATE TO authenticated USING (private.is_specialist() OR private.is_admin() OR private.is_demo() OR owner_name = (SELECT name FROM public.users WHERE user_id = auth.uid())) WITH CHECK (private.is_specialist() OR private.is_admin() OR private.is_demo() OR owner_name = (SELECT name FROM public.users WHERE user_id = auth.uid()));
CREATE POLICY nf1707_approvals_remove ON public.nf1707_approvals FOR DELETE TO authenticated USING (private.is_admin());
CREATE TRIGGER update_nf1707_approvals_updated_at BEFORE UPDATE ON public.nf1707_approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX nf1707_approvals_acquisition_idx ON public.nf1707_approvals (acquisition_id, status, due_date);