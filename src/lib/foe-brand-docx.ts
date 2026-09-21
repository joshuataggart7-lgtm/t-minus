/**
 * Soft Walk — Fair Opportunity Exception, Brand Name Justification, written
 * into the NASA OP master at /forms/FOE_BRAND_MASTER.docx. The master keeps
 * the HQ letterhead, styles, footer version identifier and the signature
 * underscores. Its instruction pages and Document History Log are removed.
 *
 * The justification is written on a FAR Part 16 multiple-award ordering path,
 * so commercial and simplified sample files are refused rather than dressed in
 * this face. Empty fields never print a stand-in; signature ink stays blank.
 *
 * Every citation on the face comes from the HQ source: FAR 16.507-6(d)(2)(ii)
 * through (vi), FAR 16.507-7(a) for the brand-name authority, and the HQ
 * signature ladder text. The generic FAR 16.507-6(b)(1) through (6) exception
 * block is removed on the brand-name path, as the HQ face directs.
 *
 * Exactly one signature-authority band prints. The bands are the HQ ladder:
 * up to $900K, above $900K to $20M, above $20M to under $150M, and $150M and
 * above. The unused bands are sliced out of the document before the markers
 * are applied, so no empty ladder page ships.
 */
import JSZip from "jszip";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { isSoftWalkCommercialSample, resolveOfficerName } from "@/lib/softwalk-samples";
import type { ExportContext } from "@/lib/template-engine";

export const FOE_BRAND_MASTER_URL = "/forms/FOE_BRAND_MASTER.docx";

export type FoeBrandContext = ExportContext & {
  acq?: Record<string, unknown> | undefined;
};

const KEEP = " ";

/** The HQ signature ladder, in order, with the ceiling each band covers. */
export const FOE_SIG_BANDS = [
  { marker: "[[SIG_BAND_LE_900K]]", ceiling: 900_000 },
  { marker: "[[SIG_BAND_GT_900K_LE_20M]]", ceiling: 20_000_000 },
  { marker: "[[SIG_BAND_GT_20M_LE_150M]]", ceiling: 150_000_000 },
  { marker: "[[SIG_BAND_GT_150M]]", ceiling: Number.POSITIVE_INFINITY },
] as const;

const str = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

