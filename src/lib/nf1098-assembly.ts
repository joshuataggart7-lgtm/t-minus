/**
 * NF 1098 contract-file assembly checklist.
 *
 * A local, advisory view of how complete the contract file looks for handoff:
 * the NF 1098 tabs already on the record, the required tabs with nothing
 * filed, and the enclosures the record can account for (line items, Section K,
 * Section L/M, Section J attachments, data requirements, payment milestones,
 * clauses, signatures).
 *
 * Nothing here invents a document, and nothing here holds a phase exit.
 * NCMS stays the system of record.
 */

import type { FileIndex } from "@/lib/file-index";
import type { FormatScaffold } from "@/lib/format-scaffold";

export const NF1098_ASSEMBLY_CHIP =
  "Local assembly checklist for handoff. Tabs and order follow the NEAR File Structure " +
  "Checklist, Crosswalk WSC (v3.3, Apr 24) where a document is mapped. NCMS is the system " +
  "of record (NFS 1804.171). T-Minus does not write to NCMS. Does not hold phase exit.";

export type AssemblyStatus = "Present" | "Missing" | "Recorded" | "Not recorded" | "Not required";

export type AssemblyRow = {
  /** "Tab 3" or "Enclosure". */
  slot: string;
  item: string;
  status: AssemblyStatus;
  note: string;
};

export type Nf1098Assembly = {
  chip: string;
  tabs: AssemblyRow[];
  enclosures: AssemblyRow[];
  counts: { presentTabs: number; missingTabs: number; recorded: number; notRecorded: number };
};

export type Nf1098AssemblyInput = {
  fileIndex: FileIndex;
  scaffold: FormatScaffold | null;
  /** Clauses the engine recommends for this file. */
  recommendedClauseCount?: number;
  /** Clauses actually applied on the record, where any are recorded. */
  appliedClauseCount?: number | null;
};

const dateOnly = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : "");

export function buildNf1098Assembly(input: Nf1098AssemblyInput): Nf1098Assembly {
  const { fileIndex, scaffold } = input;

  const tabs: AssemblyRow[] = [];

  for (const t of fileIndex.present) {
    const latest = t.documents[t.documents.length - 1];
    const parts = [
      latest?.version ? `version ${latest.version}` : "",
      dateOnly(latest?.savedAt ?? null) ? `saved ${dateOnly(latest?.savedAt ?? null)}` : "",
      t.documents.length > 1 ? `${t.documents.length} versions` : "",
    ].filter(Boolean);
    tabs.push({
      slot: `Tab ${t.tab}`,
      item: t.templateName,
      status: "Present",
      note: parts.join(" · ") || "No version or date recorded",
    });
  }

  for (const t of fileIndex.missing) {
    tabs.push({
      slot: `Tab ${t.tab}`,
      item: t.templateName,
      status: "Missing",
      note: `Required for this file at ${t.phase}. Nothing filed under this tab yet.`,
    });
  }

  const enclosures: AssemblyRow[] = [];
  const push = (item: string, ok: boolean, okNote: string, blankNote: string) =>
    enclosures.push({
      slot: "Enclosure",
      item,
      status: ok ? "Recorded" : "Not recorded",
      note: ok ? okNote : blankNote,
    });

  if (!scaffold) {
    enclosures.push({
      slot: "Enclosure",
      item: "Solicitation and award scaffold",
      status: "Not recorded",
      note: "The format scaffold is not built for this file yet.",
    });
  } else {
    const clinCount = scaffold.clins.length;
    push(
      "Schedule of line items",
      clinCount > 0,
      `${clinCount} line ${clinCount === 1 ? "item" : "items"} on the record.`,
      "No line items recorded on the file.",
    );

    const k = scaffold.sectionK;
    const kAuthored = Boolean(k && (k.checklist.length > 0 || (k.notes ?? "").trim() !== ""));
    push(
      "Section K — representations and certifications",
      kAuthored,
      `${k?.sam_status ?? "Status not recorded"} · ${k?.checklist.length ?? 0} checklist ${
        (k?.checklist.length ?? 0) === 1 ? "row" : "rows"
      }.`,
      k?.empty_note ?? "No Section K status or checklist recorded.",
    );

    const lmAuthored = Boolean(scaffold.lm);
    push(
      "Section L and M",
      lmAuthored,
      "Instructions and evaluation factors are authored on the record.",
      "Section L and M are the method stub — nothing authored on the record.",
    );

    const jCount = scaffold.attachments.length;
    push(
      "Section J — attachments",
      jCount > 0,
      `${jCount} ${jCount === 1 ? "attachment" : "attachments"} on the record.`,
      "No attachments uploaded to the file.",
    );

    const cdrlCount = scaffold.cdrl.length;
    push(
      "Data requirements (CDRL/DRD)",
      cdrlCount > 0,
      `${cdrlCount} ${cdrlCount === 1 ? "item" : "items"} recorded. Optional.`,
      "Optional. No data requirements recorded on the file.",
    );

    const payCount = scaffold.paymentMilestones.length;
    push(
      "Payment milestones",
      payCount > 0,
      `${payCount} ${payCount === 1 ? "milestone" : "milestones"} recorded. Optional.`,
      "Optional. No payment milestones recorded on the file.",
    );
  }

  const recommended = input.recommendedClauseCount ?? scaffold?.clauses.length ?? 0;
  const applied = input.appliedClauseCount ?? null;
  enclosures.push({
    slot: "Enclosure",
    item: "Clauses on file",
    status: recommended > 0 ? "Recorded" : "Not recorded",
    note:
      recommended === 0
        ? "No clauses selected for this file yet."
        : applied === null
          ? `${recommended} recommended. Applied clauses are not recorded on this file.`
          : `Applied ${applied} of ${recommended} recommended.`,
  });

  enclosures.push({
    slot: "Enclosure",
    item: "Signatures",
    status: "Not required",
    note: "Blank on purpose — the contract is signed in NCMS.",
  });

  const counts = {
    presentTabs: fileIndex.present.length,
    missingTabs: fileIndex.missing.length,
    recorded: enclosures.filter((r) => r.status === "Recorded").length,
    notRecorded: enclosures.filter((r) => r.status === "Not recorded").length,
  };

  return { chip: NF1098_ASSEMBLY_CHIP, tabs, enclosures, counts };
}

/** Plain-text copy of the checklist, for the clipboard. */
export function assemblyToText(assembly: Nf1098Assembly, acquisitionId: string): string {
  const line = (r: AssemblyRow) => `${r.slot}\t${r.item}\t${r.status}\t${r.note}`;
  return [
    `Contract-file assembly checklist — ${acquisitionId}`,
    assembly.chip,
    "",
    "NF 1098 tabs",
    ...(assembly.tabs.length ? assembly.tabs.map(line) : ["No tabs recorded."]),
    "",
    "Enclosures",
    ...assembly.enclosures.map(line),
    "",
    "Prototype. Not an official NASA system.",
  ].join("\n");
}

/** CSV of the same rows, for the evidence pack. */
export function assemblyToCsv(assembly: Nf1098Assembly): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [...assembly.tabs, ...assembly.enclosures].map((r) => [r.slot, r.item, r.status, r.note].map(cell).join(","));
  return ["slot,item,status,note", ...rows].join("\r\n") + "\r\n";
}
