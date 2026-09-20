/**
 * Soft Walk — Postaward notification letters in Word, written into the NASA OP
 * masters at /forms/POSTAWARD_SUCCESS_MASTER.docx and
 * /forms/POSTAWARD_UNSUCCESS_MASTER.docx. The instruction pages, the colour
 * coded drafter notes and the document history logs are already out of the
 * masters; styles, headers, footers and the template version identifier stay
 * as the masters write them. Only marker runs are filled from the record — no
 * scratch OOXML, no letterhead or media added here.
 *
 * Both letters are Part 15 notifications:
 *   Successful  — FAR 15.207-1(a), FAR 15.301-1(a)(1); NFS CG 1815.29,
 *                 1815.31 and 1815.32 carry the debriefing process.
 *   Unsuccessful — FAR 15.207-2(b), FAR 15.301-1.
 *
 * A commercial or simplified file (Sample 1) is refused rather than dressed in
 * Part 15 prose: that path notifies under RFO FAR 12.301, or FAR 13.301 on a
 * simplified noncommercial file, and gives a brief explanation on request.
 *
 * Signature ink stays blank. The contracting officer's name prints on the
 * signature block when the record carries one.
 */
import { type ExportContext } from "@/lib/template-engine";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { resolveOfficerName } from "@/lib/softwalk-samples";

export const POSTAWARD_SUCCESS_MASTER_URL = "/forms/POSTAWARD_SUCCESS_MASTER.docx";
export const POSTAWARD_UNSUCCESS_MASTER_URL = "/forms/POSTAWARD_UNSUCCESS_MASTER.docx";

/** Keep-token: an empty value would delete the paragraph. */
const KEEP = " ";

