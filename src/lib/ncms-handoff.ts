/**
 * NCMS handoff packet ordering.
 *
 * The packet an officer carries into NCMS is easier to key when it reads in
 * the same order as the SF 1449 screen. This module reorders the packet the
 * file page already builds and prints the fill-in values from the record.
 *
 * Nothing here writes to NCMS. NCMS remains the contract writing system of
 * record (NFS 1804.171); this is a local file the officer keys from.
 *
 * Signature blocks are deliberately carried as empty and flagged: the
 * contracting officer signs in NCMS, never here.
 */

import type { FormCtx, GeneratedForm } from "@/lib/nf1787";
import { buildSf1449, buildSf30 } from "@/lib/sf-forms";
import { acquisitionProfile } from "@/lib/vehicles";
import { RFO_RESERVED_212_NOTE } from "@/lib/clause-packet";
import { isSimplifiedCommercial } from "@/lib/memo-draft";

export type PacketEntry = {
  block: string;
  value: string;
  /** Present when the record cannot answer the block. */
  note?: string;
  /** True when the block is a signature the contracting officer completes. */
  signature?: boolean;
};

export type PacketSection = {
  section: string;
  citation: string;
  entries: PacketEntry[];
};

const SIGNATURE_HINT = /signature|signer|name and title|name of contracting officer/i;

const printed = (value: unknown): string => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

function toSections(form: GeneratedForm): PacketSection[] {
  return form.sections.map((s) => ({
    section: s.title,
    citation: s.citation ?? form.citation,
    entries: s.fields.map((f) => {
      const signature = SIGNATURE_HINT.test(f.label);
      const entry: PacketEntry = { block: f.label, value: signature ? "" : printed(f.value) };
      if (signature) {
        entry.signature = true;
        entry.note = "Left blank. The contracting officer signs in NCMS.";
      } else if (f.gap) {
        entry.note = f.gap;
      } else if (!entry.value) {
        entry.note = "No value on the record; the contracting officer completes this block.";
      }
      return entry;
    }),
  }));
}

/** Screen-ordered SF 1449 blocks, filled from the record. */
export function sf1449ScreenOrder(acq: Record<string, unknown>): PacketSection[] {
  return toSections(buildSf1449({ acq } as unknown as FormCtx));
}

/** Screen-ordered SF 30 blocks, for files that carry a modification. */
export function sf30ScreenOrder(acq: Record<string, unknown>): PacketSection[] {
  return toSections(buildSf30({ acq } as unknown as FormCtx));
}

/** True when the file carries a recorded modification or an IDIQ vehicle. */
export function hasModificationPath(acq: Record<string, unknown>): boolean {
  const mods = acq["modifications"];
  if (Array.isArray(mods) && mods.length) return true;
  const profile = acquisitionProfile(acq);
  return profile === "idiq_parent" || profile === "order_under_idiq";
}

/** Clause list, ordered by UCF section then clause number, fill-ins printed. */
export function orderedClauses<T extends { clause_number: string | null; ucf_section: string | null; fill_ins?: unknown }>(
  clauses: T[],
): (T & { fill_in_values: string })[] {
  return [...clauses]
    .sort((a, b) => {
      const s = (a.ucf_section ?? "").localeCompare(b.ucf_section ?? "");
      if (s !== 0) return s;
      return (a.clause_number ?? "").localeCompare(b.clause_number ?? "", undefined, { numeric: true });
    })
    .map((c) => ({
      ...c,
      fill_in_values:
        c.fill_ins && typeof c.fill_ins === "object"
          ? Object.entries(c.fill_ins as Record<string, unknown>)
              .map(([k, v]) => `${k}: ${printed(v) || "[contracting officer to complete]"}`)
              .join("; ")
          : typeof c.fill_ins === "string"
            ? c.fill_ins
            : "",
    }));
}

/** Reorder a built packet so it reads in SF 1449 screen order. */
export function orderPacketForScreen(
  packet: Record<string, unknown>,
  acq: Record<string, unknown>,
): Record<string, unknown> {
  const clauses = Array.isArray(packet["clauses"])
    ? orderedClauses(packet["clauses"] as { clause_number: string | null; ucf_section: string | null; fill_ins?: unknown }[])
    : packet["clauses"];

  const { clauses: _drop, ...rest } = packet;

  return {
    note: packet["note"],
    signature_note:
      "Signature blocks are carried empty on purpose. The contracting officer signs in NCMS; T-Minus does not write to NCMS.",
    order_note: "Blocks below are in SF 1449 screen order, with values from this record.",
    sf_1449_screen_order: sf1449ScreenOrder(acq),
    ...(hasModificationPath(acq) ? { sf_30_screen_order: sf30ScreenOrder(acq) } : {}),
    clauses,
    // Part 12 commercial packets say plainly why 52.212-3 and 52.212-5 are absent.
    ...(isSimplifiedCommercial(acq) ? { reserved_52_212_5_note: RFO_RESERVED_212_NOTE } : {}),
    ...rest,
  };
}
