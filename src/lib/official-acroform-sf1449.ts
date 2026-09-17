/**
 * SF 1449 as an AcroForm fill on the official blank.
 *
 * The blank in public/forms is the official GSA file. It carries a dynamic XFA
 * layer as well as an AcroForm layer. Free readers other than desktop Adobe
 * show an XFA form as a blank face, so this route removes the XFA layer first
 * and writes the AcroForm fields instead. The result opens with its values
 * visible in Adobe Reader, Chrome and Preview.
 *
 * Which box each value lands in is no longer written here: the field names
 * live as rows in form-field-mappings, the same shape a table will carry. This
 * file only turns the record into the values those rows read. Signature blocks
 * and award dates stay empty: they are completed by the contracting officer.
 * This is a prototype export; no field-by-field Adobe check has been done.
 */

import type { FormCtx } from "@/lib/nf1787";
import { isStreamlined } from "@/lib/format-scaffold";
import { mappingsFor } from "@/lib/form-field-mappings";
import {
  applyFormMappings,
  displayDate,
  getPath,
  pdfCheck,
  pdfMoney,
  pdfText,
} from "@/lib/apply-form-mappings";

export { displayDate, getPath, pdfCheck, pdfMoney, pdfText };

export type RogerSf1449Data = Record<string, unknown>;

/** The mapper. It writes the mapping rows for this blank, nothing more. */
export function fillOfficialSF1449(form: import("pdf-lib").PDFForm, d: RogerSf1449Data): void {
  applyFormMappings(form, mappingsFor("sf1449", "11/2021"), d);
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

const dollars = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n) || !v) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
};

/** Text broken into at most `rows` lines of about `width` characters. */
const wrapLines = (text: string, width: number, rows: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
    if (lines.length === rows) break;
  }
  if (line && lines.length < rows) lines.push(line);
  return lines.slice(0, rows);
};

/** The set-aside programmes block 10 carries, one key only. */
export type SetAsideKey =
  | "unrestricted"
  | "edwosb"
  | "wosb"
  | "sdvosb"
  | "hubzone"
  | "eight_a"
  | "small_business";

/**
 * The recorded set-aside read as one programme. The order matters: the most
 * specific programme wins, so an economically disadvantaged women-owned
 * set-aside never also ticks the women-owned box.
 */
export function setAsideKey(recorded: unknown): SetAsideKey {
  const t = str(recorded).toLowerCase();
  if (!t) return "unrestricted";
  if (/\bedwosb\b/.test(t) || /economically disadvantaged women/.test(t)) return "edwosb";
  if (/\bwosb\b/.test(t) || /women[- ]owned/.test(t)) return "wosb";
  if (/\bsdvosb\b/.test(t) || /service[- ]disabled/.test(t)) return "sdvosb";
  if (/hubzone/.test(t) || /hub zone/.test(t)) return "hubzone";
  if (/8\s*\(?a\)?/.test(t) || /\b8a\b/.test(t) || /eight\s*\(?a\)?/.test(t)) return "eight_a";
  if (/small business/.test(t) || /\btotal\b/.test(t)) return "small_business";
  return "small_business";
}

/** One true flag when a programme is recorded, all false when unrestricted. */
export function setAsideFlags(recorded: unknown): Record<string, boolean> {
  const key = setAsideKey(recorded);
  return {
    wosb: key === "wosb",
    edwosb: key === "edwosb",
    sdvosb: key === "sdvosb",
    hubzone: key === "hubzone",
    eight_a: key === "eight_a",
    small_business: key === "small_business",
  };
}

/** The priced face line, reconciled or left empty. */
export function faceLine(
  clin: { quantity?: number | null; unit?: string | null; unitPrice?: number | null } | null,
  faceAmount: number,
  commercial: boolean,
): { quantity: string; unit: string; unit_price: string; amount: string } {
  const qty = clin?.quantity ?? null;
  const unitPrice = clin?.unitPrice ?? null;
  if (qty !== null && unitPrice !== null && faceAmount > 0 && Math.abs(qty * unitPrice - faceAmount) < 0.5) {
    return {
      quantity: String(qty),
      unit: str(clin?.unit),
      unit_price: dollars(unitPrice),
      amount: dollars(faceAmount),
    };
  }
  if (commercial && faceAmount > 0) {
    return { quantity: "1", unit: "Lot", unit_price: dollars(faceAmount), amount: dollars(faceAmount) };
  }
  // Nothing reconciles: the priced columns stay empty for the contracting
  // officer rather than carrying an amount with no quantity behind it.
  return { quantity: "", unit: "", unit_price: "", amount: "" };
}

/** A money string read back as a number. */
const moneyValue = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Whether the schedule lines add up to the total the form carries. Soft: this
 * reports, it never blocks a draft.
 */
export function validateSf1449ClinReconciliation(
  data: RogerSf1449Data,
): { ok: true } | { ok: false; message: string } {
  const rows = (data["schedule"] as Record<string, string>[] | undefined) ?? [];
  const lines = rows.reduce((sum, row) => sum + moneyValue(row["amount"]), 0);
  const total = moneyValue((data["award"] as Record<string, unknown> | undefined)?.["total_amount"]);
  if (lines === 0 && total === 0) return { ok: true };
  if (Math.abs(lines - total) <= 0.01) return { ok: true };
  return {
    ok: false,
    message: `The schedule shows discrepancy ${dollars(lines)} vs ${dollars(total)} on the total award amount.`,
  };
}

/**
 * The record as the mapping rows read it. The schedule rule is the one the
 * generated form already follows: quantity, unit and unit price print only
 * when quantity times unit price equals the amount; a commercial firm fixed
 * price face otherwise prints as one lot at the face amount. A quantity is
 * never invented from hours.
 */
