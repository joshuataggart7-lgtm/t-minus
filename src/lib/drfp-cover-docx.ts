/**
 * Soft Walk — Draft Request For Proposal cover letter, written into the NASA
 * OP master at /forms/DRFP_COVER_MASTER.docx. The master keeps the HQ
 * letterhead, styles, footer version identifier, and signature line. Its
 * instruction pages and Document History Log are removed before shipping.
 *
 * The DRFP is a competed negotiated-acquisition document. Commercial,
 * simplified, and sole-source files are refused rather than dressed in Part 15
 * prose. Optional passages print only when the record or saved document carries
 * them; signature ink always remains blank.
 */
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { resolveOfficerName } from "@/lib/softwalk-samples";
import type { ExportContext } from "@/lib/template-engine";

export const DRFP_COVER_MASTER_URL = "/forms/DRFP_COVER_MASTER.docx";

export type DrfpCoverContext = ExportContext & {
  acq?: Record<string, unknown> | undefined;
};

const KEEP = " ";
const str = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

function clean(value: unknown): string {
  return str(value)
    .replace(/\s*\[(?:Insert|insert|Describe|Check|Provide|List|NOTE)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function humanDate(value: unknown): string {
  const text = str(value);
  if (!text) return "";
  const date = new Date(`${text.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function methodText(ctx: DrfpCoverContext): string {
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

/** True only for a competed FAR Part 15 negotiated acquisition. */
export function isDrfpCoverPath(ctx: DrfpCoverContext): boolean {
  const method = methodText(ctx);
  if (/commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*12\b/i.test(method)) return false;
  if (/sole[- ]?source|non-?competitive|8\(a\) direct/i.test(method)) return false;
  return /\b15\b|15\.\d|negotiat/i.test(method) && /compet|full and open|negotiat/i.test(method);
}

function sizeStandard(ctx: DrfpCoverContext): string {
  const saved = clean(ctx.values?.["size_standard"]);
  if (saved) return saved;
  return str(ctx.sizeStandard);
}

/** Marker values for the active DRFP letter. */
export function drfpCoverMarkers(ctx: DrfpCoverContext): MarkerMap {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => clean(values[key]);
  const center = value("center_name") || str(ctx.centerName) || str(acq["center_code"]) || "NASA";
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const scope = value("scope") || clean(acq["description_of_requirement"]);
  const competition = value("competition_type") || clean(acq["competition"]);
  const contractType = value("contract_type") || clean(acq["contract_type"]);
  const pop = [value("pop_form"), value("pop_detail")].filter(Boolean).join(" ");
  const naics = value("naics_code") || clean(acq["naics_code"]);
  const standard = sizeStandard(ctx);
  const officer = value("co_name") || resolveOfficerName(acq, ctx.coName);
  const commentFocus = value("comment_focus");
  const finalDate = humanDate(value("final_rfp_date"));
  const proposalDays = value("proposal_days");
  const awardDate = humanDate(value("award_date") || acq["target_award_date"]);
  const effectiveDate = humanDate(value("effective_date") || acq["period_of_performance_start"]);
  const place = value("place_of_performance") || clean(acq["place_of_performance_standardized"]) || clean(acq["place_of_performance"]);
  const event = value("industry_event");
  const eventDate = humanDate(value("industry_event_date"));
  const ai = value("ai_transparency");
  const aiLocation = value("ai_documentation_location");
  const security = value("security_level");
  const securityTiming = value("security_timing");
  const commentDays = value("comment_days");
  const email = value("co_email");

  const competitionParts = [
    competition ? `NASA will conduct this acquisition as a ${competition}.` : "",
    contractType ? `This competitive acquisition will result in a ${contractType}.` : "",
    pop ? `The contract will have ${pop}` : "",
    naics ? `The North American Industry Classification System (NAICS) code for this acquisition is ${naics}${standard ? ` and the small business size standard is ${standard}` : ""}.` : "",
  ].filter(Boolean);

  const scheduleParts = [
    finalDate ? `The current planned release date for the Final Request for Proposal (RFP) is on or about ${finalDate}` : "",
    proposalDays ? `with proposals being due approximately ${proposalDays} calendar days later` : "",
  ].filter(Boolean);

  const performanceParts = [
    awardDate ? `The anticipated contract award date is ${awardDate}.` : "",
    effectiveDate ? `The contract effective date is ${effectiveDate}.` : "",
    place ? `The contract will be performed at ${place}.` : "",
  ].filter(Boolean);

  return {
    "[[CENTER_NAME]]": center,
    "[[CENTER_ADDRESS]]": str(ctx.centerAddress) || KEEP,
    "[[ORG_CODE]]": value("org_code") || str(ctx.organizationCode) || KEEP,
    "[[SOLICITATION_NUMBER]]": value("solicitation_number") || KEEP,
    "[[ACQ_TITLE]]": title,
    "[[INTRO]]": `You are invited to review and comment on the National Aeronautics and Space Administration (NASA) ${center} ${title} draft solicitation.${scope ? ` The principal purpose of this requirement is to provide ${scope}.` : ""}`,
    "[[COMMENTS_REQUEST]]": `Potential offerors are encouraged to comment on all aspects of the draft solicitation, including the requirements, schedules, proposal instructions, evaluation approaches, and perceived safety, occupational health, security including information technology security, environmental, export control, or other programmatic risk issues associated with performance of the work. Potential offerors should identify any unnecessary or inefficient requirements.${commentFocus ? ` The Government also requests comment on ${commentFocus}.` : ""}`,
    "[[COMPETITION_CONTRACT_POP]]": competitionParts.join(" ") || KEEP,
    "[[FINAL_RFP_SCHEDULE]]": scheduleParts.length ? `${scheduleParts.join(" ")}.` : "",
    "[[AWARD_PERFORMANCE]]": performanceParts.join(" "),
    "[[ADDITIONAL_INTRO]]": "",
    "[[PHASE_IN]]": value("phase_in") ? `1. ${value("phase_in")}` : "",
    "[[PROPERTY]]": /^yes$/i.test(value("gfp_offsite")) ? "2. Government Furnished Property for offsite use at the Contractor’s facility is described in the DRFP." : "",
    "[[INDUSTRY_EVENT]]": event ? `3. After release of the final RFP, a ${event}${eventDate ? ` is anticipated on ${eventDate}` : ""}.` : "",
    "[[SITE_VISITS]]": value("site_visits") ? `4. ${value("site_visits")}` : "",
    "[[OCI]]": value("oci") ? `5. ${value("oci")}` : "",
    "[[AI_INSTRUCTION]]": "",
    "[[AI_TRANSPARENCY]]": ai ? `6. AI Use Transparency Disclosure: ${ai}${aiLocation ? ` The required AI Impact Assessment documentation is included in ${aiLocation}.` : ""}` : "",
    "[[SECURITY]]": security ? `7. A ${security} facilities clearance is required for this acquisition in accordance with the DD Form 254, Contract Security Classification Specification.${securityTiming ? ` ${securityTiming}` : ""}` : "",
    "[[EFSS]]": "",
    "[[OTHER_EMPHASIS]]": value("other_emphasis"),
    // An empty marker removes the whole Ombudsman paragraph. Never print an
    // empty name or a generic stand-in on a formal cover letter.
    "[[OMBUDSMAN]]": value("ombudsman"),
    "[[OMBUDSMAN_LINK]]": "",
    "[[DISCLAIMER]]": `This DRFP is not a solicitation, and NASA is not requesting proposals. This DRFP does not commit NASA ${center} to pay any proposal preparation costs, nor does it obligate NASA ${center} to procure or contract for this requirement. This request is not an authorization to proceed and does not authorize payment for any charges incurred by the offeror for performing any of the work called for in this solicitation.`,
    "[[COMMENT_INSTRUCTIONS]]": `Any comments regarding the DRFP should be submitted electronically in writing to ${officer || "the Contracting Officer"}${email ? ` at ${email}` : ""}${commentDays ? ` within ${commentDays} calendar days after release of this DRFP` : ""}. If a respondent believes comments contain confidential, proprietary, competition-sensitive, or business information, they must be marked appropriately. The Government will consider all comments received in preparation for the Final RFP. This draft does not request proposals.`,
    "[[CO_NAME]]": officer || KEEP,
    "[[DRFP_NUMBER]]": value("drfp_number") || KEEP,
  };
}

/** Fill the genuine HQ DRFP master and return named-download-ready bytes. */
export async function generateDrfpCoverDocx(ctx: DrfpCoverContext): Promise<Uint8Array> {
  if (!isDrfpCoverPath(ctx)) {
    throw new Error("This record is not on a competed FAR Part 15 negotiated path.");
  }
  const response = await fetch(DRFP_COVER_MASTER_URL);
  if (!response.ok) throw new Error("The DRFP cover master could not be read from this app.");
  const bytes = await response.arrayBuffer();
  const map = drfpCoverMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(`The master splits these markers across runs, so the letter was not written: ${split.join(", ")}.`);
  }
  return applyMarkers(bytes, map);
}