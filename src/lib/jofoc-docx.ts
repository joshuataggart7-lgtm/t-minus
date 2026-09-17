/**
 * Soft Walk — JOFOC in Word, written into the NASA OP master at
 * /forms/JOFOC_MASTER.docx. Styles, theme, Rev footer and Prototype honesty
 * stay; only marker runs are filled from the record.
 *
 * Who signs is amount-driven (OP threshold ladder via the same JOFOC approval
 * tier names / fallbacks as jofocApprovalTier and the jofoc template
 * signature()). Exactly one SIG_BAND_* page prints; unused bands delete.
 * Soft Walk co_name fills [[CO_NAME]] on the active band only — it does not
 * collapse the ladder to one CO forever.
 */
import { type ExportContext } from "@/lib/template-engine";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";

export const JOFOC_MASTER_URL = "/forms/JOFOC_MASTER.docx";

/** Threshold names already used by jofocApprovalTier / template signature(). */
export const JOFOC_TIER_THRESHOLD_NAMES = {
  co: "JOFOC approval tier: contracting officer certification",
  ca: "JOFOC approval tier: competition advocate",
  hca: "JOFOC approval tier: head of contracting activity (NASA)",
} as const;

/** Fallbacks identical to jofocApprovalTier / jofoc.signature when the table row is missing. */
export const JOFOC_TIER_FALLBACKS = {
  co: 900_000,
  ca: 20_000_000,
  hca: 150_000_000,
} as const;

export type JofocSigBandId =
  | "LE_900K"
  | "GT_900K_LE_20M"
  | "GT_20M_LE_150M"
  | "GT_150M";

export type JofocThresholdRow = { name?: string | null; value?: number | null };

type JofocResearchLogLine = {
  source?: string | null;
  query?: string | null;
  result_count?: number | null;
  count?: number | null;
  outcome?: string | null;
  ran_at?: string | null;
  ranAt?: string | null;
};

const BAND_MARKERS: Record<JofocSigBandId, string> = {
  LE_900K: "[[SIG_BAND_LE_900K]]",
  GT_900K_LE_20M: "[[SIG_BAND_GT_900K_LE_20M]]",
  GT_20M_LE_150M: "[[SIG_BAND_GT_20M_LE_150M]]",
  GT_150M: "[[SIG_BAND_GT_150M]]",
};

const ALL_BANDS = Object.keys(BAND_MARKERS) as JofocSigBandId[];

/** Keep-token for active-band sentinel runs (empty would delete the paragraph). */
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

/** Strip API / engine jargon from market-research body (Soft Walk AC-SW-JOFOC-PROSE). */
export function humanizeMarketResearch(raw: string): string {
  const cleaned = cleanProse(raw);
  if (!cleaned) return "";
  const lines = cleaned
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/API\b|endpoint|JSON|engine tag|Entity Management API|Opportunities API|USAspending API/i.test(l));
  if (!lines.length) {
    // Fall back to a short human summary if every line was jargon-only.
    const hasSam = /SAM\.gov/i.test(cleaned);
    const hasNaics = /NAICS\s*\d+/i.test(cleaned);
    if (hasSam || hasNaics) {
      return "Market research was conducted from public sources, including SAM.gov registrant and opportunity checks under the applicable NAICS. Findings supporting the sole-source determination are recorded in item 5.";
    }
    return cleaned.replace(/\bAPI\b/gi, "records").replace(/\s{2,}/g, " ").trim();
  }
  return lines.join(" ");
}

const uniquePush = (items: string[], value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return;
  if (!items.some((item) => item.toLowerCase() === normalized.toLowerCase())) items.push(normalized);
};

function sourceName(raw: string): string {
  const text = raw.replace(/\s+(?:API|endpoint)$/i, "").trim();
  if (/sam\.gov|entity|opportunit|exclusion/i.test(text)) return "System for Award Management (SAM.gov)";
  if (/usa\s?spending/i.test(text)) return "USAspending";
  if (/sba|size standard/i.test(text)) return "SBA size standards";
  if (/t-minus|prior action|local/i.test(text)) return "prior T-Minus actions";
  return text;
}

