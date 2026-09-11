import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { templateByKey } from "@/lib/template-engine";
import { DefectReport } from "@/components/defect-report";

export const Route = createFileRoute("/documents/$templateKey/")({
  head: () => ({
    meta: [
      { title: "Choose an acquisition — T-Minus" },
      { name: "description", content: "Pick the acquisition this template should be filled from." },
      { property: "og:title", content: "Choose an acquisition — T-Minus" },
      { property: "og:description", content: "Pick the acquisition this template should be filled from." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChooseAcquisition,
});

function ChooseAcquisition() {
  const { templateKey } = Route.useParams();
  const { authState } = useRole();
  const def = templateByKey(templateKey);

  const q = useQuery({
    queryKey: ["acquisitions", "chooser"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_facts")
        .select("acquisition_id,title,center_code,current_phase")
        .order("acquisition_id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (!def) {
    return (
      <AppShell>
        <PageHeader title="Template not found" lead="Go back to Templates and choose a live template." />
        <Link to="/templates" className="text-primary">
          Back to Templates
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={def.name} lead="Choose the acquisition this document is written for." />
      <DefectReport
        templateKey={templateKey}
        templateName={def.name}
        revision={def.badge.revision}
        defaultCitation={def.badge.citation}
      />
      <ul className="max-w-[720px]">
        {(q.data ?? []).map((a) => (
          <li key={a.acquisition_id} className="border-b border-border py-3">
            <Link
              to="/documents/$templateKey/$acquisitionId"
              params={{ templateKey, acquisitionId: a.acquisition_id }}
              className="text-primary"
            >
              {a.acquisition_id} — {a.title}
            </Link>
            <p className="text-[13px] text-muted-foreground">
              {a.center_code} · {a.current_phase}
            </p>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
