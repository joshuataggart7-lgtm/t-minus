/**
 * SF 1449 as an AcroForm fill on the official blank.
 *
 * The blank in public/forms is the official GSA file. It carries a dynamic XFA
 * layer as well as an AcroForm layer. Free readers other than desktop Adobe
 * show an XFA form as a blank face, so this route removes the XFA layer first
 * and writes the AcroForm fields instead. The result opens with its values
 * visible in Adobe Reader, Chrome and Preview.
 *
 * The field names below are the names carried by the official blank and are
 * written exactly as the blank spells them. Signature blocks and award dates
 * stay empty: they are completed by the contracting officer. This is a
 * prototype export; no field-by-field Adobe check has been done.
 */

import type { FormCtx } from "@/lib/nf1787";
import { isStreamlined } from "@/lib/format-scaffold";

const P = "topmostSubform[0].Page1[0].";

export type RogerSf1449Data = Record<string, unknown>;

/** A value on the data object, by dotted path or plain key. */
export function getPath(data: RogerSf1449Data, path: string): unknown {
  if (path in data) return data[path];
  let node: unknown = data;
  for (const part of path.split(".")) {
    if (node === null || node === undefined || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const asText = (v: unknown): string =>
  v === null || v === undefined || typeof v === "boolean" ? "" : String(v).trim();

/** Write a text field. Empty values are skipped; a missing field is ignored. */
export function pdfText(
  form: import("pdf-lib").PDFForm,
  name: string,
  value: unknown,
  size = 8,
): void {
  const text = asText(value);
  if (!text) return;
  try {
    const field = form.getTextField(name);
    field.setText(text);
    try {
      field.setFontSize(size);
    } catch {
      /* the blank fixes the size on some fields */
    }
  } catch {
    /* the blank does not carry this field */
  }
}

/** Tick a check box. Only a true value writes; false leaves the box as it is. */
export function pdfCheck(form: import("pdf-lib").PDFForm, name: string, on: unknown): void {
  if (!on) return;
  try {
    form.getCheckBox(name).check();
  } catch {
    /* the blank does not carry this box */
  }
}

/** A money field, written the way the form prints amounts. */
export function pdfMoney(form: import("pdf-lib").PDFForm, name: string, value: unknown, size = 8): void {
  if (value === null || value === undefined || value === "") return;
  if (typeof value === "string") {
    pdfText(form, name, value, size);
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return;
  pdfText(form, name, n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }), size);
}

/** A recorded date as the form prints it. Empty when nothing is recorded. */
export function displayDate(value: unknown): string {
  const raw = asText(value);
  if (!raw) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : raw;
}

/**
 * The mapper. Field names are the official blank's own names and are not
 * renamed.
 */
export function fillOfficialSF1449(form: import("pdf-lib").PDFForm, d: RogerSf1449Data): void {
  // Blocks 1 to 9. Solicitation and issuing office.
  pdfText(form, `${P}reqnumber[0]`, getPath(d, "reqnumber"));
  pdfText(form, `${P}pagenumber[0]`, getPath(d, "pagenumber"));
  pdfText(form, `${P}contractno[0]`, getPath(d, "contractno"));
  pdfText(form, `${P}ordernumber[0]`, getPath(d, "ordernumber"));
  pdfText(form, `${P}solicitationnumber[0]`, getPath(d, "solicitationnumber"));
  pdfText(form, `${P}contactname[0]`, getPath(d, "contactname"));
  pdfText(form, `${P}contactphone[0]`, getPath(d, "contactphone"));
  pdfText(form, `${P}issuedbycode[0]`, getPath(d, "issuedbycode"));
  // Block 9 address box carries the office name.
  pdfText(form, `${P}TextField1[4]`, getPath(d, "issuedbyname"));

  // Block 10. Set-aside and size.
  pdfCheck(form, `${P}UNRESTRICTIONTED[0]`, getPath(d, "unrestricted"));
  pdfCheck(form, `${P}SETASIDE[0]`, getPath(d, "setaside"));
  pdfText(form, `${P}setasidepercent[0]`, getPath(d, "setasidepercent"));
  pdfCheck(form, `${P}SMALLBUSINESS[0]`, getPath(d, "smallbusiness0"));
  pdfCheck(form, `${P}SMALLBUSINESS[1]`, getPath(d, "smallbusiness1"));
  pdfCheck(form, `${P}SMALLBUSINESS[2]`, getPath(d, "smallbusiness2"));
  pdfCheck(form, `${P}SERVICEDISABLED[0]`, getPath(d, "servicedisabled"));
  pdfCheck(form, `${P}HUBZONESMALL[0]`, getPath(d, "hubzonesmall"));
  pdfText(form, `${P}NAICS[0]`, getPath(d, "naics"));
  pdfText(form, `${P}SIZESTANDARDS[0]`, getPath(d, "sizestandards"));

  // Blocks 11 to 18. Delivery, administration and contractor.
  pdfText(form, `${P}rating[0]`, getPath(d, "rating"));
  pdfText(form, `${P}discountterms[0]`, getPath(d, "discountterms"));
  pdfText(form, `${P}DeliverTo[0]`, getPath(d, "deliverto"));
  pdfText(form, `${P}AdministeredBy[0]`, getPath(d, "administeredby"));
  pdfText(form, `${P}AdministeredByCode[0]`, getPath(d, "administeredbycode"));
  pdfText(form, `${P}contractoraddress[0]`, getPath(d, "contractoraddress"));
  pdfText(form, `${P}contractorcode[0]`, getPath(d, "contractorcode"));
  pdfText(form, `${P}contractorphone[0]`, getPath(d, "contractorphone"));
  pdfText(form, `${P}paymentbyaddress[0]`, getPath(d, "paymentbyaddress"));

  // Blocks 19 to 24. Schedule. Row one carries the priced line; the rows below
  // carry the narrative only.
  for (let i = 1; i <= 8; i += 1) {
    pdfText(form, `${P}ITEMNUM${i}[0]`, getPath(d, `itemnum${i}`));
    pdfText(form, `${P}schedule${i}[0]`, getPath(d, `schedule${i}`));
    pdfText(form, `${P}quantity${i}[0]`, getPath(d, `quantity${i}`));
    pdfText(form, `${P}unit${i}[0]`, getPath(d, `unit${i}`));
    pdfMoney(form, `${P}unitprice${i}[0]`, getPath(d, `unitprice${i}`));
    pdfMoney(form, `${P}amount${i}[0]`, getPath(d, `amount${i}`));
  }

  // Blocks 25 to 31. Accounting, award and signature blocks.
  pdfText(form, `${P}accountingdata[0]`, getPath(d, "accountingdata"));
  pdfMoney(form, `${P}TOTALAWARD[0]`, getPath(d, "totalaward"));
  pdfText(form, `${P}numberofcopies[0]`, getPath(d, "numberofcopies"));
  pdfText(form, `${P}offerreference[0]`, getPath(d, "offerreference"));
  pdfText(form, `${P}exceptions[0]`, getPath(d, "exceptions"));
  pdfText(form, `${P}signername[0]`, getPath(d, "signername"));
  pdfText(form, `${P}signertitle[0]`, getPath(d, "signertitle"));
  pdfText(form, `${P}contractingofficer[0]`, getPath(d, "contractingofficer"));
  pdfText(form, `${P}AWARDDate[0]`, displayDate(getPath(d, "awarddate")));

  // Solicitation type and addendum boxes.
  pdfCheck(form, `${P}RFQ[0]`, getPath(d, "rfq"));
  pdfCheck(form, `${P}RFP[0]`, getPath(d, "rfp"));
  pdfCheck(form, `${P}FB[0]`, getPath(d, "ifb"));
  pdfCheck(form, `${P}SEEADDENDUM[0]`, getPath(d, "seeaddendum"));
  pdfCheck(form, `${P}SEESCHEDULE[0]`, getPath(d, "seeschedule"));
  pdfCheck(form, `${P}THISCONTRACT[0]`, getPath(d, "thiscontract"));
  pdfCheck(form, `${P}CheckBox1[0]`, getPath(d, "checkbox1_0"));
  pdfCheck(form, `${P}CheckBox1[1]`, getPath(d, "checkbox1_1"));
  pdfCheck(form, `${P}CheckBox1[2]`, getPath(d, "checkbox1_2"));
  pdfCheck(form, `${P}CheckBox1[3]`, getPath(d, "checkbox1_3"));
  pdfCheck(form, `${P}are1[0]`, getPath(d, "are1"));
  pdfCheck(form, `${P}arenot1[0]`, getPath(d, "arenot1"));
  pdfCheck(form, `${P}are2[0]`, getPath(d, "are2"));
  pdfCheck(form, `${P}arenot2[0]`, getPath(d, "arenot2"));
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

/**
 * The record as the AcroForm mapper reads it. The schedule rule is the one the
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
  const office = [str(a["center_name"]) || str(a["center_code"]), str(a["branch_code"])]
    .filter(Boolean)
    .join(", ");

  const firstClin =
    (ctx.clins ?? []).find((c) => /^0*1$/.test(c.clinNumber.replace(/\D/g, "") || "x")) ??
    (ctx.clins ?? [])[0] ??
    null;
  const qty = firstClin?.quantity ?? null;
  const unitPrice = firstClin?.unitPrice ?? null;
  const multipliesOut =
    qty !== null && unitPrice !== null && price > 0 && Math.abs(qty * unitPrice - price) < 0.5;
  const singleLotLine = !multipliesOut && commercial && price > 0;

  const narrative = [description, pop ? `Period of performance ${pop}.` : ""].filter(Boolean).join(" ");
  const scheduleLines = wrapLines(narrative, 52, 8);

  const partialSetAside = /partial/i.test(setAside);
  const totalSmallBusiness = Boolean(setAside) && !partialSetAside;

  const data: RogerSf1449Data = {
    reqnumber: str(a["pr_number"]) || str(a["acquisition_id"]),
    pagenumber: "1",
    contractno: str(a["contract_number"]),
    ordernumber: str(a["order_number"]),
    solicitationnumber: str(a["solicitation_number"]),
    contactname: str(a["co_name"]),
    contactphone: str(a["co_phone"]),
    // Block 9 keeps the short code in the code box and the office name beside it.
    issuedbycode: str(a["center_code"]),
    issuedbyname: office,

    unrestricted: !setAside,
    setaside: Boolean(setAside),
    smallbusiness2: totalSmallBusiness,
    // Block 10 carries a number, never prose.
    setasidepercent: totalSmallBusiness ? "100" : "",
    naics: str(a["naics_code"]),
    sizestandards: ctx.sizeStandard
      ? ctx.sizeStandard.standardType === "employees"
        ? `${ctx.sizeStandard.employees ?? ""} employees`
        : dollars(ctx.sizeStandard.receiptsUsd)
      : "",

    rating: str(a["dpas_rating"]),
    deliverto: place,
    administeredby: office,
    contractoraddress: str(a["awardee_name"]) || str(a["intended_awardee_name"]),
    contractorcode: str(a["awardee_uei"]) || str(a["intended_awardee_uei"]),
    paymentbyaddress: str(a["payment_office"]),

    itemnum1: "0001",
    quantity1: multipliesOut ? String(qty) : singleLotLine ? "1" : "",
    unit1: multipliesOut ? str(firstClin?.unit) : singleLotLine ? "Lot" : "",
    unitprice1: multipliesOut ? dollars(unitPrice) : singleLotLine ? dollars(price) : "",
    amount1: dollars(price || a["estimated_value"]),
    totalaward: dollars(price),

    accountingdata: str(a["funding_source"]),
    contractingofficer: str(a["co_name"]),
    // Signature blocks and the award date are completed by the contracting
    // officer, so they stay empty here.
    awarddate: "",
    signername: "",
    signertitle: "",
  };

  scheduleLines.forEach((line, i) => {
    data[`schedule${i + 1}`] = line;
  });

  return data;
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
