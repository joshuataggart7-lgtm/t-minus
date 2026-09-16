// Clause packet selection.
//
// The NCMS handoff packet's clause list is built from the record, never from a
// fixed list: acquisition method, competition, set-aside, contract type, value
// against the seeded thresholds, place of performance, and the hardware /
// services / IT flags. Status, effective date, and disposition still come from
// the PCD 26-03B and NFS 1852 matrices in the clauses table; a clause the
// matrices show as removed is never carried into a new document, and FAR
// 52.212-5 is Reserved and never included.
//
// Under the RFO / PCD 26-03B, neither FAR 52.212-3 nor FAR 52.212-5 is
// recommended, offered, or apply-able on the commercial SF 1449 packet:
//   - 52.212-5 is Reserved; its old checkbox paragraph no longer carries
//     commercial clause content.
//   - Commercial clause content is prescribed via FAR Tables 12-2 and 12-3
//     (and each clause's own prescription), so formerly bundled clauses are
//     listed on their own, not through a 52.212-5 block.
//   - Offeror representations and certifications for commercial buys are made
//     in SAM (with FAR 52.204-7 on the packet), not by packing 52.212-3.
// The single reason note surfaced to the officer lives in RFO_RESERVED_212_NOTE.

export type ClauseRow = {
  clause_number: string | null;
  title: string | null;
  ucf_section: string | null;
  source: string | null;
  status: string | null;
  effective_date: string | null;
  disposition?: string | null;
  fill_ins?: unknown;
};

export type ThresholdRow = { name: string | null; value: number | null; citation?: string | null };

export type PacketFacts = Record<string, unknown> & {
  acquisition_id?: unknown;
};

