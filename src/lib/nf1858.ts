/**
 * NF 1858 memorandum layout (NASA Electronic Letterhead, Rev 12/24).
 *
 * A document can be issued inside the 1858 shell. The shell carries the
 * Center letterhead block, the date, the reply-to code, To / Thru / From /
 * Subject / Ref, the body, the signature block, an optional concurrence
 * block, enclosures, distribution and cc, and an optional CUI marking with
 * its cover sheet. The form field names are kept so the export maps onto
 * the blank form: CenterNameHeader, CenterAddressHeader, MainDate, ReplyTo,
 * To, Thru, From, Subject, Ref, Salutation, MainContent, DocumentSignature,
 * Name, Concurrence, Enclosures, Distribution, cc, bcc, CUISheetText.
 */

import { TEMPLATES, type RenderedDoc } from "@/lib/template-engine";
import { renderPdf, type PdfBlock } from "@/lib/pdf-out";

export const AGENCY_LINE = "National Aeronautics and Space Administration";

export const CUI_BANNER = "CUI";

export const CUI_SHEET_TEXT = [
  "CONTROLLED UNCLASSIFIED INFORMATION",
  "This cover sheet protects the attached document. Handle, store and transmit the document under 32 CFR Part 2002 and NASA policy. Dissemination is limited to persons with a lawful government purpose.",
  "When filled in, the attached document is marked CUI. Remove this cover sheet only when the document is filed in the contract file.",
].join("\n");

export type MemoHeader = {
  centerName: string;
  centerAddress: string;
  date: string;
  replyTo: string;
  to: string;
  thru: string[];
  from: string;
  subject: string;
  ref: string[];
  salutation: string;
  signatureName: string;
  signatureTitle: string;
  concurrence: { name: string; title: string }[];
  enclosures: string[];
  distribution: string[];
  cc: string[];
  cui: boolean;
};

export type MemoRoutingRow = {
  routing_id?: string;
  center_code: string;
  document_key: string;
  approving_official_title: string;
  thru_chain: string[] | null;
  memo_default: boolean | null;
  note?: string | null;
};

/** Document types that are issued on NF 1858 unless the CO turns the flag off. */
const DEFAULT_ON = new Set([
  "market-research-memo",
  "commerciality",
  "nonresponsibility",
  "consolidation",
  "bundling",
  "economy-act",
  "commercial-tm-lh",
  "option-justification",
  "fair-opportunity-brand-name",
  "pnm",
  "waiver-deviation-request",
  "coordination-memo",
  "packet-transmittal-memo",
]);

/** Document types that are never memoranda. */
const DEFAULT_OFF = new Set([
  "nf-1707",
  "technical-evaluation-report",
  "ter",
  "igce",
  "synopsis",
  "coordination-email",
  "ucf-contract",
  "cpars-input",
  "closeout-checklist",
]);

/** Document types the routing table can address, named as the templates name them. */
export const MEMO_DOCUMENT_KEYS: { key: string; name: string }[] = [...DEFAULT_ON, "jofoc"]
  .sort()
  .map((key) => ({
    key,
    name:
      TEMPLATES.find((t) => t.key === key)?.name ??
      key.split("-").map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" "),
  }));

/**
 * Default flag for a document type at a Center. The JOFOC follows the
 * Center's routing row, because the flag is on only where the Center's
 * JOFOC template is itself a memorandum.
 */
export function memoDefaultFor(templateKey: string, routing?: MemoRoutingRow | undefined): boolean {
  if (routing && routing.memo_default !== null && routing.memo_default !== undefined) return routing.memo_default;
  if (templateKey === "jofoc") return false;
  if (DEFAULT_OFF.has(templateKey)) return false;
  return DEFAULT_ON.has(templateKey);
}

export const formatMemoDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};

export type ApprovalForMemo = { role: string; name: string | null; order?: number };

export type BuildMemoInput = {
  templateKey: string;
  templateName: string;
  documentCitation: string;
  acquisition: Record<string, unknown>;
  centerName: string;
  centerAddress: string;
  routing?: MemoRoutingRow | undefined;
  coName: string;
  approvals: ApprovalForMemo[];
  enclosures?: string[];
  today: string;
};

/**
 * Documents that are filed rather than approved. They are addressed to the
 * contract file, with no Thru chain.
 */
const FILE_ADDRESSED = new Set(["market-research-memo", "commerciality"]);

const fileAddressed = (templateKey: string) => FILE_ADDRESSED.has(templateKey);

