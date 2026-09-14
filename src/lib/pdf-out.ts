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

/**
 * The original XFA form, carrying the values as its data. Acrobat opens the
 * form with the fields populated; other readers show the blank form.
 */
export async function exportPopulatedXfa(pdfUrl: string, datasetsXml: string, fileName: string): Promise<void> {
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString } = await import("pdf-lib");
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error(`The blank form did not load (${response.status}).`);
  const doc = await PDFDocument.load(await response.arrayBuffer());
  const acro = doc.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
  const xfa = acro.lookup(PDFName.of("XFA"), PDFArray);
  const stream = doc.context.stream(new TextEncoder().encode(datasetsXml));
  const ref = doc.context.register(stream);
  let replaced = false;
  for (let i = 0; i < xfa.size() - 1; i += 1) {
    const entry = xfa.get(i);
    const name =
      entry instanceof PDFString || entry instanceof PDFHexString ? entry.decodeText() : String(entry);
    if (name === "datasets") {
      xfa.set(i + 1, ref);
      replaced = true;
      break;
    }
  }
  if (!replaced) throw new Error("This form does not carry an XFA data section.");
  acro.set(PDFName.of("NeedAppearances"), doc.context.obj(true));
  const bytes = await doc.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
