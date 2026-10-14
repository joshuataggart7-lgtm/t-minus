CREATE TABLE public.documents_bak3_20261014 (LIKE public.documents INCLUDING DEFAULTS);
GRANT ALL ON public.documents_bak3_20261014 TO service_role;
ALTER TABLE public.documents_bak3_20261014 ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.research_findings_bak3_20261014 (LIKE public.research_findings INCLUDING DEFAULTS);
GRANT ALL ON public.research_findings_bak3_20261014 TO service_role;
ALTER TABLE public.research_findings_bak3_20261014 ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.research_log_bak3_20261014 (LIKE public.research_log INCLUDING DEFAULTS);
GRANT ALL ON public.research_log_bak3_20261014 TO service_role;
ALTER TABLE public.research_log_bak3_20261014 ENABLE ROW LEVEL SECURITY;