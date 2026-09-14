/**
 * PDF output without the browser print dialog.
 *
 * Documents are drawn with pdf-lib so the exported file carries no browser
 * header, footer or URL line. The page footer is drawn by this module, so the
 * file identifier, the citation and the prototype notice sit at the foot of
 * every page rather than inside the document body.
 */

export type PdfBlock = {
  text: string;
  bold?: boolean;
  size?: number;
  /** Left indent in points. */
  indent?: number;
  /** Space after the block in points. */
  gap?: number;
  center?: boolean;
  pageBreakBefore?: boolean;
};

export type PdfOptions = {
  fileName: string;
  /** One line per footer row, drawn small at the foot of every page. */
  footer: string[];
};

const PAGE = { width: 612, height: 792, margin: 72 };

const sanitize = (text: string) =>
  text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00B7/g, "-")
    .replace(/[^\x20-\x7E]/g, " ");

export async function renderPdf(blocks: PdfBlock[], options: PdfOptions): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const roman = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const maxWidth = PAGE.width - PAGE.margin * 2;

  const drawFooter = (target: typeof page) => {
    let fy = PAGE.margin - 28;
    for (const line of options.footer) {
      target.drawText(sanitize(line).slice(0, 150), {
        x: PAGE.margin,
        y: fy,
        size: 8,
        font: roman,
        color: rgb(0.25, 0.25, 0.25),
      });
      fy -= 10;
    }
  };

  const newPage = () => {
    drawFooter(page);
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };

  for (const block of blocks) {
    const size = block.size ?? 12;
    const font = block.bold ? bold : roman;
    const indent = block.indent ?? 0;
    const width = maxWidth - indent;
    if (block.pageBreakBefore) newPage();
    const words = sanitize(block.text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line || !words.length) lines.push(line);
    for (const text of lines) {
      if (y < PAGE.margin + 10) newPage();
      const x = block.center
        ? (PAGE.width - font.widthOfTextAtSize(text, size)) / 2
        : PAGE.margin + indent;
      page.drawText(text, { x, y, size, font });
      y -= size * 1.35;
    }
    y -= block.gap ?? 6;
  }
  drawFooter(page);

  const bytes = await doc.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = options.fileName.endsWith(".pdf") ? options.fileName : `${options.fileName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function download(bytes: Uint8Array | string, fileName: string, type: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

const ascii = (text: string) => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

const concat = (parts: Uint8Array[]) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/**
 * The original form file with only its xfa:datasets packet replaced, written
 * as an incremental update. The bytes of the original file are untouched, so
 * Adobe Reader still opens the form, including its usage rights, and shows the
 * values in the fields. Rewriting the file with a PDF library instead breaks
 * dynamic XFA forms in Reader, which is why the original bytes are preserved.
 */
export async function buildXfaIncremental(original: Uint8Array, datasetsXml: string): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString } = await import("pdf-lib");

  const doc = await PDFDocument.load(original);
  const acro = doc.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
  const xfa = acro.lookup(PDFName.of("XFA"), PDFArray);

  let datasetsRef: import("pdf-lib").PDFRef | null = null;
  for (let i = 0; i < xfa.size() - 1; i += 1) {
    const entry = xfa.get(i);
    const name =
      entry instanceof PDFString || entry instanceof PDFHexString ? entry.decodeText() : String(entry);
    if (name === "datasets") {
      const next = xfa.get(i + 1);
      if (next instanceof PDFRef) datasetsRef = next;
      break;
    }
  }
  if (!datasetsRef) throw new Error("This form does not carry an XFA data section.");

  const tail = new TextDecoder("latin1").decode(original.slice(-2048));
  const marker = tail.lastIndexOf("startxref");
  const prev = marker < 0 ? NaN : Number.parseInt(tail.slice(marker + 9).trim(), 10);
  if (!Number.isFinite(prev)) throw new Error("This form does not carry a cross-reference table.");

  const trailer = doc.context.trailerInfo as { Root?: unknown; Info?: unknown; ID?: unknown };
  const rootRef = trailer.Root;
  if (!(rootRef instanceof PDFRef)) throw new Error("This form does not name a document root.");
  const infoRef = trailer.Info instanceof PDFRef ? trailer.Info : null;
  const id = trailer.ID ? String(trailer.ID) : "";

  const xml = new TextEncoder().encode(datasetsXml);
  const parts: Uint8Array[] = [original, ascii("\n")];
  let offset = original.length + 1;

  const dataHeader = ascii(
    `${datasetsRef.objectNumber} ${datasetsRef.generationNumber} obj\n<< /Length ${xml.length} >>\nstream\n`,
  );
  const dataFooter = ascii("\nendstream\nendobj\n");
  const dataOffset = offset;
  parts.push(dataHeader, xml, dataFooter);
  offset += dataHeader.length + xml.length + dataFooter.length;

  // A plain, uncompressed cross-reference stream listing only the two objects
  // this update writes.
  // The new object number must clear every number already used, including the
  // objects the previous cross-reference stream reports.
  const prevDict = new TextDecoder("latin1").decode(original.slice(prev, prev + 600));
  const prevSize = Number.parseInt(/\/Size\s+(\d+)/.exec(prevDict)?.[1] ?? "0", 10);
  const xrefNumber = Math.max(doc.context.largestObjectNumber + 1, Number.isFinite(prevSize) ? prevSize : 0);
  const xrefOffset = offset;
  const rows = [
    { num: datasetsRef.objectNumber, at: dataOffset },
    { num: xrefNumber, at: xrefOffset },
  ].sort((a, b) => a.num - b.num);
  const entries = new Uint8Array(rows.length * 7);
  rows.forEach((row, i) => {
    const at = i * 7;
    entries[at] = 1;
    entries[at + 1] = (row.at >>> 24) & 0xff;
    entries[at + 2] = (row.at >>> 16) & 0xff;
    entries[at + 3] = (row.at >>> 8) & 0xff;
    entries[at + 4] = row.at & 0xff;
    entries[at + 5] = 0;
    entries[at + 6] = 0;
  });
  const index = rows.map((r) => `${r.num} 1`).join(" ");
  const dict =
    `<< /Type /XRef /Size ${xrefNumber + 1} /Index [${index}] /W [1 4 2] /Root ${rootRef.objectNumber} ${rootRef.generationNumber} R` +
    (infoRef ? ` /Info ${infoRef.objectNumber} ${infoRef.generationNumber} R` : "") +
    (id ? ` /ID ${id}` : "") +
    ` /Prev ${prev} /Length ${entries.length} >>`;
  parts.push(ascii(`${xrefNumber} 0 obj\n${dict}\nstream\n`), entries, ascii("\nendstream\nendobj\n"));
  parts.push(ascii(`startxref\n${xrefOffset}\n%%EOF\n`));

  return concat(parts);
}

export async function exportXfaIncremental(
  pdfUrl: string,
  datasetsXml: string,
  fileName: string,
): Promise<void> {
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error(`The blank form did not load (${response.status}).`);
  const bytes = await buildXfaIncremental(new Uint8Array(await response.arrayBuffer()), datasetsXml);
  download(bytes, fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`, "application/pdf");
}

/**
 * The same values as an XDP data file. In Adobe Reader the CO opens the blank
 * form and uses Import Data, which is the supported route when a reader will
 * not accept an edited form file.
 */
export function exportXdp(datasetsXml: string, fileName: string): void {
  const datasets = datasetsXml.replace(/^<\?xml[^>]*\?>/, "").trim();
  const xdp = `<?xml version="1.0" encoding="UTF-8"?>\n<?xfa generator="T-Minus" APIVersion="1.0"?>\n<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/">\n${datasets}\n</xdp:xdp>\n`;
  download(xdp, fileName.endsWith(".xdp") ? fileName : `${fileName}.xdp`, "application/vnd.adobe.xdp+xml");
}
