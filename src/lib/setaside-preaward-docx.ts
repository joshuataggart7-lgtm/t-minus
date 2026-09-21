/**
 * Soft Walk — Set-aside preaward apparent successful offeror notification,
 * written into the NASA OP master at
 * /forms/SETASIDE_PREAWARD_MASTER.docx. The instruction pages, the colour
 * coded drafter notes and the document history log are already out of the
 * master; styles, headers, footers and the template version identifier stay as
 * the master writes them. Only marker runs are filled from the record.
 *
 * Authority on the face, from the master's own text:
 *   FAR 15.206-1(b)(1) — preaward notification on a negotiated acquisition.
 *   FAR 19.201-2 and 19.201-2(d)(1) — small business size status challenge,
 *     five business days.
 *   NFS CG 1815.28 — NASA preaward notification process.
 *
 * A commercial or simplified file is refused rather than dressed in Part 15
 * prose. Signature ink stays blank; the contracting officer's name prints when
 * the record carries one.
 */
import { type ExportContext } from "@/lib/template-engine";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { resolveOfficerName } from "@/lib/softwalk-samples";

export const SETASIDE_PREAWARD_MASTER_URL = "/forms/SETASIDE_PREAWARD_MASTER.docx";

/** Keep-token: an empty value would delete the paragraph. */
const KEEP = " ";

