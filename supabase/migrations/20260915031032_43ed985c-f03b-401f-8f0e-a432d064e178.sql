UPDATE public.acquisition_facts a
SET igce_attached = CASE WHEN EXISTS (SELECT 1 FROM public.document_attachments d WHERE d.acquisition_id = a.acquisition_id AND d.doc_key = 'igce_attached') THEN a.igce_attached ELSE false END,
    sow_attached = CASE WHEN EXISTS (SELECT 1 FROM public.document_attachments d WHERE d.acquisition_id = a.acquisition_id AND d.doc_key = 'sow_attached') THEN a.sow_attached ELSE false END,
    funds_certified = CASE WHEN EXISTS (SELECT 1 FROM public.document_attachments d WHERE d.acquisition_id = a.acquisition_id AND d.doc_key = 'funds_certified') THEN a.funds_certified ELSE false END,
    updated_at = now()
WHERE COALESCE(a.igce_attached,false) OR COALESCE(a.sow_attached,false) OR COALESCE(a.funds_certified,false);