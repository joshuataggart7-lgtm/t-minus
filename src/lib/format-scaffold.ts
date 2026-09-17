// Contract format scaffolding.
//
// The format comes from the record (acquisition_facts.contract_format), not
// from a preference. A commercial streamlined file carries the SF 1449 blocks;
// anything else is laid out in Uniform Contract Format sections. Clauses are
// the ones already selected for this file by the clause engine, each keeping
// the reason it is there. Nothing here is a signed form and nothing is written
// to NCMS; NCMS stays the system of record (NFS 1804.171) and this is the
// local handoff scaffold an officer carries over by hand.

import type { PacketClause } from "@/lib/clause-packet";
import { clauseFillinText } from "@/lib/clause-fillins";
import { isSoleSourceRecord } from "@/lib/memo-draft";
import { SECTION_J_EMPTY, type SectionJAttachment } from "@/lib/section-j";
import { CDRL_EMPTY, type PacketCdrlItem } from "@/lib/cdrl";
import {
  PAYMENT_MILESTONES_EMPTY,
  type PacketPaymentMilestone,
} from "@/lib/payment-milestones";

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

/**
 * Sections L and M as the officer saved them, with the method label the record
 * carries. When this is given it is the only source for the instructions and
 * the evaluation lines, so the panel, the scaffold and the packet agree.
 */
export type ScaffoldLmOverride = {
  methodLabel: string;
  partFamily: "12_13" | "15";
  authored: boolean;
  chip: string;
  instructions: ScaffoldLine[];
  evaluation: { mode: "competitive" | "sole-source"; lines: ScaffoldLine[] };
  sectionL: Record<string, string | null>;
  sectionM: Record<string, unknown>;
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
  lm: ScaffoldLmOverride | null;
  /** Section J: the attachments on the record, not a clause bucket. */
  attachments: SectionJAttachment[];
  /** Data requirements recorded on the file. Empty unless the office added some. */
  cdrl: PacketCdrlItem[];
  /** Payment milestones recorded on the file. Empty unless the office added some. */
  paymentMilestones: PacketPaymentMilestone[];
  /** Section K as recorded on the file. Null where the shell is unknown. */
  sectionK: ScaffoldSectionK | null;
};

/** Section K as the panel and the packet both print it. */
export type ScaffoldSectionK = {
  path: string;
  heading: string;
  path_note: string;
  sam_status: string;
  notes: string | null;
  checklist: { label: string; status: string; note: string | null }[];
  clauses: { clause_number: string; title: string }[];
  clauses_empty_note: string | null;
  empty_note: string | null;
  note: string;
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
  /** The schedule on the file. When given, it is the only source of line items. */
  scheduleClins?: ScaffoldClin[],
  /** Sections L and M from the file. When given they replace the default lines. */
  lm?: ScaffoldLmOverride | null,
  /** Section J: the attachments on the record. */
  attachments?: SectionJAttachment[],
  /** Data requirements recorded on the file. */
  cdrl?: PacketCdrlItem[],
  /** Payment milestones recorded on the file. */
  paymentMilestones?: PacketPaymentMilestone[],
  /** Section K as the officer recorded it, already shaped for the packet. */
  sectionK?: ScaffoldSectionK | null,
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

  // Line items come from the schedule on the file. No line item is invented
  // here: an empty schedule prints as empty until the officer adds lines.
  const clins: ScaffoldClin[] = scheduleClins ?? [];

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
            citation: "RFO FAR 12.204(a); FAR 13.106-3",
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
    // Record first: the officer sees the dates, names and limits this file
    // already carries, with honest blanks, not just whatever the matrices hold.
    fillIns: clauseFillinText(facts, c.clause_number, c.fill_ins) ?? fillInText(c.fill_ins),
  }));

  return {
    mode,
    formatLabel: format || (mode === "sf1449" ? "SF 1449 streamlined (from the commercial determination)" : "Uniform Contract Format"),
    formatSource: format
      ? "Contract format recorded on this file."
      : "No contract format recorded; the format is read from the commercial determination.",
    blocks,
    clins,
    // Sections L and M on the file win over the default lines, so the
    // workspace, the scaffold and the handoff packet always say the same thing.
    instructions: lm ? lm.instructions : instructions,
    evaluation: lm ? lm.evaluation : evaluation,
    ucfSections,
    clauses: scaffoldClauses,
    lm: lm ?? null,
    attachments: attachments ?? [],
    cdrl: cdrl ?? [],
    paymentMilestones: paymentMilestones ?? [],
    sectionK: sectionK ?? null,
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
    format_source: scaffold.formatSource,
    method_label: scaffold.lm?.methodLabel ?? "Acquisition method not recorded",
    part_family: scaffold.lm?.partFamily ?? null,
    blocks: scaffold.blocks,
    clins: scaffold.clins,
    // Section K carries exactly what the panel shows: the SAM or UCF path, the
    // checklist as recorded, and the K clauses the matrices placed there.
    section_k: scaffold.sectionK,
    section_l: scaffold.lm ? { fields: scaffold.lm.sectionL, lines: scaffold.instructions } : null,
    section_m: scaffold.lm
      ? {
          ...scaffold.lm.sectionM,
          mode: scaffold.evaluation.mode,
          lines: scaffold.evaluation.lines,
        }
      : null,
    lm_note: scaffold.lm?.chip ?? null,
    // Section J is the list of attachments on the record, for either format.
    section_j:
      scaffold.attachments.length === 0
        ? { attachments: [], empty_note: SECTION_J_EMPTY }
        : { attachments: scaffold.attachments },
    // Data requirements sit beside the attachments. Empty unless recorded.
    cdrl:
      scaffold.cdrl.length === 0
        ? { items: [], empty_note: CDRL_EMPTY }
        : { items: scaffold.cdrl },
    // Payment milestones as recorded. Empty unless the office added some.
    payment_milestones:
      scaffold.paymentMilestones.length === 0
        ? { label: PAYMENT_PLAN_LABEL, items: [], empty_note: PAYMENT_MILESTONES_EMPTY }
        : {
            label: PAYMENT_PLAN_LABEL,
            items: scaffold.paymentMilestones,
            plan_notes: paymentPlanNotes(scaffold.paymentMilestones),
          },
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
      fill_ins: c.fillIns ?? "No fill-in recorded on the file or in the matrices",
    })),
    note: "Local scaffolding for the handoff packet. NCMS is the system of record; T-Minus does not write to NCMS.",

  };
}