export function sf1449CtxToRogerData(ctx: FormCtx): RogerSf1449Data {
  const a = ctx.acq;
  const commercial = isStreamlined(a);
  const setAside = str(a["set_aside"]);
  const pop = [str(a["period_of_performance_start"]), str(a["period_of_performance_end"])]
    .filter(Boolean)
    .join(" to ");
  const place = str(a["place_of_performance_standardized"]) || str(a["place_of_performance"]);
  const price = Number(a["proposed_price"]) || Number(a["award_amount"]) || 0;
  const description = str(a["description_of_requirement"]) || str(a["title"]);
  // Block 9: the code box carries the short centre code, the block beside it
  // carries the centre name and branch.
  const officeName = [str(a["center_name"]) || str(a["center_code"]), str(a["branch_code"])]
    .filter(Boolean)
    .join(", ");

  const firstClin =
    (ctx.clins ?? []).find((c) => /^0*1$/.test(c.clinNumber.replace(/\D/g, "") || "x")) ??
    (ctx.clins ?? [])[0] ??
    null;
  const priced = faceLine(firstClin, price, commercial);

  // Block 20: the short requirement title on the priced row, the narrative
  // beneath it.
  const title = str(a["title"]) || str(firstClin?.description) || description;
  const narrative = [description, pop ? `Period of performance ${pop}.` : ""].filter(Boolean).join(" ");
  const narrativeLines = wrapLines(narrative, 52, 7);

  const flags = setAsideFlags(setAside);
  const partialSetAside = /partial/i.test(setAside);
  const totalSmallBusiness = Boolean(setAside) && !partialSetAside;

  const schedule: Record<string, string>[] = [
    {
      item_number: "0001",
      description: wrapLines(title, 52, 1)[0] ?? "",
      ...priced,
    },
    ...narrativeLines.map((line) => ({ description: line })),
  ];

  const method = commercial ? "rfq" : "rfp";
  const coName = str(a["co_name"]);

  return {
    requisition: { number: str(a["pr_number"]) || str(a["acquisition_id"]) },
    pagination: { page: "1", pages: "" },
    contract: {
      number: str(a["contract_number"]),
      // The award date is completed by the contracting officer.
      award_effective_date: "",
    },
    order: { number: str(a["order_number"]) },
    solicitation: {
      number: str(a["solicitation_number"]),
      issue_date: str(a["solicitation_issue_date"]),
      offer_due_local: str(a["offers_due"]),
      contact: { name: coName, phone: str(a["co_phone"]) },
      method,
    },
    issuing_office: { code: str(a["center_code"]), name_address: officeName },

    acquisition: {
      restriction: setAside ? "set_aside" : "unrestricted",
      set_aside_program: setAsideKey(setAside),
      set_aside_flags: flags,
      // Block 10 carries a number, never prose.
      set_aside_percent: totalSmallBusiness ? "100" : "",
      naics: str(a["naics_code"]),
      size_standard: ctx.sizeStandard
        ? ctx.sizeStandard.standardType === "employees"
          ? `${ctx.sizeStandard.employees ?? ""} employees`
          : dollars(ctx.sizeStandard.receiptsUsd)
        : "",
    },


    dpas: { is_rated_order: Boolean(str(a["dpas_rating"])), rating: str(a["dpas_rating"]) },
    delivery: {
      see_schedule: true,
      deliver_to: { name_address: place, code: "" },
    },
    administering_office: { name_address: officeName, code: str(a["center_code"]) },
    contractor: {
      name_address: str(a["awardee_name"]) || str(a["intended_awardee_name"]),
      code: str(a["awardee_uei"]) || str(a["intended_awardee_uei"]),
      facility_code: str(a["awardee_cage"]) || str(a["intended_awardee_cage"]),
      phone: str(a["awardee_phone"]) || str(a["intended_awardee_phone"]),
      remittance_differs: false,
    },
    payment: { office: { code: "", name_address: str(a["payment_office"]) } },

    schedule,
    accounting: { data: str(a["funding_source"]) },
    award: { total_amount: dollars(price) },
    offer: {
      copies: "",
      reference: "",
      exceptions: "",
      discount_terms: str(a["discount_terms"]),
    },
    invoice: { see_addendum: commercial },

    clauses: {
      mode: commercial ? "addendum" : "schedule",
      box1_0: false,
      box1_1: false,
      box1_2: false,
      box1_3: false,
      are1: false,
      arenot1: commercial,
      are2: false,
      arenot2: commercial,
    },

    // Signature blocks stay empty: a person signs them.
    signer: { contracting_officer: coName, name: "", title: "" },
  };
}

/**
 * The official blank, its XFA layer removed and its AcroForm fields filled.
 * The order matters: the XFA layer is deleted before any value is written, or
 * readers keep showing the empty XFA face.
 */
export async function generateOfficialSf1449Pdf(
  ctx: FormCtx,
  options: { flatten?: boolean } = {},
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const response = await fetch("/forms/SF1449.pdf");
  if (!response.ok) throw new Error(`The blank form did not load (${response.status}).`);
  const pdf = await PDFDocument.load(await response.arrayBuffer());

  const form = pdf.getForm();
  try {
    form.deleteXFA();
  } catch {
    /* the blank carries no XFA layer */
  }

  fillOfficialSF1449(form, sf1449CtxToRogerData(ctx));

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(font);
  if (options.flatten) {
    try {
      form.flatten();
    } catch {
      /* a field without an appearance is left as it is */
    }
  }
  return pdf.save();
}

/** Save the bytes to the reader's machine. */
export function downloadPdfBytes(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
