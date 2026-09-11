import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import {
  DEFECT_STATUSES,
  deleteDefect,
  loadDefects,
  setDefectStatus,
  type DefectRow,
  type DefectStatus,
} from "@/lib/template-defects";

export const Route = createFileRoute("/pgpd-queue")({
  head: () => ({
    meta: [
      { title: "PGPD queue — T-Minus" },
      { name: "description", content: "Template defects reported from the forms, for HQ to work with PGPD." },
      { property: "og:title", content: "PGPD queue — T-Minus" },
      { property: "og:description", content: "Reported template defects, their citation, revision, and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PgpdQueuePage,
});

function PgpdQueuePage() {
  const { authState, role, user } = useRole();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"all" | DefectStatus>("all");
  const [message, setMessage] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["template-defects"],
    enabled: authState === "signed-in",
    queryFn: loadDefects,
  });

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["template-defects"] });
  };

  const change = useMutation({
    mutationFn: ({ row, next }: { row: DefectRow; next: DefectStatus }) => setDefectStatus(row, next, user.name),
    onSuccess: () => {
      setMessage("Recorded. The queue is updated.");
      done();
    },
    onError: (e: Error) => setMessage(`The change did not save: ${e.message}. Try again.`),
  });

  const remove = useMutation({
    mutationFn: (row: DefectRow) => deleteDefect(row, user.name),
    onSuccess: () => {
      setMessage("Removed from the queue.");
      done();
    },
    onError: (e: Error) => setMessage(`The item was not removed: ${e.message}. Try again.`),
  });

  if (role !== "hq") {
    return (
      <AppShell>
        <PageHeader
          title="PGPD queue"
          lead="Reported template defects are worked by HQ. Switch to the HQ role to open the queue."
        />
      </AppShell>
    );
  }

  const rows = (q.data ?? []).filter((r) => status === "all" || r.status === status);
  const open = (q.data ?? []).filter((r) => r.status === "open").length;

  return (
    <AppShell>
      <PageHeader
        title="PGPD queue"
        lead="Defects reported from the templates, with the citation, the revision reported against, and who reported it."
      />

      <p className="mb-6 max-w-[80ch] text-[15px] leading-[22px]">
        {(q.data ?? []).length} reported {(q.data ?? []).length === 1 ? "defect" : "defects"}. {open} still open.
      </p>

      <div className="mb-6">
        <label htmlFor="defect-status" className="block text-[13px] text-muted-foreground">
          Status
        </label>
        <select
          id="defect-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "all" | DefectStatus)}
          className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[14px]"
        >
          <option value="all">All statuses</option>
          {DEFECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {message ? <p className="mb-4 text-[13px] text-muted-foreground">{message}</p> : null}

      {q.isLoading ? <LoadingNote /> : null}
      {q.error ? <ErrorNote message="The queue could not be loaded. Reload the page." /> : null}
      {!q.isLoading && !q.error && rows.length === 0 ? (
        <EmptyState sentence="No defects are on the queue. Report one from any template." />
      ) : null}

      {rows.length ? (
        <table className="w-full border border-border text-[13px] leading-[18px]">
          <caption className="sr-only">Reported template defects</caption>
          <thead className="bg-muted/40 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Template</th>
              <th scope="col" className="px-3 py-2 font-medium">Revision</th>
              <th scope="col" className="px-3 py-2 font-medium">Defect</th>
              <th scope="col" className="px-3 py-2 font-medium">Citation</th>
              <th scope="col" className="px-3 py-2 font-medium">Reported by</th>
              <th scope="col" className="px-3 py-2 font-medium">Reported</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Remove</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.defect_id} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <Link
                    to="/documents/$templateKey"
                    params={{ templateKey: r.template_key }}
                    className="text-primary underline"
                  >
                    {r.template_name}
                  </Link>
                  {r.acquisition_id ? (
                    <p className="text-muted-foreground">{r.acquisition_id}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{r.revision ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.defect}
                  {r.correction ? <p className="text-muted-foreground">Correction: {r.correction}</p> : null}
                </td>
                <td className="px-3 py-2">{r.citation ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.reporter_name}
                  <p className="text-muted-foreground">{r.reporter_role ?? ""}</p>
                </td>
                <td className="px-3 py-2 tabular-nums">{r.reported_at.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <label className="sr-only" htmlFor={`status-${r.defect_id}`}>
                    Status for {r.template_name}
                  </label>
                  <select
                    id={`status-${r.defect_id}`}
                    value={DEFECT_STATUSES.includes(r.status as DefectStatus) ? r.status : "open"}
                    onChange={(e) => change.mutate({ row: r, next: e.target.value as DefectStatus })}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-[13px]"
                  >
                    {DEFECT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => remove.mutate(r)}
                    className="rounded-lg border border-border px-2 py-1 text-[13px]"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </AppShell>
  );
}
