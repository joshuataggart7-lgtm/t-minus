UPDATE public.acquisition_facts
SET vendor_uei = 'G1THVER8BNL4',
    vendor_legal_name = 'University of Mississippi (public SAM UEI for exclusions smoke test — not a DEMO vendor)',
    updated_at = now()
WHERE acquisition_id = 'A-2026-0090';