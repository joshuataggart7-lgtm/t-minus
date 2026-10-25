-- Audit 2026-10-25, H1 and LA12. Seeds 0001 to 0003 insert real astronaut names
-- ("Neil Armstrong", "Alan Shepard", "Pete Conrad"). 0007 only created a rename
-- helper and 0008 dropped it, so a fresh database kept the real names. This
-- migration backs up every affected row, then swaps in invented names. It never
-- edits the earlier migrations. Running it twice is harmless (the second pass
-- finds no real names and changes nothing).
CREATE TABLE IF NOT EXISTS public.acquisition_facts_bak_20261025 (LIKE public.acquisition_facts INCLUDING DEFAULTS);
GRANT ALL ON public.acquisition_facts_bak_20261025 TO service_role;
ALTER TABLE public.acquisition_facts_bak_20261025 ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.audit_log_bak_20261025 (LIKE public.audit_log INCLUDING DEFAULTS);
GRANT ALL ON public.audit_log_bak_20261025 TO service_role;
ALTER TABLE public.audit_log_bak_20261025 ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.missions_bak_20261025 (LIKE public.missions INCLUDING DEFAULTS);
GRANT ALL ON public.missions_bak_20261025 TO service_role;
ALTER TABLE public.missions_bak_20261025 ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fictionalize_20261025(s text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(s,
  'Michael Collins (fictional CO)','M. Corvane (fictional CO)'),'Michael Collins (fictional)','M. Corvane (fictional)'),
  'Michael Collins','M. Corvane (fictional)'),
  'Jim Lovell','D. Okonkwo-Hale'),'John Young','S. Varnell'),'Pete Conrad','P. Castellan'),'Neil Armstrong','N. Ashgrove'),
  'Alan Shepard','A. Thorncroft'),'Fred Haise','F. Halberg'),'Charlie Duke','C. Wrenfield'),'Gene Cernan','G. Pellworth'),
  'John Glenn','J. Marrowby'),'Mae Jemison','M. Ostrander'),'Sally Ride','S. Brantwood'),'Wally Schirra','W. Delacorte'),
  'Frank Borman','F. Ashmere'),'Ken Mattingly','K. Tolliver'),'Jack Swigert','J. Fennimore'),'Scott Carpenter','S. Haldane'),
  'Eileen Collins','E. Strathmore'),'Ellen Ochoa','E. Marchetti'),
  'Walt Cunningham','W. Calloway'),'Ed Mitchell','E. Mercer'),'Edgar Mitchell','E. Mercer')
$$;
--> statement-breakpoint
INSERT INTO public.acquisition_facts_bak_20261025
SELECT * FROM public.acquisition_facts a
WHERE coalesce(a.co_name,'') || coalesce(a.cor_name,'') || coalesce(a.requester_name,'')
   <> public.fictionalize_20261025(coalesce(a.co_name,'')) || public.fictionalize_20261025(coalesce(a.cor_name,'')) || public.fictionalize_20261025(coalesce(a.requester_name,''))
   OR a.requester_name = 'D. Ferraro';
INSERT INTO public.audit_log_bak_20261025
SELECT * FROM public.audit_log l
WHERE coalesce(l.actor,'') <> public.fictionalize_20261025(coalesce(l.actor,''))
   OR coalesce(l.reason,'') <> public.fictionalize_20261025(coalesce(l.reason,''))
   OR coalesce(l.old_value,'') <> public.fictionalize_20261025(coalesce(l.old_value,''))
   OR coalesce(l.new_value,'') <> public.fictionalize_20261025(coalesce(l.new_value,''));
INSERT INTO public.missions_bak_20261025
SELECT * FROM public.missions m WHERE m.program_owner = 'D. Ferraro';
--> statement-breakpoint
UPDATE public.acquisition_facts SET
  co_name = public.fictionalize_20261025(co_name),
  cor_name = public.fictionalize_20261025(cor_name),
  requester_name = CASE WHEN requester_name = 'D. Ferraro' THEN 'D. Ferraro (fictional)' ELSE public.fictionalize_20261025(requester_name) END
WHERE acquisition_id IN (SELECT acquisition_id FROM public.acquisition_facts_bak_20261025);
UPDATE public.audit_log SET
  actor = public.fictionalize_20261025(actor),
  reason = public.fictionalize_20261025(reason),
  old_value = public.fictionalize_20261025(old_value),
  new_value = public.fictionalize_20261025(new_value)
WHERE log_id IN (SELECT log_id FROM public.audit_log_bak_20261025);
UPDATE public.missions SET program_owner = 'D. Ferraro (fictional)' WHERE program_owner = 'D. Ferraro';
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.fictionalize_20261025(text);
