INSERT INTO public.acquisition_facts (
  acquisition_id, mission_id, is_critical_path, title, description_of_requirement,
  center_code, center_name, estimated_value, acquisition_method, competition,
  contract_type, contract_format, current_phase, clock_state, funding_fiscal_year,
  need_date, period_of_performance_start, period_of_performance_end, target_award_date,
  funds_certified, co_name, place_of_performance, naics_code, is_package_complete,
  mission_directorate_code, mission_directorate_name, is_seed, scenario,
  contract_number, vendor_legal_name
) VALUES (
  'A-2027-0123', 'M6', false,
  'Brand-name laser altimeter calibration modules, fair opportunity order',
  'Order placed under a multiple-award IDIQ for laser altimeter calibration modules peculiar to one manufacturer. Fair opportunity is excepted on a brand-name basis under FAR 16.507-7(a).',
  'ARC', 'Ames Research Center', 750000,
  'FAR 16 multiple-award IDIQ, fair opportunity order, brand name',
  'Fair opportunity excepted, brand name',
  'FFP', 'Uniform Contract Format (FAR 15.204)', 'Solicitation', 'running', 'FY28',
  '2028-05-01', '2027-10-01', '2028-09-30', '2027-08-15',
  true, 'Joshua Taggart', 'Moffett Field, California', '334511', true,
  'SMD', 'Science Mission Directorate', true,
  '{"commercial": false, "contract_type": "FFP", "deliverable": "supplies", "vehicle": "idiq_order", "brand_name": true, "fair_opportunity_exception": "brand_name"}'::jsonb,
  '80SAMPLE2026C0123', 'Cascade Photonics Instruments, LLC'
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