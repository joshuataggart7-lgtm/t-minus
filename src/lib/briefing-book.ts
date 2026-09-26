/**
 * Briefing book export.
 *
 * Builds a small board-ready pack for one acquisition as a printable HTML
 * file: a cover, a status page, a key-facts page, and a clause page. Every
 * page carries the synthetic/prototype line, and the sample line where the
 * record is seeded. Everything printed here is read from the record. T-Minus
 * does not write to NCMS; NCMS remains the system of record.
 */

import { supabase } from "@/integrations/supabase/client";
import { boardReadinessItems, type BoardReadiness } from "@/lib/board-readiness";
import { RFO_RESERVED_212_NOTE } from "@/lib/clause-packet";
import type { ScaffoldSectionK } from "@/lib/format-scaffold";
import { ANTICIPATED_AWARD_TBD, ANTICIPATED_AWARD_TBD_NOTE } from "@/lib/forecast";
import type { CountdownView } from "@/components/launch-countdown";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type BriefingClause = {
  clause_number: string;
  title?: string | null;
  reason?: string | null;
  ucf_section?: string | null;
};

export type BriefingFormat = {
  formatLabel: string;
  mode: "sf1449" | "ucf";
  clins: { clin: string; description: string; amount: string; note: string }[];
  instructions: { text: string; citation: string | null }[];
  evaluation: { mode: "competitive" | "sole-source"; lines: { text: string; citation: string | null }[] };
};

/** Section K exactly as the file page and the Award handoff already print it. */
export type BriefingSectionK = ScaffoldSectionK;

export type BriefingGate = {
  name: string;
  status: string;
  citation: string;
  trigger: string;
  evidence: string;
};

export type BriefingInput = {
  acquisitionId: string;
  title: string;
  missionName?: string | null;
  centerName?: string | null;
  isSample: boolean;
  currentPhase: string;
  clockState: string;
  days: number | null;
  countdown?: CountdownView;
  targetAwardDate?: string | null;
  nextAction: string;
  blocker?: string | null;
  blockerOwner?: string | null;
  facts: { label: string; value: string }[];
  recommendedClauseCount: number;
  appliedClauseCount: number | null;
  exampleClauses: BriefingClause[];
  /** The contract format scaffold, from the same helper the file page uses. */
  format?: BriefingFormat | null;
  /** Companion gates that apply to this record. */
  gates?: BriefingGate[];
  /** The schedule of line items on the record, counted and printed. */
  clins?: { clin: string; description: string; amount: string; note: string }[];
  /** The method shell in the same voice as the file page, e.g. "SF 1449 / Part 12-13". */
  methodShellLabel?: string | null;
  /** Competitive or sole-source, from the record. */
  competitive?: boolean | null;
  /** Attachments eligible for Section J on the record. */
  sectionJCount?: number | null;
  /** Section K from the same scaffold the Award handoff view reads. */
  sectionK?: BriefingSectionK | null;
  /**
   * Contract-file assembly counts from the same buildNf1098Assembly call the
   * file page makes. Counts only — the full checklist lives on the file.
   */
  assemblyCounts?: { presentTabs: number; missingTabs: number; recorded: number; notRecorded: number } | null;
  /** Same advisory snapshot shown in the Evaluation cockpit Board brief. */
  boardReadiness?: BoardReadiness | null;
};

export const AWARD_HANDOFF_POINTER =
  "Award handoff: open the file's Award handoff view for CLIN, Section K, Sections L and M, clauses, Section J and the signature blanks, " +
  "with the NF 1098 assembly checklist beside them. NCMS remains the system of record.";


