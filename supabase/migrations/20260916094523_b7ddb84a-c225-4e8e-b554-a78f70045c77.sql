CREATE TABLE public.document_read_receipts (
  receipt_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  acquisition_id text NOT NULL REFERENCES public.acquisition_facts(acquisition_id),
  doc_kind text NOT NULL,
  doc_key text NOT NULL,
  doc_label text,
  opened_by text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  poll_id uuid,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.document_read_receipts TO authenticated;
GRANT ALL ON public.document_read_receipts TO service_role;

ALTER TABLE public.document_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read read receipts"
  ON public.document_read_receipts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in users can record a read receipt"
  ON public.document_read_receipts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Signed-in users can refresh their own read receipt"
  ON public.document_read_receipts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_document_read_receipts_updated_at
  BEFORE UPDATE ON public.document_read_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();