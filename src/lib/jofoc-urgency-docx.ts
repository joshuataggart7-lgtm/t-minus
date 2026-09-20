/**
 * Soft Walk — Unusual and Compelling Urgency JOFOC in Word, written into the
 * NASA OP cite-fixed master at /forms/JOFOC_URGENCY_MASTER.docx. Instruction
 * pages and the document history log are already out of the master; styles,
 * footer and Prototype honesty stay. Only marker runs are filled from the
 * record — no scratch OOXML.
 *
 * Who signs stays amount-driven: the same JOFOC threshold ladder prints one
 * SIG_BAND_* page and deletes the other three. Signature underscores stay
 * blank ink; Soft Walk co_name fills [[CO_NAME]] on the active band only.
 */
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { jofocMarkers, type JofocDocxContext } from "@/lib/jofoc-docx";

export const JOFOC_URGENCY_MASTER_URL = "/forms/JOFOC_URGENCY_MASTER.docx";

/** Keep-token: an empty value would delete the paragraph. */
const KEEP = " ";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/**
 * Face authority for the urgency path, from the record when it carries one,
 * otherwise the FAR Part 6 urgency face cite the OP master itself prints.
 * Never a brand-name or Part 12 commercial cite.
 */
export function urgencyAuthorityLine(recorded: string): string {
  const text = recorded.replace(/\s*Basis of record:.*$/i, "").trim();
  if (text && /6\.103-2|3204\(a\)\(2\)/i.test(text)) {
    return /^the statutory authority/i.test(text)
      ? text
      : `The statutory authority permitting other than full and open competition is ${text}`;
  }
  return "The statutory authority permitting other than full and open competition is 10 U.S.C. 3204(a)(2), as implemented by FAR 6.103-2, Unusual and compelling urgency.";
}

/** True when the record actually carries an unusual and compelling urgency path. */
export function isUrgencyJofocPath(ctx: JofocDocxContext): boolean {
  const v = ctx.values ?? {};
  const authority = `${str(v["authority"])} ${str(v["authority_rationale"])}`;
  const competition = str(v["competition_type"]) || str(v["extent_competed"]);
  if (/full and open|competed/i.test(competition) && !/6\.103-2|3204\(a\)\(2\)/i.test(authority)) return false;
  return (
    /6\.103-2/i.test(authority) ||
    /3204\(a\)\(2\)/i.test(authority) ||
    /unusual and compelling urgency/i.test(authority)
  );
}

/** Marker map for the urgency master: shared JOFOC family plus urgency-only markers. */
export function jofocUrgencyMarkers(ctx: JofocDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const shared = jofocMarkers(ctx);
  const value = (key: string) => str(v[key]);
  const recordedAuthority = value("authority");

  const map: MarkerMap = { ...shared };

  // The urgency master carries its own single authority line; the general
  // JOFOC 10/41 U.S.C. split markers do not exist in this master.
  delete map["[[AUTHORITY_10USC_STEM]]"];
  delete map["[[AUTHORITY_10USC_LINE]]"];
  delete map["[[AUTHORITY_OR_TOKEN]]"];
  delete map["[[AUTHORITY_41USC_LINE]]"];

  map["[[URGENCY_AUTHORITY_LINE]]"] = urgencyAuthorityLine(recordedAuthority);
  map["[[PROGRAM_BACKGROUND]]"] = value("program_background") || value("mission_supported") || "";
  map["[[URGENCY_HARM]]"] = value("urgency_harm") || value("injury_chronology") || KEEP;
  map["[[URGENCY_NOT_DELAY]]"] = value("urgency_not_delay") || KEEP;
  map["[[NOTICE_URGENCY_EXEMPTION]]"] =
    value("notice_exemption") ||
    "The contracting officer has determined in accordance with FAR 5.101(b)(1) that this action is exempt from the notice required in FAR 5.101, because unusual and compelling urgency precludes competition to the maximum extent practicable and the Government would be seriously injured if the agency complies with the publicizing and response time periods specified in FAR 5.101(d). This justification for other than full and open competition, approved under FAR 6.301(b)(1), will be posted within 30 days after contract award as required by FAR 6.305.";
  map["[[MARKET_RESEARCH_PROSE]]"] = shared["[[MARKET_RESEARCH_PROSE]]"] || KEEP;

  return map;
}

/** The filled urgency JOFOC, as .docx bytes. */
export async function generateJofocUrgencyDocx(ctx: JofocDocxContext): Promise<Uint8Array> {
  const res = await fetch(JOFOC_URGENCY_MASTER_URL);
  if (!res.ok) throw new Error("The urgency justification master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const map = jofocUrgencyMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the justification was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}
