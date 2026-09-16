insert into templates (name, status, citation_tier, governing_citation)
select 'SF 1449, Solicitation/Contract/Order for Commercial Products and Commercial Services', 'current', 'binding', 'FAR 12.204(a); FAR 53.212'
where not exists (select 1 from templates where name = 'SF 1449, Solicitation/Contract/Order for Commercial Products and Commercial Services');

insert into templates (name, status, citation_tier, governing_citation)
select 'SF 30, Amendment of Solicitation/Modification of Contract', 'current', 'binding', 'FAR 43.301; FAR 53.243'
where not exists (select 1 from templates where name = 'SF 30, Amendment of Solicitation/Modification of Contract');