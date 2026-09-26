/**
 * NEAR export bundle.
 *
 * Builds a zip for one acquisition holding an index page, every saved document
 * version, the SAM.gov check responses, the comments and poll votes, the audit
 * log, and the NF 1707 as filed. Documents are ordered by their NF 1098 tab
 * where the template has one. Every page carries the acquisition ID and the
 * export timestamp. The export itself is written to the audit log.
 */

import { calendarDaysBetween, todayCT } from "@/lib/calendar-date";
import { supabase } from "@/integrations/supabase/client";
import { isOfficialFinal } from "@/lib/official-file";
import { TEMPLATES, renderDocument, templateByKey, type Values } from "@/lib/template-engine";
import { buildFileIndex } from "@/lib/file-index";
import { buildSequence } from "@/lib/launch-sequence";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** NF 1098 tabs sort numerically where they are numeric; untabbed items last. */
function tabRank(tab: string | null | undefined): number {
  if (!tab) return Number.MAX_SAFE_INTEGER;
  const n = Number(String(tab).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER - 1 : n;
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
  a { color: #0B3D91; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; background: #F5F7FB; padding: 12px; }
  footer { margin-top: 40px; border-top: 1px solid #D9DEE8; padding-top: 8px; font-size: 13px; color: #5B6478; }
</style></head><body>
<header><span>Acquisition ${esc(acquisitionId)}</span><span>Exported ${esc(stamp)}</span></header>
<h1>${esc(title)}</h1>
${body}
<footer>Prototype. Not an official NASA system.</footer>
</body></html>`;
}

function rows(headers: string[], data: (string | number | null)[][]): string {
  if (!data.length) return `<p>Nothing recorded.</p>`;
  return `<table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${data
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c ?? "—")}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

export type ExportResult = { fileName: string; entries: number };

export async function exportNearBundle(acquisitionId: string, actor: string): Promise<ExportResult> {
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const safeStamp = stamp.replace(/[:]/g, "").replace(/[-]/g, "");

  const [acqRes, docRes, tplRes, samRes, pollRes, auditRes, nfFieldRes, nfApprovalRes] = await Promise.all([
    supabase.from("acquisition_facts").select("*").eq("acquisition_id", acquisitionId).maybeSingle(),
    supabase
      .from("documents")
      .select("document_id, template_id, field_values, version, saved_by, saved_at, reviewed_by, reviewed_at, ai_model, ai_generated_at")
      .eq("acquisition_id", acquisitionId)
      .order("version", { ascending: true }),
    supabase.from("templates").select("template_id, name, nf_1098_tab, governing_citation, citation_tier, hq_revision_date"),
    supabase.from("sam_checks").select("*").eq("acquisition_id", acquisitionId).order("checked_at", { ascending: true }),
    supabase.from("polls").select("*").eq("acquisition_id", acquisitionId),
    supabase.from("audit_log").select("*").eq("acquisition_id", acquisitionId).order("logged_at", { ascending: true }),
    supabase.from("nf1707_fields").select("section, subform, field_name, caption_full, caption").order("section").order("subform").order("field_name"),
    supabase.from("nf1707_approvals").select("form_field_name, approval_role, owner_name, status, completed_at").eq("acquisition_id", acquisitionId),
  ]);

  const err =
    acqRes.error ?? docRes.error ?? tplRes.error ?? samRes.error ?? pollRes.error ?? auditRes.error ?? nfFieldRes.error ?? nfApprovalRes.error;
  if (err) throw new Error(err.message);
  const acq = acqRes.data as Record<string, unknown> | null;
  if (!acq) throw new Error("That acquisition could not be read.");

  const documents = docRes.data ?? [];
  const templates = tplRes.data ?? [];
  const docIds = documents.map((d) => d.document_id);
  const commentRes = docIds.length
    ? await supabase.from("comments").select("*").in("document_id", docIds).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (commentRes.error) throw new Error(commentRes.error.message);
  const comments = commentRes.data ?? [];

  const tplById = new Map(templates.map((t) => [t.template_id, t]));

  // Order by NF 1098 tab, then template name, then version.
  const ordered = [...documents].sort((a, b) => {
    const ta = tplById.get(a.template_id ?? "");
    const tb = tplById.get(b.template_id ?? "");
    const r = tabRank(ta?.nf_1098_tab) - tabRank(tb?.nf_1098_tab);
    if (r !== 0) return r;
    const n = (ta?.name ?? "").localeCompare(tb?.name ?? "");
    if (n !== 0) return n;
    return (a.version ?? 0) - (b.version ?? 0);
  });

  // Where an official copy has been filed for a template, that version alone
  // goes out; drafts stay on the record and out of this export.
  const officialTemplates = new Set(
    ordered.filter((d) => isOfficialFinal(d.field_values)).map((d) => String(d.template_id ?? "")),
  );
  const packed = ordered.filter(
    (d) => !officialTemplates.has(String(d.template_id ?? "")) || isOfficialFinal(d.field_values),
  );

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const indexRows: (string | number | null)[][] = [];
  let entries = 0;

  const add = (name: string, html: string) => {
    zip.file(name, html);
    entries += 1;
  };

  // ------------------------------------------------------------- documents
  packed.forEach((d, i) => {
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
      body = rows(
        ["Field", "Value"],
        Object.entries(values).map(([k, v]) => [k, String(v ?? "")]),
      );
    }
    const provenance = rows(
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
        ["AI model", d.ai_model ?? null],
        ["AI generated at", d.ai_generated_at ?? null],
      ],
    );
    const slug = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const fileName = `documents/${String(i + 1).padStart(2, "0")}-${slug(tab) || "no-tab"}-${slug(name)}-v${
      d.version ?? 1
    }.html`;
    add(fileName, page(acquisitionId, stamp, `${name} — version ${d.version ?? 1}`, `${provenance}${body}`));
    indexRows.push([tab || "—", name, `v${d.version ?? 1}`, d.saved_by ?? "—", d.saved_at ?? "—", fileName]);
  });

  // ---------------------------------------------------------- NF 1707 filed
  const answers = (acq["nf1707_answers"] ?? {}) as Record<string, unknown>;
  const approvalByField = new Map((nfApprovalRes.data ?? []).map((a) => [a.form_field_name, a]));
  const mappedAnswerRows = (nfFieldRes.data ?? []).map((field) => {
    const key = `${field.section ?? ""}.${field.subform ?? ""}.${field.field_name ?? ""}`;
    const approval = approvalByField.get(field.field_name ?? "");
    const approvalValue = approval?.status === "complete"
      ? `${approval.owner_name ?? approval.approval_role} — ${approval.completed_at?.slice(0, 10) ?? "complete"}`
      : undefined;
    const value = approvalValue ?? answers[key] ?? "";
    return [field.caption_full ?? field.caption ?? field.field_name ?? key, typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)] as (string | null)[];
  });
  const factRows = Object.entries(acq)
    .filter(([k]) => k !== "nf1707_answers")
    .map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "")] as (string | null)[]);
  const nf1707Html = page(
    acquisitionId,
    stamp,
    "NF 1707 as filed",
    `<h2>Record fields</h2>${rows(["Field", "Value"], factRows)}<h2>Form answers</h2>${rows(
      ["Field", "Answer"],
      mappedAnswerRows,
    )}`,
  );
  add("nf-1707-as-filed.html", nf1707Html);

  // --------------------------------------------------------- SAM.gov checks
  const samChecks = samRes.data ?? [];
  const samBody = samChecks.length
    ? samChecks
        .map(
          (c) =>
            `<section><h2>${esc(c.check_type ?? "Check")} — ${esc(c.vendor_uei ?? "no UEI")}</h2>` +
            `<p class="cite">Checked by ${esc(c.checked_by ?? "—")} on ${esc(c.checked_at ?? "—")}</p>` +
            `<pre>${esc(JSON.stringify(c.response_json ?? {}, null, 2))}</pre></section>`,
        )
        .join("")
    : "<p>No SAM.gov checks are recorded for this acquisition.</p>";
  add("sam-gov-checks.html", page(acquisitionId, stamp, "SAM.gov check responses", samBody));

  // ------------------------------------------------- comments and poll votes
  const polls = pollRes.data ?? [];
  const commentBody =
    `<h2>Poll votes</h2>` +
    rows(
      ["Phase", "Reviewer role", "Reviewer", "Vote", "Reason", "Due", "Voted at"],
      polls.map((p) => [
        p.phase,
        p.reviewer_role,
        p.reviewer_name,
        p.vote ?? "Not voted",
        p.reason,
        p.due_date,
        p.voted_at,
      ]),
    ) +
    `<h2>Comments</h2>` +
    rows(
      ["Document", "Author", "Comment", "Created at"],
      comments.map((c) => {
        const doc = documents.find((d) => d.document_id === c.document_id);
        const tpl = doc ? tplById.get(doc.template_id ?? "") : undefined;
        return [tpl?.name ?? c.document_id, c.author, c.body, c.created_at];
      }),
    );
  add("comments-and-votes.html", page(acquisitionId, stamp, "Comments and poll votes", commentBody));

  // ---------------------------------------------------------------- audit log
  const audit = auditRes.data ?? [];
  add(
    "audit-log.html",
    page(
      acquisitionId,
      stamp,
      "Audit log",
      rows(
        ["Logged at", "Actor", "Action", "Phase", "Field", "Old value", "New value", "Reason"],
        audit.map((a) => [a.logged_at, a.actor, a.action, a.phase, a.field, a.old_value, a.new_value, a.reason]),
      ),
    ),
  );

  // -------------------------------------------------------- NF 1098 file index
  const planRes = await supabase
    .from("phase_plan")
    .select("acquisition_type,phase,planned_days,order,note");
  const phases = buildSequence(
    acq as never,
    planRes.data ?? [],
    todayCT(),
    calendarDaysBetween,
  ).map((p) => p.phase);
  const fileIndex = buildFileIndex(
    documents.map((d) => ({
      template_id: d.template_id ?? null,
      version: d.version ?? 1,
      saved_by: d.saved_by ?? null,
      saved_at: d.saved_at ?? null,
    })),
    templates.map((t) => ({ template_id: t.template_id, name: t.name, nf_1098_tab: t.nf_1098_tab })),
    phases,
    [],
    acq as never,
  );
  const indexBodyTabs =
    `<h2>NF 1098 contract file index</h2>` +
    `<p class="cite">FAR 4.801. Tabs present in this file and tabs this acquisition type requires.</p>` +
    rows(
      ["NF 1098 tab", "Document", "Phase", "State"],
      [
        ...fileIndex.present.map((t) => [
          t.tab,
          t.templateName,
          t.phase,
          `Present, ${t.documents.length} version${t.documents.length === 1 ? "" : "s"}`,
        ]),
        ...fileIndex.missing.map((t) => [
          t.tab,
          t.templateName,
          t.phase,
          "Required for this acquisition type, no document",
        ]),
      ],
    );

  // -------------------------------------------------------------------- index
  const indexBody =
    `<p>${esc(String(acq["title"] ?? ""))}</p>` +
    indexBodyTabs +
    `<h2>Document versions, in NF 1098 tab order</h2>` +
    rows(["NF 1098 tab", "Document", "Version", "Saved by", "Saved at", "File"], indexRows) +
    `<h2>Record contents</h2>` +
    rows(
      ["Item", "Count", "File"],
      [
        ["SAM.gov check responses", samChecks.length, "sam-gov-checks.html"],
        ["Comments", comments.length, "comments-and-votes.html"],
        ["Poll votes", polls.length, "comments-and-votes.html"],
        ["Audit log entries", audit.length, "audit-log.html"],
        ["NF 1707 as filed", 1, "nf-1707-as-filed.html"],
      ],
    );
  zip.file("index.html", page(acquisitionId, stamp, "NEAR export bundle", indexBody));
  entries += 1;

  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `near-export-${acquisitionId}-${safeStamp}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  await supabase.from("audit_log").insert({
    acquisition_id: acquisitionId,
    actor,
    action: "NEAR export",
    field: "export",
    new_value: fileName,
    reason: `${packed.length} document versions, ${samChecks.length} SAM.gov checks, ${comments.length} comments, ${polls.length} poll votes, ${audit.length} audit entries`,
  });

  return { fileName, entries };
}