function queryNaics(query: string): string {
  const param = (name: string) => {
    const m = new RegExp(`[?&]${name}=([^&\\s]+)`, "i").exec(query);
    return m ? decodeURIComponent(m[1] ?? "") : "";
  };
  return (
    param("naicsCode") ||
    param("ncode") ||
    /naics[_ ]?code\s*=\s*'?(\d{2,6})/i.exec(query)?.[1] ||
    /naics[= ](\d{2,6})/i.exec(query)?.[1] ||
    ""
  );
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Item 8 reads as named-source prose, while source detail stays in the research log. */
export function jofocMarketResearchProse(ctx: JofocDocxContext): string {
  const v = ctx.values ?? {};
  const researchLog = ((ctx.researchLog ?? []) as JofocResearchLogLine[]).filter(Boolean);
  const naics = cleanProse(str(v["naics_code"])) || researchLog.map((line) => queryNaics(str(line.query))).find(Boolean) || "";
  const sources: string[] = [];
  for (const line of researchLog) uniquePush(sources, sourceName(str(line.source)));
  if (ctx.sizeStandard) uniquePush(sources, "SBA size standards");
  if (ctx.priorTminusActionCount) uniquePush(sources, `prior T-Minus actions${naics ? ` under NAICS ${naics}` : ""}`);
  if (!sources.length) {
    const fallback = humanizeMarketResearch(cleanProse(str(v["market_research"])));
    if (fallback && !/\bAPI\b|endpoint|JSON|service error|not available|\d+\s+results?\b|\d{4}-\d{2}-\d{2}/i.test(fallback)) {
      return fallback;
    }
    uniquePush(sources, "System for Award Management (SAM.gov)");
    uniquePush(sources, "USAspending");
    uniquePush(sources, "SBA size standards");
    uniquePush(sources, `prior T-Minus actions${naics ? ` under NAICS ${naics}` : ""}`);
  }
  const scope = naics && !sources.some((source) => source.includes(`NAICS ${naics}`)) ? ` for NAICS ${naics}` : "";
  return `Market research was conducted using ${joinList(sources)}${scope}. Those sources were reviewed to identify capable sources, small business status, prior related awards, and whether another source could meet the mission need. The basis for the sole-source conclusion is recorded in item 5.`;
}

function thresholdValue(thresholds: JofocThresholdRow[] | undefined, name: string, fallback: number): number {
  const hit = thresholds?.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase());
  const v = hit?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * OP signature-page band from estimated value + class-justification flag.
 * Reuses the live JOFOC approval-tier threshold names (table when provided).
 */
export function selectJofocSigBand(
  estimatedValue: number,
  classJustification = false,
  thresholds?: JofocThresholdRow[],
): JofocSigBandId {
  const co = thresholdValue(thresholds, JOFOC_TIER_THRESHOLD_NAMES.co, JOFOC_TIER_FALLBACKS.co);
  const ca = thresholdValue(thresholds, JOFOC_TIER_THRESHOLD_NAMES.ca, JOFOC_TIER_FALLBACKS.ca);
  const hca = thresholdValue(thresholds, JOFOC_TIER_THRESHOLD_NAMES.hca, JOFOC_TIER_FALLBACKS.hca);
  if (classJustification || estimatedValue > hca) return "GT_150M";
  if (estimatedValue > ca) return "GT_20M_LE_150M";
  if (estimatedValue > co) return "GT_900K_LE_20M";
  return "LE_900K";
}

/** Blank typed-name keep: keeps the name line, never invents a person. */
const blankName = (v: string) => (v ? v : KEEP);

export type JofocDocxContext = ExportContext & {
  /** Live thresholds table rows when available (documents route). */
  thresholds?: JofocThresholdRow[];
  /** Public-source searches already recorded on this file. */
  researchLog?: JofocResearchLogLine[] | unknown[];
  /** SBA size-standard note or citation when loaded for the record. */
  sizeStandard?: string | null;
  /** Prior T-Minus actions surfaced as local comparables. */
  priorTminusActionCount?: number;
};

/** Marker map for Soft Walk JOFOC Word — OP master markers + one active SIG band. */
export function jofocMarkers(ctx: JofocDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const estimated = parseMoney(v["estimated_value"]);
  const classJustification = /^(1|true|yes|y)$/i.test(str(v["class_justification"]));
  const band = selectJofocSigBand(estimated, classJustification, ctx.thresholds);
  const authority = value("authority");
  const is41 = /41\s*U\.?\s*S\.?\s*C\.?\s*190[13]/i.test(authority) || /FAR\s*12\.102/i.test(authority);
  const is10 = /10\s*U\.?\s*S\.?\s*C\.?\s*3204/i.test(authority) || /FAR\s*6\.103/i.test(authority);
  const isUrgency = /6\.103-2/.test(authority);
  const isFollowOn = /6\.103-1/.test(authority);

  const centerCode = value("center_code") || str(ctx.centerName);
  const centerName = str(ctx.centerName) || centerCode;
  const centerAcronym =
    value("center_code").length <= 6 && value("center_code")
      ? centerName.includes("(")
        ? centerName
        : `${centerName} (${value("center_code")})`
      : centerName;

  const contractor = value("contractor_name") || "________________";
  const action = (value("action_type") || "sole-source contract").toLowerCase();
  const actionDescription = (value("action_description") || value("requirement_description") || "________________").replace(
    /[.!?]+$/,
    "",
  );
  const solicitation = value("solicitation_name") || ctx.acquisitionId;
  const program = value("program_name") || value("mission_supported") || "";
  const buying = value("buying_location") || centerCode || "________________";

  const popStart = humanDate(value("pop_start"));
  const popEnd = humanDate(value("pop_end"));
  const popRange = popStart || popEnd ? `${popStart || "____________"} to ${popEnd || "____________"}` : "";

  const noticeDate = value("notice_date");
  const noticeStatus = value("notice_status");
  const noticeProse = noticeDate
    ? `The notice of intent was posted on ${noticeDate}${value("interested_sources") ? `. ${value("interested_sources")}` : "."}`
    : /draft/i.test(noticeStatus)
      ? "The notice of intent has been prepared as a draft and has not yet been posted to the Government Point of Entry."
      : "The notice of intent has not yet been posted.";

  const market = jofocMarketResearchProse(ctx);
  const rationale = value("authority_rationale").replace(/\s*Basis of record:.*$/i, "").trim();

  // 10 USC stem paragraph is deletable via marker when the 41 U.S.C. path applies.
  const authority10Stem = is41 && !is10 ? "" : "The statutory authority permitting other than full and open competition is 10 U.S.C. 3204(a)";
  let authority10Line = "";
  let authority41Line = "";
  if (is41 && !is10) {
    authority41Line = authority || "41 U.S.C. 1901 or 1903 (FAR 12.102 procedures)";
  } else if (is10 || authority) {
    // Exception number + name after the 10 U.S.C. 3204(a) stem, or full cite if stem deleted.
    const m = authority.match(/3204\(a\)\s*(.*)$/i);
    authority10Line = m ? (m[1] ?? "").trim() || KEEP : authority || KEEP;
  } else {
    authority10Line = KEEP;
  }

  const techRep = blankName(str(ctx.technicalRepresentativeName));
  const coName = blankName(str(ctx.coName));
  const advocateName = blankName(value("competition_advocate_name") || value("advocate_name"));
  const advocateCenter = blankName(value("advocate_center") || centerName);
  const hcaName = blankName(value("hca_name"));
  const hcaActivity = blankName(value("hca_activity") || centerName);
  const hqOgcName = blankName(value("hq_ogc_name"));
  const agencyCaName = blankName(value("agency_ca_name") || value("agency_competition_advocate_name"));
  const speName = blankName(value("spe_name"));
  const programAcq = [program, ctx.acquisitionId].filter(Boolean).join(" — ") || ctx.acquisitionId;

  const map: MarkerMap = {
    "[[CENTER_NAME_ACRONYM]]": centerAcronym || KEEP,
    "[[FOR_SOLICITATION_CONTRACT]]": `For ${solicitation}`,
    "[[BUYING_LOCATION]]": buying,
    "[[ACTION_NATURE_PROSE]]": `This action is a ${action} to ${contractor} for ${actionDescription}.`,
    "[[ACTION_ALT_MOD]]": "",
    "[[ACTION_ALT_EXTENSION]]": "",
    "[[REQUIREMENT_DESCRIPTION]]": value("requirement_description") || actionDescription || KEEP,
    "[[MISSION_SUPPORTED]]": value("mission_supported") || program || KEEP,
    "[[POP_RANGE]]": popRange,
    "[[ESTIMATED_VALUE_PROSE]]": estimated ? `The estimated value is ${moneyProse(estimated)}.` : KEEP,
    "[[AUTHORITY_10USC_STEM]]": authority10Stem,
    "[[AUTHORITY_10USC_LINE]]": authority10Line,
    "[[AUTHORITY_OR_TOKEN]]": "",
    "[[AUTHORITY_41USC_LINE]]": authority41Line,
    "[[AUTHORITY_RATIONALE]]": rationale || KEEP,
    "[[URGENCY_HARM]]": isUrgency ? value("urgency_harm") || KEEP : "",
    "[[URGENCY_NOT_DELAY]]": isUrgency ? value("urgency_not_delay") || KEEP : "",
    "[[NOTICE_PUBLISHED_PROSE]]": isUrgency ? "" : noticeProse || KEEP,
    "[[NOTICE_URGENCY_EXEMPTION]]": isUrgency ? value("notice_exemption") || KEEP : "",
    "[[PRICE_ANALYSIS_PLAN]]": value("price_analysis_plan") || KEEP,
    "[[MARKET_RESEARCH_PROSE]]": market || KEEP,
    "[[OTHER_FACTS]]": value("other_facts") || "None",
    "[[FOLLOWON_DUPLICATED_COST]]": isFollowOn ? value("duplicated_cost") || KEEP : "",
    "[[NFS_CG_FOLLOWON_DUP_BLOCK]]": isFollowOn ? value("duplicated_cost") || KEEP : "",
    "[[URGENCY_INJURY_CHRONOLOGY]]": isUrgency ? value("injury_chronology") || KEEP : "",
    "[[NFS_CG_1806_12A_BLOCK]]": isUrgency ? value("urgency_harm") || KEEP : "",
    "[[NFS_CG_1806_12B_BLOCK]]": "",
    "[[URGENCY_EXTENSION_STATEMENTS]]": "",
    "[[INTERESTED_SOURCES_PROSE]]": value("interested_sources") || noticeProse || KEEP,
    "[[BARRIERS_ACTIONS]]":
      value("barriers") ||
      "The Agency will continue to examine the market in the future for alternative solutions or new sources before executing any subsequent acquisitions for the same requirements.",
    "[[SIG_PROGRAM_ACQ_ID]]": programAcq,
    "[[TECH_REP_NAME]]": techRep,
    "[[CO_NAME]]": coName,
    "[[ADVOCATE_NAME]]": advocateName,
    "[[ADVOCATE_CENTER]]": advocateCenter,
    "[[HQ_OGC_NAME]]": band === "GT_20M_LE_150M" || band === "GT_150M" ? hqOgcName : "",
    "[[HCA_NAME]]": hcaName,
    "[[HCA_ACTIVITY]]": hcaActivity,
    "[[AGENCY_CA_NAME]]": agencyCaName,
    "[[SPE_NAME]]": speName,
  };

  for (const b of ALL_BANDS) {
    map[BAND_MARKERS[b]] = b === band ? KEEP : "";
  }

  return map;
}

/** The filled JOFOC, as .docx bytes. */
export async function generateJofocDocx(ctx: JofocDocxContext): Promise<Uint8Array> {
  const res = await fetch(JOFOC_MASTER_URL);
  if (!res.ok) throw new Error("The JOFOC master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const map = jofocMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the justification was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}
