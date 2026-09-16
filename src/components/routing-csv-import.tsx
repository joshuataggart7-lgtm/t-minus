/**
 * Center routing CSV import.
 *
 * HQ and contracting specialists upload one CSV of memorandum routing rows for
 * a Center: which title approves each document, and who it goes through. The
 * file is validated column by column and shown as a preview before anything is
 * written. Applying upserts the same memo_routing rows the editor writes, and
 * every applied row is logged. Nothing else on the Center is touched and no
 * seeded acquisition is changed.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { parseCsv } from "@/lib/csv";
import { CENTER_POLICY_NOTE } from "@/lib/center-config";

const COLUMNS = ["center_code", "document_key", "approving_official_title"] as const;
const OPTIONAL = ["thru_chain", "memo_default"] as const;

export type RoutingImportRow = {
  center_code: string;
  document_key: string;
  approving_official_title: string;
  thru_chain: string[];
  memo_default: boolean;
};

export type RoutingCheck = {
  rows: RoutingImportRow[];
  problems: string[];
};

/** Column and row checks. Nothing is written when a problem is returned. */
export function checkRoutingCsv(
  text: string,
  known: { centers: string[]; documentKeys: string[] },
): RoutingCheck {
  const records = parseCsv(text);
  const problems: string[] = [];
  if (records.length === 0) {
    return { rows: [], problems: ["The file has a header but no rows."] };
  }
  const header = Object.keys(records[0] ?? {});
  for (const col of COLUMNS) {
    if (!header.includes(col)) problems.push(`The column ${col} is missing.`);
  }
  if (problems.length) return { rows: [], problems };

  const rows: RoutingImportRow[] = [];
  records.forEach((r, i) => {
    const line = i + 2;
    const center = (r['center_code'] ?? "").trim().toUpperCase();
    const key = (r['document_key'] ?? "").trim();
    const title = (r['approving_official_title'] ?? "").trim();
    if (!center || !key || !title) {
      problems.push(`Line ${line}: Center, document and approving title are all required.`);
      return;
    }
    if (known.centers.length && !known.centers.includes(center)) {
      problems.push(`Line ${line}: ${center} is not a Center in this prototype.`);
      return;
    }
    if (known.documentKeys.length && !known.documentKeys.includes(key)) {
      problems.push(`Line ${line}: ${key} is not a routed document.`);
      return;
    }
    const chain = (r['thru_chain'] ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const flag = (r['memo_default'] ?? "").trim().toLowerCase();
    if (flag && !["true", "false", "yes", "no", "1", "0"].includes(flag)) {
      problems.push(`Line ${line}: memo_default must read true or false.`);
      return;
    }
    rows.push({
      center_code: center,
      document_key: key,
      approving_official_title: title,
      thru_chain: chain,
      memo_default: ["true", "yes", "1"].includes(flag),
    });
  });
  return { rows, problems };
}

export function RoutingCsvImport({
  actorName,
  centers,
  documentKeys,
  onApplied,
}: {
  actorName: string;
  centers: string[];
  documentKeys: string[];
  onApplied: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [check, setCheck] = useState<RoutingCheck | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function read(file: File) {
    setMessage(null);
    setProblem(null);
    const text = await file.text();
    setFileName(file.name);
    setCheck(checkRoutingCsv(text, { centers, documentKeys }));
  }

  async function apply() {
    if (!check || check.problems.length || check.rows.length === 0) return;
    setBusy(true);
    setProblem(null);
    const now = new Date().toISOString();
    const { error } = await supabase.from("memo_routing").upsert(
      check.rows.map((r) => ({
        center_code: r.center_code,
        document_key: r.document_key,
        approving_official_title: r.approving_official_title,
        thru_chain: r.thru_chain,
        memo_default: r.memo_default,
        updated_by: actorName,
        updated_at: now,
      })),
      { onConflict: "center_code,document_key" },
    );
    if (error) {
      setBusy(false);
      setProblem(`The routing was not imported: ${error.message}. Fix the file and upload it again.`);
      return;
    }
    await supabase.from("audit_log").insert(
      check.rows.map((r) => ({
        acquisition_id: null,
        actor: actorName,
        action: "Memorandum routing imported from CSV",
        field: `${r.center_code} · ${r.document_key}`,
        old_value: null,
        new_value: r.approving_official_title,
        reason: `${CENTER_POLICY_NOTE} Imported from ${fileName ?? "an uploaded file"}.`,
      })),
    );
    setBusy(false);
    setMessage(`${check.rows.length} routing rows applied from ${fileName ?? "the uploaded file"}.`);
    setCheck(null);
    onApplied();
  }

  return (
    <section className="mt-10 max-w-[80ch] border-t border-border pt-6">
      <h2 className="text-lg font-medium">Import routing from a CSV</h2>
      <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
        Columns: center_code, document_key, approving_official_title, and optionally thru_chain
        (titles separated by semicolons) and memo_default. The file is checked and previewed before
        anything is saved. {CENTER_POLICY_NOTE}
      </p>

      <p className="mt-2 text-[13px] leading-[18px] text-muted-foreground">
        Applying replaces the matching routing rows for that Center and document. No acquisition is
        touched.
      </p>

      <button
        type="button"
        onClick={() => {
          const blob = new Blob([ROUTING_TEMPLATE_CSV], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "routing-template.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
        className="mt-3 rounded-lg border border-border px-3 py-2 text-[13px] text-primary"
      >
        Download the template CSV
      </button>

      <label className="mt-4 block text-sm">
        <span className="text-muted-foreground">Routing CSV</span>
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
            Preview: {check.rows.length} rows ready to apply. Nothing is saved until you apply them.
          </p>
          <table className="mt-3 w-full border border-border text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2">Center</th>
                <th className="p-2">Document</th>
                <th className="p-2">Approving title</th>
                <th className="p-2">Through</th>
                <th className="p-2">Memorandum by default</th>
              </tr>
            </thead>
            <tbody>
              {check.rows.map((r) => (
                <tr key={`${r.center_code}-${r.document_key}`} className="border-b border-border">
                  <td className="p-2">{r.center_code}</td>
                  <td className="p-2">{r.document_key}</td>
                  <td className="p-2">{r.approving_official_title}</td>
                  <td className="p-2">{r.thru_chain.join("; ") || "—"}</td>
                  <td className="p-2">{r.memo_default ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button className="mt-4" disabled={busy} onClick={() => void apply()}>
            {busy ? "Applying the rows" : "Apply the routing"}
          </Button>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-[15px]">{message}</p> : null}
      {problem ? <p className="mt-4 text-[15px] text-[var(--status-at-risk,#C8321E)]">{problem}</p> : null}
    </section>
  );
}
