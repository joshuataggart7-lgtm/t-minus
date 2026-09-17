/**
 * OF 347 and SF 30 as AcroForm fills on the official blanks.
 *
 * The same route SF 1449 takes: the blank is loaded, its dynamic XFA layer is
 * removed, and the mapping rows are written onto the AcroForm fields. No field
 * name is written here; the rows in form-field-mappings carry them. Signature
 * and contracting officer date blocks stay empty: a person signs them.
 */

import type { FormCtx } from "@/lib/nf1787";
import { mappingsFor } from "@/lib/form-field-mappings";
import { currentFormRevision, resolveFormTemplate, type FormTemplateId } from "@/lib/form-templates";
import { withCanonical } from "@/lib/canonical-adapters";
import { applyFormMappings } from "@/lib/apply-form-mappings";
import { setAsideKey } from "@/lib/official-acroform-sf1449";
import { dedupeClins, of347Face } from "@/lib/of347-face";

export type RogerFormData = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== "" && v !== undefined ? n : null;
};

/** The office name the record carries, centre and branch. */
const officeOf = (a: Record<string, unknown>): string =>
  [str(a["center_name"]) || str(a["center_code"]), str(a["branch_code"])].filter(Boolean).join(", ");

/**
 * The schedule rows on the file, in print order, as the mapping rows read them.
 * P0-1: one row per line item number. A file whose schedule carries the same
 * CLIN twice prints it once.
 */
function scheduleRows(ctx: FormCtx): Record<string, unknown>[] {
  return dedupeClins(ctx.clins ?? [])
    .slice(0, 8)
    .map((c) => ({
      item_number: c.clinNumber,
      description: c.description,
      quantity: c.quantity === null ? "" : String(c.quantity),
      unit: c.unit ?? "",
      unit_price: c.unitPrice ?? "",
      amount: c.extendedPrice ?? "",
    }));
}

/** The record as the OF 347 mapping rows read it. */
export function of347CtxToRogerData(ctx: FormCtx): RogerFormData {
  const a = ctx.acq;
  const face = of347Face(ctx);
  const rows = face.lot
    ? [
        {
          item_number: "0001",
          description: str(a["title"]) || str(a["description_of_requirement"]),
          quantity: "1",
          unit: "Lot",
          unit_price: face.total ?? "",
          amount: face.total ?? "",
        },
      ]
    : scheduleRows(ctx);
  const total = face.total;
  const parent = str(a["parent_contract_number"]);
  const isDeliveryOrder = Boolean(parent) || /delivery order|task order|order under/i.test(str(a["contract_format"]));
  const setAside = str(a["set_aside"]);
  // P0-1: a place of performance is not a consignee, an inspection point or an
  // acceptance point. Those blocks stay empty unless the record carries them.
  const shipTo = str(a["ship_to_name"]) || str(a["consignee_name"]);

  const data: RogerFormData = {
    pagination: { page: "1", pages: "1", total_pages: "" },
    order: {
      // The order date is written by the ordering officer, not invented here.
      date: str(a["award_date"]),
      number: str(a["order_number"]),
      reference: str(a["pr_number"]),
      kind: isDeliveryOrder ? "delivery" : "purchase",
    },
    contract: { number: parent || str(a["contract_number"]) },
    requisition: { number: str(a["pr_number"]), reference: str(a["acquisition_id"]) },
    issuing_office: { name_address: officeOf(a), code: str(a["center_code"]) },
    solicitation: { contact: { name: str(a["co_name"]) } },
    contractor: {
      name: str(a["awardee_name"]) || str(a["intended_awardee_name"]),
      company_name: str(a["awardee_name"]) || str(a["intended_awardee_name"]),
      street: str(a["awardee_street"]),
      city: str(a["awardee_city"]),
      state: str(a["awardee_state"]),
      zip: str(a["awardee_postal_code"]),
    },
    delivery: {
      // Consignee only when a real ship-to is recorded. Inspection and
      // acceptance stay empty: the record carries no dedicated field for them.
      consignee: { name: shipTo, street: "", city: "", state: "", zip: "" },
      ship_via: "",
      fob: "",
      deliver_by: str(a["period_of_performance_end"]),
      inspection_point: "",
      acceptance_point: "",
      government_bl: "",
    },
    acquisition: {
      set_aside_program: setAside ? setAsideKey(setAside) : "",
      restriction: setAside ? "set_aside" : "other_than_small",
    },
    accounting: { data: str(a["funding_source"]) },
    offer: { discount_terms: str(a["discount_terms"]) },
    payment: { shipping_point: "", invoice_to: "", office: {} },
    award: { gross_amount: total ?? "", total_amount: total ?? "" },
    schedule: rows,
    // The signature block stays empty; the name of the officer of record prints.
    signer: { contracting_officer: str(a["co_name"]) },
  };

  return withCanonical("of347", data, { samEntity: (a as Record<string, unknown>)["sam_entity"] ?? null });
}

