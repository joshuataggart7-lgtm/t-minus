import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ResetResult = { resetAt: string; counts: Record<string, number> };

/** HQ-only. Clears demo activity and reloads every seed file exactly as written. */
export const resetDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResetResult> => {
    const { data: me, error: meError } = await context.supabase
      .from("users")
      .select("role,name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (meError) throw new Error(meError.message);
    if (me?.role !== "hq") throw new Error("Reset demo is available to HQ only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reloadSeed, seededAcquisitionIds } = await import("./seed-load.server");
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        delete: () => {
          not: (c: string, op: string, v: unknown) => Promise<{ error: { message: string } | null }>;
        };
        insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }>;
      };
    };

    const clear = async (table: string, pk: string) => {
      const { error } = await db.from(table).delete().not(pk, "is", null);
      if (error) throw new Error(`${table}: ${error.message}`);
    };

    // Activity recorded after the seed
    await clear("announcement_acks", "announcement_id");
    await clear("comments", "comment_id");
    await clear("polls", "poll_id");
    await clear("sam_checks", "check_id");
    await clear("documents", "document_id");
    await clear("audit_log", "log_id");
    await clear("template_defects", "defect_id");

    // Acquisitions that are not in acquisitions.json. Records backfilled from
    // SAM.gov are tagged "backfilled" and are left in place by the reset.
    const ids = seededAcquisitionIds();
    const { error: acqError } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          delete: () => {
            not: (
              c: string,
              op: string,
              v: unknown,
            ) => { is: (c: string, v: unknown) => Promise<{ error: { message: string } | null }> };
          };
        };
      }
    )
      .from("acquisition_facts")
      .delete()
      .not("acquisition_id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`)
      .is("source_tag", null);
    if (acqError) throw new Error(`acquisition_facts: ${acqError.message}`);


    const counts = await reloadSeed(supabaseAdmin as never);

    const resetAt = new Date().toISOString();
    const { error: logError } = await db.from("audit_log").insert([
      {
        acquisition_id: null,
        actor: me?.name ?? "HQ",
        action: "Demo reset",
        field: "seed",
        old_value: null,
        new_value: `${counts["acquisition_facts"] ?? 0} acquisitions reloaded`,
        reason: "Demo reset to the seeded state",
        logged_at: resetAt,
      },
    ]);
    if (logError) throw new Error(`audit_log: ${logError.message}`);

    return { resetAt, counts };
  });
