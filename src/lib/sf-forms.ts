/**
 * SF 1449 (Solicitation/Contract/Order for Commercial Products and Commercial
 * Services) and SF 30 (Amendment of Solicitation/Modification of Contract) as
 * generated forms.
 *
 * The blank forms in public/forms are the official GSA files, downloaded from
 * gsa.gov and served unchanged. Field paths below are the paths in each form's
 * own XFA template, so the populated export is the official form carrying the
 * record's values. Nothing is typed twice, and nothing is written outside
 * T-Minus: the solicitation and the contract of record are built in NCMS
 * (NFS 1804.171).
 *
 * Signature blocks and award dates are deliberately left blank. They are
 * completed by the contracting officer.
 */

import type { FormClin, FormCtx, FormSection, FormValue, GeneratedForm } from "@/lib/nf1787";
import { isStreamlined } from "@/lib/format-scaffold";
import { faceLine, setAsideFlags } from "@/lib/official-acroform-sf1449";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

const dollars = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n) || !v) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
};

const TO_COMPLETE = (what: string) => `[Contracting officer to complete: ${what}]`;

const field = (path: string, label: string, value: FormValue, gap?: string) =>
  (gap === undefined ? { path, label, value } : { path, label, value, gap });

const issuedBy = (a: Record<string, unknown>): string =>
  [str(a["center_name"]) || str(a["center_code"]), str(a["branch_code"])].filter(Boolean).join(", ");

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