/** The record as the SF 30 mapping rows read it. */
export function sf30CtxToRogerData(ctx: FormCtx): RogerFormData {
  const a = ctx.acq;
  const mods = Array.isArray(a["modifications"]) ? (a["modifications"] as Record<string, unknown>[]) : [];
  const mod = mods.length ? mods[mods.length - 1]! : {};
  const amends = !str(a["contract_number"]);
  const kind = str(mod["mod_type"]).toLowerCase();
  // Block 8 names a contractor only when one is recorded for this action. On a
  // multiple-award vehicle no single holder is picked.
  const single = !isMultipleAward(a);
  const contractorName = single ? str(a["awardee_name"]) || str(a["intended_awardee_name"]) : "";
  const contractorCode = single ? str(a["awardee_uei"]) || str(a["intended_awardee_uei"]) : "";
  const contractorCage = single ? str(a["awardee_cage"]) || str(a["intended_awardee_cage"]) : "";

  const data: RogerFormData = {
    pagination: { page: "1", pages: "1" },
    modification: {
      // P0-2: block 2 carries the recorded modification number only. The
      // contract number belongs in block 10 and is never reused here.
      number: str(mod["mod_number"]),
      effective_date: str(mod["effective_date"]),
      project_number: str(a["acquisition_id"]),
      description: str(mod["description"]).slice(0, 1600),
      // A continuation page only when the recorded prose runs past block 14.
      description_continued: str(mod["description"]).slice(1600),
      amends_solicitation: amends,
      modifies_contract: !amends,
      offer_period_changes: false,
      offer_period_extended: false,
      offer_period_not_extended: false,
      copies: "",
      copies_returned: "",
      item_13a: Boolean(mod["sf30_13a"]) || kind.includes("change order"),
      item_13b: Boolean(mod["sf30_13b"]) || kind.includes("administrative"),
      item_13c: Boolean(mod["sf30_13c"]) || kind.includes("supplemental") || kind.includes("mutual"),
      item_13d: Boolean(mod["sf30_13d"]) || kind.includes("other"),
      item_13a_authority: str(mod["authority_text"]),
      item_13c_authority: str(mod["authority_text"]),
      item_13d_authority: str(mod["authority_text"]),
      // Nothing is assumed about whether the contractor must sign.
      contractor_signature_required: false,
      contractor_signature_not_required: false,
    },
    requisition: { number: str(a["pr_number"]) || str(mod["requisition_number"]) },
    contract: {
      id_code: str(a["contract_id_code"]),
      number: str(a["contract_number"]),
      award_effective_date: str(a["award_date"]),
    },
    solicitation: {
      // Block 9A only when a solicitation is being amended.
      number: amends ? str(a["solicitation_number"]) : "",
      issue_date: str(a["solicitation_issue_date"]),
    },
    issuing_office: { code: str(a["center_code"]), name_address: officeOf(a) },
    administering_office: { code: str(a["center_code"]), name_address: officeOf(a) },
    contractor: {
      name_address: contractorName,
      code: contractorCode,
      facility_code: contractorCage,
    },
    accounting: { data: str(a["funding_source"]) || str(mod["funds_line"]) },
    // Signature blocks stay empty; only the officer of record's name prints.
    signer: { contracting_officer: str(a["co_name"]), name_title: "" },
  };

  return withCanonical("sf30", data, { samEntity: (a as Record<string, unknown>)["sam_entity"] ?? null });
}

/** The record for one of these two blanks. */
export function ctxToRogerData(formId: "of347" | "sf30", ctx: FormCtx): RogerFormData {
  return formId === "of347" ? of347CtxToRogerData(ctx) : sf30CtxToRogerData(ctx);
}

/**
 * The official blank with its XFA layer removed and its AcroForm fields
 * filled. Same order as SF 1449: delete the dynamic layer first, then write.
 */
export async function generateOfficialFormPdf(
  formId: Exclude<FormTemplateId, "sf1449">,
  ctx: FormCtx,
  options: { flatten?: boolean; formRevision?: string | null } = {},
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const template = resolveFormTemplate(formId, options.formRevision ?? null);
  const response = await fetch(template.storage_path);
  if (!response.ok) throw new Error(`The blank form did not load (${response.status}).`);
  const pdf = await PDFDocument.load(await response.arrayBuffer());

  const form = pdf.getForm();
  try {
    form.deleteXFA();
  } catch {
    /* the blank carries no XFA layer */
  }

  const wanted = (template.revision || "").trim() || currentFormRevision(formId);
  const rows = mappingsFor(formId, wanted);
  applyFormMappings(
    form,
    rows.length ? rows : mappingsFor(formId, currentFormRevision(formId)),
    ctxToRogerData(formId, ctx),
  );

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
