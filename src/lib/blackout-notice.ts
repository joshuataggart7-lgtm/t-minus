/**
 * Blackout notice (local draft aid).
 *
 * T-Minus has no blackout table and issues nothing. This helper only shapes a
 * reminder note from facts already on the record so a CO can copy it into
 * whatever tool actually issues the notice. It never emails, never posts, and
 * never holds the file.
 */

export const BLACKOUT_CITATION = "NFS 1815.201(f)";

export const BLACKOUT_NOT_RECORDED =
  "No blackout notice is recorded on this file. T-Minus does not record blackout issuance; this panel is a local draft aid, not an issued notice and not an email send.";

export type BlackoutFacts = {
  acquisitionId: string;
  title: string;
  coName: string;
};

export function blackoutFacts(acq: Record<string, unknown> | null | undefined): BlackoutFacts {
  return {
    acquisitionId: String(acq?.["acquisition_id"] ?? "") || "Not recorded",
    title: String(acq?.["title"] ?? "") || "Not recorded",
    coName: String(acq?.["co_name"] ?? "") || "Not recorded",
  };
}

/** The draft reminder text. Facts only; anything absent reads "Not recorded". */
export function blackoutDraft(acq: Record<string, unknown> | null | undefined): string {
  const f = blackoutFacts(acq);
  return [
    `Blackout notice — draft reminder`,
    ``,
    `Acquisition: ${f.acquisitionId}`,
    `Title: ${f.title}`,
    `Contracting officer: ${f.coName}`,
    ``,
    `During the blackout period, all communication with offerors on this acquisition runs through the contracting officer. Program and technical staff should refer any contact from an offeror to the contracting officer without responding.`,
    ``,
    `Practice citation: ${BLACKOUT_CITATION}.`,
    ``,
    `Draft reminder produced in T-Minus from the record. Not an issued notice; T-Minus does not send email and does not post externally.`,
  ].join("\n");
}