/** SF 1449, filled from the acquisition record. */
export function buildSf1449(ctx: FormCtx): GeneratedForm {
  const a = ctx.acq;
  const commercial = isStreamlined(a);
  const setAside = str(a["set_aside"]);
  const competition = str(a["competition"]).toLowerCase();
  const pop = [str(a["period_of_performance_start"]), str(a["period_of_performance_end"])]
    .filter(Boolean)
    .join(" to ");
  const place = str(a["place_of_performance_standardized"]) || str(a["place_of_performance"]);
  const price = Number(a["proposed_price"]) || Number(a["award_amount"]) || 0;
  const description = str(a["description_of_requirement"]) || str(a["title"]);
  // Block 21 to 23 read the first line of the schedule on the file. Nothing is
  // shown when the schedule does not carry the value.
  const firstClin =
    (ctx.clins ?? []).find((c) => /^0*1$/.test(c.clinNumber.replace(/\D/g, "") || "x")) ??
    (ctx.clins ?? [])[0] ??
    null;

  // Quantity, unit and unit price only print when quantity times unit price
  // equals the amount on the form. A line that does not multiply out is left
  // blank for the contracting officer rather than carrying a quantity the
  // record does not support. A commercial firm fixed price buy prints as a
  // single lot at the face amount when no single CLIN line multiplies out; how
  // the work is measured stays in the block 20 narrative. The number of IGCE
  // estimate rows behind the file does not change the face line.
  const priced = faceLine(firstClin, price, commercial);
  const lineQuantity = priced.quantity;
  const lineUnit = priced.unit;
  const lineUnitPrice = priced.unit_price;
  const lineAmount = priced.amount;
  // Block 20 carries the short requirement title on the priced row and the
  // narrative beneath it.
  const title = str(a["title"]) || str(firstClin?.description) || description;
  const narrative = [description, pop ? `Period of performance ${pop}.` : ""].filter(Boolean).join(" ");
  const scheduleLines = [wrapLines(title, 52, 1)[0] ?? "", ...wrapLines(narrative, 52, 7)];

  // Block 10 carries a number, not prose. A total small business set-aside is
  // the whole requirement.
  const partialSetAside = /partial/i.test(setAside);
  const totalSmallBusiness = Boolean(setAside) && !partialSetAside;
  const setAsidePercent = totalSmallBusiness ? "100" : "";
  const saFlags = setAsideFlags(setAside);

  const sections: FormSection[] = [
    {
      title: "Blocks 1 to 9. Solicitation and issuing office",
      citation: "FAR 12.204(a); FAR 53.212",
      fields: [
        field("topmostSubform.reqnumber", "Requisition number (block 1)", str(a["pr_number"]) || str(a["acquisition_id"])),
        field(
          "topmostSubform.contractno",
          "Contract number (block 2)",
          str(a["contract_number"]),
          str(a["contract_number"]) ? undefined : "Assigned in NCMS at award.",
        ),
        field("topmostSubform.ordernumber", "Order number (block 4)", str(a["order_number"])),
        field(
          "topmostSubform.solicitationnumber",
          "Solicitation number (block 5)",
          str(a["solicitation_number"]),
          str(a["solicitation_number"]) ? undefined : "Assigned in NCMS when the solicitation issues.",
        ),
        // Block 9 carries the office code in the code box and the office name
        // in the address box beside it.
        field("topmostSubform.issuedbycode", "Issued by code (block 9)", str(a["center_code"])),
        field(
          "topmostSubform.TextField1[4]",
          "Issued by (block 9)",
          issuedBy(a) || TO_COMPLETE("record the issuing office"),
        ),
        field("topmostSubform.contactname", "Point of contact (block 7)", str(a["co_name"])),
        field("topmostSubform.contactphone", "Telephone (block 7)", str(a["co_phone"])),
        field("topmostSubform.pagenumber", "Page of pages (block 3)", "1"),
      ],
    },
    {
      title: "Blocks 10 to 12. Set-aside, NAICS and delivery",
      citation: "FAR 19.502-2; FAR 12.204(a)",
      fields: [
        field("topmostSubform.UNRESTRICTIONTED", "Unrestricted (block 10)", !setAside),
        field("topmostSubform.SETASIDE", "Set aside (block 10)", Boolean(setAside)),
        // One programme box only, read the same way the official export reads it.
        field("topmostSubform.SMALLBUSINESS[0]", "Women-owned small business (block 10)", saFlags["wosb"]),
        field(
          "topmostSubform.SMALLBUSINESS[1]",
          "Economically disadvantaged women-owned small business (block 10)",
          saFlags["edwosb"],
        ),
        field("topmostSubform.SERVICEDISABLED", "Service-disabled veteran-owned (block 10)", saFlags["sdvosb"]),
        field("topmostSubform.HUBZONESMALL", "HUBZone small business (block 10)", saFlags["hubzone"]),
        field("topmostSubform.ACHECKBOX", "8(a) (block 10)", saFlags["eight_a"]),
        field("topmostSubform.SMALLBUSINESS[2]", "Small business set-aside (block 10)", saFlags["small_business"]),
        field("topmostSubform.setasidepercent", "Percent set aside (block 10)", setAsidePercent),
        field("topmostSubform.NAICS", "NAICS code (block 10)", str(a["naics_code"])),
        field(
          "topmostSubform.SIZESTANDARDS",
          "Size standard (block 10)",
          ctx.sizeStandard
            ? ctx.sizeStandard.standardType === "employees"
              ? `${ctx.sizeStandard.employees ?? ""} employees`
              : dollars(ctx.sizeStandard.receiptsUsd)
            : "",
          ctx.sizeStandard ? undefined : "No SBA size standard is loaded for this NAICS code.",
        ),
        field("topmostSubform.rating", "DPAS rating (block 11)", str(a["dpas_rating"])),
        field("topmostSubform.discountterms", "Discount terms (block 12)", ""),
      ],
    },
    {
      title: "Blocks 15 to 18. Delivery, administration and contractor",
      citation: "FAR 12.204(a)",
      fields: [
        field(
          "topmostSubform.DeliverTo",
          "Deliver to (block 15)",
          place,
          place ? undefined : "No place of performance recorded on this file.",
        ),
        field("topmostSubform.AdministeredBy", "Administered by (block 16)", issuedBy(a)),
        field(
          "topmostSubform.contractoraddress",
          "Contractor (block 17a)",
          str(a["awardee_name"]) || str(a["intended_awardee_name"]),
          str(a["awardee_name"]) || str(a["intended_awardee_name"])
            ? undefined
            : "No awardee on the record; filled at award.",
        ),
        field(
          "topmostSubform.contractorcode",
          "Contractor unique entity identifier (block 17a)",
          str(a["awardee_uei"]) || str(a["intended_awardee_uei"]),
        ),
        field("topmostSubform.paymentbyaddress", "Payment will be made by (block 18a)", str(a["payment_office"])),
      ],
    },
    {
      title: "Blocks 19 to 23. Schedule",
      citation: "FAR 12.204(a)",
      fields: [
        field("topmostSubform.ITEMNUM1", "Item number (block 19)", "0001"),
        field(
          "topmostSubform.schedule1",
          "Schedule of supplies or services (block 20)",
          scheduleLines[0] ?? "",
          description ? undefined : TO_COMPLETE("record the description of the requirement"),
        ),
        field("topmostSubform.quantity1", "Quantity (block 21)", lineQuantity),
        field("topmostSubform.unit1", "Unit (block 22)", lineUnit),
        field("topmostSubform.unitprice1", "Unit price (block 23)", lineUnitPrice),
        field(
          "topmostSubform.amount1",
          "Amount (block 24)",
          dollars(price || a["estimated_value"]),
          price ? undefined : "Estimated value shown; the award amount replaces it at award.",
        ),
        // The narrative continues on the rows below. Those rows carry text
        // only; the priced line is line one.
        ...scheduleLines.slice(1).map((line, i) =>
          field(`topmostSubform.schedule${i + 2}`, `Schedule continued (block 20)`, line),
        ),
        field("topmostSubform.TOTALAWARD", "Total award amount (block 26)", dollars(price)),
        field("topmostSubform.accountingdata", "Accounting and appropriation data (block 25)", str(a["funding_source"])),
      ],
    },
    {
      title: "Blocks 26 to 33. Award and signatures",
      citation: "FAR 13.106-3; FAR 12.204(a)",
      fields: [
        field("topmostSubform.RFQ", "Solicitation is a request for quotation (block 8)", commercial),
        field("topmostSubform.RFP", "Solicitation is a request for proposal (block 8)", !commercial),
        field("topmostSubform.THISCONTRACT", "Award is made on this form (block 30)", /sole/.test(competition)),
        field("topmostSubform.contractingofficer", "Name of contracting officer (block 31b)", str(a["co_name"])),
        field("topmostSubform.signername", "Name of offeror signer (block 30b)", ""),
        field("topmostSubform.signertitle", "Title of offeror signer (block 30b)", ""),
      ],
    },
  ];

  return {
    key: "sf-1449",
    name: FORM_NAMES_SF["sf-1449"],
    citation: "FAR 12.204(a); FAR 53.212",
    pdf: "/forms/SF1449.pdf",
    sections,
  };
}

