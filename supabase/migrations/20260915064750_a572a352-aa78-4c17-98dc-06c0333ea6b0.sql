CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR role = 'administrator'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION private.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = ANY(_roles) OR role = 'administrator'::public.app_role)
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

DROP POLICY "Administrators can read all roles" ON public.user_roles;
DROP POLICY "Administrators can add roles" ON public.user_roles;
DROP POLICY "Administrators can change roles" ON public.user_roles;
DROP POLICY "Administrators can remove roles" ON public.user_roles;

CREATE POLICY "Administrators can read all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'administrator'));
CREATE POLICY "Administrators can add roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'administrator'));
CREATE POLICY "Administrators can change roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'administrator'))
WITH CHECK (private.has_role(auth.uid(), 'administrator'));
CREATE POLICY "Administrators can remove roles"
ON public.user_roles FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'administrator'));

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.has_role(auth.uid(), 'administrator') $$;

CREATE OR REPLACE FUNCTION private.is_specialist()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT private.has_any_role(auth.uid(), ARRAY['specialist','hq']::public.app_role[])
      OR private.is_demo()
$$;

CREATE OR REPLACE FUNCTION public.is_hq(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.has_role(_user_id, 'hq') $$;

REVOKE ALL ON FUNCTION public.is_hq(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hq(uuid) TO authenticated, service_role;