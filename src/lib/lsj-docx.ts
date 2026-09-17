/**
 * Soft Walk — LSJ in Word, written into the NASA OP master at
 * /forms/LSJ_MASTER.docx. Styles, theme, Rev footer and Prototype honesty
 * stay; only marker runs are filled from the record.
 *
 * Who signs is amount-driven (OP threshold ladder on the LSJ master bands).
 * Exactly one SIG_BAND_* page prints; unused bands delete. Soft Walk co_name
 * fills [[CO_NAME]] on the active band only — it does not collapse the ladder
 * to one CO forever. Signature underscore lines stay blank (never auto-ink).
 *
 * Authority exception lines are the exact FAR 8.401(b)/GSAM face text from the
 * Soft Walk Batch2 cite-fixed master Soft Walk — not invented cites Soft Walk.
 */
import { type ExportContext } from "@/lib/template-engine";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";

export const LSJ_MASTER_URL = "/forms/LSJ_MASTER.docx";

/** Prefer live JOFOC-named rows when present Soft Walk; LSJ face uses the same dollars Soft Walk. */
export const LSJ_TIER_THRESHOLD_NAMES = {
  co: "JOFOC approval tier: contracting officer certification",
  ca: "JOFOC approval tier: competition advocate",
  hca: "JOFOC approval tier: head of contracting activity (NASA)",
} as const;

/** Fallbacks identical to the OP LSJ signature-page labels Soft Walk. */
export const LSJ_TIER_FALLBACKS = {
  co: 900_000,
  ca: 20_000_000,
  hca: 150_000_000,
} as const;

export type LsjSigBandId =
  | "LE_900K"
  | "GT_900K_LE_20M"
  | "GE_20M_LT_150M"
  | "GE_150M";

export type LsjThresholdRow = { name?: string | null; value?: number | null };

export type LsjAuthorityKey =
  | "AUTH_URGENCY"
  | "AUTH_ONE_SOURCE"
  | "AUTH_FOLLOW_ON"
  | "AUTH_MIN_GUARANTEE"
  | "AUTH_BY_LAW"
  | "AUTH_BRAND_NAME";

/**
 * Exact Soft Walk Batch2 cite-fixed face lines (FAR 8.401(b)/GSAM Soft Walk — not 8.104(b)).
 * Copied verbatim from the NASA OP cite-fixed master Soft Walk.
 */
export const LSJ_AUTH_CITATIONS: Record<LsjAuthorityKey, string> = {
  AUTH_URGENCY:
    "FAR 8.401(b)/GSAM 538.7104-3(b)(i). The need is of such unusual urgency that following normal procedures would result in unacceptable delays in fulfilling the need.",
  AUTH_ONE_SOURCE:
    "FAR 8.401(b)/GSAM 538-7104-3(b)(ii). Only one source is capable of providing the products, services, or solution required at the level of quality required because the products, services, or solutions are unique or highly specialized.",
  AUTH_FOLLOW_ON:
    "FAR 8.401(b)/GSAM 538.7104-3(b)(iii). The order should be issued on a sole source basis in the interest of economy and efficiency because it is a logical follow-on to an FSS order already issued on a competitive basis.",
  AUTH_MIN_GUARANTEE:
    "FAR 8.401(b)/GSAM 538.7104-3(b)(iv). It is necessary to place the order with a particular FSS contractor to satisfy a minimum guarantee established in the FSS BPA.",
  AUTH_BY_LAW:
    "FAR 8.401(b)/GSAM 538.7104-3(b)(v). A law expressly authorizes or requires that the purchase be made from a specified source. Identified law is:____________________________",
  AUTH_BRAND_NAME:
    "FAR 8.401(b)/GSAM 538.7104-4(b)(1), Items peculiar to one manufacturer. The particular brand name, product, or feature is essential to the NASA\u2019s requirements, and market research indicates other companies\u2019 similar products, or products lacking the particular feature, do not meet, or cannot be modified to meet, the need.",
};

const BAND_MARKERS: Record<LsjSigBandId, string> = {
  LE_900K: "[[SIG_BAND_LE_900K]]",
  GT_900K_LE_20M: "[[SIG_BAND_GT_900K_LE_20M]]",
  GE_20M_LT_150M: "[[SIG_BAND_GE_20M_LT_150M]]",
  GE_150M: "[[SIG_BAND_GE_150M]]",
};

const ALL_BANDS = Object.keys(BAND_MARKERS) as LsjSigBandId[];
const ALL_AUTH = Object.keys(LSJ_AUTH_CITATIONS) as LsjAuthorityKey[];