/** SF 30, filled from the acquisition record and its recorded modification. */
export function buildSf30(ctx: FormCtx): GeneratedForm {
  const a = ctx.acq;
  const mods = Array.isArray(a["modifications"]) ? (a["modifications"] as Record<string, unknown>[]) : [];
  const mod = mods.length ? mods[mods.length - 1]! : {};
  const isAmendment = !str(a["contract_number"]);
  const description = str(mod["description"]) || TO_COMPLETE("describe the amendment or modification");

  const sections: FormSection[] = [
    {
      title: "Blocks 1 to 8. Identification",
      citation: "FAR 43.301; FAR 53.243",
      fields: [
        field("topmostSubform.AmendmentNo", "Amendment or modification number (block 2)", str(mod["mod_number"])),
        field("topmostSubform.EffectiveDate", "Effective date (block 3)", str(mod["effective_date"])),
        field("topmostSubform.ReqNumber", "Requisition or purchase request number (block 4)", str(a["pr_number"])),
        field("topmostSubform.ProjectNo", "Project number (block 5)", str(a["acquisition_id"])),
        field("topmostSubform.IssuedBy", "Issued by (block 6)", issuedBy(a)),
        field("topmostSubform.AdministeredBy", "Administered by (block 7)", issuedBy(a)),
        field(
          "topmostSubform.NameandAddress",
          "Name and address of contractor (block 8)",
          str(a["awardee_name"]) || str(a["intended_awardee_name"]),
        ),
        field("topmostSubform.FacilityCode", "Unique entity identifier (block 8)", str(a["awardee_uei"])),
        field("topmostSubform.Page", "Page (block 1)", "1"),
        field("topmostSubform.Pages", "Of pages (block 1)", "1"),
      ],
    },
    {
      title: "Blocks 9 to 12. Solicitation or contract being changed",
      citation: "FAR 43.301",
      fields: [
        field("topmostSubform.CheckBox9", "This amends solicitation number (block 9A)", isAmendment),
        field("topmostSubform.AmendmentNo[1]", "Solicitation number (block 9A)", str(a["solicitation_number"])),
        field("topmostSubform.Dated9B", "Dated (block 9B)", str(a["solicitation_date"])),
        field("topmostSubform.CheckBox10", "This modifies contract or order number (block 10A)", !isAmendment),
        field("topmostSubform.ModificationNo", "Contract or order number (block 10A)", str(a["contract_number"])),
        field("topmostSubform.Dated10B", "Dated (block 10B)", str(a["award_date"])),
        field("topmostSubform.Extended", "Offer period is extended (block 11)", false),
        field("topmostSubform.NotExtended", "Offer period is not extended (block 11)", isAmendment),
        field("topmostSubform.AccountingData", "Accounting and appropriation data (block 12)", str(a["funding_source"])),
      ],
    },
    {
      title: "Blocks 13 to 16. Authority, description and signatures",
      citation: "FAR 43.103; FAR 43.301",
      fields: [
        field(
          "topmostSubform.CheckBox13A",
          "Change order under the changes clause (block 13A)",
          str(mod["mod_type"]).toLowerCase().includes("change"),
        ),
        field(
          "topmostSubform.CheckBox13B",
          "Administrative change (block 13B)",
          str(mod["mod_type"]).toLowerCase().includes("administrative"),
        ),
        field(
          "topmostSubform.CheckBox13C",
          "Supplemental agreement, entered into under the authority of (block 13C)",
          str(mod["mod_type"]).toLowerCase().includes("supplemental") ||
            str(mod["mod_type"]).toLowerCase().includes("bilateral"),
        ),
        field("topmostSubform.C13", "Authority for a supplemental agreement (block 13C)", str(mod["authority"])),
        field(
          "topmostSubform.Is",
          "Contractor is required to sign this document (block 16)",
          !str(mod["mod_type"]).toLowerCase().includes("administrative"),
        ),
        field(
          "topmostSubform.IsNot",
          "Contractor is not required to sign this document (block 16)",
          str(mod["mod_type"]).toLowerCase().includes("administrative"),
        ),
        field("topmostSubform.Description", "Description of amendment or modification (block 14)", description),
        field("topmostSubform.NameandTitleOfficer", "Name and title of contracting officer (block 16A)", str(a["co_name"])),
        field("topmostSubform.NameandTitleSigner", "Name and title of contractor signer (block 15A)", ""),
      ],
    },
  ];

  return {
    key: "sf-30",
    name: FORM_NAMES_SF["sf-30"],
    citation: "FAR 43.301; FAR 53.243",
    pdf: "/forms/SF30.pdf",
    sections,
  };
}

// ---------------------------------------------------------------------------
// SF 33, SF 26 and OF 347.
//
// The blanks in public/forms are the official GSA files, served byte for byte.
// Part 53 prescription lines carry a confirm note: the RFO's Part 53 is not
// adopted in this prototype, so the FAR prescription is shown and marked to
// confirm. Offeror and contractor blocks stay empty, every signature field is
// left untouched, and no quantity, unit or price is ever invented: a line only
// carries a figure when the schedule or the estimate on the file records one.
// ---------------------------------------------------------------------------

