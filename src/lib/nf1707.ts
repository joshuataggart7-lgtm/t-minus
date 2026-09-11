// The NF 1707 ("Special Approvals and Affirmations of Requisitions") rendered
// from the seeded nf1707_fields rows. Section titles follow the form's order.

export type Nf1707Field = {
  field_id: string;
  section: string | null;
  subform: string | null;
  field_name: string | null;
  field_kind: string | null;
  caption_full: string | null;
  nearest_form_text_full: string | null;
  choice_items: string | null;
  center_specific: string | null;
  is_answerable: string | null;
};

export type SectionGroup = {
  key: string;
  title: string;
  parts?: { raw: string; title: string }[];
  raw: string[];
};

export const SECTION_GROUPS: SectionGroup[] = [
  { key: "s1", title: "Section 1. Strategic sourcing", raw: ["Section1"] },
  { key: "s2", title: "Section 2. Section 508 and information technology", raw: ["Section2"] },
  {
    key: "s3",
    title: "Section 3. Environmental",
    raw: ["Section3", "Section3s2", "Section3s3"],
    parts: [
      { raw: "Section3", title: "Environmental review" },
      { raw: "Section3s2", title: "Sustainable acquisition" },
      { raw: "Section3s3", title: "NEPA categorical exclusion" },
    ],
  },
  { key: "s4", title: "Section 4. Service contracting", raw: ["Section4"] },
  {
    key: "s5",
    title: "Section 5. Technical approval",
    raw: [
      "Section5s1",
      "Section5s2",
      "Section5s3",
      "Section5s4",
      "Section5s5",
      "Section5s6",
      "Section5s7",
    ],
    parts: [
      { raw: "Section5s1", title: "I. Space flight hardware and software" },
      { raw: "Section5s2", title: "II. SCaN and radio frequency" },
      { raw: "Section5s3", title: "III. Earned value management" },
      { raw: "Section5s4", title: "IV. Communications" },
      { raw: "Section5s5", title: "V. Aviation" },
      { raw: "Section5s6", title: "VI. Software" },
      { raw: "Section5s7", title: "VII. Sensitive and controlled items" },
    ],
  },
  {
    key: "s6",
    title: "Section 6. Quality assurance",
    raw: [
      "Section6s1",
      "Section6s2",
      "Section6s3",
      "Section6s3n2",
      "Section6s4",
      "Section6s5",
      "Section6s6",
      "Section6s7",
      "PSMSigS5",
    ],
  },
  { key: "s7", title: "Section 7. Safety and health", raw: ["Section7"] },
  { key: "s8", title: "Section 8. Property management", raw: ["Section8"] },
  { key: "s9", title: "Section 9. Center-specific approvals", raw: ["Section9", "Section9s1"] },
  { key: "s10", title: "Section 10. Foreign travel briefings", raw: ["Section10"] },
  { key: "s11", title: "Section 11. Extraneous items", raw: ["Section11"] },
  { key: "s12", title: "Section 12. Signatures and affirmations", raw: ["Section12"] },
];

export function answerKey(f: Nf1707Field) {
  return `${f.section ?? ""}.${f.subform ?? ""}.${f.field_name ?? ""}`;
}

/** Select and answer choices are pipe-delimited in the complete field export. */
export function parseItems(choiceItems: string | null): string[] | null {
  if (!choiceItems) return null;
  const items = choiceItems.split("|").map((s) => s.trim());
  return items.length ? items : null;
}

const TRISTATE = ["1", "0", "2"];

export function isTriState(choiceItems: string | null) {
  const items = parseItems(choiceItems)?.filter(Boolean);
  return !!items && items.length === 3 && items.every((i) => TRISTATE.includes(i));
}

export const TRISTATE_LABELS: { value: string; label: string }[] = [
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
  { value: "2", label: "Not applicable" },
];

/**
 * Human label for a field. The export leaves the caption carrying the XFA
 * item list on every check button, so the readable question is the nearest
 * form text. Only when neither is usable do we fall back to the raw field
 * name, and code-like names ("S3s3n1") become a numbered question.
 */
export function fieldLabel(f: Nf1707Field) {
  const caption = (f.caption_full ?? "").replace(/\s+/g, " ").trim();
  const nearby = (f.nearest_form_text_full ?? "").replace(/\s+/g, " ").trim();
  if (f.section === "Section1" && f.field_name === "NotAvailable") {
    return "The requestor has reviewed the information on the Office of Procurement NASA Strategic Sourcing website and the requirement IS NOT AVAILABLE";
  }
  if (caption && !/^(yes|no|or|and)$/i.test(caption)) return caption;
  if (nearby.length >= 4 && !/^(yes|no|or|and)$/i.test(nearby)) return nearby;
  if (caption) return caption;
  if (nearby) return nearby.charAt(0).toUpperCase() + nearby.slice(1).toLowerCase();

  if (f.section === "Section9s1") return "Center-specific approval";

  const name = (f.field_name ?? "").trim();
  if (!name) return "Question";

  // S3s3n1 → Question 3.3.1; JSC1s1cb2 → Question 1.1.2
  const numbers = name.match(/\d+/g);
  if (/^[A-Za-z]+\d/.test(name) && numbers && numbers.length > 1) {
    return `Question ${numbers.join(".")}`;
  }
  // UnderLimitNoIT → Under limit no IT
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Rows whose source text is a heading or connector are display text, not questions. */
export function isStructuralField(f: Nf1707Field) {
  const caption = (f.caption_full ?? "").replace(/\s+/g, " ").trim();
  const nearby = (f.nearest_form_text_full ?? "").replace(/\s+/g, " ").trim();
  const source = caption || nearby;
  if (f.section === "Section1" && f.field_name === "Available") return true;
  if (/^(and|or)$/i.test(source)) return true;
  if (/^section\s+\d+\b/i.test(source)) return true;
  if (/^[IVX]+\.\s+[A-Z][A-Z\s&/()-]+(?:\s*\(.*\))?$/u.test(source)) return true;
  return false;
}

export function visibleForCenter(f: Nf1707Field, center: string) {
  const cs = (f.center_specific ?? "").trim();
  if (cs !== "" && cs !== center) return false;
  const sourceLabel = `${f.caption_full ?? ""} ${f.nearest_form_text_full ?? ""}`.trim();
  if (center !== "KSC" && /^KSC\b/i.test(sourceLabel)) return false;
  return true;
}
