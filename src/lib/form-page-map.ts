/**
 * Field paths as the official blank writes them.
 *
 * The GSA blanks are hybrid forms: the same field exists in the AcroForm layer
 * and in the XFA template, and its name carries the page subform in the middle,
 * for example topmostSubform[0].Page1[0].reqnumber[0]. A data file that nests a
 * leaf directly under topmostSubform binds to nothing on Import Data.
 *
 * Rather than hard-coding a page for each form, the page segment is read from
 * the blank itself and applied to the paths this app writes, so a form with
 * fields on page 2 lands in the right place without a separate rule.
 */

import type { GeneratedForm } from "@/lib/nf1787";

const bare = (segment: string) => segment.replace(/\[\d+\]$/, "");

/** Leaf field name to the subform path the blank places it under. */
export type PagePathMap = Map<string, string[]>;

export async function blankPagePaths(pdfUrl: string): Promise<PagePathMap> {
  const map: PagePathMap = new Map();
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) return map;
    const { PDFDocument } = await import("pdf-lib");
    // A separate document instance is loaded only to read field names; the
    // bytes used for the export are untouched.
    const doc = await PDFDocument.load(await response.arrayBuffer(), { updateMetadata: false });
    for (const field of doc.getForm().getFields()) {
      const parts = field.getName().split(".").map(bare);
      if (parts.length < 3) continue;
      const leaf = parts[parts.length - 1]!;
      if (!map.has(leaf)) map.set(leaf, parts.slice(0, -1));
    }
  } catch {
    return map;
  }
  return map;
}

/**
 * The form with each field path rewritten to the path the blank uses. A field
 * the blank does not carry is left exactly as it was.
 */
export function withPagePaths(form: GeneratedForm, map: PagePathMap): GeneratedForm {
  if (!map.size) return form;
  return {
    ...form,
    sections: form.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const parts = field.path.split(".");
        const leafRaw = parts[parts.length - 1]!;
        const leaf = bare(leafRaw);
        const prefix = map.get(leaf);
        if (!prefix) return field;
        const path = [...prefix, leafRaw].join(".");
        return path === field.path ? field : { ...field, path };
      }),
    })),
  };
}
