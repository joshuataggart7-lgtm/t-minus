/**
 * FPDS filling sheet.
 *
 * T-Minus does not connect to FPDS. This builds a printable sheet that lays
 * out the fields a person keys into FPDS, read only from the acquisition
 * record. Anything the record does not hold is printed as a blank with the
 * reason, never guessed. NCMS remains the peer system for writing the award
 * document (NFS 1804.171); this sheet only helps the human key accurately.
 */

import { supabase } from "@/integrations/supabase/client";
import { vehicleOf } from "@/lib/vehicles";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type FpdsFieldState = "recorded" | "blank" | "uncertain";

export type FpdsField = {
  /** The FPDS data element the person is keying. */
  label: string;
  /** Where the value came from on this file. */
  source: string;
  value: string;
  state: FpdsFieldState;
  note?: string;
};

export type FpdsSection = { name: string; fields: FpdsField[] };

export type FpdsSheet = {
  acquisitionId: string;
  title: string;
  isSample: boolean;
  sections: FpdsSection[];
  recordedCount: number;
  blankCount: number;
  uncertainCount: number;
};

const NOT_RECORDED = "Not recorded on this file";

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const money = (v: unknown): string | null => {
  const n = typeof v === "number" ? v : Number(str(v) ?? NaN);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

/** A field that is present, or an honest blank. */
function f(label: string, source: string, value: string | null, note?: string): FpdsField {
  return value
    ? { label, source, value, state: "recorded", ...(note ? { note } : {}) }
    : { label, source, value: NOT_RECORDED, state: "blank", ...(note ? { note } : {}) };
}

/** A field the record can suggest but the keyer must confirm against the award. */
function uncertain(label: string, source: string, value: string | null, note: string): FpdsField {
  if (!value) return { label, source, value: NOT_RECORDED, state: "blank", note };
  return { label, source, value, state: "uncertain", note: `Uncertain — confirm before keying. ${note}` };
}

export type FpdsInput = {
  acq: Record<string, unknown>;
  /** The date the file was marked Launched, when the lifecycle recorded one. */
  awardDate?: string | null;
  centerName?: string | null;
};

export function buildFpdsSheet(input: FpdsInput): FpdsSheet {
  const a = input.acq;
  const vehicle = vehicleOf(a);
  const launched = str(a["clock_state"]) === "launched";

  const sections: FpdsSection[] = [
    {
      name: "Document identity",
      fields: [
        f("PIID / contract number", "Contract number on the record", str(a["contract_number"])),
        f("Referenced IDV PIID (parent)", "Parent contract on the record", str(a["parent_contract_number"])),
        f("Solicitation / requisition (PR)", "PR number on the record", str(a["pr_number"])),
        f("T-Minus acquisition ID", "This file", str(a["acquisition_id"])),
        f("Award title / description", "Title on the record", str(a["title"])),
      ],
    },
    {
      name: "Vendor",
      fields: [
        f("Vendor legal name", "Vendor on the record", str(a["vendor_legal_name"])),
        f("Unique Entity ID (UEI)", "Vendor on the record", str(a["vendor_uei"])),
        f("CAGE code", "Vendor on the record", str(a["vendor_cage"])),
      ],
    },
    {
      name: "Classification",
      fields: [
        f("Product or Service Code (PSC)", "PSC on the record", str(a["psc_code"]), str(a["psc_note"]) ?? undefined),
        f("NAICS code", "NAICS on the record", str(a["naics_code"])),
        f("Contract type", "Contract type on the record", str(a["contract_type"]) ?? str(a["hybrid_contract_type"])),
        f("Contract format", "Format on the record", str(a["contract_format"])),
        f("Commercial products or services determination", "Commercial determination on the record", str(a["commercial_determination"])),
        f("Acquisition method", "Method on the record", str(a["acquisition_method"])),
      ],
    },
    {
      name: "Competition",
      fields: [
        f("Extent competed", "Competition on the record", str(a["competition"])),
        f("Set-aside", "Set-aside on the record", str(a["set_aside"]), "Blank means no set-aside is recorded, not that none applies."),
        f("Authority for other than full and open competition", "JOFOC authority on the record", str(a["jofoc_authority_citation"])),
        f("Fair opportunity (orders under an IDV)", "Vehicle profile on the record", vehicle.fair_opportunity ? String(vehicle.fair_opportunity) : null),
      ],
    },
    {
      name: "Dollars",
      fields: [
        f("Estimated value", "Estimate on the record", money(a["estimated_value"])),
        f("Proposed price received", "Quote or proposal on the record", money(a["proposed_price"])),
        uncertain(
          "Action obligation",
          "Derived from the recorded price",
          money(a["proposed_price"]) ?? money(a["estimated_value"]),
          "T-Minus does not hold the obligated amount; take it from the signed award.",
        ),
      ],
    },
    {
      name: "Dates and performance",
      fields: [
        launched
          ? f("Date signed / award date", "Recorded when the file was marked Launched", str(input.awardDate))
          : uncertain(
              "Date signed / award date",
              "Target award date on the record",
              str(a["target_award_date"]),
              "This file is not awarded yet; the target date is not the date signed.",
            ),
        f("Period of performance start", "Period of performance on the record", str(a["period_of_performance_start"])),
        f("Period of performance end", "Period of performance on the record", str(a["period_of_performance_end"])),
        f(
          "Principal place of performance",
          "Place of performance on the record",
          str(a["place_of_performance_standardized"]) ?? str(a["place_of_performance"]),
        ),
      ],
    },
    {
      name: "Contracting office",
      fields: [
        f("Center", "Center on the record", input.centerName ?? str(a["center_name"]) ?? str(a["center_code"])),
        f("Contracting officer", "CO on the record", str(a["co_name"])),
        f("Contracting officer code", "CO code on the record", str(a["co_code"])),
        f("Funding fiscal year", "Funding year on the record", str(a["funding_fiscal_year"])),
      ],
    },
  ];

  let recordedCount = 0;
  let blankCount = 0;
  let uncertainCount = 0;
  for (const s of sections)
    for (const field of s.fields) {
      if (field.state === "recorded") recordedCount += 1;
      else if (field.state === "blank") blankCount += 1;
      else uncertainCount += 1;
    }

  return {
    acquisitionId: String(a["acquisition_id"] ?? ""),
    title: str(a["title"]) ?? String(a["acquisition_id"] ?? ""),
    isSample: Boolean(a["is_seed"]),
    sections,
    recordedCount,
    blankCount,
    uncertainCount,
  };
}

const stateWord = (s: FpdsFieldState) =>
  s === "recorded" ? "Recorded" : s === "uncertain" ? "Confirm" : "Blank";

export function buildFpdsHtml(sheet: FpdsSheet, stamp: string): string {
  const mark = `<div class="mark"><span>${esc(sheet.acquisitionId)} · ${esc(stamp)}${
    sheet.isSample ? " · Sample data" : ""
  }</span><span>Prototype — not an official NASA system</span></div>`;

  const sections = sheet.sections
    .map(
      (s) => `<section class="block">
  <h2>${esc(s.name)}</h2>
  <table><thead><tr><th>FPDS field</th><th>Value to key</th><th>Status</th><th>Where it came from</th></tr></thead><tbody>
  ${s.fields
    .map(
      (fl) => `<tr class="${fl.state}"><th scope="row">${esc(fl.label)}</th><td>${esc(fl.value)}${
        fl.note ? `<br><span class="sub">${esc(fl.note)}</span>` : ""
      }</td><td>${esc(stateWord(fl.state))}</td><td>${esc(fl.source)}</td></tr>`,
    )
    .join("")}
  </tbody></table>
</section>`,
    )
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>FPDS filling sheet — ${esc(sheet.acquisitionId)}</title>
<style>
  @page { size: letter portrait; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #1D1D1F; background: #F5F7FB; margin: 0; font-size: 14px; line-height: 21px; font-variant-numeric: tabular-nums; }
  .sheet { background: #FFFFFF; max-width: 7.6in; margin: 24px auto; padding: 40px 44px; border: 1px solid #D9DEE8; }
  h1 { font-size: 28px; line-height: 34px; font-weight: 600; margin: 0 0 6px; }
  h2 { font-size: 18px; line-height: 24px; font-weight: 500; margin: 32px 0 8px; }
  .sub { font-size: 13px; line-height: 19px; color: #5B6478; }
  .banner { border: 1px solid #0F2A5B; background: #0F2A5B; color: #FFFFFF; padding: 14px 18px; margin: 20px 0 8px; }
  .banner p { margin: 0; }
  .banner .sub { color: #B8C4DE; }
  .count { margin: 16px 0 0; font-size: 14px; color: #5B6478; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; line-height: 18px; }
  th, td { border-bottom: 1px solid #D9DEE8; text-align: left; padding: 7px 10px 7px 0; vertical-align: top; }
  thead th { font-weight: 500; color: #5B6478; }
  th[scope="row"] { width: 28%; font-weight: 500; }
  tr.blank td:nth-child(2) { color: #5B6478; }
  tr.uncertain td:nth-child(3) { color: #B45309; }
  tr.blank td:nth-child(3) { color: #5B6478; }
  tr.recorded td:nth-child(3) { color: #1E8E3E; }
  .mark { display: flex; justify-content: space-between; gap: 24px; font-size: 12px; color: #5B6478; border-top: 1px solid #D9DEE8; padding-top: 10px; margin-top: 32px; }
  @media print { body { background: #fff; } .sheet { margin: 0; border: 0; max-width: none; padding: 0; } }
</style></head><body>
<div class="sheet">
  <h1>FPDS filling sheet</h1>
  <p class="sub">${esc(sheet.title)} · ${esc(sheet.acquisitionId)}${sheet.isSample ? " · Sample data" : ""}</p>
  <div class="banner">
    <p>Fill aid for FPDS — not a live FPDS submission.</p>
    <p class="sub">T-Minus does not connect to FPDS and does not write to NCMS. Values are read from this acquisition record; blanks are left blank on purpose. Confirm every line against the signed award before keying.</p>
  </div>
  <p class="count">${esc(sheet.recordedCount)} fields read from the record · ${esc(sheet.uncertainCount)} to confirm · ${esc(sheet.blankCount)} not recorded on this file.</p>
  ${sections}
  ${mark}
</div>
</body></html>`;
}

export async function exportFpdsFillingSheet(input: FpdsInput, actor: string): Promise<string> {
  const sheet = buildFpdsSheet(input);
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const html = buildFpdsHtml(sheet, stamp);
  const fileName = `fpds-filling-sheet-${sheet.acquisitionId}.html`;
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
    acquisition_id: sheet.acquisitionId,
    actor,
    action: "FPDS filling sheet exported",
    field: "fpds_filling_sheet",
    old_value: "",
    new_value: fileName,
    reason: `Fill aid built from the record; ${sheet.recordedCount} recorded, ${sheet.uncertainCount} to confirm, ${sheet.blankCount} blank. Not a live FPDS submission.`,
  });

  return fileName;
}
