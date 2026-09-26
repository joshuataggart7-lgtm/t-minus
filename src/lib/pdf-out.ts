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
  /**
   * Points of room that must remain below this block. A signature block, a
   * certification block or the opening line of a numbered paragraph is never
   * left alone at the foot of a page.
   */
  keepWith?: number;
  /**
   * Keep-with-previous: when this block's keepWith pushes it to a new page,
   * the last body paragraph before it moves too (or at least its last two
   * lines), so a signature never opens a page on its own.
   */
  keepWithPrevious?: boolean;
};

export type PdfOptions = {
  fileName: string;
  headerLine?: string;
  footer?: string[];
  prototype?: boolean;
  margins?: { top: number; right: number; bottom: number; left: number };
  /**
   * Agency insignia on the first page only, as the official blank places it.
   * Continuation pages carry no letterhead.
   */
  insignia?: { url: string; width: number; height: number };
  /** Running head printed at the top of page 2 onward. */
  runningHead?: string;
};

const PAGE = { width: 612, height: 792, margin: 72 };

/** PDF output only. Screen text is never passed through this. */
export function pdfGlyphs(text: string): string {
  return text
    .replace(/\u2212/g, "-")
    .replace(/\u2265/g, ">=").replace(/\u2264/g, "<=").replace(/\u2260/g, "!=")
    .replace(/\u2192/g, "->").replace(/\u2194/g, "<->")
    .replace(/\u2026/g, "...").replace(/\u00A0/g, " ")
    .replace(/\u2022/g, "-");
}

const sanitize = (text: string) =>
  pdfGlyphs(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00B7/g, "-")
    .replace(/[^\x20-\x7E\u00A7]/g, " ");

