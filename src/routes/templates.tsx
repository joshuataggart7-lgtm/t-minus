import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { TEMPLATES } from "@/lib/template-engine";
import { DEVIATION_TEMPLATE } from "@/lib/deviations";
import { TableScrollRegion } from "@/components/table-scroll-region";

type TemplateRow = {
  template_id: string;
  nf_1098_tab: string | null;
  name: string;
  hq_revision_date: string | null;
  status: string | null;
  governing_citation: string | null;
  citation_tier: string | null;
};

/** Register rows built as a mode of another live template rather than a page of their own. */
const TEMPLATE_ALIASES: Record<string, string> = {
  "Governmentwide Point of Entry (GPE) Templates": "sam-notice",
  "Enterprise Instructions Evaluation of Total Compensation Plans (TCPs)": "tcp-evaluation-memo",
};

const liveKeyFor = (name: string) =>
  TEMPLATES.find((t) => t.name === name)?.key ?? TEMPLATE_ALIASES[name] ?? null;

/** P0-4: the library records a working template as "live" or "current". */
const isLiveStatus = (status: string | null) => {
  const s = (status ?? "").trim().toLowerCase();
  return s === "live" || s === "current";
};

function statusLabel(status: string | null) {
  if (!status) return "Planned";
  if (isLiveStatus(status)) return "Live";
  if (status.toLowerCase().startsWith("build next")) return "Build next";
  return "Planned";
}

function statusColor(status: string | null) {
  if (isLiveStatus(status)) return "var(--mc-readiness-go)";
  if ((status ?? "").toLowerCase().startsWith("build next")) return "var(--mc-readiness-watch)";
  return "var(--muted-foreground)";
}

/**
 * The HQ effective date cell. Only a date-shaped value is shown; any other
 * stored text reads "Not dated" (it can name internal files, so it is not
 * exposed in a tooltip either).
 */
const NO_TAB = "__none__";

function formatEffective(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "Not recorded";
  if (
    /^\d{4}-\d{2}(-\d{2})?$/.test(text) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{4}$/i.test(text) ||
    /^\d{1,2}\/(\d{1,2}\/)?\d{4}$/.test(text)
  )
    return text;
  return "Not dated";
}

/** Placeholder text carried in the seed is not a citation. */
function citationText(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text || /^\[.*\]$/.test(text) || /fill from template/i.test(text)) return "Not cited";
  return text;
}

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Templates — T-Minus" },
      {
        name: "description",
        content: "Versioned forms with their governing citation and whether it binds or guides.",
      },
      { property: "og:title", content: "Templates — T-Minus" },
      {
        property: "og:description",
        content: "Versioned forms with their governing citation and whether it binds or guides.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { authState } = useRole();
  const q = useQuery({
    queryKey: ["templates"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("template_id,nf_1098_tab,name,hq_revision_date,status,governing_citation,citation_tier")
        .order("nf_1098_tab", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as TemplateRow[];
    },
  });

  const rows = q.data ?? [];
  const tabs = [...new Set(rows.map((r) => r.nf_1098_tab ?? NO_TAB))].sort((a, b) => a.localeCompare(b));
  const live = rows.filter((r) => isLiveStatus(r.status)).length;
  const next = rows.filter((r) => (r.status ?? "").toLowerCase().startsWith("build next")).length;

  return (
    <AppShell>
      <PageHeader
        title="Templates"
        lead="Versioned forms, each with its governing citation, tier, and HQ effective date."
      />

      {authState !== "signed-in" ? (
        <LoadingNote what="your sign-in" />
      ) : q.isError ? (
        <ErrorNote message="The template list did not load. Refresh the page. If it still fails, tell the T-Minus team." />
      ) : q.isLoading ? (
        <LoadingNote what="the template list" />
      ) : (

        <>
          <p className="mb-8 max-w-[80ch] text-[15px] leading-[22px] text-muted-foreground" data-numeric>
            {live} live, {next} to build next, {rows.length - live - next} planned. Grouped by NF 1098 tab.
          </p>

          {tabs.map((tab) => {
            const sectionHeading = tab === NO_TAB ? "No tab" : tab === "DRD" ? "DRD (AW-DRD)" : `Tab ${tab}`;
            return (
            <section key={tab} className="mb-10">
              <h2 className="mb-3 text-[18px] leading-6 font-medium">
                {sectionHeading}
              </h2>
              <TableScrollRegion baseClassName="mc-work-table-wrap" label={`${sectionHeading} templates`}>
              <table className="w-full table-fixed border border-border bg-background text-[13px] leading-[18px] max-sm:block">
                {/* One shared column grid so every tab's table lines up. */}
                <colgroup className="max-sm:hidden">
                  <col className="w-[38%]" />
                  <col className="w-[16%]" />
                  <col className="w-[30%]" />
                  <col className="w-[6%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="max-sm:hidden">
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="px-3 py-2 font-medium">Template</th>
                    <th scope="col" className="px-3 py-2 font-medium">HQ effective date</th>
                    <th scope="col" className="px-3 py-2 font-medium">Citation</th>
                    <th scope="col" className="px-3 py-2 font-medium">Tier</th>
                    <th scope="col" className="px-3 py-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="max-sm:block">
                  {rows
                    .filter((r) => (r.nf_1098_tab ?? NO_TAB) === tab)
                    .map((r) => {
                      const key = isLiveStatus(r.status) ? liveKeyFor(r.name) : null;
                      const isDeviation = r.name === DEVIATION_TEMPLATE.name && isLiveStatus(r.status);
                      return (
                        <tr key={r.template_id} className="border-b border-border last:border-0 align-top max-sm:mb-3 max-sm:block max-sm:border max-sm:p-3 max-sm:last:mb-0">
                          <td data-label="Template" className="px-3 py-2 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">
                            {isDeviation ? (
                              <Link to="/deviations" className="text-primary">
                                {r.name}
                              </Link>
                            ) : key ? (
                              <Link to="/documents/$templateKey" params={{ templateKey: key }} className="text-primary">
                                {r.name}
                              </Link>
                            ) : (
                              r.name
                            )}
                          </td>
                          <td data-label="HQ effective date" className="px-3 py-2 max-sm:mt-3 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]" data-numeric>
                            {formatEffective(r.hq_revision_date)}
                          </td>
                          <td data-label="Citation" className="px-3 py-2 max-sm:mt-3 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">{citationText(r.governing_citation)}</td>
                          <td data-label="Tier" className="px-3 py-2 max-sm:mt-3 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">{r.citation_tier ?? "Not set"}</td>
                          <td data-label="State" className="px-3 py-2 max-sm:mt-3 max-sm:block max-sm:h-auto max-sm:min-h-0 max-sm:p-0 max-sm:before:mb-1 max-sm:before:block max-sm:before:text-[12px] max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]">
                            <StatusMark color={statusColor(r.status)}>{statusLabel(r.status)}</StatusMark>
                          </td>

                        </tr>
                      );
                    })}
                </tbody>
              </table>
              </TableScrollRegion>
            </section>
            );
          })}
        </>
      )}
    </AppShell>
  );
}
