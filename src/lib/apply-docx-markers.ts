/**
 * Soft §5 — Word from a genuine NASA master.
 * Unzip the master, rewrite only word/document.xml, rezip with DEFLATE.
 * A marker with an empty value deletes its whole paragraph; otherwise the
 * marker run takes the value. Letterhead, styles, headers and footers are
 * never touched.
 */
import JSZip from "jszip";

const WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function findAncestorLocal(node: Node | null, name: string): Element | null {
  let n: Node | null = node;
  while (n && (n as Element).localName !== name) n = n.parentNode;
  return n && (n as Element).localName === name ? (n as Element) : null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A value written into a master never carries a raw ISO date; it reads as "March 15, 2027". */
function plainDates(text: string): string {
  return text.replace(/\b(20\d\d)-(\d\d)-(\d\d)\b(?!T)/g, (m, y: string, mo: string, d: string) => {
    const name = MONTHS[Number(mo) - 1];
    return name ? `${name} ${Number(d)}, ${y}` : m;
  });
}

/** Marker map: known [[TOKEN]] to value. Empty, null or undefined deletes the paragraph. */
export type MarkerMap = Record<string, string | null | undefined>;

/** Apply markers to a .docx. Only word/document.xml is rewritten. */
export async function applyMarkers(
  masterBytes: ArrayBuffer | Uint8Array,
  map: MarkerMap,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(masterBytes);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("The master is missing word/document.xml.");
  let xml = await entry.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const nodes = Array.from(doc.getElementsByTagNameNS(WNS, "t"));
  for (const t of nodes) {
    const key = t.textContent ?? "";
    if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
    const val = map[key];
    const p = findAncestorLocal(t, "p");
    if (val === null || val === undefined || val === "") {
      if (p?.parentNode) p.parentNode.removeChild(p);
      continue;
    }
    t.textContent = plainDates(val);
    // A signer's name stays on the page with its signature line and title.
    if (/_NAME\]\]$/.test(key) && p) {
      const keep = (para: Node | null) => {
        if (!para || (para as Element).localName !== "p") return;
        let pPr = Array.from(para.childNodes).find((n) => (n as Element).localName === "pPr") as Element | undefined;
        if (!pPr) {
          pPr = doc.createElementNS(WNS, "w:pPr");
          para.insertBefore(pPr, para.firstChild);
        }
        if (!Array.from(pPr.childNodes).some((n) => (n as Element).localName === "keepNext")) {
          // Schema order: pStyle first, then keepNext.
          const style = Array.from(pPr.childNodes).find((n) => (n as Element).localName === "pStyle");
          pPr.insertBefore(doc.createElementNS(WNS, "w:keepNext"), style ? style.nextSibling : pPr.firstChild);
        }
      };
      keep(p);
      let prev = p.previousSibling;
      while (prev && (prev as Element).localName !== "p") prev = prev.previousSibling;
      keep(prev);
    }
    // A filled marker drops the master's fill-in highlight.
    const run = findAncestorLocal(t, "r");
    const rPr = run ? Array.from(run.childNodes).find((n) => (n as Element).localName === "rPr") : undefined;
    if (rPr) for (const h of Array.from((rPr as Element).childNodes)) if ((h as Element).localName === "highlight") rPr.removeChild(h);
    // A bare marker run takes the paragraph's font and size, not the style's.
    if (run && !rPr && p) {
      const pPr = Array.from(p.childNodes).find((n) => (n as Element).localName === "pPr") as Element | undefined;
      const markRPr = pPr ? (Array.from(pPr.childNodes).find((n) => (n as Element).localName === "rPr") as Element | undefined) : undefined;
      if (markRPr) {
        const keep = Array.from(markRPr.childNodes).filter((n) => ["rFonts", "sz", "szCs"].includes((n as Element).localName));
        if (keep.length) {
          const fresh = doc.createElementNS(WNS, "w:rPr");
          for (const k of keep) fresh.appendChild(k.cloneNode(true));
          run.insertBefore(fresh, run.firstChild);
        }
      }
    }
  }
  // Nothing but empty paragraphs after the last section break: the final
  // section continues on the same page instead of adding a blank page.
  const body = doc.getElementsByTagNameNS(WNS, "body")[0];
  const bodySect = body ? (Array.from(body.childNodes).filter((n) => (n as Element).localName === "sectPr").pop() as Element | undefined) : undefined;
  if (body && bodySect) {
    const paras = Array.from(body.childNodes).filter((n) => (n as Element).localName === "p") as Element[];
    let i = paras.length - 1;
    while (i >= 0 && !(paras[i]!.textContent ?? "").trim() && !paras[i]!.getElementsByTagNameNS(WNS, "sectPr").length) i -= 1;
    const tailEmpty = i >= 0 && paras[i]!.getElementsByTagNameNS(WNS, "sectPr").length > 0;
    const hasType = Array.from(bodySect.childNodes).some((n) => (n as Element).localName === "type");
    if (tailEmpty && !hasType) {
      const t = doc.createElementNS(WNS, "w:type");
      t.setAttributeNS(WNS, "w:val", "continuous");
      const refs = Array.from(bodySect.childNodes).filter((n) => ["headerReference", "footerReference"].includes((n as Element).localName));
      bodySect.insertBefore(t, refs.length ? refs[refs.length - 1]!.nextSibling : bodySect.firstChild);
    }
  }
  xml = new XMLSerializer().serializeToString(doc)
    // The master's red double-underlined guidance styling never prints.
    .replace(/<w:color w:val="FF0000"\/>(<w:u w:val="double"\/>)?/g, "")
    // Master guidance highlights (yellow fill-ins, green approval lines) never print.
    .replace(/<w:highlight w:val="[a-zA-Z]+"\/>/g, "");
  zip.file("word/document.xml", xml);
  return await zip.generateAsync({
    type: "uint8array",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}

/**
 * Soft check: a marker must sit alone in one run. Returns the markers that are
 * split or partial across runs, so the caller can name them rather than write
 * a half-filled letter.
 */
export function lintMarkersSplit(documentXml: string, knownMarkers: string[]): string[] {
  const doc = new DOMParser().parseFromString(documentXml, "application/xml");
  const texts = Array.from(doc.getElementsByTagNameNS(WNS, "t")).map((t) => t.textContent ?? "");
  const joined = texts.join("");
  const bad: string[] = [];
  for (const marker of knownMarkers) {
    if (texts.some((t) => t === marker)) continue;
    // Present in the flattened text but not as a whole run: it is split.
    if (joined.includes(marker) || texts.some((t) => marker.includes(t) && t.includes("["))) {
      bad.push(marker);
    }
  }
  return bad;
}

/** Read word/document.xml out of a master, for the split check. */
export async function readDocumentXml(masterBytes: ArrayBuffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(masterBytes);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("The master is missing word/document.xml.");
  return await entry.async("string");
}