/** Prefilled header for a memorandum, before the CO edits it. */
export function buildMemoHeader(input: BuildMemoInput): MemoHeader {
  const org = String(input.acquisition["branch_code"] ?? input.acquisition["org_code"] ?? "").trim();
  const pr = String(input.acquisition["pr_number"] ?? "").trim();
  const title = String(input.acquisition["title"] ?? "").trim();
  const subject = `${input.templateName} — ${title}${pr ? ` — PR ${pr}` : ""}`;
  const refs = input.documentCitation
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean);
  return {
    centerName: input.centerName,
    centerAddress: input.centerAddress,
    date: formatMemoDate(input.today),
    replyTo: org,
    // The market research memorandum and the commerciality determination are
    // addressed to the contract file: nothing is approved outside the file.
    to: fileAddressed(input.templateKey)
      ? `Contract File ${pr || String(input.acquisition["acquisition_id"] ?? "")}`
      : (input.routing?.approving_official_title ?? "Contract File"),
    thru: fileAddressed(input.templateKey) ? [] : (input.routing?.thru_chain ?? []).filter(Boolean),
    from: `${input.coName}, Contracting Officer${org ? `, ${org}` : ""}`,
    subject,
    ref: refs,
    salutation: "",
    signatureName: input.coName,
    signatureTitle: "Contracting Officer",
    concurrence: input.approvals
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((a) => ({ name: a.name ?? "", title: a.role })),
    enclosures: input.enclosures ?? [],
    distribution: [`Contract File ${pr || String(input.acquisition["acquisition_id"] ?? "")}`],
    cc: [],
    cui: false,
  };
}

export type MemoDoc = {
  header: MemoHeader;
  /** Numbered body paragraphs, in the order they are read. */
  paragraphs: string[];
  badgeLine: string;
  title: string;
};

/**
 * The body of a memorandum is the rendered document turned into numbered
 * paragraphs: one paragraph per section, its heading leading the sentence.
 */
export function memoParagraphs(doc: RenderedDoc): string[] {
  return doc.blocks
    .filter((b) => !b.heading.startsWith("Signatures"))
    .map((b) => {
      const text = b.lines
        .map((l) => l.trim())
        .filter((l) => l && !l.endsWith(": —"))
        .join(" ");
      return `${b.heading}. ${text}`.trim();
    })
    .filter((p) => p.length > 2);
}

