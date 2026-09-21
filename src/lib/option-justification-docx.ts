/**
 * Soft Walk — Option Justification memorandum for the record, written into the
 * NASA OP master at /forms/OPTION_JUST_MASTER.docx. The master keeps the HQ
 * letterhead, styles, footer version identifier and signature line. Its
 * instruction pages and Document History Log are removed before shipping.
 *
 * The justification is written before the solicitation includes options, so it
 * belongs to a negotiated or sealed-bid solicitation path. Commercial and
 * simplified files are refused rather than dressed in this memorandum. Empty
 * fields never print a stand-in; signature ink always stays blank.
 */
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { isSoftWalkCommercialSample, resolveOfficerName } from "@/lib/softwalk-samples";
import type { ExportContext } from "@/lib/template-engine";

export const OPTION_JUST_MASTER_URL = "/forms/OPTION_JUST_MASTER.docx";

export type OptionJustificationContext = ExportContext & {
  acq?: Record<string, unknown> | undefined;
};

const KEEP = " ";

const str = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

function clean(value: unknown): string {
  return str(value)
    .replace(/\s*\[(?:Insert|insert|Describe|Check|Provide|List|NOTE|Use|OR)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function methodText(ctx: OptionJustificationContext): string {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  return [
    values["__method"],
    values["acquisition_method"],
    acq["acquisition_method"],
    acq["contract_format"],
    acq["competition"],
  ]
    .map(str)
    .join(" ");
}

/**
 * True where options may be justified on this record: a negotiated or sealed
 * bid solicitation path. Commercial and simplified files are refused.
 */
export function isOptionJustificationPath(ctx: OptionJustificationContext): boolean {
  // Protected Soft Walk Samples 1 and 2 are commercial streamlined files.
  if (isSoftWalkCommercialSample({
    ...(ctx.acq ?? {}),
    acquisition_id: ctx.acquisitionId,
  })) return false;
  const method = methodText(ctx);
  if (/commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*12\b/i.test(method)) return false;
  return /\b15\b|15\.\d|negotiat|sealed bid|\b14\b/i.test(method);
}

/** Marker values for the active Option Justification memorandum. */
export function optionJustificationMarkers(ctx: OptionJustificationContext): MarkerMap {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => clean(values[key]);

  const officer = value("co_name") || resolveOfficerName(acq, ctx.coName);
  const org = value("org_code") || str(ctx.organizationCode);
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const solicitation = value("solicitation_number");
  const instrument = value("instrument") || "contract";
  const optionDescription = value("option_description") || value("option_periods");
  const basePeriod = value("base_period");
  const interest = value("government_interest");
  const foreseeable = value("need_foreseeable");
  const notUsed = value("not_used");
  const determination = value("determination");
  const noticeDays = value("option_notice_days");
  const exerciseDays = value("option_exercise_days");

  const from = [org, officer].filter(Boolean).join("/");

  const inclusion = [
    optionDescription
      ? `The inclusion of ${optionDescription} in the ${instrument} is hereby determined to be in the best interest of the Government.`
      : `The inclusion of options in the ${instrument} is hereby determined to be in the best interest of the Government.`,
    basePeriod ? `The base period is ${basePeriod}.` : "",
    "As a result, in accordance with FAR 17.201-1 the following information is provided.",
    "This justification is documented in writing in accordance with FAR 17.201-2 and follows the format at NFS CG 1817.25.",
  ]
    .filter(Boolean)
    .join(" ");

  const basis = [interest, foreseeable, notUsed, determination].filter(Boolean).join(" ");

  const notification = [
    "All necessary provisions and option clauses will be included in the solicitation and resultant",
    `${instrument}`,
    exerciseDays
      ? `along with the requirement that the option will be exercised within ${exerciseDays} days before the ${instrument} expires`
      : "along with the requirement that the option will be exercised before the contract expires",
    noticeDays
      ? `, provided the Government gives the Contractor a preliminary written notice of its intent to exercise the option at least ${noticeDays} days before the ${instrument} expires.`
      : ", provided the Government gives the Contractor a preliminary written notice of its intent to exercise the option.",
  ]
    .join(" ")
    .replace(/\s+([,.])/g, "$1");

  return {
    "[[FROM_LINE]]": from || KEEP,
    "[[SOLICITATION_LINE]]": [solicitation, title].filter(Boolean).join(", ") || ctx.acquisitionId,
    "[[INCLUSION]]": inclusion,
    // An empty basis removes the paragraph rather than printing a stand-in.
    "[[BASIS]]": basis,
    "[[EVALUATION]]":
      "The subject solicitation will state that the basis of the evaluation will be inclusive of the option.",
    "[[NOTIFICATION]]": notification,
    "[[CO_NAME]]": officer || KEEP,
  };
}

/** Fill the genuine HQ Option Justification master and return the bytes. */
export async function generateOptionJustificationDocx(
  ctx: OptionJustificationContext,
): Promise<Uint8Array> {
  if (!isOptionJustificationPath(ctx)) {
    throw new Error("This record is not on a solicitation path that justifies options.");
  }
  const response = await fetch(OPTION_JUST_MASTER_URL);
  if (!response.ok) throw new Error("The Option Justification master could not be read from this app.");
  const bytes = await response.arrayBuffer();
  const map = optionJustificationMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(`The master splits these markers across runs, so the memorandum was not written: ${split.join(", ")}.`);
  }
  return applyMarkers(bytes, map);
}
