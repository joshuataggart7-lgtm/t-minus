/**
 * Soft Walk — 8(a) sole source award or modification greater than $30M, in
 * Word, written into the NASA OP cite-fixed master at
 * /forms/JOFOC_8A_MASTER.docx. Instruction pages and the document history log
 * are already out of the master; styles, footer and the post-award actions
 * (HQ public announcement under NFS CG 1805.31 and 1805.32, ANOSCA, award
 * notice) stay as the master itself writes them. Only marker runs are filled
 * from the record — no scratch OOXML.
 *
 * Who signs stays amount-driven: one signature band prints (over $30M but not
 * exceeding $150M, or exceeding $150M) and the other is deleted. Signature
 * underscores stay blank; Soft Walk co_name fills [[CO_NAME]] on the active
 * band only.
 */
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { type JofocDocxContext } from "@/lib/jofoc-docx";

export const JOFOC_8A_MASTER_URL = "/forms/JOFOC_8A_MASTER.docx";

/** The 8(a) sole-source justification is required above this value. */
export const JOFOC_8A_FLOOR = 30_000_000;
/** The signature ladder splits at this value. */
export const JOFOC_8A_HCA_CEILING = 150_000_000;

/** Keep-token: an empty value would delete the paragraph. */
const KEEP = " ";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

function parseMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number(String(raw ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

const moneyProse = (n: number) => `$${n.toLocaleString("en-US")}`;

function cleanProse(text: string): string {
  return text
    .replace(/\s*\[(?:DO NOT delete|Do not delete|Describe|Insert)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The estimated value the record carries for this action. */
export function jofoc8aEstimatedValue(ctx: JofocDocxContext): number {
  const v = ctx.values ?? {};
  return parseMoney(v["estimated_value"] ?? v["total_estimated_value"] ?? v["value"]);
}

export type Jofoc8aBandId = "GT_30M_LE_150M" | "GT_150M";

/** Which signature page prints, from the estimated value. */
export function selectJofoc8aSigBand(estimatedValue: number): Jofoc8aBandId {
  return estimatedValue > JOFOC_8A_HCA_CEILING ? "GT_150M" : "GT_30M_LE_150M";
}

/**
 * True only on a sole-source 8(a) path above $30 million. A competed file, or
 * an 8(a) action at or below the floor, is refused so the justification is
 * never forced onto the wrong record.
 */
export function isJofoc8aPath(ctx: JofocDocxContext): boolean {
  const v = ctx.values ?? {};
  const text = [
    v["authority"],
    v["authority_rationale"],
    v["acquisition_method"],
    v["set_aside"],
    v["socioeconomic_program"],
    v["competition_type"],
  ]
    .map(str)
    .join(" ");
  const competition = `${str(v["competition_type"])} ${str(v["extent_competed"])}`;
  const eightA = /8\s*\(\s*a\s*\)/i.test(text) || /15\s*U\.?\s*S\.?\s*C\.?\s*637\(a\)/i.test(text);
  if (!eightA) return false;
  if (/full and open|competed|competitive/i.test(competition) && !/sole[- ]source/i.test(text)) return false;
  return jofoc8aEstimatedValue(ctx) > JOFOC_8A_FLOOR;
}

const FAIR_AND_REASONABLE =
  "The contracting officer's signature on this document indicates that the contracting officer has determined that the anticipated cost to the government will be fair and reasonable. The contractor must be required to submit a proposal to be evaluated and negotiated by the Government. Prior to execution of the contractual instrument, a proposal analysis will be performed. The proposal analysis will ensure that the final agreed-to price for the contract action is fair and reasonable.";

/** Marker map for the 8(a) master. */
export function jofoc8aMarkers(ctx: JofocDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const estimated = jofoc8aEstimatedValue(ctx);
  const band = selectJofoc8aSigBand(estimated);

  const centerName = str(ctx.centerName);
  const centerCode = value("center_code");
  const centerAcronym =
    centerCode && !centerName.includes("(") ? `${centerName || centerCode} (${centerCode})` : centerName || centerCode;

  const contractor = value("contractor_name") || value("vendor_legal_name") || "________________";
  const contractNumber = value("contract_number");
  const description = value("description") || value("description_of_requirement") || value("requirement_description");
  const solicitation = value("solicitation_name") || contractNumber || ctx.acquisitionId;
  const program = value("program_name") || value("mission_supported") || "";
  const advocateCenter = value("advocate_center") || centerName || centerCode;

  const action = contractNumber
    ? `This justification provides the rationale for contracting by other than full and open competition to award a new work modification to contract ${contractNumber} with ${contractor}${description ? ` for ${description.replace(/[.!?]+$/, "")}` : ""}.`
    : `This justification provides the rationale for contracting by other than full and open competition to award a sole-source contract to ${contractor}${description ? ` for ${description.replace(/[.!?]+$/, "")}` : ""}.`;

  const rationale = value("authority_rationale");

  const map: MarkerMap = {
    "[[CENTER_NAME_ACRONYM]]": centerAcronym || KEEP,
    "[[FOR_SOLICITATION_CONTRACT]]": `For ${solicitation}`,
    "[[ACTION_NATURE_PROSE]]": action,
    "[[ESTIMATED_VALUE_PROSE]]": estimated ? `The estimated value is ${moneyProse(estimated)}.` : KEEP,
    "[[AUTHORITY_8A_LINE]]":
      "The statutory authority permitting other than full and open competition is 15 U.S.C. 637(a), as implemented by FAR 6.103-5(e), FAR 19.108-7, and FAR 19.208-2(a)(1).",
    "[[AUTHORITY_8A_RATIONALE]]": rationale
      ? `The rationale supporting the use of 15 U.S.C. 637(a) is ${rationale.replace(/^The rationale[^.]*is\s*/i, "")}`
      : KEEP,
    "[[AUTHORITY_8A_FACTS]]": value("authority_facts") || value("sole_source_facts") || KEEP,
    "[[PRICE_FAIR_REASONABLE]]": FAIR_AND_REASONABLE,
    "[[PRICE_ANALYSIS_PLAN]]": value("pricing") || value("price_analysis_plan") || KEEP,
    "[[BEST_INTEREST_PROSE]]": value("best_interest")
      ? `Use of a sole-source contract is in the best interest of the agency to ${value("best_interest").replace(/^Use of a sole-source contract[^.]*to\s*/i, "")}`
      : KEEP,
    "[[SIG_PROGRAM_ACQ_ID]]": [program, ctx.acquisitionId].filter(Boolean).join(" — ") || ctx.acquisitionId,
    "[[TECH_REP_NAME]]": str(ctx.technicalRepresentativeName) || KEEP,
    "[[CO_NAME]]": str(ctx.coName) || KEEP,
    "[[ADVOCATE_NAME]]": value("competition_advocate_name") || value("advocate_name") || KEEP,
    "[[ADVOCATE_CENTER]]": advocateCenter || KEEP,
    "[[PROCUREMENT_OFFICER_NAME]]": value("procurement_officer_name") || KEEP,
    "[[HQ_OGC_NAME]]": value("hq_ogc_name") || KEEP,
    "[[HCA_NAME]]": value("hca_name") || KEEP,
    "[[HCA_ACTIVITY]]": value("hca_activity") || centerName || KEEP,
    "[[AGENCY_CA_NAME]]": value("agency_ca_name") || value("agency_competition_advocate_name") || KEEP,
    "[[SPE_NAME]]": value("spe_name") || KEEP,
    "[[SIG_BAND_GT_30M_LE_150M]]": band === "GT_30M_LE_150M" ? KEEP : "",
    "[[SIG_BAND_GT_150M]]": band === "GT_150M" ? KEEP : "",
  };

  return map;
}

/** The filled 8(a) justification, as .docx bytes. */
export async function generateJofoc8aDocx(ctx: JofocDocxContext): Promise<Uint8Array> {
  const res = await fetch(JOFOC_8A_MASTER_URL);
  if (!res.ok) throw new Error("The 8(a) justification master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const map = jofoc8aMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the justification was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}