const CONFIRM_RFO = "Confirm RFO Part 53 if adopted.";

const number = (v: number | null): string =>
  v === null || !Number.isFinite(v) ? "" : String(v);

const amount = (v: number | null): string => (v === null ? "" : dollars(v));

const NOT_RECORDED = "Not recorded on the schedule; never filled from an estimate of the figure.";

/** The schedule on the file, or an empty list when none is recorded. */
const schedule = (ctx: FormCtx): FormClin[] => (Array.isArray(ctx.clins) ? ctx.clins : []);

/** Sum of the extended prices actually recorded, or null when none are. */
const scheduleTotal = (rows: FormClin[]): number | null => {
  const known = rows.map((r) => r.extendedPrice).filter((n): n is number => typeof n === "number");
  return known.length === rows.length && known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
};

/** Accepted item numbers, written as the list the record holds. */
const acceptedItems = (rows: FormClin[]): string => rows.map((r) => r.clinNumber).join(", ");

const awardee = (a: Record<string, unknown>): string =>
  str(a["awardee_name"]) || str(a["intended_awardee_name"]);

const awardeeUei = (a: Record<string, unknown>): string =>
  str(a["awardee_uei"]) || str(a["intended_awardee_uei"]);

const parentContract = (a: Record<string, unknown>): string => str(a["parent_contract_number"]);

/** SF 33, Solicitation, Offer and Award. Government blocks only. */
export function buildSf33(ctx: FormCtx): GeneratedForm {
  const a = ctx.acq;
  const rows = schedule(ctx);
  const method = `${str(a["acquisition_method"])} ${str(a["contract_format"])}`.toLowerCase();
  const sealed = /sealed|invitation for bid|\bifb\b/.test(method);
  const negotiated = !sealed;
  const awardAmount = Number(a["award_amount"]) || Number(a["proposed_price"]) || null;
  const total = scheduleTotal(rows) ?? awardAmount;
  const awarded = Boolean(str(a["award_date"]));
  const phone = str(a["co_phone"]);

  const sections: FormSection[] = [
    {
      title: "Blocks 1 to 8. Solicitation identity and issuing office",
      citation: `FAR 53.214(c). ${CONFIRM_RFO}`,
      fields: [
        field("topmostSubform.RATING", "DPAS rating (block 1)", str(a["dpas_rating"])),
        field("topmostSubform.PG1", "Page (page block)", "1"),
        field("topmostSubform.PG2", "Of pages (page block)", "1", "Page count of the printed package is set when the package prints."),
        field(
          "topmostSubform.CONTRACTNUM",
          "Contract number (block 2)",
          str(a["contract_number"]),
          str(a["contract_number"]) ? undefined : "Assigned in NCMS at award.",
        ),
        field(
          "topmostSubform.SOLICITATION",
          "Solicitation number (block 3)",
          str(a["solicitation_number"]),
          str(a["solicitation_number"]) ? undefined : "Assigned in NCMS when the solicitation issues.",
        ),
        field("topmostSubform.SEALED", "Sealed bid, invitation for bid (block 4)", sealed),
        field("topmostSubform.NEGOTIATED", "Negotiated, request for proposals (block 4)", negotiated),
        field(
          "topmostSubform.DateISSUED",
          "Date issued (block 5)",
          str(a["solicitation_date"]),
          str(a["solicitation_date"]) ? undefined : "No solicitation date on the record.",
        ),
        field(
          "topmostSubform.REQUNUM",
          "Requisition or purchase number (block 6)",
          str(a["pr_number"]) || str(a["acquisition_id"]),
        ),
        field(
          "topmostSubform.ISSUEDBY",
          "Issued by (block 7)",
          issuedBy(a),
          issuedBy(a) ? undefined : TO_COMPLETE("record the issuing office"),
        ),
        field("topmostSubform.ISSUECODE", "Issuing office code (block 7)", str(a["co_code"])),
        field(
          "topmostSubform.FOFFERTOADDY",
          "Address offer to (block 8)",
          issuedBy(a),
          "Confirm the offer-to address before the solicitation issues.",
        ),
      ],
    },
    {
      title: "Blocks 9 and 10. Receipt of offers and point of contact",
      citation: "FAR 14.201-1; FAR 15.204-1",
      fields: [
        field("topmostSubform.SEALEDOFFERS", "Number of copies (block 9)", ""),
        field("topmostSubform.LOCATEDIN", "Depository located in (block 9)", ""),
        field("topmostSubform.UNTIL", "Offers due until, local time (block 9)", str(a["offer_due_time"])),
        field(
          "topmostSubform.DEPOSITORYDATE",
          "Offers due date (block 9)",
          str(a["offer_due_date"]),
          str(a["offer_due_date"]) ? undefined : "No offer due date on the record.",
        ),
        field(
          "topmostSubform.NAME10A",
          "For information call, name (block 10A)",
          str(a["co_name"]),
          str(a["co_name"]) ? undefined : TO_COMPLETE("record the point of contact"),
        ),
        field("topmostSubform.AREACODE1", "Area code (block 10B)", phone.replace(/\D/g, "").slice(0, 3)),
        field("topmostSubform.NUMBER1", "Telephone number (block 10B)", phone.replace(/\D/g, "").slice(3, 10)),
        field("topmostSubform.EXT1", "Extension (block 10B)", ""),
        field("topmostSubform.EMAIL", "Email address (block 10C)", str(a["co_email"])),
      ],
    },
    {
      // Only the sections the record can honestly show are checked. A section
      // T-Minus cannot see on this record is left unchecked with a gap note,
      // rather than checked on assumption.
      title: "Block 11. Table of contents",
      citation: "FAR 14.201-1; FAR 15.204-1 (confirm against RFO Part 53 if adopted)",
      fields: (["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"] as const).map((s) => {
        const present = s === "B" ? rows.length > 0 : false;
        return field(
          `topmostSubform.${s}11`,
          `Section ${s} is in this package (block 11)`,
          present,
          present
            ? undefined
            : "Left unchecked: this record does not show the section, so the officer checks it in the package of record.",
        );
      }),
    },
    {
      title: "Blocks 12 to 18. Offer",
      citation: "FAR 14.201-1; FAR 15.204-1",
      fields: [
        field(
          "topmostSubform.OFFERORADDY",
          "Name and address of offeror (block 15A)",
          "",
          "The offeror completes blocks 12 to 18. Block 17, the offeror signature, is never filled here.",
        ),
      ],
    },
    {
      title: "Blocks 19 to 28. Award",
      citation: "FAR 14.408-1; FAR 15.504",
      fields: [
        field(
          "topmostSubform.ACCITEM",
          "Accepted as to items numbered (block 19)",
          acceptedItems(rows),
          rows.length ? undefined : "No schedule on this file, so no item numbers are accepted yet.",
        ),
        field(
          "topmostSubform.LIABILITY1",
          "Amount (block 20)",
          amount(total),
          total === null ? "No award amount or priced schedule on the record." : undefined,
        ),
        field("topmostSubform.APPROPRIATION", "Accounting and appropriation (block 21)", str(a["funding_source"])),
        field("topmostSubform.USC2304", "Authority 10 U.S.C. 3204(a) (block 22)", false),
        field("topmostSubform.USC253", "Authority 41 U.S.C. 3304(a) (block 22)", false, "Checked only when the record cites that authority; the paragraph is never invented."),
        field("topmostSubform.INVOICEITEM", "Submit invoices to the address in item (block 23)", ""),
        field("topmostSubform.ADMINISTEREDBY", "Administered by (block 24)", issuedBy(a)),
        field("topmostSubform.PAYMENTCODE", "Payment office code (block 25)", str(a["payment_office_code"])),
        field(
          "topmostSubform.CONTRACTINGOFFICER",
          "Name of contracting officer (block 26)",
          str(a["co_name"]),
          str(a["co_name"]) ? undefined : TO_COMPLETE("record the contracting officer"),
        ),
        field(
          "topmostSubform.AWARDDATE",
          "Award date (block 28)",
          awarded ? str(a["award_date"]) : "",
          awarded ? undefined : "No award on the record; the contracting officer dates the award.",
        ),
      ],
    },
  ];

  return {
    key: "sf-33",
    name: FORM_NAMES_SF["sf-33"],
    citation: `FAR 53.214(c). ${CONFIRM_RFO}`,
    pdf: "/forms/SF33.pdf",
    sections,
  };
}