function clean(value: unknown): string {
  return str(value)
    .replace(/\s*\[(?:Insert|insert|Describe|Check|Provide|List|NOTE|Note|Use|OR|Select|Selet|Consider)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert|Identify|Describe|Select|Selet)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function amountOf(value: unknown): number {
  const digits = str(value).replace(/[^0-9.]/g, "");
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? n : 0;
}

function methodText(ctx: FoeBrandContext): string {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  return [
    values["__method"],
    values["acquisition_method"],
    values["vehicle"],
    acq["acquisition_method"],
    acq["contract_format"],
    acq["vehicle"],
    acq["competition"],
  ]
    .map(str)
    .join(" ");
}

/**
 * True where a fair opportunity brand-name justification belongs: a FAR Part
 * 16 multiple-award ordering path with a brand-name or items-peculiar basis.
 * Protected commercial samples and Part 12 or 13 files refuse.
 */
export function isFoeBrandPath(ctx: FoeBrandContext): boolean {
  if (
    isSoftWalkCommercialSample({
      ...(ctx.acq ?? {}),
      acquisition_id: ctx.acquisitionId,
    })
  )
    return false;
  const method = methodText(ctx);
  if (/commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*1[23]\b/i.test(method)) return false;
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const brand = [
    method,
    values["brand_item"],
    values["brand_name_item"],
    values["brand_name_required"],
    values["exception"],
    acq["brand_name_item"],
  ]
    .map(str)
    .join(" ");
  const ordering =
    /\b16\.5|\bFAR\s*16\b|\bpart\s*16\b|idiq|multiple[- ]award|fair opportunity|task order|delivery order/i.test(
      `${method} ${str(values["vehicle"])}`,
    );
  const brandBasis = /brand[- ]name|brand name|peculiar to one manufacturer|16\.507-7|\bYes\b/i.test(brand);
  return ordering && brandBasis;
}

/** The single signature band that prints, chosen by the estimated value. */
export function selectFoeSigBand(amount: number): string {
  for (const band of FOE_SIG_BANDS) {
    if (amount <= band.ceiling) return band.marker;
  }
  return FOE_SIG_BANDS[FOE_SIG_BANDS.length - 1]!.marker;
}

/** Marker values for the active brand-name justification. */
export function foeBrandMarkers(ctx: FoeBrandContext): MarkerMap {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => clean(values[key]);

  const officer = value("co_name") || resolveOfficerName(acq, ctx.coName);
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const program = [title, ctx.acquisitionId].filter(Boolean).join(" · ");
  const contract = value("vehicle") || value("contract_number") || str(acq["contract_number"]);
  const center =
    value("center_name") || value("center") || str(acq["center_name"]) || str(acq["center"]);
  const techRep = value("technical_representative") || value("cor_name") || str(acq["cor_name"]);
  const item = value("brand_item") || value("brand_name_item") || str(acq["brand_name_item"]);
  const supplies = value("supplies_services") || value("requirement") || title;
  const contractType = value("contract_type") || str(acq["contract_type"]);
  const estimate = value("order_value") || value("estimated_value") || str(acq["estimated_value"]);
  const popStart = value("pop_start");
  const popEnd = value("pop_end");
  const pop =
    value("period_of_performance") ||
    ([popStart, popEnd].filter(Boolean).join(" through ") || str(acq["pop"]));
  const rationale =
    value("salient_characteristics") || value("exception_rationale") || value("supporting_rationale");
  const price = value("price_fair") || value("price_reasonable");
  const facts = value("other_facts") || value("market_research");
  const barriers = value("barriers");

  const nature = [
    "This justification documents the basis for issuing an order",
    contract ? `under ${contract}` : "",
    "without providing fair opportunity to all awardees.",
  ]
    .filter(Boolean)
    .join(" ");

  const suppliesText = [
    contractType ? `This action is a ${contractType} order for` : "This action is an order for",
    supplies + ".",
  ].join(" ");

  const money = /^[0-9.]+$/.test(estimate)
    ? `$${Number.parseFloat(estimate).toLocaleString("en-US")}`
    : estimate;
  const estValue = money ? `The total estimated value of the proposed order is ${money}.` : "";
  const popText = pop ? `The estimated period of performance is ${pop}.` : "";

  const brandAuthority = [
    "This is a brand-name justification under the authority of FAR 16.507-7(a).",
    item ? `The brand-name requirement applies to ${item}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const coCert = [
    "I hereby certify that this justification is accurate and complete to the best of my knowledge and belief.",
    "Based on the information in this justification, I have determined that the brand-name exception at FAR 16.507-7(a) applies to this order.",
  ].join(" ");

  const techCert =
    "I hereby certify that the supporting data in this justification is accurate and complete to the best of my knowledge and belief.";

  const approval =
    "Based on the information provided in this justification, and as the approving official, I have determined that FAR 16.507-7(a) applies to the order.";

  const amount = amountOf(estimate || values["estimated_value"] || acq["estimated_value"]);
  const activeBand = selectFoeSigBand(amount);

  const map: MarkerMap = {
    "[[DOC_TITLE]]": "Brand Name Justification",
    "[[PROGRAM_ACQ_ID]]": program || ctx.acquisitionId,
    "[[NATURE]]": nature,
    "[[SUPPLIES_SERVICES]]": suppliesText,
    // Empty values drop their paragraph rather than printing a stand-in.
    "[[EST_VALUE]]": estValue,
    "[[POP]]": popText,
    "[[BRAND_AUTHORITY]]": brandAuthority,
    "[[SUPPORTING_RATIONALE]]": rationale,
    "[[PRICE_FAIR]]": price,
    "[[OTHER_FACTS]]": facts,
    "[[BARRIERS]]": barriers,
    "[[TECH_CERT]]": techCert,
    "[[CO_CERT]]": coCert,
    "[[APPROVAL_STATEMENT]]": approval,
    "[[TECH_REP_NAME]]": techRep || KEEP,
    "[[CO_NAME]]": officer || KEEP,
    "[[CENTER_NAME]]": center || KEEP,
    "[[APPROVER_NAME]]": KEEP,
    "[[ADVOCATE_NAME]]": KEEP,
    "[[AGENCY_ADVOCATE_NAME]]": KEEP,
    "[[HCA_NAME]]": KEEP,
    "[[GC_NAME]]": KEEP,
    "[[SPE_NAME]]": KEEP,
  };
  // The band sentinel carries the page header on the one band that prints.
  for (const band of FOE_SIG_BANDS) {
    map[band.marker] = band.marker === activeBand ? program || ctx.acquisitionId : "";
  }
  return map;
}

const P_RE = /<w:p\b(?![a-zA-Z])[\s\S]*?<\/w:p>/g;

/**
 * Remove every signature band except the active one. A band runs from its
 * sentinel paragraph to the paragraph before the next sentinel, or to the end
 * of the body for the last band.
 */
export function sliceInactiveBands(xml: string, activeBand: string): string {
  const paragraphs = [...xml.matchAll(P_RE)];
  const sentinels = FOE_SIG_BANDS.map((band) => ({
    marker: band.marker,
    index: paragraphs.findIndex((p) => p[0].includes(band.marker)),
  })).filter((s) => s.index >= 0);
  if (!sentinels.length) return xml;
  const cuts: Array<[number, number]> = [];
  sentinels.forEach((sentinel, i) => {
    if (sentinel.marker === activeBand) return;
    const next = sentinels[i + 1];
    const last = paragraphs[paragraphs.length - 1]!;
    const start = paragraphs[sentinel.index]!.index ?? 0;
    const end =
      next && next.index >= 0
        ? (paragraphs[next.index]!.index ?? 0)
        : (last.index ?? 0) + last[0].length;
    cuts.push([start, end]);
  });
  cuts.sort((a, b) => b[0] - a[0]);
  let out = xml;
  for (const [start, end] of cuts) out = out.slice(0, start) + out.slice(end);
  return out;
}

async function withSlicedBands(bytes: ArrayBuffer, activeBand: string): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("The master is missing word/document.xml.");
  const xml = await entry.async("string");
  zip.file("word/document.xml", sliceInactiveBands(xml, activeBand));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Fill the genuine HQ brand-name justification master and return the bytes. */
export async function generateFoeBrandDocx(ctx: FoeBrandContext): Promise<Uint8Array> {
  if (!isFoeBrandPath(ctx)) {
    throw new Error("This record is not on a fair opportunity brand-name path.");
  }
  const response = await fetch(FOE_BRAND_MASTER_URL);
  if (!response.ok) throw new Error("The brand-name justification master could not be read from this app.");
  const bytes = await response.arrayBuffer();
  const map = foeBrandMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the justification was not written: ${split.join(", ")}.`,
    );
  }
  const active =
    FOE_SIG_BANDS.find((band) => map[band.marker])?.marker ?? FOE_SIG_BANDS[0].marker;
  const trimmed = await withSlicedBands(bytes, active);
  return applyMarkers(trimmed, map);
}
