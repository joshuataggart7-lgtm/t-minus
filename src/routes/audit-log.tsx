import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { DataTable, EmptyCell, McPageHeader } from "@/components/ui-mc";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { buildActorAliases, displayActor, type ProfileAliasRow } from "@/lib/actor-alias";
import { auditActionLabel, auditFieldLabel, auditPhaseLabel, auditTextLabel, auditValueLabel, storedAs } from "@/lib/audit-display";

export const Route = createFileRoute("/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log · T-Minus" },
      { name: "description", content: "Who did what, when, and why, kept for the contract file." },
      { property: "og:title", content: "Audit Log · T-Minus" },
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
      <McPageHeader eyebrow="Oversight" title="The audit log could not be loaded" lead="Reload the page to try again." />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <McPageHeader eyebrow="Oversight" title="Not found" lead="Go back to the work queue." />
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

/** Each file's timeline opens on its latest entries; the rest are one click away. */
const AUDIT_GROUP_TOP = 10;

function AuditLogPage() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
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

  const profilesQ = useQuery({
    queryKey: ["audit-log-actor-aliases"],
    enabled: authState === "signed-in",
    queryFn: async (): Promise<ProfileAliasRow[]> => {
      try {
        const { data, error } = await supabase.from("profiles").select("id,email,display_name");
        if (error) return [];
        return (data ?? []) as ProfileAliasRow[];
      } catch {
        return [];
      }
    },
  });
  const aliases = useMemo(() => buildActorAliases(profilesQ.data ?? []), [profilesQ.data]);

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const actors = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.actor)
            .filter((a): a is string => !!a)
            .map((a) => displayActor(a, aliases).name),
        ),
      ).sort(),
    [rows, aliases],
  );
  const phases = useMemo(
    () => Array.from(new Set(rows.map((r) => auditPhaseLabel(r.phase)).filter((p): p is string => !!p))).sort(),
    [rows],
  );

  const filtered = rows.filter(
    (r) =>
      (!actor || (!!r.actor && displayActor(r.actor, aliases).name === actor)) &&
      (!phase || auditPhaseLabel(r.phase) === phase),
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

  const filteredActors = new Set(filtered.map((r) => (r.actor ? displayActor(r.actor, aliases).name : ""))).size;

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Oversight"
        title="Audit log"
        lead="Who did what, when, and why. Kept for the contract file under RFO FAR 4.101. Reading only."
      />

      {q.data ? (
        <div className="mc-pa-stats mb-6">
          <div className="is-info"><strong data-numeric>{filtered.length}</strong><span>{filtered.length === 1 ? "Entry" : "Entries"}{actor || phase ? " for this filter" : " recorded"}</span></div>
          <div><strong data-numeric>{groups.filter(([id]) => id !== "No acquisition").length}</strong><span>Acquisitions with activity</span></div>
          <div><strong data-numeric>{filteredActors}</strong><span>People and services acting</span></div>
        </div>
      ) : null}

      <div className="mc-pa-form is-2 mb-8 max-w-[720px]" aria-label="Audit log filters">
        <div>
          <label htmlFor="filter-actor" className="mc-pa-label">
            Actor
            <select
            id="filter-actor"
            className="mc-pa-input"
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
          </label>
        </div>
        <div>
          <label htmlFor="filter-phase" className="mc-pa-label">
            Phase
            <select
            id="filter-phase"
            className="mc-pa-input"
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
          </label>
        </div>
      </div>

      {q.isLoading ? <LoadingNote what="the log" /> : null}

      {q.isError ? (
        <ErrorNote message="The log did not load. Refresh the page; if it fails again, switch roles in the header to sign in as a seeded user." />
      ) : null}

      {!q.isLoading && !q.isError && !groups.length ? (
        <EmptyState
          sentence="Nothing is recorded yet for this filter."
          action={
            <button
              type="button"
              onClick={() => {
                setActor("");
                setPhase("");
              }}
              className="mc-req-button"
            >
              Clear the filters
            </button>
          }
        />
      ) : null}


      {groups.map(([acqId, list]) => (
        <section key={acqId} className="mc-kpanel mb-6">
          <div className="mc-kpanel-head">
            <h2 className="mc-kpanel-title">
              {acqId === "No acquisition" ? acqId : (
                <Link to="/files/$acquisitionId" params={{ acquisitionId: acqId }} className="text-primary underline">{acqId}</Link>
              )}
              <span className="ml-2 font-normal text-muted-foreground" data-numeric>{`${list.length} ${list.length === 1 ? "entry" : "entries"}`}</span>
            </h2>
          </div>
          <div className="mt-4">
            <DataTable label={`Audit log table: ${acqId}`} rowKey={(r) => r.log_id} rows={expanded.has(acqId) ? list : list.slice(0, AUDIT_GROUP_TOP)} columns={[
              { key: "when", header: "When", nowrap: true, cell: (r) => <span data-numeric>{new Date(r.logged_at).toLocaleString()}</span> },
              { key: "actor", header: "Actor", cell: (r) => r.actor ? (() => { const shown = displayActor(r.actor!, aliases); return <>{shown.name}{shown.loginId ? <span className="block text-[13px] text-muted-foreground">Login: {shown.loginId}</span> : null}</>; })() : <EmptyCell /> },
              { key: "action", header: "Action", cell: (r) => <span title={storedAs(r.action, auditActionLabel(r.action))}>{auditActionLabel(r.action) ?? "Not recorded"}</span> },
              { key: "phase", header: "Phase", cell: (r) => <span title={storedAs(r.phase, auditPhaseLabel(r.phase))}>{auditPhaseLabel(r.phase) ?? "Not recorded"}</span> },
              { key: "field", header: "Field", cell: (r) => <span title={storedAs(r.field, auditFieldLabel(r.field))}>{auditFieldLabel(r.field) ?? "Not recorded"}</span> },
              { key: "old", header: "Old", cell: (r) => <span title={storedAs(r.old_value, auditValueLabel(r.action, r.old_value))}>{auditValueLabel(r.action, r.old_value) ?? "Not recorded"}</span> },
              { key: "new", header: "New", cell: (r) => <span title={storedAs(r.new_value, auditValueLabel(r.action, r.new_value))}>{auditValueLabel(r.action, r.new_value) ?? "Not recorded"}</span> },
              { key: "reason", header: "Reason", cell: (r) => <span title={storedAs(r.reason, auditTextLabel(r.reason))}>{auditTextLabel(r.reason) ?? "Not recorded"}</span> },
            ]} />
          </div>
          {list.length > AUDIT_GROUP_TOP ? (
            <div className="mc-kpanel-foot mt-3">
              <button
                type="button"
                className="mc-req-button is-secondary"
                aria-expanded={expanded.has(acqId)}
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(acqId)) next.delete(acqId);
                    else next.add(acqId);
                    return next;
                  })
                }
              >
                {expanded.has(acqId) ? `Show the latest ${AUDIT_GROUP_TOP}` : `Show all ${list.length} entries`}
              </button>
            </div>
          ) : null}
        </section>
      ))}
    </AppShell>
  );
}