/** SF 26, Award/Contract. Government blocks only; rows 1 to 5 of the schedule. */
export function buildSf26(ctx: FormCtx): GeneratedForm {
  const a = ctx.acq;
  const rows = schedule(ctx);
  const shown = rows.slice(0, 5);
  const method = `${str(a["acquisition_method"])} ${str(a["contract_format"])}`.toLowerCase();
  const sealed = /sealed|invitation for bid|\bifb\b/.test(method);
  const total = scheduleTotal(rows) ?? (Number(a["award_amount"]) || null);
  const place = str(a["place_of_performance_standardized"]) || str(a["place_of_performance"]);

  const clinFields = shown.flatMap((r, i) => {
    const n = i + 1;
    return [
      field(`topmostSubform.ITEMNO${n}`, `Item number, row ${n} (block 15A)`, r.clinNumber),
      field(`topmostSubform.SUPPLIESSERVICES${n}`, `Supplies or services, row ${n} (block 15B)`, r.description),
      field(
        `topmostSubform.C15${n}`,
        `Quantity, row ${n} (block 15C)`,
        number(r.quantity),
        r.quantity === null ? NOT_RECORDED : undefined,
      ),
      field(
        `topmostSubform.D15${n}`,
        `Unit, row ${n} (block 15D)`,
        r.unit ?? "",
        r.unit ? undefined : NOT_RECORDED,
      ),
      field(
        `topmostSubform.E15${n}`,
        `Unit price, row ${n} (block 15E)`,
        amount(r.unitPrice),
        r.unitPrice === null ? NOT_RECORDED : undefined,
      ),
      field(
        `topmostSubform.F15${n}`,
        `Amount, row ${n} (block 15F)`,
        amount(r.extendedPrice),
        r.extendedPrice === null ? NOT_RECORDED : undefined,
      ),
    ];
  });

  const sections: FormSection[] = [
    {
      title: "Blocks 1 to 6. Contract identity and offices",
      citation: `FAR 53.214(a). ${CONFIRM_RFO}`,
      fields: [
        field("topmostSubform.RATING", "DPAS rating (block 1)", str(a["dpas_rating"])),
        field("topmostSubform.PAGE1", "Page", "1"),
        field("topmostSubform.PG2OF2", "Of pages", "1"),
        field(
          "topmostSubform.CONTR2",
          "Contract number (block 2)",
          str(a["contract_number"]),
          str(a["contract_number"]) ? undefined : "Assigned in NCMS at award.",
        ),
        field(
          "topmostSubform.EFECTDATE3",
          "Effective date (block 3)",
          str(a["award_date"]) || str(a["period_of_performance_start"]),
          str(a["award_date"]) ? undefined : "No award date on the record; the contracting officer sets it.",
        ),
        field(
          "topmostSubform.REQUISITION4",
          "Requisition, purchase request or project number (block 4)",
          str(a["pr_number"]) || str(a["acquisition_id"]),
        ),
        field("topmostSubform.ISSUED5", "Issued by (block 5)", issuedBy(a), issuedBy(a) ? undefined : TO_COMPLETE("record the issuing office")),
        field("topmostSubform.CODE5", "Issuing office code (block 5)", str(a["co_code"])),
        field("topmostSubform.ADMIN6", "Administered by (block 6)", issuedBy(a)),
        field("topmostSubform.CODE6", "Administering office code (block 6)", ""),
      ],
    },
    {
      title: "Blocks 7 to 12. Contractor, delivery and payment",
      citation: "FAR 14.408-1; FAR 15.504",
      fields: [
        field(
          "topmostSubform.NAMEADDY7",
          "Name and address of contractor (block 7)",
          awardee(a),
          awardee(a) ? undefined : "No awardee on the record; filled at award.",
        ),
        field(
          "topmostSubform.CODE7",
          "Unique entity identifier (block 7)",
          awardeeUei(a),
          awardee(a) && !awardeeUei(a) ? "An awardee is named without a unique entity identifier." : undefined,
        ),
        field("topmostSubform.FACILITYCODE7", "Facility code (block 7)", ""),
        field("topmostSubform.FOBORIGIN", "FOB origin (block 8)", false),
        field("topmostSubform.OTHER", "Delivery other than FOB origin (block 8)", false, "Checked only when delivery terms are on the record."),
        field("topmostSubform.DISCOUNT", "Discount for prompt payment (block 9)", ""),
        field("topmostSubform.INVOICE", "Submit invoices to the address in item (block 10)", ""),
        field(
          "topmostSubform.SHIP11",
          "Ship to or mark for (block 11)",
          place,
          place ? undefined : "No place of performance on the record.",
        ),
        field("topmostSubform.CODE1", "Ship-to code (block 11)", ""),
        field("topmostSubform.CODE2", "Payment office code (block 12)", str(a["payment_office_code"])),
      ],
    },
    {
      title: "Blocks 13 and 14. Authority and accounting",
      citation: "FAR 6.302; FAR 14.408-1",
      fields: [
        field("topmostSubform.AUTHORITY10", "Authority 10 U.S.C. 3204(a) (block 13)", false),
        field("topmostSubform.AUTHORITY41", "Authority 41 U.S.C. 3304(a) (block 13)", false, "Checked only when the record cites that authority; the paragraph is never invented."),
        field("topmostSubform.ACCOUNTING14", "Accounting and appropriation data (block 14)", str(a["funding_source"])),
      ],
    },
    {
      title: "Block 15. Schedule, rows 1 to 5",
      citation: "FAR 14.408-1",
      fields: [
        ...clinFields,
        field(
          "topmostSubform.F15TOTAL",
          "Total amount of contract (block 15G)",
          amount(total),
          total === null ? "No priced schedule and no award amount on the record." : undefined,
        ),
        ...(rows.length > 5
          ? [
              field(
                "topmostSubform.SUPPLIESSERVICES5",
                "Continuation note (block 15B)",
                shown[4]?.description ?? "",
                `The schedule has ${rows.length} lines; rows beyond five print on the continuation schedule in the package.`,
              ),
            ]
          : []),
        ...(rows.length === 0
          ? [
              field(
                "topmostSubform.ITEMNO1",
                "Item number, row 1 (block 15A)",
                "",
                "No schedule on this file. Add line items on the file before the award prints.",
              ),
            ]
          : []),
      ],
    },
    {
      title: "Blocks 17 to 20. Award type and signatures",
      citation: "FAR 14.408-1; FAR 15.504",
      fields: [
        field("topmostSubform.CONT17", "Contractor's negotiated agreement (block 17)", !sealed),
        field("topmostSubform.AWARD18", "Sealed-bid award (block 18)", sealed),
        field("topmostSubform.SOLMUN", "Solicitation number (block 18)", sealed ? str(a["solicitation_number"]) : ""),
        field(
          "topmostSubform.NAMECONTRACTING",
          "Name of contracting officer (block 20A)",
          str(a["co_name"]),
          "Blocks 19A to 19C and both signature blocks stay empty; the contractor and the contracting officer sign.",
        ),
      ],
    },
  ];

  return {
    key: "sf-26",
    name: FORM_NAMES_SF["sf-26"],
    citation: `FAR 53.214(a). ${CONFIRM_RFO}`,
    pdf: "/forms/SF26.pdf",
    sections,
  };
}

