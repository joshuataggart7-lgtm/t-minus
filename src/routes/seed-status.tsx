import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { resetDemo } from "@/lib/reset-demo.functions";

const TABLES = [
  "users",
  "centers",
  "branches",
  "missions",
  "acquisition_facts",
  "thresholds",
  "phase_plan",
  "review_rules",
  "enterprise_strategies",
  "regulatory_refs",
  "templates",
  "clauses",
  "clause_matrix_2603b",
  "nfs_clause_matrix",
  "nf1707_fields",
  "polls",
  "documents",
  "sam_checks",
  "audit_log",
  "comments",
  "announcements",
  "watch_items",
];

async function countRows() {
  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await (supabase as never as {
        from: (t: string) => { select: (s: string, o: { count: "exact"; head: boolean }) => Promise<{ count: number | null; error: { message: string } | null }> };
      })
        .from(table)
        .select("*", { count: "exact", head: true });
      return { table, count: count ?? 0, error: error?.message ?? null };
    }),
  );
  return results;
}

export const Route = createFileRoute("/seed-status")({
  head: () => ({
    meta: [
      { title: "Seed status — T-Minus" },
      { name: "description", content: "Row counts for every seeded table in the T-Minus prototype." },
      { property: "og:title", content: "Seed status — T-Minus" },
      {
        property: "og:description",
        content: "Row counts for every seeded table in the T-Minus prototype.",
      },
    ],
  }),
  component: SeedStatus,
});

function SeedStatus() {
  const { authState, role } = useRole();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const runReset = useServerFn(resetDemo);

  const { data, isLoading } = useQuery({
    queryKey: ["seed-status"],
    queryFn: countRows,
    enabled: authState === "signed-in",
  });

  const lastReset = useQuery({
    queryKey: ["seed-status", "last-reset"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("audit_log")
        .select("logged_at")
        .eq("action", "Demo reset")
        .order("logged_at", { ascending: false })
        .limit(1);
      return rows?.[0]?.logged_at ?? null;
    },
  });

  const reset = useMutation({
    mutationFn: async () => await runReset({ data: undefined }),
    onSuccess: async () => {
      setConfirming(false);
      setMessage("The demo is back in its seeded state.");
      await queryClient.invalidateQueries();
    },
    onError: (e: unknown) => {
      setConfirming(false);
      setMessage(
        e instanceof Error
          ? `The reset did not finish: ${e.message} Try again, or reload the page.`
          : "The reset did not finish. Try again, or reload the page.",
      );
    },
  });

  return (
    <AppShell>
      <PageHeader title="Seed status" lead="Row counts for every table the seed script loads." />

      {authState === "signed-in" && role === "hq" ? (
        <section aria-label="Reset demo" className="mb-8 max-w-[640px] border border-border bg-background p-4">
          <h2 className="text-[18px] leading-6 font-medium">Reset demo</h2>
          <p className="mt-1 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">
            Reloads every seed file as written, clears the history, polls, comments, documents, checks
            and acknowledgements recorded since the seed, and removes any acquisition that is not one of
            the twelve seeded records.
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Last reset:{" "}
            <span data-numeric>
              {lastReset.data ? new Date(lastReset.data).toLocaleString() : "not reset yet"}
            </span>
          </p>
          {confirming ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-[15px]">This replaces all demo activity. Continue?</p>
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-[15px] text-primary-foreground"
                style={{ background: "var(--atrisk)" }}
                disabled={reset.isPending}
                onClick={() => reset.mutate()}
              >
                {reset.isPending ? "Resetting" : "Yes, reset demo"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-[15px]"
                onClick={() => setConfirming(false)}
                disabled={reset.isPending}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mt-4 rounded-lg border border-border px-3 py-2 text-[15px] text-primary"
              onClick={() => {
                setMessage(null);
                setConfirming(true);
              }}
            >
              Reset demo
            </button>
          )}
          {message ? (
            <p role="status" className="mt-3 text-[15px]">
              {message}
            </p>
          ) : null}
        </section>
      ) : null}

      {authState !== "signed-in" ? (
        <p className="text-muted-foreground">Waiting for sign-in.</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">Counting rows.</p>
      ) : (
        <table className="w-full max-w-[640px] border border-border bg-background text-[13px] leading-[18px]">
          <caption className="sr-only">Seeded table row counts</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-4 py-2 font-medium">
                Table
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Rows
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                State
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.table} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{r.table}</td>
                <td className="px-4 py-2 text-right" data-numeric>
                  {r.error ? "—" : r.count}
                </td>
                <td className="px-4 py-2">
                  {r.error ? (
                    <span style={{ color: "var(--atrisk)" }}>Not created</span>
                  ) : r.count > 0 ? (
                    <span style={{ color: "var(--ontrack)" }}>Loaded</span>
                  ) : (
                    <span style={{ color: "var(--attention)" }}>Empty</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
