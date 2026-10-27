-- Audit LA15 (2026-10-27). Federal Register items matched on full text only
-- (for example a Medicare Part D proposed rule) are not acquisition items.
-- Same test as isAcquisitionRelevant() in src/lib/watch-fetch.server.ts.
-- Backup: public.watch_items_bak_20261027.
BEGIN;
CREATE TABLE IF NOT EXISTS public.watch_items_bak_20261027 AS TABLE public.watch_items;
ALTER TABLE public.watch_items_bak_20261027 ENABLE ROW LEVEL SECURITY;
DELETE FROM public.watch_items
 WHERE source = 'Federal Register'
   AND coalesce(agency,'') !~* 'General Services Administration|Defense Department|Defense Acquisition|National Aeronautics and Space|Federal Procurement Policy|Cost Accounting Standards|Small Business Administration|Federal Contract Compliance'
   AND NOT (coalesce(title,'') || ' ' || coalesce(summary,'')) ~ '\y(FAR|DFARS|NFS|GSAR)\y'
   AND NOT (coalesce(title,'') || ' ' || coalesce(summary,'')) ~*
     'acquisition regulation|FAR Supplement|procurement|contract(s|ing|or|ors)?\y|solicitation|small business|protest|Unified Agenda';
COMMIT;
