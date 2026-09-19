/**
 * OF 347 and SF 30 as AcroForm fills on the official blanks.
 *
 * The same route SF 1449 takes: the blank is loaded, its dynamic XFA layer is
 * removed, and the mapping rows are written onto the AcroForm fields. No field
 * name is written here; the rows in form-field-mappings carry them. Signature
 * and contracting officer date blocks stay empty: a person signs them.
 */

import { resolveOfficerName } from "@/lib/softwalk-samples";
import type { FormCtx } from "@/lib/nf1787";
import { mappingsFor } from "@/lib/form-field-mappings";
import { currentFormRevision, resolveFormTemplate, type FormTemplateId } from "@/lib/form-templates";
import { withCanonical } from "@/lib/canonical-adapters";
import { applyFormMappings } from "@/lib/apply-form-mappings";
import { setAsideKey } from "@/lib/official-acroform-sf1449";
import { dedupeClins, of347Face } from "@/lib/of347-face";
import { isMultipleAward } from "@/lib/award-holders";
import { sf30Blocks, MOD_TYPES } from "@/lib/vehicles";
import { buildSf26, buildSf33 } from "@/lib/sf-forms";

export type RogerFormData = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== "" && v !== undefined ? n : null;
};

/** The office name the record carries, centre and branch. */
const officeOf = (a: Record<string, unknown>): string =>
  [str(a["center_name"]) || str(a["center_code"]), str(a["branch_code"])].filter(Boolean).join(", ");

/** A named office carried explicitly by the record, including post-award data. */
function recordedOffice(
  a: Record<string, unknown>,
  kind: "issuing" | "administering",
): { code: string; nameAddress: string } {
  const postAward =
    a["post_award"] && typeof a["post_award"] === "object"
      ? (a["post_award"] as Record<string, unknown>)
      : {};
  if (kind === "issuing") {
    return {
      code: str(a["issuing_office_code"]) || str(postAward["issuing_office_code"]) || str(a["center_code"]),
      nameAddress:
        str(a["issuing_office_name_address"]) ||
        str(a["issuing_office"]) ||
        str(postAward["issuing_office_name_address"]) ||
        str(postAward["issuing_office"]) ||
        officeOf(a),
    };
  }
  return {
    code: str(a["administering_office_code"]) || str(postAward["administering_office_code"]),
    nameAddress:
      str(a["administering_office_name_address"]) ||
      str(a["administering_office"]) ||
      str(a["administered_by"]) ||
      str(postAward["administering_office_name_address"]) ||
      str(postAward["administering_office"]) ||
      str(postAward["administered_by"]),
  };
}

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
  const contractorCode = single
    ? str(a["awardee_uei"]) || str(a["intended_awardee_uei"]) || str(a["vendor_uei"])
    : "";
  const contractorCage = single
    ? str(a["awardee_cage"]) || str(a["intended_awardee_cage"]) || str(a["vendor_cage"])
    : "";
  const issuingOffice = recordedOffice(a, "issuing");
  const administeringOffice = recordedOffice(a, "administering");

  // Block 13: the recorded flags rule. Where none is recorded, the block for
  // the recorded modification type is used, so the ticked box and the
  // authority blank beside it always agree.
  const recordedBlocks = ["sf30_13a", "sf30_13b", "sf30_13c", "sf30_13d"].some((k) => Boolean(mod[k]));
  const namedType = MOD_TYPES.some((m) => m.key === str(mod["mod_type"]));
  const byType = sf30Blocks(str(mod["mod_type"]));
  let block13 = recordedBlocks
    ? {
        a: Boolean(mod["sf30_13a"]),
        b: Boolean(mod["sf30_13b"]),
        c: Boolean(mod["sf30_13c"]),
        d: Boolean(mod["sf30_13d"]),
      }
    : namedType
      ? { a: byType.sf30_13a, b: byType.sf30_13b, c: byType.sf30_13c, d: byType.sf30_13d }
      : { a: false, b: false, c: false, d: false };
  // Authority text is printed only when the modification record carries it.
  // The modification type may identify the correct category, but it is never
  // used to manufacture a FAR, NFS or contract-clause authority.
  const authorityText = str(mod["authority_text"]);
  // A type the list does not name belongs in block 13D, but only when the
  // record carries the authority that block asks the writer to specify.
  if (!recordedBlocks && !namedType && authorityText) block13 = { a: false, b: false, c: false, d: true };
  // Block 13D says "other" and then asks the writer to specify. A ticked 13D
  // with nothing written beside it states a category the record cannot
  // support, so where the authority is genuinely unknown block 13 is left
  // unmarked and the gap is shown honestly on the form page instead.
  if (block13.d && !authorityText) block13 = { a: false, b: false, c: false, d: false };


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
      item_13a: block13.a,
      item_13b: block13.b,
      item_13c: block13.c,
      item_13d: block13.d,
      // P0-2: the authority prints in the blank next to the box that is
      // ticked, read from the record. Nothing is invented: where the covering
      // clause is not on the record, the authority helper says so plainly.
      item_13a_authority: block13.a ? authorityText : "",
      item_13c_authority: block13.c ? authorityText : "",
      item_13d_authority: block13.d ? authorityText : "",
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
    issuing_office: { code: issuingOffice.code, name_address: issuingOffice.nameAddress },
    administering_office: {
      code: administeringOffice.code,
      name_address: administeringOffice.nameAddress,
    },
    contractor: {
      name_address: contractorName,
      code: contractorCode,
      facility_code: contractorCage,
    },
    accounting: { data: str(a["funding_source"]) || str(mod["funds_line"]) },
    // Signature blocks stay empty; only the officer of record's name prints.
    signer: { contracting_officer: resolveOfficerName(a, ctx.coName), name_title: "" },
  };

  return withCanonical("sf30", data, { samEntity: (a as Record<string, unknown>)["sam_entity"] ?? null });
}

