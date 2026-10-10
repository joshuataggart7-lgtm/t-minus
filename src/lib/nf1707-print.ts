/**
 * NF 1707 (03/25) print rendition. The official blank is a dynamic XFA form
 * that only Adobe Reader can draw, so the contract-file print is laid out
 * after it here: the agency head and title, the header grid (Center,
 * requisition number, requisitioning organization, description, approver
 * approval and date), then Sections 1 to 12 in the form's order, each with
 * every statement the form prints and a box that is checked only when the
 * file's answers check it. Signature lines stay empty.
 */

import { NF1707_CELL_TEXT, NF1707_SECTION_TITLES, nf1707SectionOf } from "@/lib/nf1707-cells";
import { pdfGlyphs } from "@/lib/pdf-out";

export type Nf1707PrintInput = {
  center: string;
  purchaseType: string;
  reqNumber: string;
  reqOrg: string;
  description: string;
  approvedDate?: string;
  /** Stored cell answers keyed "Section.Subform.Field". */
  answers: Record<string, string>;
  /** Signature blocks the answers call for, by name, with their status. */
  signoffs: { name: string; label: string | null }[];
  acquisitionId: string;
};

/** Cells that carry a typed value rather than a check. */
const TEXT_CELLS = new Set([
  "MandatoryContractNum",
  "CITRAuth",
  "ORCAAuth",
  "NoITAuth",
  "S3n3n1Info",
  "S6IVn1Input",
  "CertificateInput",
]);

type Statement = { leaf: string; text: string; section: number };

/** The form's statements, section by section, in the order the form prints them. */
export function nf1707Statements(): Map<number, Statement[]> {
  const out = new Map<number, Statement[]>();
  for (const [key, text] of Object.entries(NF1707_CELL_TEXT)) {
    const n = nf1707SectionOf(key);
    if (!n) continue;
    const leaf = key.split(".").pop()!;
    out.set(n, [...(out.get(n) ?? []), { leaf, text, section: n }]);
  }
  return out;
}

/** The answer for one statement: matched by section number and field name. */
function answerFor(answers: Record<string, string>, section: number, leaf: string): string {
  for (const [k, v] of Object.entries(answers)) {
    if (nf1707SectionOf(k) !== section) continue;
    if (k.split(".").pop() === leaf && String(v ?? "").trim()) return String(v).trim();
  }
  return "";
}

