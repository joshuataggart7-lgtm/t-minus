/**
 * Soft Walk — Prenegotiation Position Memorandum (PPM) in Word, written into
 * the NASA OP master at /forms/PPM_MASTER.docx. The instruction pages and the
 * document history log are already out of the master; styles, headers, footers
 * and the template version identifier stay as the master writes them. Only
 * marker runs are filled from the record — no scratch OOXML.
 *
 * The PPM is a Part 15 document: NFS CG 1815.48 uses it for non-competitive
 * acquisitions above the simplified acquisition threshold. A commercial,
 * simplified file (Sample 1) is refused rather than dressed in Part 15 prose.
 *
 * Signature ink stays blank. The contracting officer's name prints on the
 * position block. The Enterprise Pricing Office concurrence block prints only
 * on the band that calls for it (an action at or above $500 million, or one
 * approved by the Assistant Administrator / Senior Procurement Executive);
 * otherwise those paragraphs are deleted rather than left empty.
 */
import { type ExportContext } from "@/lib/template-engine";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { resolveOfficerName } from "@/lib/softwalk-samples";

export const PPM_MASTER_URL = "/forms/PPM_MASTER.docx";

/** NFS CG 1815.48 puts the Enterprise Pricing Office concurrence at this value. */
export const PPM_EPO_CONCURRENCE_FLOOR = 500_000_000;

/** Keep-token: an empty value would delete the paragraph. */
const KEEP = " ";