export type PostawardDocxContext = ExportContext & {
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

function methodText(ctx: PostawardDocxContext): string {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  return `${str(v["acquisition_method"])} ${str(acq["acquisition_method"])} ${str(acq["contract_format"])} ${str(v["__method"])}`;
}

/** True where the file records a commercial or simplified path. */
export function isCommercialOrSimplified(ctx: PostawardDocxContext): boolean {
  return /commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*12\b/i.test(methodText(ctx));
}

/**
 * True only on a FAR Part 15 negotiated path. A commercial or simplified file
 * is refused so the Part 15 notification is never forced onto the wrong record.
 */
export function isPart15NotificationPath(ctx: PostawardDocxContext): boolean {
  if (isCommercialOrSimplified(ctx)) return false;
  return /\b15\b|15\.\d|negotiat/i.test(methodText(ctx));
}

/**
 * The notice a commercial or simplified file makes instead. RFO FAR 12.301 on
 * a commercial file; FAR 13.301 on a simplified noncommercial file.
 */
export function simplifiedNoticeCitation(ctx: PostawardDocxContext): string {
  return /commercial|\bFAR\s*12\b|\bpart\s*12\b/i.test(methodText(ctx))
    ? "RFO FAR 12.301"
    : "FAR 13.301";
}

function officerBlock(ctx: PostawardDocxContext) {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const officer = str(v["co_name"]) || resolveOfficerName(acq, ctx.coName);
  return {
    name: officer,
    email: cleanProse(str(v["co_email"])),
    phone: cleanProse(str(v["co_phone"])),
  };
}

/** The marker map for the successful offeror letter. */
export function postawardSuccessMarkers(ctx: PostawardDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const co = officerBlock(ctx);
  const center = value("center_name") || str(ctx.centerName) || str(acq["center_code"]) || "NASA";
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const company = value("company_name") || str(acq["vendor_legal_name"]) || "Not recorded";
  const addressee = value("addressee");
  const addressLines = addressee.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  return {
    "[[CENTER_NAME]]": center,
    "[[CENTER_ADDRESS]]": str(ctx.centerAddress) || KEEP,
    "[[ORG_CODE]]": value("org_code") || str(ctx.organizationCode) || "Not recorded",
    "[[POC_NAME]]": value("poc_name") || "Not recorded",
    "[[POC_TITLE]]": addressLines[0] ?? KEEP,
    "[[OFFEROR_NAME]]": company,
    "[[OFFEROR_STREET]]": addressLines[1] ?? KEEP,
    "[[OFFEROR_CITY_STATE_ZIP]]": addressLines[2] ?? KEEP,
    "[[SOLICITATION_NUMBER]]": value("solicitation_number") || "Not recorded",
    "[[ACQ_TITLE]]": title,
    "[[ACQ_TITLE_SHORT]]": title,
    "[[SALUTATION_NAME]]": value("poc_name") || company,
    "[[CENTER_NAME_BODY]]": center,
    "[[CENTER_NAME_BODY2]]": center,
    "[[COMPANY_NAME]]": company,
    "[[CONTRACT_NUMBER]]": value("contract_number") || str(acq["contract_number"]) || "Not recorded",
    "[[EFFECTIVE_DATE]]": value("effective_date") || "Not recorded",
    "[[CO_EMAIL]]": co.email || "Not recorded",
    // The authority for this notification, from the master's own reference
    // list: FAR 15.207-1(a) with the NFS CG debriefing process.
    "[[NOTICE_AUTHORITY_LINE]]":
      "This notification is provided under FAR 15.207-1(a). Debriefings are conducted under FAR 15.301-1(b) and (c) and the NASA Procurement Debriefing Guide (NFS CG 1815.31); NFS CG 1815.29 carries the notification process and NFS CG 1815.32 applies to major system acquisitions.",
    "[[CO_PHONE]]": co.phone || "Not recorded",
    "[[CO_NAME]]": co.name || "Not recorded",
    "[[CO_TITLE]]": "Contracting Officer",
    "[[ENCLOSURE_1]]": value("enclosures") || "Source Selection Statement",
  };
}

/** The marker map for the unsuccessful offeror letter. */
export function postawardUnsuccessMarkers(ctx: PostawardDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const co = officerBlock(ctx);
  const center = value("center_name") || str(ctx.centerName) || str(acq["center_code"]) || "NASA";
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const company = value("company_name") || "Not recorded";

  return {
    "[[LETTER_DATE]]": value("letter_date") || str(ctx.preparedDate) || "Not recorded",
    "[[ORG_CODE]]": value("org_code") || str(ctx.organizationCode) || "Not recorded",
    "[[OFFEROR_ADDRESS_BLOCK]]": value("addressee") || company,
    "[[SOLICITATION_NUMBER]]": value("solicitation_number") || "Not recorded",
    "[[ACQ_TITLE]]": title,
    "[[SALUTATION_NAME]]": value("poc_name") || company,
    "[[COMPANY_NAME]]": company,
    "[[COMPANY_NAME_2]]": company,
    "[[CENTER_NAME_BODY]]": center,
    // FAR 15.207-2(b) is the written notification requirement on a negotiated
    // acquisition. The stale FAR 15.502-7 reference is not carried here.
    "[[NOTICE_AUTHORITY_LINE]]":
      "Pursuant to Federal Acquisition Regulation (FAR) 15.207-2(b), the following information is provided:",
    "[[OFFERORS_SOLICITED]]": value("offerors_solicited") || "Not recorded",
    "[[PROPOSALS_RECEIVED]]": value("proposals_received") || "Not recorded",
    "[[AWARDEES]]": value("awardees") || "Not recorded",
    "[[CONTRACT_VALUE]]": value("contract_value") || str(acq["estimated_value"]) || "Not recorded",
    "[[VALUE_PERIOD]]": value("value_period") || KEEP,
    "[[EVALUATION_FACTORS]]": value("selection_rationale") || "as stated in the solicitation",
    "[[SELECTED_OFFEROR]]": value("awardees") || str(acq["vendor_legal_name"]) || "Not recorded",
    "[[CO_EMAIL]]": co.email || "Not recorded",
    "[[PROPOSAL_DISPOSITION]]":
      "One copy of your proposal will be retained in the permanent contract file, and all remaining copies will be destroyed.",
    "[[CO_PHONE]]": co.phone || "Not recorded",
    "[[CO_NAME]]": co.name || "Not recorded",
    "[[CO_TITLE]]": "Contracting Officer",
    "[[ENCLOSURE_1]]": value("enclosures") || "Source Selection Statement",
  };
}

async function writeFromMaster(url: string, map: MarkerMap): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("The letter master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the letter was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}

/** The filled successful offeror notification, as .docx bytes. */
export async function generatePostawardSuccessDocx(ctx: PostawardDocxContext): Promise<Uint8Array> {
  return await writeFromMaster(POSTAWARD_SUCCESS_MASTER_URL, postawardSuccessMarkers(ctx));
}

/** The filled unsuccessful offeror notification, as .docx bytes. */
export async function generatePostawardUnsuccessDocx(ctx: PostawardDocxContext): Promise<Uint8Array> {
  return await writeFromMaster(POSTAWARD_UNSUCCESS_MASTER_URL, postawardUnsuccessMarkers(ctx));
}
