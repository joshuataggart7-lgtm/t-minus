/**
 * Soft Walk — JOFOC in Word, written into the NASA master held at
 * /forms/JOFOC_MASTER.docx. Nothing is built from scratch: the master's
 * styles, theme and Prototype footer are kept exactly as they are and only the
 * marker runs are filled from the same record prose the printed JOFOC uses.
 *
 * One contracting officer certification block. No technical representative,
 * competition advocate, counsel or multi-tier signature lines.
 */
import { jofocPrintBlocks, type ExportContext } from "@/lib/template-engine";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";

export const JOFOC_MASTER_URL = "/forms/JOFOC_MASTER.docx";

/** The marker map for the JOFOC, from the record. */
export function jofocMarkers(ctx: ExportContext): MarkerMap {
  const blocks = jofocPrintBlocks(ctx);
  // Blocks 0-3 are the agency line, the center lines, the title and the
  // header block; blocks 4-14 are items 1 to 11.
  const headerLines = blocks[3]?.lines ?? [];
  const items = blocks.slice(4, 15);
  const map: MarkerMap = {
    "[[AGENCY_LINE]]": "National Aeronautics and Space Administration",
    "[[CENTER_NAME]]": ctx.centerName ?? "",
    "[[CENTER_ADDRESS]]": ctx.centerAddress ?? "",
    "[[LETTER_DATE]]": ctx.preparedDate ?? "",
    "[[HEADER_CENTER]]": headerLines[0] ?? "",
    "[[HEADER_SOLICITATION]]": headerLines[1] ?? "",
    "[[HEADER_PROGRAM]]": headerLines[2] ?? "",
    // Optional passages. Nothing on the record, nothing printed.
    "[[ITEM5_URGENCY_HARM]]": "",
    "[[ITEM5_URGENCY_NOT_DELAY]]": "",
    "[[ITEM9_FOLLOWON]]": "",
    "[[ITEM9_URGENCY]]": "",
    "[[CERT_HEADING]]": "Certification",
    "[[CO_CERT_TEXT]]":
      "I hereby certify that the above justification is accurate and complete to the best of my knowledge and belief.",
    "[[SIG_LINE]]": "______________________________",
    "[[CO_NAME]]": ctx.coName || "______________________________",
    "[[CO_TITLE]]": ctx.coTitle || "Contracting Officer",
    "[[APPROVAL_NOTE]]": "",
  };
  for (let i = 0; i < 11; i += 1) {
    const block = items[i];
    const heading = (block?.heading ?? "").replace(/^\d+\.\s*/, "");
    // One marker is one run, so a multi-line item prints as one paragraph.
    const body = (block?.lines ?? []).filter(Boolean).join("; ");
    map[`[[ITEM${i + 1}_HEADING]]`] = `${i + 1}. ${heading}`;
    map[`[[ITEM${i + 1}]]`] = body;
  }
  return map;
}

/** The filled JOFOC, as .docx bytes. */
export async function generateJofocDocx(ctx: ExportContext): Promise<Uint8Array> {
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
