CREATE TABLE public.document_attachments (
  attachment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id text NOT NULL REFERENCES public.acquisition_facts(acquisition_id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  doc_label text NOT NULL,
  nf_1098_tab text,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  content_type text,
  size_bytes integer,
  uploaded_by uuid DEFAULT auth.uid(),
  uploaded_by_name text,
  parsed_total numeric,
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_attachments TO authenticated;
GRANT ALL ON public.document_attachments TO service_role;

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read attachments" ON public.document_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users add attachments" ON public.document_attachments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users update their attachments" ON public.document_attachments
  FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() OR uploaded_by IS NULL)
  WITH CHECK (uploaded_by = auth.uid() OR uploaded_by IS NULL);
CREATE POLICY "Signed-in users remove non-seed attachments" ON public.document_attachments
  FOR DELETE TO authenticated USING (is_seed = false);

CREATE INDEX document_attachments_acq_idx ON public.document_attachments (acquisition_id);

CREATE TRIGGER update_document_attachments_updated_at
  BEFORE UPDATE ON public.document_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Signed-in users read acquisition attachments storage" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY "Signed-in users upload acquisition attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "Signed-in users update their acquisition attachments" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'attachments' AND owner = auth.uid());
CREATE POLICY "Signed-in users delete their acquisition attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'attachments');