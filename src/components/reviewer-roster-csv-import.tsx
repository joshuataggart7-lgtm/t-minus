/**
 * Center reviewer roster CSV import.
 *
 * HQ uploads one CSV of the reviewers a Center actually uses, so the placeholder
 * names on routing and review rows are replaced by the Center's own people. The
 * file is checked line by line and previewed before anything is written. Only
 * the people records are touched: no review rule citation is invented, no
 * acquisition is changed, and the seeded demo roster is never overwritten.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { parseCsv } from "@/lib/csv";
import { CENTER_POLICY_NOTE } from "@/lib/center-config";
import { SEEDED_USERS } from "@/lib/roles";

const REQUIRED = ["center_code", "reviewer_role", "name"] as const;

export const REVIEWER_TEMPLATE_CSV = "center_code,reviewer_role,name,title,email\n";

const SEED_NAMES = new Set(SEEDED_USERS.map((u) => u.name.trim().toLowerCase()));

export type ReviewerImportRow = {
  center_code: string;
  reviewer_role: string;
  name: string;
  title: string | null;
  email: string | null;
  skipped: boolean;
  note: string;
};

export type ReviewerCheck = {
  rows: ReviewerImportRow[];
  problems: string[];
};

/** Column and row checks. Nothing is written when a problem is returned. */
export function checkReviewerCsv(
  text: string,
  known: { centers: string[]; roles: string[] },
): ReviewerCheck {
  const records = parseCsv(text);
  if (records.length === 0) {
    return { rows: [], problems: ["The file has a header but no rows."] };
  }
  const header = Object.keys(records[0] ?? {});
  const problems: string[] = [];
  for (const col of REQUIRED) {
    if (!header.includes(col)) problems.push(`The column ${col} is missing.`);
  }
  if (problems.length) return { rows: [], problems };

  const rows: ReviewerImportRow[] = [];
  records.forEach((r, i) => {
    const line = i + 2;
    const center = (r["center_code"] ?? "").trim().toUpperCase();
    const role = (r["reviewer_role"] ?? "").trim();
    const name = (r["name"] ?? "").trim();
    if (!center || !role || !name) {
      problems.push(`Line ${line}: Center, reviewer role and name are all required.`);
      return;
    }
    if (known.centers.length && !known.centers.includes(center)) {
      problems.push(`Line ${line}: ${center} is not a Center in this prototype.`);
      return;
    }
    if (known.roles.length && !known.roles.some((k) => k.toLowerCase() === role.toLowerCase())) {
      problems.push(
        `Line ${line}: ${role} is not a reviewer role on the review rules. Add the rule first.`,
      );
      return;
    }
    const seeded = SEED_NAMES.has(name.toLowerCase());
    rows.push({
      center_code: center,
      reviewer_role: role,
      name,
      title: (r["title"] ?? "").trim() || null,
      email: (r["email"] ?? "").trim() || null,
      skipped: seeded,
      note: seeded ? "Skipped: seeded demo roster row — not overwritten." : "Will be saved.",
    });
  });
  return { rows, problems };
}

