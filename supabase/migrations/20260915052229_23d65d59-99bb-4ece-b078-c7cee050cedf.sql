insert into public.document_attachments (acquisition_id, doc_key, doc_label, nf_1098_tab, file_name, storage_path, content_type, size_bytes, uploaded_by_name, is_seed)
select f.acquisition_id, 'funds_certified', 'Funds certified for the period', '001',
       'Funds certified for the period — seeded sample.txt',
       f.acquisition_id || '/funds_certified/seeded-sample.txt', 'text/plain', 512, 'Seed loader', true
from public.acquisition_facts f
where f.acquisition_id in ('A-2027-0103','A-2027-0104','A-2027-0106','A-2027-0107','A-2027-0108','A-2027-0111','A-2027-0112','A-2027-0113')
  and not exists (select 1 from public.document_attachments a where a.acquisition_id = f.acquisition_id and a.doc_key = 'funds_certified');

update public.document_attachments a
set parsed_total = coalesce(f.estimated_value, 250000)
from public.acquisition_facts f
where f.acquisition_id = a.acquisition_id and a.doc_key = 'igce_attached' and a.is_seed and a.parsed_total is null;

update public.acquisition_facts
set funds_certified = true
where acquisition_id in ('A-2027-0103','A-2027-0104','A-2027-0106','A-2027-0107','A-2027-0108','A-2027-0111','A-2027-0112','A-2027-0113');

update public.acquisition_facts
set sow_attached = true, igce_attached = true, acquisition_forecast_verified = true
where acquisition_id in ('A-2027-0103','A-2027-0104','A-2027-0105','A-2027-0106','A-2027-0107','A-2027-0108','A-2027-0109','A-2027-0110','A-2027-0111','A-2027-0112','A-2027-0113');