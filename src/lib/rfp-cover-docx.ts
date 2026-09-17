/**
 * Soft §5 — RFP cover letter in Word, written into the genuine NASA master
 * held at /forms/RFP_COVER_MASTER.docx. Nothing is generated from scratch:
 * the master's letterhead, styles and footers are kept exactly as they are and
 * only the marker runs are filled from the acquisition record.
 *
 * Optional passages (phase-in, property, site visit, OCI, security, AI, draft
 * RFP, past performance, SEB, CAGE, price exhibits, blackout) stay empty when
 * the record does not carry them, so their paragraphs are removed rather than
 * printed as guesswork.
 */
import type { FormCtx } from "@/lib/nf1787";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";

export const RFP_COVER_MASTER_URL = "/forms/RFP_COVER_MASTER.docx";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** A recorded date as plain prose, or an empty string when nothing is recorded. */
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

const NOT_RECORDED = "Not recorded";

/** A value that must print; a blank would delete the paragraph. */
const required = (v: string) => (v ? v : NOT_RECORDED);

/** The marker map for the RFP cover, from the record. */
export function rfpCoverMarkers(ctx: FormCtx): MarkerMap {
  const a = ctx.acq;
  const center = str(a["center_name"]) || str(a["center_code"]);
  const title = str(a["title"]);
  const co = str(a["co_name"]) || ctx.coName;
  const naics = str(a["naics_code"]);
  const sizeStandard = ctx.sizeStandard
    ? ctx.sizeStandard.standardType === "employees"
      ? `${ctx.sizeStandard.employees ?? ""} employees`
      : `$${Number(ctx.sizeStandard.receiptsUsd ?? 0).toLocaleString("en-US")} in average annual receipts`
    : "";
  const competition = str(a["competition"]) || "competitive acquisition";
  const contractType = str(a["contract_type"]) || str(a["hybrid_contract_type"]);
  const place = str(a["place_of_performance_standardized"]) || str(a["place_of_performance"]);
  const description = str(a["description_of_requirement"]) || title;
  const solicitation = str(a["solicitation_number"]) || str(a["pr_number"]) || ctx.acquisitionId;
  const office = str(a["requester_org_code"]) || str(a["co_code"]) || str(a["branch_code"]);
  const commercial = /commercial/i.test(str(a["acquisition_method"]) || str(a["contract_format"]));
  const provision = commercial ? "52.212-1" : "52.215-1";

  return {
    "[[CENTER_NAME]]": required(center),
    "[[CENTER_ADDRESS]]": place || center || NOT_RECORDED,
    "[[LETTER_DATE]]": humanDate(new Date().toISOString()),
    "[[REPLY_ATTN]]": office ? `Reply to Attn of:\t\t${office}` : "",
    "[[SUBJECT_LINE]]": `SUBJECT:  \tRequest for Proposal (RFP), Solicitation No. ${solicitation}, for`,
    "[[SUBJECT_TITLE_LINE]]": `\t\t\t${required(title)}`,
    "[[INTRO]]": `You are invited to submit a proposal in response to the National Aeronautics and Space Administration (NASA) ${center} ${title} solicitation. The principal purpose of this requirement is to provide ${description || NOT_RECORDED}.`,
    "[[COMPETITION_NAICS]]": `NASA will conduct this acquisition as a ${competition}. The North American Industry Classification System (NAICS) code for this acquisition is ${naics || NOT_RECORDED}${sizeStandard ? ` and the small business size standard is ${sizeStandard}` : ""}.`,
    "[[CONTRACT_TYPE_POP]]": contractType
      ? `This acquisition will result in a ${contractType}.`
      : "",
    "[[AWARD_PERFORMANCE]]": (() => {
      const award = humanDate(str(a["target_award_date"]));
      const start = humanDate(str(a["period_of_performance_start"]));
      const parts = [
        award ? `The anticipated contract award date is ${award}.` : "",
        start ? `The anticipated period of performance begins ${start}.` : "",
        place ? `The contract will be performed ${place}.` : "",
      ].filter(Boolean);
      return parts.join(" ");
    })(),
    "[[REQUIREMENTS_INTRO]]":
      "Potential offerors should pay close attention to all solicitation instructions; however, the following requirements list is summarized to assist in proposal development. This list is not exhaustive, and the solicitation terms and conditions and provisions in Sections L and M take precedence.",
    // Optional passages. Nothing on the record, nothing printed.
    "[[PHASE_IN]]": "",
    "[[PROPERTY]]": "",
    "[[SITE_VISIT]]": "",
    "[[OCI]]": "",
    "[[SECURITY]]": "",
    "[[REMOVE_AI_INSTRUCTION]]": "",
    "[[AI_DISCLOSURE]]": "",
    "[[DRFP_INTRO]]": "",
    "[[DRFP_CHANGES]]": "",
    "[[DRFP_CLOSE]]": "",
    "[[PPQ]]": "",
    "[[SEB_INTRO]]": "",
    "[[SSA_HEADING]]": "",
    "[[SSA]]": "",
    "[[VOTERS_HEADING]]": "",
    "[[VOTERS]]": "",
    "[[CAGE]]": "",
    "[[SPECIAL]]": "",
    "[[FAR_INSTRUCTIONS]]":
      provision === "52.212-1"
        ? "Offerors are encouraged to refer to Federal Acquisition Regulation (FAR) provision 52.212-1, Instructions to Offerors-Commercial Products and Commercial Services, including the provision language addressing evaluation and award without discussions."
        : "Offerors are encouraged to refer to Federal Acquisition Regulation (FAR) provision 52.215-1, Instructions to Offerors-Competitive Acquisition, in particular paragraph (f)(4), which discusses the Government's right to award a contract without negotiations (except clarifications).",
    "[[REMOVE_OR]]": "",
    "[[REMOVE_ALT_FAR]]": "",
    "[[PRICE_EXHIBITS]]": "",
    "[[RFP_DISCLAIMER]]": `This RFP does not commit NASA ${center} to pay any proposal preparation costs, nor does it obligate NASA ${center} to procure or contract for these services. This request is not an authorization to proceed and does not authorize payment for any charges incurred by the offeror for performing any of the work called for in this solicitation.`,
    "[[PROPOSAL_DUE]]": (() => {
      const due = humanDate(str(a["proposals_due"]) || str(a["offers_due"]));
      return due ? `Proposals submitted in response to this solicitation are due no later than ${due}.` : "";
    })(),
    "[[BLACKOUT]]": "",
    "[[QUESTIONS]]": `All questions regarding this RFP should be submitted in writing, electronically to ${required(co)}, Contracting Officer.`,
    "[[CO_NAME]]": required(co),
  };
}

/** The filled RFP cover letter, as .docx bytes. */
export async function generateRfpCoverDocx(ctx: FormCtx): Promise<Uint8Array> {
  const res = await fetch(RFP_COVER_MASTER_URL);
  if (!res.ok) throw new Error("The RFP cover master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const map = rfpCoverMarkers(ctx);
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the letter was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}

/** Save .docx bytes to the reader's machine. */
export function downloadDocxBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