const money = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function briefingFacts(acq: Record<string, unknown>): { label: string; value: string }[] {
  const val = acq["estimated_value"] ? Number(acq["estimated_value"]) : null;
  const out: { label: string; value: string }[] = [
    { label: "Estimated value", value: val ? money(val) : "Not recorded" },
    { label: "Acquisition method", value: String(acq["acquisition_method"] ?? "Not recorded") },
    { label: "Competition", value: String(acq["competition"] ?? "Not recorded") },
    { label: "Set-aside", value: String(acq["set_aside"] ?? "None recorded") },
    { label: "Contract type", value: String(acq["contract_type"] ?? "Not recorded") },
    { label: "NAICS", value: String(acq["naics_code"] ?? "Not recorded") },
    { label: "Place of performance", value: String(acq["place_of_performance"] ?? "Not recorded") },
    { label: "Need date", value: String(acq["need_date"] ?? "Not recorded") },
  ];
  return out;
}

function markPage(input: BriefingInput, stamp: string): string {
  const sample = input.isSample ? " · Sample data" : "";
  return `<div class="mark"><span>${esc(input.acquisitionId)} · ${esc(stamp)}${esc(sample)}</span><span>Synthetic / Prototype — not an official NASA system</span></div>`;
}

const line = (l: { text: string; citation: string | null }) =>
  `<li>${esc(l.text)}${l.citation ? ` <span class="sub" style="font-size:13px">${esc(l.citation)}</span>` : ""}</li>`;

/** Section K as recorded, in the voice the method calls for. Soft: it gates nothing. */
function sectionKBlock(input: BriefingInput): string {
  const k = input.sectionK;
  if (!k) return "";
  const rows = k.checklist.length
    ? k.checklist
        .map(
          (r) =>
            `<li>${esc(r.label)} — ${esc(r.status)}${r.note ? ` <span class="sub" style="font-size:13px">${esc(r.note)}</span>` : ""}</li>`,
        )
        .join("")
    : `<li>No representations are recorded on this file.</li>`;
  const clauses = k.clauses.length
    ? `<p class="sub" style="margin-top:8px">Clauses placed in Section K: ${esc(k.clauses.map((c) => c.clause_number).join(", "))}</p>`
    : `<p class="sub" style="margin-top:8px">${esc(k.clauses_empty_note ?? "")}</p>`;
  // Commercial files carry the Reserved note so the board is not told a
  // 52.212-5 block exists. The note is quoted, never paraphrased.
  const reserved =
    input.format?.mode === "sf1449"
      ? `<p class="sub" style="margin-top:8px">${esc(RFO_RESERVED_212_NOTE)}</p>`
      : "";
  return `<div style="margin-top:24px">
    <p class="sub">Representations and certifications (Section K)</p>
    <p class="sub" style="margin-top:6px">${esc(k.path_note)}</p>
    <p style="margin:6px 0 0;font-size:14px">SAM representations: ${esc(k.sam_status)}</p>
    <ul style="margin:6px 0 0;padding-left:18px;font-size:14px">${rows}</ul>
    ${k.notes ? `<p style="margin:6px 0 0;font-size:14px">${esc(k.notes)}</p>` : ""}
    ${k.empty_note ? `<p class="sub" style="margin-top:8px">${esc(k.empty_note)}</p>` : ""}
    ${clauses}
    ${reserved}
  </div>`;
}

