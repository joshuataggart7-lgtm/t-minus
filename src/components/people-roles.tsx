import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PROFILE_ROLE_VALUES, ROLE_LABELS, type RoleId } from "@/lib/roles";
import { normalizeRole } from "@/lib/actor";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  is_admin: boolean;
};

/** HQ sets the role on every signed-in account. Contracting is the default. */
export function PeopleRoles({ actorName }: { actorName: string }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["people-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,display_name,role,is_admin")
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as ProfileRow[];
    },
  });

  async function setRole(row: ProfileRow, next: RoleId) {
    setMessage(null);
    setProblem(null);
    const value = PROFILE_ROLE_VALUES[next];
    const { error } = await supabase.from("profiles").update({ role: value }).eq("id", row.id);
    if (error) {
      setProblem(`The role was not saved: ${error.message}. Try again.`);
      return;
    }
    await supabase.from("audit_log").insert({
      acquisition_id: null,
      actor: actorName,
      action: "Role set",
      field: row.email ?? row.id,
      old_value: row.role,
      new_value: value,
      reason: "Center configuration",
    });
    setMessage(`${row.display_name || row.email || "That account"} now works as ${ROLE_LABELS[next]}.`);
    void qc.invalidateQueries({ queryKey: ["people-roles"] });
  }

  return (
    <section aria-label="People and roles" className="mt-8 max-w-[80ch] border-t border-border pt-6">
      <h2 className="text-lg font-medium">People and roles</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Every signed-in account holds one role. A new account starts as Contracting; HQ changes it here and the change
        is logged.
      </p>

      {problem ? (
        <p role="alert" className="mt-3 text-[13px] text-[color:var(--status-at-risk,#C8321E)]">
          {problem}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-[13px]">
          {message}
        </p>
      ) : null}

      {q.isLoading ? (
        <p className="mt-3 text-[13px] text-muted-foreground">Loading</p>
      ) : q.error ? (
        <p role="alert" className="mt-3 text-[13px]">
          The accounts could not be read. Refresh the page to try again.
        </p>
      ) : (
        <table className="mt-4 w-full border border-border text-[13px] leading-[18px]">
          <caption className="sr-only">Every signed-in account and the role it holds</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Person</th>
              <th scope="col" className="p-2">Email</th>
              <th scope="col" className="p-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((row) => {
              const current = row.is_admin ? "hq" : normalizeRole(row.role);
              return (
                <tr key={row.id} className="border-b border-border align-top">
                  <td className="p-2">{row.display_name || "—"}</td>
                  <td className="p-2">{row.email || "—"}</td>
                  <td className="p-2">
                    <label className="sr-only" htmlFor={`role-${row.id}`}>
                      Role for {row.email ?? row.id}
                    </label>
                    <select
                      id={`role-${row.id}`}
                      value={current}
                      onChange={(e) => void setRole(row, e.target.value as RoleId)}
                      className="rounded-lg border border-border bg-background px-3 py-2"
                    >
                      {(Object.keys(ROLE_LABELS) as RoleId[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
