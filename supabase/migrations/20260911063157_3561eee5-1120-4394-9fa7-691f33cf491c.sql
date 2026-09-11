DELETE FROM public.audit_log WHERE action = 'Document saved' AND acquisition_id = 'A-2027-0102';
DELETE FROM public.documents WHERE acquisition_id = 'A-2027-0102';