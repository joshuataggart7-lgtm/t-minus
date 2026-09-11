DROP POLICY "Users release their own check-out" ON public.document_checkouts;

CREATE POLICY "Users release their own or an expired check-out"
  ON public.document_checkouts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR checked_out_at < now() - interval '30 minutes')
  WITH CHECK (user_id = auth.uid() OR checked_out_at < now() - interval '30 minutes');