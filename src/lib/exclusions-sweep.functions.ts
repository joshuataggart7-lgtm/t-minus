import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SweepResult } from "@/lib/exclusions-sweep.server";

/** On-demand run of the nightly exclusions sweep. HQ only. */
export const runExclusionsSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SweepResult> => {
    const { data: me, error } = await context.supabase
      .from("users")
      .select("name,role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!me || me.role !== "hq") throw new Error("The exclusions sweep is run by HQ.");
    const { runExclusionsSweep } = await import("@/lib/exclusions-sweep.server");
    return runExclusionsSweep(me.name);
  });
