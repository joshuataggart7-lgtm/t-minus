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

/** Namespace prefixes belong to the packet, not to the field path. */
const bare = (name: string) => name.replace(/^[\w-]+:/, "");

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
      if (open.startsWith("xfa:")) {
        if (open === "xfa:data" && !selfClosing) inData = true;
        continue;
      }
      if (open.startsWith("dd:")) continue;
      if (!inData) continue;
      stack.push(bare(open));
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
      const at = stack.lastIndexOf(bare(close));
      if (at >= 0) stack.length = at;
    }
  }
}

/**
 * The data description packet names every field the blank can carry, so it is
 * read the same way. It sits outside xfa:data, under dd:dataDescription.
 */
function pathsFromDescription(xml: string, into: Set<string>) {
  const start = xml.indexOf("<dd:dataDescription");
  if (start < 0) return;
  const body = xml.slice(start);
  const stack: string[] = [];
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(body))) {
    const open = match[1];
    const selfClosing = match[3] === "/";
    const close = match[4];
    if (open) {
      if (open.startsWith("dd:") || open.startsWith("xfa:")) continue;
      stack.push(bare(open));
      into.add(stack.join("."));
      if (selfClosing) stack.pop();
      continue;
    }
    if (close) {
      if (close.startsWith("dd:")) break;
      const at = stack.lastIndexOf(bare(close));
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
    for (const packet of await xfaDataPackets(bytes)) {
      pathsFromPacket(packet, paths);
      pathsFromDescription(packet, paths);
    }
  } catch {
    return paths;
  }
  return paths;
}

/** The one path ending in this tail, or null when it is absent or ambiguous. */
function onlyPathEndingIn(paths: BlankPaths, tail: string): string | null {
  let found: string | null = null;
  for (const path of paths) {
    if (!path.endsWith(tail)) continue;
    if (found && found !== path) return null;
    found = path;
  }
  return found;
}

/**
 * Path for an Intake answer. The subform the answer is filed under is tried
 * first; when the blank files that leaf elsewhere, a leaf match is taken only
 * if it is unique. Anything else stays on Intake.
 */
export function pathForSubformLeaf(paths: BlankPaths, subform: string, leaf: string): string | null {
  if (!leaf) return null;
  if (subform) {
    const bySubform = onlyPathEndingIn(paths, `.${subform}.${leaf}`);
    if (bySubform) return bySubform;
  }
  return onlyPathEndingIn(paths, `.${leaf}`);
}

/** Path ending in `leaf`, or null. Used for header fields under a wrapper. */
export function pathForLeaf(paths: BlankPaths, leaf: string): string | null {
  return leaf ? onlyPathEndingIn(paths, `.${leaf}`) : null;
}
