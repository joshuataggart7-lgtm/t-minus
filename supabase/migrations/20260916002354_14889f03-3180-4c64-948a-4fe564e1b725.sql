-- 1) center_overrides
DROP POLICY IF EXISTS "Signed-in users can add center overrides" ON public.center_overrides;
DROP POLICY IF EXISTS "Signed-in users can change center overrides" ON public.center_overrides;
DROP POLICY IF EXISTS "Signed-in users can remove center overrides" ON public.center_overrides;
DROP POLICY IF EXISTS "Signed-in users can read center overrides" ON public.center_overrides;

CREATE POLICY "center_overrides_select" ON public.center_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "center_overrides_insert" ON public.center_overrides
  FOR INSERT TO authenticated WITH CHECK (private.is_specialist() OR private.is_admin());
CREATE POLICY "center_overrides_update" ON public.center_overrides
  FOR UPDATE TO authenticated USING (private.is_specialist() OR private.is_admin())
  WITH CHECK (private.is_specialist() OR private.is_admin());
CREATE POLICY "center_overrides_delete" ON public.center_overrides
  FOR DELETE TO authenticated USING (private.is_specialist() OR private.is_admin());

-- 2) deviation_requests
DROP POLICY IF EXISTS "Signed-in users create deviation requests" ON public.deviation_requests;
DROP POLICY IF EXISTS "Signed-in users delete deviation requests" ON public.deviation_requests;
DROP POLICY IF EXISTS "Signed-in users read deviation requests" ON public.deviation_requests;
DROP POLICY IF EXISTS "Signed-in users update deviation requests" ON public.deviation_requests;

CREATE POLICY "deviation_requests_select" ON public.deviation_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deviation_requests_insert" ON public.deviation_requests
  FOR INSERT TO authenticated WITH CHECK (private.is_specialist() OR private.is_admin());
CREATE POLICY "deviation_requests_update" ON public.deviation_requests
  FOR UPDATE TO authenticated USING (private.is_specialist() OR private.is_admin())
  WITH CHECK (private.is_specialist() OR private.is_admin());
CREATE POLICY "deviation_requests_delete" ON public.deviation_requests
  FOR DELETE TO authenticated USING (private.is_specialist() OR private.is_admin());

-- deviation_votes
DROP POLICY IF EXISTS "Signed-in users create deviation votes" ON public.deviation_votes;
DROP POLICY IF EXISTS "Signed-in users delete deviation votes" ON public.deviation_votes;
DROP POLICY IF EXISTS "Signed-in users read deviation votes" ON public.deviation_votes;
DROP POLICY IF EXISTS "Signed-in users update deviation votes" ON public.deviation_votes;

CREATE POLICY "deviation_votes_select" ON public.deviation_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deviation_votes_insert" ON public.deviation_votes
  FOR INSERT TO authenticated WITH CHECK (private.is_specialist() OR private.is_admin());
CREATE POLICY "deviation_votes_delete" ON public.deviation_votes
  FOR DELETE TO authenticated USING (private.is_specialist() OR private.is_admin());
CREATE POLICY "deviation_votes_update" ON public.deviation_votes
  FOR UPDATE TO authenticated
  USING (
    private.is_specialist() OR private.is_admin()
    OR private.has_role(auth.uid(), 'reviewer'::public.app_role)
    OR private.has_role(auth.uid(), 'hq'::public.app_role)
  )
  WITH CHECK (
    private.is_specialist() OR private.is_admin()
    OR private.has_role(auth.uid(), 'reviewer'::public.app_role)
    OR private.has_role(auth.uid(), 'hq'::public.app_role)
  );

-- 3) document_attachments
DROP POLICY IF EXISTS "Signed-in users add attachments" ON public.document_attachments;
DROP POLICY IF EXISTS "Signed-in users read attachments" ON public.document_attachments;
DROP POLICY IF EXISTS "Signed-in users remove non-seed attachments" ON public.document_attachments;
DROP POLICY IF EXISTS "Signed-in users update their attachments" ON public.document_attachments;

CREATE POLICY "document_attachments_select" ON public.document_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "document_attachments_insert" ON public.document_attachments
  FOR INSERT TO authenticated WITH CHECK (
    private.is_specialist() OR private.is_admin()
    OR private.has_role(auth.uid(), 'requester'::public.app_role)
  );
CREATE POLICY "document_attachments_update" ON public.document_attachments
  FOR UPDATE TO authenticated
  USING (private.is_specialist() OR private.is_admin() OR uploaded_by = auth.uid())
  WITH CHECK (private.is_specialist() OR private.is_admin() OR uploaded_by = auth.uid());
CREATE POLICY "document_attachments_delete" ON public.document_attachments
  FOR DELETE TO authenticated USING (
    is_seed = false
    AND (private.is_specialist() OR private.is_admin() OR uploaded_by = auth.uid())
  );

-- storage.objects for bucket attachments
DROP POLICY IF EXISTS "Signed-in users upload acquisition attachments" ON storage.objects;
DROP POLICY IF EXISTS "Signed-in users update their acquisition attachments" ON storage.objects;
DROP POLICY IF EXISTS "Signed-in users delete their acquisition attachments" ON storage.objects;

CREATE POLICY "attachments_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'attachments'
    AND (
      private.is_specialist() OR private.is_admin()
      OR private.has_role(auth.uid(), 'requester'::public.app_role)
    )
  );
CREATE POLICY "attachments_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());
CREATE POLICY "attachments_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'attachments'
    AND (owner = auth.uid() OR private.is_specialist() OR private.is_admin())
  );

-- 4) users
DROP POLICY IF EXISTS "specialist_insert" ON public.users;
DROP POLICY IF EXISTS "specialist_delete" ON public.users;
DROP POLICY IF EXISTS "specialist_update" ON public.users;

CREATE POLICY "users_admin_insert" ON public.users
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "users_admin_delete" ON public.users
  FOR DELETE TO authenticated USING (private.is_admin());
CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated
  USING (private.is_specialist() OR private.is_admin() OR user_id = auth.uid())
  WITH CHECK (private.is_specialist() OR private.is_admin() OR user_id = auth.uid());
