insert into public.templates (nf_1098_tab, name, hq_revision_date, status, governing_citation, citation_tier) values
 ('N/A','Market Research Memorandum',null,'live','FAR Part 10; NFS 1810','binding'),
 ('N/A','Waiver or Deviation Request',null,'live','FAR 1.402; NFS 1801.404','binding'),
 ('N/A','Coordination Memorandum',null,'live','FAR 4.801; NFS CG 1804.8','guidance'),
 ('N/A','Pre-award Package Transmittal Memorandum',null,'live','NF 1098 Checklist for Contract Award File Content; FAR 4.801','binding')
on conflict do nothing;