/**
 * Soft Walk — UCA / Letter Contract Justification, written into the NASA OP
 * master at /forms/UCA_JUST_MASTER.docx. The master keeps the HQ letterhead,
 * styles, footer version identifier and the signature underscores. Its
 * instruction pages and Document History Log are removed.
 *
 * The master is built on the letter-contract branch of the HQ face: the
 * UCA-only purpose paragraphs, the UCA scope statement, the UCA government
 * estimate, the contract-type not-to-exceed language, the FAR 52.243-6 change
 * order accounting block and the UCA signature page are removed there, as the
 * HQ face directs when a letter contract is the action.
 *
 * Every citation on the face comes from the HQ source: FAR 16.603 and NFS CG
 * 1816.65 and 1816.66 for the purpose and the determination. Nothing else is
 * added. Empty fields never print a stand-in; signature ink stays blank.
 */
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { isSoftWalkCommercialSample, resolveOfficerName } from "@/lib/softwalk-samples";
import type { ExportContext } from "@/lib/template-engine";

export const UCA_JUST_MASTER_URL = "/forms/UCA_JUST_MASTER.docx";

export type UcaJustContext = ExportContext & {
  acq?: Record<string, unknown> | undefined;
};

const KEEP = " ";

const str = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

function clean(value: unknown): string {
  return str(value)
    .replace(/\s*\[(?:Insert|insert|Describe|Check|Provide|List|NOTE|Note|Use|OR|Select)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert|Identify|Describe|Select)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function money(value: unknown): string {
  const raw = str(value);
  if (!raw) return "";
  const digits = raw.replace(/[^0-9.]/g, "");
  const n = Number.parseFloat(digits);
  if (!Number.isFinite(n)) return raw;
  return `$${n.toLocaleString("en-US")}`;
}

function methodText(ctx: UcaJustContext): string {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  return [
    values["__method"],
    values["action_kind"],
    values["acquisition_method"],
    values["authorization"],
    acq["acquisition_method"],
    acq["contract_format"],
    acq["vehicle"],
    acq["competition"],
  ]
    .map(str)
    .join(" ");
}

/**
 * True where an undefinitized action or letter contract justification belongs.
 * Protected commercial samples and Part 12 or 13 files refuse.
 */
export function isUcaJustPath(ctx: UcaJustContext): boolean {
  if (
    isSoftWalkCommercialSample({
      ...(ctx.acq ?? {}),
      acquisition_id: ctx.acquisitionId,
    })
  )
    return false;
  const method = methodText(ctx);
  if (/commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*1[23]\b/i.test(method)) return false;
  return /letter contract|undefinitized|\bUCA\b|16\.603|1843\.6|1816\.6[56]/i.test(method);
}

/** Marker values for the letter-contract justification face. */
export function ucaJustMarkers(ctx: UcaJustContext): MarkerMap {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => clean(values[key]);

  const officer = value("co_name") || resolveOfficerName(acq, ctx.coName);
  const title = value("acquisition_name") || str(acq["title"]) || ctx.acquisitionId;
  const center = value("center_name") || str(acq["center_name"]) || str(acq["center"]);
  const contractor =
    value("contractor_address") || value("contractor_name") || str(acq["vendor_legal_name"]);
  const place = value("place_of_performance") || str(acq["place_of_performance"]);
  const instrument =
    value("action_number") || value("contract_number") || str(acq["contract_number"]);
  const pop = value("performance_period");
  const igeLetter = money(values["igce_uca"]);
  const igeDefinitized = money(values["igce_total_change"] ?? acq["estimated_value"]);
  const definitizedType = value("definitized_type") || str(acq["contract_type"]);
  const nte = money(values["nte_amount"]);
  const nteDate = value("nte_date");
  const fundingNote = value("funding_profile");
  const background = value("background");
  const impact = value("impact");
  const schedule = value("definitization_schedule");
  const authorization = value("authorization");

  const purpose =
    "In accordance with Federal Acquisition Regulation (FAR) 16.603 and National Aeronautics and Space Administration (NASA) FAR Supplement (NFS) Companion Guide (CG) 1816.65 and 1816.66, this document provides justification and request for approval to issue a letter contract.";

  const bestInterest =
    "This letter contract is in the Government\u2019s best interest because negotiating a definitive contract is not possible in sufficient time to meet the requirement and will provide the contractor with a binding commitment so that work can start immediately.";

  const igeLetterText = igeLetter
    ? `The independent government estimate for the letter contract is ${igeLetter}.`
    : "";
  const igeDefText = igeDefinitized
    ? [
        `The independent government estimate for the definitized contract is ${igeDefinitized}.`,
        definitizedType ? `The contract type of the definitized contract is ${definitizedType}.` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const nteText = nte
    ? [
        `The contractor submitted a not-to-exceed amount of ${nte} for the letter contract requirements`,
        nteDate ? `, based on the proposal submitted by the contractor on ${nteDate}` : "",
        ".",
      ].join("")
    : "";

  const determination =
    "Based on the above, it is the determination of the undersigned, pursuant to FAR 16.603 and NFS CG 1816.65 and 1816.66, that it is in the Government\u2019s best interest for the contractor to start work immediately, and that negotiating a definitive contract action is not possible in sufficient time to meet the requirements.";

  const authorizationText = [
    "Upon approval of this letter contract, NASA will authorize the contractor to begin incurring costs for urgent work performed in advance of definitization.",
    authorization ? `NASA will communicate this authorization by issuing a ${authorization.toLowerCase()}.` : "",
    nte ? `The not-to-exceed estimate amount is ${nte}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    "[[TITLE_LINE]]": "Justification and Approval for Issuing a Letter Contract",
    "[[CENTER_NAME]]": center || KEEP,
    "[[PURPOSE]]": purpose,
    "[[BEST_INTEREST]]": bestInterest,
    "[[BACKGROUND]]": background,
    "[[IMPACT]]": impact,
    "[[CONTRACTOR]]": contractor,
    "[[PLACE]]": place,
    "[[INSTRUMENT_NO]]": instrument,
    "[[POP]]": pop,
    "[[IGE_LETTER]]": igeLetterText,
    "[[IGE_DEFINITIZED]]": igeDefText,
    "[[CLAUSES]]": "The definitized contract will contain all required clauses.",
    "[[NTE]]": nteText,
    "[[FUNDING_NOTE]]": fundingNote,
    "[[DEFINITIZATION]]": schedule,
    "[[DETERMINATION]]": determination,
    "[[AUTHORIZATION]]": authorizationText,
    "[[SIG_TITLE]]": `Letter contract signature page for ${title}`,
    "[[CO_NAME]]": officer || KEEP,
    "[[PO_NAME]]": KEEP,
    "[[PO_LINE]]": center ? `Procurement Officer, ${center}` : "Procurement Officer",
    "[[HCA_NAME]]": KEEP,
  };
}

/** Fill the genuine HQ letter contract justification master and return the bytes. */
export async function generateUcaJustDocx(ctx: UcaJustContext): Promise<Uint8Array> {
  if (!isUcaJustPath(ctx)) {
    throw new Error("This record is not on an undefinitized action or letter contract path.");
  }
  const response = await fetch(UCA_JUST_MASTER_URL);
  if (!response.ok) {
    throw new Error("The letter contract justification master could not be read from this app.");
  }
  const bytes = await response.arrayBuffer();
  const map = ucaJustMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the justification was not written: ${split.join(", ")}.`,
    );
  }
  return applyMarkers(bytes, map);
}
