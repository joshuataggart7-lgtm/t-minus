INSERT INTO public.templates (nf_1098_tab, name, hq_revision_date, status, governing_citation, citation_tier)
SELECT 'N/A', 'Commerciality Determination and Findings', NULL, 'live', 'FAR 2.101; FAR 10.002(e); FAR 12.102', 'binding'
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE name = 'Commerciality Determination and Findings');

UPDATE public.templates SET status='live', governing_citation='FAR 7.107-1; FAR 7.107-2; 15 U.S.C. 657q' WHERE name='Determination and Findings for Consolidation of Requirements';
UPDATE public.templates SET status='live', governing_citation='FAR 7.107-1; FAR 7.107-3; FAR 7.107-4' WHERE name='Determination and Findings for Bundled Requirements';
UPDATE public.templates SET status='live', governing_citation='FAR 12.207(b); FAR 16.601(d)' WHERE name='Determination and Findings Commercial Time and Materials or Labor Hour Contract / Order';
UPDATE public.templates SET status='live', governing_citation='FAR 17.502-2(c); 31 U.S.C. 1535' WHERE name='Determination and Findings Interagency Acquisitions Economy Act';
UPDATE public.templates SET status='live', governing_citation='FAR 16.505(b)(2); FAR 11.105; FAR 8.405-6' WHERE name='Fair Opportunity Exception - Brand Name Justification';
UPDATE public.templates SET status='live', governing_citation='FAR 17.205(a); FAR 17.202' WHERE name='Option Justification';
UPDATE public.templates SET status='live', governing_citation='FAR 17.207(a)' WHERE name='Option Exercise Contractor Preliminary Notification';
UPDATE public.templates SET status='live', governing_citation='FAR 17.207(c) and (d); FAR 17.207(f)' WHERE name='Option Exercise Determination';