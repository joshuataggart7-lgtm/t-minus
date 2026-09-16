// NFS Companion gates.
//
// The gates a file has to clear before it exits are read from the seeded
// review_rules rows and the record itself, never from a fixed list here. Each
// gate says whether it applies, what makes it apply, the citation the row
// carries, and what this file already shows as evidence. A gate is a checklist
// and a message; it never puts a file on hold on its own.

import {
  isTerRequired,
  reviewApplies,
  type AcqRow,
  type BoardEntry,
  type ReviewRuleRow,
} from "@/lib/launch-sequence";
import type { RefData } from "@/lib/intake";

export type GateStatus = "Satisfied" | "Open" | "Not applicable";

export type CompanionGate = {
  key: string;
  name: string;
  applies: boolean;
  trigger: string;
  citation: string;
  status: GateStatus;
  /** What the file shows today. Never a claim that something was completed. */
  evidence: string;
};

export type GateEvidence = {
  savedKeys: Set<string> | string[];
  attachedKeys: Set<string> | string[];
  board: BoardEntry[];
};

const NOT_EVIDENCED = "Not yet evidenced on this file.";

function hasKey(evidence: GateEvidence, keys: string[]): boolean {
  const saved = new Set(Array.from(evidence.savedKeys));
  const attached = new Set(Array.from(evidence.attachedKeys));
  return keys.some((k) => saved.has(k) || attached.has(k));
}

function voteFor(board: BoardEntry[], match: RegExp): BoardEntry | null {
  return board.find((b) => match.test(b.reviewer_role)) ?? null;
}

function fromBoard(board: BoardEntry[], match: RegExp): { status: GateStatus; evidence: string } {
  const entry = voteFor(board, match);
  if (!entry) return { status: "Open", evidence: NOT_EVIDENCED };
  if (entry.vote === "go")
    return { status: "Satisfied", evidence: `Go recorded by ${entry.reviewer_name}.` };
  if (entry.vote === "no-go")
    return {
      status: "Open",
      evidence: `No-go recorded by ${entry.reviewer_name}${entry.reason ? `: ${entry.reason}` : ""}.`,
    };
  return { status: "Open", evidence: `On the poll for ${entry.reviewer_name}; no vote recorded yet.` };
}

/** Micro-purchase floor the NF 1787 gate reads, from the thresholds table. */
function threshold(ref: RefData, name: string, fallback: number): number {
  const row = ref.thresholds.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase());
  return typeof row?.value === "number" ? row.value : fallback;
}

export function evaluateCompanionGates(
  acq: AcqRow | null | undefined,
  rules: ReviewRuleRow[],
  ref: RefData,
  evidence: GateEvidence,
): CompanionGate[] {
  if (!acq) return [];
  const gates: CompanionGate[] = [];
  const value = Number(acq.estimated_value ?? 0);

  // Technical evaluation: sole source above the simplified acquisition threshold.
  const terApplies = isTerRequired(acq);
  const terSat = hasKey(evidence, ["technical-evaluation-report"]);
  gates.push({
    key: "ter",
    name: "Technical evaluation report",
    applies: terApplies,
    trigger: `Sole source above the simplified acquisition threshold (${`$${threshold(ref, "Simplified acquisition threshold", 350_000).toLocaleString("en-US")}`}).`,
    citation: "NFS CG 1815.3; FAR 13.106-3(a)",
    status: !terApplies ? "Not applicable" : terSat ? "Satisfied" : "Open",
    evidence: !terApplies
      ? "This file is not a sole-source proposal above the threshold."
      : terSat
        ? "A technical evaluation report is on the file."
        : NOT_EVIDENCED,
  });

  // NF 1787 small business coordination above the micro-purchase threshold.
  const micro = threshold(ref, "Micro-purchase threshold", 10_000);
  const sbApplies = value > micro;
  const sbSat = hasKey(evidence, ["nf-1787", "nf-1787a"]);
  const sbVote = fromBoard(evidence.board, /^small business/i);
  gates.push({
    key: "nf-1787",
    name: "NF 1787 small business coordination",
    applies: sbApplies,
    trigger: `Value above the micro-purchase threshold ($${micro.toLocaleString("en-US")}).`,
    citation: "NFS 1819.201(c); FAR 19.201",
    status: !sbApplies ? "Not applicable" : sbSat || sbVote.status === "Satisfied" ? "Satisfied" : "Open",
    evidence: !sbApplies
      ? "The value is at or below the micro-purchase threshold."
      : sbSat
        ? "An NF 1787 coordination form is on the file."
        : sbVote.evidence,
  });

  // Gates carried by the seeded review rules: CIO/IT, Section 508, aviation
  // safety, NPA, ANOSCA and any other row the Center has seeded.
  // Where a gate has a document of its own, a saved or attached copy is
  // evidence in the same way a recorded vote is.
  const rowGates: { key: string; match: RegExp; name: string; docKeys?: string[]; docEvidence?: string }[] = [
    { key: "cio", match: /^cio authorization/i, name: "CIO / IT authorization" },
    { key: "section-508", match: /^section 508/i, name: "Section 508 accessibility" },
    { key: "aviation", match: /^aviation safety/i, name: "Aviation safety review" },
    {
      key: "npa",
      match: /notification of procurement action/i,
      name: "Notification of procurement action",
      docKeys: ["npa-notification"],
      docEvidence: "A notification of procurement action is on the file.",
    },
    {
      key: "anosca",
      match: /^anosca/i,
      name: "ANOSCA announcement",
      docKeys: ["anosca"],
      docEvidence: "An ANOSCA announcement is on the file.",
    },
    {
      key: "psm",
      match: /^procurement strategy meeting/i,
      name: "Procurement strategy meeting",
      docKeys: ["psm-signature-page", "psm-addendum", "psm-executive-presentation", "written-acquisition-plan"],
      docEvidence: "A procurement strategy meeting record is on the file.",
    },
  ];
  for (const g of rowGates) {
    const rule = rules.find((r) => g.match.test(r.reviewer_role));
    const applies = rule ? reviewApplies(rule, acq, ref) : false;
    const board = applies ? fromBoard(evidence.board, g.match) : null;
    const docSat = applies && g.docKeys ? hasKey(evidence, g.docKeys) : false;
    gates.push({
      key: g.key,
      name: rule?.reviewer_role ?? g.name,
      applies,
      trigger: rule?.trigger ?? "No trigger recorded on the review rule.",
      citation: rule?.citation ?? "Center policy",
      status: !applies ? "Not applicable" : docSat ? "Satisfied" : (board?.status ?? "Open"),
      evidence: !applies
        ? rule
          ? "The record does not meet this trigger."
          : "No review rule seeded for this gate."
        : docSat
          ? (g.docEvidence ?? "A document for this gate is on the file.")
          : (board?.evidence ?? NOT_EVIDENCED),
    });
  }

  return gates;
}

export function gateSummary(gates: CompanionGate[]): string {
  const applicable = gates.filter((g) => g.applies);
  const open = applicable.filter((g) => g.status === "Open");
  if (applicable.length === 0) return "No Companion gates apply to this record.";
  return `${applicable.length} gates apply, ${open.length} open.`;
}
