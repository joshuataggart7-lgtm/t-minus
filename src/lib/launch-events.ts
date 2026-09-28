import { supabase } from "@/integrations/supabase/client";
import { STATE_AUDIT_COLUMNS, STATE_AUDIT_FILTER, type StateAuditRow } from "@/lib/state-audit";

export type LaunchEvent = { acquisition_id: string | null; action: string | null; logged_at: string | null };

const PAGE = 1000;
const MAX_PAGES = 200; // 200,000 launch rows; a safety stop, never expected to be reached

/** Every audit row with action = 'Launched'. No row limit: pages through the API cap. */
export async function loadLaunchEvents(): Promise<LaunchEvent[]> {
  const out: LaunchEvent[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase
      .from("audit_log")
      .select("acquisition_id,action,logged_at")
      .eq("action", "Launched")
      .order("logged_at", { ascending: true })
      .order("log_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Launch records could not be read: ${error.message}`);
    const rows = (data ?? []) as LaunchEvent[];
    if (rows.length === 0) return out;
    out.push(...rows);
    from += rows.length; // advance by what came back, so a smaller server cap still pages correctly
  }
  throw new Error("Launch records could not be read: too many pages.");
}

/** Acquisition IDs that have a recorded Launched audit row. */
export function launchedIdSet(events: LaunchEvent[]): Set<string> {
  return new Set(
    events
      .filter((e) => e.action === "Launched" && e.acquisition_id && e.logged_at)
      .map((e) => e.acquisition_id as string),
  );
}

/** Every audit row the state functions can read (Launched, hold, CPARS). No row limit. */
export async function loadStateAuditRows(acquisitionId?: string): Promise<StateAuditRow[]> {
  const out: StateAuditRow[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabase.from("audit_log").select(STATE_AUDIT_COLUMNS).or(STATE_AUDIT_FILTER);
    if (acquisitionId) query = query.eq("acquisition_id", acquisitionId);
    const { data, error } = await query
      .order("logged_at", { ascending: false })
      .order("log_id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`State records could not be read: ${error.message}`);
    const rows = (data ?? []) as unknown as StateAuditRow[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
    from += rows.length;
  }
  throw new Error("State records could not be read: too many pages.");
}
