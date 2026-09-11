alter table public.audit_log add column if not exists phase text;
create index if not exists polls_acq_phase_idx on public.polls (acquisition_id, phase);
create index if not exists comments_document_idx on public.comments (document_id);