CREATE TABLE public.acquisition_facts_bak2_20261014 (LIKE public.acquisition_facts INCLUDING DEFAULTS);
GRANT ALL ON public.acquisition_facts_bak2_20261014 TO service_role;
ALTER TABLE public.acquisition_facts_bak2_20261014 ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.documents_bak2_20261014 (LIKE public.documents INCLUDING DEFAULTS);
GRANT ALL ON public.documents_bak2_20261014 TO service_role;
ALTER TABLE public.documents_bak2_20261014 ENABLE ROW LEVEL SECURITY;