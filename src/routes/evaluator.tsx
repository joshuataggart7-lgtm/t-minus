import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, LoadingNote, ErrorNote } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import {
  DataTable,
  DetailsList,
  DetailsSection,
  EmptyCell,
  McPageHeader,
  StatusChip,
  WithDetailsPanel,
  type DataColumn,
} from "@/components/ui-mc";
import { supabase } from "@/integrations/supabase/client";
import { dateCT } from "@/lib/calendar-date";

// The evaluator's view. Read-only: it reads saved Evaluation of Quotations
// Records whose technical evaluator is the signed-in persona, and the
// evaluation factors stored for those files. Prices stay with the contracting
// officer and are never read into this page: only the named technical fields
// below are selected from the record, and any clause that still speaks of
// price is left out of what the evaluator sees.

const EQR_TEMPLATE = "Evaluation of Quotations Record";

// RFO FAR 3.104-4(a), first sentence, verbatim from the RFO text on file.
const DISCLOSURE_RULE =
  "No person or entity may disclose contractor bid or proposal information or source selection information to any person other than those authorized to receive that information, in accordance with applicable agency regulations or procedures, by the agency head or contracting officer.";

type Quote = { n: number; name: string; uei: string; rating: string; reason: string };
type Factor = { name: string; importance: string; description: string };
type Assignment = {
  acquisitionId: string;
  title: string;
  coName: string;
  version: number;
  savedAt: string | null;
  criteria: string;
  statements: string;
  statementsDate: string;
  quotes: Quote[];
  factors: Factor[];
};

/** "L. Park (fictional COR)" reads as "l. park" for matching. */
function personKey(name: string): string {
  return name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

// The record fields the evaluator may see. Prices, the price comparison and
// the recommendation are not selected.
const EQR_FIELDS = [
  "title",
  "co_name",
  "evaluator_name",
  "evaluator_statements",
  "evaluator_statements_date",
  "evaluation_criteria",
  ...[1, 2, 3, 4].flatMap((n) => [`quoter_${n}_name`, `quoter_${n}_uei`, `quoter_${n}_rating`, `quoter_${n}_reason`]),
];
const EQR_SELECT = ["acquisition_id", "version", "saved_at", ...EQR_FIELDS.map((k) => `${k}:field_values->>${k}`)].join(",");

const PRICE_WORDS = /\b(price[sd]?|pricing|cost|costs|cheap|expensive|dollars?)\b|\$\s?\d/i;

/** Keeps only the clauses of a sentence or list that do not speak of price. */
function technicalOnly(value: string): string {
  if (!PRICE_WORDS.test(value)) return value;
  const sentences = value.split(/(?<=\.)\s+/);
  const kept = sentences
    .map((sentence) => {
      const end = /\.\s*$/.test(sentence) ? "." : "";
      const clauses = sentence
        .replace(/\.\s*$/, "")
        .split(/;|,?\s+and\s+(?=the\b)/)
        .map((c) => c.trim())
        .filter((c) => c && !PRICE_WORDS.test(c));
      return clauses.length ? `${clauses.join("; ")}${end}` : "";
    })
    .filter(Boolean);
  return kept.join(" ").trim();
}

async function loadAssignments(evaluatorName: string): Promise<Assignment[]> {
  const me = personKey(evaluatorName);
  const tpl = await supabase.from("templates").select("template_id,name").eq("name", EQR_TEMPLATE);
  if (tpl.error) throw tpl.error;
  const ids = (tpl.data ?? []).map((t) => t.template_id);
  if (!ids.length || !me) return [];
  const docs = await supabase
    .from("documents")
    .select(EQR_SELECT)
    .in("template_id", ids)
    .order("version", { ascending: false });
  if (docs.error) throw docs.error;
  type Row = { acquisition_id: string | null; version: number | null; saved_at: string | null; field_values: Record<string, unknown> };
  const fetched: Row[] = ((docs.data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    acquisition_id: (r["acquisition_id"] as string | null) ?? null,
    version: (r["version"] as number | null) ?? null,
    saved_at: (r["saved_at"] as string | null) ?? null,
    field_values: Object.fromEntries(EQR_FIELDS.map((k) => [k, r[k] ?? null])),
  }));
  // The current version of each file's record.
  const latest = new Map<string, Row>();
  for (const d of fetched) {
    if (!d.acquisition_id || latest.has(d.acquisition_id)) continue;
    latest.set(d.acquisition_id, d);
  }
  const mine = [...latest.values()].filter((d) => {
    const fv = d.field_values;
    const who = personKey(text(fv["evaluator_name"]));
    return Boolean(who) && (who === me || who.endsWith(me) || me.endsWith(who));
  });
  if (!mine.length) return [];
  const acqIds = mine.map((d) => d.acquisition_id as string);
  const factorsRes = await supabase
    .from("solicitation_m_factors")
    .select("acquisition_id,name,relative_importance,description,sort_order")
    .in("acquisition_id", acqIds)
    .order("sort_order", { ascending: true });
  if (factorsRes.error) throw factorsRes.error;
  return mine
    .map((d) => {
      const fv = (d.field_values ?? {}) as Record<string, unknown>;
      const quotes: Quote[] = [];
      for (let n = 1; n <= 4; n++) {
        const name = text(fv[`quoter_${n}_name`]);
        if (!name) continue;
        quotes.push({
          n,
          name,
          uei: text(fv[`quoter_${n}_uei`]),
          rating: text(fv[`quoter_${n}_rating`]),
          reason: technicalOnly(text(fv[`quoter_${n}_reason`])),
        });
      }
      return {
        acquisitionId: d.acquisition_id as string,
        title: text(fv["title"]),
        coName: text(fv["co_name"]),
        version: d.version ?? 1,
        savedAt: d.saved_at ?? null,
        criteria: technicalOnly(text(fv["evaluation_criteria"])),
        statements: text(fv["evaluator_statements"]),
        statementsDate: text(fv["evaluator_statements_date"]),
        quotes,
        factors: (factorsRes.data ?? [])
          .filter((f) => f.acquisition_id === d.acquisition_id)
          .map((f) => ({ name: f.name, importance: text(f.relative_importance), description: text(f.description) })),
      };
    })
    .sort((a, b) => a.acquisitionId.localeCompare(b.acquisitionId));
}

