CREATE TYPE public.app_role AS ENUM ('administrator', 'executive', 'specialist', 'reviewer', 'requester', 'hq');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
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

CREATE POLICY "People can read their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Administrators can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Administrators can add roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Administrators can change roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'administrator'))
WITH CHECK (public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Administrators can remove roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'administrator'));

INSERT INTO public.user_roles (user_id, role)
SELECT p.id,
  CASE lower(coalesce(p.role, 'contracting'))
    WHEN 'executive' THEN 'executive'::public.app_role
    WHEN 'reviewer' THEN 'reviewer'::public.app_role
    WHEN 'requester' THEN 'requester'::public.app_role
    WHEN 'hq' THEN 'hq'::public.app_role
    WHEN 'admin' THEN 'administrator'::public.app_role
    ELSE 'specialist'::public.app_role
  END
FROM public.profiles p
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'administrator'::public.app_role
FROM public.profiles p
WHERE p.is_admin = true
   OR lower(coalesce(p.email, '')) LIKE 'joshuataggart7%'
   OR lower(coalesce(p.display_name, '')) = 'joshuataggart7'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'administrator')
$$;

CREATE OR REPLACE FUNCTION private.is_specialist()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['specialist','hq']::public.app_role[])
      OR private.is_demo()
$$;

CREATE OR REPLACE FUNCTION private.t_minus_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'administrator'::public.app_role THEN 0
    WHEN 'hq'::public.app_role THEN 1
    WHEN 'specialist'::public.app_role THEN 2
    WHEN 'reviewer'::public.app_role THEN 3
    WHEN 'requester'::public.app_role THEN 4
    ELSE 5
  END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_hq(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'hq')
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_specialist() TO authenticated;
GRANT EXECUTE ON FUNCTION private.t_minus_role() TO authenticated;