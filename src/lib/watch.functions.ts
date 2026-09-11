import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FetchOutcome } from "@/lib/watch-fetch.server";

const input = z.object({ feed: z.enum(["gao", "federal-register", "both"]) });

async function actorName(context: { supabase: { from: (t: string) => any }; userId: string }) {
  const { data, error } = await context.supabase
    .from("users")
    .select("name,role")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !["specialist", "hq"].includes(data.role)) {
    throw new Error("Running a Watch fetch is available to contracting and HQ roles.");
  }
  return data.name as string;
}

export const runWatchFetch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => input.parse(raw))
  .handler(async ({ data, context }): Promise<FetchOutcome[]> => {
    const actor = await actorName(context);
    const { fetchGaoDecisions, fetchFederalRegister } = await import("@/lib/watch-fetch.server");
    const out: FetchOutcome[] = [];
    if (data.feed === "gao" || data.feed === "both") out.push(await fetchGaoDecisions(actor));
    if (data.feed === "federal-register" || data.feed === "both") out.push(await fetchFederalRegister(actor));
    return out;
  });
