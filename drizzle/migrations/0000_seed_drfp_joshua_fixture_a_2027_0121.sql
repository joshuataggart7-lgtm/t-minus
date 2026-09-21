INSERT INTO public.acquisition_facts (
  acquisition_id, mission_id, is_critical_path, title, description_of_requirement,
  center_code, center_name, estimated_value, acquisition_method, competition,
  contract_type, contract_format, current_phase, clock_state, funding_fiscal_year,
  need_date, period_of_performance_start, period_of_performance_end, target_award_date,
  funds_certified, co_name, place_of_performance, naics_code, is_package_complete,
  mission_directorate_code, mission_directorate_name, is_seed, scenario
) VALUES (
  'A-2027-0121', 'M6', false,
  'Cryospheric field campaign science support services, FY28-FY32',
  'Competed, negotiated acquisition for cryospheric field campaign science support, including instrument operations, field logistics support and data products across five years. A draft request for proposal is being released to industry for comment before the final solicitation.',
  'ARC', 'Ames Research Center', 18500000, 'FAR 15 negotiated, competitive', 'Full and open competition',
  'CPFF', 'Uniform Contract Format (FAR 15.204)', 'Solicitation', 'running', 'FY28',
  '2028-01-15', '2028-01-15', '2033-01-14', '2027-12-10',
  true, 'Joshua Taggart', 'Moffett Field, California', '541715', false,
  'SMD', 'Science Mission Directorate', true,
  '{"commercial": false, "contract_type": "CPFF", "deliverable": "services", "vehicle": "new"}'::jsonb
)
ON CONFLICT (acquisition_id) DO UPDATE SET
  title = EXCLUDED.title,
  description_of_requirement = EXCLUDED.description_of_requirement,
  acquisition_method = EXCLUDED.acquisition_method,
  competition = EXCLUDED.competition,
  contract_type = EXCLUDED.contract_type,
  contract_format = EXCLUDED.contract_format,
  co_name = EXCLUDED.co_name,
  current_phase = EXCLUDED.current_phase;