function statementsChip(a: Assignment) {
  if (/^signed/i.test(a.statements)) {
    return <StatusChip label={a.statementsDate ? `Signed ${a.statementsDate}` : "Signed"} tone="ontrack" />;
  }
  if (/not yet/i.test(a.statements)) return <StatusChip label="Not yet signed" tone="atrisk" />;
  return <StatusChip label="Not recorded" tone="attention" />;
}

function ratingChip(rating: string) {
  if (/^acceptable$/i.test(rating)) return <StatusChip label="Acceptable" tone="ontrack" />;
  if (/^unacceptable$/i.test(rating)) return <StatusChip label="Unacceptable" tone="atrisk" />;
  return <StatusChip label="Not rated" tone="neutral" />;
}

const QUOTE_COLUMNS: DataColumn<Quote>[] = [
  { key: "n", header: "Quote", nowrap: true, width: "5rem", cell: (q) => <span data-numeric>{q.n}</span> },
  { key: "name", header: "Quoter", rowHeader: true, cell: (q) => q.name },
  { key: "uei", header: "UEI", nowrap: true, cell: (q) => (q.uei ? <span data-numeric>{q.uei}</span> : <EmptyCell />) },
  { key: "rating", header: "Technical rating", nowrap: true, cell: (q) => ratingChip(q.rating) },
  { key: "reason", header: "Reason for the rating", cell: (q) => q.reason || <EmptyCell /> },
];

const FACTOR_COLUMNS: DataColumn<Factor>[] = [
  { key: "name", header: "Factor", rowHeader: true, cell: (f) => f.name },
  { key: "importance", header: "Relative importance", cell: (f) => f.importance || <EmptyCell /> },
  { key: "description", header: "What is evaluated", cell: (f) => f.description || <EmptyCell /> },
];

