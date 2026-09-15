import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole, currentActor } from "@/lib/actor";
import type { SweepResult } from "@/lib/exclusions-sweep.server";

/** On-demand run of the nightly exclusions sweep. HQ only. */
export const runExclusionsSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SweepResult> => {
    const me = await requireRole(context, ["hq"], "The exclusions sweep is run by HQ.");
    const { runExclusionsSweep } = await import("@/lib/exclusions-sweep.server");
    return runExclusionsSweep(me.name);
  });
