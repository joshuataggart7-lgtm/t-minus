REVOKE SELECT ON public.competition_authorities FROM anon;
DROP POLICY IF EXISTS "competition_authorities_read" ON public.competition_authorities;
CREATE POLICY "competition_authorities_authenticated_read" ON public.competition_authorities
  FOR SELECT TO authenticated USING (true);