/**
 * Which SF 30 blocks print empty, and why.
 *
 * The SF 30 is written onto the official blank from the record. A block that
 * the record does not carry is left empty rather than filled with a placeholder
 * amount, an em dash or the words "Not recorded". This list names those blocks
 * in plain words so the reader knows the gap is honest, not a fault.
 */

import type { FormCtx } from "@/lib/nf1787";
import { isMultipleAward } from "@/lib/award-holders";

export interface Sf30Blank {
  block: string;
  reason: string;
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

export function sf30HonestBlanks(ctx: FormCtx): Sf30Blank[] {
  const a = ctx.acq;
  const mods = Array.isArray(a["modifications"]) ? (a["modifications"] as Record<string, unknown>[]) : [];
  const mod = mods.length ? mods[mods.length - 1]! : {};
  const out: Sf30Blank[] = [];

  if (!str(mod["effective_date"])) {
    out.push({ block: "Block 3, effective date", reason: "No effective date is recorded on this modification." });
  }
  if (!str(a["pr_number"]) && !str(mod["requisition_number"])) {
    out.push({ block: "Block 4, requisition number", reason: "No purchase request number is on the file." });
  }
  if (isMultipleAward(a)) {
    out.push({
      block: "Block 8, contractor",
      reason:
        "This is a multiple-award vehicle. No single contractor of record is recorded for this modification, so no holder is named.",
    });
  } else if (!str(a["awardee_name"]) && !str(a["intended_awardee_name"])) {
    out.push({ block: "Block 8, contractor", reason: "No contractor is recorded on the file." });
  }
  if (!str(a["award_date"])) {
    out.push({ block: "Block 10B, dated", reason: "No award date is recorded on the contract." });
  }
  if (!str(a["funding_source"]) && !str(mod["funds_line"])) {
    out.push({
      block: "Block 12, accounting and appropriation data",
      reason: "No funding line is recorded. An accounting string is never invented.",
    });
  }
  if (!str(mod["authority_text"])) {
    out.push({
      block: "Block 13, authority",
      reason: "No authority text is recorded on the modification. A FAR or NFS citation is never invented.",
    });
  }
  out.push({
    block: "Blocks 15 and 16, signatures and dates",
    reason: "Signature and date blocks stay empty for a person to sign. Only the name of the officer of record prints.",
  });
  return out;
}
