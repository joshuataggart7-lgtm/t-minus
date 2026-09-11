CREATE TABLE public.document_shares (
  share_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  document_id uuid NOT NULL REFERENCES public.documents(document_id) ON DELETE CASCADE,
  acquisition_id text,
  template_name text NOT NULL,
  document_version integer,
  recipient_email text NOT NULL,
  recipient_name text,
  issued_by text NOT NULL,
  issued_by_user_id uuid,
  magic_link_sent boolean NOT NULL DEFAULT false,
  magic_link_note text,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  revoked_by text,
  open_count integer NOT NULL DEFAULT 0,
  last_opened_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.document_shares TO authenticated;
GRANT ALL ON public.document_shares TO service_role;

ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in staff can read shares"
  ON public.document_shares FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in staff can issue shares"
  ON public.document_shares FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Signed-in staff can revoke shares"
  ON public.document_shares FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX document_shares_document_idx ON public.document_shares (document_id);

CREATE TRIGGER update_document_shares_updated_at
  BEFORE UPDATE ON public.document_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();