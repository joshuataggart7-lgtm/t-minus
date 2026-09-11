UPDATE public.templates
SET status = 'live',
    governing_citation = 'FAR 12.204(b)(1); FAR 15.406-3',
    citation_tier = 'binding'
WHERE nf_1098_tab = '065';