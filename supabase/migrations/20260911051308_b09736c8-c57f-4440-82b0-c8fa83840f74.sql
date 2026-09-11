revoke execute on function public.t_minus_role() from anon;
revoke execute on function public.is_specialist() from anon;
revoke execute on function public.t_minus_role() from public;
revoke execute on function public.is_specialist() from public;
grant execute on function public.t_minus_role() to authenticated;
grant execute on function public.is_specialist() to authenticated;