export async function renderNf1707PrintPdf(input: Nf1707PrintInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`NF 1707 ${input.acquisitionId}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const H = 792;
  const M = 36;
  const inner = W - 2 * M;
  const black = rgb(0, 0, 0);
  const grey = rgb(0.85, 0.85, 0.85);
  const pages: ReturnType<typeof pdf.addPage>[] = [];
  let page = pdf.addPage([W, H]);
  pages.push(page);
  let y = H - M;
  const T = (s: string) => pdfGlyphs(s);

  const wrap = (text: string, size: number, width: number, f = font): string[] => {
    const words = T(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };
  const newPage = () => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    y = H - M;
  };
  const need = (h: number) => {
    if (y - h < M + 28) newPage();
  };
  const box = (x: number, top: number, w: number, h: number) =>
    page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: black, borderWidth: 0.6 });

  // Agency head and title, as on the form.
  page.drawText("National Aeronautics and Space Administration", { x: M, y: y - 8, size: 8, font });
  page.drawText("NF 1707", { x: W - M - bold.widthOfTextAtSize("NF 1707", 9), y: y - 8, size: 9, font: bold });
  y -= 24;
  const title = "SPECIAL APPROVALS AND AFFIRMATIONS OF REQUISITIONS";
  page.drawText(title, { x: (W - bold.widthOfTextAtSize(title, 13)) / 2, y, size: 13, font: bold });
  y -= 12;

  // Header grid.
  const cell = (x: number, top: number, w: number, h: number, caption: string, value: string, size = 10) => {
    box(x, top, w, h);
    page.drawText(T(caption), { x: x + 3, y: top - 9, size: 7, font });
    const lines = wrap(value || " ", size, w - 8);
    lines.slice(0, Math.max(1, Math.floor((h - 12) / (size + 2)))).forEach((l, i) =>
      page.drawText(l, { x: x + 4, y: top - 12 - size - i * (size + 2) + 2, size, font }),
    );
  };
  const c1 = 150;
  const c2 = 190;
  cell(M, y, c1, 30, "Center", input.center);
  cell(M + c1, y, c2, 30, input.purchaseType || "Requisition Number", input.reqNumber);
  cell(M + c1 + c2, y, inner - c1 - c2, 30, "Requisitioning Organization", input.reqOrg);
  y -= 30;
  const descLines = wrap(input.description || " ", 10, inner - 8);
  const descH = Math.max(30, 16 + descLines.length * 12);
  cell(M, y, inner, descH, "Description of Requirement", input.description);
  y -= descH;
  cell(M, y, inner - 190, 30, "Approver Approval (signature)", "");
  cell(M + inner - 190, y, 90, 30, "Date", input.approvedDate ?? "");
  cell(M + inner - 100, y, 100, 30, "Other Centers Impacted", "No");
  y -= 40;

  // Sections 1 to 12.
  const statements = nf1707Statements();
  for (let n = 1; n <= 12; n += 1) {
    const heading = (NF1707_SECTION_TITLES[n] ?? `Section ${n}`).replace(/^Section (\d+)\.\s*/, "SECTION $1 - ").toUpperCase();
    need(40);
    page.drawRectangle({ x: M, y: y - 14, width: inner, height: 14, color: grey, borderColor: black, borderWidth: 0.6 });
    page.drawText(T(heading), { x: M + 4, y: y - 10.5, size: 8.5, font: bold });
    y -= 18;
    for (const st of statements.get(n) ?? []) {
      const value = answerFor(input.answers, n, st.leaf);
      if (TEXT_CELLS.has(st.leaf)) {
        const lines = wrap(`${st.text}: ${value || "________________"}`, 8.5, inner - 30);
        need(lines.length * 10.5 + 2);
        lines.forEach((l, i) => page.drawText(l, { x: M + 22, y: y - 8 - i * 10.5, size: 8.5, font }));
        y -= lines.length * 10.5 + 3;
        continue;
      }
      const checked = value === "1" || value === "true" || value === "yes";
      const lines = wrap(st.text, 8.5, inner - 30);
      need(lines.length * 10.5 + 2);
      page.drawRectangle({ x: M + 6, y: y - 8.5, width: 8, height: 8, borderColor: black, borderWidth: 0.6 });
      if (checked) {
        page.drawLine({ start: { x: M + 6.8, y: y - 7.7 }, end: { x: M + 13.2, y: y - 1.3 }, thickness: 0.9, color: black });
        page.drawLine({ start: { x: M + 6.8, y: y - 1.3 }, end: { x: M + 13.2, y: y - 7.7 }, thickness: 0.9, color: black });
      }
      lines.forEach((l, i) => page.drawText(l, { x: M + 22, y: y - 8 - i * 10.5, size: 8.5, font: checked ? bold : font }));
      y -= lines.length * 10.5 + 3;
    }
    y -= 6;
  }

  // Signature, concurrence and approval blocks the answers call for. The
  // approver's block is already in the header grid, as on the form.
  const signoffs = input.signoffs.filter((s) => !/^Approver Approval$/i.test(s.name.trim()));
  need(30 + signoffs.length * 26);
  page.drawRectangle({ x: M, y: y - 14, width: inner, height: 14, color: grey, borderColor: black, borderWidth: 0.6 });
  page.drawText("SIGNATURES, CONCURRENCES AND APPROVALS", { x: M + 4, y: y - 10.5, size: 8.5, font: bold });
  y -= 22;
  if (!signoffs.length) {
    page.drawText("No concurrence or approval block applies to the answers on this file.", { x: M + 6, y: y - 8, size: 8.5, font });
    y -= 14;
  }
  for (const s of signoffs) {
    need(26);
    page.drawText(T(s.name), { x: M + 6, y: y - 8, size: 8.5, font });
    page.drawLine({ start: { x: M + 250, y: y - 10 }, end: { x: M + 430, y: y - 10 }, thickness: 0.6, color: black });
    page.drawText("Signature", { x: M + 250, y: y - 18, size: 6.5, font });
    page.drawLine({ start: { x: M + 445, y: y - 10 }, end: { x: W - M, y: y - 10 }, thickness: 0.6, color: black });
    page.drawText("Date", { x: M + 445, y: y - 18, size: 6.5, font });
    if (s.label) page.drawText(T(s.label), { x: M + 6, y: y - 18, size: 6.5, font });
    y -= 26;
  }

  // Footer on every page.
  pages.forEach((p, i) => {
    p.drawText("NF 1707 (03/25)", { x: M, y: M - 14, size: 7, font });
    const pg = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pg, { x: W - M - font.widthOfTextAtSize(pg, 7), y: M - 14, size: 7, font });
    const note = `${input.acquisitionId} · Print rendition of the official form from T-Minus. Prototype, not an official NASA system.`;
    const t = T(note);
    p.drawText(t, { x: (W - font.widthOfTextAtSize(t, 6.5)) / 2, y: M - 24, size: 6.5, font });
  });
  return pdf.save();
}