/** Contract format, line items, instructions and evaluation — same helper as the file page. */
function formatPage(input: BriefingInput, mark: string): string {
  const f = input.format;
  if (!f) return "";
  const clinRows = f.clins.length
    ? f.clins
        .map(
          (c) =>
            `<tr><td>${esc(c.clin)}</td><td>${esc(c.description)}<br><span class="sub" style="font-size:13px">${esc(c.note)}</span></td><td>${esc(c.amount)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3">No line items drawn from this record yet.</td></tr>`;
  return `<section class="page">
  <div>
    <h2>Format and solicitation</h2>
    <p class="sub">${esc(f.mode === "sf1449" ? "SF 1449 streamlined" : "Uniform Contract Format")} · ${esc(f.formatLabel)}. Read from the record; this is scaffolding, not a signed form.</p>
    <table class="clauses" style="margin-top:20px"><thead><tr><th>CLIN</th><th>Description</th><th>Amount</th></tr></thead><tbody>${clinRows}</tbody></table>
    <div class="grid" style="margin-top:24px;grid-template-columns:repeat(2,minmax(0,1fr))">
      <div>
        <p class="sub">Instructions to offerors</p>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:14px">${f.instructions.map(line).join("")}</ul>
      </div>
      <div>
        <p class="sub">${esc(f.evaluation.mode === "competitive" ? "Evaluation factors" : "Evaluation on a sole-source file")}</p>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:14px">${f.evaluation.lines.map(line).join("")}</ul>
      </div>
    </div>
    ${sectionKBlock(input)}
  </div>
  ${mark}
</section>`;
}

/** Companion gates that apply, with the status the file can honestly show. */
function gatesPage(input: BriefingInput, mark: string): string {
  const gates = input.gates ?? [];
  if (gates.length === 0) return "";
  const rows = gates
    .map(
      (g) =>
        `<tr><td>${esc(g.name)}</td><td>${esc(g.status)}</td><td>${esc(g.trigger)}<br><span class="sub" style="font-size:13px">${esc(g.citation)}</span></td><td>${esc(g.evidence)}</td></tr>`,
    )
    .join("");
  return `<section class="page">
  <div>
    <h2>Companion gates</h2>
    <p class="sub">Gates that apply to this record, read from the seeded review rules. A gate is a checklist for the officer; it does not place the file on hold.</p>
    <table class="clauses" style="margin-top:20px"><thead><tr><th>Gate</th><th>Status</th><th>What triggers it</th><th>What the file shows</th></tr></thead><tbody>${rows}</tbody></table>
  </div>
  ${mark}
</section>`;
}

/** Same compact, advisory Board brief shown in the Evaluation cockpit. */
function boardReadinessPage(input: BriefingInput, mark: string): string {
  const readiness = input.boardReadiness;
  if (!readiness) return "";
  const rows = boardReadinessItems(readiness)
    .map((item) => `<tr><th scope="row">${esc(item.label)}</th><td>${esc(item.value)}</td></tr>`)
    .join("");
  const findings = readiness.lamp.findings.length
    ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:14px">${readiness.lamp.findings.map((finding) => `<li>${esc(finding)}</li>`).join("")}</ul>`
    : `<p class="sub" style="margin-top:8px">No L↔M findings recorded.</p>`;
  return `<section class="page">
  <div>
    <h2>Board readiness</h2>
    <p><span class="chip">${esc(readiness.methodLabel)}</span></p>
    <p class="sub" style="margin-top:8px">${esc(readiness.methodVoice)}</p>
    <p class="sub" style="margin-top:8px">The same advisory snapshot shown in the Evaluation cockpit.</p>
    <table style="margin-top:20px"><tbody>${rows}</tbody></table>
    ${findings}
    <p class="sub" style="margin-top:20px">Briefing aid only. Nothing here holds the file or a phase exit.</p>
  </div>
  ${mark}
</section>`;
}


/** The schedule of line items, counted, with the method shell and Section J. */
function schedulePage(input: BriefingInput, mark: string): string {
  const rows = input.clins ?? [];
  const body = rows.length
    ? rows
        .map(
          (c) =>
            `<tr><td>${esc(c.clin)}</td><td>${esc(c.description)}<br><span class="sub" style="font-size:13px">${esc(c.note)}</span></td><td>${esc(c.amount)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3">No line items drawn from this record yet.</td></tr>`;
  const method = input.methodShellLabel
    ? `${input.methodShellLabel}${
        input.competitive === null || input.competitive === undefined
          ? ""
          : input.competitive
            ? " · competitive"
            : " · sole source"
      }`
    : "Method not recorded on this file.";
  const jCount = input.sectionJCount ?? 0;
  const a = input.assemblyCounts ?? null;
  const assemblyBlock = a
    ? `<div style="margin-top:24px">
        <p class="sub">Contract-file assembly (NF 1098)</p>
        <p style="margin:6px 0 0;font-size:14px">${esc(a.presentTabs)} tabs present · ${esc(a.missingTabs)} required tabs missing · ${esc(a.recorded)} enclosures recorded · ${esc(a.notRecorded)} not recorded.</p>
        <p class="sub" style="margin-top:6px">Advisory only. NCMS is the system of record; T-Minus does not write to NCMS and this checklist does not hold phase exit.</p>
      </div>`
    : "";
  return `<section class="page">
  <div>
    <h2>Schedule and handoff</h2>
    <p class="sub">Line items on the record: ${esc(rows.length)}.</p>
    <table class="clauses" style="margin-top:20px"><thead><tr><th>CLIN</th><th>Description</th><th>Amount</th></tr></thead><tbody>${body}</tbody></table>
    <p class="sub" style="margin-top:24px">Method: ${esc(method)}</p>
    <p class="sub" style="margin-top:8px">Section J attachments on the record: ${esc(jCount)}</p>
    ${assemblyBlock}
    <p class="sub" style="margin-top:8px">${esc(AWARD_HANDOFF_POINTER)}</p>
  </div>
  ${mark}
</section>`;
}

export function buildBriefingHtml(input: BriefingInput, stamp: string): string {
  const mark = markPage(input, stamp);
  const countdown = input.countdown;
  const daysLine = countdown
    ? countdown.days === null
      ? countdown.caption
      : countdown.mode === "forecast"
        ? "FORECAST · no target award date recorded"
        : countdown.mode === "hold"
          ? "HOLD"
          : countdown.mode === "launched"
            ? `${countdown.days} days since award`
            : countdown.mode === "overdue"
              ? `OVERDUE · ${countdown.days} days past the target award date`
              : countdown.mode === "running"
                ? `${countdown.days} days to the target award date`
                : countdown.caption
    : input.days === null
      ? "No countdown recorded"
      : input.clockState === "launched"
        ? `${input.days} days since award`
        : input.days < 0
          ? `${Math.abs(input.days)} days past target`
          : `${input.days} days to the target award date`;
  const countdownFigure = countdown
    ? countdown.days === null || !countdown.prefix ? "—" : `${countdown.prefix} ${countdown.days}`
    : input.days === null ? "—" : String(Math.abs(input.days));
  const clockSubLine = `${input.currentPhase} · ${input.clockState}${
    input.targetAwardDate
      ? ` · target ${input.targetAwardDate}`
      : ` · Target award date: ${ANTICIPATED_AWARD_TBD}. ${ANTICIPATED_AWARD_TBD_NOTE}`
  }`;

  const factRows = input.facts
    .map((f) => `<tr><th scope="row">${esc(f.label)}</th><td>${esc(f.value)}</td></tr>`)
    .join("");

  const clauseRows = input.exampleClauses.length
    ? input.exampleClauses
        .map(
          (c) =>
            `<tr><td>${esc(c.clause_number)}</td><td>${esc(c.title ?? "—")}</td><td>${esc(c.ucf_section ?? "—")}</td><td>${esc(c.reason ?? "—")}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4">No clauses recommended from this record yet.</td></tr>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Briefing book — ${esc(input.acquisitionId)}</title>
<style>
  @page { size: letter landscape; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #1D1D1F; background: #F5F7FB; margin: 0; font-size: 15px; line-height: 22px; font-variant-numeric: tabular-nums; }
  .page { background: #FFFFFF; width: 10in; min-height: 7in; margin: 24px auto; padding: 48px 56px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #D9DEE8; }
  .mark { display: flex; justify-content: space-between; gap: 24px; font-size: 12px; color: #5B6478; border-top: 1px solid #D9DEE8; padding-top: 10px; margin-top: 32px; }
  h1 { font-size: 40px; line-height: 46px; font-weight: 600; margin: 0 0 8px; }
  h2 { font-size: 24px; line-height: 30px; font-weight: 600; margin: 0 0 24px; }
  .sub { font-size: 18px; line-height: 24px; color: #5B6478; margin: 0; }
  .figure { font-size: 52px; line-height: 56px; font-weight: 600; margin: 0; }
  .band { background: #0F2A5B; color: #FFFFFF; padding: 28px 32px; }
  .band p.sub { color: #B8C4DE; }
  .chip { display: inline-block; font-size: 12px; border: 1px solid #D9DEE8; border-radius: 8px; padding: 2px 8px; color: #5B6478; margin-right: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border-bottom: 1px solid #D9DEE8; text-align: left; padding: 8px 12px 8px 0; vertical-align: top; }
  th[scope="row"] { width: 34%; font-weight: 500; color: #5B6478; }
  .clauses th:first-child, .clauses td:first-child { width: 15%; white-space: nowrap; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
  @media print { body { background: #fff; } .page { margin: 0; border: 0; page-break-after: always; } }
</style></head><body>

<section class="page">
  <div>
    <span class="chip">${input.isSample ? "Sample" : "Record"}</span><span class="chip">Synthetic</span>
    <h1>${esc(input.title)}</h1>
    <p class="sub">${esc(input.acquisitionId)}${input.missionName ? ` · ${esc(input.missionName)}` : ""}${input.centerName ? ` · ${esc(input.centerName)}` : ""}</p>
    <p class="sub" style="margin-top:24px">Briefing book prepared from the acquisition record.</p>
  </div>
  ${mark}
</section>

<section class="page">
  <div>
    <h2>Where the clock stands</h2>
    <div class="band">
      <p class="figure">${esc(countdownFigure)}</p>
      <p class="sub">${esc(daysLine)}</p>
      <p class="sub" style="margin-top:12px">${esc(clockSubLine)}</p>
    </div>
    <div style="margin-top:28px">
      <p class="sub">Next action</p>
      <p style="font-size:20px;line-height:28px;margin:4px 0 0">${esc(input.nextAction)}</p>
      ${
        input.blocker && input.blocker !== "None"
          ? `<p class="sub" style="margin-top:16px">Blocker</p><p style="font-size:18px;line-height:26px;margin:4px 0 0">${esc(input.blocker)}${input.blockerOwner ? ` — ${esc(input.blockerOwner)}` : ""}</p>`
          : `<p class="sub" style="margin-top:16px">No required item is outstanding in this phase.</p>`
      }
    </div>
  </div>
  ${mark}
</section>

<section class="page">
  <div>
    <h2>Key facts</h2>
    <table><tbody>${factRows}</tbody></table>
  </div>
  ${mark}
</section>

<section class="page">
  <div>
    <h2>Clause position</h2>
    <p class="sub">${esc(input.recommendedClauseCount)} clauses recommended from this record${
      input.appliedClauseCount === null ? "" : `; ${esc(input.appliedClauseCount)} applied to the file`
    }. Clauses removed under the RFO are never offered, and FAR 52.212-5 is Reserved.</p>
    <table class="clauses" style="margin-top:20px"><thead><tr><th>Clause</th><th>Title</th><th>Section</th><th>Why it applies</th></tr></thead><tbody>${clauseRows}</tbody></table>
    <p class="sub" style="margin-top:24px">NCMS remains the system of record. The handoff packet is a local file; T-Minus does not write to NCMS.</p>
  </div>
  ${mark}
</section>

${schedulePage(input, mark)}
${formatPage(input, mark)}
${boardReadinessPage(input, mark)}
${gatesPage(input, mark)}


</body></html>`;
}

export async function exportBriefingBook(input: BriefingInput, actor: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const html = buildBriefingHtml(input, stamp);
  const fileName = `briefing-book-${input.acquisitionId}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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
    acquisition_id: input.acquisitionId,
    actor,
    action: "Briefing book exported",
    field: "briefing_book",
    old_value: "",
    new_value: fileName,
    reason: "Synthetic briefing pack built from the record",
  });

  return fileName;
}
