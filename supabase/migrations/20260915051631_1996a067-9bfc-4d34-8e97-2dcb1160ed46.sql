insert into public.document_attachments
  (acquisition_id, doc_key, doc_label, nf_1098_tab, file_name, storage_path, content_type, size_bytes, uploaded_by_name, is_seed)
select a.acquisition_id, d.doc_key, d.doc_label, '001',
       d.doc_label || ' — seeded sample.txt',
       a.acquisition_id || '/' || d.doc_key || '/seeded-sample.txt',
       'text/plain', 512, 'Seed loader', true
from public.acquisition_facts a
cross join (values
  ('sow_attached','Statement of work or performance work statement'),
  ('acquisition_forecast_verified','NF 1707 requester sections'),
  ('igce_attached','Independent government cost estimate (IGCE)')
) as d(doc_key, doc_label)
where a.acquisition_id in ('A-2027-0103','A-2027-0104','A-2027-0105','A-2027-0106','A-2027-0107','A-2027-0108','A-2027-0109','A-2027-0110','A-2027-0111','A-2027-0112','A-2027-0113')
  and not exists (
    select 1 from public.document_attachments x
    where x.acquisition_id = a.acquisition_id and x.doc_key = d.doc_key
  );

insert into public.documents (acquisition_id, field_values, version, saved_by, saved_at, is_seed)
select att.acquisition_id,
       jsonb_build_object(
         'attachment_id', att.attachment_id,
         'doc_key', att.doc_key,
         'doc_label', att.doc_label,
         'file_name', att.file_name,
         'storage_path', att.storage_path,
         'nf_1098_tab', att.nf_1098_tab,
         'kind', 'attachment',
         'synthetic', true
       ),
       1, 'Seed loader', now(), true
from public.document_attachments att
where att.is_seed = true
  and not exists (
    select 1 from public.documents d
    where d.acquisition_id = att.acquisition_id
      and d.field_values->>'attachment_id' = att.attachment_id::text
  );