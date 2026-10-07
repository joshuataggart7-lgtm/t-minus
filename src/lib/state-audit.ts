export type StateAuditRow = { log_id: string; acquisition_id: string | null; action: string | null; field: string | null; old_value: string | null; new_value: string | null; logged_at: string | null };
export const STATE_AUDIT_COLUMNS = "log_id,acquisition_id,action,field,old_value,new_value,logged_at";
// PostgREST or-filter: exactly the rows the state functions can read (Launched,
// hold, CPARS, and the recorded phase changes that date each phase).
export const STATE_AUDIT_FILTER = "action.eq.Launched,action.ilike.*hold*,action.ilike.*cpars*,field.ilike.*cpars*,field.eq.clock_state,field.eq.current_phase";
export function cparsRecorded(log: { action: string | null; field: string | null }[]): boolean {
  return log.some((r) => /cpars/i.test(`${r.action ?? ""} ${r.field ?? ""}`));
}
