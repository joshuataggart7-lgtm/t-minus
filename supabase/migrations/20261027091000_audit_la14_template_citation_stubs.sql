-- Audit LA14 (2026-10-27). 78 template rows carried the seed stub
-- "[fill from template header]" as their governing citation and the Live forms
-- list printed it. A stub is not a citation, so the column is set to NULL
-- (shown as not recorded). Backup: public.templates_bak_20261027.
BEGIN;
CREATE TABLE IF NOT EXISTS public.templates_bak_20261027 AS TABLE public.templates;
ALTER TABLE public.templates_bak_20261027 ENABLE ROW LEVEL SECURITY;
UPDATE public.templates SET governing_citation = NULL
 WHERE btrim(governing_citation) ILIKE '[fill from%';
COMMIT;
