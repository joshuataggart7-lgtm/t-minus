import { createFileRoute } from "@tanstack/react-router";
import { REPORT_VIEWS, rowsToCsv } from "@/lib/reporting";

/**
 * Nightly CSV extract of every reporting view, for ORBIT's Power BI.
 * GET  ?view=<name>&secret=<token>  returns that view as CSV.
 * POST with the bearer token runs the nightly extract and logs one audit row
 * per view with its row count.
 */
export const Route = createFileRoute("/api/public/hooks/reporting-extract")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token =
          url.searchParams.get("secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const secret = process.env['WATCH_CRON_SECRET'] ?? process.env['LOVABLE_CRON_SECRET'];
        if (!secret || !token || token !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const name = url.searchParams.get("view") ?? "";
        const known = REPORT_VIEWS.find((v) => v.view === name);
        if (!known) {
          return new Response(
            JSON.stringify({ error: "Unknown view", views: REPORT_VIEWS.map((v) => v.view) }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from(known.view as never).select("*");
        if (error) return new Response(error.message, { status: 500 });
        const at = new Date().toISOString();
        const csv = rowsToCsv((data ?? []) as Record<string, unknown>[], at);
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv;charset=utf-8",
            "Content-Disposition": `attachment; filename="${known.view}-${at.slice(0, 10)}.csv"`,
          },
        });
      },
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const secret = process.env['WATCH_CRON_SECRET'] ?? process.env['LOVABLE_CRON_SECRET'];
        if (!secret || !token || token !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const at = new Date().toISOString();
        const results: { view: string; rows: number }[] = [];
        for (const v of REPORT_VIEWS) {
          const { count } = await supabaseAdmin
            .from(v.view as never)
            .select("*", { count: "exact", head: true });
          results.push({ view: v.view, rows: count ?? 0 });
          await supabaseAdmin.from("audit_log").insert({
            acquisition_id: null,
            actor: "Scheduled job",
            action: "Reporting extract generated",
            field: v.view,
            new_value: String(count ?? 0),
            reason: "Nightly CSV extract for ORBIT Power BI",
            logged_at: at,
          });
        }
        return new Response(JSON.stringify({ ok: true, extracted_at: at, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
