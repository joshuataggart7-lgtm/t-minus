/**
 * Field mappings as data.
 *
 * Each row says which box on an official blank a recorded value goes into.
 * The rows below carry the same columns a future table will carry:
 *
 *   form_field_mappings (form_id, revision, pdf_field, record_path, type,
 *                        equals, max_len, font_size, multiline)
 *
 * Soft extra columns: match, constant, note.
 *
 * The pdf_field names are the names the official blanks themselves carry and
 * are not renamed or re-derived here. Signature, award date, concurrence and
 * approval boxes are deliberately absent: a person completes those.
 *
 * SF 30 and OF 347 rows land in a following pass; only SF 1449 is generated
 * from these rows today.
 */

export type MappingType = "text" | "check" | "money" | "date";

export type MappingMatch =
  | "eq"
  | "includes"
  | "includes_any"
  | "truthy"
  | "array_includes"
  | "roger_sb2";

export interface FormFieldMapping {
  form_id: string;
  revision: string;
  pdf_field: string;
  record_path: string;
  type: MappingType;
  equals?: string;
  max_len?: number;
  font_size?: number;
  multiline?: boolean;
  /** Soft: how a check row decides it is on. Defaults to truthy. */
  match?: MappingMatch;
  /** Soft: a fixed value written instead of a recorded one. */
  constant?: string;
  /** Soft: a short note for the reader of this table. */
  note?: string;
}

const P = "topmostSubform[0].Page1[0].";
const SF = { form_id: "sf1449", revision: "11/2021" } as const;

const text = (pdf: string, path: string, extra: Partial<FormFieldMapping> = {}): FormFieldMapping => ({
  ...SF,
  pdf_field: P + pdf,
  record_path: path,
  type: "text",
  ...extra,
});

const money = (pdf: string, path: string): FormFieldMapping => ({
  ...SF,
  pdf_field: P + pdf,
  record_path: path,
  type: "money",
});

const check = (
  pdf: string,
  path: string,
  extra: Partial<FormFieldMapping> = {},
): FormFieldMapping => ({ ...SF, pdf_field: P + pdf, record_path: path, type: "check", ...extra });

/** The eight schedule rows, blocks 19 to 24. */
const scheduleRows: FormFieldMapping[] = Array.from({ length: 8 }, (_, i) => i).flatMap((i) => [
  text(`ITEMNUM${i + 1}[0]`, `schedule[${i}].item`),
  text(`schedule${i + 1}[0]`, `schedule[${i}].description`, { multiline: true }),
  text(`quantity${i + 1}[0]`, `schedule[${i}].quantity`),
  text(`unit${i + 1}[0]`, `schedule[${i}].unit`),
  money(`unitprice${i + 1}[0]`, `schedule[${i}].unit_price`),
  money(`amount${i + 1}[0]`, `schedule[${i}].amount`),
]);

const sf1449Rows: FormFieldMapping[] = [
  // Blocks 1 to 9. Requisition, solicitation and issuing office.
  text("reqnumber[0]", "requisition.number"),
  text("pagenumber[0]", "pagination.page_of"),
  text("contractno[0]", "contract.number"),
  text("ordernumber[0]", "contract.order_number"),
  text("solicitationnumber[0]", "solicitation.number"),
  text("contactname[0]", "solicitation.contact_name"),
  text("contactphone[0]", "solicitation.contact_phone"),
  text("issuedbycode[0]", "issuing_office.code", { note: "Block 9 code box, code only" }),
  text("TextField1[4]", "issuing_office.name", { note: "Block 9 address box, office name" }),
  check("RFQ[0]", "solicitation.method", { match: "eq", equals: "rfq" }),
  check("RFP[0]", "solicitation.method", { match: "eq", equals: "rfp" }),
  check("FB[0]", "solicitation.method", { match: "eq", equals: "ifb" }),

  // Block 10. Set-aside and size.
  check("UNRESTRICTIONTED[0]", "set_aside.unrestricted"),
  check("SETASIDE[0]", "set_aside.is_set_aside"),
  text("setasidepercent[0]", "set_aside.percent", { note: "numeric only" }),
  check("SMALLBUSINESS[0]", "set_aside.type", {
    match: "includes",
    equals: "8(a)",
    note: "tagged for the set-aside enum pass",
  }),
  check("SMALLBUSINESS[1]", "set_aside.type", {
    match: "includes",
    equals: "women",
    note: "tagged for the set-aside enum pass",
  }),
  check("SMALLBUSINESS[2]", "set_aside.raw", { match: "roger_sb2" }),
  check("SERVICEDISABLED[0]", "set_aside.type", {
    match: "includes_any",
    equals: "service-disabled|sdvosb",
    note: "tagged for the set-aside enum pass",
  }),
  check("HUBZONESMALL[0]", "set_aside.type", {
    match: "includes",
    equals: "hubzone",
    note: "tagged for the set-aside enum pass",
  }),
  text("NAICS[0]", "naics.code"),
  text("SIZESTANDARDS[0]", "naics.size_standard"),

  // Blocks 11 to 18. Delivery, administration, contractor and payment.
  text("rating[0]", "delivery.rating"),
  text("discountterms[0]", "payment.discount_terms"),
  text("DeliverTo[0]", "delivery.deliver_to", { multiline: true }),
  text("AdministeredBy[0]", "administration.office", { multiline: true }),
  text("AdministeredByCode[0]", "administration.code"),
  text("contractoraddress[0]", "contractor.address", { multiline: true }),
  text("contractorcode[0]", "contractor.code"),
  text("TextField1[1]", "contractor.phone", { note: "Block 17a telephone box" }),
  text("paymentbyaddress[0]", "payment.office", { multiline: true }),

  ...scheduleRows,

  // Blocks 25 to 31. Accounting, award and offer references.
  text("accountingdata[0]", "accounting.data", { multiline: true }),
  money("TOTALAWARD[0]", "award.total"),
  text("numberofcopies[0]", "offer.copies"),
  text("offerreference[0]", "offer.reference"),
  text("exceptions[0]", "offer.exceptions"),
  text("contractingofficer[0]", "signer.contracting_officer"),
  text("signername[0]", "signer.name", { note: "left empty; a person signs" }),
  text("signertitle[0]", "signer.title", { note: "left empty; a person signs" }),
  { ...SF, pdf_field: `${P}AWARDDate[0]`, record_path: "award.date", type: "date" },

  // Addendum and clause boxes.
  check("SEEADDENDUM[0]", "clauses.see_addendum"),
  check("SEESCHEDULE[0]", "clauses.see_schedule"),
  check("THISCONTRACT[0]", "clauses.this_contract"),
  check("CheckBox1[0]", "clauses.box1_0"),
  check("CheckBox1[1]", "clauses.box1_1"),
  check("CheckBox1[2]", "clauses.box1_2"),
  check("CheckBox1[3]", "clauses.box1_3"),
  check("are1[0]", "clauses.are1"),
  check("arenot1[0]", "clauses.arenot1"),
  check("are2[0]", "clauses.are2"),
  check("arenot2[0]", "clauses.arenot2"),
];

export const FORM_FIELD_MAPPINGS: FormFieldMapping[] = [...sf1449Rows];

/** The rows for one form, newest revision first when none is named. */
export function mappingsFor(formId: string, revision?: string): FormFieldMapping[] {
  return FORM_FIELD_MAPPINGS.filter(
    (row) => row.form_id === formId && (!revision || row.revision === revision),
  );
}
