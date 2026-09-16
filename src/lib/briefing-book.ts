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
};


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

export function buildBriefingHtml(input: BriefingInput, stamp: string): string {
  const mark = markPage(input, stamp);
  const daysLine =
    input.days === null
      ? "No countdown recorded"
      : input.clockState === "launched"
        ? `${input.days} days since award`
        : `${input.days} days to the target award date`;

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
      <p class="figure">${input.days === null ? "—" : esc(Math.abs(input.days))}</p>
      <p class="sub">${esc(daysLine)}</p>
      <p class="sub" style="margin-top:12px">${esc(input.currentPhase)} · ${esc(input.clockState)}${input.targetAwardDate ? ` · target ${esc(input.targetAwardDate)}` : ""}</p>
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
