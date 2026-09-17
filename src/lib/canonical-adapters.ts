/**
 * Soft §7 — one normalised record, one adapter per form.
 *
 * A party is held as discrete parts (name, street, city, state, postal code)
 * wherever the record carries them, and the one-block address a form prints is
 * joined on the way out. An address that only exists as a block of text stays
 * whole: it is never split back apart with a pattern match, because that
 * guesses at the record. The canonical shape is in memory only; nothing is
 * stored in the browser.
 */

import type { FormFieldMapping } from "@/lib/form-field-mappings";

export type PartyAddress = {
  name?: string;
  company_name?: string;
  legal_name?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  code?: string;
  facility_code?: string;
  phone?: string;
  /** Block form — only for the forms that print one. Never split on the way in. */
  name_address?: string;
  method?: string;
};

export type CanonicalRecord = {
  contract: { number?: string; id_code?: string; award_effective_date?: string };
  contractor: PartyAddress;
  issuing_office: { code?: string; name_address?: string; address?: string };
  administering_office: { code?: string; name_address?: string };
  payment_office: PartyAddress & { code?: string };
  delivery: PartyAddress & { code?: string };
  terms: { discount?: string };
  classification: { naics?: string; size_standard?: string };
};

export type FormId = "sf1449" | "sf30" | "of347";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** Join structured address parts into the block a form prints. Outbound only. */
export function joinNameAddress(x: PartyAddress = {}): string {
  const first = x.company_name || x.name || x.legal_name || "";
  const street = x.street || "";
  const locality = [x.city, [x.state, x.postal_code].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [first, street, locality].filter(Boolean).join("\n");
}

/**
 * Structured party fields from an entity payload when one is on the record.
 * Nothing is invented: with no payload the result is empty.
 */
export function partyFromSam(entity: unknown): PartyAddress {
  if (!entity || typeof entity !== "object") return {};
  const e = entity as Record<string, unknown>;
  const reg = (e["entityRegistration"] ?? e) as Record<string, unknown>;
  const core = (e["coreData"] ?? {}) as Record<string, unknown>;
  const phys = ((core["physicalAddress"] ??
    core["mailingAddress"] ??
    reg["physicalAddress"] ??
    {}) as Record<string, unknown>) ?? {};
  const name = str(reg["legalBusinessName"] ?? reg["legalName"] ?? e["legalBusinessName"]);
  const street = str(phys["addressLine1"] ?? phys["streetAddress"] ?? phys["street"]);
  const city = str(phys["city"] ?? phys["cityName"]);
  const state = str(phys["stateOrProvinceCode"] ?? phys["state"]);
  const postal = str(phys["zipCode"] ?? phys["postalCode"] ?? phys["zip"]);
  const uei = str(reg["ueiSAM"] ?? reg["uei"] ?? e["uei"]);
  const cage = str(reg["cageCode"] ?? e["cageCode"]);
  const phone = str(e["phoneNumber"]);
  if (!name && !street && !uei && !cage) return {};
  const out: PartyAddress = {
    name,
    company_name: name,
    legal_name: name,
    street,
    city,
    state,
    postal_code: postal,
    code: uei,
    facility_code: cage,
  };
  if (phone) out.phone = phone;
  out.name_address = joinNameAddress(out);
  return out;
}

function emptyCanonical(): CanonicalRecord {
  return {
    contract: {},
    contractor: {},
    issuing_office: {},
    administering_office: {},
    payment_office: {},
    delivery: {},
    terms: {},
    classification: {},
  };
}

/** A value on a form-shaped bag, by dotted path. */
function getPath(data: Record<string, unknown>, path: string): unknown {
  if (path in data) return data[path];
  let node: unknown = data;
  for (const part of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (!part) continue;
    if (node === null || node === undefined || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/**
 * Form-shaped data read into the canonical record. Discrete parts and entity
 * data come first. When only a block of address text is on the record it is
 * kept whole on name_address; it is never taken apart.
 */
export function toCanonical(
  formId: FormId,
  data: Record<string, unknown>,
  options?: { samEntity?: unknown },
): CanonicalRecord {
  const can = emptyCanonical();
  const samParty = partyFromSam(options?.samEntity);

  can.contract.number = str(getPath(data, "contract.number"));
  can.contract.id_code = str(getPath(data, "contract.id_code"));
  can.contract.award_effective_date = str(getPath(data, "contract.award_effective_date"));

  if (formId === "of347") {
    Object.assign(can.contractor, {
      name: str(getPath(data, "contractor.name")),
      company_name: str(getPath(data, "contractor.company_name")),
      street: str(getPath(data, "contractor.street")),
      city: str(getPath(data, "contractor.city")),
      state: str(getPath(data, "contractor.state")),
      postal_code: str(getPath(data, "contractor.postal_code")),
    });
    if (samParty.name || samParty.street) Object.assign(can.contractor, samParty);
    can.contractor.name_address = joinNameAddress(can.contractor);
    can.issuing_office.name_address = str(getPath(data, "issuing_office.address"));
    Object.assign(can.delivery, {
      name: str(getPath(data, "ship_to.name")),
      street: str(getPath(data, "ship_to.street")),
      city: str(getPath(data, "ship_to.city")),
      state: str(getPath(data, "ship_to.state")),
      postal_code: str(getPath(data, "ship_to.postal_code")),
      method: str(getPath(data, "shipping.method")),
    });
    can.delivery.name_address = joinNameAddress(can.delivery);
    Object.assign(can.payment_office, {
      name: str(getPath(data, "invoice.mail_to.name")),
      street: str(getPath(data, "invoice.mail_to.street")),
      city: str(getPath(data, "invoice.mail_to.city")),
      state: str(getPath(data, "invoice.mail_to.state")),
      postal_code: str(getPath(data, "invoice.mail_to.postal_code")),
    });
    can.terms.discount = str(getPath(data, "payment.discount_terms"));
  } else {
    // The forms that print one block of address text.
    if (samParty.name || samParty.street) {
      Object.assign(can.contractor, samParty);
      const code = str(getPath(data, "contractor.code"));
      const facility = str(getPath(data, "contractor.facility_code"));
      const phone = str(getPath(data, "contractor.phone"));
      if (code) can.contractor.code = code;
      if (facility) can.contractor.facility_code = facility;
      if (phone) can.contractor.phone = phone;
    } else {
      can.contractor.name_address = str(getPath(data, "contractor.name_address"));
      can.contractor.code = str(getPath(data, "contractor.code"));
      can.contractor.facility_code = str(getPath(data, "contractor.facility_code"));
      can.contractor.phone = str(getPath(data, "contractor.phone"));
      // The block of text is kept whole on purpose; it is not taken apart.
    }
    Object.assign(can.issuing_office, (getPath(data, "issuing_office") as object) ?? {});
    Object.assign(
      can.administering_office,
      (getPath(data, "administering_office") as object) ?? {},
    );
    if (formId === "sf1449") {
      can.delivery.name_address = str(getPath(data, "delivery.deliver_to.name_address"));
      can.delivery.code = str(getPath(data, "delivery.deliver_to.code"));
      can.payment_office.name_address = str(getPath(data, "payment.office.name_address"));
      can.payment_office.code = str(getPath(data, "payment.office.code"));
      can.terms.discount = str(getPath(data, "offer.discount_terms"));
      can.classification.naics = str(getPath(data, "acquisition.naics"));
      can.classification.size_standard = str(getPath(data, "acquisition.size_standard"));
    }
  }
  return can;
}

/** The canonical record written back into the shape one form reads. */
export function fromCanonical(formId: FormId, can: CanonicalRecord): Record<string, unknown> {
  const x: Record<string, unknown> = {
    contract: {
      number: can.contract.number,
      id_code: can.contract.id_code,
      award_effective_date: can.contract.award_effective_date,
    },
  };
  if (formId === "sf1449") {
    x["contractor"] = {
      name_address: can.contractor.name_address || joinNameAddress(can.contractor),
      code: can.contractor.code,
      facility_code: can.contractor.facility_code,
      phone: can.contractor.phone,
    };
    x["issuing_office"] = can.issuing_office;
    x["administering_office"] = can.administering_office;
    x["delivery"] = {
      deliver_to: {
        name_address: can.delivery.name_address || joinNameAddress(can.delivery),
        code: can.delivery.code,
      },
    };
    x["payment"] = {
      office: {
        name_address: can.payment_office.name_address || joinNameAddress(can.payment_office),
        code: can.payment_office.code,
      },
    };
    x["acquisition"] = {
      naics: can.classification.naics,
      size_standard: can.classification.size_standard,
    };
  }
  if (formId === "of347") {
    x["contractor"] = {
      name: can.contractor.name ?? "",
      company_name: can.contractor.company_name || can.contractor.name || "",
      street: can.contractor.street ?? "",
      city: can.contractor.city ?? "",
      state: can.contractor.state ?? "",
      postal_code: can.contractor.postal_code ?? "",
    };
    x["issuing_office"] = { address: can.issuing_office.name_address ?? "" };
    x["ship_to"] = {
      name: can.delivery.name ?? "",
      street: can.delivery.street ?? "",
      city: can.delivery.city ?? "",
      state: can.delivery.state ?? "",
      postal_code: can.delivery.postal_code ?? "",
    };
    x["shipping"] = { method: can.delivery.method ?? "" };
    x["invoice"] = {
      mail_to: {
        name: can.payment_office.name ?? "",
        street: can.payment_office.street ?? "",
        city: can.payment_office.city ?? "",
        state: can.payment_office.state ?? "",
        postal_code: can.payment_office.postal_code ?? "",
      },
    };
    x["payment"] = { discount_terms: can.terms.discount ?? "" };
  }
  if (formId === "sf30") {
    x["contractor"] = {
      name_address: can.contractor.name_address || joinNameAddress(can.contractor),
      code: can.contractor.code,
      facility_code: can.contractor.facility_code,
    };
    x["issuing_office"] = can.issuing_office;
    x["administering_office"] = can.administering_office;
  }
  return x;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const isEmptyValue = (v: unknown): boolean => v === undefined || v === null || v === "";

/**
 * The adapted slices laid over an existing form bag. An empty adapted value
 * never wipes a value the bag already carries, so an unrecorded address stays
 * as it was rather than being blanked.
 */
export function mergeAdapted(
  base: Record<string, unknown>,
  adapted: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(adapted)) {
    if (isPlainObject(value)) {
      const current = isPlainObject(out[key]) ? (out[key] as Record<string, unknown>) : {};
      out[key] = mergeAdapted(current, value);
    } else if (!isEmptyValue(value)) {
      out[key] = value;
    }
  }
  return out;
}

/** One pass: read the bag into the canonical record and write it back out. */
export function withCanonical(
  formId: FormId,
  data: Record<string, unknown>,
  options?: { samEntity?: unknown },
): Record<string, unknown> {
  const canonical = toCanonical(formId, data, options);
  return mergeAdapted(data, fromCanonical(formId, canonical));
}

/** The record paths one adapter writes, for the notes and for future checks. */
export function adapterPaths(rows: FormFieldMapping[], formId: FormId): string[] {
  return Array.from(
    new Set(rows.filter((r) => r.form_id === formId).map((r) => r.record_path).filter(Boolean)),
  ).sort();
}
