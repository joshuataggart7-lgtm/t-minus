import { writeAudit } from "@/lib/audit";
import { phaseAlias } from "@/lib/phase-alias";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import {
  CiteChip,
  DataTable,
  DetailsList,
  DetailsSection,
  EmptyCell,
  McPageHeader,
  StatusChip,
  WithDetailsPanel,
  type DataColumn,
} from "@/components/ui-mc";
import {
  DIRECTIVE_CITATION,
  loadHardwareFiles,
  REVIEW_STATUSES,
  toCsv,
  type ReviewStatus,
} from "@/lib/directives";

type HardwareRow = Awaited<ReturnType<typeof loadHardwareFiles>>[number];

// Same columns, words, and colors as before; now on the shared table and status chip.
const COLUMNS: DataColumn<HardwareRow>[] = [
  {
    key: "acquisition",
    header: "Acquisition",
    nowrap: true,
    cell: (r) => (
      <Link to="/files/$acquisitionId" params={{ acquisitionId: r.acquisition_id }} data-numeric>
        {r.acquisition_id}
      </Link>
    ),
  },
  { key: "title", header: "Title", cell: (r) => r.title ?? <EmptyCell /> },
  { key: "center", header: "Center", nowrap: true, cell: (r) => r.center_code ?? <EmptyCell /> },
  { key: "phase", header: "Phase", cell: (r) => phaseAlias(r.current_phase) ?? <EmptyCell /> },
  {
    key: "statement",
    header: "Right to Repair statement",
    cell: (r) =>
      r.statement === "attached" ? (
        <StatusChip label="Attached" tone="ontrack" />
      ) : (
        <StatusChip label="Not attached" tone="atrisk" />
      ),
  },
  {
    key: "review",
    header: "Restrictive-clause review",
    cell: (r) =>
      r.review === "not reviewed" ? (
        <StatusChip label="Not reviewed" tone="attention" />
      ) : (
        <StatusChip label={r.review === "reviewed" ? "Reviewed" : "Modified"} tone="ontrack" />
      ),
  },
];

export const Route = createFileRoute("/directives")({
  head: () => ({
    meta: [
      { title: "Directive compliance · T-Minus" },
      {
        name: "description",
        content:
          "Hardware buys, their Right to Repair requirements statement, and the restrictive-clause review status.",
      },
      { property: "og:title", content: "Directive compliance · T-Minus" },
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
    await writeAudit({
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

  const all = q.data ?? [];
  const missingStatement = all.filter((r) => r.statement !== "attached").length;
  const notReviewed = all.filter((r) => r.review === "not reviewed").length;

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Oversight"
        title="Directive compliance"
        lead="Every file with a hardware deliverable, its Right to Repair requirements statement, and its restrictive-clause review."
      />

      {q.isLoading ? <LoadingNote what="the hardware files" /> : null}
      {q.error ? <ErrorNote message="The list did not load. Reload the page and try again." /> : null}

      <WithDetailsPanel
        panelLabel="Directive details"
        panel={
          <>
            {q.data ? (
              <DetailsSection title="At a glance">
                <DetailsList
                  items={[
                    { term: "Hardware files", value: all.length },
                    { term: "Still need the statement or review", value: outstanding },
                    { term: "Statement not attached", value: missingStatement },
                    { term: "Clause review not recorded", value: notReviewed },
                    { term: "Shown with these filters", value: rows.length },
                  ]}
                />
              </DetailsSection>
            ) : null}
            <DetailsSection title="Authority and scope" id="directive-authority">
              <p className="type-meta break-words text-muted-foreground">
                <CiteChip cite={DIRECTIVE_CITATION} />
              </p>
            </DetailsSection>
          </>
        }
      >
        {q.data ? (
          <p className="mb-6 max-w-[80ch] type-body">
            {q.data.length} hardware {q.data.length === 1 ? "file" : "files"}.{" "}
            {outstanding === 0
              ? "Every one has the statement attached and the clause review recorded."
              : `${outstanding} ${outstanding === 1 ? "still needs" : "still need"} the statement or the clause review.`}
          </p>
        ) : null}

        <section aria-label="Filters" className="mb-6 flex flex-wrap items-end gap-6">
          <div>
            <label htmlFor="d-statement" className="block type-meta text-muted-foreground">
              Right to Repair statement
            </label>
            <select
              id="d-statement"
              className="mt-1 rounded-lg border border-border bg-background px-3 py-2 type-body"
              value={statement}
              onChange={(e) => setStatement(e.target.value as typeof statement)}
            >
              <option value="all">All files</option>
              <option value="attached">Attached</option>
              <option value="not attached">Not attached</option>
            </select>
          </div>
          <div>
            <label htmlFor="d-review" className="block type-meta text-muted-foreground">
              Restrictive-clause review
            </label>
            <select
              id="d-review"
              className="mt-1 rounded-lg border border-border bg-background px-3 py-2 type-body"
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
            className="rounded-lg border border-border px-3 py-2 type-body text-primary"
            disabled={rows.length === 0}
            onClick={() => void exportCsv()}
          >
            Export to CSV
          </button>
        </section>

        {q.data && rows.length === 0 ? (
          <EmptyState
            sentence="No hardware files match these filters."
            action={<Link to="/files" className="text-primary underline">Open Files</Link>}
          />
        ) : null}

        <DataTable
          label="Hardware files and their directives"
          caption="Hardware files and their directive compliance"
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.acquisition_id}
        />
      </WithDetailsPanel>
    </AppShell>
  );
}
