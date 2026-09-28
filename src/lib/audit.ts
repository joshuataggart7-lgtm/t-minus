// One door for client-side audit rows. Demo (anonymous) sessions are view
// only, so nothing is written for them; real accounts write exactly as before.

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { isDemoSession } from "@/lib/demo-guard";

type AuditRow = TablesInsert<"audit_log">;

export async function writeAudit(
  row: AuditRow | AuditRow[],
): Promise<{ error: { message: string } | null }> {
  if (await isDemoSession()) return { error: null };
  const { error } = await supabase.from("audit_log").insert(row as never);
  return { error };
}
