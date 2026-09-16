// Contract format scaffolding.
//
// The format comes from the record (acquisition_facts.contract_format), not
// from a preference. A commercial streamlined file carries the SF 1449 blocks;
// anything else is laid out in Uniform Contract Format sections. Clauses are
// the ones already selected for this file by the clause engine, each keeping
// the reason it is there. Nothing here is a signed form and nothing is written
// to NCMS; NCMS stays the system of record (NFS CG 1804.11) and this is the
// local handoff scaffold an officer carries over by hand.

import type { PacketClause } from "@/lib/clause-packet";
import { isSoleSourceRecord } from "@/lib/memo-draft";

export type ScaffoldFacts = Record<string, unknown>;

export type ScaffoldBlock = { label: string; value: string };
export type ScaffoldClin = {
  clin: string;
  description: string;
  quantity: string;
  unit: string;
  amount: string;
  note: string;
};
export type ScaffoldLine = { text: string; citation: string | null };
export type UcfSection = { section: string; title: string; clauses: PacketClause[] };
/** One clause as the scaffold prints it: the reason and fill-in stay attached. */
export type ScaffoldClause = {
  clause_number: string;
  title: string;
  section: string;
  reason: string;
  fillIns: string | null;
};

export type FormatScaffold = {
  /** "sf1449" when the record carries the commercial streamlined format. */
  mode: "sf1449" | "ucf";
  formatLabel: string;
  formatSource: string;
  blocks: ScaffoldBlock[];
  clins: ScaffoldClin[];
  instructions: ScaffoldLine[];
  evaluation: { mode: "competitive" | "sole-source"; lines: ScaffoldLine[] };
  ucfSections: UcfSection[];
  /** Every clause the engine selected, with the reason it is on this file. */
  clauses: ScaffoldClause[];
};


const UCF_SECTIONS: { section: string; title: string }[] = [
  { section: "A", title: "Solicitation/contract form" },
  { section: "B", title: "Supplies or services and prices" },
  { section: "C", title: "Description/specifications/statement of work" },
  { section: "D", title: "Packaging and marking" },
  { section: "E", title: "Inspection and acceptance" },
  { section: "F", title: "Deliveries or performance" },
  { section: "G", title: "Contract administration data" },
  { section: "H", title: "Special contract requirements" },
  { section: "I", title: "Contract clauses" },
  { section: "J", title: "List of attachments" },
  { section: "K", title: "Representations and certifications" },
  { section: "L", title: "Instructions, conditions, and notices to offerors" },
  { section: "M", title: "Evaluation factors for award" },
];

const s = (f: ScaffoldFacts, key: string): string => {
  const v = f[key];
  return typeof v === "string" ? v.trim() : "";
};
const n = (f: ScaffoldFacts, key: string): number => {
  const v = f[key];
  const x = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};
const dollars = (v: number) => (v > 0 ? `$${v.toLocaleString("en-US")}` : "Not recorded");

/** True where the record's format is the commercial streamlined SF 1449 path. */
export function isStreamlined(facts: ScaffoldFacts): boolean {
  const format = s(facts, "contract_format").toLowerCase();
  if (format) return /1449|streamlin|commercial/.test(format);
  // No format recorded: a commercial determination still points at FAR 12.
  return /commercial/i.test(s(facts, "commercial_determination"));
}

