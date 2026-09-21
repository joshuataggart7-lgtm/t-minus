/**
 * Soft Walk — Option Exercise Determination, written into the NASA OP master
 * at /forms/OPTION_EXERCISE_MASTER.docx. The master keeps the HQ letterhead,
 * styles, footer version identifier and both signature lines. Its instruction
 * pages and Document History Log are removed before shipping.
 *
 * The determination is written on an awarded contract that carries options, so
 * commercial and simplified sample files are refused rather than dressed in
 * this face. Empty fields never print a stand-in; signature ink stays blank.
 *
 * Every citation on the face comes from the HQ source: FAR 17.204,
 * FAR 17.204-1(b)(2), (b)(3)(i) through (vi), FAR Part 5, FAR Part 6,
 * NFS CG 1817.27 and NFS CG 1817.28.
 */
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { isSoftWalkCommercialSample, resolveOfficerName } from "@/lib/softwalk-samples";
import type { ExportContext } from "@/lib/template-engine";

export const OPTION_EXERCISE_MASTER_URL = "/forms/OPTION_EXERCISE_MASTER.docx";

export type OptionExerciseContext = ExportContext & {
  acq?: Record<string, unknown> | undefined;
};

const KEEP = " ";

const str = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

function clean(value: unknown): string {
  return str(value)
    .replace(/\s*\[(?:Insert|insert|Describe|Check|Provide|List|NOTE|Note|Use|OR|Consider)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function methodText(ctx: OptionExerciseContext): string {
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
 * True where an option may be exercised on this record: an awarded instrument
 * that carries an option. Protected commercial samples refuse.
 */
export function isOptionExercisePath(ctx: OptionExerciseContext): boolean {
  if (
    isSoftWalkCommercialSample({
      ...(ctx.acq ?? {}),
      acquisition_id: ctx.acquisitionId,
    })
  )
    return false;
  const method = methodText(ctx);
  if (/commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*12\b/i.test(method)) return false;
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const contract = clean(values["contract_number"]) || str(acq["contract_number"]);
  const option = clean(values["option_period"]);
  const phase = `${str(acq["current_phase"])} ${str(values["__phase"])}`;
  const awarded = /award|administration|post|launch|closeout/i.test(phase);
  return Boolean(contract || option) && (awarded || Boolean(contract));
}

/** Marker values for the active Option Exercise Determination. */
export function optionExerciseMarkers(ctx: OptionExerciseContext): MarkerMap {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => clean(values[key]);

  const officer = value("co_name") || resolveOfficerName(acq, ctx.coName);
  const cor = value("cor_name") || str(acq["cor_name"]);
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const contract = value("contract_number") || str(acq["contract_number"]) || ctx.acquisitionId;
  const contractor = value("contractor_name") || str(acq["vendor_legal_name"]);
  const optionPeriod = value("option_period");
  const optionValue = value("option_value");
  const funds = value("funds_available");
  const stillNeeded = value("still_needed");
  const methodBasis = value("method_basis");
  const methodChoice = value("method");
  const price = value("price_reasonable");
  const synopsis = value("synopsis");
  const determination = value("determination");
  const newEnd = value("new_pop_end");

  const optionLabel = optionPeriod || "the option";

  const intro = `In accordance with Federal Acquisition Regulation (FAR) 17.204, and the NASA FAR Supplement (NFS) Companion Guide (CG) 1817.27 and 1817.28, the following determination is made in support of exercising ${optionLabel} under ${contract}, ${title}.`;

  const fundsText = [
    "1.",
    funds || "Funds are available to exercise this option.",
    optionValue ? `The value of the option is ${optionValue}.` : "",
    "[FAR 17.204-1(b)(2)].",
  ]
    .filter(Boolean)
    .join(" ");

  const requirement = [
    "2. The option fulfills the following existing Government requirement:",
    stillNeeded || title,
    "[FAR 17.204-1(b)(3)(i)].",
  ].join(" ");

  const scope =
    "3. There were no changes in the scope of the option requirements [NFS CG 1817.27(a)].";

  const synopsisText = [
    "4. The option was synopsized in accordance with FAR Part 5 unless exempted.",
    synopsis,
    "[FAR 17.204-1(b)(3)(ii)]",
  ]
    .filter(Boolean)
    .join(" ");

  const samCheck = [
    "5. The contractor",
    contractor ? `, ${contractor},` : "",
    " has an active and accurate record in the System for Award Management (SAM) and no ineligible, prohibition, restriction or exclusion records in SAM [FAR 17.204-1(b)(3)(iii)].",
  ]
    .join("")
    .replace(/\s{2,}/g, " ");

  const performance =
    "6. The contractor's performance on the current contract has been acceptable; evaluations on this and other similar contracts have been considered [FAR 17.204-1(b)(3)(iv)].";

  const priceText = [
    "7.",
    price ||
      "After reviewing price and other relevant factors, the option price is fair and reasonable based on current market conditions, and exercise of the option is in the Government's best interest.",
    "[FAR 17.204-1(b)(3)(v) and NFS CG 1817.28].",
  ].join(" ");

  const consideration = [methodChoice, methodBasis].filter(Boolean).join(" ");

  const competition =
    "8. The option exercise complies with the requirements of FAR part 6 for full and open competition, i.e., the option was evaluated as part of the initial competition and is exercisable at an amount specified in or reasonably determinable from the terms of the contract. (FAR 17.204-1(b)(3)(vi))";

  const determinationText = [
    `9. Based on the above findings, the Contracting Officer hereby determines that the exercise of ${optionLabel} under ${contract} is in accordance with the terms of the option, the requirements of FAR 17.204, NFS CG 1817.27 and 1817.28 and the requirements of FAR Part 6. This is the most advantageous method of fulfilling the Government's needs, price and other factors considered.`,
    newEnd ? `The period of performance runs through ${newEnd}.` : "",
    determination,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    "[[CONTRACT_LINE]]": contract,
    "[[INTRO]]": intro,
    "[[FUNDS]]": fundsText,
    "[[REQUIREMENT]]": requirement,
    "[[SCOPE]]": scope,
    "[[SYNOPSIS]]": synopsisText,
    "[[SAM_CHECK]]": samCheck,
    "[[PERFORMANCE]]": performance,
    "[[PRICE]]": priceText,
    // An empty basis removes the paragraph rather than printing a stand-in.
    "[[CONSIDERATION]]": consideration,
    "[[COMPETITION]]": competition,
    "[[DETERMINATION]]": determinationText,
    "[[CO_NAME]]": officer || KEEP,
    "[[COR_NAME]]": cor || KEEP,
  };
}

/** Fill the genuine HQ Option Exercise master and return the bytes. */
export async function generateOptionExerciseDocx(
  ctx: OptionExerciseContext,
): Promise<Uint8Array> {
  if (!isOptionExercisePath(ctx)) {
    throw new Error("This record is not on a path that exercises a contract option.");
  }
  const response = await fetch(OPTION_EXERCISE_MASTER_URL);
  if (!response.ok) throw new Error("The Option Exercise master could not be read from this app.");
  const bytes = await response.arrayBuffer();
  const map = optionExerciseMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the determination was not written: ${split.join(", ")}.`,
    );
  }
  return applyMarkers(bytes, map);
}
