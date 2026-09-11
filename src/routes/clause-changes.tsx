import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
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
      { title: "Clause change impact — T-Minus" },
      {
        name: "description",
        content:
          "Every launched or active contract touched by a clause change, its deadline, its mod task, and the SF 30 handoff packet.",
      },
      { property: "og:title", content: "Clause change impact — T-Minus" },
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
  const { authState, user, role } = useRole();
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

  const rows = useMemo(
    () =>
      change ? impactedContracts(change, contractsQ.data ?? [], tasksQ.data ?? []) : ([] as ImpactRow[]),
    [change, contractsQ.data, tasksQ.data],
  );

  const canWrite = role === "specialist" || role === "hq";

  const setDirection = useMutation({
    mutationFn: async (input: { required: boolean; deadline: string | null }) => {
      if (!change || role !== "hq") return;
      const id = change.id.replace(/^watch:/, "");
      const query = change.id.startsWith("watch:")
        ? supabase.from("watch_items").update({ modification_required: input.required, change_deadline: input.deadline }).eq("item_id", id)
        : supabase.from("clauses").update({ modification_required: input.required, change_deadline: input.deadline }).eq("row_id", id);
      const { error } = await query;
      if (error) throw error;
      await supabase.from("audit_log").insert({
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
    <AppShell>
      <PageHeader
        title="Clause change impact"
        lead="Under RFO FAR 1.107(d), incorporating a changed clause into an existing contract is generally discretionary and needs consideration unless the change direction says otherwise. This list shows candidates; the direction decides."
      />

      {loading ? <LoadingNote what="the clause changes" /> : null}
      {failed ? <ErrorNote message="The list did not load. Reload the page and try again." /> : null}

      {changes.length > 0 ? (
        <section aria-label="Clause change" className="mb-8 max-w-[80ch]">
          <label htmlFor="cc-change" className="block text-[13px] text-muted-foreground">
            Clause change
          </label>
          <select
            id="cc-change"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
            value={change?.id ?? ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setMessage(null);
            }}
          >
            {changes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clause_number} — {KIND_WORD[c.kind] ?? c.kind} ({c.source})
              </option>
            ))}
          </select>

          {change ? (
            <><dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-muted-foreground">Status recorded</dt>
                <dd className="text-[15px]">{change.status}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted-foreground">Source</dt>
                <dd className="text-[15px]">{change.source}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted-foreground">Deadline the change sets</dt>
                <dd className="text-[15px]" data-numeric>
                  {deadline.date ?? "No date set by the change"}
                  {deadline.overdue ? " — already due" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted-foreground">Contracts affected</dt>
                <dd className="text-[15px]" data-numeric>
                  {rows.filter((row) => row.clauseListKnown).length} affected · {rows.filter((row) => !row.clauseListKnown).length} unverified
                </dd>
              </div>
            </dl>
            {role === "hq" ? (
              <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-border pt-4">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={change.modification_required}
                    onChange={(event) => setDirection.mutate({ required: event.target.checked, deadline: change.change_deadline })}
                  />
                  Direction requires existing contracts to be modified
                </label>
                <label className="text-[13px]">
                  <span className="block text-muted-foreground">Direction deadline</span>
                  <input
                    type="date"
                    value={change.change_deadline ?? ""}
                    onChange={(event) => setDirection.mutate({ required: change.modification_required, deadline: event.target.value || null })}
                    className="mt-1 rounded-lg border border-border bg-background px-3 py-2"
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
          className="mb-6 rounded-lg border border-border px-3 py-2 text-[15px] text-primary"
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
        <table className="w-full border-collapse text-[13px] leading-[18px]">
          <caption className="sr-only">
            Contracts affected by {change?.clause_number}, sorted by months of performance remaining
          </caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-3 font-medium">
                File
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Center
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Months remaining
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Why it is listed
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Mod task
              </th>
              <th scope="col" className="py-2 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.acquisition_id} className="border-b border-border align-top">
                <td className="py-2 pr-3">
                  <Link to="/files/$acquisitionId" params={{ acquisitionId: r.acquisition_id }} className="text-primary">
                    {r.acquisition_id}
                  </Link>
                  <span className="block text-muted-foreground">{r.title ?? "No title recorded"}</span>
                  <span className="block text-muted-foreground">
                    {r.contract_number ?? "No contract number recorded"} · {r.clock_state ?? "state not recorded"}
                  </span>
                </td>
                <td className="py-2 pr-3">{r.center_code ?? "Unassigned"}</td>
                <td className="py-2 pr-3" data-numeric>
                  {r.monthsRemaining === null
                    ? "End date not recorded"
                    : r.monthsRemaining < 0
                      ? `${Math.abs(r.monthsRemaining)} months past end`
                      : `${r.monthsRemaining} months`}
                </td>
                 <td className="py-2 pr-3 max-w-[36ch]"><span className="font-medium">{r.label}</span><span className="block text-muted-foreground">{r.reason}</span></td>
                <td className="py-2 pr-3">
                  {r.task ? (
                    <>
                      <span>{r.task.status === "complete" ? "Complete" : "Open"}</span>
                      <span className="block text-muted-foreground">
                        {r.task.owner_name ?? "Owner not recorded"} · due {r.task.deadline_date ?? "no date"}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not created</span>
                  )}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => void downloadPacket(r)}
                  >
                    SF 30 handoff packet
                  </button>
                  {canWrite && r.task && r.task.status !== "complete" ? (
                    <button
                      type="button"
                      className="mt-2 block text-primary underline"
                      onClick={() => complete.mutate(r)}
                      disabled={complete.isPending}
                    >
                      Mark the mod complete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <h2 className="mt-10 text-[18px] leading-6 font-medium">Mods done against mods due, by Center</h2>
      {counts.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No mod task has been created yet.</p>
      ) : (
        <ul className="mt-3 max-w-[70ch] space-y-1 border-t border-border pt-3">
          {counts.map((c) => (
            <li key={c.center} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[13px] leading-[18px]">
              <span>{c.center}</span>
              <span data-numeric>
                {c.done} done of {c.due} due
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 max-w-[80ch] text-[13px] text-muted-foreground">
        NCMS writes the modification of record (NFS CG 1804.11). The packet here is a handoff showing the clause delta.
      </p>
    </AppShell>
  );
}
