-- Audit LA5 (2026-10-27). Every signed-in user could read every staff member's
-- email, telephone and supervisor email (policy read_all USING true on
-- public.users). Contact columns are now readable only on your own row, or by
-- specialists, HQ and administrators. Everyone still sees the non-contact
-- directory (names, titles, centers, roles) through public.staff_directory.
-- To undo: drop policy users_select_scoped; create policy read_all on
-- public.users for select to authenticated using (true); drop view staff_directory.
BEGIN;

DROP POLICY IF EXISTS read_all ON public.users;
DROP POLICY IF EXISTS users_select_scoped ON public.users;
CREATE POLICY users_select_scoped ON public.users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_specialist() OR private.is_admin());

-- Owner-rights view: exposes no contact columns, so it is safe to show to all
-- signed-in users while public.users itself is restricted.
CREATE OR REPLACE VIEW public.staff_directory AS
  SELECT user_id, name, role, title, center_code, branch_code, supervisor_name,
         warrant_limit, created_at
  FROM public.users;
REVOKE ALL ON public.staff_directory FROM anon, public;
GRANT SELECT ON public.staff_directory TO authenticated, service_role;

COMMIT;
