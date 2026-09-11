import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { daysBetween, formatMoney, todayISO } from "@/lib/intake";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "Files — T-Minus" },
      {
        name: "description",
        content: "Every acquisition file, its clock line, and its days to award.",
      },
      { property: "og:title", content: "Files — T-Minus" },
      {
        property: "og:description",
        content: "Every acquisition file, its clock line, and its days to award.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FilesPage,
});

function FilesPage() {
  const { authState, role } = useRole();
  const q = useQuery({
    queryKey: ["files"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data } = await supabase
        .from("acquisition_facts")
        .select(
          "acquisition_id,title,center_code,estimated_value,target_award_date,clock_state,current_phase,status",
        )
        .order("acquisition_id");
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <PageHeader title="Files" lead="Every acquisition file, its phase, and its days to award." />

      {role !== "executive" ? (
        <Link
          to="/intake"
          className="mb-6 inline-block rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground"
        >
          Start an intake
        </Link>
      ) : null}

      {q.data?.length ? (
        <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Acquisition</th>
              <th scope="col" className="p-2">Title</th>
              <th scope="col" className="p-2">Center</th>
              <th scope="col" className="p-2">Estimated value</th>
              <th scope="col" className="p-2">Phase</th>
              <th scope="col" className="p-2">Clock</th>
              <th scope="col" className="p-2">Days to award</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((r) => (
              <tr key={r.acquisition_id} className="border-b border-border align-top">
                <td className="p-2">
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: r.acquisition_id }}
                    className="text-primary"
                  >
                    {r.acquisition_id}
                  </Link>
                </td>
                <td className="p-2">{r.title}</td>
                <td className="p-2">{r.center_code}</td>
                <td className="p-2">
                  {r.estimated_value ? formatMoney(Number(r.estimated_value)) : "—"}
                </td>
                <td className="p-2">{r.current_phase ?? "—"}</td>
                <td className="p-2">{r.clock_state ?? "—"}</td>
                <td className="p-2">
                  {r.target_award_date ? daysBetween(todayISO(), r.target_award_date) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground">
          No files yet. Start an intake to put the first acquisition on the clock.
        </p>
      )}
    </AppShell>
  );
}
