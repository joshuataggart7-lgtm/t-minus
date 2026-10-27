-- Audit 2026-10-25, H1 and LA12. Seeds 0001 to 0003 insert real astronaut names
-- ("Neil Armstrong", "Alan Shepard", "Pete Conrad"). 0007 only created a rename
-- helper and 0008 dropped it, so a fresh database kept the real names. This
-- migration backs up every affected table in full, then swaps in invented names.
-- It never edits the earlier migrations. Running it twice is harmless.
--
-- Revised 2026-10-27 after review, checked against the live schema:
--   * One transaction, no statement breakpoints: all of it applies or none of it.
--   * Every column touched is text (audit_log old_value/new_value are text, not
--     jsonb), so coalesce(text, '') is type safe.
--   * audit_log has RLS policies that block UPDATE for demo users and no
--     triggers. This runs as the database owner (RLS bypassed), so the update
--     is not blocked.
--   * Matching is case-insensitive on word boundaries (regexp_replace 'gi',
--     \m and \M), not exact strings.
--   * Also covers document_read_receipts.opened_by and
--     document_checkouts.user_name, which held the same names.
--   * No updated_at is written here; scenario_trigger_config has its own
--     BEFORE UPDATE trigger for that (M8 migration).
BEGIN;

CREATE TABLE IF NOT EXISTS public.acquisition_facts_bak_20261027 AS TABLE public.acquisition_facts;
CREATE TABLE IF NOT EXISTS public.audit_log_bak_20261027 AS TABLE public.audit_log;
CREATE TABLE IF NOT EXISTS public.missions_bak_20261027 AS TABLE public.missions;
CREATE TABLE IF NOT EXISTS public.document_read_receipts_bak_20261027 AS TABLE public.document_read_receipts;
CREATE TABLE IF NOT EXISTS public.document_checkouts_bak_20261027 AS TABLE public.document_checkouts;
ALTER TABLE public.acquisition_facts_bak_20261027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_bak_20261027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions_bak_20261027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_read_receipts_bak_20261027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_checkouts_bak_20261027 ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fictionalize_20261025(s text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  pairs text[][] := ARRAY[
    ['Michael Collins \(fictional CO\)', 'M. Corvane (fictional CO)'],
    ['Michael Collins \(fictional\)', 'M. Corvane (fictional)'],
    ['Michael Collins', 'M. Corvane (fictional)'],
    ['Eileen Collins', 'E. Strathmore'], ['Jim Lovell', 'D. Okonkwo-Hale'],
    ['John Young', 'S. Varnell'], ['Pete Conrad', 'P. Castellan'],
    ['Neil Armstrong', 'N. Ashgrove'], ['Alan Shepard', 'A. Thorncroft'],
    ['Fred Haise', 'F. Halberg'], ['Charlie Duke', 'C. Wrenfield'],
    ['Gene Cernan', 'G. Pellworth'], ['John Glenn', 'J. Marrowby'],
    ['Mae Jemison', 'M. Ostrander'], ['Sally Ride', 'S. Brantwood'],
    ['Wally Schirra', 'W. Delacorte'], ['Frank Borman', 'F. Ashmere'],
    ['Ken Mattingly', 'K. Tolliver'], ['Jack Swigert', 'J. Fennimore'],
    ['Scott Carpenter', 'S. Haldane'], ['Ellen Ochoa', 'E. Marchetti'],
    ['Walt Cunningham', 'W. Calloway'], ['Edgar Mitchell', 'E. Mercer'],
    ['Ed Mitchell', 'E. Mercer'], ['Buzz Aldrin', 'B. Alder'],
    ['Gus Grissom', 'G. Grisham']];
  i int;
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    s := regexp_replace(s, '\m' || replace(pairs[i][1], ' ', '\s+')
         || CASE WHEN pairs[i][1] ~ '[A-Za-z]$' THEN '\M' ELSE '' END, pairs[i][2], 'gi');
  END LOOP;
  RETURN s;
END $$;

UPDATE public.acquisition_facts SET
  co_name = public.fictionalize_20261025(co_name),
  cor_name = public.fictionalize_20261025(cor_name),
  requester_name = CASE WHEN requester_name = 'D. Ferraro' THEN 'D. Ferraro (fictional)' ELSE public.fictionalize_20261025(requester_name) END,
  hold_owner = public.fictionalize_20261025(hold_owner)
WHERE coalesce(co_name, '') || coalesce(cor_name, '') || coalesce(requester_name, '') || coalesce(hold_owner, '')
   <> public.fictionalize_20261025(coalesce(co_name, '')) || public.fictionalize_20261025(coalesce(cor_name, ''))
   || public.fictionalize_20261025(coalesce(requester_name, '')) || public.fictionalize_20261025(coalesce(hold_owner, ''))
   OR requester_name = 'D. Ferraro';

UPDATE public.audit_log SET
  actor = public.fictionalize_20261025(actor),
  reason = public.fictionalize_20261025(reason),
  old_value = public.fictionalize_20261025(old_value),
  new_value = public.fictionalize_20261025(new_value)
WHERE coalesce(actor, '') <> public.fictionalize_20261025(coalesce(actor, ''))
   OR coalesce(reason, '') <> public.fictionalize_20261025(coalesce(reason, ''))
   OR coalesce(old_value, '') <> public.fictionalize_20261025(coalesce(old_value, ''))
   OR coalesce(new_value, '') <> public.fictionalize_20261025(coalesce(new_value, ''));

UPDATE public.document_read_receipts SET opened_by = public.fictionalize_20261025(opened_by)
WHERE coalesce(opened_by, '') <> public.fictionalize_20261025(coalesce(opened_by, ''));

UPDATE public.document_checkouts SET user_name = public.fictionalize_20261025(user_name)
WHERE coalesce(user_name, '') <> public.fictionalize_20261025(coalesce(user_name, ''));

UPDATE public.missions SET program_owner = 'D. Ferraro (fictional)' WHERE program_owner = 'D. Ferraro';

DROP FUNCTION IF EXISTS public.fictionalize_20261025(text);

COMMIT;
