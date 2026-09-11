CREATE TABLE public.deviation_requests (
  deviation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id text REFERENCES public.acquisition_facts(acquisition_id) ON DELETE SET NULL,
  center_code text,
  title text NOT NULL,
  citation text NOT NULL,
  deviation_type text NOT NULL DEFAULT 'individual',
  regulation_text text,
  proposed_text text,
  justification text,
  requester_name text NOT NULL,
  need_date date,
  target_decision_date date,
  clock_started_at timestamp with time zone,
  clock_state text NOT NULL DEFAULT 'not started',
  status text NOT NULL DEFAULT 'open',
  decision text,
  decision_reason text,
  decided_by text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.deviation_votes (
  vote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_id uuid NOT NULL REFERENCES public.deviation_requests(deviation_id) ON DELETE CASCADE,
  reviewer_role text NOT NULL,
  reviewer_name text,
  vote text,
  reason text,
  due_date date,
  voted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (deviation_id, reviewer_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deviation_requests TO authenticated;
GRANT ALL ON public.deviation_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deviation_votes TO authenticated;
GRANT ALL ON public.deviation_votes TO service_role;

ALTER TABLE public.deviation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deviation_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read deviation requests" ON public.deviation_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users create deviation requests" ON public.deviation_requests
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users update deviation requests" ON public.deviation_requests
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users delete deviation requests" ON public.deviation_requests
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Signed-in users read deviation votes" ON public.deviation_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users create deviation votes" ON public.deviation_votes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users update deviation votes" ON public.deviation_votes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users delete deviation votes" ON public.deviation_votes
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_deviation_requests_updated_at BEFORE UPDATE ON public.deviation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deviation_votes_updated_at BEFORE UPDATE ON public.deviation_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();