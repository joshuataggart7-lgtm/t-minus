UPDATE public.templates SET status = 'live'
WHERE name IN (
  'Written Acquisition Plan Template for Contracts',
  'Procurement Strategy Meeting Executive Presentation',
  'Procurement Strategy Meeting Signature Page Template for Contracts',
  'Addendum Outlining Significant Changes to Approved PSMs / Written Acquisition Plans Template',
  'Determination ASM Not Conducted Memorandum',
  'Requirements Development Team Request & Appointment Letters',
  'Determination and Findings Authority to Execute a CPIF Contract',
  'Determination and Findings Authority to Execute a CPAF Contract',
  'Determination and Findings Authority to Execute a FPAF Contract',
  'Determination and Findings Authority to Execute a FPI Contract',
  'Determination and Findings Noncommercial Time and Materials or Labor Hour Contract / Order',
  'Determination and Findings POP or Ordering Period Over 5 years',
  'Determination and Findings Single Award IDIQ Contract Over $150M',
  'FAR Period of Performance-Ordering Period Deviation'
);

INSERT INTO public.templates (nf_1098_tab, name, hq_revision_date, status, governing_citation, citation_tier)
SELECT '003', 'Determination and Findings GSA Time and Materials or Labor Hour Order', '11/1/2025', 'live',
       'FAR 8.401; FAR 12.104(b); FAR 16.601-4(c)', 'binding'
WHERE NOT EXISTS (
  SELECT 1 FROM public.templates WHERE name = 'Determination and Findings GSA Time and Materials or Labor Hour Order'
);