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
    t.textContent = val;
  }
  xml = new XMLSerializer().serializeToString(doc);
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
