
CREATE TABLE public.regulation_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus text NOT NULL,
  corpus_revision text NOT NULL,
  citation text NOT NULL,
  parent_citation text,
  heading text,
  text text NOT NULL,
  binding boolean NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  effective_date date,
  superseded_at timestamptz,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.regulation_sections TO authenticated;
GRANT ALL ON public.regulation_sections TO service_role;

ALTER TABLE public.regulation_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON public.regulation_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "hq_insert" ON public.regulation_sections FOR INSERT TO authenticated
  WITH CHECK (private.is_admin() OR public.is_hq(auth.uid()));
CREATE POLICY "hq_update" ON public.regulation_sections FOR UPDATE TO authenticated
  USING (private.is_admin() OR public.is_hq(auth.uid()))
  WITH CHECK (private.is_admin() OR public.is_hq(auth.uid()));

CREATE INDEX regulation_sections_live_corpus_citation_idx
  ON public.regulation_sections (corpus, citation) WHERE superseded_at IS NULL;
CREATE INDEX regulation_sections_live_citation_idx
  ON public.regulation_sections (citation) WHERE superseded_at IS NULL;
CREATE INDEX regulation_sections_corpus_retrieved_idx
  ON public.regulation_sections (corpus, retrieved_at);

CREATE TRIGGER update_regulation_sections_updated_at
  BEFORE UPDATE ON public.regulation_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.regulation_sections (corpus,corpus_revision,citation,parent_citation,heading,text,binding,source_url,retrieved_at,effective_date,sha256) VALUES
