/**
 * Soft Walk — Blackout Notice written into the genuine HQ Word master.
 * The local advisory helper in blackout-notice.ts is separate and does not
 * supply citations or issuance state to this formal Word face.
 */
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { isSoftWalkCommercialSample, resolveOfficerName } from "@/lib/softwalk-samples";
import type { ExportContext } from "@/lib/template-engine";

export const BLACKOUT_MASTER_URL = "/forms/BLACKOUT_MASTER.docx";

/** The one visible refusal sentence, shown on the page and on an export attempt. */
export const BLACKOUT_UNAVAILABLE =
  "Blackout Notice unavailable: this record is not on the applicable competed Part 15 final-solicitation release / blackout path.";

export type BlackoutContext = ExportContext & {
  acq?: Record<string, unknown> | undefined;
};

const KEEP = " ";
const str = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

function clean(value: unknown): string {
  return str(value)
    .replace(/\s*\[(?:Insert|insert|Describe|Enter|Select|Use|NOTE|Note)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert|Enter|Select)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function methodText(ctx: BlackoutContext): string {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  return [
    values["__method"], values["solicitation_kind"], values["acquisition_method"],
    acq["acquisition_method"], acq["contract_format"], acq["competition"],
    acq["current_phase"], acq["description_of_requirement"],
  ].map(str).join(" ");
}

/** True only for a competed Part 15 final-RFP or solicitation blackout path. */
export function isBlackoutPath(ctx: BlackoutContext): boolean {
  if (isSoftWalkCommercialSample({ ...(ctx.acq ?? {}), acquisition_id: ctx.acquisitionId })) return false;
  const method = methodText(ctx);
  if (/commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*1[23]\b/i.test(method)) return false;
  if (/sole[- ]?source|non-?competitive|8\(a\) direct/i.test(method)) return false;
  const part15 = /\b15\b|15\.\d|negotiat/i.test(method);
  const competed = /compet|full and open|source selection|SEB/i.test(method);
  const solicitation = /final (?:request for proposal|RFP)|final solicitation|solicitation/i.test(method);
  return part15 && competed && solicitation;
}

function humanDate(value: unknown): string {
  const text = str(value);
  if (!text) return "";
  const date = new Date(`${text.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}

/** Marker values for the active HQ blackout letter. */
export function blackoutMarkers(ctx: BlackoutContext): MarkerMap {
  const values = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => clean(values[key]);
  const center = value("center_name") || str(ctx.centerName) || str(acq["center_name"]) || str(acq["center_code"]);
  const title = value("acquisition_name") || str(acq["title"]) || ctx.acquisitionId;
  const scope = value("scope") || clean(acq["description_of_requirement"]);
  const solicitationKind = value("solicitation_kind") || "Final Request for Proposal (RFP)";
  const solicitationNumber = value("solicitation_number");
  const officer = value("sig_name") || resolveOfficerName(acq, ctx.coName);
  const coContact = value("co_contact") || officer;
  const programOffice = value("program_office") || str(acq["mission_directorate_name"]);
  const resourcesApply = /^yes$/i.test(value("nasa_resources_apply"));
  const resourcesReference = value("resources_reference");

  return {
    "[[CENTER]]": center || KEEP,
    "[[CENTER_ADDRESS]]": str(ctx.centerAddress) || KEEP,
    "[[DATE]]": humanDate(ctx.preparedDate) || str(ctx.preparedDate) || KEEP,
    "[[ATTN_OF]]": value("attn_of") || str(ctx.organizationCode) || "Office of Procurement",
    "[[FROM_LINE]]": ["Office of Procurement", programOffice].filter(Boolean).join(" and "),
    "[[SUBJECT_LINE]]": `National Aeronautics and Space Administration (NASA) Blackout Notice for ${solicitationKind}${solicitationNumber ? ` ${solicitationNumber}` : ""}, ${title}`,
    "[[ACQUISITION_INTRO]]": `A ${solicitationKind.toLowerCase()} for ${title} is being released to industry.${scope ? ` The resulting contract will provide ${scope}.` : ""} The solicitation is located at the Governmentwide point of entry and may be found using its solicitation number.`,
    "[[BLACKOUT_BODY]]": "Effective immediately, all NASA personnel will cease communications with industry concerning this acquisition. This blackout period will continue through receipt and evaluation of proposals, contract award, and release of the evaluation board from its responsibilities.",
    "[[CO_REFERRAL]]": `NASA personnel must refer anyone seeking information regarding this acquisition to the designated Contracting Officer${coContact ? `, ${coContact},` : ""}${center ? ` at ${center}` : ""}. Improper communication could jeopardize the integrity or successful completion of this acquisition. Compliance will ensure uniform responses and eliminate preferential treatment. This notice does not terminate all communication with offerors; the Contracting Officer may continue to provide information that creates no unfair competitive advantage and reveals no proprietary data.`,
    "[[RELATED_CONTRACTS]]": `NASA personnel administering existing contracts or agreements related to ${title} must remain aware of this acquisition's sensitive nature. Communications concerning ongoing contract work must remain limited to those contracts or agreements and must not expand into this acquisition. Under no circumstances will this acquisition be discussed.`,
    "[[OPTIONAL_RESOURCES]]": resourcesApply && resourcesReference
      ? `During the blackout period, limited communications are permitted between industry and the specific NASA points of contact identified in ${resourcesReference}. These communications are limited to potential use of NASA resources in support of ${title}.`
      : "",
    "[[RESOURCES_FIREWALL]]": resourcesApply
      ? "These communications must not include proposal assistance, advice or opinions on an offeror's solution, or discussion of the competition or its technical requirements. NASA personnel participating in resource-availability communications must be firewalled from direct or indirect participation in proposal evaluation."
      : "",
    "[[SIGNER_NAME]]": officer || KEEP,
    "[[SIGNER_TITLE]]": value("sig_title") || "Contracting Officer",
  };
}

/** Fill the genuine HQ blackout master and return named-download-ready bytes. */
export async function generateBlackoutDocx(ctx: BlackoutContext): Promise<Uint8Array> {
  if (!isBlackoutPath(ctx)) throw new Error("This record is not on a competed Part 15 final-solicitation blackout path.");
  const response = await fetch(BLACKOUT_MASTER_URL);
  if (!response.ok) throw new Error("The blackout notice master could not be read from this app.");
  const bytes = await response.arrayBuffer();
  const map = blackoutMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) throw new Error(`The master splits these markers across runs, so the notice was not written: ${split.join(", ")}.`);
  return applyMarkers(bytes, map);
}