/**
 * SF 26 and SF 33 read the same values the filled preview shows, so the page a
 * person reads and the official blank can never drift apart. Each field on the
 * preview carries the name the blank itself uses, so the mapping rows read
 * them under face.<field name>. A value the record does not carry stays empty,
 * and the gap is shown on the form page rather than filled with a guess.
 * Signature blocks, the SF 33 offeror blocks 12 to 18 and the SF 26
 * contractor-signed blocks 19A to 19C carry no mapping row at all.
 */
export function faceCtxToRogerData(formId: "sf26" | "sf33", ctx: FormCtx): RogerFormData {
  const form = formId === "sf26" ? buildSf26(ctx) : buildSf33(ctx);
  const face: Record<string, unknown> = {};
  for (const section of form.sections) {
    for (const f of section.fields) {
      const pathLeaf = f.path.split(".").pop();
      if (!pathLeaf) continue;
      const leaf = pathLeaf.replace(/\[\d+\]$/, "");
      const empty = f.value === "" || f.value === false || f.value === undefined;
      if (leaf in face && empty) continue;
      face[leaf] = f.value;
    }
  }

  // P0-0: bind the officer of record directly to the official face fields.
  // These are printed names only; no signature or signature-date field is
  // mapped. Prefer the acquisition row and retain FormCtx as the safe fallback
  // used by callers that already resolved the officer before building the form.
  const coName = resolveOfficerName(ctx.acq, ctx.coName);
  if (formId === "sf26") {
    face["NAMECONTRACTING"] = coName;
  } else {
    face["NAME10A"] = coName;
    face["CONTRACTINGOFFICER"] = coName;
  }
  return { face };
}

/** The record for one of these blanks. */
export function ctxToRogerData(
  formId: "of347" | "sf30" | "sf26" | "sf33",
  ctx: FormCtx,
): RogerFormData {
  if (formId === "sf26" || formId === "sf33") return faceCtxToRogerData(formId, ctx);
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
