/**
 * Draft RFP alert (local reminder stub).
 *
 * A reminder that a draft RFP step may be worth planning on competed,
 * negotiated work. T-Minus does not publish to SAM.gov and never creates a
 * DRFP record. Where the method does not suggest a DRFP, the panel says so
 * rather than inventing one.
 */

export const DRFP_NO_SAM_PUBLISH =
  "T-Minus does not publish to SAM.gov. This is a local reminder, not a SAM posting and not a Sources Sought post.";

export const DRFP_CITATION = "FAR 15.201 · NFS 1815.201";

export type DraftRfpAlert = {
  applicable: boolean;
  headline: string;
  detail: string;
};

function text(v: unknown): string {
  return String(v ?? "").toLowerCase();
}

export function draftRfpAlert(acq: Record<string, unknown> | null | undefined): DraftRfpAlert {
  const method = text(acq?.["acquisition_method"]);
  const competition = text(acq?.["competition"]);
  const format = text(acq?.["contract_format"]);
  const blob = `${method} ${competition} ${format}`;

  const soleSource = /sole[- ]?source|non-?competitive|8\(a\) direct/.test(blob);
  const simplifiedCommercial = /simplified|commercial|1449|part 12|13\.5/.test(blob);
  const competedNegotiated = /negotiat|part 15|full and open|competitive/.test(blob) && !soleSource;

  if (soleSource || simplifiedCommercial || !competedNegotiated) {
    return {
      applicable: false,
      headline: "Not applicable on this method",
      detail:
        "The method recorded on this file is not competed negotiated work, so a draft RFP alert is not loaded here. T-Minus does not invent a draft RFP step.",
    };
  }

  return {
    applicable: true,
    headline: "A draft RFP step may be due",
    detail:
      "This file is recorded as competed negotiated work, where early exchanges and a draft RFP are commonly planned before the solicitation. Confirm with the acquisition strategy; nothing here schedules or posts anything.",
  };
}
