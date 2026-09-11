/**
 * Reporting views for ORBIT's Power BI. Every figure is read from a read-only
 * database view; nothing is computed twice and nothing is editable here.
 */

export const REPORT_VIEWS = [
  { view: "v_report_missions", label: "Missions", note: "One row per mission with its acquisition counts." },
  {
    view: "v_report_acquisitions",
    label: "Acquisitions with metrics",
    note: "Days to award, days to need, planned days, schedule impact, and status word.",
  },
  { view: "v_report_holds", label: "Holds", note: "Open holds with reason, owner, age, and aging flag." },
  { view: "v_report_polls", label: "Polls", note: "Go/No-go votes, due dates, and open age." },
  { view: "v_report_audit_counts", label: "Audit counts", note: "Entries and actors per acquisition." },
] as const;

export type ReportViewName = (typeof REPORT_VIEWS)[number]["view"];

/** CSV with a header row, quoted values, and the extract timestamp last. */
export function rowsToCsv(rows: Record<string, unknown>[], extractedAt: string): string {
  if (rows.length === 0) return `no rows,extracted_at\n,"${extractedAt}"\n`;
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = [...cols, "extracted_at"].join(",");
  const body = rows.map((r) => [...cols.map((c) => cell(r[c])), cell(extractedAt)].join(","));
  return [head, ...body].join("\n") + "\n";
}
