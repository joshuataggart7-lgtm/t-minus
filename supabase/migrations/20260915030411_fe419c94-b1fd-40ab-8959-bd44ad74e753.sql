REVOKE ALL ON FUNCTION public.is_hq(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_hq(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_hq(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hq(uuid) TO service_role;