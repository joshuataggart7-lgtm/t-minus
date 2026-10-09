import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, LoadingNote, ErrorNote } from "@/components/app-shell";
import { DataTable, EmptyCell, McPageHeader } from "@/components/ui-mc";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { REPORT_VIEWS, rowsToCsv, type ReportViewName } from "@/lib/reporting";
import { useOperationalDisplay } from "@/components/mission-control/use-operational-display";
import { acquisitionTypeLabel } from "@/lib/phase-plan-key";
import { formatDate } from "@/lib/metrics";

export const Route = createFileRoute("/reporting")({
  head: () => ({
    meta: [
      { title: "Reporting views · T-Minus" },
      {
        name: "description",
        content: "Read-only reporting views of missions, acquisitions, holds, polls, and audit counts for ORBIT.",
      },
      { property: "og:title", content: "Reporting views · T-Minus" },
      {
        property: "og:description",
        content: "Missions, acquisitions with computed metrics, holds, polls, and audit counts, with a CSV extract.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportingPage,
});

const REPORT_ORDER: Record<ReportViewName, string[]> = {
  v_report_acquisitions: ["acquisition_id"],
  v_report_holds: ["acquisition_id"],
  v_report_audit_counts: ["acquisition_id"],
  v_report_polls: ["acquisition_id", "poll_id"],
  v_report_missions: ["mission_id"],
};

function ReportingPage() {
  const { authState } = useRole();
  const [open, setOpen] = useState<ReportViewName>("v_report_acquisitions");
  // Loaded for every view: the Views table explains how its recorded-holds row
  // relates to the Executive Overview HOLD count.
  const operational = useOperationalDisplay(authState === "signed-in");
  const overviewHoldCount = [...operational.byId.values()].filter((row) => row.readiness === "HOLD").length;

  const counts = useQuery({
    queryKey: ["report-view-counts"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const out: Record<string, number> = {};
      for (const v of REPORT_VIEWS) {
        const { count } = await supabase.from(v.view as never).select("*", { count: "exact", head: true });
        out[v.view] = count ?? 0;
      }
      return out;
    },
  });

  const preview = useQuery({
    queryKey: ["report-view", open],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const cols = REPORT_ORDER[open];
      let query = supabase.from(open as never).select("*");
      for (const c of cols) query = query.order(c as never, { ascending: true });
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Record<string, unknown>[];
    },
  });

  function download() {
    const rows = preview.data ?? [];
    const at = new Date().toISOString();
    const url = URL.createObjectURL(new Blob([rowsToCsv(rows, at)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${open}-${at.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cols = preview.data?.[0] ? Object.keys(preview.data[0]) : [];
  /** Display only: "branch_name" reads "Branch name". The CSV keeps the raw column keys. */
function headerLabel(key: string): string {
  const plain: Record<string, string> = {
    center_code: "Center",
    branch_code: "Branch",
    mission_id: "Mission",
    acquisition_id: "Acquisition",
    poll_id: "Review",
    current_phase: "Phase",
    clock_state: "Clock",
    status: "File status",
    status_word: "Status word",
    hold_reason: "Hold reason",
    hold_owner: "Hold owner",
    on_hold: "On hold",
    target_award_date: "Target award",
    forecast_award_date: "Forecast award",
  };
  if (plain[key]) return plain[key];
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}



const MONEY_COLUMNS = new Set(["estimated_value"]);

function clockLabel(value: string): string {
  const known: Record<string, string> = {
    launched: "Launched",
    forecast: "Forecast",
    hold: "On hold",
    running: "Running",
    "not started": "Not started",
    stopped: "Stopped",
    scrubbed: "Scrubbed",
    overdue: "Overdue",
  };
  return known[value.trim().toLowerCase()] ?? value;
}

function reportStamp(value: string): string {
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return value;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(when);
  return `${formatted} CT`;
}

function moneyLabel(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Display only. The CSV download still writes the stored values. */
function plainCell(column: string, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "boolean" || raw === "true" || raw === "false") return raw === true || raw === "true" ? "Yes" : "No";
  if (MONEY_COLUMNS.has(column)) {
    const amount = typeof raw === "number" ? raw : typeof raw === "string" && /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
    if (amount !== null && !Number.isNaN(amount)) return moneyLabel(amount);
  }
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T/.test(raw)) return reportStamp(raw);
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatDate(raw);
  if (column === "clock_state") return clockLabel(String(raw));
  return String(raw);
}

function competitionLabel(value: string): string {
  const key = value.trim().toLowerCase();
  const known: Record<string, string> = {
    competitive: "Competitive",
    "sole source": "Sole source",
    "sole-source": "Sole source",
    "full and open": "Full and open",
    "full and open competition": "Full and open competition",
    "full and open after exclusion of sources": "Full and open after exclusion of sources",
  };
  if (known[key]) return known[key];
  if (value === key && value) return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

function displayCell(row: Record<string, unknown>, column: string) {
    if (column === "acquisition_type") {
      const raw = row[column];
      if (raw === null || raw === undefined || raw === "") return null;
      return acquisitionTypeLabel(String(raw));
    }
    if (column === "competition") {
      const raw = row[column];
      if (raw === null || raw === undefined || raw === "") return null;
      return competitionLabel(String(raw));
    }
    const operationalColumn = ["current_phase", "clock_state", "on_hold", "hold_reason", "hold_owner"].includes(column);
    if (open === "v_report_acquisitions" && operationalColumn) {
      const acquisitionId = typeof row["acquisition_id"] === "string" ? row["acquisition_id"] : "";
      const display = operational.byId.get(acquisitionId);
      if (!display) return operational.isLoading ? "Status loading" : "Status unavailable";
      if (column === "current_phase") return display.phase;
      if (column === "clock_state") return clockLabel(display.clockMode);
      if (column === "on_hold") return display.readiness === "HOLD" ? "Yes" : "No";
      if (column === "hold_reason") return display.holdReason ?? null;
      if (column === "hold_owner") return display.holdOwner ?? null;
    }
    return plainCell(column, row[column]);
  }

  const openView = REPORT_VIEWS.find((v) => v.view === open);

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Oversight"
        title="Reporting views"
        lead="Read-only views of the record for agency reporting. Nothing here is editable. Every figure is computed from the record."
      />

      <div className="mc-pa-stack">
        <section className="mc-kpanel" aria-label="Views">
          <div className="mc-kpanel-head"><div>
            <h2 className="mc-kpanel-title">Views</h2>
            <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground">Open a view to see its rows below and download them as CSV.</p>
          </div></div>
          <div className="mt-4">
            <DataTable label="Report views table" rowKey={(v) => v.view} rows={[...REPORT_VIEWS]}
              rowClassName={(v) => (open === v.view ? "is-selected" : undefined)}
              columns={[
                { key: "view", header: "View", rowHeader: true, cell: (v) => v.label },
                { key: "note", header: "What it holds", cell: (v) => <span className="text-muted-foreground">{v.note}</span> },
                { key: "rows", header: "Rows", numeric: true, cell: (v) => counts.data?.[v.view] === undefined ? <EmptyCell>{counts.isLoading ? "Counting" : "Not recorded"}</EmptyCell> : <span data-numeric>{counts.data[v.view]}</span> },
                { key: "open", header: "Open", cell: (v) => (
                  <button type="button" aria-pressed={open === v.view} className={open === v.view ? "mc-req-button" : "mc-req-button is-secondary"} onClick={() => setOpen(v.view)}>
                    {open === v.view ? "Showing" : "Open"}
                  </button>
                ) },
              ]} />
          </div>
          {operational.byId.size ? (
            <p className="mc-kpanel-foot mt-3 max-w-[80ch] text-[15px] leading-[22px] text-muted-foreground">
              The Executive Overview HOLD count also includes files blocked by a missing required item. That count is{" "}
              <span data-numeric>{overviewHoldCount}</span> today.
            </p>
          ) : null}
          {counts.isLoading ? <LoadingNote what="the view counts" /> : null}
          {counts.error ? <ErrorNote message="The view counts could not be read. Refresh the page to try again." /> : null}
        </section>

        <section className="mc-kpanel" aria-label="Preview rows">
          <div className="mc-kpanel-head">
            <div>
              <h2 className="mc-kpanel-title">{openView?.label}</h2>
              <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground" data-numeric>
                {preview.data ? `${preview.data.length} ${preview.data.length === 1 ? "row" : "rows"} shown, up to 200.` : "Loading the rows."}
              </p>
            </div>
            <button
              type="button"
              disabled={!preview.data || preview.data.length === 0}
              className="mc-req-button is-secondary"
              onClick={download}
            >
              Download CSV
            </button>
          </div>
          {preview.isLoading ? <LoadingNote what="the view" /> : null}
          {preview.error ? <ErrorNote message="The view could not be read. Refresh the page to try again." /> : null}
          {open === "v_report_acquisitions" && preview.data?.length ? (
            <p className="mt-3 max-w-[80ch] text-[15px] leading-[22px] text-muted-foreground">
              Phase, clock, and hold on screen come from each file's operational state. File status and status word come from the view. The CSV carries the database view's columns unchanged.
            </p>
          ) : null}
          {preview.data ? (
            <div className="mt-4">
              <DataTable
                label="Preview rows table, scrolls horizontally"
                stackOnMobile={false}
                maxHeight="70vh"
                rowKey={(_, i) => String(i)}
                rows={preview.data}
                empty={<p className="text-muted-foreground">This view holds no rows yet, so there is nothing to show or download.</p>}
                columns={cols.map((c) => ({
                  key: c,
                  header: headerLabel(c),
                  nowrap: false,
                  cell: (r: Record<string, unknown>) => {
                    const shown = displayCell(r, c);
                    return shown === null ? <EmptyCell /> : <span className="block max-w-[36ch] tabular-nums" title={shown}>{shown}</span>;
                  },
                }))}
              />
            </div>
          ) : null}
        </section>

        <section className="mc-kpanel" aria-label="Nightly extract">
          <h2 className="mc-kpanel-title">Nightly extract</h2>
          <p className="mt-2 max-w-[70ch] break-words text-[15px] leading-[22px] text-muted-foreground">
            A scheduled job writes one CSV extract of each view every night and records the row counts in the audit log.
            Power BI reads the acquisitions report from that extract. HQ supplies the extract token.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
