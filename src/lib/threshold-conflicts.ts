/**
 * FAR vs statute threshold conflicts (advisory).
 *
 * Reads only the seeded `thresholds` table. A row is a conflict when its own
 * note already says CONFLICT, or when the note points back at that conflict
 * note. No dollar rule is invented here, and nothing holds a file.
 */
import { supabase } from "@/integrations/supabase/client";

export type ThresholdRow = {
  threshold_id: string;
  name: string;
  value: number | null;
  citation: string | null;
  tier: string | null;
  note: string | null;
};

export const NO_CONFLICTS_NOTE =
  "No FAR-vs-statute threshold conflicts are flagged in the loaded tables.";

export async function loadThresholdRows(): Promise<ThresholdRow[]> {
  const { data, error } = await supabase
    .from("thresholds")
    .select("threshold_id, name, value, citation, tier, note")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    threshold_id: String(r.threshold_id),
    name: String(r.name),
    value: r.value === null || r.value === undefined ? null : Number(r.value),
    citation: (r.citation as string | null) ?? null,
    tier: (r.tier as string | null) ?? null,
    note: (r.note as string | null) ?? null,
  }));
}

function saysConflict(note: string | null): boolean {
  return (note ?? "").toLowerCase().includes("conflict");
}

/**
 * Rows whose seeded note flags a conflict, plus the companion rows whose note
 * refers to that conflict note. Order is kept stable by name.
 */
export function conflictRows(rows: ThresholdRow[]): ThresholdRow[] {
  return rows.filter((r) => saysConflict(r.note));
}

export function formatThresholdValue(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "Not recorded";
  if (value < 1000) return String(value);
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