/** OF 347, Order for Supplies or Services. Page 1 only; the back stays empty. */
export function buildOf347(ctx: FormCtx): GeneratedForm {
  const a = ctx.acq;
  const rows = schedule(ctx);
  const shown = rows.slice(0, 13);
  const parent = parentContract(a);
  const deliveryOrder =
    Boolean(parent) ||
    /order under idiq|delivery order|task order/i.test(
      `${str(a["contract_format"])} ${str(a["acquisition_profile"])}`,
    );
  const total = scheduleTotal(rows) ?? (Number(a["award_amount"]) || Number(a["estimated_value"]) || null);
  const place = str(a["place_of_performance_standardized"]) || str(a["place_of_performance"]);
  const setAside = str(a["set_aside"]).toLowerCase();

  const clinFields = shown.flatMap((r, i) => {
    const n = i + 1;
    return [
      field(`F.P1.ITEMNO${n}`, `Item number, row ${n} (block 17a)`, r.clinNumber),
      field(`F.P1.SUPPLIES${n}`, `Supplies or services, row ${n} (block 17b)`, r.description),
      field(
        `F.P1.QUANTITY${n}`,
        `Quantity ordered, row ${n} (block 17c)`,
        number(r.quantity),
        r.quantity === null ? NOT_RECORDED : undefined,
      ),
      field(`F.P1.UNIT${n}`, `Unit, row ${n} (block 17d)`, r.unit ?? "", r.unit ? undefined : NOT_RECORDED),
      field(
        `F.P1.UNITPRICE${n}`,
        `Unit price, row ${n} (block 17e)`,
        amount(r.unitPrice),
        r.unitPrice === null ? NOT_RECORDED : undefined,
      ),
      field(
        `F.P1.AMOUNT${n}`,
        `Amount, row ${n} (block 17f)`,
        amount(r.extendedPrice),
        r.extendedPrice === null ? NOT_RECORDED : undefined,
      ),
      field(`F.P1.QUANTACCEPT${n}`, `Quantity accepted, row ${n} (block 17g)`, "", "Filled on receipt, not on order."),
    ];
  });

  const sections: FormSection[] = [
    {
      title: "Blocks 1 to 5. Order identity",
      citation: `FAR 53.213(f). ${CONFIRM_RFO}`,
      fields: [
        field("F.P1.PAGE", "Page", "1"),
        field("F.P1.OFPAGE", "Of pages", "1"),
        field(
          "F.P1.ORDERDATE",
          "Date of order (block 1)",
          str(a["award_date"]),
          str(a["award_date"]) ? undefined : "No order date on the record; the ordering officer dates it.",
        ),
        field(
          "F.P1.CONTRACTNO",
          "Contract number, if any (block 2)",
          parent || str(a["contract_number"]),
          deliveryOrder && !parent ? "This is a delivery order without a parent contract number on the record." : undefined,
        ),
        field(
          "F.P1.ORDERNO",
          "Order number (block 3)",
          str(a["order_number"]),
          str(a["order_number"]) ? undefined : "Assigned in NCMS when the order issues.",
        ),
        field("F.P1.REQUISITION", "Requisition or reference number (block 4)", str(a["pr_number"]) || str(a["acquisition_id"])),
        field("F.P1.ISSUEADDRESS", "Issuing office (block 5)", issuedBy(a), issuedBy(a) ? undefined : TO_COMPLETE("record the issuing office")),
      ],
    },
    {
      title: "Blocks 6 to 8. Ship to, contractor and type of order",
      citation: "FAR 13.307",
      fields: [
        field("F.P1.CONSIGNEENAME", "Name of consignee (block 6a)", place, place ? undefined : "No ship-to on the record."),
        field("F.P1.SHIPVIA", "Ship via (block 6f)", ""),
        field(
          "F.P1.CONTRACTNAME",
          "Name of contractor (block 7a)",
          awardee(a),
          awardee(a) ? undefined : "No awardee on the record; filled when the order issues.",
        ),
        field(
          "F.P1.STREET",
          "Contractor street address (block 7c)",
          "",
          awardee(a) ? "No contractor address on the record; an address is never invented." : undefined,
        ),
        field("F.P1.PURCHASE", "Purchase order (block 8a)", !deliveryOrder),
        field("F.P1.DELIVERY", "Delivery order (block 8b)", deliveryOrder),
        field(
          "F.P1.REF",
          "Reference your (block 8b)",
          parent,
          deliveryOrder && !parent ? "No parent reference on the record." : undefined,
        ),
      ],
    },
    {
      title: "Blocks 9 to 16. Accounting, delivery and terms",
      citation: "FAR 13.307",
      fields: [
        field("F.P1.ACCOUNT", "Accounting and appropriation data (block 9)", str(a["funding_source"])),
        field("F.P1.FOB", "FOB point (block 12)", ""),
        field("F.P1.INSPECT", "Inspection (block 13a)", ""),
        field("F.P1.ACCEPT", "Acceptance (block 13b)", ""),
        field("F.P1.GOVT", "Government bill of lading number (block 14)", ""),
        field(
          "F.P1.DELIVERDATE",
          "Deliver on or before (block 15)",
          str(a["need_date"]),
          str(a["need_date"]) ? undefined : "No delivery date on the record.",
        ),
        field("F.P1.DISCOUNT", "Discount terms (block 16)", ""),
      ],
    },
    {
      title: "Block 11. Business classification",
      citation: "FAR 19.102",
      fields: [
        field("F.P1.SMALL", "Small (block 11a)", /small/.test(setAside)),
        field("F.P1.OTHERTHAN", "Other than small (block 11b)", false),
        field("F.P1.DISADVANTAGE", "Disadvantaged (block 11c)", /8\(a\)|disadvantaged/.test(setAside)),
        field("F.P1.WOMEN", "Women-owned (block 11d)", /women/.test(setAside)),
        field("F.P1.HUBZONE", "HUBZone (block 11e)", /hubzone/.test(setAside)),
        field(
          "F.P1.SERVICE",
          "Service-disabled veteran-owned (block 11f)",
          /service-disabled|sdvosb/.test(setAside),
          "Boxes are checked only from the set-aside on the record. WOSB and EDWOSB, blocks 11g and 11h, are left unchecked: their second form instances are not confirmed, so the binding is still to be settled.",
        ),
      ],
    },
    {
      title: "Block 17. Schedule",
      citation: "FAR 13.307",
      fields: [
        ...clinFields,
        field(
          "F.P1.GRANDTOTAL",
          "Grand total (block 17i)",
          amount(total),
          total === null ? "No priced schedule and no order total on the record." : undefined,
        ),
        ...(rows.length > 13
          ? [
              field(
                "F.P1.SHIPPING",
                "Shipping point (block 18)",
                "",
                `The schedule has ${rows.length} lines and the form carries thirteen. The remaining lines print on the continuation schedule in the package; OF 348 is not generated.`,
              ),
            ]
          : []),
        ...(rows.length === 0
          ? [
              field(
                "F.P1.ITEMNO1",
                "Item number, row 1 (block 17a)",
                "",
                "No schedule on this file. Add line items on the file before the order prints.",
              ),
            ]
          : []),
      ],
    },
    {
      title: "Blocks 21 to 23. Invoices and signature",
      citation: "FAR 13.307",
      fields: [
        field("F.P1.NAME21A", "Mail invoice to, name (block 21a)", str(a["payment_office"])),
        field(
          "F.P1.NAME3",
          "Name of ordering officer (block 23)",
          str(a["co_name"]),
          "Block 22, the signature, is never filled here. The back of the form, receiving and rejections, stays empty.",
        ),
      ],
    },
  ];

  return {
    key: "of-347",
    name: FORM_NAMES_SF["of-347"],
    citation: `FAR 53.213(f). ${CONFIRM_RFO}`,
    pdf: "/forms/OF347.pdf",
    sections,
  };
}

