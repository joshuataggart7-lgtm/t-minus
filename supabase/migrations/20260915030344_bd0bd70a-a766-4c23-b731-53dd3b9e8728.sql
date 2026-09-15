ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'contracting';
UPDATE public.profiles SET role = 'contracting' WHERE role IS NULL OR role = '' OR role = 'co';

CREATE OR REPLACE FUNCTION public.is_hq(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND (p.is_admin = true OR lower(p.role) IN ('hq','admin'))
  )
$$;

DROP POLICY IF EXISTS "HQ can read every profile" ON public.profiles;
CREATE POLICY "HQ can read every profile"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_hq(auth.uid()));

DROP POLICY IF EXISTS "HQ can update every profile" ON public.profiles;
CREATE POLICY "HQ can update every profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_hq(auth.uid()))
WITH CHECK (public.is_hq(auth.uid()));