import { writeAudit } from "@/lib/audit";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { DataTable, McPageHeader, StatusChip } from "@/components/ui-mc";
import { executiveBlocker } from "@/lib/executive-wording";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import {
  agingItems,
  digestBySupervisor,
  DEFAULT_AGING_DAYS,
  type CenterRow,
  type UserRow,
} from "@/lib/aging";
import type { AcqRow, PollRow } from "@/lib/launch-sequence";
import { withResolvedHolds } from "@/lib/hold";
import { LockHint } from "@/components/demo-lock";

export const Route = createFileRoute("/escalations")({
  head: () => ({
    meta: [
      { title: "Aging holds and escalation · T-Minus" },
      {
        name: "description",
        content: "Holds and pending review requests past the Center's aging threshold, gathered for each supervisor.",
      },
      { property: "og:title", content: "Aging holds and escalation · T-Minus" },
      {
        property: "og:description",
        content: "Every aging hold and pending review request, its age in days, its owner, and the supervisor it escalates to.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EscalationsPage,
});

function EscalationsPage() {
  const { authState, user, hasRole, readOnly } = useRole();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  // Aging first: items still inside their Center window stay one click away.
  const [showWithin, setShowWithin] = useState(false);
  const canConfigure = hasRole("hq") && !readOnly;
  // Demo HQ sees the dimmed input (HQ can change it); other roles read text.
  const showInput = hasRole("hq");

  const q = useQuery({
    queryKey: ["aging-escalations"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [acqs, polls, centers, users] = await Promise.all([
        supabase.from("acquisition_facts").select("*"),
        supabase.from("polls").select("*"),
        supabase.from("centers").select("center_code,center_name,aging_threshold_days").order("center_code"),
        supabase.from("users").select("name,role,title,center_code,supervisor_name,supervisor_email"),
      ]);
      const [plan, attachments] = await Promise.all([
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("document_attachments").select("acquisition_id,doc_key"),
      ]);
      const [documents, templateRows] = await Promise.all([
        supabase.from("documents").select("acquisition_id,template_id"),
        supabase.from("templates").select("template_id,name"),
      ]);
      // The hold shown here is recomputed from the record and the stored files,
      // so this page, the work queue and the file header read the same cause.
      const rows = withResolvedHolds(
        (acqs.data ?? []) as unknown as AcqRow[],
        (plan.data ?? []) as never,
        attachments.data ?? [],
        documents.data ?? [],
        templateRows.data ?? [],
      );
      return {
        acqs: rows,
        polls: (polls.data ?? []) as unknown as PollRow[],
        centers: (centers.data ?? []) as unknown as CenterRow[],
        users: (users.data ?? []) as unknown as UserRow[],
      };
    },
  });

  const items = useMemo(
    () => agingItems(q.data?.acqs ?? [], q.data?.polls ?? [], q.data?.centers ?? [], q.data?.users ?? []),
    [q.data],
  );
  const digest = useMemo(() => digestBySupervisor(items), [items]);

  const setThreshold = useMutation({
    mutationFn: async ({ centerCode, days }: { centerCode: string; days: number }) => {
      const { error } = await supabase
        .from("centers")
        .update({ aging_threshold_days: days } as never)
        .eq("center_code", centerCode);
      if (error) throw error;
      await writeAudit({
        acquisition_id: null,
        actor: user.name,
        action: "Aging threshold changed",
        field: "aging_threshold_days",
        old_value: null,
        new_value: `${centerCode}: ${days} days`,
        reason: "Center policy",
        phase: null,
      } as never);
    },
    onSuccess: () => {
      setBanner("The aging threshold is saved. Center policy sets this number.");
      void qc.invalidateQueries({ queryKey: ["aging-escalations"] });
    },
    onError: (e: Error) => setBanner(`That number did not save: ${e.message}. Try again.`),
  });

  const agingCount = items.filter((item) => item.aging).length;
  const shownItems = showWithin ? items : items.filter((item) => item.aging);
  // Oldest first, so the longest wait leads the list.
  const sortedItems = [...shownItems].sort((a, b) => Number(b.aging) - Number(a.aging) || b.ageDays - a.ageDays);

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Oversight"
        title="Aging holds and escalation"
        lead="Every hold and every pending review request carries an age in days. Past the number of days the Center sets, the item is aging and appears in the digest for the owner's supervisor."
      />
      {banner ? (
        <p role="status" className="mb-4 max-w-[70ch] text-[15px]">
          {banner}
        </p>
      ) : null}

      {q.isLoading ? <LoadingNote what="the aging holds and reviews" /> : null}
      {q.isError ? <ErrorNote message="The aging items did not load. Refresh the page to try again." /> : null}

      {q.data ? (
        <div className="mc-pa-stack">
          <div className="mc-pa-stats">
            <div className={agingCount ? "is-attention" : "is-ontrack"}><strong data-numeric>{agingCount}</strong><span>Aging past the Center window</span></div>
            <div><strong data-numeric>{items.length - agingCount}</strong><span>Open, still within the window</span></div>
            <div className="is-info"><strong data-numeric>{digest.length}</strong><span>Supervisors with a digest entry</span></div>
          </div>

          <section className="mc-kpanel">
            <div className="mc-kpanel-head">
              <div>
                <h2 className="mc-kpanel-title">{showWithin ? "Open holds and pending reviews" : "Aging holds and pending reviews"}</h2>
                <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground">{showWithin ? "Every open item, aging first, oldest first." : "Only the items past their Center window, oldest first."}</p>
              </div>
              {items.length > agingCount ? (
                <button type="button" className="mc-req-button is-secondary" aria-pressed={showWithin} onClick={() => setShowWithin((value) => !value)}>
                  {showWithin ? "Show aging only" : `Show all ${items.length} open items`}
                </button>
              ) : null}
            </div>
            <div className="mt-4">
              {items.length === 0 ? (
                <EmptyState sentence="No file is on hold and no review is waiting on a decision." />
              ) : (
                <DataTable label="Open holds and pending reviews" empty={<p className="text-muted-foreground">Nothing is past its Center window. Show all open items to see the rest.</p>}
                  rowKey={(item, i) => `${item.kind}-${item.acquisitionId}-${i}`} rows={sortedItems} columns={[
                    { key: "id", header: "Acquisition", rowHeader: true, nowrap: true, cell: (item) => <Link to="/files/$acquisitionId" params={{ acquisitionId: item.acquisitionId }}>{item.acquisitionId}</Link> },
                    { key: "center", header: "Center", cell: (item) => item.centerCode },
                    { key: "subject", header: "Waiting on", cell: (item) => <>{executiveBlocker(item.subject)}{item.alsoRecorded ? <span className="mt-1 block text-[13px] text-muted-foreground">{item.alsoRecorded}</span> : null}</> },
                    { key: "owner", header: "Owner", cell: (item) => item.owner },
                    { key: "age", header: "Age", numeric: true, nowrap: true, cell: (item) => <span data-numeric>{item.ageDays} days</span> },
                    { key: "after", header: "Aging after", numeric: true, nowrap: true, cell: (item) => <span data-numeric>{item.thresholdDays} days</span> },
                    { key: "standing", header: "Standing", cell: (item) => item.aging ? <StatusChip tone="attention" label="Aging" /> : <StatusChip tone="ontrack" label="Within the Center window" /> },
                  ]} />
              )}
            </div>
          </section>

          <section className="mc-kpanel">
            <div className="mc-kpanel-head"><div>
              <h2 className="mc-kpanel-title">Supervisor digest</h2>
              <p className="mt-1 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">One entry per aging item, gathered for the supervisor recorded on the owner's user record.</p>
            </div></div>
            {digest.length === 0 ? (
              <p className="mt-4 text-muted-foreground">Nothing is aging, so no digest entry has been raised.</p>
            ) : (
              digest.map((group) => (
                <div key={group.supervisor} className="mc-pa-card mt-4">
                  <h3 className="mc-pa-card-title">
                    {group.supervisor}
                    {group.supervisorEmail ? <span className="font-normal text-muted-foreground">{` · ${group.supervisorEmail}`}</span> : null}
                  </h3>
                  <ul className="mt-2 space-y-1 text-[15px] leading-[22px]">
                    {group.items.map((item, i) => (
                      <li key={`${item.acquisitionId}-${i}`} data-numeric>
                        {item.acquisitionId}: {executiveBlocker(item.subject)}, {item.ageDays} days with {item.owner}
                        {item.phase ? ` at ${item.phase}` : ""}
                        {item.alsoRecorded ? <span className="block text-muted-foreground">{item.alsoRecorded}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          <section className="mc-kpanel">
            <div className="mc-kpanel-head"><div>
              <h2 className="mc-kpanel-title">Aging threshold by Center</h2>
              <p className="mt-1 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">Center policy sets the number of days. The default is {DEFAULT_AGING_DAYS} days.</p>
            </div></div>
            <div className="mt-4 max-w-[720px]">
              <DataTable label="Aging threshold by Center" rowKey={(c) => c.center_code} rows={q.data.centers ?? []} columns={[
                { key: "center", header: "Center", rowHeader: true, cell: (c) => `${c.center_code} · ${c.center_name}` },
                { key: "after", header: "Aging after", cell: (c) => showInput ? (
                  <>
                    <label className="sr-only" htmlFor={`aging-${c.center_code}`}>Aging threshold in days for {c.center_code}</label>
                    <input
                      id={`aging-${c.center_code}`}
                      type="number"
                      min={0}
                      max={90}
                      className="mc-pa-input !mt-0 w-24"
                      defaultValue={c.aging_threshold_days ?? DEFAULT_AGING_DAYS}
                      disabled={!canConfigure}
                      onBlur={(e) => setThreshold.mutate({ centerCode: c.center_code, days: Number(e.target.value || 0) })}
                    />
                  </>
                ) : (
                  <span className="tabular-nums" data-numeric>{c.aging_threshold_days ?? DEFAULT_AGING_DAYS} days</span>
                ) },
              ]} />
            </div>
            {showInput && readOnly ? <LockHint className="mt-2" /> : null}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
