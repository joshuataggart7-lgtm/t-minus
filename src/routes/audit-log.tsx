import { formatStamp } from "@/lib/metrics";
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

const AUDIT_LOG_PAGE = 1000;

/** Each file's timeline opens on its latest entries; the rest are one click away. */
const AUDIT_GROUP_TOP = 10;

function AuditLogPage() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const { authState } = useRole();
  const [actor, setActor] = useState("");
  const [phase, setPhase] = useState("");

  // Audit LA13: the page loads the newest AUDIT_LOG_PAGE rows; say so when
  // more exist instead of presenting the cap as the total.
  const totalQ = useQuery({
    queryKey: ["audit-log-total"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { count } = await supabase.from("audit_log").select("*", { count: "exact", head: true });
      return count ?? null;
    },
  });

  const q = useQuery({
    queryKey: ["audit-log"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(AUDIT_LOG_PAGE);
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

  // Every distinct actor and phase on record, read past the newest page, so the
  // filter lists and counts cover the whole log, not only the rows on screen.
  const facetsQ = useQuery({
    queryKey: ["audit-log-facets"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const actorsSeen = new Set<string>();
      const phasesSeen = new Set<string>();
      for (let from = 0; from < 1_000_000; ) {
        const { data, error } = await supabase
          .from("audit_log")
          .select("log_id,actor,phase")
          .order("log_id", { ascending: true })
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as { actor: string | null; phase: string | null }[];
        for (const r of page) {
          if (r.actor) actorsSeen.add(r.actor);
          if (r.phase) phasesSeen.add(r.phase);
        }
        if (page.length === 0) break;
        from += page.length;
      }
      return { actors: [...actorsSeen], phases: [...phasesSeen] };
    },
  });
  const rawActors = useMemo(() => facetsQ.data?.actors ?? rows.map((r) => r.actor).filter((a): a is string => !!a), [facetsQ.data, rows]);
  const rawPhases = useMemo(() => facetsQ.data?.phases ?? rows.map((r) => r.phase).filter((p): p is string => !!p), [facetsQ.data, rows]);
  const actors = useMemo(
    () => Array.from(new Set(rawActors.map((a) => displayActor(a, aliases).name))).sort(),
    [rawActors, aliases],
  );
  const phases = useMemo(
    () => Array.from(new Set(rawPhases.map((p) => auditPhaseLabel(p)).filter((p): p is string => !!p))).sort(),
    [rawPhases],
  );

  // A filter runs on the server: the stored values behind the chosen name or
  // phase, an exact count of every matching row, and the newest matching page.
  const actorValues = useMemo(
    () => (actor ? rawActors.filter((a) => displayActor(a, aliases).name === actor) : []),
    [actor, rawActors, aliases],
  );
  const phaseValues = useMemo(
    () => (phase ? rawPhases.filter((p) => auditPhaseLabel(p) === phase) : []),
    [phase, rawPhases],
  );
  const filtering = Boolean(actor || phase);
  const filteredQ = useQuery({
    queryKey: ["audit-log-filtered", actorValues.join("|"), phaseValues.join("|")],
    enabled: authState === "signed-in" && filtering,
    queryFn: async () => {
      if ((actor && !actorValues.length) || (phase && !phaseValues.length)) return { rows: [] as LogRow[], count: 0 };
      let query = supabase.from("audit_log").select("*", { count: "exact" });
      if (actor) query = query.in("actor", actorValues);
      if (phase) query = query.in("phase", phaseValues);
      const { data, error, count } = await query
        .order("logged_at", { ascending: false })
        .limit(AUDIT_LOG_PAGE);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as LogRow[], count: count ?? null };
    },
  });

  const filtered = useMemo(
    () => (filtering ? filteredQ.data?.rows ?? [] : rows),
    [filtering, filteredQ.data, rows],
  );
  const filteredTotal = filtering ? filteredQ.data?.count ?? null : null;

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
          <div className="is-info"><strong data-numeric>{filtering && filteredTotal !== null ? filteredTotal : filtered.length}</strong><span>{(filtering && filteredTotal !== null ? filteredTotal : filtered.length) === 1 ? "Entry" : "Entries"}{filtering ? (filteredTotal !== null && filteredTotal > filtered.length ? ` for this filter, the newest ${filtered.length.toLocaleString("en-US")} shown` : " for this filter") : totalQ.data != null && totalQ.data > (q.data?.length ?? 0) ? ` shown, the newest of ${totalQ.data.toLocaleString("en-US")} recorded` : " recorded"}</span></div>
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

      {!q.isLoading && !q.isError && !(filtering && filteredQ.isLoading) && !groups.length ? (
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
              { key: "when", header: "When", nowrap: true, cell: (r) => <span data-numeric>{formatStamp(r.logged_at)}</span> },
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