export function ReviewerRosterCsvImport({
  actorName,
  centers,
  roles,
  onApplied,
}: {
  actorName: string;
  centers: string[];
  roles: string[];
  onApplied: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [check, setCheck] = useState<ReviewerCheck | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const writable = (check?.rows ?? []).filter((r) => !r.skipped);

  async function read(file: File) {
    setMessage(null);
    setProblem(null);
    const text = await file.text();
    setFileName(file.name);
    setCheck(checkReviewerCsv(text, { centers, roles }));
  }

  function downloadTemplate() {
    const blob = new Blob([REVIEWER_TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reviewer-roster-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function apply() {
    if (!check || check.problems.length || writable.length === 0) return;
    setBusy(true);
    setProblem(null);

    const { data: existing, error: readError } = await supabase
      .from("users")
      .select("user_id,name,center_code");
    if (readError) {
      setBusy(false);
      setProblem(`The roster was not imported: ${readError.message}. Try again.`);
      return;
    }

    let updated = 0;
    let added = 0;
    for (const row of writable) {
      const match = (existing ?? []).find(
        (u) =>
          (u.name ?? "").trim().toLowerCase() === row.name.toLowerCase() &&
          (u.center_code ?? "").toUpperCase() === row.center_code,
      );
      const fields = {
        name: row.name,
        role: row.reviewer_role,
        center_code: row.center_code,
        ...(row.title ? { title: row.title } : {}),
        ...(row.email ? { email: row.email } : {}),
      };
      const { error } = match
        ? await supabase.from("users").update(fields).eq("user_id", match.user_id)
        : await supabase.from("users").insert(fields);
      if (error) {
        setBusy(false);
        setProblem(`${row.name} was not saved: ${error.message}. Fix the file and upload it again.`);
        return;
      }
      if (match) updated++;
      else added++;
      await supabase.from("audit_log").insert({
        acquisition_id: null,
        actor: actorName,
        action: match ? "Center reviewer updated from CSV" : "Center reviewer added from CSV",
        field: `${row.center_code} · ${row.reviewer_role}`,
        old_value: match ? match.name : null,
        new_value: row.name,
        reason: `${CENTER_POLICY_NOTE} Imported from ${fileName ?? "an uploaded file"}.`,
      });
    }

    setBusy(false);
    const skipped = (check.rows.length - writable.length);
    setMessage(
      `${updated} reviewer${updated === 1 ? "" : "s"} updated, ${added} added${
        skipped ? `, ${skipped} skipped as seeded demo roster rows` : ""
      }.`,
    );
    setCheck(null);
    onApplied();
  }

  return (
    <section className="mt-10 max-w-[80ch] border-t border-border pt-6">
      <h2 className="text-lg font-medium">Import the reviewer roster from a CSV</h2>
      <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
        Columns: center_code, reviewer_role and name are required; title and email are optional.
        Placeholders disappear when your Center's titles and reviewers are imported. The demo Center
        seed roster is protected and is never overwritten. {CENTER_POLICY_NOTE}
      </p>
      <p className="mt-2 text-[13px] leading-[18px] text-muted-foreground">
        Reviewer roles must already exist on the review rules. No review rule citation is created or
        changed by an import, and no acquisition is touched.
      </p>

      <button
        type="button"
        onClick={downloadTemplate}
        className="mt-3 rounded-lg border border-border px-3 py-2 text-[13px] text-primary"
      >
        Download the template CSV
      </button>

      <label className="mt-4 block text-sm">
        <span className="text-muted-foreground">Reviewer roster CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block w-full rounded-lg border border-border p-2 text-[15px]"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
          }}
        />
      </label>

      {check && check.problems.length ? (
        <div className="mt-4 rounded-lg border border-border p-4">
          <p className="text-[15px] font-medium">The file was not imported.</p>
          <ul className="mt-2 list-disc pl-5 text-[13px] leading-[18px] text-muted-foreground">
            {check.problems.slice(0, 12).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Correct the lines above and upload the file again.
          </p>
        </div>
      ) : null}

      {check && !check.problems.length && check.rows.length ? (
        <div className="mt-4">
          <p className="text-[15px]">
            Preview: {writable.length} row{writable.length === 1 ? "" : "s"} ready to apply. Nothing
            is saved until you apply them.
          </p>
          <table className="mt-3 w-full border border-border text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2">Center</th>
                <th className="p-2">Reviewer role</th>
                <th className="p-2">Name</th>
                <th className="p-2">Title</th>
                <th className="p-2">What happens</th>
              </tr>
            </thead>
            <tbody>
              {check.rows.map((r) => (
                <tr key={`${r.center_code}-${r.reviewer_role}-${r.name}`} className="border-b border-border">
                  <td className="p-2">{r.center_code}</td>
                  <td className="p-2">{r.reviewer_role}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.title ?? "Not recorded"}</td>
                  <td className="p-2 text-muted-foreground">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button className="mt-4" disabled={busy || writable.length === 0} onClick={() => void apply()}>
            {busy ? "Applying the roster" : "Apply the roster"}
          </Button>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-[15px]">{message}</p> : null}
      {problem ? <p className="mt-4 text-[15px] text-[var(--status-at-risk,#C8321E)]">{problem}</p> : null}
    </section>
  );
}