export type PpmDocxContext = ExportContext & {
  /** The acquisition row, when the caller carries it, for the method gate. */
  acq?: Record<string, unknown> | undefined;
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

function parseMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number(String(raw ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function cleanProse(text: string): string {
  return text
    .replace(/\s*\[(?:Insert|insert|Describe|Check|Provide|List|NOTE)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The estimated value of the action, from the values the form carries. */
export function ppmEstimatedValue(ctx: PpmDocxContext): number {
  const v = ctx.values ?? {};
  return parseMoney(
    v["objective_price"] ||
      v["proposed_price"] ||
      v["estimated_value"] ||
      v["total_estimated_value"] ||
      (ctx.acq ? ctx.acq["estimated_value"] : ""),
  );
}

/** True where the Enterprise Pricing Office concurrence block prints. */
export function ppmEpoConcurrenceRequired(ctx: PpmDocxContext): boolean {
  const v = ctx.values ?? {};
  if (/\byes\b|required/i.test(str(v["epo_concurrence"]))) return true;
  return ppmEstimatedValue(ctx) >= PPM_EPO_CONCURRENCE_FLOOR;
}

/**
 * True only on a Part 15 negotiated, non-competitive path. A commercial or
 * simplified file, or a competed file without a sole-source basis, is refused
 * so the Part 15 memorandum is never forced onto the wrong record.
 */
export function isPpmPath(ctx: PpmDocxContext): boolean {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const method = `${str(v["acquisition_method"])} ${str(acq["acquisition_method"])} ${str(acq["contract_format"])}`;
  const competition = `${str(v["competition_type"])} ${str(acq["competition"])} ${str(v["extent_competed"])}`;
  // Commercial or simplified paths record price reasonableness under Part 12
  // and Part 13, never with a Part 15 prenegotiation position.
  if (/commercial|simplified|13\.5|FAR\s*12\b/i.test(method)) return false;
  if (!/15\b|negotiat/i.test(method)) return false;
  if (/full and open|competed|competitive/i.test(competition) && !/sole[- ]source|other than full/i.test(competition)) {
    return false;
  }
  return true;
}

/** The marker map for the PPM master, from the record. */
export function ppmMarkers(ctx: PpmDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const officer = resolveOfficerName(acq, ctx.coName);
  const epo = ppmEpoConcurrenceRequired(ctx);

  const title =
    value("requirement_title") || str(acq["title"]) || str(acq["description_of_requirement"]) || ctx.acquisitionId;
  const contractor = value("contractor_name") || str(acq["vendor_legal_name"]);
  const address = value("contractor_address");
  const place = value("place_of_performance") || str(acq["place_of_performance"]);
  const contractorBlock = [
    `Contractor: ${contractor || "Not recorded"}`,
    address ? `Address: ${address}` : "",
    `Place of Performance: ${place || "Not recorded"}`,
  ]
    .filter(Boolean)
    .join("  ");

  const jofocStatus = value("jofoc_status") || str(acq["jofoc_authority_citation"]);
  const jofocApproved = value("jofoc_approved_on");
  const synopsisDate = value("synopsis_date");

  return {
    "[[REQUIREMENT_TITLE]]": title,
    "[[DESCRIPTION_BACKGROUND]]":
      value("description_background") || str(acq["description_of_requirement"]) || KEEP,
    "[[CONTRACTOR_BLOCK]]": contractorBlock,
    "[[MAJOR_SUBCONTRACTORS]]": value("major_subcontractors") || "None identified for this action.",
    "[[JOFOC_STATUS_PROSE]]": jofocStatus
      ? `A justification for other than full and open competition was required. The exception is ${jofocStatus}${jofocApproved ? `, approved on ${jofocApproved}` : ""}.`
      : "The justification for other than full and open competition is not recorded on this file.",
    "[[PRESOLICITATION_PROSE]]": synopsisDate
      ? "A presolicitation notice was posted to the Government Point of Entry as recorded below (FAR 5.101)."
      : "The presolicitation notice for this action is not recorded on this file.",
    "[[SYNOPSIS_DATE]]": synopsisDate || "Not recorded",
    "[[SYSTEMS_STATUS]]":
      value("compliance_explanations") ||
      "The status of the contractor's business systems is recorded in the checkboxes that follow.",
    "[[PROPOSALS]]": value("proposals") || "Not recorded",
    "[[FACT_FINDING]]": value("fact_finding") || "Not recorded",
    "[[TECHNICAL_EVALUATION]]": value("technical_evaluation") || "Not recorded",
    "[[FIELD_PRICING]]": value("field_pricing") || "5. Field Pricing Report or Auditor Rate Verification: N/A",
    "[[COST_PRICE_REPORT]]": value("cost_price_report") || "6. Cost/Price Evaluation Report: N/A",
    "[[CERTIFIED_DATA]]": value("certified_data") || KEEP,
    "[[NEGOTIATION_SCHEDULE]]":
      `Negotiations will commence upon approval of this PPM.${value("negotiation_schedule") ? ` ${value("negotiation_schedule")}` : ""}`,
    "[[NEGOTIATION_TEAM_CO]]": officer
      ? `${officer}, Contracting Officer, ${str(ctx.centerName) || str(acq["center_code"]) || "NASA"}`
      : KEEP,
    "[[NEGOTIATION_TEAM_COR]]": value("negotiation_team") || "",
    "[[NEGOTIATION_TEAM_OTHER]]": "",
    "[[CONTRACT_TYPE_NARRATIVE]]": value("contract_type_narrative")
      ? `${value("contract_type")}${value("contract_type") ? ". " : ""}${value("contract_type_narrative")}`
      : value("contract_type") || KEEP,
    "[[SPECIAL_FEATURES_NARRATIVE]]": value("special_features_narrative") || KEEP,
    "[[NOTE_A]]": value("note_a") || KEEP,
    "[[NOTE_B]]": value("note_b") || KEEP,
    "[[NOTE_C]]": value("note_c") || KEEP,
    "[[NOTE_D]]": value("note_d") || KEEP,
    "[[NOTE_E]]": value("note_e") || KEEP,
    "[[NOTE_F]]": value("note_f") || KEEP,
    "[[NOTE_G]]": value("note_g") || KEEP,
    "[[NOTE_H]]": value("note_h") || KEEP,
    "[[NOTE_I]]": value("note_i") || KEEP,
    "[[NOTE_J]]": value("note_j") || KEEP,
    "[[NOTE_K]]": value("note_k") || KEEP,
    "[[NOTE_L]]": value("note_l") || KEEP,
    "[[NOTE_M]]": value("note_m") || KEEP,
    "[[NOTE_N]]": value("note_n") || KEEP,
    "[[APPROVAL_STATEMENT]]": `The prenegotiation position above represents the Government's realistic assessment of fair and reasonable prices for ${title}. Based on the information provided herein, approval is sought for the prenegotiation positions set forth in this document.`,
    "[[SIG_NAME]]": value("sig_name") || officer || KEEP,
    "[[SIG_TITLE]]": value("sig_title") || (officer ? "Contracting Officer" : KEEP),
    // The Enterprise Pricing Office concurrence prints on its own band only.
    "[[CONCURRENCE_LABEL]]": epo
      ? "CONCURRENCE: Director, Enterprise Pricing Office (NFS CG 1815.48)"
      : "",
    "[[CONCURRENCE_NAME]]": epo ? value("concurrence_name") || KEEP : "",
    "[[CONCURRENCE_TITLE]]": epo
      ? value("concurrence_title") || "Director, Enterprise Pricing Office"
      : "",
    "[[APPROVAL_NAME]]": value("approval_name") || KEEP,
    "[[APPROVAL_TITLE]]": value("approval_title") || str(ctx.approvingOfficialTitle) || KEEP,
    "[[ATTACHMENT_1]]": value("attachments") || "None",
    "[[ATTACHMENT_2]]": "",
    "[[ATTACHMENT_3]]": "",
  };
}

/** The filled prenegotiation position memorandum, as .docx bytes. */
export async function generatePpmDocx(ctx: PpmDocxContext): Promise<Uint8Array> {
  const res = await fetch(PPM_MASTER_URL);
  if (!res.ok) throw new Error("The PPM master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const map = ppmMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the memorandum was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}
