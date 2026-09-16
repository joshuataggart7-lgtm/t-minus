/**
 * Regulatory baseline & deviation adoption (advisory).
 *
 * Everything here is read from the record: the baseline date already on the
 * file, and the deviation requests already linked to it. T-Minus does not
 * record which RFO Parts NASA has adopted, so this panel never claims an
 * adoption status — it says so and points at the official source.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DeviationRow } from "@/lib/deviations";

export const RFO_SOURCE_URL = "https://www.acquisition.gov/far-overhaul";

/** Honest default: adoption of RFO Parts is not recorded anywhere in the app. */
export const RFO_ADOPTION_NOT_RECORDED =
  "Which RFO Parts NASA has adopted is not recorded on this file. Confirm at the official RFO source before relying on adoption.";

/**
 * PCD 26-03B is the locked source for the clause matrix and the Reserved
 * FAR 52.212-3 / 52.212-5 handling already used in T-Minus. This is not a
 * claim that every Interim NFS part is adopted.
 */
/** There is no per-file RFO Part adoption overlay in T-Minus. Say so plainly. */
export const RFO_PART_OVERLAY_NOT_LOADED =
  "RFO Part overlay: not loaded. T-Minus carries no per-file record of which RFO Parts apply, so none is shown here.";

export const PCD_2603B_NOTE =
  "Interim NFS PCD 26-03B is the clause-matrix and Reserved-clause source T-Minus already reads, at the matrix date Jul 23 2026. That is the source of the clause list only; it is not a record that every Interim NFS part applies to this file.";

export type DeviationSummary = {
  deviation_id: string;
  title: string;
  deviation_type: string;
  citation: string;
  status: string;
  decision: string | null;
};

export function summarizeDeviation(row: DeviationRow): DeviationSummary {
  return {
    deviation_id: row.deviation_id,
    title: row.title,
    deviation_type: row.deviation_type === "class" ? "Class" : "Individual",
    citation: row.citation,
    status: row.status,
    decision: row.decision ?? null,
  };
}

/** Deviation requests linked to one acquisition, as recorded. Read only. */
export async function loadDeviationsForAcquisition(acquisitionId: string): Promise<DeviationSummary[]> {
  const { data, error } = await supabase
    .from("deviation_requests")
    .select("deviation_id, title, deviation_type, citation, status, decision")
    .eq("acquisition_id", acquisitionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DeviationSummary[];
}

/** One line for a deviation row: type, citation, and where it stands. */
export function deviationStatusLine(d: DeviationSummary): string {
  const decision = d.decision ? `, decision: ${d.decision}` : "";
  return `${d.deviation_type} deviation — ${d.citation} — status ${d.status}${decision}`;
}
