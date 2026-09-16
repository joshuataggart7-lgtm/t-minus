/**
 * Evidence pack.
 *
 * One zip for one acquisition holding the saved documents from the record in
 * NF 1098 name order, the market research findings and run log as CSV, the
 * audit log as CSV, the clause packet as CSV, and the FPDS filling sheet.
 * Everything is built locally from what is already recorded. Nothing is sent
 * anywhere and nothing is written to an external system.
 */

import { supabase } from "@/integrations/supabase/client";
import { TEMPLATES, renderDocument, templateByKey, type Values } from "@/lib/template-engine";
import { buildFpdsSheet, buildFpdsHtml, type FpdsInput } from "@/lib/fpds-filling-sheet";
import { RFO_RESERVED_212_NOTE, type PacketClause } from "@/lib/clause-packet";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const slug = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** NF 1098 tabs sort numerically where they are numeric; untabbed items last. */
function tabRank(tab: string | null | undefined): number {
  if (!tab) return Number.MAX_SAFE_INTEGER;
  const n = Number(String(tab).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER - 1 : n;
}

function csv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

function page(acquisitionId: string, stamp: string, title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} — ${esc(acquisitionId)}</title>
<style>
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #1D1D1F; background: #fff; font-size: 15px; line-height: 22px; margin: 32px; }
  header { border-bottom: 1px solid #D9DEE8; padding-bottom: 8px; margin-bottom: 24px; font-size: 13px; color: #5B6478; display: flex; justify-content: space-between; gap: 16px; }
  h1 { font-size: 28px; line-height: 34px; font-weight: 600; }
  h2 { font-size: 18px; line-height: 24px; font-weight: 500; margin-top: 28px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; line-height: 18px; margin-top: 12px; }
  th, td { border-bottom: 1px solid #D9DEE8; text-align: left; padding: 6px 10px 6px 0; vertical-align: top; }
  .cite { font-size: 13px; color: #5B6478; font-style: italic; }
  footer { margin-top: 40px; border-top: 1px solid #D9DEE8; padding-top: 8px; font-size: 13px; color: #5B6478; }
</style></head><body>
<header><span>Acquisition ${esc(acquisitionId)}</span><span>Exported ${esc(stamp)}</span></header>
<h1>${esc(title)}</h1>
${body}
<footer>Prototype. Not an official NASA system.</footer>
</body></html>`;
}

function table(headers: string[], data: (string | number | null)[][]): string {
  if (!data.length) return `<p>Nothing recorded.</p>`;
  return `<table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${data
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c ?? "—")}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

export type EvidencePackInput = {
  acquisitionId: string;
  title?: string | null;
  isSample?: boolean;
  /** The clause packet this file recommends, in packet order. */
  clauses?: PacketClause[];
  /** Clause numbers actually applied on the file, where any are recorded. */
  appliedClauseNumbers?: string[] | null;
  fpds: FpdsInput;
};

export type EvidencePackResult = { fileName: string; entries: number };

export async function exportEvidencePack(
  input: EvidencePackInput,
  actor: string,
): Promise<EvidencePackResult> {
  const acquisitionId = input.acquisitionId;
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const [docRes, tplRes, auditRes, findRes, logRes, runRes] = await Promise.all([
    supabase
      .from("documents")
      .select("document_id, template_id, field_values, version, saved_by, saved_at, reviewed_by, reviewed_at")
      .eq("acquisition_id", acquisitionId)
      .order("version", { ascending: true }),
    supabase.from("templates").select("template_id, name, nf_1098_tab, governing_citation, citation_tier, hq_revision_date"),
    supabase
      .from("audit_log")
      .select("logged_at, actor, action, field, old_value, new_value, reason, phase")
      .eq("acquisition_id", acquisitionId)
      .order("logged_at", { ascending: true }),
    supabase
      .from("research_findings")
      .select("target, label, value, source, source_date, confirmed, confirmed_by")
      .eq("acquisition_id", acquisitionId),
    supabase
      .from("research_log")
      .select("run_id, source, query, result_count, outcome, ran_at")
      .eq("acquisition_id", acquisitionId)
      .order("ran_at", { ascending: true }),
    supabase
      .from("research_runs")
      .select("run_id, ran_at")
      .eq("acquisition_id", acquisitionId)
      .order("ran_at", { ascending: true }),
  ]);

  const err = docRes.error ?? tplRes.error ?? auditRes.error ?? findRes.error ?? logRes.error ?? runRes.error;
  if (err) throw new Error(err.message);

  const documents = docRes.data ?? [];
  const templates = tplRes.data ?? [];
  const tplById = new Map(templates.map((t) => [t.template_id, t]));

  // NF 1098 name order: by tab, then the document name, then version.
  const ordered = [...documents].sort((a, b) => {
    const ta = tplById.get(a.template_id ?? "");
    const tb = tplById.get(b.template_id ?? "");
    const r = tabRank(ta?.nf_1098_tab) - tabRank(tb?.nf_1098_tab);
    if (r !== 0) return r;
    const n = (ta?.name ?? "").localeCompare(tb?.name ?? "");
    if (n !== 0) return n;
    return (a.version ?? 0) - (b.version ?? 0);
  });

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  let entries = 0;
  const add = (name: string, body: string) => {
    zip.file(name, body);
    entries += 1;
  };

  // ------------------------------------------------------------- documents
  const indexRows: (string | number | null)[][] = [];
  ordered.forEach((d, i) => {
    const tpl = tplById.get(d.template_id ?? "");
    const name = tpl?.name ?? "Document";
    const tab = tpl?.nf_1098_tab ?? "";
    const def =
      TEMPLATES.find((t) => t.name === name) ??
      TEMPLATES.find((t) => t.tab && tab && String(t.tab) === String(tab)) ??
      templateByKey(name.toLowerCase());
    const values = (d.field_values ?? {}) as Values;
    let body = "";
    if (def) {
      const doc = renderDocument(def, values, acquisitionId);
      body = doc.blocks
        .map(
          (b) =>
            `<section><h2>${esc(b.heading)}</h2>${b.citation ? `<p class="cite">${esc(b.citation)}</p>` : ""}${b.lines
              .map((l) => `<p>${esc(l)}</p>`)
              .join("")}</section>`,
        )
        .join("");
    } else {
      body = table(
        ["Field", "Value"],
        Object.entries(values).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "")]),
      );
    }
    const provenance = table(
      ["Item", "Value"],
      [
        ["NF 1098 tab", tab || "Not tabbed"],
        ["Version", d.version ?? 1],
        ["Governing citation", tpl?.governing_citation ?? null],
        ["Citation tier", tpl?.citation_tier ?? null],
        ["HQ revision date", tpl?.hq_revision_date ?? null],
        ["Saved by", d.saved_by ?? null],
        ["Saved at", d.saved_at ?? null],
        ["Reviewed by", d.reviewed_by ?? null],
        ["Reviewed at", d.reviewed_at ?? null],
      ],
    );
    const fileName = `documents/${String(i + 1).padStart(2, "0")}-${slug(tab) || "no-tab"}-${slug(name)}-v${d.version ?? 1}.html`;
    add(fileName, page(acquisitionId, stamp, `${name} — version ${d.version ?? 1}`, `${provenance}${body}`));
    indexRows.push([tab || "—", name, `v${d.version ?? 1}`, d.saved_by ?? "—", d.saved_at ?? "—", fileName]);
  });

  // ------------------------------------------------------------- research
  const findings = findRes.data ?? [];
  add(
    "research/research-findings.csv",
    csv(
      ["target", "label", "value", "source", "source_date", "confirmed", "confirmed_by"],
      findings.map((f) => [f.target, f.label, f.value, f.source, f.source_date, f.confirmed ? "yes" : "no", f.confirmed_by]),
    ),
  );
  const runAt = new Map((runRes.data ?? []).map((r) => [r.run_id, r.ran_at]));
  const logRows = logRes.data ?? [];
  add(
    "research/research-log.csv",
    csv(
      ["run_id", "run_started", "ran_at", "source", "query", "result_count", "outcome"],
      logRows.map((l) => [l.run_id, runAt.get(l.run_id) ?? "", l.ran_at, l.source, l.query, l.result_count, l.outcome]),
    ),
  );

  // ---------------------------------------------------------------- audit
  const audit = auditRes.data ?? [];
  add(
    "audit/audit-log.csv",
    csv(
      ["logged_at", "actor", "phase", "action", "field", "old_value", "new_value", "reason"],
      audit.map((a) => [a.logged_at, a.actor, a.phase, a.action, a.field, a.old_value, a.new_value, a.reason]),
    ),
  );

  // -------------------------------------------------------------- clauses
  const clauses = input.clauses ?? [];
  const applied = new Set(input.appliedClauseNumbers ?? []);
  add(
    "clauses/clauses.csv",
    csv(
      ["clause_number", "title", "ucf_section", "status", "effective_date", "source", "applied_on_file", "reason"],
      clauses.map((c) => [
        c.clause_number,
        c.title,
        c.ucf_section,
        c.status,
        c.effective_date,
        c.source,
        input.appliedClauseNumbers ? (applied.has(c.clause_number) ? "yes" : "no") : "not recorded",
        c.reason,
      ]),
    ),
  );
  add("clauses/reserved-52-212-5-note.txt", `${RFO_RESERVED_212_NOTE}\n`);

  // -------------------------------------------------------- FPDS fill aid
  const sheet = buildFpdsSheet(input.fpds);
  add("fpds/fpds-filling-sheet.html", buildFpdsHtml(sheet, stamp));

  // ---------------------------------------------------------------- cover
  const cover = page(
    acquisitionId,
    stamp,
    `Evidence pack — ${input.title ?? acquisitionId}`,
    `<p>${input.isSample ? "Sample record. " : ""}Synthetic prototype data. This pack was built from what is recorded on this file. It is not an official contract file and nothing was written to an external system.</p>
     <h2>Documents in NF 1098 name order</h2>
     ${table(["NF 1098 tab", "Document", "Version", "Saved by", "Saved at", "File in this pack"], indexRows)}
     <h2>Also in this pack</h2>
     ${table(
       ["Item", "File", "Rows"],
       [
         ["Market research findings", "research/research-findings.csv", findings.length],
         ["Market research run log", "research/research-log.csv", logRows.length],
         ["Audit log", "audit/audit-log.csv", audit.length],
         ["Clause packet", "clauses/clauses.csv", clauses.length],
         ["FPDS filling sheet (fill aid)", "fpds/fpds-filling-sheet.html", sheet.recordedCount + sheet.uncertainCount + sheet.blankCount],
       ],
     )}`,
  );
  add("index.html", cover);

  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `evidence-pack-${acquisitionId}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", fileName);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    actor,
    action: "Evidence pack exported",
    field: "evidence_pack",
    old_value: "",
    new_value: fileName,
    reason: `Local zip with ${ordered.length} document versions in NF 1098 order, ${findings.length} research findings, ${logRows.length} research log rows, ${audit.length} audit rows, ${clauses.length} clauses and the FPDS filling sheet. Nothing was sent to an external system.`,
  });

  return { fileName, entries };
}
