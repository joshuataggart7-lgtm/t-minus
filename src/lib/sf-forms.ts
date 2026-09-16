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

import type { FormCtx, FormSection, FormValue, GeneratedForm } from "@/lib/nf1787";
import { isStreamlined } from "@/lib/format-scaffold";

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
        field("topmostSubform.issuedbycode", "Issued by (block 9)", issuedBy(a) || TO_COMPLETE("record the issuing office")),
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
        field("topmostSubform.setasidepercent", "Set-aside basis (block 10)", setAside),
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
          [description, pop ? `Period of performance ${pop}.` : ""].filter(Boolean).join(" "),
          description ? undefined : TO_COMPLETE("record the description of the requirement"),
        ),
        field("topmostSubform.quantity1", "Quantity (block 21)", ""),
        field("topmostSubform.unit1", "Unit (block 22)", ""),
        field("topmostSubform.unitprice1", "Unit price (block 23)", ""),
        field(
          "topmostSubform.amount1",
          "Amount (block 24)",
          dollars(price || a["estimated_value"]),
          price ? undefined : "Estimated value shown; the award amount replaces it at award.",
        ),
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

export const FORM_NAMES_SF = {
  "sf-1449": "SF 1449, Solicitation/Contract/Order for Commercial Products and Commercial Services",
  "sf-30": "SF 30, Amendment of Solicitation/Modification of Contract",
} as const;
