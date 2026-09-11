import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log — T-Minus" },
      { name: "description", content: "Who did what, when, and why, kept for the contract file." },
      { property: "og:title", content: "Audit Log — T-Minus" },
      {
        property: "og:description",
        content: "Who did what, when, and why, kept for the contract file.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <PageHeader title="The audit log could not be loaded" lead="Reload the page to try again." />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <PageHeader title="Not found" lead="Go back to the work queue." />
    </AppShell>
  ),
  component: AuditLogPage,
});

type LogRow = {
  log_id: string;
  acquisition_id: string | null;
  actor: string | null;
  action: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  phase: string | null;
  logged_at: string;
};

function AuditLogPage() {
  const { authState } = useRole();
  const [actor, setActor] = useState("");
  const [phase, setPhase] = useState("");

  const q = useQuery({
    queryKey: ["audit-log"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as LogRow[];
    },
  });

  const rows = q.data ?? [];
  const actors = useMemo(
    () => Array.from(new Set(rows.map((r) => r.actor).filter((a): a is string => !!a))).sort(),
    [rows],
  );
  const phases = useMemo(
    () => Array.from(new Set(rows.map((r) => r.phase).filter((p): p is string => !!p))).sort(),
    [rows],
  );

  const filtered = rows.filter(
    (r) => (!actor || r.actor === actor) && (!phase || r.phase === phase),
  );

  // One timeline per acquisition, newest activity first.
  const groups = useMemo(() => {
    const map = new Map<string, LogRow[]>();
    for (const r of filtered) {
      const key = r.acquisition_id ?? "No acquisition";
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <AppShell>
      <PageHeader
        title="Audit Log"
        lead="Who did what, when, and why. Kept for the contract file under FAR 4.801. Reading only."
      />

      <div className="mb-8 flex flex-wrap gap-6">
        <div>
          <label htmlFor="filter-actor" className="block text-[13px] text-muted-foreground">
            Actor
          </label>
          <select
            id="filter-actor"
            className="mt-1 rounded-lg border border-border bg-background p-2 text-[15px]"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          >
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-phase" className="block text-[13px] text-muted-foreground">
            Phase
          </label>
          <select
            id="filter-phase"
            className="mt-1 rounded-lg border border-border bg-background p-2 text-[15px]"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          >
            <option value="">Every phase</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {q.isLoading ? <p className="text-muted-foreground">Loading the log.</p> : null}

      {!q.isLoading && !groups.length ? (
        <p className="text-muted-foreground">
          Nothing recorded yet for this filter. Clear the filters, or start work on a file.
        </p>
      ) : null}

      {groups.map(([acqId, list]) => (
        <section key={acqId} className="mb-10">
          <h2 className="mb-3 text-[18px] leading-6 font-medium">
            {acqId === "No acquisition" ? (
              acqId
            ) : (
              <Link to="/files/$acquisitionId" params={{ acquisitionId: acqId }} className="text-primary">
                {acqId}
              </Link>
            )}
          </h2>
          <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-3 py-2 font-medium">When</th>
                <th scope="col" className="px-3 py-2 font-medium">Actor</th>
                <th scope="col" className="px-3 py-2 font-medium">Action</th>
                <th scope="col" className="px-3 py-2 font-medium">Phase</th>
                <th scope="col" className="px-3 py-2 font-medium">Field</th>
                <th scope="col" className="px-3 py-2 font-medium">Old</th>
                <th scope="col" className="px-3 py-2 font-medium">New</th>
                <th scope="col" className="px-3 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.log_id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2" data-numeric>
                    {new Date(r.logged_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.actor ?? "—"}</td>
                  <td className="px-3 py-2">{r.action ?? "—"}</td>
                  <td className="px-3 py-2">{r.phase ?? "—"}</td>
                  <td className="px-3 py-2">{r.field ?? "—"}</td>
                  <td className="px-3 py-2">{r.old_value ?? "—"}</td>
                  <td className="px-3 py-2">{r.new_value ?? "—"}</td>
                  <td className="px-3 py-2">{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </AppShell>
  );
}