('far_rfo','RFO-PDF-2026-09-17','FAR Part 10',NULL,'Part 10 — Market Research','10.000 Scope of part.
This part prescribes minimum requirements for conducting market research before procuring supplies and services. See
section 887 of Public Law 114-92(41 U.S.C. 1703 note), 41 U.S.C. 3306(a)(1), 41 U.S.C. 3307, and 10 U.S.C. 3453.

10.001 Market research requirements.
(a) Agencies must describe their legitimate needs.
   (b) Agencies must conduct market research appropriate to the circumstances before—
       (1) Developing new requirements documents;
       (2) Soliciting offers for acquisitions with an estimated value over the simplified acquisition threshold; or
       (3) Awarding a task or delivery order over the simplified acquisition threshold.
   (c) Agencies should engage in responsible and constructive exchanges with industry. Agencies may use different strategies
and methods to gather information, so long as they comply with existing law and regulation and do not provide an unfair
competitive advantage to particular firms or violate the procurement integrity requirements (see 3.104).
   (d) When conducting market research, agencies must not ask potential sources to submit more than the minimum
information necessary to make the determinations required in paragraph (f).
   (e) Agencies must document the results of market research in a manner that suits the acquisition’s size and complexity.
   (f) Agencies must procure commercial products and commercial services to the maximum extent practicable. Using the
results of market research, agencies will determine, in the following order of priority, whether—
       (1) A commercial product or commercial service on an existing governmentwide contract can meet the agency''s
requirements;
       (2) The requirements could be modified so the agency could use an existing governmentwide contract;
       (3) A commercial product or commercial service is available from another source;
       (4) A commercial product or commercial service could be modified to meet the agency''s requirements; or
       (5) The requirement can only be satisfied by a nondevelopmental item.

10.002 Clause.
The contracting officer must insert the clause at 52.210-1, Market Research, in solicitations and contracts for
noncommercial acquisitions over $7.5 million. This policy was established in 10 U.S.C. 3453(c).',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'87cd4d85fc35dcb70631e19b14290abbcba42a100d29480427f3af41318f91de'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.000','FAR Part 10','10.000 Scope of part.','This part prescribes minimum requirements for conducting market research before procuring supplies and services. See
section 887 of Public Law 114-92(41 U.S.C. 1703 note), 41 U.S.C. 3306(a)(1), 41 U.S.C. 3307, and 10 U.S.C. 3453.',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'33a499b4344847d0ceaa14c20754e90319566af5e3ff5ce521e8915104ca0640'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.001','FAR Part 10','10.001 Market research requirements.','(a) Agencies must describe their legitimate needs.
   (b) Agencies must conduct market research appropriate to the circumstances before—
       (1) Developing new requirements documents;
       (2) Soliciting offers for acquisitions with an estimated value over the simplified acquisition threshold; or
       (3) Awarding a task or delivery order over the simplified acquisition threshold.
   (c) Agencies should engage in responsible and constructive exchanges with industry. Agencies may use different strategies
and methods to gather information, so long as they comply with existing law and regulation and do not provide an unfair
competitive advantage to particular firms or violate the procurement integrity requirements (see 3.104).
   (d) When conducting market research, agencies must not ask potential sources to submit more than the minimum
information necessary to make the determinations required in paragraph (f).
   (e) Agencies must document the results of market research in a manner that suits the acquisition’s size and complexity.
   (f) Agencies must procure commercial products and commercial services to the maximum extent practicable. Using the
results of market research, agencies will determine, in the following order of priority, whether—
       (1) A commercial product or commercial service on an existing governmentwide contract can meet the agency''s
requirements;
       (2) The requirements could be modified so the agency could use an existing governmentwide contract;
       (3) A commercial product or commercial service is available from another source;
       (4) A commercial product or commercial service could be modified to meet the agency''s requirements; or
       (5) The requirement can only be satisfied by a nondevelopmental item.',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'ba7f6fe157e81fc27f03856aad7739ffdc428a5457da6677634dfd5b22a8c54f'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.001(a)','FAR 10.001','FAR 10.001(a)','(a) Agencies must describe their legitimate needs.',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'d676864aa37ba260e5af8bcfbbe7e6662e2fc8b09a415ab361c30d27ebfe4c48'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.001(b)','FAR 10.001','FAR 10.001(b)','(b) Agencies must conduct market research appropriate to the circumstances before—
       (1) Developing new requirements documents;
       (2) Soliciting offers for acquisitions with an estimated value over the simplified acquisition threshold; or
       (3) Awarding a task or delivery order over the simplified acquisition threshold.',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'4582ec482e2541df76c72169563441f1ab2435c331b96e17770bb477a835f6c8'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.001(c)','FAR 10.001','FAR 10.001(c)','(c) Agencies should engage in responsible and constructive exchanges with industry. Agencies may use different strategies
and methods to gather information, so long as they comply with existing law and regulation and do not provide an unfair
competitive advantage to particular firms or violate the procurement integrity requirements (see 3.104).',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'ae5e0a05b0a0d4667691946959fb8d294ddfb6614bba2569c390c41c451215ee'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.001(d)','FAR 10.001','FAR 10.001(d)','(d) When conducting market research, agencies must not ask potential sources to submit more than the minimum
information necessary to make the determinations required in paragraph (f).',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'3e99383ac471658a6373e0c69f26c8f58117922546575955834d5729592029f9'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.001(e)','FAR 10.001','FAR 10.001(e)','(e) Agencies must document the results of market research in a manner that suits the acquisition’s size and complexity.',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'0efb7c51c3279ebfc9c8104b3d9824b34ff7f1c08132feaad8970b7de3e186ba'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.001(f)','FAR 10.001','FAR 10.001(f)','(f) Agencies must procure commercial products and commercial services to the maximum extent practicable. Using the
results of market research, agencies will determine, in the following order of priority, whether—
       (1) A commercial product or commercial service on an existing governmentwide contract can meet the agency''s
requirements;
       (2) The requirements could be modified so the agency could use an existing governmentwide contract;
       (3) A commercial product or commercial service is available from another source;
       (4) A commercial product or commercial service could be modified to meet the agency''s requirements; or
       (5) The requirement can only be satisfied by a nondevelopmental item.',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'49bdda69c740a09380c2f2ac1ddb0e7696e205d3d8184717d28576a4e1057521'),
('far_rfo','RFO-PDF-2026-09-17','FAR 10.002','FAR Part 10','10.002 Clause.','The contracting officer must insert the clause at 52.210-1, Market Research, in solicitations and contracts for
noncommercial acquisitions over $7.5 million. This policy was established in 10 U.S.C. 3453(c).',true,'https://www.acquisition.gov/sites/default/files/page_file_uploads/RFO.pdf','2026-09-17T05:20:00Z',NULL,'694b9680659ed7113c1620107b61f7a8acda78a2c94111e12cc07b00b5fc77b3'),
('far_companion','far-companion-v2-2026-09-17','FAR Companion Part 10',NULL,'FAR Companion — Market Research (excerpt)','Market Research ........................................................................................................25 Part 11 - Describing Agency Needs ..........................................................................................27 Part 12 - Acquisition of Commercial Products and Commercial Services ..................................30 Part 13 - Simplified Procedures for Noncommercial Acquisitions ..............................................33 Part 14 - Sealed Bidding ...........................................................................................................33 Part 15 - Contracting by Negotiation .........................................................................................35 Part 16 - Types of Contracts .....................................................................................................40 Part 17 - Special Contracting Metho',false,'https://www.acquisition.gov/sites/default/files/page_file_uploads/far-companion.pdf','2026-09-17T05:20:00Z',NULL,'4a8c64fd8a5146f2dcc2379e79b0642ba54777ab16df0e257e8dc3ac03e29752');
