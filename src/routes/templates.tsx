import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { TEMPLATES } from "@/lib/template-engine";
import { DEVIATION_TEMPLATE } from "@/lib/deviations";

type TemplateRow = {
  template_id: string;
  nf_1098_tab: string | null;
  name: string;
  hq_revision_date: string | null;
  status: string | null;
  governing_citation: string | null;
  citation_tier: string | null;
};

const liveKeyFor = (name: string) => TEMPLATES.find((t) => t.name === name)?.key ?? null;

function statusLabel(status: string | null) {
  if (!status) return "Planned";
  if (status === "live") return "Live";
  if (status.startsWith("build next")) return "Build next";
  return "Planned";
}

function statusColor(status: string | null) {
  if (status === "live") return "var(--ontrack)";
  if (status?.startsWith("build next")) return "var(--attention)";
  return "var(--muted-foreground)";
}

/** Placeholder text carried in the seed is not a citation. */
function citationText(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text || /^\[.*\]$/.test(text) || /fill from template/i.test(text)) return "—";
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
  const tabs = [...new Set(rows.map((r) => r.nf_1098_tab ?? "—"))].sort((a, b) => a.localeCompare(b));
  const live = rows.filter((r) => r.status === "live").length;
  const next = rows.filter((r) => r.status?.startsWith("build next")).length;

  return (
    <AppShell>
      <PageHeader
        title="Templates"
        lead="Versioned forms, each with its governing citation, tier, and HQ effective date."
      />

      {authState !== "signed-in" ? (
        <LoadingNote what="your sign-in" />
      ) : q.isError ? (
        <ErrorNote message="The template list did not load. Refresh the page; if it stays empty, open Seed status to confirm the templates loaded." />
      ) : q.isLoading ? (
        <LoadingNote what="the template list" />
      ) : (

        <>
          <p className="mb-8 max-w-[80ch] text-[15px] leading-[22px] text-muted-foreground" data-numeric>
            {live} live, {next} to build next, {rows.length - live - next} planned. Grouped by NF 1098 tab.
          </p>

          {tabs.map((tab) => (
            <section key={tab} className="mb-10">
              <h2 className="mb-3 text-[18px] leading-6 font-medium">
                {tab === "—" ? "No tab" : tab === "DRD" ? "DRD (AW-DRD)" : `Tab ${tab}`}
              </h2>
              <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="px-3 py-2 font-medium">Template</th>
                    <th scope="col" className="px-3 py-2 font-medium">HQ effective date</th>
                    <th scope="col" className="px-3 py-2 font-medium">Citation</th>
                    <th scope="col" className="px-3 py-2 font-medium">Tier</th>
                    <th scope="col" className="px-3 py-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((r) => (r.nf_1098_tab ?? "—") === tab)
                    .map((r) => {
                      const key = r.status === "live" ? liveKeyFor(r.name) : null;
                      const isDeviation = r.name === DEVIATION_TEMPLATE.name && r.status === "live";
                      return (
                        <tr key={r.template_id} className="border-b border-border last:border-0 align-top">
                          <td className="px-3 py-2">
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
                          <td className="px-3 py-2" data-numeric>
                            {r.hq_revision_date ?? "—"}
                          </td>
                          <td className="px-3 py-2">{citationText(r.governing_citation)}</td>
                          <td className="px-3 py-2">{r.citation_tier ?? "—"}</td>
                          <td className="px-3 py-2">
                            <StatusMark color={statusColor(r.status)}>{statusLabel(r.status)}</StatusMark>
                          </td>

                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
    </AppShell>
  );
}
