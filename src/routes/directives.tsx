import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import {
  DIRECTIVE_CITATION,
  loadHardwareFiles,
  REVIEW_STATUSES,
  toCsv,
  type ReviewStatus,
} from "@/lib/directives";

export const Route = createFileRoute("/directives")({
  head: () => ({
    meta: [
      { title: "Directive compliance — T-Minus" },
      {
        name: "description",
        content:
          "Hardware buys, their Right to Repair requirements statement, and the restrictive-clause review status.",
      },
      { property: "og:title", content: "Directive compliance — T-Minus" },
      {
        property: "og:description",
        content: "Every hardware file, its Right to Repair statement, and its restrictive-clause review status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DirectivesPage,
});

function DirectivesPage() {
  const { authState, user } = useRole();
  const [review, setReview] = useState<"all" | ReviewStatus>("all");
  const [statement, setStatement] = useState<"all" | "attached" | "not attached">("all");

  const q = useQuery({
    queryKey: ["directive-compliance"],
    enabled: authState === "signed-in",
    queryFn: loadHardwareFiles,
  });

  const rows = (q.data ?? []).filter(
    (r) => (review === "all" || r.review === review) && (statement === "all" || r.statement === statement),
  );

  async function exportCsv() {
    const at = new Date().toISOString();
    const csv = toCsv(rows, at);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `directive-compliance-${at.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await supabase.from("audit_log").insert({
      acquisition_id: null,
      actor: user.name,
      action: "Directive compliance exported to CSV",
      field: "directive_compliance",
      old_value: null,
      new_value: `${rows.length} hardware files`,
      reason: "OP memo, March 17, 2026",
      phase: null,
    } as never);
  }

  const outstanding = (q.data ?? []).filter((r) => !r.compliant).length;

  return (
    <AppShell>
      <PageHeader
        title="Directive compliance"
        lead="Every file with a hardware deliverable, its Right to Repair requirements statement, and its restrictive-clause review."
      />

      <p className="mb-6 max-w-[80ch] text-[13px] text-muted-foreground">{DIRECTIVE_CITATION}</p>

      {q.isLoading ? <LoadingNote what="the hardware files" /> : null}
      {q.error ? <ErrorNote message="The list did not load. Reload the page and try again." /> : null}

      {q.data ? (
        <p className="mb-6 max-w-[80ch] text-[15px]">
          {q.data.length} hardware {q.data.length === 1 ? "file" : "files"}.{" "}
          {outstanding === 0
            ? "Every one has the statement attached and the clause review recorded."
            : `${outstanding} still need the statement or the clause review.`}
        </p>
      ) : null}

      <section aria-label="Filters" className="mb-6 flex flex-wrap items-end gap-6">
        <div>
          <label htmlFor="d-statement" className="block text-[13px] text-muted-foreground">
            Right to Repair statement
          </label>
          <select
            id="d-statement"
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            value={statement}
            onChange={(e) => setStatement(e.target.value as typeof statement)}
          >
            <option value="all">All files</option>
            <option value="attached">Attached</option>
            <option value="not attached">Not attached</option>
          </select>
        </div>
        <div>
          <label htmlFor="d-review" className="block text-[13px] text-muted-foreground">
            Restrictive-clause review
          </label>
          <select
            id="d-review"
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            value={review}
            onChange={(e) => setReview(e.target.value as typeof review)}
          >
            <option value="all">All statuses</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-[15px] text-primary"
          disabled={rows.length === 0}
          onClick={() => void exportCsv()}
        >
          Export to CSV
        </button>
      </section>

      {q.data && rows.length === 0 ? (
        <EmptyState
          message="No hardware files match these filters."
          action={<Link to="/files" className="text-primary underline">Open Files</Link>}
        />
      ) : null}

      {rows.length > 0 ? (
        <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
          <caption className="sr-only">Hardware files and their directive compliance</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Acquisition</th>
              <th scope="col" className="p-2">Title</th>
              <th scope="col" className="p-2">Center</th>
              <th scope="col" className="p-2">Phase</th>
              <th scope="col" className="p-2">Right to Repair statement</th>
              <th scope="col" className="p-2">Restrictive-clause review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.acquisition_id} className="border-b border-border align-top">
                <td className="p-2" data-numeric>
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: r.acquisition_id }}
                    className="text-primary underline"
                  >
                    {r.acquisition_id}
                  </Link>
                </td>
                <td className="p-2">{r.title ?? "—"}</td>
                <td className="p-2">{r.center_code ?? "—"}</td>
                <td className="p-2">{r.current_phase ?? "—"}</td>
                <td className="p-2" style={r.statement === "attached" ? undefined : { color: "var(--risk)" }}>
                  {r.statement === "attached" ? "Attached" : "Not attached"}
                </td>
                <td className="p-2" style={r.review === "not reviewed" ? { color: "var(--attention)" } : undefined}>
                  {r.review === "not reviewed" ? "Not reviewed" : r.review === "reviewed" ? "Reviewed" : "Modified"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </AppShell>
  );
}