export async function renderPdf(blocks: PdfBlock[], options: PdfOptions): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const roman = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const margins = options.margins ?? { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin };
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - margins.top;
  const maxWidth = PAGE.width - margins.left - margins.right;

  // The insignia is fetched once and drawn on the first page only, at the
  // position the official blank uses.
  let insignia: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (options.insignia) {
    try {
      const res = await fetch(options.insignia.url);
      if (res.ok) insignia = await doc.embedPng(await res.arrayBuffer());
    } catch {
      insignia = null;
    }
  }
  if (insignia && options.insignia) {
    const { width, height } = options.insignia;
    page.drawImage(insignia, {
      x: PAGE.width - margins.right - width,
      y: PAGE.height - margins.top - height,
      width,
      height,
    });
  }

  const drawFooter = (target: typeof page, pageNumber: number, totalPages: number) => {
    const footer = options.footer ?? [];
    let fy = 30 + 10 * footer.length;
    for (const line of footer) {
      target.drawText(sanitize(line).slice(0, 150), {
        x: margins.left,
        y: fy,
        size: 8,
        font: roman,
        color: rgb(0.25, 0.25, 0.25),
      });
      fy -= 10;
    }
    if (options.prototype !== false) {
      target.drawText("Prototype, synthetic data", { x: margins.left, y: 30, size: 8, font: roman, color: rgb(0.45, 0.45, 0.45) });
    }
    // Page count sits at the right margin, opposite the prototype note.
    const pageText = `Page ${pageNumber} of ${totalPages}`;
    target.drawText(pageText, {
      x: PAGE.width - margins.right - roman.widthOfTextAtSize(pageText, 9),
      y: 30,
      size: 9,
      font: roman,
      color: rgb(0.25, 0.25, 0.25),
    });
  };

  const drawHeaderLine = (target: typeof page) => {
    if (!options.headerLine) return;
    target.drawText(sanitize(options.headerLine).slice(0, 150), {
      x: margins.left,
      y: PAGE.height - 24,
      size: 8,
      font: roman,
      color: rgb(0.25, 0.25, 0.25),
    });
  };

  drawHeaderLine(page);

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - margins.top;
    drawHeaderLine(page);
    // A continuation page carries no letterhead: the subject line only.
    if (options.runningHead) {
      const head = sanitize(options.runningHead);
      page.drawText(head.slice(0, 120), { x: margins.left, y, size: 10, font: roman, color: rgb(0.25, 0.25, 0.25) });
      y -= 26;
    }
  };

  const wrap = (block: PdfBlock) => {
    const size = block.size ?? 12;
    const font = block.bold ? bold : roman;
    const width = maxWidth - (block.indent ?? 0);
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
    return lines;
  };
  const wrapped = blocks.map(wrap);

  // Dry run of the same flow, with no drawing, to find a keep-with-previous
  // block that would open a page alone. Only then is a break added before
  // the last body paragraph (or its last two lines). When nothing triggers,
  // the drawn output is exactly the flow without this rule.
  const topY = PAGE.height - margins.top;
  const contY = topY - (options.runningHead ? 26 : 0);
  const forced = new Map<number, number>();
  if (blocks.some((b) => b.keepWithPrevious)) {
    let dy = topY;
    let pageNo = 1;
    const startPage: number[] = [];
    const dryNew = () => {
      dy = contY;
      pageNo += 1;
    };
    blocks.forEach((block, i) => {
      const size = block.size ?? 12;
      if (block.pageBreakBefore) dryNew();
      if (block.keepWith && dy - block.keepWith < margins.bottom + 18) {
        const before = pageNo;
        dryNew();
        if (block.keepWithPrevious && forced.size === 0) {
          let j = i - 1;
          while (j >= 0 && !blocks[j]!.text.trim()) j -= 1;
          if (j >= 0 && startPage[j] !== undefined && startPage[j]! <= before) {
            const lineH = (blocks[j]!.size ?? 12) * 1.35;
            const capacity = Math.floor((contY - (margins.bottom + 18)) / lineH);
            const n = wrapped[j]!.length;
            forced.set(j, n <= capacity - 4 ? 0 : Math.max(0, n - 2));
          }
        }
      }
      startPage[i] = pageNo;
      for (let k = 0; k < wrapped[i]!.length; k += 1) {
        if (dy < margins.bottom + 18) dryNew();
        dy -= size * 1.35;
      }
      dy -= block.gap ?? 6;
    });
  }

  blocks.forEach((block, bi) => {
    const size = block.size ?? 12;
    const font = block.bold ? bold : roman;
    const indent = block.indent ?? 0;
    if (block.pageBreakBefore) newPage();
    if (forced.get(bi) === 0) newPage();
    if (block.keepWith && y - block.keepWith < margins.bottom + 18) newPage();
    const lines = wrapped[bi]!;
    const breakAt = forced.get(bi) ?? -1;
    lines.forEach((text, li) => {
      if (li > 0 && li === breakAt) newPage();
      if (y < margins.bottom + 18) newPage();
      const x = block.center
        ? (PAGE.width - font.widthOfTextAtSize(text, size)) / 2
        : margins.left + indent;
      page.drawText(text, { x, y, size, font });
      y -= size * 1.35;
    });
    y -= block.gap ?? 6;
  });
  const pages = doc.getPages();
  pages.forEach((target, index) => drawFooter(target, index + 1, pages.length));

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
  // The blank writes its file identifier as /ID[<hex><hex>] with no spaces
  // inside the brackets; the update keeps that exact shape.
  const idArray = trailer.ID instanceof PDFArray ? trailer.ID : null;
  const id = idArray
    ? `[${idArray.asArray().map((entry) => entry.toString()).join("")}]`
    : trailer.ID
      ? String(trailer.ID)
      : "";

  // A Reader-extended blank carries usage rights (/Perms → /UR3). Appending an
  // update leaves those rights pointing at bytes that have changed, and free
  // Adobe Reader treats the file as tampered: it closes the document or shows a
  // blank face. The update therefore writes a fresh catalog with every key of
  // the original except /Perms, and points the trailer root at it. Values are
  // copied raw, so nested references stay references.
  const hasPerms = doc.catalog.has(PDFName.of("Perms"));

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
  const nextNumber = Math.max(doc.context.largestObjectNumber + 1, Number.isFinite(prevSize) ? prevSize : 0);

  const rows = [{ num: datasetsRef.objectNumber, at: dataOffset }];

  let catalogNumber = 0;
  if (hasPerms) {
    const body = doc.catalog
      .entries()
      .filter(([key]) => key.asString() !== "/Perms")
      .map(([key, value]) => `${key.asString()} ${value.toString()}`)
      .join("\n");
    catalogNumber = nextNumber;
    const catalogBytes = ascii(`${catalogNumber} 0 obj\n<<\n${body}\n>>\nendobj\n`);
    rows.push({ num: catalogNumber, at: offset });
    parts.push(catalogBytes);
    offset += catalogBytes.length;
  }

  const xrefNumber = hasPerms ? nextNumber + 1 : nextNumber;
  const xrefOffset = offset;
  rows.push({ num: xrefNumber, at: xrefOffset });
  rows.sort((a, b) => a.num - b.num);
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
  const root = hasPerms ? `${catalogNumber} 0 R` : `${rootRef.objectNumber} ${rootRef.generationNumber} R`;
  const dict =
    `<< /Type /XRef /Size ${xrefNumber + 1} /Index [${index}] /W [1 4 2] /Root ${root}` +
    (infoRef ? ` /Info ${infoRef.objectNumber} ${infoRef.generationNumber} R` : "") +
    (id ? ` /ID${id}` : "") +
    ` /Prev ${prev} /Length ${entries.length} >>`;
  parts.push(ascii(`${xrefNumber} 0 obj\n${dict}\nstream\n`), entries, ascii("\nendstream\nendobj\n"));
  parts.push(ascii(`startxref\n${xrefOffset}\n%%EOF\n`));

  return concat(parts);
}

/** Was the blank Reader-extended (usage rights, /Perms → /UR3)? */
export function hasUsageRights(original: Uint8Array): boolean {
  return new TextDecoder("latin1").decode(original).includes("/Perms");
}

/**
 * Writes the filled form. Where the blank was Reader-extended, a companion
 * .xdp is written with the same values, so Import Data always has a file even
 * if a reader still refuses the filled PDF. Returns true when the companion
 * was written.
 */
export async function exportXfaIncremental(
  pdfUrl: string,
  datasetsXml: string,
  fileName: string,
): Promise<boolean> {
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error(`The blank form did not load (${response.status}).`);
  const original = new Uint8Array(await response.arrayBuffer());
  const extended = hasUsageRights(original);
  const bytes = await buildXfaIncremental(original, datasetsXml);
  download(bytes, fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`, "application/pdf");
  if (extended) exportXdp(datasetsXml, fileName.replace(/\.pdf$/i, ""));
  return extended;
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
