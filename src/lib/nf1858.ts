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
  "memorandum-for-record",
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

/** Names for document types the template list does not name in full. */
const MEMO_DOCUMENT_NAMES: Record<string, string> = {
  "commercial-tm-lh": "Commercial T&M / labor-hour D&F",
  "economy-act": "Economy Act D&F",
  bundling: "Bundled requirements D&F",
  consolidation: "Consolidation D&F",
  jofoc: "Justification for other than full and open competition (JOFOC)",
};

/** Document types the routing table can address, named as the templates name them. */
export const MEMO_DOCUMENT_KEYS: { key: string; name: string }[] = [...DEFAULT_ON, "jofoc"]
  .sort()
  .map((key) => ({
    key,
    name:
      MEMO_DOCUMENT_NAMES[key] ??
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
  approvals?: ApprovalForMemo[];
  /** Reviewers who must concur, from the Approvals step of this file. */
  concurrence?: { name: string; title: string }[];
  enclosures?: string[];
  today: string;
};

/**
 * Documents that are filed rather than approved. They are addressed to the
 * contract file, with no Thru chain.
 */
const FILE_ADDRESSED = new Set(["market-research-memo", "commerciality", "memorandum-for-record"]);

const fileAddressed = (templateKey: string) => FILE_ADDRESSED.has(templateKey);

/**
 * A citation written as "A simplified, B part 15" carries both readings. The
 * Ref line prints the one the record's acquisition method calls for: the
 * simplified citation on FAR 13 and FAR 13.5 files, the Part 15 citation
 * otherwise.
 */
function oneCitation(ref: string, method: string): string {
  const pair = /^(.*?)\s*simplified,\s*(.*?)\s*part\s*15$/i.exec(ref);
  if (!pair) return ref;
  const simplified = /(^|[^\d.])13(\.5)?([^\d]|$)/.test(method) || /simplified/i.test(method);
  return String((simplified ? pair[1] : pair[2]) ?? ref).trim();
}

/** Prefilled header for a memorandum, before the CO edits it. */
export function buildMemoHeader(input: BuildMemoInput): MemoHeader {
  const org = String(input.acquisition["branch_code"] ?? input.acquisition["org_code"] ?? "").trim();
  const pr = String(input.acquisition["pr_number"] ?? "").trim();
  const title = String(input.acquisition["title"] ?? "").trim();
  const subject = `${input.templateName} — ${title}${pr ? ` — PR ${pr}` : ""}`;
  const method = String(input.acquisition["acquisition_method"] ?? "");
  const refs = input.documentCitation
    .split(";")
    .map((r) => oneCitation(r.trim(), method))
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
    // Concurrence on a memo comes only from the routing table's Thru chain
    // for this document type. NF 1707 sign-offs are not memo concurrers. An
    // empty chain means no concurrence block at all.
    // Concurrence comes from the Approvals step: the reviewers who must
    // concur on this file. The Thru chain is the routing path, not the
    // concurrence list, so it is never copied here.
    concurrence: fileAddressed(input.templateKey) ? [] : (input.concurrence ?? []),
    enclosures: input.enclosures ?? [],
    distribution: [`Contract File ${pr || String(input.acquisition["acquisition_id"] ?? "")}`],
    cc: [],
    cui: false,
  };
}

/**
 * One numbered paragraph. The record facts paragraph carries labeled lines,
 * one fact per line, rather than a run-on string.
 */
export type MemoParagraph = { text: string; lines: string[] };

export type MemoDoc = {
  header: MemoHeader;
  /** Numbered body paragraphs, in the order they are read. */
  paragraphs: MemoParagraph[];
  badgeLine: string;
  title: string;
};

/**
 * The body of a memorandum is the rendered document turned into numbered
 * paragraphs: one paragraph per section, its heading leading the sentence.
 * The record block is rendered as labeled lines so the facts read as facts.
 */
export function memoParagraphs(doc: RenderedDoc): MemoParagraph[] {
  // The numbered heading names the paragraph, so the field prompt that opens
  // the drafted text ("Purpose of this memorandum: ...") is dropped.
  const withoutPrompt = (line: string) => {
    const at = line.indexOf(": ");
    if (at < 0 || at > 80) return line;
    const prompt = line.slice(0, at);
    if (/[.!?]/.test(prompt)) return line;
    return line.slice(at + 2).trim();
  };
  return doc.blocks
    .filter((b) => !b.heading.startsWith("Signatures") && b.heading !== "Acquisition")
    .map((b) => {
      const lines = b.lines.map((l) => l.trim()).filter((l) => l && !l.endsWith(": —"));
      const prose = lines.map(withoutPrompt).filter((line) => line && line !== "—" && !/^\[.*\]$/.test(line));
      return { text: `${b.heading}. ${prose.join(" ")}`.trim(), lines: [] };
    })
    .filter((p) => p.text.length > 2 || p.lines.length > 0);
}

export function buildMemoDoc(doc: RenderedDoc, header: MemoHeader): MemoDoc {
  return { header, paragraphs: memoParagraphs(doc), badgeLine: doc.badgeLine, title: doc.title };
}

/**
 * PDF export in the 1858 layout. The file is drawn directly, so it carries no
 * browser header or footer, and the metadata sits in the page footer.
 */
export async function exportMemoPdf(memo: MemoDoc, _headerLine: string, fileName: string): Promise<void> {
  const h = memo.header;
  const blocks: PdfBlock[] = [];
  if (h.cui) {
    for (const part of CUI_SHEET_TEXT.split("\n")) blocks.push({ text: part, gap: 10 });
    blocks.push({ text: CUI_BANNER, bold: true, center: true, pageBreakBefore: true, gap: 12 });
  }
  blocks.push(
    { text: AGENCY_LINE, bold: true, size: 10, gap: 0 },
    { text: h.centerName, size: 10, gap: 0 },
    { text: h.centerAddress, size: 10, gap: 22 },
    { text: h.date, gap: 14 },
    { text: `Reply to Attn of:  ${h.replyTo}`, gap: 20 },
  );
  const labelled = (label: string, value: string) => ({ text: `${label.padEnd(10, " ")}${value}`, gap: 2 });
  blocks.push(labelled("TO:", h.to));
  h.thru.forEach((t, i) => blocks.push(labelled(i === 0 ? "THRU:" : "", t)));
  blocks.push(labelled("FROM:", h.from), labelled("SUBJECT:", h.subject));
  h.ref.forEach((r, i) => blocks.push(labelled(i === 0 ? "REF:" : "", r)));
  if (h.salutation) blocks.push({ text: h.salutation, gap: 10 });
  blocks.push({ text: "", gap: 8 });
  memo.paragraphs.forEach((p, i) => {
    blocks.push({ text: `${i + 1}. ${p.text}`, gap: p.lines.length ? 4 : 10 });
    for (const line of p.lines) blocks.push({ text: line, indent: 24, gap: 1 });
    if (p.lines.length) blocks.push({ text: "", gap: 6 });
  });
  blocks.push({ text: "", gap: 28 }, { text: h.signatureName, gap: 0 }, { text: h.signatureTitle, gap: 16 });
  if (h.concurrence.length) {
    blocks.push({ text: "CONCURRENCE:", bold: true, gap: 4 });
    for (const c of h.concurrence) {
      blocks.push({ text: "______________________________   Date: __________", gap: 2 });
      blocks.push({ text: [c.name, c.title].filter(Boolean).join(", "), gap: 10 });
    }
  }
  if (h.enclosures.length) {
    blocks.push({ text: "Enclosures:", bold: true, gap: 4 });
    h.enclosures.forEach((e, i) => blocks.push({ text: `${i + 1}. ${e}`, indent: 12, gap: 2 }));
  }
  if (h.distribution.length) {
    blocks.push({ text: "Distribution:", bold: true, gap: 4 });
    h.distribution.forEach((d) => blocks.push({ text: d, indent: 12, gap: 2 }));
  }
  if (h.cc.length) {
    blocks.push({ text: "cc:", bold: true, gap: 4 });
    h.cc.forEach((c) => blocks.push({ text: c, indent: 12, gap: 2 }));
  }
  if (h.cui) blocks.push({ text: CUI_BANNER, bold: true, center: true, gap: 0 });
  await renderPdf(blocks, {
    fileName,
    prototype: true,
  });
}

/** Word export in the 1858 layout. */
export async function exportMemoDocx(memo: MemoDoc, fileName: string, _footerLine = "") {
  const { Document, Packer, Paragraph, TextRun, TabStopType, PageBreak, Footer, PageNumber, AlignmentType } = await import("docx");
  const h = memo.header;
  const serif = { font: "Times New Roman", size: 24 } as const;
  const small = { font: "Times New Roman", size: 20 } as const;
  const p = (
    text: string,
    opts: { bold?: boolean; size?: number; after?: number; center?: boolean; keepNext?: boolean } = {},
  ) =>
    new Paragraph({
      ...(opts.center ? { alignment: "center" as const } : {}),
      ...(opts.keepNext ? { keepNext: true, keepLines: true } : {}),
      spacing: { after: opts.after ?? 120 },
      children: [new TextRun({ ...serif, ...(opts.size ? { size: opts.size } : {}), text, bold: opts.bold ?? false })],
    });
  const labelled = (label: string, value: string) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.LEFT, position: 1440 }],
      spacing: { after: 60 },
      children: [new TextRun({ ...serif, bold: true, text: label }), new TextRun({ ...serif, text: `\t${value}` })],
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
  memo.paragraphs.forEach((para, i) => {
    children.push(p(`${i + 1}. ${para.text}`, { after: para.lines.length ? 60 : 200 }));
    for (const line of para.lines) {
      children.push(
        new Paragraph({
          indent: { left: 720 },
          spacing: { after: 20 },
          children: [new TextRun({ ...serif, text: line })],
        }),
      );
    }
    if (para.lines.length) children.push(p("", { after: 140 }));
  });
  // Signature and Distribution stay together on the page when they fit.
  children.push(
    p("", { after: 400 }),
    p(h.signatureName, { keepNext: true }),
    p(h.signatureTitle, { after: 240, keepNext: true }),
  );
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
    children.push(p("Distribution:", { bold: true, after: 60, keepNext: true }));
    h.distribution.forEach((d) => children.push(p(d, { after: 40, keepNext: true })));
  }
  if (h.cc.length) {
    children.push(p("cc:", { bold: true, after: 60 }));
    h.cc.forEach((c) => children.push(p(c, { after: 40 })));
  }
  if (h.cui) children.push(p(CUI_BANNER, { bold: true, center: true }));
  // The metadata line belongs in the page footer, not in the Distribution block.
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        tabStops: [{ type: TabStopType.CENTER, position: 4680 }],
        spacing: { after: 0 },
        children: [
          new TextRun({ font: "Times New Roman", size: 16, color: "777777", text: "Prototype, synthetic data\t" }),
          new TextRun({ font: "Times New Roman", size: 18, text: "Page " }),
          new TextRun({ font: "Times New Roman", size: 18, children: [PageNumber.CURRENT] }),
          new TextRun({ font: "Times New Roman", size: 18, text: " of " }),
          new TextRun({ font: "Times New Roman", size: 18, children: [PageNumber.TOTAL_PAGES] }),
        ],
      }),
    ],
  });

  const document = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24, color: "000000" } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        footers: { default: footer },
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
