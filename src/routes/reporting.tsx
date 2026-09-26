import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { REPORT_VIEWS, rowsToCsv, type ReportViewName } from "@/lib/reporting";
import { MissionNavSection } from "@/components/mission-control/mission-navigator";
import { useOperationalDisplay } from "@/components/mission-control/use-operational-display";
import { TableScrollRegion } from "@/components/table-scroll-region";

export const Route = createFileRoute("/reporting")({
  head: () => ({
    meta: [
      { title: "Reporting views — T-Minus" },
      {
        name: "description",
        content: "Read-only reporting views of missions, acquisitions, holds, polls, and audit counts for ORBIT.",
      },
      { property: "og:title", content: "Reporting views — T-Minus" },
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

function ReportingPage() {
  const { authState } = useRole();
  const [open, setOpen] = useState<ReportViewName>("v_report_acquisitions");
  const operational = useOperationalDisplay(authState === "signed-in" && open === "v_report_acquisitions");

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
      const { data, error } = await supabase.from(open as never).select("*").limit(200);
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
  function displayCell(row: Record<string, unknown>, column: string) {
    if (open !== "v_report_acquisitions" || !["current_phase", "clock_state", "status", "status_word", "on_hold", "hold_reason", "hold_owner"].includes(column)) {
      return row[column] === null || row[column] === undefined ? "—" : String(row[column]);
    }
    const acquisitionId = typeof row["acquisition_id"] === "string" ? row["acquisition_id"] : "";
    const display = operational.byId.get(acquisitionId);
    if (!display) return operational.isLoading ? "Status loading" : "Status unavailable";
    if (column === "current_phase") return display.phase;
    if (column === "clock_state") return display.clockMode;
    if (column === "on_hold") return display.readiness === "HOLD" ? "true" : "false";
    if (column === "hold_reason") return display.holdReason ?? "—";
    if (column === "hold_owner") return display.holdOwner ?? "—";
    return display.readiness;
  }

  return (
    <AppShell>
      <PageHeader
        title="Reporting views"
        lead="Read-only views of the record for ORBIT's Power BI. Nothing here is editable; every figure is computed in the database."
      />

      <section className="mt-8">
        <h2 className="text-lg font-medium">Views</h2>
        <TableScrollRegion className="mt-3" label="Report views table">
        <table className="w-full border-collapse text-sm max-sm:block">
          <thead className="max-sm:hidden">
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">View</th>
              <th scope="col" className="py-2 pr-4 font-medium">What it holds</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Rows</th>
              <th scope="col" className="py-2 font-medium">Open</th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {REPORT_VIEWS.map((v) => (
              <tr key={v.view} className="border-b border-border align-top max-sm:mb-3 max-sm:block max-sm:border max-sm:p-3 max-sm:last:mb-0">
                <td data-label="View" className="py-2 pr-4 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">{v.label}</td>
                <td data-label="What it holds" className="py-2 pr-4 text-muted-foreground max-sm:mt-3 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">{v.note}</td>
                <td data-label="Rows" className="py-2 pr-4 text-right tabular-nums max-sm:mt-3 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:text-left max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">{counts.data?.[v.view] ?? "—"}</td>
                <td data-label="Open" className="py-2 max-sm:mt-3 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1 text-primary"
                    onClick={() => setOpen(v.view)}
                  >
                    {open === v.view ? "Open" : "Show"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableScrollRegion>
        {counts.isLoading ? <LoadingNote what="the view counts" /> : null}
        {counts.error ? <ErrorNote message="The view counts could not be read. Refresh the page to try again." /> : null}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{REPORT_VIEWS.find((v) => v.view === open)?.label}</h2>
          <button
            type="button"
            disabled={!preview.data || preview.data.length === 0}
            className="rounded-lg border border-border px-3 py-1 text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
            onClick={download}
          >
            Download CSV
          </button>
        </div>
        {preview.isLoading ? <LoadingNote what="the view" /> : null}
        {preview.error ? <ErrorNote message="The view could not be read. Refresh the page to try again." /> : null}
        {preview.data && preview.data.length > 0 ? (
          <MissionNavSection id="report-preview" label="Preview rows" collapsible defaultOpen summary={`${preview.data.length} rows`}>
          {open === "v_report_acquisitions" ? (
            <p className="mb-3 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">
              Phase, clock, status and hold on screen come from each file's operational state. The CSV carries the database view's columns unchanged.
            </p>
          ) : null}
          <TableScrollRegion label="Preview rows table, scrolls horizontally">
            <table className="w-full border-collapse text-[13px] leading-[18px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {cols.map((c) => (
                    <th key={c} scope="col" className="whitespace-nowrap py-2 pr-4 font-medium">
                      {c.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.map((r, i) => (
                  <tr key={i} className="border-b border-border">
                    {cols.map((c) => (
                      <td key={c} className="whitespace-nowrap py-2 pr-4 tabular-nums">
                        {displayCell(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollRegion>
          </MissionNavSection>
        ) : null}
        {!preview.isLoading && !preview.error && preview.data && preview.data.length === 0 ? (
          <p className="mt-3 max-w-[80ch] text-[15px] leading-[22px] text-muted-foreground">
            This view holds no rows yet, so there is nothing to show or download.
          </p>
        ) : null}
      </section>

      <MissionNavSection id="report-extract" label="Nightly extract" collapsible summary="Delivery details">
        <section className="min-w-0">
        <p className="max-w-[70ch] break-words text-muted-foreground">
          A scheduled job writes one CSV extract of each view every night and records the row counts in the audit log.
          Power BI reads a view directly at{" "}
          <span className="tabular-nums">/api/public/hooks/reporting-extract?view=v_report_acquisitions</span>, with the
          extract token supplied by HQ.
        </p>
        </section>
      </MissionNavSection>
    </AppShell>
  );
}