export const Route = createFileRoute("/evaluator")({
  head: () => ({
    meta: [
      { title: "Evaluation workspace · T-Minus" },
      {
        name: "description",
        content: "The quotations assigned to you for technical evaluation, the evaluation factors, your worksheet and your statements status.",
      },
      { property: "og:title", content: "Evaluation workspace · T-Minus" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: EvaluatorPage,
});

function EvaluatorPage() {
  const { user, roles } = useRole();
  const isEvaluator = roles.includes("evaluator");
  const q = useQuery({
    queryKey: ["evaluator-assignments", user.name],
    queryFn: () => loadAssignments(user.name),
    enabled: isEvaluator,
  });
  const rows = q.data ?? [];
  const quoteCount = rows.reduce((n, a) => n + a.quotes.length, 0);
  const rated = rows.reduce((n, a) => n + a.quotes.filter((x) => x.rating).length, 0);
  const signed = rows.filter((a) => /^signed/i.test(a.statements)).length;

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Evaluation"
        scope="Read-only in the demo"
        title="Evaluation workspace"
        lead="The quotations assigned to you for technical evaluation, the factors they are judged against, and your worksheet. Prices are evaluated by the contracting officer and are not shown here."
      />
      {!isEvaluator ? (
        <p className="mc-req-fallback">
          This workspace is for a technical evaluator. Choose the evaluator persona in Try the demo to see it.
        </p>
      ) : q.isLoading ? (
        <LoadingNote what="your evaluation assignments" />
      ) : q.isError ? (
        <ErrorNote message="Your evaluation assignments did not load. Reload the page to try again." />
      ) : (
        <WithDetailsPanel
          panelLabel="Your evaluation"
          panel={
            <>
              <DetailsSection title="Your evaluation">
                <DetailsList
                  items={[
                    { term: "Evaluator", value: user.name },
                    { term: "Files assigned", value: <span data-numeric>{rows.length}</span> },
                    { term: "Quotations", value: <span data-numeric>{quoteCount}</span> },
                    { term: "Rated", value: <span data-numeric>{`${rated} of ${quoteCount}`}</span> },
                    { term: "Statements signed", value: <span data-numeric>{`${signed} of ${rows.length}`}</span> },
                  ]}
                />
              </DetailsSection>
              <DetailsSection title="Who sees what">
                <blockquote className="mc-eval-rule">
                  <p>{DISCLOSURE_RULE}</p>
                  <footer>RFO FAR 3.104-4(a)</footer>
                </blockquote>
                <p className="mc-eval-note">
                  You see the quotations assigned to you, the factors and your worksheet. Prices, other files and source
                  selection records stay with the contracting officer.
                </p>
              </DetailsSection>
            </>
          }
        >
          {rows.length === 0 ? (
            <div className="mc-dt-empty">No quotations are assigned to you for evaluation.</div>
          ) : (
            <div className="mc-eval-list">
              {rows.map((a) => (
                <article key={a.acquisitionId} className="mc-kpanel" aria-labelledby={`eval-${a.acquisitionId}`}>
                  <header className="mc-kpanel-head">
                    <div className="min-w-0">
                      <p className="mc-req-id" data-numeric>
                        {a.acquisitionId}
                      </p>
                      <h2 id={`eval-${a.acquisitionId}`} className="mc-kpanel-title">
                        {a.title || "Requirement not named"}
                      </h2>
                      <p className="mc-req-meta">
                        Evaluation of Quotations Record, version {a.version}
                        {a.savedAt ? `, saved ${dateCT(a.savedAt) ?? a.savedAt.slice(0, 10)}` : ""}
                        {a.coName ? ` · Contracting officer ${a.coName}` : ""}
                      </p>
                    </div>
                    <div className="mc-kpanel-status">
                      <span className="mc-req-h">Your statements</span>
                      {statementsChip(a)}
                    </div>
                  </header>

                  <section className="mc-kpanel-section" aria-label="Evaluator statements">
                    <h3 className="mc-req-h">Nondisclosure and conflict of interest statements</h3>
                    <p className="mc-req-text">
                      {/^signed/i.test(a.statements)
                        ? `${a.statements}${a.statementsDate ? ` on ${a.statementsDate}` : ""}.`
                        : /not yet/i.test(a.statements)
                          ? "Not yet signed. Sign the statements before you read the quotations."
                          : "Not recorded in T-Minus. Ask the contracting officer before you read the quotations."}{" "}
                      <span className="mc-req-meta mc-eval-inline">Center practice, not a regulation.</span>
                    </p>
                  </section>

                  <section className="mc-kpanel-section" aria-label="Evaluation factors">
                    <h3 className="mc-req-h">Evaluation factors</h3>
                    {a.factors.length ? (
                      <DataTable
                        label={`Evaluation factors for ${a.acquisitionId}`}
                        columns={FACTOR_COLUMNS}
                        rows={a.factors}
                        rowKey={(f, i) => `${i}-${f.name}`}
                      />
                    ) : (
                      <dl className="mc-eval-basis">
                        <div>
                          <dt>What you rate</dt>
                          <dd>Technical acceptability: each quotation is rated acceptable or unacceptable.</dd>
                        </div>
                        <div>
                          <dt>Technical criteria stated in the notice</dt>
                          <dd>{a.criteria || <EmptyCell />}</dd>
                        </div>
                      </dl>
                    )}
                  </section>

                  <section className="mc-kpanel-section" aria-label="Worksheet">
                    <h3 className="mc-req-h">Your worksheet</h3>
                    <DataTable
                      label={`Technical worksheet for ${a.acquisitionId}`}
                      caption="Each quotation, its technical rating and the reason"
                      columns={QUOTE_COLUMNS}
                      rows={a.quotes}
                      rowKey={(x) => String(x.n)}
                      empty="No quotations are recorded on this file yet."
                    />
                  </section>
                </article>
              ))}
            </div>
          )}
        </WithDetailsPanel>
      )}
    </AppShell>
  );
}
