CREATE TABLE public.document_checkouts (
  checkout_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id text NOT NULL,
  template_key text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  checked_out_at timestamp with time zone NOT NULL DEFAULT now(),
  released_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_checkouts TO authenticated;
GRANT ALL ON public.document_checkouts TO service_role;

ALTER TABLE public.document_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read check-outs"
  ON public.document_checkouts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users create their own check-out"
  ON public.document_checkouts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users release their own check-out"
  ON public.document_checkouts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own check-out"
  ON public.document_checkouts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE UNIQUE INDEX document_checkouts_active_idx
  ON public.document_checkouts (acquisition_id, template_key)
  WHERE released_at IS NULL;

CREATE INDEX document_checkouts_lookup_idx
  ON public.document_checkouts (acquisition_id, template_key, checked_out_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_document_checkouts_updated_at
BEFORE UPDATE ON public.document_checkouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();