export function buildMemoDoc(doc: RenderedDoc, header: MemoHeader): MemoDoc {
  return { header, paragraphs: memoParagraphs(doc), badgeLine: doc.badgeLine, title: doc.title };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** PDF export in the 1858 layout, through the browser print dialog. */
export function exportMemoPdf(memo: MemoDoc, headerLine: string): boolean {
  const h = memo.header;
  const line = (label: string, value: string) =>
    `<div class="row"><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span></div>`;
  const rows = [
    line("TO:", h.to),
    ...h.thru.map((t, i) => line(i === 0 ? "THRU:" : "", t)),
    line("FROM:", h.from),
    line("SUBJECT:", h.subject),
    ...h.ref.map((r, i) => line(i === 0 ? "REF:" : "", r)),
  ].join("");
  const cover = h.cui
    ? `<section class="cover">${CUI_SHEET_TEXT.split("\n")
        .map((p) => `<p>${esc(p)}</p>`)
        .join("")}</section><div class="break"></div>`
    : "";
  const concurrence = h.concurrence.length
    ? `<section class="tail"><p class="tail-head">CONCURRENCE:</p>${h.concurrence
        .map(
          (c) =>
            `<p class="sigline">______________________________&nbsp;&nbsp;&nbsp;Date: __________</p><p>${esc(
              [c.name, c.title].filter(Boolean).join(", "),
            )}</p>`,
        )
        .join("")}</section>`
    : "";
  const list = (label: string, items: string[], numbered: boolean) =>
    items.length
      ? `<section class="tail"><p class="tail-head">${esc(label)}</p>${
          numbered
            ? `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`
            : items.map((i) => `<p>${esc(i)}</p>`).join("")
        }</section>`
      : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(memo.title)}</title>
<style>
  @page { margin: 25mm 25mm 20mm 25mm; }
  body { font-family: "Times New Roman", Times, serif; color: #000; background: #fff; font-size: 12pt; line-height: 1.35; }
  .banner { text-align: center; font-weight: bold; letter-spacing: 2px; font-size: 11pt; margin-bottom: 10px; }
  .letterhead { font-size: 10pt; line-height: 1.2; margin-bottom: 28px; }
  .letterhead .agency { font-weight: bold; }
  .datebox { margin-bottom: 18px; }
  .replyto { margin-bottom: 22px; }
  .row { display: flex; gap: 0; margin-bottom: 4px; font-weight: bold; }
  .label { width: 90px; flex: 0 0 90px; }
  .value { flex: 1; }
  .body { margin-top: 20px; }
  .body p { margin: 0 0 12px 0; text-align: left; }
  .sig { margin-top: 36px; }
  .tail { margin-top: 22px; break-inside: avoid; }
  .tail-head { font-weight: bold; margin-bottom: 6px; }
  .sigline { margin: 14px 0 0 0; }
  ol { margin: 0; padding-left: 20px; }
  .cover { font-size: 12pt; }
  .break { page-break-after: always; }
  footer { margin-top: 28px; font-size: 9pt; }
</style></head><body>
${cover}
${h.cui ? `<p class="banner">${esc(CUI_BANNER)}</p>` : ""}
<div class="letterhead"><div class="agency">${esc(AGENCY_LINE)}</div><div>${esc(h.centerName)}</div><div>${esc(
    h.centerAddress,
  )}</div></div>
<div class="datebox">${esc(h.date)}</div>
<div class="replyto">Reply to Attn of:&nbsp;&nbsp;${esc(h.replyTo)}</div>
${rows}
${h.salutation ? `<p>${esc(h.salutation)}</p>` : ""}
<div class="body">${memo.paragraphs.map((p, i) => `<p>${i + 1}. ${esc(p)}</p>`).join("")}</div>
<div class="sig"><p>${esc(h.signatureName)}</p><p>${esc(h.signatureTitle)}</p></div>
${concurrence}
${list("Enclosures:", h.enclosures, true)}
${list("Distribution:", h.distribution, false)}
${list("cc:", h.cc, false)}
${h.cui ? `<p class="banner">${esc(CUI_BANNER)}</p>` : ""}
<footer><p>${esc(headerLine)}</p><p>${esc(memo.badgeLine)}</p><p>Prototype. Not an official NASA system.</p></footer>
<script>window.onload = function () { window.print(); }<\/script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

/** Word export in the 1858 layout. */
export async function exportMemoDocx(memo: MemoDoc, fileName: string) {
  const { Document, Packer, Paragraph, TextRun, TabStopType, PageBreak } = await import("docx");
  const h = memo.header;
  const serif = { font: "Times New Roman", size: 24 } as const;
  const small = { font: "Times New Roman", size: 20 } as const;
  const p = (text: string, opts: { bold?: boolean; size?: number; after?: number; center?: boolean } = {}) =>
    new Paragraph({
      ...(opts.center ? { alignment: "center" as const } : {}),
      spacing: { after: opts.after ?? 120 },
      children: [new TextRun({ ...serif, ...(opts.size ? { size: opts.size } : {}), text, bold: opts.bold ?? false })],
    });
  const labelled = (label: string, value: string) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.LEFT, position: 1440 }],
      spacing: { after: 60 },
      children: [new TextRun({ ...serif, bold: true, text: `${label}\t${value}` })],
    });

  const children: InstanceType<typeof Paragraph>[] = [];
  if (h.cui) {
    for (const part of CUI_SHEET_TEXT.split("\n")) children.push(p(part, { after: 200 }));
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(p(CUI_BANNER, { bold: true, center: true }));
  }
  children.push(
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ ...small, bold: true, text: AGENCY_LINE })] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ ...small, text: h.centerName })] }),
    new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ ...small, text: h.centerAddress })] }),
    p(h.date, { after: 240 }),
    p(`Reply to Attn of:  ${h.replyTo}`, { after: 280 }),
    labelled("TO:", h.to),
  );
  h.thru.forEach((t, i) => children.push(labelled(i === 0 ? "THRU:" : "", t)));
  children.push(labelled("FROM:", h.from), labelled("SUBJECT:", h.subject));
  h.ref.forEach((r, i) => children.push(labelled(i === 0 ? "REF:" : "", r)));
  if (h.salutation) children.push(p(h.salutation, { after: 200 }));
  children.push(p("", { after: 120 }));
  memo.paragraphs.forEach((text, i) => children.push(p(`${i + 1}. ${text}`, { after: 200 })));
  children.push(p("", { after: 400 }), p(h.signatureName), p(h.signatureTitle, { after: 240 }));
  if (h.concurrence.length) {
    children.push(p("CONCURRENCE:", { bold: true }));
    for (const c of h.concurrence) {
      children.push(p("______________________________   Date: __________", { after: 40 }));
      children.push(p([c.name, c.title].filter(Boolean).join(", "), { after: 160 }));
    }
  }
  if (h.enclosures.length) {
    children.push(p("Enclosures:", { bold: true, after: 60 }));
    h.enclosures.forEach((e, i) => children.push(p(`${i + 1}. ${e}`, { after: 40 })));
  }
  if (h.distribution.length) {
    children.push(p("Distribution:", { bold: true, after: 60 }));
    h.distribution.forEach((d) => children.push(p(d, { after: 40 })));
  }
  if (h.cc.length) {
    children.push(p("cc:", { bold: true, after: 60 }));
    h.cc.forEach((c) => children.push(p(c, { after: 40 })));
  }
  if (h.cui) children.push(p(CUI_BANNER, { bold: true, center: true }));
  children.push(p("Prototype. Not an official NASA system.", { size: 18 }));

  const document = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24, color: "000000" } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1152, left: 1440 } },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
