/**
 * Corrected citations for reference rows the database still stores with
 * superseded text (templates, thresholds, review_rules). Display only: the
 * stored rows are not rewritten here. Once the prepared UPDATEs run, the old
 * strings no longer occur and this map is a no-op.
 * Sources: RFO FAR parts 1, 4, 5, 12, 13, 15 on acquisition.gov; interim NFS
 * (Sept 15, 2026); NFS Companion Guide (Sept 11, 2026).
 */
const CORRECTED: Record<string, string> = {
  "FAR 4.801; NFS CG 1804.8":
    "RFO FAR 4.101; NFS CG 1804.8",
  "NF 1098 Checklist for Contract Award File Content; FAR 4.801":
    "NF 1098 Checklist for Contract Award File Content; RFO FAR 4.101",
  "FAR 13.106-2":
    "RFO FAR 12.203; RFO FAR 13.202",
  "RFO FAR 5.203; FAR 12.603; RFO FAR 6.104":
    "RFO FAR 5.101; RFO FAR 5.101(c)(4)(vii); RFO FAR 5.201; RFO FAR 12.202(b)",
  "FAR 4.801; FAR 4.803":
    "RFO FAR 4.101",
  "FAR 1.602-2(d); NFS 1801.670; NFS CG 1842.2":
    "RFO FAR 1.404(a); NFS 1801.404; NFS CG 1801.42(e); NFS CG 1842.2",
  "FAR 1.602-2(d); NFS CG 1842.2":
    "RFO FAR 1.404(a); NFS 1801.404; NFS CG 1842.2",
  "FAR 4.804-5; FAR 4.805":
    "RFO FAR 4.308-1; RFO FAR 4.309",
  "NFS 1819.202-70":
    "NFS CG 1819.11(a) (Companion Guide)",
  "NFS 1819.202-70; NFS CG 1819.11: required above the micro-purchase threshold (exceptions such as within-scope modifications, SBIR/STTR); NF 1787A market research documentation at $2M and above (CG 1810.12(c))":
    "NFS CG 1819.11(a) (Companion Guide): required above $2,000,000 when not set aside under RFO FAR Part 19, for a modification adding out-of-scope work, and when bundling or consolidation is contemplated; exceptions in CG 1819.11(a)(2); NF 1787A market research documentation at $2M and above (CG 1810.12(c))",
  "NFS 1807.7201: contract opportunity means planned new contract awards exceeding the simplified acquisition threshold":
    "NFS CG 1807.703(a): the acquisition forecast must identify all known contract opportunities that exceed the simplified acquisition threshold",
  "RFO FAR 5.203: at least 15 days; commercial may be shorter or combined synopsis/solicitation (12.603)":
    "RFO FAR 5.101(d) Table 5-2: 15 days before solicitation issuance above $25,000; commercial above the SAT is combined with the solicitation (RFO FAR 12.202(b))",
  "RFO FAR 5.203: at least 30 days, except commercial (reasonable time set by the CO); R&D 45; A&E 30; trade-agreement covered 40":
    "RFO FAR 5.201(d) Table 5-3: 30 days from solicitation for other noncommercial acquisitions; commercial allows a reasonable opportunity to respond; R&D 45 days from the presolicitation notice; WTO GPA or FTA covered and not in the annual forecast 40",
  "FAR 4.805 Table 4-1 (contracts other than construction and A&E); NFS CG 1804.8":
    "RFO FAR 4.309 Table 4-3 (contracts: 6 years after final payment); NFS CG 1804.8",
  "NFS 1801.770 (legal review); no agency-wide dollar trigger stated in the NFS or NFS CG; Center policy and the forthcoming HQ Coordination and Approval Matrix govern; CG 1806.16 for JOFOC concurrences":
    "No agency-wide dollar trigger stated in the NFS or NFS CG; Center policy and the forthcoming HQ Coordination and Approval Matrix govern; CG 1806.16 for JOFOC concurrences",
  "NFS 1819.202-70; NFS CG 1819.11; NFS CG 1810.12(c)":
    "NFS CG 1819.11(a) (Companion Guide guidance); NFS CG 1810.12(c)",
  "RFO FAR 12.204(a); FAR 13.106-3(b)(3) simplified, FAR 15.406-3 part 15":
    "RFO FAR 12.204(a) and (b)(1) simplified, RFO FAR 15.408-2(a) part 15",
  // The PNM row as stored today: the RFO has no FAR 15.406-3; the price
  // negotiation memorandum is documented under RFO FAR 15.408-2(a).
  "RFO FAR 12.204(a) and (b)(1) simplified, FAR 15.406-3 part 15":
    "RFO FAR 12.204(a) and (b)(1) simplified, RFO FAR 15.408-2(a) part 15",
};

/** The corrected citation for a stored reference string, or the string as stored. */
export function correctedCitation(citation: string | null | undefined): string {
  const raw = String(citation ?? "");
  return CORRECTED[raw] ?? raw;
}
