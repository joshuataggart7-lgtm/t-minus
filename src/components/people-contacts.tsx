import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRow = {
  user_id: string;
  name: string;
  title: string | null;
  center_code: string | null;
  email: string | null;
  telephone: string | null;
};

/**
 * Contact details on the people records. A document prints the telephone and
 * email from the officer's own record, so they are set here and nowhere else.
 */
export function PeopleContacts({ actorName, mayEdit }: { actorName: string; mayEdit: boolean }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["people-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("user_id,name,title,center_code,email,telephone")
        .order("center_code")
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as UserRow[];
    },
  });

  async function save(row: UserRow, telephone: string) {
    setMessage(null);
    setProblem(null);
    const next = telephone.trim() || null;
    const { error } = await supabase.from("users").update({ telephone: next }).eq("user_id", row.user_id);
    if (error) {
      setProblem(`The telephone was not saved: ${error.message}. Try again.`);
      return;
    }
    await supabase.from("audit_log").insert({
      acquisition_id: null,
      actor: actorName,
      action: "Telephone set",
      field: row.name,
      old_value: row.telephone,
      new_value: next,
      reason: "Center configuration",
    });
    setMessage(`${row.name} now shows ${next ?? "no telephone"} on documents.`);
    void qc.invalidateQueries({ queryKey: ["people-contacts"] });
  }

  return (
    <section aria-label="Contact details" className="mt-8 max-w-[80ch] border-t border-border pt-6">
      <h2 className="text-lg font-medium">Contact details</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        The point of contact on a SAM.gov notice prints the email and telephone held here. A blank telephone prints a
        blank line.
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
          The people records could not be read. Refresh the page to try again.
        </p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">No people are on the roster yet.</p>
      ) : (
        <table className="mt-4 w-full border border-border text-[13px] leading-[18px]">
          <caption className="sr-only">People on the roster and their contact details</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Person</th>
              <th scope="col" className="p-2">Title</th>
              <th scope="col" className="p-2">Center</th>
              <th scope="col" className="p-2">Email</th>
              <th scope="col" className="p-2">Telephone</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((row) => {
              const mine = row.name.trim().toLowerCase() === actorName.trim().toLowerCase();
              return (
              <tr
                key={row.user_id}
                {...(mine ? { id: "my-record" } : {})}
                className={`border-b border-border align-top ${mine ? "bg-canvas scroll-mt-20" : ""}`}
              >
                <td className="p-2">{row.name}{mine ? " (you)" : ""}</td>
                <td className="p-2">{row.title || "—"}</td>
                <td className="p-2">{row.center_code || "—"}</td>
                <td className="p-2">{row.email || "—"}</td>
                <td className="p-2">
                  <TelephoneCell row={row} mayEdit={mayEdit} onSave={save} />
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

function TelephoneCell({
  row,
  mayEdit,
  onSave,
}: {
  row: UserRow;
  mayEdit: boolean;
  onSave: (row: UserRow, telephone: string) => Promise<void>;
}) {
  const [value, setValue] = useState(row.telephone ?? "");
  useEffect(() => setValue(row.telephone ?? ""), [row.telephone]);
  if (!mayEdit) return <span>{row.telephone || "—"}</span>;
  return (
    <span className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`tel-${row.user_id}`}>
        Telephone for {row.name}
      </label>
      <input
        id={`tel-${row.user_id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="256-555-0134"
        className="w-40 rounded-lg border border-border bg-background px-2 py-1"
      />
      <button
        type="button"
        disabled={value === (row.telephone ?? "")}
        onClick={() => void onSave(row, value)}
        className="rounded-lg border border-border px-2 py-1 disabled:opacity-50"
      >
        Save
      </button>
    </span>
  );
}
