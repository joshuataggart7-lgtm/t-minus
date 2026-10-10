CREATE TABLE public.backup_research_findings_a0101_20261010b AS
SELECT * FROM public.research_findings WHERE acquisition_id = 'A-2027-0101';
GRANT ALL ON public.backup_research_findings_a0101_20261010b TO service_role;
REVOKE ALL ON public.backup_research_findings_a0101_20261010b FROM anon, authenticated;
ALTER TABLE public.backup_research_findings_a0101_20261010b ENABLE ROW LEVEL SECURITY;