/** Keep-token for active-band sentinel runs Soft Walk (empty would delete the paragraph Soft Walk). */
const KEEP = " ";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

function parseMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number(String(raw ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function moneyProse(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

function humanDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function cleanProse(text: string): string {
  return text
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s*(?:Drafted from the record, confirm\.?|Draft, confirm\.?)/gi, "")
    .replace(/\s*Source:.*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function thresholdValue(thresholds: LsjThresholdRow[] | undefined, name: string, fallback: number): number {
  const hit = thresholds?.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase());
  const v = hit?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * OP LSJ signature-page band from estimated value Soft Walk.
 * Face labels Soft Walk: ≤$900K; >$900K ≤$20M; ≥$20M <$150M; ≥$150M Soft Walk.
 */
export function selectLsjSigBand(
  estimatedValue: number,
  thresholds?: LsjThresholdRow[],
): LsjSigBandId {
  const co = thresholdValue(thresholds, LSJ_TIER_THRESHOLD_NAMES.co, LSJ_TIER_FALLBACKS.co);
  const ca = thresholdValue(thresholds, LSJ_TIER_THRESHOLD_NAMES.ca, LSJ_TIER_FALLBACKS.ca);
  const hca = thresholdValue(thresholds, LSJ_TIER_THRESHOLD_NAMES.hca, LSJ_TIER_FALLBACKS.hca);
  if (estimatedValue >= hca) return "GE_150M";
  if (estimatedValue >= ca) return "GE_20M_LT_150M";
  if (estimatedValue > co) return "GT_900K_LE_20M";
  return "LE_900K";
}

/** Pick one Soft Walk Batch2 authority key Soft Walk — never invent Soft Walk. */
export function selectLsjAuthority(raw: string): LsjAuthorityKey {
  const a = raw.trim();
  if (!a) return "AUTH_ONE_SOURCE";
  const key = a.replace(/^\[\[|\]\]$/g, "");
  if ((ALL_AUTH as string[]).includes(key)) return key as LsjAuthorityKey;
  if (/538\.7104-3\(b\)\(i\)|\(b\)\(i\)|unusual urgency/i.test(a) && !/follow-on|peculiar|guarantee|expressly|only one source/i.test(a))
    return "AUTH_URGENCY";
  if (/538-7104-3\(b\)\(ii\)|538\.7104-3\(b\)\(ii\)|only one source|unique or highly specialized/i.test(a))
    return "AUTH_ONE_SOURCE";
  if (/538\.7104-3\(b\)\(iii\)|follow-on|logical follow/i.test(a)) return "AUTH_FOLLOW_ON";
  if (/538\.7104-3\(b\)\(iv\)|minimum guarantee/i.test(a)) return "AUTH_MIN_GUARANTEE";
  if (/538\.7104-3\(b\)\(v\)|expressly authorizes|required by law/i.test(a)) return "AUTH_BY_LAW";
  if (/538\.7104-4|peculiar to one manufacturer|brand name/i.test(a)) return "AUTH_BRAND_NAME";
  return "AUTH_ONE_SOURCE";
}

const blankName = (v: string) => (v ? v : KEEP);

export type LsjDocxContext = ExportContext & {
  /** Live thresholds table rows when available Soft Walk (documents route Soft Walk). */
  thresholds?: LsjThresholdRow[];
};

/** Marker map for Soft Walk LSJ Word Soft Walk — OP master markers + one active SIG band Soft Walk. */
export function lsjMarkers(ctx: LsjDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const estimated = parseMoney(v["estimated_value"] || v["estimated_price"]);
  const band = selectLsjSigBand(estimated, ctx.thresholds);
  const authKey = selectLsjAuthority(value("authority") || value("lsj_authority") || value("authority_citation"));

  const centerCode = value("center_code") || str(ctx.centerName);
  const centerName = str(ctx.centerName) || centerCode;
  const centerAcronym =
    value("center_code").length <= 6 && value("center_code")
      ? centerName.includes("(")
        ? centerName
        : `${centerName} (${value("center_code")})`
      : centerName || KEEP;

  const solicitation = value("solicitation_name") || ctx.acquisitionId || KEEP;
  const buying = value("buying_location") || centerCode || "________________";
  const contractor = value("contractor_name") || value("contractors") || "________________";
  const action = (value("action_type") || "new order").toLowerCase();
  const actionDescription = (
    value("action_description") ||
    value("requirement_description") ||
    "________________"
  ).replace(/[.!?]+$/, "");
  const contractType = value("contract_type") || "firm-fixed price";
  const fssDetails = value("fss_details");
  const fss = value("fss_number") || (fssDetails ? "" : "________________");
  const fssTitle = value("fss_title") || "";
  const sin = value("sin") || "";
  const sinTitle = value("sin_title") || "";
  const program = value("program_name") || value("mission_supported") || "";

  const popStart = humanDate(value("pop_start"));
  const popEnd = humanDate(value("pop_end"));
  const periodFree = value("period");
  const popRange =
    popStart || popEnd
      ? `${popStart || "____________"} to ${popEnd || "____________"}`
      : periodFree || "________________";

  const rationale = value("authority_rationale") || value("lsj_rationale") || value("rationale") || KEEP;

  const techRep = blankName(str(ctx.technicalRepresentativeName));
  const coName = blankName(str(ctx.coName));
  const advocateName = blankName(value("competition_advocate_name") || value("advocate_name"));
  const advocateCenter = blankName(value("advocate_center") || centerName);
  const poName = blankName(value("procurement_officer_name") || value("po_name"));
  const hcaName = blankName(value("hca_name"));
  const hcaActivity = blankName(value("hca_activity") || centerName);
  const hqOgcName = blankName(value("hq_ogc_name") || "Office of the General Counsel at Headquarters");
  const agencyCaName = blankName(value("agency_ca_name") || value("agency_competition_advocate_name"));
  const speName = blankName(value("spe_name"));
  const programAcq = [program, ctx.acquisitionId].filter(Boolean).join(" — ") || ctx.acquisitionId || KEEP;

  const fssBits = fssDetails || [fss, fssTitle, sin && `SIN ${sin}`, sinTitle].filter(Boolean).join(", ");

  const map: MarkerMap = {
    "[[CENTER_NAME_ACRONYM]]": centerAcronym,
    "[[FOR_SOLICITATION_CONTRACT]]": `For ${solicitation}`,
    "[[BUYING_LOCATION_PROSE]]": `This is a Limited-Sources Justification (LSJ) prepared by the National Aeronautics and Space Administration (NASA) ${buying}.`,
    "[[ACTION_MAS_PROSE]]": `This acquisition will be conducted under the Multiple Awards Schedule (MAS) Program (Title 41 U.S.C. 152(3)). This action is a ${action} (${contractType}) for ${actionDescription}.`,
    "[[CONTRACTOR_FSS_PROSE]]": `It is anticipated that award(s) will be made to ${contractor} under General Services Administration (GSA) Federal Supply Schedule (FSS) ${fssBits || "________________"}.`,
    "[[VALUE_POP_PROSE]]": estimated
      ? `The total estimated price or ceiling amount of the proposed order or BPA is ${moneyProse(estimated)} and the estimated period of performance or lead-time for delivery is ${popRange}.`
      : `The total estimated price or ceiling amount of the proposed order or BPA is $________________ and the estimated period of performance or lead-time for delivery is ${popRange}.`,
    "[[AUTHORITY_RATIONALE]]": rationale,
    "[[SIG_PROGRAM_ACQ_ID]]": programAcq,
    "[[TECH_REP_NAME]]": techRep,
    "[[CO_NAME]]": coName,
    "[[ADVOCATE_NAME]]": advocateName,
    "[[ADVOCATE_CENTER]]": advocateCenter,
    "[[PO_NAME]]": poName,
    "[[HCA_NAME]]": hcaName,
    "[[HCA_ACTIVITY]]": hcaActivity,
    "[[HQ_OGC_NAME]]": band === "GE_150M" ? hqOgcName : "",
    "[[AGENCY_CA_NAME]]": band === "GE_150M" ? agencyCaName : "",
    "[[SPE_NAME]]": band === "GE_150M" ? speName : "",
  };

  for (const key of ALL_AUTH) {
    map[`[[${key}]]`] = key === authKey ? LSJ_AUTH_CITATIONS[key] : "";
  }
  for (const b of ALL_BANDS) {
    map[BAND_MARKERS[b]] = b === band ? KEEP : "";
  }

  return map;
}

/** The filled LSJ Soft Walk, as .docx bytes Soft Walk. */
export async function generateLsjDocx(ctx: LsjDocxContext): Promise<Uint8Array> {
  const res = await fetch(LSJ_MASTER_URL);
  if (!res.ok) throw new Error("The LSJ master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const map = lsjMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the justification was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}
