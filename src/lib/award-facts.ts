/**
 * Award facts for the official forms. The award, solicitation, accounting and
 * office facts recorded at award live in post_award; on a multiple-award
 * vehicle each holder's own contract number, address and priced schedule live
 * on its entry in vehicle.awardees. The forms read flat keys, so this lays the
 * recorded facts over the record row. A value already on the row wins; nothing
 * is invented, and a key with no recorded value stays absent.
 */

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** post_award keys the official forms read. */
const AWARD_KEYS = [
  "award_date",
  "solicitation_number",
  "solicitation_issue_date",
  "offers_due",
  "funding_source",
  "co_phone",
  "co_email",
  "administering_office_code",
  "administering_office_name_address",
  "issuing_office_name_address",
  "payment_office",
  "payment_office_code",
  "sf1449_27a",
  "sf1449_27b",
  "contract_id_code",
  "sf1449_award_block",
  "sf1449_copies",
  "sf1449_offer_reference",
] as const;

export type AwardeeClin = {
  clin_number: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number | null;
};

export type Awardee = {
  name: string;
  uei?: string;
  cage?: string;
  contract_number?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  phone?: string;
  evaluated_price?: number;
  clins?: AwardeeClin[];
};

export function vehicleAwardees(row: Record<string, unknown> | null | undefined): Awardee[] {
  const vehicle = (row?.["vehicle"] ?? {}) as Record<string, unknown>;
  return Array.isArray(vehicle["awardees"]) ? (vehicle["awardees"] as Awardee[]).filter((a) => a && str(a.name)) : [];
}

/**
 * The record row as the forms read it, for one award holder. index selects
 * the holder on a multiple-award vehicle; a single-award record ignores it.
 */
export function withAwardFacts(
  row: Record<string, unknown>,
  index = 0,
): Record<string, unknown> {
  const pa = (row["post_award"] && typeof row["post_award"] === "object" ? row["post_award"] : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...row };
  for (const k of AWARD_KEYS) {
    if (!str(out[k]) && out[k] !== true && out[k] !== false && pa[k] !== undefined && pa[k] !== null && pa[k] !== "") out[k] = pa[k];
  }

  // Recorded per-modification facts (effective date and the like) join the
  // modification rows by number.
  const modFacts = (pa["modifications"] && typeof pa["modifications"] === "object" ? pa["modifications"] : {}) as Record<string, Record<string, unknown>>;
  if (Array.isArray(out["modifications"])) {
    out["modifications"] = (out["modifications"] as Record<string, unknown>[]).map((m) => ({
      ...(modFacts[str(m["mod_number"])] ?? {}),
      ...Object.fromEntries(Object.entries(m).filter(([, v]) => v !== null && v !== undefined && v !== "")),
    }));
  }

  const holders = vehicleAwardees(row);
  const holder = holders.length > 1 ? holders[Math.min(Math.max(0, index), holders.length - 1)] : undefined;
  if (holder) {
    out["awardee_name"] = holder.name;
    out["awardee_uei"] = str(holder.uei);
    out["awardee_cage"] = str(holder.cage);
    out["awardee_street"] = str(holder.street);
    out["awardee_city"] = str(holder.city);
    out["awardee_state"] = str(holder.state);
    out["awardee_postal_code"] = str(holder.postal_code);
    out["awardee_phone"] = str(holder.phone);
    if (str(holder.contract_number)) out["contract_number"] = str(holder.contract_number);
    out["awardee_clins"] = holder.clins ?? [];
    out["awardee_index"] = holders.indexOf(holder);
    out["awardee_count"] = holders.length;
    const vehicle = (row["vehicle"] ?? {}) as Record<string, unknown>;
    // The award obligates the guaranteed minimum; orders obligate the rest.
    if (Number(vehicle["minimum_guarantee"]) > 0) out["award_amount"] = Number(vehicle["minimum_guarantee"]);
    if (Number(vehicle["ceiling"]) > 0) out["vehicle_ceiling"] = Number(vehicle["ceiling"]);
  }
  return out;
}

/** "Name, street, city, ST zip" for an address block. */
export function awardeeAddress(a: Record<string, unknown>): string {
  const cityLine = [str(a["awardee_city"]), [str(a["awardee_state"]), str(a["awardee_postal_code"])].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [str(a["awardee_name"]), str(a["awardee_street"]), cityLine].filter(Boolean).join("\n");
}
