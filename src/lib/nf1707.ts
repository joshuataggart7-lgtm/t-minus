// The NF 1707 ("Special Approvals and Affirmations of Requisitions") rendered
// from the seeded nf1707_fields rows. Section titles follow the form's order.

export type Nf1707Field = {
  field_id: string;
  section: string | null;
  subform: string | null;
  field_name: string | null;
  field_kind: string | null;
  caption: string | null;
  nearest_form_text: string | null;
  center_specific: string | null;
};

export type SectionGroup = {
  key: string;
  title: string;
  parts?: { raw: string; title: string }[];
  raw: string[];
};

export const SECTION_GROUPS: SectionGroup[] = [
  { key: "header", title: "Header", raw: ["HeaderWrapper"] },
  { key: "s1", title: "Section 1. Strategic sourcing", raw: ["Section1"] },
  { key: "s2", title: "Section 2. Section 508 and information technology", raw: ["Section2"] },
  {
    key: "s3",
    title: "Section 3. Environmental",
    raw: ["Section3", "Section3s2", "Section3s3", "Section3Old"],
    parts: [
      { raw: "Section3", title: "Environmental review" },
      { raw: "Section3s2", title: "Sustainable acquisition" },
      { raw: "Section3s3", title: "NEPA categorical exclusion" },
      { raw: "Section3Old", title: "Prior environmental questions (retained form text)" },
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

/** Captions in the export sometimes carry the XFA item list: items=['1', '0', '2'] */
export function parseItems(caption: string | null): string[] | null {
  if (!caption || !caption.startsWith("items=")) return null;
  const inner = caption.slice(caption.indexOf("[") + 1, caption.lastIndexOf("]"));
  const items = inner
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  return items.length ? items : null;
}

const TRISTATE = ["1", "0", "2"];

export function isTriState(caption: string | null) {
  const items = parseItems(caption);
  return !!items && items.length === 3 && items.every((i) => TRISTATE.includes(i));
}

export const TRISTATE_LABELS: { value: string; label: string }[] = [
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
  { value: "2", label: "Not applicable" },
];

/** Human label for a field: the caption when it is real text, otherwise the field name. */
export function fieldLabel(f: Nf1707Field) {
  const c = (f.caption ?? "").trim();
  if (c && !c.startsWith("items=")) return c;
  return f.field_name ?? "Field";
}

export function visibleForCenter(f: Nf1707Field, center: string) {
  const cs = (f.center_specific ?? "").trim();
  return cs === "" || cs === center;
}