function str(f: PacketFacts, key: string): string {
  const v = f[key];
  return typeof v === "string" ? v : "";
}
function bool(f: PacketFacts, key: string): boolean {
  return f[key] === true;
}
function num(f: PacketFacts, key: string): number {
  const v = f[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

export type PacketClause = {
  clause_number: string;
  title: string;
  reason: string;
  ucf_section: string | null;
  source: string | null;
  status: string | null;
  effective_date: string | null;
  fill_ins: unknown;
  /**
   * True where the clause used to ride along inside FAR 52.212-5. That
   * paragraph is Reserved under the RFO, so the clause carries its own
   * prescription and is listed on its own.
   */
  formerly_bundled: boolean;
};

type Rule = {
  number: string;
  title: string;
  /** The clause was formerly carried inside the 52.212-5 paragraph list. */
  formerlyBundled?: boolean;
  /** Returns the reason the record includes this clause, or null to leave it out. */
  applies: (f: Ctx) => string | null;
};

type Ctx = {
  f: PacketFacts;
  value: number;
  micro: number;
  sat: number;
  subPlan: number;
  method: string;
  competition: string;
  setAside: string;
  type: string;
  place: string;
  commercial: boolean;
  services: boolean;
  hardware: boolean;
  it: boolean;
  costReimbursement: boolean;
  idiq: boolean;
  /** Plain words for why the vehicle reads as indefinite delivery, from the record. */
  idiqSource: string;
  soleSource: boolean;
  options: boolean;
  onInstallation: boolean;
  /** The clause set recorded on the vehicle, verbatim. */
  clauseSet: string;
  money: (n: number) => string;
};

const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `$${n.toLocaleString("en-US")}`;

function thresholdValue(thresholds: ThresholdRow[], name: string, fallback: number): number {
  const row = thresholds.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase());
  return typeof row?.value === "number" ? row.value : fallback;
}

const RULES: Rule[] = [
  {
    number: "52.204-7",
    title: "System for Award Management",
    applies: () => "Required in every solicitation and award (FAR 4.1105(a)(1)).",
  },
  {
    number: "52.204-13",
    title: "System for Award Management Maintenance",
    applies: () => "Required in every award; the vendor keeps its SAM registration current (FAR 4.1105(b)).",
  },
  {
    number: "52.204-24",
    title: "Representation Regarding Certain Telecommunications and Video Surveillance Services or Equipment",
    applies: () => "Required in every solicitation (FAR 4.2105(a)).",
  },
  {
    number: "52.204-21",
    title: "Basic Safeguarding of Covered Contractor Information Systems",
    applies: (c) =>
      c.value > c.micro
        ? `Award above the micro-purchase threshold (${c.money(c.micro)}); contractor information systems are covered (FAR 4.1903).`
        : null,
  },
  {
    number: "52.209-6",
    formerlyBundled: true,
    title: "Protecting the Government's Interest When Subcontracting with Contractors Debarred, Suspended, or Proposed for Debarment",
    applies: (c) =>
      c.value > c.micro ? `Value ${c.money(c.value)} exceeds the micro-purchase threshold (FAR 9.409).` : null,
  },
  {
    number: "52.212-1",
    title: "Instructions to Offerors—Commercial Products and Commercial Services",
    applies: (c) => (c.commercial ? "Commercial determination on the record; FAR 12 solicitation (FAR 12.301(b)(1))." : null),
  },
  {
    number: "52.212-2",
    title: "Evaluation—Commercial Products and Commercial Services",
    applies: (c) =>
      c.commercial && !c.soleSource
        ? `Commercial buy with ${c.competition || "competition"}; evaluation factors are stated to offerors (FAR 12.301(c)).`
        : null,
  },
  {
    // Not packed under the RFO. Representations and certifications are made in
    // SAM under FAR 52.204-7, and 52.212-3 is not carried forward into the
    // recommended commercial SF 1449 packet on the strength of the reserved
    // 52.212-5 paragraph list.
    number: "52.212-3",
    title: "Offeror Representations and Certifications\u2014Commercial Products and Commercial Services",
    applies: () => null,
  },
  {
    number: "52.212-4",
    title: "Contract Terms and Conditions—Commercial Products and Commercial Services",
    applies: (c) => (c.commercial ? "Commercial determination on the record (FAR 12.301(b)(3))." : null),
  },
  {
    number: "52.213-4",
    title: "Terms and Conditions—Simplified Acquisitions (Other Than Commercial Products and Commercial Services)",
    applies: (c) =>
      !c.commercial && /far 13/i.test(c.method)
        ? "Simplified acquisition procedures on a non-commercial buy (FAR 13.302-5(d))."
        : null,
  },
  {
    number: "52.219-1",
    title: "Small Business Program Representations",
    applies: (c) =>
      c.value > c.micro && !c.soleSource
        ? "Competed award above the micro-purchase threshold; size status is represented (FAR 19.309(a))."
        : null,
  },
  {
    number: "52.219-6",
    formerlyBundled: true,
    title: "Notice of Total Small Business Set-Aside",
    applies: (c) =>
      /total small business/i.test(c.setAside)
        ? `Set-aside on the record: ${c.setAside} (FAR 19.507(a)).`
        : null,
  },
  {
    number: "52.219-9",
    formerlyBundled: true,
    title: "Small Business Subcontracting Plan",
    applies: (c) =>
      c.value >= c.subPlan && !/small business/i.test(c.setAside)
        ? `Value ${c.money(c.value)} is at or above the subcontracting plan threshold (${c.money(c.subPlan)}) and the buy is not set aside (FAR 19.708(b)).`
        : null,
  },
  {
    number: "52.219-28",
    formerlyBundled: true,
    title: "Post-Award Small Business Program Rerepresentation",
    applies: (c) =>
      c.value > c.micro ? "Award above the micro-purchase threshold (FAR 19.309(c))." : null,
  },
  {
    number: "52.222-3",
    formerlyBundled: true,
    title: "Convict Labor",
    applies: (c) => (c.value > c.micro ? "Award above the micro-purchase threshold (FAR 22.202)." : null),
  },
  {
    number: "52.222-21",
    formerlyBundled: true,
    title: "Prohibition of Segregated Facilities",
    applies: (c) => (c.value > c.micro ? "Award above the micro-purchase threshold (FAR 22.810(e))." : null),
  },
  {
    number: "52.222-26",
    formerlyBundled: true,
    title: "Equal Opportunity",
    applies: (c) => (c.value > c.micro ? "Award above the micro-purchase threshold (FAR 22.810(e))." : null),
  },
  {
    number: "52.222-41",
    formerlyBundled: true,
    title: "Service Contract Labor Standards",
    applies: (c) =>
      c.services && c.value > 2500
        ? `Services over $2,500 performed in the United States (${c.place || "place of performance on the record"}) (FAR 22.1006(a)).`
        : null,
  },
  {
    number: "52.223-18",
    formerlyBundled: true,
    title: "Encouraging Contractor Policies to Ban Text Messaging While Driving",
    applies: () => "Required in every solicitation and contract (FAR 23.1105).",
  },
  {
    number: "52.225-13",
    formerlyBundled: true,
    title: "Restrictions on Certain Foreign Purchases",
    applies: () => "Required in every solicitation and contract (FAR 25.1103(a)).",
  },
  {
    number: "52.232-33",
    formerlyBundled: true,
    title: "Payment by Electronic Funds Transfer—System for Award Management",
    applies: () => "Payment runs through the vendor's SAM registration (FAR 32.1110(a)(1)(i)).",
  },
  {
    number: "52.232-40",
    formerlyBundled: true,
    title: "Providing Accelerated Payments to Small Business Subcontractors",
    applies: () => "Required in every solicitation and contract (FAR 32.009-2).",
  },
  {
    number: "52.233-3",
    formerlyBundled: true,
    title: "Protest After Award",
    applies: () => "Required in every solicitation and contract (FAR 33.106(a)).",
  },
  {
    number: "52.233-4",
    title: "Applicable Law for Breach of Contract Claim",
    applies: () => "Required in every solicitation and contract (FAR 33.215(b)).",
  },
  {
    number: "52.216-7",
    title: "Allowable Cost and Payment",
    applies: (c) =>
      c.costReimbursement ? `Contract type on the record: ${c.f["contract_type"]} (FAR 16.307(a)).` : null,
  },
  {
    number: "52.216-18",
    title: "Ordering",
    applies: (c) => (c.idiq ? `Contract type on the record: ${c.f["contract_type"]} (FAR 16.506(a)).` : null),
  },
  {
    number: "52.216-19",
    title: "Order Limitations",
    applies: (c) => (c.idiq ? `Contract type on the record: ${c.f["contract_type"]} (FAR 16.506(b)).` : null),
  },
  {
    number: "52.216-22",
    title: "Indefinite Quantity",
    applies: (c) => (c.idiq ? `Contract type on the record: ${c.f["contract_type"]} (FAR 16.506(e)).` : null),
  },
  {
    number: "52.217-8",
    title: "Option to Extend Services",
    applies: (c) =>
      c.options && c.services ? "Option periods are on the contract schedule for services (FAR 17.208(f))." : null,
  },
  {
    number: "52.217-9",
    title: "Option to Extend the Term of the Contract",
    applies: (c) => (c.options ? "Option periods are on the contract schedule (FAR 17.208(g))." : null),
  },
  {
    number: "52.237-2",
    title: "Protection of Government Buildings, Equipment, and Vegetation",
    applies: (c) =>
      c.services && c.onInstallation
        ? `Services performed on a Government installation (${c.place}) (FAR 37.110(a)).`
        : null,
  },
  {
    number: "52.244-6",
    formerlyBundled: true,
    title: "Subcontracts for Commercial Products and Commercial Services",
    applies: (c) => (c.commercial ? "Commercial determination on the record (FAR 44.403)." : null),
  },
  {
    number: "52.245-1",
    title: "Government Property",
    applies: (c) =>
      c.hardware ? "Hardware deliverable on the record; Government property is anticipated (FAR 45.107(a))." : null,
  },
  {
    number: "52.246-4",
    title: "Inspection of Services—Fixed-Price",
    applies: (c) =>
      c.services && /ffp|firm[- ]fixed|fixed[- ]price/i.test(c.type)
        ? `Fixed-price services (${c.f["contract_type"]}) (FAR 46.304).`
        : null,
  },
  {
    number: "52.247-34",
    title: "F.o.b. Destination",
    applies: (c) => (c.hardware ? "Hardware deliverable on the record (FAR 47.305-4(b))." : null),
  },
  {
    number: "1852.203-70",
    title: "Display of Inspector General Hotline Posters",
    applies: (c) =>
      c.value > c.sat ? `Value ${c.money(c.value)} exceeds the simplified acquisition threshold (NFS 1803.7001).` : null,
  },
  {
    number: "1852.204-76",
    title: "Security Requirements for Unclassified Information Technology Resources",
    applies: (c) => (c.it ? "The record says the action includes information technology (NFS 1804.470-4(a))." : null),
  },
  {
    number: "1852.223-70",
    title: "Safety and Health",
    applies: (c) =>
      c.services && c.onInstallation
        ? `Services performed on a NASA installation (${c.place}) (NFS 1823.7001(a)).`
        : null,
  },
  {
    number: "1852.237-70",
    title: "Emergency Evacuation Procedures",
    applies: (c) =>
      c.services && c.onInstallation
        ? `On-site services at a NASA installation (${c.place}) (NFS 1837.110-70).`
        : null,
  },
  {
    number: "1852.245-70",
    title: "Contractor Requests for Government-Furnished Property",
    applies: (c) =>
      c.hardware ? "Hardware deliverable on the record; Government-furnished property may apply (NFS 1845.107-70(a))." : null,
  },
];

/** Every clause number the selector may read from the matrices. */
export const PACKET_CANDIDATE_NUMBERS = RULES.map((r) => r.number);

/** Back-compat export: the query in the file page reads the candidate set. */
export const PACKET_CLAUSE_NUMBERS = PACKET_CANDIDATE_NUMBERS;

const INSTALLATION_HINTS = [
  "moffett field",
  "ames",
  "armstrong",
  "glenn",
  "goddard",
  "johnson",
  "kennedy",
  "langley",
  "marshall",
  "stennis",
  "nasa",
  "government installation",
  "on-site",
];

export function selectPacketClauses(
  facts: PacketFacts | null,
  clauseRows: ClauseRow[],
  thresholds: ThresholdRow[],
): PacketClause[] {
  if (!facts) return [];
  const value = num(facts, "estimated_value");
  const type = `${str(facts, "contract_type")} ${str(facts, "hybrid_contract_type")}`;
  const place = str(facts, "place_of_performance_standardized") || str(facts, "place_of_performance");
  const post = facts["post_award"] as { option_periods?: unknown[]; options?: unknown[] } | null | undefined;
  const optionList = (post?.option_periods ?? post?.options) as unknown[] | undefined;

  // The vehicle and the scenario answered at intake carry facts the contract
  // type alone does not: a parent IDIQ can be FFP-priced, and a commercial
  // clause set can be recorded on the vehicle rather than on the determination.
  const vehicle = (facts["vehicle"] ?? {}) as Record<string, unknown>;
  const scenario = (facts["scenario"] ?? {}) as Record<string, unknown>;
  const clauseSet = typeof vehicle["clause_set"] === "string" ? (vehicle["clause_set"] as string) : "";
  const scenarioVehicle = typeof scenario["vehicle"] === "string" ? (scenario["vehicle"] as string) : "";
  const parentNumber = str(facts, "parent_contract_number");
  const vehicleText = `${clauseSet} ${str(facts, "title")} ${str(facts, "vehicle_type")}`;

  const commercialText = `${str(facts, "commercial_determination")} ${str(facts, "contract_format")} ${str(facts, "acquisition_method")}`;

  let idiq = false;
  let idiqSource = "";
  if (/idiq|indefinite/i.test(type)) {
    idiq = true;
    idiqSource = `Contract type on the record: ${str(facts, "contract_type")}`;
  } else if (/^idiq_(award|order)$/.test(scenarioVehicle) || /order_under/i.test(scenarioVehicle)) {
    idiq = true;
    idiqSource =
      scenarioVehicle === "idiq_award"
        ? "The record answers this file as a parent indefinite-delivery vehicle"
        : "The record answers this file as an order under an indefinite-delivery vehicle";
  } else if (parentNumber.trim()) {
    idiq = true;
    idiqSource = `The record names a parent contract: ${parentNumber}`;
  } else if (/idiq|indefinite quantity|indefinite delivery/i.test(vehicleText)) {
    idiq = true;
    idiqSource = "The vehicle recorded on this file reads as indefinite delivery";
  }

  const ctx: Ctx = {
    f: facts,
    value,
    micro: thresholdValue(thresholds, "Micro-purchase threshold", 15000),
    sat: thresholdValue(thresholds, "Simplified acquisition threshold", 350000),
    subPlan: thresholdValue(thresholds, "Subcontracting plan", 900000),
    method: str(facts, "acquisition_method"),
    competition: str(facts, "competition"),
    setAside: str(facts, "set_aside"),
    type,
    place,
    commercial:
      /commercial/i.test(commercialText) ||
      /sf 1449/i.test(str(facts, "contract_format")) ||
      /commercial/i.test(clauseSet),
    hardware: bool(facts, "hardware_deliverable"),
    services: !bool(facts, "hardware_deliverable"),
    it: bool(facts, "includes_it"),
    costReimbursement: /\bcp(ff|if|af)\b|cost/i.test(type),
    idiq,
    idiqSource,
    soleSource: /sole source|limited source|brand name/i.test(`${str(facts, "competition")} ${str(facts, "acquisition_method")}`),
    options: Array.isArray(optionList) && optionList.length > 0,
    onInstallation: INSTALLATION_HINTS.some((h) => place.toLowerCase().includes(h)),
    clauseSet,
    money,
  };

  // Matrix rows: dedupe by number, drop anything the matrices show as removed.
  const matrix = new Map<string, ClauseRow>();
  for (const row of clauseRows) {
    const n = row.clause_number?.trim();
    if (!n) continue;
    if (/remov/i.test(`${row.status ?? ""} ${row.disposition ?? ""}`)) {
      matrix.set(n, { ...row, status: "removed" });
      continue;
    }
    if (!matrix.has(n)) matrix.set(n, row);
  }

  const out: PacketClause[] = [];
  for (const rule of RULES) {
    if (rule.number === "52.212-5") continue; // Reserved under the RFO; never included.
    const reason = rule.applies(ctx);
    if (!reason) continue;
    const row = matrix.get(rule.number);
    if (row && /remov/i.test(`${row.status ?? ""} ${row.disposition ?? ""}`)) continue;
    out.push({
      clause_number: rule.number,
      title: row?.title || rule.title,
      reason,
      ucf_section: row?.ucf_section ?? null,
      source: row?.source ?? (rule.number.startsWith("1852") ? "NFS" : "FAR"),
      status: row?.status ?? "not in the loaded matrices (verify in NCMS)",
      effective_date: row?.effective_date ?? null,
      fill_ins: row?.fill_ins ?? null,
      formerly_bundled: rule.formerlyBundled === true,
    });
  }
  return out.sort((a, b) => a.clause_number.localeCompare(b.clause_number, "en", { numeric: true }));
}

/** Clause numbers the matrices show as removed under the RFO. */
export function removedClauseNumbers(clauseRows: ClauseRow[]): string[] {
  const out = new Set<string>();
  for (const row of clauseRows) {
    const n = row.clause_number?.trim();
    if (!n) continue;
    if (/remov|delet/i.test(`${row.status ?? ""} ${row.disposition ?? ""}`)) out.add(n);
  }
  return [...out].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

/**
 * The only clause numbers that may be written onto a record: a clause the
 * record recommends, never a removed clause, never FAR 52.212-5 (Reserved
 * under the RFO), and never FAR 52.212-3 (offeror reps/certs are made in SAM,
 * not packed on the commercial SF 1449).
 */
export function sanitizeClauseSelection(
  selected: readonly string[],
  recommended: readonly PacketClause[],
  clauseRows: ClauseRow[],
): string[] {
  const allowed = new Set(recommended.map((c) => c.clause_number));
  const removed = new Set(removedClauseNumbers(clauseRows));
  const out = new Set<string>();
  for (const raw of selected) {
    const n = String(raw ?? "").trim();
    if (!n) continue;
    if (n === "52.212-5") continue; // Reserved under the RFO / PCD 26-03B.
    if (n === "52.212-3") continue; // Reps/certs are made in SAM, not packed here.
    if (removed.has(n)) continue;
    if (!allowed.has(n)) continue;
    out.add(n);
  }
  return [...out].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

/**
 * The single reason note surfaced to the contracting officer near the
 * RFO-removed line, explaining why neither FAR 52.212-3 nor FAR 52.212-5 is
 * recommended, offered, or apply-able on the commercial SF 1449 packet.
 * Surfaced once (progressive disclosure) from the clause picker / handoff
 * block; keep the wording calm and citation-backed.
 */
export const RFO_RESERVED_212_NOTE =
  "FAR 52.212-5 is Reserved under the RFO / PCD 26-03B, so commercial clause content is prescribed through FAR Tables 12-2 and 12-3 and each clause's own prescription rather than the old 52.212-5 checkbox paragraph. Offeror representations and certifications for commercial buys are made in SAM (with FAR 52.204-7 on the packet), not by packing FAR 52.212-3. Neither 52.212-3 nor 52.212-5 is recommended, offered, or apply-able here.";
