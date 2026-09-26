/**
 * Soft Walk — Postaward notification letters in Word, written into the NASA OP
 * masters at /forms/POSTAWARD_SUCCESS_MASTER.docx and
 * /forms/POSTAWARD_UNSUCCESS_MASTER.docx. The instruction pages, the colour
 * coded drafter notes and the document history logs are already out of the
 * masters; styles, headers, footers and the template version identifier stay
 * as the masters write them. Only marker runs are filled from the record — no
 * scratch OOXML, no letterhead or media added here.
 *
 * Both letters are Part 15 notifications:
 *   Successful  — FAR 15.207-1(a), FAR 15.301-1(a)(1); NFS CG 1815.29,
 *                 1815.31 and 1815.32 carry the debriefing process.
 *   Unsuccessful — FAR 15.207-2(b), FAR 15.301-1.
 *
 * A commercial or simplified file (Sample 1) is refused rather than dressed in
 * Part 15 prose: that path notifies under RFO FAR 12.301, or FAR 13.301 on a
 * simplified noncommercial file, and gives a brief explanation on request.
 *
 * Signature ink stays blank. The contracting officer's name prints on the
 * signature block when the record carries one.
 */
import { type ExportContext } from "@/lib/template-engine";
import { applyMarkers, lintMarkersSplit, readDocumentXml, type MarkerMap } from "@/lib/apply-docx-markers";
import { resolveOfficerName } from "@/lib/softwalk-samples";

export const POSTAWARD_SUCCESS_MASTER_URL = "/forms/POSTAWARD_SUCCESS_MASTER.docx";
export const POSTAWARD_UNSUCCESS_MASTER_URL = "/forms/POSTAWARD_UNSUCCESS_MASTER.docx";

/** Keep-token: an empty value would delete the paragraph. */
const KEEP = " ";

