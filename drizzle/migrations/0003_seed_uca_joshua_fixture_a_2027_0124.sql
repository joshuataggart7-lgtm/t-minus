INSERT INTO public.acquisition_facts (
  acquisition_id, mission_id, is_critical_path, title, description_of_requirement,
  center_code, center_name, estimated_value, acquisition_method, competition,
  contract_type, contract_format, current_phase, clock_state, funding_fiscal_year,
  need_date, period_of_performance_start, period_of_performance_end, target_award_date,
  funds_certified, co_name, place_of_performance, naics_code, is_package_complete,
  mission_directorate_code, mission_directorate_name, is_seed, scenario,
  contract_number, vendor_legal_name
) VALUES (
  'A-2027-0124', 'M6', false,
  'Cryogenic test stand refurbishment, letter contract',
  'Letter contract issued so refurbishment of the cryogenic test stand can start immediately while a definitive contract is negotiated. Definitization is scheduled under FAR 16.603-2.',
  'ARC', 'Ames Research Center', 2500000,
  'Letter contract, undefinitized contract action (FAR 16.603)',
  'Negotiated, single offer under urgency',
  'CPFF, to be definitized', 'Uniform Contract Format (FAR 15.204)', 'Award', 'running', 'FY28',
  '2027-11-15', '2027-10-15', '2028-10-14', '2027-10-01',
  true, 'Joshua Taggart', 'Moffett Field, California', '541330', true,
  'SMD', 'Science Mission Directorate', true,
  '{"commercial": false, "contract_type": "CPFF", "deliverable": "services", "vehicle": "letter_contract", "undefinitized": true, "letter_contract": true}'::jsonb,
  '80SAMPLE2026C0124', 'Northline Cryogenic Services, Inc.'
)
ON CONFLICT (acquisition_id) DO UPDATE SET
  title = EXCLUDED.title,
  description_of_requirement = EXCLUDED.description_of_requirement,
  acquisition_method = EXCLUDED.acquisition_method,
  competition = EXCLUDED.competition,
  contract_type = EXCLUDED.contract_type,
  contract_format = EXCLUDED.contract_format,
  estimated_value = EXCLUDED.estimated_value,
  co_name = EXCLUDED.co_name,
  contract_number = EXCLUDED.contract_number,
  vendor_legal_name = EXCLUDED.vendor_legal_name,
  scenario = EXCLUDED.scenario,
  current_phase = EXCLUDED.current_phase;