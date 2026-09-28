export type StateAuditRow = { log_id: string; acquisition_id: string | null; action: string | null; field: string | null; logged_at: string | null };
export const STATE_AUDIT_COLUMNS = "log_id,acquisition_id,action,field,logged_at";
// PostgREST or-filter: exactly the rows the three state functions can read.
export const STATE_AUDIT_FILTER = "action.eq.Launched,action.ilike.*hold*,action.ilike.*cpars*,field.ilike.*cpars*";
export function cparsRecorded(log: { action: string | null; field: string | null }[]): boolean {
  return log.some((r) => /cpars/i.test(`${r.action ?? ""} ${r.field ?? ""}`));
}