export type PostawardDocxContext = ExportContext & {
  /** The acquisition row, when the caller carries it, for the method gate. */
  acq?: Record<string, unknown> | undefined;
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

function cleanProse(text: string): string {
  return text
    .replace(/\s*\[(?:Insert|insert|Describe|Check|Provide|List|NOTE)[^\]]*\]/g, "")
    .replace(/\s*\((?:Insert|insert)[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function methodText(ctx: PostawardDocxContext): string {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  return `${str(v["acquisition_method"])} ${str(acq["acquisition_method"])} ${str(acq["contract_format"])} ${str(v["__method"])}`;
}

/** True where the file records a commercial or simplified path. */
export function isCommercialOrSimplified(ctx: PostawardDocxContext): boolean {
  return /commercial|simplified|13\.5|\bFAR\s*12\b|\bpart\s*12\b/i.test(methodText(ctx));
}

/**
 * True only on a FAR Part 15 negotiated path. A commercial or simplified file
 * is refused so the Part 15 notification is never forced onto the wrong record.
 */
export function isPart15NotificationPath(ctx: PostawardDocxContext): boolean {
  if (isCommercialOrSimplified(ctx)) return false;
  return /\b15\b|15\.\d|negotiat/i.test(methodText(ctx));
}

/**
 * The notice a commercial or simplified file makes instead. RFO FAR 12.301 on
 * a commercial file; FAR 13.301 on a simplified noncommercial file.
 */
export function simplifiedNoticeCitation(ctx: PostawardDocxContext): string {
  return /commercial|\bFAR\s*12\b|\bpart\s*12\b/i.test(methodText(ctx))
    ? "RFO FAR 12.301"
    : "FAR 13.301";
}

function officerBlock(ctx: PostawardDocxContext) {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const officer = str(v["co_name"]) || resolveOfficerName(acq, ctx.coName);
  return {
    name: officer,
    email: cleanProse(str(v["co_email"])),
    phone: cleanProse(str(v["co_phone"])),
  };
}

/** The marker map for the successful offeror letter. */
export function postawardSuccessMarkers(ctx: PostawardDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const co = officerBlock(ctx);
  const center = value("center_name") || str(ctx.centerName) || str(acq["center_code"]) || "NASA";
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const company = value("company_name") || str(acq["vendor_legal_name"]);
  const addressee = value("addressee");
  const addressLines = addressee.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  return {
    "[[CENTER_NAME]]": center,
    "[[CENTER_ADDRESS]]": str(ctx.centerAddress) || KEEP,
    "[[ORG_CODE]]": value("org_code") || str(ctx.organizationCode) || KEEP,
    "[[POC_NAME]]": value("poc_name") || KEEP,
    "[[POC_TITLE]]": addressLines[0] ?? KEEP,
    "[[OFFEROR_NAME]]": company,
    "[[OFFEROR_STREET]]": addressLines[1] ?? KEEP,
    "[[OFFEROR_CITY_STATE_ZIP]]": addressLines[2] ?? KEEP,
    "[[SOLICITATION_NUMBER]]": value("solicitation_number") || KEEP,
    "[[ACQ_TITLE]]": title,
    "[[ACQ_TITLE_SHORT]]": title,
    "[[SALUTATION_NAME]]": value("poc_name") || company || KEEP,
    "[[CENTER_NAME_BODY]]": center,
    "[[CENTER_NAME_BODY2]]": center,
    "[[COMPANY_NAME]]": company || KEEP,
    "[[CONTRACT_NUMBER]]": value("contract_number") || str(acq["contract_number"]) || KEEP,
    "[[EFFECTIVE_DATE]]": value("effective_date") || KEEP,
    "[[CO_EMAIL]]": co.email || KEEP,
    // The authority for this notification, from the master's own reference
    // list: FAR 15.207-1(a) with the NFS CG debriefing process.
    "[[NOTICE_AUTHORITY_LINE]]":
      "This notification is provided under FAR 15.207-1(a). Debriefings are conducted under FAR 15.301-1(b) and (c) and the NASA Procurement Debriefing Guide (NFS CG 1815.31); NFS CG 1815.29 carries the notification process and NFS CG 1815.32 applies to major system acquisitions.",
    "[[CO_PHONE]]": co.phone || KEEP,
    "[[CO_NAME]]": co.name || KEEP,
    "[[CO_TITLE]]": "Contracting Officer",
    "[[ENCLOSURE_1]]": value("enclosures") || "Source Selection Statement",
  };
}

/** The marker map for the unsuccessful offeror letter. */
export function postawardUnsuccessMarkers(ctx: PostawardDocxContext): MarkerMap {
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const co = officerBlock(ctx);
  const center = value("center_name") || str(ctx.centerName) || str(acq["center_code"]) || "NASA";
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const company = value("company_name");

  return {
    "[[LETTER_DATE]]": value("letter_date") || str(ctx.preparedDate) || KEEP,
    "[[ORG_CODE]]": value("org_code") || str(ctx.organizationCode) || KEEP,
    "[[OFFEROR_ADDRESS_BLOCK]]": value("addressee") || company || KEEP,
    "[[SOLICITATION_NUMBER]]": value("solicitation_number") || KEEP,
    "[[ACQ_TITLE]]": title,
    "[[SALUTATION_NAME]]": value("poc_name") || company || KEEP,
    "[[COMPANY_NAME]]": company || KEEP,
    "[[COMPANY_NAME_2]]": company || KEEP,
    "[[CENTER_NAME_BODY]]": center,
    // FAR 15.207-2(b) is the written notification requirement on a negotiated
    // acquisition. The stale FAR 15.502-7 reference is not carried here.
    "[[NOTICE_AUTHORITY_LINE]]":
      "Pursuant to Federal Acquisition Regulation (FAR) 15.207-2(b), the following information is provided:",
    "[[OFFERORS_SOLICITED]]": value("offerors_solicited") || KEEP,
    "[[PROPOSALS_RECEIVED]]": value("proposals_received") || KEEP,
    "[[AWARDEES]]": value("awardees") || KEEP,
    "[[CONTRACT_VALUE]]": value("contract_value") || "Not recorded",
    "[[VALUE_PERIOD]]": value("value_period") || KEEP,
    "[[EVALUATION_FACTORS]]": value("selection_rationale") || "as stated in the solicitation",
    "[[SELECTED_OFFEROR]]": value("awardees") || str(acq["vendor_legal_name"]) || KEEP,
    "[[CO_EMAIL]]": co.email || KEEP,
    "[[PROPOSAL_DISPOSITION]]":
      "One copy of your proposal will be retained in the permanent contract file, and all remaining copies will be destroyed.",
    "[[CO_PHONE]]": co.phone || KEEP,
    "[[CO_NAME]]": co.name || KEEP,
    "[[CO_TITLE]]": "Contracting Officer",
    "[[ENCLOSURE_1]]": value("enclosures") || "Source Selection Statement",
  };
}

async function writeFromMaster(url: string, map: MarkerMap): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("The letter master could not be read from this app.");
  const bytes = await res.arrayBuffer();
  const split = lintMarkersSplit(await readDocumentXml(bytes), Object.keys(map));
  if (split.length) {
    throw new Error(
      `The master splits these markers across runs, so the letter was not written: ${split.join(", ")}.`,
    );
  }
  return await applyMarkers(bytes, map);
}

/** The filled successful offeror notification, as .docx bytes. */
export async function generatePostawardSuccessDocx(ctx: PostawardDocxContext): Promise<Uint8Array> {
  return await writeFromMaster(POSTAWARD_SUCCESS_MASTER_URL, postawardSuccessMarkers(ctx));
}

/** The filled unsuccessful offeror notification, as .docx bytes. */
export async function generatePostawardUnsuccessDocx(ctx: PostawardDocxContext): Promise<Uint8Array> {
  return await writeFromMaster(POSTAWARD_UNSUCCESS_MASTER_URL, postawardUnsuccessMarkers(ctx));
}

/* ------------------------------------------------------------------ *
 * Part 12 / Part 13 companion notifications.
 *
 * A commercial or simplified file is not dressed in Part 15 prose, but it
 * still notifies. The companion letters are written plainly from the record:
 *   Successful   — award notice; RFO FAR 12.301 on a commercial file,
 *                  FAR 13.301 on a simplified noncommercial file.
 *   Unsuccessful — notice that the quotation was not selected, with the brief
 *                  explanation available on written request under
 *                  FAR 13.106-3(d).
 * No Part 15 citation appears on either face. Signature ink stays blank.
 * ------------------------------------------------------------------ */

async function buildCompanionDocx(
  ctx: PostawardDocxContext,
  successful: boolean,
): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const v = ctx.values ?? {};
  const acq = ctx.acq ?? {};
  const value = (key: string) => cleanProse(str(v[key]));
  const co = officerBlock(ctx);
  const center = value("center_name") || str(ctx.centerName) || str(acq["center_code"]) || "NASA";
  const title = value("acquisition_title") || str(acq["title"]) || ctx.acquisitionId;
  const company = value("company_name") || str(acq["vendor_legal_name"]);
  const solicitation = value("solicitation_number");
  const citation = simplifiedNoticeCitation(ctx);

  const serif = { font: "Times New Roman", size: 24 } as const;
  const p = (text: string, opts: { bold?: boolean; after?: number } = {}) =>
    new Paragraph({
      spacing: { after: opts.after ?? 200 },
      children: [new TextRun({ ...serif, text, bold: opts.bold ?? false })],
    });

  const lines: InstanceType<typeof Paragraph>[] = [];
  lines.push(p("National Aeronautics and Space Administration", { bold: true, after: 0 }));
  lines.push(p(center, { after: 0 }));
  lines.push(p(str(ctx.centerAddress), { after: 360 }));
  const letterDate = value("letter_date") || str(ctx.preparedDate);
  if (letterDate) lines.push(p(letterDate, { after: 360 }));
  const addressee = value("addressee") || company;
  for (const line of addressee.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    lines.push(p(line, { after: 0 }));
  }
  lines.push(p("", { after: 240 }));
  lines.push(p(`Subject:  Notification${solicitation ? ` for Solicitation No. ${solicitation}` : ""} for the ${title} acquisition`, { bold: true }));
  const salutation = value("poc_name") || company;
  if (salutation) lines.push(p(`Dear ${salutation}:`));

  if (successful) {
    lines.push(
      p(
        `The National Aeronautics and Space Administration (NASA) ${center} has awarded a contract${company ? ` to ${company}` : ""} under the subject solicitation.${value("contract_number") || str(acq["contract_number"]) ? ` The contract number is ${value("contract_number") || str(acq["contract_number"])}.` : ""}${value("effective_date") ? ` The contract has an effective date of ${value("effective_date")}.` : ""}`,
      ),
    );
    lines.push(
      p(
        `This notification is provided under ${citation}. This acquisition was conducted using simplified procedures; the Part 15 postaward debriefing procedures do not apply.`,
      ),
    );
  } else {
    lines.push(
      p(
        `This notification is to inform${company ? ` ${company}` : " you"} that the National Aeronautics and Space Administration (NASA) ${center} has awarded a contract under the subject solicitation and your quotation was not selected for award.`,
      ),
    );
    const awardee = value("awardees") || str(acq["vendor_legal_name"]);
    const contractValue = value("contract_value");
    const numericContractValue = /^\s*\d[\d,]*(?:\.\d+)?\s*$/.test(contractValue)
      ? Number(contractValue.replace(/,/g, ""))
      : null;
    const printedContractValue =
      numericContractValue !== null && Number.isFinite(numericContractValue)
        ? numericContractValue.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          })
        : contractValue;
    if (awardee || contractValue) {
      lines.push(p(`Award was made${awardee ? ` to ${awardee}` : ""}${printedContractValue ? ` at a total value of ${printedContractValue}` : ""}.`));
    }
    lines.push(
      p(
        "This acquisition was conducted using simplified procedures, so a postaward debriefing is not conducted. On written request received within three days of this notice, the contracting officer will provide a brief explanation of the basis for the award decision under FAR 13.106-3(d).",
      ),
    );
  }

  const contactMethods = [co.phone ? `at ${co.phone}` : "", co.email ? `by e-mail at ${co.email}` : ""].filter(Boolean);
  lines.push(p(`For additional information, please contact the undersigned${contactMethods.length ? ` ${contactMethods.join(" or ")}` : ""}.`, { after: 480 }));
  lines.push(p("Sincerely,", { after: 720 }));
  lines.push(p(co.name || KEEP, { after: 0 }));
  lines.push(p("Contracting Officer", { after: 0 }));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: lines,
      },
    ],
  });
  // `toBuffer` is the Node-oriented packer path and fails in the browser.
  // Match the working memo exports: package as a Blob, then expose its bytes
  // to the shared download helper.
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

/** The commercial or simplified successful-offeror companion notice. */
export async function generatePostawardSuccessCompanionDocx(
  ctx: PostawardDocxContext,
): Promise<Uint8Array> {
  return await buildCompanionDocx(ctx, true);
}

/** The commercial or simplified unsuccessful-quoter companion notice. */
export async function generatePostawardUnsuccessCompanionDocx(
  ctx: PostawardDocxContext,
): Promise<Uint8Array> {
  return await buildCompanionDocx(ctx, false);
}
