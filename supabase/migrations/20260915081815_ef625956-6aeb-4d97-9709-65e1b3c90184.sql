UPDATE public.polls p
SET reviewer_name = COALESCE((
  SELECT u.name
  FROM public.users u
  JOIN public.acquisition_facts a ON a.acquisition_id = p.acquisition_id
  WHERE lower(u.title) = lower(CASE
      WHEN p.reviewer_role ~* 'legal|counsel' THEN 'Center Chief Counsel'
      WHEN p.reviewer_role ~* 'small business' THEN 'Center Small Business Specialist'
      WHEN p.reviewer_role ~* 'flight operations|aviation' THEN 'Flight Operations Office'
      WHEN p.reviewer_role ~* 'enterprise strategy' THEN 'OP enterprise strategy owner'
      WHEN p.reviewer_role ~* 'pricing' THEN 'Center Pricing Officer'
      WHEN p.reviewer_role ~* 'quality' THEN 'Center Quality Assurance Officer'
      WHEN p.reviewer_role ~* '508|cio|ocio|it authorization|security' THEN 'Center Chief Information Officer'
      WHEN p.reviewer_role ~* 'anosca|npa|announcement|notification|sources sought|procurement strategy|acquisition plan' THEN 'Center Procurement Officer'
      ELSE p.reviewer_role
    END)
    AND (u.center_code = a.center_code OR u.center_code = 'HQ')
  ORDER BY (u.center_code = a.center_code) DESC
  LIMIT 1
), p.reviewer_name);