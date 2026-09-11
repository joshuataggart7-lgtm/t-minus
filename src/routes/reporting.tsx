import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { REPORT_VIEWS, rowsToCsv, type ReportViewName } from "@/lib/reporting";

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

  return (
    <AppShell>
      <PageHeader
        title="Reporting views"
        lead="Read-only views of the record for ORBIT's Power BI. Nothing here is editable; every figure is computed in the database."
      />

      <section className="mt-8">
        <h2 className="text-lg font-medium">Views</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th scope="col" className="py-2 pr-4 font-medium">View</th>
              <th scope="col" className="py-2 pr-4 font-medium">What it holds</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Rows</th>
              <th scope="col" className="py-2 font-medium">Open</th>
            </tr>
          </thead>
          <tbody>
            {REPORT_VIEWS.map((v) => (
              <tr key={v.view} className="border-b border-border align-top">
                <td className="py-2 pr-4">{v.label}</td>
                <td className="py-2 pr-4 text-muted">{v.note}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{counts.data?.[v.view] ?? "—"}</td>
                <td className="py-2">
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
        {counts.isLoading ? <LoadingNote what="the view counts" /> : null}
        {counts.error ? <ErrorNote message="The view counts could not be read. Refresh the page to try again." /> : null}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{REPORT_VIEWS.find((v) => v.view === open)?.label}</h2>
          <button type="button" className="rounded-lg border border-border px-3 py-1 text-primary" onClick={download}>
            Download CSV
          </button>
        </div>
        {preview.isLoading ? <LoadingNote what="the view" /> : null}
        {preview.error ? <ErrorNote message="The view could not be read. Refresh the page to try again." /> : null}
        {preview.data && preview.data.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-[13px] leading-[18px]">
              <thead>
                <tr className="border-b border-border text-left text-muted">
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
                        {r[c] === null || r[c] === undefined ? "—" : String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="mt-10 border-t border-border pt-6">
        <h2 className="text-lg font-medium">Nightly extract</h2>
        <p className="mt-2 max-w-[70ch] text-muted">
          A scheduled job writes one CSV extract of each view every night and records the row counts in the audit log.
          Power BI reads a view directly at{" "}
          <span className="tabular-nums">/api/public/hooks/reporting-extract?view=v_report_acquisitions</span>, with the
          extract token supplied by HQ.
        </p>
      </section>
    </AppShell>
  );
}
