UPDATE public.templates SET status = 'live' WHERE name IN (
  'Postaward Notification Letter Successful Offeror',
  'Postaward Notification Letter Unsuccessful Offeror',
  'Set-Aside Preaward Apparent Successful Offeror Notification',
  'Postaward Conference Report',
  'Award Term Determination',
  'Performance Evaluation Board (PEB) Appointment',
  'Fee Determining Official (FDO) Appointment',
  'Subcontract Consent Review',
  'Request for Provisional Increase in the Estimated Cost'
);

UPDATE public.scenario_trigger_config
SET phase = 'Administration', citation = 'NFS 1832.704-71', updated_at = now()
WHERE trigger_key = 'interagency' AND doc_key = 'provisional-cost-increase';

UPDATE public.scenario_trigger_config
SET doc_key = 'postaward-letter-successful',
    label = 'Postaward notification letter to the successful offeror',
    citation = 'FAR 15.506(a)(1)',
    updated_at = now()
WHERE trigger_key = 'competed-award-notices' AND doc_key = 'postaward-notification-letters';

INSERT INTO public.scenario_trigger_config
  (trigger_key, doc_key, condition_label, label, citation, phase, state, enabled, note, sort_order)
SELECT 'competed-award-notices', 'postaward-letter-unsuccessful', 'Any competed award',
       'Postaward notification letters to the unsuccessful offerors', 'FAR 15.207-2(b)', 'Award', 'required', true,
       'One letter per unsuccessful offeror on the evaluation record.',
       COALESCE((SELECT sort_order FROM public.scenario_trigger_config WHERE doc_key = 'postaward-letter-successful'), 0)
WHERE NOT EXISTS (
  SELECT 1 FROM public.scenario_trigger_config WHERE trigger_key = 'competed-award-notices' AND doc_key = 'postaward-letter-unsuccessful'
);