export function buildFormatScaffold(
  facts: ScaffoldFacts | null | undefined,
  clauses: PacketClause[],
): FormatScaffold | null {
  if (!facts) return null;
  const format = s(facts, "contract_format");
  const mode: "sf1449" | "ucf" = isStreamlined(facts) ? "sf1449" : "ucf";
  // Sole source is read the same way every other page on the file reads it.
  const soleSource = isSoleSourceRecord(facts);

  const value = n(facts, "estimated_value");
  const pop = [s(facts, "period_of_performance_start"), s(facts, "period_of_performance_end")]
    .filter(Boolean)
    .join(" to ");

  const blocks: ScaffoldBlock[] = [
    { label: "Requisition/acquisition number", value: s(facts, "acquisition_id") || "Not recorded" },
    { label: "Title", value: s(facts, "title") || "Not recorded" },
    { label: "Contract number", value: s(facts, "contract_number") || "Assigned in NCMS at award" },
    { label: "Issued by", value: [s(facts, "center_name") || s(facts, "center_code"), s(facts, "branch_code")].filter(Boolean).join(", ") || "Not recorded" },
    { label: "Contracting officer", value: s(facts, "co_name") || "Not recorded" },
    { label: "NAICS code", value: s(facts, "naics_code") || "Not recorded" },
    { label: "Product/service code", value: s(facts, "psc_code") || "Not recorded" },
    { label: "Estimated value", value: dollars(value) },
    { label: "Period of performance", value: pop || "Not recorded" },
    { label: "Place of performance", value: s(facts, "place_of_performance_standardized") || s(facts, "place_of_performance") || "Not recorded" },
    { label: "Competition", value: s(facts, "competition") || "Not recorded" },
    { label: "Set-aside", value: s(facts, "set_aside") || "None recorded" },
    { label: "Contract type", value: s(facts, "contract_type") || "Not recorded" },
    {
      label: "Delivery/acceptance",
      value:
        facts["sow_attached"] === true
          ? "Carried from the statement of work on this file"
          : "Not recorded; set from the statement of work when it is on the file",
    },
  ];

  // One primary line item drawn from the record. A catalogue of line items is
  // not invented here; quantity, unit and price are the officer's to set.
  const clins: ScaffoldClin[] = [
    {
      clin: "0001",
      description: s(facts, "title") || s(facts, "description_of_requirement") || "Requirement on this file",
      quantity: "Not recorded",
      unit: "Not recorded",
      amount: dollars(value),
      note: "Description and estimated value from the record; quantity, unit and price are set by the officer.",
    },
  ];

  const igceNote = facts["igce_attached"] === true;
  if (igceNote) {
    clins.push({
      clin: "0002",
      description: "Additional line items from the independent government cost estimate",
      quantity: "—",
      unit: "—",
      amount: "See the estimate on this file",
      note: "Placeholder line; the estimate on this file carries the breakdown.",
    });
  }

  const has = (num: string) => clauses.some((c) => c.clause_number === num);
  const reasonFor = (num: string) => clauses.find((c) => c.clause_number === num)?.reason ?? null;

  const instructions: ScaffoldLine[] = [];
  if (has("52.212-1")) {
    instructions.push({
      text: `Quotations are submitted under FAR 52.212-1. ${reasonFor("52.212-1") ?? ""}`.trim(),
      citation: "FAR 12.301(b)(1)",
    });
  }
  instructions.push({
    text: `What is being bought: ${s(facts, "description_of_requirement") || s(facts, "title") || "recorded on this file"}.`,
    citation: null,
  });
  instructions.push({
    text: `Quotations are addressed to ${s(facts, "co_name") || "the contracting officer"} at ${s(facts, "center_name") || s(facts, "center_code") || "the issuing office"}; the response date is set when the notice is posted.`,
    citation: null,
  });
  if (s(facts, "set_aside")) {
    instructions.push({
      text: `The set-aside on this record is ${s(facts, "set_aside")}; offerors represent their size against NAICS ${s(facts, "naics_code") || "on this file"}.`,
      citation: "FAR 19.301-1",
    });
  }

  const evaluation: FormatScaffold["evaluation"] = soleSource
    ? {
        mode: "sole-source",
        lines: [
          {
            text: "This is a sole-source file. Competitive evaluation factors are not the path; the technical evaluation of the single proposal carries the finding.",
            citation: "FAR 13.106-3(a); NFS CG 1815.3",
          },
          {
            text: "Price reasonableness is determined in the price negotiation memorandum.",
            citation: "FAR 12.204(b)(1)",
          },
          {
            text: "The justification on this file states why only one source can meet the need.",
            citation: "FAR 6.303; FAR 13.501",
          },
        ],
      }
    : {
        mode: "competitive",
        lines: [
          has("52.212-2")
            ? { text: `Evaluation factors are stated to offerors under FAR 52.212-2. ${reasonFor("52.212-2") ?? ""}`.trim(), citation: "FAR 12.301(c)" }
            : { text: "Evaluation factors are stated to offerors in the solicitation.", citation: "FAR 13.106-1(a)(2)" },
          {
            text: "Quotations are evaluated against the factors stated, and the evaluation of quotations on this file records the result.",
            citation: "FAR 13.106-2(b)",
          },
          {
            text: "Award is made to the quotation that represents the best value to the Government on the stated factors.",
            citation: "FAR 13.106-2(b)(3)",
          },
        ],
      };

  const ucfSections: UcfSection[] = UCF_SECTIONS.map((sec) => ({
    ...sec,
    clauses: clauses.filter((c) => (c.ucf_section ?? "").trim().toUpperCase() === sec.section),
  }));
  const placed = new Set(ucfSections.flatMap((sec) => sec.clauses.map((c) => c.clause_number)));
  const unplaced = clauses.filter((c) => !placed.has(c.clause_number));
  if (unplaced.length > 0) {
    ucfSections.push({ section: "—", title: "Section not recorded in the matrices", clauses: unplaced });
  }

  // Every clause keeps the reason the engine gave it and the fill-in the
  // matrices carry. Where the matrices carry no fill-in, the scaffold says so
  // rather than offering a value.
  const scaffoldClauses: ScaffoldClause[] = clauses.map((c) => ({
    clause_number: c.clause_number,
    title: c.title,
    section: (c.ucf_section ?? "").trim() || "Not recorded in the matrices",
    reason: c.reason,
    fillIns: fillInText(c.fill_ins),
  }));

  return {
    mode,
    formatLabel: format || (mode === "sf1449" ? "SF 1449 streamlined (from the commercial determination)" : "Uniform Contract Format"),
    formatSource: format
      ? "Contract format recorded on this file."
      : "No contract format recorded; the format is read from the commercial determination.",
    blocks,
    clins,
    instructions,
    evaluation,
    ucfSections,
    clauses: scaffoldClauses,
  };
}

/** The fill-in text the matrices carry for a clause, or null where there is none. */
export function fillInText(fills: unknown): string | null {
  if (!Array.isArray(fills)) return null;
  const parts = fills.map((v) => String(v ?? "").trim()).filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : null;
}


/** The scaffold as it rides in the local handoff packet. */
export function scaffoldForPacket(scaffold: FormatScaffold | null) {
  if (!scaffold) return null;
  return {
    mode: scaffold.mode,
    format: scaffold.formatLabel,
    blocks: scaffold.blocks,
    clins: scaffold.clins,
    instructions_to_offerors: scaffold.instructions,
    evaluation: scaffold.evaluation,
    ucf_sections:
      scaffold.mode === "ucf"
        ? scaffold.ucfSections.map((sec) => ({
            section: sec.section,
            title: sec.title,
            clauses: sec.clauses.map((c) => c.clause_number),
          }))
        : null,
    // The same clause list, reasons and fill-ins the panel shows.
    clauses: scaffold.clauses.map((c) => ({
      clause_number: c.clause_number,
      title: c.title,
      section: c.section,
      reason: c.reason,
      fill_ins: c.fillIns ?? "No fill-in recorded in the matrices",
    })),
    note: "Local scaffolding for the handoff packet. NCMS is the system of record; T-Minus does not write to NCMS.",

  };
}
