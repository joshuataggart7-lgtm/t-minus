/**
 * Field paths read out of a pure XFA blank.
 *
 * The GSA blanks carry an AcroForm layer, so form-page-map.ts can read their
 * page subforms with pdf-lib. The NASA NF 1707 blank has no AcroForm layer at
 * all: every field lives in the XFA packets inside the PDF. This module reads
 * the blank's own XFA data packet and returns the dotted paths it carries, so
 * the export writes only paths the blank actually has. A path the blank does
 * not carry is never written and never guessed.
 */

const DEFLATE_STREAM = /stream\r?\n/g;

async function inflate(bytes: Uint8Array): Promise<string | null> {
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    return await new Response(stream).text();
  } catch {
    return null;
  }
}

/** Every inflated stream in the file that looks like an XFA data packet. */
async function xfaDataPackets(bytes: Uint8Array): Promise<string[]> {
  const text = new TextDecoder("latin1").decode(bytes);
  const packets: string[] = [];
  DEFLATE_STREAM.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DEFLATE_STREAM.exec(text))) {
    const start = match.index + match[0].length;
    const end = text.indexOf("endstream", start);
    if (end < 0) break;
    const inflated = await inflate(bytes.subarray(start, end));
    if (inflated && inflated.includes("<xfa:data")) packets.push(inflated);
    DEFLATE_STREAM.lastIndex = end;
  }
  return packets;
}

const TAG = /<\s*([A-Za-z_][\w:.-]*)([^>]*?)(\/?)\s*>|<\/\s*([A-Za-z_][\w:.-]*)\s*>/g;

/** Dotted paths under xfa:data, e.g. form1.Page1.Section3.S3n1. */
function pathsFromPacket(xml: string, into: Set<string>) {
  const stack: string[] = [];
  let inData = false;
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(xml))) {
    const open = match[1];
    const selfClosing = match[3] === "/";
    const close = match[4];
    if (open) {
      if (open.startsWith("xfa:") || open.startsWith("?") || open.startsWith("dd:")) {
        if (open === "xfa:data") inData = true;
        continue;
      }
      if (!inData) continue;
      stack.push(open);
      into.add(stack.join("."));
      if (selfClosing) stack.pop();
      continue;
    }
    if (close) {
      if (close === "xfa:data") {
        inData = false;
        stack.length = 0;
        continue;
      }
      if (!inData) continue;
      const at = stack.lastIndexOf(close);
      if (at >= 0) stack.length = at;
    }
  }
}

export type BlankPaths = Set<string>;

export async function blankXfaPaths(pdfUrl: string): Promise<BlankPaths> {
  const paths: BlankPaths = new Set();
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) return paths;
    const bytes = new Uint8Array(await response.arrayBuffer());
    for (const packet of await xfaDataPackets(bytes)) pathsFromPacket(packet, paths);
  } catch {
    return paths;
  }
  return paths;
}

/** Path ending in `subform.leaf`, or null when the blank does not carry it. */
export function pathForSubformLeaf(paths: BlankPaths, subform: string, leaf: string): string | null {
  if (!subform || !leaf) return null;
  const tail = `.${subform}.${leaf}`;
  for (const path of paths) if (path.endsWith(tail)) return path;
  return null;
}

/** Path ending in `leaf`, or null. Used for header fields under a wrapper. */
export function pathForLeaf(paths: BlankPaths, leaf: string): string | null {
  if (!leaf) return null;
  const tail = `.${leaf}`;
  for (const path of paths) if (path.endsWith(tail)) return path;
  return null;
}
