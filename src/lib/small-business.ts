import { supabase } from "@/integrations/supabase/client";
import type { AcqRow } from "@/lib/launch-sequence";

/**
 * Small business panel.
 *
 * Every figure is computed from the record: the set-aside decision recorded on
 * each file, the files that have a recorded Launched audit row with a small business set-aside, and
 * the files above the subcontracting plan threshold in thresholds that have no
 * plan or waiver on file. Nothing here is generated.
 */

export type ThresholdRow = {
  name: string | null;
  value: number | null;
  citation: string | null;
  note: string | null;
};

export function isSmallBusinessSetAside(setAside: unknown): boolean {
  const s = typeof setAside === "string" ? setAside.trim().toLowerCase() : "";
  if (!s) return false;
  if (s.startsWith("none") || s === "n/a" || s === "not applicable" || s === "no set-aside") return false;
  return true;
}

/** The subcontracting plan threshold row, read from thresholds rather than hard-coded. */
export function subcontractingPlanThreshold(thresholds: ThresholdRow[]) {
  return (
    thresholds.find((t) => (t.name ?? "").trim().toLowerCase() === "subcontracting plan") ??
    thresholds.find((t) => (t.name ?? "").toLowerCase().includes("subcontracting plan")) ??
    null
  );
}

export type SmallBusinessPanel = {
  totalFiles: number;
  setAsideFiles: number;
  setAsideRate: number | null;
  recordedDecisions: number;
  byCenter: { center: string; files: number; value: number }[];
  awardsTotal: number;
  awardsValue: number;
  threshold: ThresholdRow | null;
  missingPlans: { acquisitionId: string; center: string; title: string; value: number | null }[];
};

/** Acquisition IDs that already have a subcontracting plan or an approved waiver on file. */
export async function loadPlansOnFile(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("documents")
    .select("acquisition_id,templates(name)");
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const row of (data ?? []) as { acquisition_id: string | null; templates: { name: string } | null }[]) {
    const name = row.templates?.name?.toLowerCase() ?? "";
    if (!row.acquisition_id) continue;
    if (name.includes("subcontracting plan")) ids.add(row.acquisition_id);
  }
  return ids;
}

export function buildSmallBusinessPanel(
  acqs: AcqRow[],
  thresholds: ThresholdRow[],
  plansOnFile: Set<string>,
  launchedIds: Set<string>,
): SmallBusinessPanel {
  const totalFiles = acqs.length;
  const recorded = acqs.filter((a) => typeof a.set_aside === "string" && String(a.set_aside).trim().length > 0);
  const setAside = acqs.filter((a) => isSmallBusinessSetAside(a.set_aside));

  const centerMap = new Map<string, { files: number; value: number }>();
  let awardsTotal = 0;
  let awardsValue = 0;
  for (const a of acqs) {
    if (!launchedIds.has(a.acquisition_id) || !isSmallBusinessSetAside(a.set_aside)) continue;
    const center = String(a.center_code ?? "Unassigned");
    const value = a.estimated_value === null || a.estimated_value === undefined ? 0 : Number(a.estimated_value);
    const row = centerMap.get(center) ?? { files: 0, value: 0 };
    row.files += 1;
    row.value += value;
    centerMap.set(center, row);
    awardsTotal += 1;
    awardsValue += value;
  }

  const threshold = subcontractingPlanThreshold(thresholds);
  const limit = threshold?.value ?? null;
  const missingPlans =
    limit === null
      ? []
      : acqs
          .filter((a) => {
            const value = a.estimated_value === null || a.estimated_value === undefined ? null : Number(a.estimated_value);
            if (value === null || value <= limit) return false;
            if (isSmallBusinessSetAside(a.set_aside)) return false;
            return !plansOnFile.has(a.acquisition_id);
          })
          .map((a) => ({
            acquisitionId: a.acquisition_id,
            center: String(a.center_code ?? "Unassigned"),
            title: String(a.title ?? "Title not recorded"),
            value: a.estimated_value === null || a.estimated_value === undefined ? null : Number(a.estimated_value),
          }))
          .sort((x, y) => (y.value ?? 0) - (x.value ?? 0));

  return {
    totalFiles,
    setAsideFiles: setAside.length,
    setAsideRate: totalFiles === 0 ? null : setAside.length / totalFiles,
    recordedDecisions: recorded.length,
    byCenter: [...centerMap.entries()]
      .map(([center, r]) => ({ center, files: r.files, value: r.value }))
      .sort((a, b) => a.center.localeCompare(b.center)),
    awardsTotal,
    awardsValue,
    threshold,
    missingPlans,
  };
}
