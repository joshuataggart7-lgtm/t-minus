import { createFileRoute } from "@tanstack/react-router";

/** Nightly exclusions sweep of every vendor of record on every open file. */
export const Route = createFileRoute("/api/public/hooks/exclusions-sweep")({
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
        const { runExclusionsSweep } = await import("@/lib/exclusions-sweep.server");
        const result = await runExclusionsSweep("Scheduled job");
        return new Response(JSON.stringify({ ok: true, result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