export type SetAsidePreawardContext = ExportContext & {
  /** The acquisition row, when the caller carries it, for the method gate. */
  acq?: Record<string, unknown> | undefined;
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

function cleanProse(text: string): string {
  return text
    .replace(/\s*\[(?:Insert|insert|Describe|Check|Provide|List|NOTE)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function methodText(ctx: SetAsidePreawardContext): string {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  return `${str(v["acquisition_method"])} ${str(acq["acquisition_method"])} ${str(acq["contract_format"])} ${str(v["__method"])}`;
}

function setAsideText(ctx: SetAsidePreawardContext): string {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  return `${str(v["set_aside"])} ${str(acq["set_aside"])}`;
}

/** True where the file records a commercial or simplified path. */
export function isCommercialOrSimplified(ctx: SetAsidePreawardContext): boolean {
  return /commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*12\b/i.test(methodText(ctx));
}

/** True where the record carries a small business set-aside. */
export function hasSmallBusinessSetAside(ctx: SetAsidePreawardContext): boolean {
  const text = setAsideText(ctx);
  if (!text.trim() || /^none\b/i.test(text.trim())) return false;
  return /small business|8\(a\)|hubzone|sdvosb|service-disabled|wosb|edwosb|women-owned/i.test(text);
}

/**
 * True only on a FAR Part 15 negotiated set-aside. A commercial or simplified
 * file is refused so the Part 15 preaward notice is never forced onto the
 * wrong record, and a file with no set-aside on it is refused as well.
 */
export function isSetAsidePreawardPath(ctx: SetAsidePreawardContext): boolean {
  if (isCommercialOrSimplified(ctx)) return false;
  if (!hasSmallBusinessSetAside(ctx)) return false;
  return /\b15\b|15\.\d|negotiat/i.test(methodText(ctx));
}

/** True where the letter goes to an unsuccessful offeror. */
function isUnsuccessfulVariant(ctx: SetAsidePreawardContext): boolean {
  return /unsuccessful/i.test(str((ctx.values ?? {})["notice_variant"]));
}

function officerBlock(ctx: SetAsidePreawardContext) {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const officer = str(v["co_name"]) || resolveOfficerName(acq, ctx.coName);
  return {
    name: officer,
    email: cleanProse(str(v["co_email"])),
    phone: cleanProse(str(v["co_phone"])),
  };
}

/** The marker map for the preaward notice, in the variant on the record. */
export function setAsidePreawardMarkers(ctx: SetAsidePreawardContext): MarkerMap {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const co = officerBlock(ctx);
  const center = value("center_name") || str(ctx.centerName) || str(acq["center_code"]) || "NASA";
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const addressee = value("addressee");
  const addressLines = addressee.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const selected = value("selected_offeror") || str(acq["vendor_legal_name"]);
  const selectedAddress = value("selected_offeror_address") || selected;
  const unsuccessful = isUnsuccessfulVariant(ctx);

  return {
    "[[CENTER_NAME]]": center,
    "[[CENTER_ADDRESS]]": str(ctx.centerAddress) || KEEP,
    "[[LETTER_DATE]]": value("letter_date") || str(ctx.preparedDate) || KEEP,
    "[[ORG_CODE]]": value("org_code") || str(ctx.organizationCode) || KEEP,
    "[[POC_NAME]]": value("poc_name") || KEEP,
    "[[POC_TITLE]]": addressLines[0] ?? KEEP,
    "[[OFFEROR_NAME]]": addressLines[1] ?? (unsuccessful ? KEEP : selected || KEEP),
    "[[OFFEROR_STREET]]": addressLines[2] ?? KEEP,
    "[[OFFEROR_CITY_STATE_ZIP]]": addressLines[3] ?? KEEP,
    "[[SOLICITATION_NUMBER]]": value("solicitation_number") || KEEP,
    "[[ACQ_TITLE]]": title,
    "[[SALUTATION_NAME]]": value("poc_name") || selected || KEEP,

    // Apparent successful offeror paragraphs; emptied on the unsuccessful
    // variant, which deletes them from the letter.
    "[[SUCCESS_COMPANY_NAME]]": unsuccessful ? "" : selected || KEEP,
    "[[SUCCESS_ACQ_NAME]]": unsuccessful ? "" : title,
    "[[SUCCESS_OFFEROR_NAME]]": unsuccessful ? "" : selected || KEEP,
    "[[SUCCESS_OFFEROR_NAME_2]]": unsuccessful ? "" : selected || KEEP,
    "[[SUCCESS_AWARD_DATE]]":
      unsuccessful ? "" : value("anticipated_award_date") || str(acq["target_award_date"]) || KEEP,

    // Unsuccessful offeror paragraphs; emptied on the successful variant.
    "[[UNSUCCESS_INTRO]]": unsuccessful
      ? "In accordance with FAR 15.206-1(b)(1), this notification follows NFS CG 1815.28 and identifies the apparent successful offeror for the subject solicitation:"
      : "",
    "[[UNSUCCESS_SELECTED_OFFEROR]]": unsuccessful ? selectedAddress || KEEP : "",
    "[[UNSUCCESS_REVISIONS]]": unsuccessful
      ? "The Government will not consider subsequent revisions to your proposal."
      : "",
    "[[UNSUCCESS_CHALLENGE]]": unsuccessful
      ? "In accordance with FAR 19.201-2(d)(1), a response is not required unless a basis exists to challenge the size status or small business status of the apparently successful offeror. Size status or small business status challenges must be submitted to the contracting officer in writing by the close of business of the fifth business day after receipt of this letter."
      : "",
    "[[UNSUCCESS_FOLLOWUP]]": unsuccessful
      ? "If no size status or small business status challenge is received within five business days of this letter, a postaward notification will be sent with information on how to request a debriefing along with the Source Selection Statement detailing the Government\u2019s selection decision."
      : "",

    "[[CO_PHONE]]": co.phone || KEEP,
    "[[CO_EMAIL]]": co.email || KEEP,
    "[[CO_NAME]]": co.name || KEEP,
  };
}

/** The filled set-aside preaward notification, as .docx bytes. */
export async function generateSetAsidePreawardDocx(
  ctx: SetAsidePreawardContext,
): Promise<Uint8Array> {
  const res = await fetch(SETASIDE_PREAWARD_MASTER_URL);
  if (!res.ok) throw new Error("The letter master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const map = setAsidePreawardMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the letter was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}
