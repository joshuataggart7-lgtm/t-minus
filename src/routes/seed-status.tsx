import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
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
  const { authState } = useRole();
  const { data, isLoading } = useQuery({
    queryKey: ["seed-status"],
    queryFn: countRows,
    enabled: authState === "signed-in",
  });

  return (
    <AppShell>
      <PageHeader title="Seed status" lead="Row counts for every table the seed script loads." />
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
