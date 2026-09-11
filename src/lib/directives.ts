import { supabase } from "@/integrations/supabase/client";

/**
 * Directive compliance for hardware buys.
 *
 * OP memo, March 17, 2026: hardware deliverables carry a Right to Repair
 * requirements statement, and the restrictive clauses in the requirement are
 * reviewed before award. Both facts are recorded on acquisition_facts; nothing
 * here is generated.
 */

export const DIRECTIVE_CITATION =
  "OP memo, March 17, 2026 (Right to Repair); Administrator's Workforce Directive, February 9, 2026; NFS 1827 revision";

export const REVIEW_STATUSES = ["not reviewed", "reviewed", "modified"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export function reviewStatus(value: unknown): ReviewStatus {
  const v = String(value ?? "").toLowerCase();
  return (REVIEW_STATUSES as readonly string[]).includes(v) ? (v as ReviewStatus) : "not reviewed";
}

export type DirectiveRow = {
  acquisition_id: string;
  title: string | null;
  center_code: string | null;
  mission_id: string | null;
  current_phase: string | null;
  clock_state: string | null;
  estimated_value: number | null;
  right_to_repair_statement: boolean | null;
  restrictive_clause_review: string | null;
};

export type DirectiveView = DirectiveRow & {
  statement: "attached" | "not attached";
  review: ReviewStatus;
  compliant: boolean;
};

export function viewOf(row: DirectiveRow): DirectiveView {
  const review = reviewStatus(row.restrictive_clause_review);
  const statement = row.right_to_repair_statement ? "attached" : "not attached";
  return {
    ...row,
    statement,
    review,
    compliant: statement === "attached" && review !== "not reviewed",
  };
}

export async function loadHardwareFiles(): Promise<DirectiveView[]> {
  const { data, error } = await supabase
    .from("acquisition_facts")
    .select(
      "acquisition_id,title,center_code,mission_id,current_phase,clock_state,estimated_value,right_to_repair_statement,restrictive_clause_review",
    )
    .eq("hardware_deliverable", true)
    .order("acquisition_id");
  if (error) throw error;
  return ((data ?? []) as unknown as DirectiveRow[]).map(viewOf);
}

function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: DirectiveView[], exportedAt: string): string {
  const header = [
    "acquisition_id",
    "title",
    "center_code",
    "mission_id",
    "current_phase",
    "clock_state",
    "estimated_value",
    "right_to_repair_statement",
    "restrictive_clause_review",
    "directive",
    "exported_at",
  ];
  const lines = rows.map((r) =>
    [
      r.acquisition_id,
      r.title,
      r.center_code,
      r.mission_id,
      r.current_phase,
      r.clock_state,
      r.estimated_value,
      r.statement,
      r.review,
      "OP memo, March 17, 2026",
      exportedAt,
    ]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
