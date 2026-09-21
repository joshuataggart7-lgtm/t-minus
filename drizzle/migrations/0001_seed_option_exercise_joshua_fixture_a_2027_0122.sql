INSERT INTO public.acquisition_facts (
  acquisition_id, mission_id, is_critical_path, title, description_of_requirement,
  center_code, center_name, estimated_value, acquisition_method, competition,
  contract_type, contract_format, current_phase, clock_state, funding_fiscal_year,
  need_date, period_of_performance_start, period_of_performance_end, target_award_date,
  funds_certified, co_name, place_of_performance, naics_code, is_package_complete,
  mission_directorate_code, mission_directorate_name, is_seed, scenario,
  contract_number, vendor_legal_name
) VALUES (
  'A-2027-0122', 'M6', false,
  'Airborne instrument operations support services, Option Year 2',
  'Awarded, negotiated contract for airborne instrument operations support. Option Year 2 is being exercised under the terms of the contract, with a written determination for the contract file.',
  'ARC', 'Ames Research Center', 9400000, 'FAR 15 negotiated, competitive', 'Full and open competition',
  'CPFF', 'Uniform Contract Format (FAR 15.204)', 'Administration', 'running', 'FY28',
  '2028-03-01', '2026-03-01', '2031-02-28', '2026-02-10',
  true, 'Joshua Taggart', 'Moffett Field, California', '541715', true,
  'SMD', 'Science Mission Directorate', true,
  '{"commercial": false, "contract_type": "CPFF", "deliverable": "services", "vehicle": "option"}'::jsonb,
  '80SAMPLE2026C0122', 'Meridian Airborne Science Services, LLC'
)
ON CONFLICT (acquisition_id) DO UPDATE SET
  title = EXCLUDED.title,
  description_of_requirement = EXCLUDED.description_of_requirement,
  acquisition_method = EXCLUDED.acquisition_method,
  competition = EXCLUDED.competition,
  contract_type = EXCLUDED.contract_type,
  contract_format = EXCLUDED.contract_format,
  co_name = EXCLUDED.co_name,
  contract_number = EXCLUDED.contract_number,
  vendor_legal_name = EXCLUDED.vendor_legal_name,
  current_phase = EXCLUDED.current_phase;