/**
 * The official form this file's method points at. Nothing is forced: the other
 * forms stay open, and the recommendation reads from the record alone.
 */
export function recommendedOfficialForm(
  facts: Record<string, unknown> | null | undefined,
): { key: "sf-1449" | "sf-33" | "sf-26" | "of-347" | "sf-30"; why: string } | null {
  if (!facts) return null;
  const format = str(facts["contract_format"]).toLowerCase();
  const method = str(facts["acquisition_method"]).toLowerCase();
  const phase = str(facts["current_phase"]).toLowerCase();
  const mods = Array.isArray(facts["modifications"]) ? (facts["modifications"] as unknown[]) : [];
  const parent = parentContract(facts);
  const order =
    Boolean(parent) ||
    /order under idiq|delivery order|task order|order_under_idiq/i.test(
      `${format} ${str(facts["acquisition_profile"])}`,
    );

  if (mods.length > 0 || /modification|post-?award change/.test(phase)) {
    return { key: "sf-30", why: "A modification is recorded on this file." };
  }
  if (/sf 26|sf26/.test(format)) {
    return { key: "sf-26", why: "The record names SF 26 as the award form." };
  }
  if (isStreamlined(facts)) {
    return {
      key: "sf-1449",
      why: "Commercial, streamlined format on the record (FAR 12.204(a)).",
    };
  }
  if (order || /simplified|part 13|13\.5/.test(method)) {
    return {
      key: "of-347",
      why: order
        ? "An order under an existing contract is recorded on this file."
        : "Simplified acquisition on the record, ordered on a purchase order.",
    };
  }
  if (/of 347|of347/.test(format)) {
    return { key: "of-347", why: "The record names OF 347 as the order form." };
  }
  return {
    key: "sf-33",
    why: "Negotiated, uniform contract format on the record; the solicitation, offer and award ride on one form.",
  };
}

export const FORM_NAMES_SF = {
  "sf-1449": "SF 1449, Solicitation/Contract/Order for Commercial Products and Commercial Services",
  "sf-30": "SF 30, Amendment of Solicitation/Modification of Contract",
  "sf-33": "SF 33, Solicitation, Offer and Award",
  "sf-26": "SF 26, Award/Contract",
  "of-347": "OF 347, Order for Supplies or Services",
} as const;
