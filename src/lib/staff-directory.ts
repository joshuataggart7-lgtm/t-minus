import { supabase } from "@/integrations/supabase/client";

/**
 * Audit LA5. public.users contact columns (email, telephone, supervisor_email)
 * are readable only on your own row or by specialists, HQ and administrators.
 * public.staff_directory has every staff row without contact columns. This
 * merges the two: every staff row, with supervisor_email filled in only where
 * the signed-in user may read it.
 */
export type StaffRow = {
  user_id: string | null;
  name: string;
  role: string;
  title: string | null;
  center_code: string | null;
  supervisor_name: string | null;
  supervisor_email: string | null;
};

export async function loadStaffWithSupervisorContact(): Promise<{
  data: StaffRow[] | null;
  error: { message: string } | null;
}> {
  const [dir, contact] = await Promise.all([
    supabase.from("staff_directory").select("user_id,name,role,title,center_code,supervisor_name"),
    supabase.from("users").select("user_id,supervisor_email"),
  ]);
  if (dir.error) return { data: null, error: dir.error };
  if (contact.error) return { data: null, error: contact.error };
  const emails = new Map<string, string | null>();
  for (const r of contact.data ?? []) emails.set(r.user_id, r.supervisor_email);
  return {
    data: (dir.data ?? []).map((r) => ({
      user_id: r.user_id,
      name: r.name ?? "",
      role: r.role ?? "",
      title: r.title,
      center_code: r.center_code,
      supervisor_name: r.supervisor_name,
      supervisor_email: r.user_id ? (emails.get(r.user_id) ?? null) : null,
    })),
    error: null,
  };
}
