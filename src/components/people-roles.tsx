import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, type RoleId } from "@/lib/roles";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type MembershipRow = { id: string; user_id: string; role: RoleId };

const ASSIGNABLE_ROLES = Object.keys(ROLE_LABELS) as RoleId[];

/** Administrators assign any combination of roles to signed-in accounts. */
export function PeopleRoles({ actorName }: { actorName: string }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["people-roles"],
    queryFn: async () => {
      const [profiles, memberships] = await Promise.all([
        supabase.from("profiles").select("id,email,display_name").order("created_at"),
        supabase.from("user_roles").select("id,user_id,role"),
      ]);
      if (profiles.error) throw new Error(profiles.error.message);
      if (memberships.error) throw new Error(memberships.error.message);
      return {
        profiles: (profiles.data ?? []) as ProfileRow[],
        memberships: (memberships.data ?? []) as MembershipRow[],
      };
    },
  });

  async function toggleRole(row: ProfileRow, role: RoleId, enabled: boolean) {
    setMessage(null);
    setProblem(null);
    const current = (q.data?.memberships ?? []).filter((membership) => membership.user_id === row.id);
    if (!enabled && current.length === 1) {
      setProblem("Every account needs at least one role. Add another role before removing this one.");
      return;
    }
    if (!enabled && role === "administrator") {
      const administratorCount = (q.data?.memberships ?? []).filter((membership) => membership.role === "administrator").length;
      if (administratorCount === 1) {
        setProblem("The last Administrator cannot be removed. Add Administrator to another account first.");
        return;
      }
    }
    const operation = enabled
      ? supabase.from("user_roles").insert({ user_id: row.id, role })
      : supabase.from("user_roles").delete().eq("user_id", row.id).eq("role", role);
    const { error } = await operation;
    if (error) {
      setProblem(`The role was not saved: ${error.message}. Try again.`);
      return;
    }
    const { error: auditError } = await supabase.from("audit_log").insert({
      acquisition_id: null,
      actor: actorName,
      action: enabled ? "Role added" : "Role removed",
      field: row.email ?? row.id,
      old_value: enabled ? null : ROLE_LABELS[role],
      new_value: enabled ? ROLE_LABELS[role] : null,
      reason: "Center configuration",
    });
    if (auditError) {
      setProblem(`The role changed, but its audit entry did not save: ${auditError.message}. Contact an Administrator.`);
    } else {
      setMessage(`${ROLE_LABELS[role]} was ${enabled ? "added to" : "removed from"} ${row.display_name || row.email || "that account"}.`);
    }
    window.dispatchEvent(new Event("tminus:roles-changed"));
    void qc.invalidateQueries({ queryKey: ["people-roles"] });
  }

  return (
    <section aria-label="People and roles" className="mt-8 max-w-[90ch] border-t border-border pt-6">
      <h2 className="text-lg font-medium">People and roles</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        A person may hold several roles. Administrator includes every permission. Every change is logged.
      </p>

      {problem ? <p role="alert" className="mt-3 text-[13px] text-destructive">{problem}</p> : null}
      {message ? <p role="status" className="mt-3 text-[13px]">{message}</p> : null}

      {q.isLoading ? (
        <p className="mt-3 text-[13px] text-muted-foreground">Loading</p>
      ) : q.error ? (
        <p role="alert" className="mt-3 text-[13px]">The accounts could not be read. Refresh the page to try again.</p>
      ) : (
        <table className="mt-4 w-full border border-border text-[13px] leading-[18px]">
          <caption className="sr-only">Signed-in accounts and every role assigned to each one</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Person</th>
              <th scope="col" className="p-2">Email</th>
              <th scope="col" className="p-2">Roles</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.profiles ?? []).map((row) => {
              const assigned = new Set((q.data?.memberships ?? []).filter((item) => item.user_id === row.id).map((item) => item.role));
              return (
                <tr key={row.id} className="border-b border-border align-top">
                  <td className="p-2">{row.display_name || "—"}</td>
                  <td className="p-2">{row.email || "—"}</td>
                  <td className="p-2">
                    <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
                      <legend className="sr-only">Roles for {row.email ?? row.id}</legend>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <label key={role} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={assigned.has(role)}
                            onChange={(event) => void toggleRole(row, role, event.target.checked)}
                          />
                          {ROLE_LABELS[role]}
                        </label>
                      ))}
                    </fieldset>
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