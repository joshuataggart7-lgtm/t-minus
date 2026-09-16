
DROP POLICY IF EXISTS "Signed-in staff can read shares" ON public.document_shares;
CREATE POLICY "Issuer or contracting can read shares"
ON public.document_shares FOR SELECT TO authenticated
USING (issued_by_user_id = auth.uid() OR private.is_specialist() OR private.is_admin());

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_admin() OR public.is_hq(auth.uid())) THEN
    NEW.role := OLD.role;
    NEW.is_admin := OLD.is_admin;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

CREATE OR REPLACE FUNCTION public.guard_user_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.is_admin() OR private.is_specialist()) THEN
    NEW.role := OLD.role;
    NEW.warrant_limit := OLD.warrant_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_privileges ON public.users;
CREATE TRIGGER guard_user_privileges
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_user_privileges();
