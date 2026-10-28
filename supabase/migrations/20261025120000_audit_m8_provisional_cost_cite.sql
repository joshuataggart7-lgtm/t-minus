-- Audit 2026-10-25, M8. NFS 1832.704-71 is not in the NFS as of September 15, 2026
-- (PCD 26-03B): Subpart 1832.7 there holds only 1832.706, 1832.706-2 and 1832.706-270.
-- The cite is marked for verification instead of pointing at a section that was not checked.
-- Backup of the row before the change. One transaction.
BEGIN;
CREATE TABLE IF NOT EXISTS public.scenario_trigger_config_bak_20261025 AS
SELECT * FROM public.scenario_trigger_config WHERE false;
ALTER TABLE public.scenario_trigger_config_bak_20261025 ENABLE ROW LEVEL SECURITY;

INSERT INTO public.scenario_trigger_config_bak_20261025
SELECT * FROM public.scenario_trigger_config
WHERE trigger_key = 'interagency' AND doc_key = 'provisional-cost-increase'
  AND citation = 'NFS 1832.704-71';

UPDATE public.scenario_trigger_config
SET citation = 'NFS 1832.704-71 (not found in NFS as of 9/15/2026 per PCD 26-03B; verify)', updated_at = now()
WHERE trigger_key = 'interagency' AND doc_key = 'provisional-cost-increase'
  AND citation = 'NFS 1832.704-71';

COMMIT;
