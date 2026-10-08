import { writeAudit } from "@/lib/audit";
import { useCanWrite } from "@/lib/use-can-write";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { DataTable, McPageHeader, StatusChip } from "@/components/ui-mc";
import { useRole } from "@/components/role-context";
import {
  completeModTask,
  createModTasks,
  deadlineFor,
  impactedContracts,
  loadClauseChanges,
  loadContracts,
  loadModTasks,
  modsByCenter,
  sf30PacketFor,
  type ClauseChange,
  type ImpactRow,
} from "@/lib/clause-impact";

export const Route = createFileRoute("/clause-changes")({
  head: () => ({
    meta: [
      { title: "Clause change impact · T-Minus" },
      {
        name: "description",
        content:
          "Every launched or active contract touched by a clause change, its deadline, its mod task, and the SF 30 handoff packet.",
      },
      { property: "og:title", content: "Clause change impact · T-Minus" },
      {
        property: "og:description",
        content: "Contracts affected by a clause change, sorted by months of performance remaining.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClauseChangesPage,
});

const KIND_WORD: Record<string, string> = {
  removed: "Removed",
  moved: "Moved or renumbered",
  updated: "Updated",
  required: "Newly required",
};

function ClauseChangesPage() {
  const { authState, user, hasRole, readOnly } = useRole();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const changesQ = useQuery({
    queryKey: ["clause-changes"],
    enabled: authState === "signed-in",
    queryFn: loadClauseChanges,
  });
  const contractsQ = useQuery({
    queryKey: ["clause-change-contracts"],
    enabled: authState === "signed-in",
    queryFn: loadContracts,
  });
  const tasksQ = useQuery({
    queryKey: ["clause-mod-tasks"],
    enabled: authState === "signed-in",
    queryFn: loadModTasks,
  });

  const changes = changesQ.data ?? [];
  const change: ClauseChange | null =
    changes.find((c) => c.id === selected) ?? changes[0] ?? null;

  const allRows = useMemo(
    () =>
      change ? impactedContracts(change, contractsQ.data ?? [], tasksQ.data ?? []) : ([] as ImpactRow[]),
    [change, contractsQ.data, tasksQ.data],
  );
  // Only a file with a recorded contract number is a contract that can be modified.
  const rows = useMemo(() => allRows.filter((r) => r.hasContract), [allRows]);
  const solicitationRows = useMemo(() => allRows.filter((r) => !r.hasContract), [allRows]);

  const canWrite = useCanWrite();

  const setDirection = useMutation({
    mutationFn: async (input: { required: boolean; deadline: string | null }) => {
      if (!change || !hasRole("hq") || readOnly) return;
      const id = change.id.replace(/^watch:/, "");
      const query = change.id.startsWith("watch:")
        ? supabase.from("watch_items").update({ modification_required: input.required, change_deadline: input.deadline }).eq("item_id", id)
        : supabase.from("clauses").update({ modification_required: input.required, change_deadline: input.deadline }).eq("row_id", id);
      const { error } = await query;
      if (error) throw error;
      await writeAudit({
        acquisition_id: null,
        actor: user.name,
        action: "Clause change direction recorded",
        field: change.clause_number,
        old_value: change.modification_required ? "Modification required" : "Candidate review",
        new_value: input.required ? "Modification required" : "Candidate review",
        reason: input.deadline ? `Direction deadline ${input.deadline}` : "No deadline set by the direction",
        phase: "Administration",
      } as never);
    },
    onSuccess: async () => {
      setMessage("The change direction is recorded.");
      await qc.invalidateQueries({ queryKey: ["clause-changes"] });
    },
    onError: () => setMessage("The change direction did not save. Reload the page and try again."),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!change) return 0;
      return createModTasks(change, rows, user.name);
    },
    onSuccess: async (n) => {
      setMessage(
        n === 0 ? "Every affected file already has a mod task." : `${n} mod ${n === 1 ? "task" : "tasks"} created.`,
      );
      await qc.invalidateQueries({ queryKey: ["clause-mod-tasks"] });
    },
    onError: () => setMessage("The mod tasks were not created. Reload the page and try again."),
  });

  const complete = useMutation({
    mutationFn: async (row: ImpactRow) => {
      if (!row.task) return;
      await completeModTask(row.task, user.name);
    },
    onSuccess: async () => {
      setMessage("Mod task marked complete.");
      await qc.invalidateQueries({ queryKey: ["clause-mod-tasks"] });
    },
    onError: () => setMessage("The task did not update. Reload the page and try again."),
  });

  async function downloadPacket(row: ImpactRow) {
    if (!change) return;
    const packet = await sf30PacketFor(change, row);
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sf30-handoff-${row.acquisition_id}-${change.clause_number}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const deadline = change ? deadlineFor(change) : { date: null, overdue: false };
  const counts = modsByCenter(tasksQ.data ?? []);
  const loading = changesQ.isLoading || contractsQ.isLoading || tasksQ.isLoading;
  const failed = changesQ.error || contractsQ.error || tasksQ.error;

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Oversight"
        title="Clause change impact"
        lead="Under RFO FAR 1.107(d), incorporating a changed clause into an existing contract is generally discretionary and needs consideration unless the change direction says otherwise. This list shows candidates; the direction decides."
      />

      {loading ? <LoadingNote what="the clause changes" /> : null}
      {failed ? <ErrorNote message="The list did not load. Reload the page and try again." /> : null}

      {changes.length > 0 ? (
        <section aria-label="Clause change" className="mc-kpanel mb-6">
          <label htmlFor="cc-change" className="mc-pa-label">Clause change</label>
          <select
            id="cc-change"
            className="mc-pa-input max-w-[44rem]"
            value={change?.id ?? ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setMessage(null);
            }}
          >
            {changes.map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.clause_number}: ${KIND_WORD[c.kind] ?? c.kind} (${c.source})`}
              </option>
            ))}
          </select>

          {change ? (
            <><dl className="mc-pa-facts mt-4">
              <div><dt>Status recorded</dt><dd>{change.status}</dd></div>
              <div><dt>Source</dt><dd>{change.source}</dd></div>
              <div><dt>Deadline the change sets</dt><dd data-numeric>{deadline.date ?? "No date set by the change"}{deadline.overdue ? "; already due" : ""}</dd></div>
              <div><dt>Contracts affected</dt><dd data-numeric>{rows.filter((row) => row.clauseListKnown).length} affected · {rows.filter((row) => !row.clauseListKnown).length} unverified · {solicitationRows.length} solicitations to re-check</dd></div>
            </dl>
            {hasRole("hq") && !readOnly ? (
              <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-border pt-4">
                <label className="flex items-center gap-2 text-[15px]">
                  <input
                    type="checkbox"
                    checked={change.modification_required}
                    onChange={(event) => setDirection.mutate({ required: event.target.checked, deadline: change.change_deadline })}
                  />
                  Direction requires existing contracts to be modified
                </label>
                <label className="mc-pa-label">
                  Direction deadline
                  <input
                    type="date"
                    value={change.change_deadline ?? ""}
                    onChange={(event) => setDirection.mutate({ required: change.modification_required, deadline: event.target.value || null })}
                    className="mc-pa-input max-w-[14rem]"
                  />
                </label>
              </div>
            ) : null}</>
          ) : null}
        </section>
      ) : null}

      {message ? (
        <p className="mb-6 text-[15px]" role="status">
          {message}
        </p>
      ) : null}

      {canWrite && change?.modification_required && rows.some((row) => row.clauseListKnown) ? (
        <button
          type="button"
          className="mc-req-button mb-6"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          Create mod tasks on every affected file
        </button>
      ) : null}

      {change && rows.length === 0 && !loading ? (
        <EmptyState
          sentence="No launched or active contract is affected by this clause change."
          action={
            <Link to="/files" className="text-primary">
              Open Files
            </Link>
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <section className="mc-kpanel mb-6">
          <div className="mc-kpanel-head"><div>
            <h2 className="mc-kpanel-title">Affected contracts</h2>
            <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground" data-numeric>{`Contracts affected by ${change?.clause_number}, sorted by months of performance remaining.`}</p>
          </div></div>
          <div className="mt-4">
            <DataTable label={`Contracts affected by ${change?.clause_number}, sorted by months of performance remaining`} caption={`Contracts affected by ${change?.clause_number}, sorted by months of performance remaining`} rowKey={(r) => r.acquisition_id} rows={rows} columns={[
              { key: "file", header: "File", rowHeader: true, cell: (r) => (<>
                <Link to="/files/$acquisitionId" params={{ acquisitionId: r.acquisition_id }} className="text-primary underline">{r.acquisition_id}</Link>
                <span className="block text-muted-foreground">{r.title ?? "No title recorded"}</span>
                <span className="block text-muted-foreground">{r.contract_number ?? "No contract number recorded"} · {r.clock_state ?? "state not recorded"}</span>
              </>) },
              { key: "center", header: "Center", cell: (r) => r.center_code ?? "Unassigned" },
              { key: "months", header: "Months remaining", numeric: true, nowrap: true, cell: (r) => <span data-numeric>{r.monthsRemaining === null ? "End date not recorded" : r.monthsRemaining < 0 ? `${Math.abs(r.monthsRemaining)} months past end` : `${r.monthsRemaining} months`}</span> },
              { key: "why", header: "Why it is listed", cell: (r) => <><span className="font-medium">{r.label}</span><span className="block text-muted-foreground">{r.reason}</span></> },
              { key: "task", header: "Mod task", cell: (r) => r.task ? <><StatusChip tone={r.task.status === "complete" ? "ontrack" : "attention"} label={r.task.status === "complete" ? "Complete" : "Open"} /><span className="mt-1 block text-muted-foreground">{r.task.owner_name ?? "Owner not recorded"} · due {r.task.deadline_date ?? "no date"}</span></> : <span className="text-muted-foreground">Not created</span> },
              { key: "actions", header: "Actions", cell: (r) => <>
                <button type="button" className="text-primary underline" onClick={() => void downloadPacket(r)}>SF 30 handoff packet</button>
                {canWrite && r.task && r.task.status !== "complete" ? <button type="button" className="mt-2 block text-primary underline" onClick={() => complete.mutate(r)} disabled={complete.isPending}>Mark the mod complete</button> : null}
              </> },
            ]} />
          </div>
        </section>
      ) : null}



      {solicitationRows.length > 0 ? (
        <section className="mc-kpanel mb-6" id="clause-solicitations">
          <div className="mc-kpanel-head"><div>
            <h2 className="mc-kpanel-title">Solicitations to re-check</h2>
            <p className="mt-1 max-w-[80ch] text-[15px] leading-[22px] text-muted-foreground">These files have no contract number yet, so there is nothing to modify. Re-check the clause in the solicitation before award.</p>
          </div></div>
          <div className="mt-4">
            <DataTable label="Solicitations to re-check" rowKey={(r) => r.acquisition_id} rows={solicitationRows} columns={[
              { key: "file", header: "File", rowHeader: true, nowrap: true, cell: (r) => <Link to="/files/$acquisitionId" params={{ acquisitionId: r.acquisition_id }} className="text-primary underline">{r.acquisition_id}</Link> },
              { key: "title", header: "Title", cell: (r) => r.title ?? "No title recorded" },
              { key: "center", header: "Center", cell: (r) => r.center_code ?? "Unassigned" },
              { key: "why", header: "Why it is listed", cell: (r) => <><span className="font-medium">{r.label}</span><span className="block text-muted-foreground">{r.reason}</span></> },
            ]} />
          </div>
        </section>
      ) : null}

      <section className="mc-kpanel" id="clause-support">
        <div className="mc-kpanel-head"><div>
          <h2 className="mc-kpanel-title">Mods done against mods due, by Center</h2>
        </div></div>
        <div className="mt-4">
          <DataTable label="Mods done against mods due, by Center" empty={<p className="text-muted-foreground">No mod task has been created yet.</p>} rowKey={(c) => c.center} rows={counts} columns={[
            { key: "center", header: "Center", rowHeader: true, cell: (c) => c.center },
            { key: "done", header: "Done", numeric: true, cell: (c) => <span data-numeric>{c.done}</span> },
            { key: "due", header: "Due", numeric: true, cell: (c) => <span data-numeric>{c.due}</span> },
          ]} />
        </div>
        <p className="mc-kpanel-foot mt-3 max-w-[80ch] text-[15px] leading-[22px] text-muted-foreground">
          NCMS writes the modification of record (NFS CG 1804.11(b)). The packet here is a handoff showing the clause delta.
        </p>
      </section>
    </AppShell>
  );
}
