import { createFileRoute } from "@tanstack/react-router";

/** Daily refresh of the GAO and Federal Register feeds, called by the scheduled job. */
export const Route = createFileRoute("/api/public/hooks/watch-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const secret = process.env['WATCH_CRON_SECRET'] ?? process.env['LOVABLE_CRON_SECRET'];
        if (!secret || !token || token !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { fetchGaoDecisions, fetchFederalRegister } = await import("@/lib/watch-fetch.server");
        const results = [await fetchGaoDecisions("Scheduled job"), await fetchFederalRegister("Scheduled job")];
        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
