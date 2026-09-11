/**
 * T-Minus template engine.
 *
 * A template is a set of sections whose fields bind to acquisition_facts or to
 * document-specific values. Sections and fields can show or hide by rule,
 * required fields are validated, and each template carries a version badge
 * (governing citation, tier, HQ revision date).
 */

export type FieldKind = "text" | "textarea" | "date" | "money" | "select" | "readonly";

export type Values = Record<string, string>;

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  /** Column on acquisition_facts this field is pre-filled from. */
  bind?: string;
  options?: string[];
  required?: boolean;
  help?: string;
  showIf?: (v: Values) => boolean;
};

export type SectionDef = {
  id: string;
  title: string;
  citation?: string;
  tier?: "binding" | "guidance";
  standingText?: string;
  fields: FieldDef[];
  showIf?: (v: Values) => boolean;
};

export type TemplateDef = {
  key: string;
  /** Name as it appears in the templates table. */
  name: string;
  tab: string;
  badge: { citation: string; tier: "binding" | "guidance"; revision: string; note?: string };
  lead: string;
  sections: SectionDef[];
  /** Optional signature page selected by estimated value. */
  signature?: (estimatedValue: number | null, thresholds: ThresholdRow[]) => SignatureBlock;
};

export type ThresholdRow = {
  name: string;
  value: number | null;
  citation: string | null;
  tier: string | null;
  effective_date: string | null;
  note: string | null;
};

export type SignatureBlock = { tierLabel: string; citation: string; blocks: string[]; note?: string | undefined };

const thresholdValue = (rows: ThresholdRow[], name: string, fallback: number) =>
  Number(rows.find((t) => t.name === name)?.value ?? fallback);

// ------------------------------------------------------------------ NF 1707
const nf1707: TemplateDef = {
  key: "nf-1707",
  name: "NASA Form 1707 (intake)",
  tab: "—",
  badge: {
    citation: "NF 1707, Special Approvals and Affirmations of Requisitions",
    tier: "binding",
    revision: "current NF 1707 pending",
    note: "Built from the intake fields while the current NF 1707 is pending.",
  },
  lead: "Printable view of the intake as submitted.",
  sections: [
    {
      id: "header",
      title: "Header",
      citation: "NF 1707",
      tier: "binding",
      fields: [
        { key: "center_code", label: "Center", kind: "text", bind: "center_code", required: true },
        { key: "pr_number", label: "Requisition number", kind: "text", bind: "pr_number" },
        { key: "requester_name", label: "Requester", kind: "text", bind: "requester_name", required: true },
        { key: "requester_org_code", label: "Requesting organization", kind: "text", bind: "requester_org_code" },
        { key: "title", label: "Brief description", kind: "text", bind: "title", required: true },
        {
          key: "description_of_requirement",
          label: "Description of requirement",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
        {
          key: "acquisition_forecast_verified",
          label: "Acquisition Forecast verified",
          kind: "readonly",
          bind: "acquisition_forecast_verified",
        },
      ],
    },
    {
      id: "tminus",
      title: "T-Minus fields",
      citation: "T-Minus record",
      tier: "guidance",
      fields: [
        { key: "mission_id", label: "Mission supported", kind: "text", bind: "mission_id", required: true },
        { key: "need_date", label: "Mission need date", kind: "date", bind: "need_date", required: true },
        { key: "estimated_value", label: "Estimated value", kind: "money", bind: "estimated_value", required: true },
        { key: "naics_code", label: "NAICS", kind: "text", bind: "naics_code" },
        { key: "psc_code", label: "PSC", kind: "text", bind: "psc_code" },
        { key: "contract_type", label: "Contract type", kind: "text", bind: "contract_type", required: true },
        { key: "acquisition_method", label: "Acquisition method", kind: "text", bind: "acquisition_method" },
        { key: "competition", label: "Competition", kind: "text", bind: "competition" },
        { key: "set_aside", label: "Set-aside", kind: "text", bind: "set_aside" },
        {
          key: "period_of_performance_start",
          label: "Period of performance start",
          kind: "date",
          bind: "period_of_performance_start",
        },
        {
          key: "period_of_performance_end",
          label: "Period of performance end",
          kind: "date",
          bind: "period_of_performance_end",
        },
        { key: "place_of_performance", label: "Place of performance", kind: "text", bind: "place_of_performance" },
        { key: "igce_attached", label: "IGCE attached", kind: "readonly", bind: "igce_attached" },
        { key: "sow_attached", label: "SOW or PWS attached", kind: "readonly", bind: "sow_attached" },
      ],
    },
    {
      id: "approvals",
      title: "Special approvals and affirmations",
      citation: "NF 1707 Sections 1 through 12",
      tier: "binding",
      fields: [
        {
          key: "approvals_summary",
          label: "Answers recorded on the intake",
          kind: "textarea",
          help: "Filled from the answers stored on the record. Edit only to add a clarification.",
        },
      ],
    },
  ],
};

// ------------------------------------------------------------------ JOFOC
const isUrgency = (v: Values) => (v["authority"] ?? "").includes("6.103-2");
const isFollowOn = (v: Values) => (v["authority"] ?? "").includes("6.103-1");

const jofoc: TemplateDef = {
  key: "jofoc",
  name: "Justification for Other than Full and Open Competition (JOFOC)",
  tab: "015",
  badge: {
    citation: "FAR 6.103, FAR 6.104-1, NFS CG 1806.1, NFS CG 1806.15(a)",
    tier: "binding",
    revision: "HQ 04/2026 revision, effective 4/27/2026",
    note: "HQ 04/2026 revision; three citation corrections applied by T-Minus; reported to PGPD.",
  },
  lead: "Eleven items at FAR 6.104-1(a)(1) through (a)(11).",
  sections: [
    {
      id: "header",
      title: "Header",
      citation: "FAR 6.103",
      tier: "binding",
      standingText:
        "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION. Justification for other than full and open competition, prepared under FAR 6.103.",
      fields: [
        { key: "center_code", label: "Center name and acronym", kind: "text", bind: "center_code", required: true },
        {
          key: "solicitation_name",
          label: "Solicitation or contract name and number",
          kind: "text",
          bind: "pr_number",
          required: true,
        },
        { key: "program_name", label: "Program or project name", kind: "text", bind: "mission_id", required: true },
        { key: "acquisition_id", label: "Acquisition identifier", kind: "readonly", bind: "acquisition_id" },
      ],
    },
    {
      id: "item1",
      title: "1. Identification of the agency and the contracting activity",
      citation: "FAR 6.104-1(a)(1)",
      tier: "binding",
      standingText:
        "This document is a justification for other than full and open competition prepared by the National Aeronautics and Space Administration (NASA) at the buying location named below. The procuring agency is NASA and the contracting activity is that buying location.",
      fields: [{ key: "buying_location", label: "Buying location", kind: "text", bind: "center_code", required: true }],
    },
    {
      id: "item2",
      title: "2. Nature and description of the action being approved",
      citation: "FAR 6.104-1(a)(2)",
      tier: "binding",
      fields: [
        {
          key: "action_type",
          label: "Action type",
          kind: "select",
          required: true,
          options: ["Sole-source contract", "New work modification to contract", "Extension to contract"],
        },
        { key: "contract_number", label: "Contract number, if any", kind: "text" },
        { key: "contractor_name", label: "Contractor name", kind: "text", bind: "vendor_legal_name", required: true },
        {
          key: "action_description",
          label: "Description of the action",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
          help: "For extensions, include contract number, title, period of performance, and other pertinent information.",
        },
      ],
    },
    {
      id: "item3",
      title: "3. Description of the supplies or services required, including the estimated value",
      citation: "FAR 6.104-1(a)(3)",
      tier: "binding",
      fields: [
        {
          key: "requirement_description",
          label: "Supplies or services",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
        { key: "mission_supported", label: "Mission supported", kind: "text", bind: "mission_id", required: true },
        { key: "pop_start", label: "Period of performance start", kind: "date", bind: "period_of_performance_start" },
        { key: "pop_end", label: "Period of performance end", kind: "date", bind: "period_of_performance_end" },
        { key: "estimated_value", label: "Estimated value", kind: "money", bind: "estimated_value", required: true },
      ],
    },
    {
      id: "item4",
      title: "4. Statutory authority permitting other than full and open competition",
      citation: "FAR 6.104-1(a)(4)",
      tier: "binding",
      fields: [
        {
          key: "authority",
          label: "Statutory authority",
          kind: "select",
          bind: "jofoc_authority_citation",
          required: true,
          options: [
            "10 U.S.C. 3204(a)(1) as implemented by FAR 6.103-1 (only one responsible source)",
            "10 U.S.C. 3204(a)(2) as implemented by FAR 6.103-2 (unusual and compelling urgency)",
            "10 U.S.C. 3204(a)(3) as implemented by FAR 6.103-3 (industrial mobilization; expert services)",
            "10 U.S.C. 3204(a)(4) as implemented by FAR 6.103-4 (international agreement)",
            "10 U.S.C. 3204(a)(5) as implemented by FAR 6.103-5 (authorized or required by statute)",
            "10 U.S.C. 3204(a)(6) as implemented by FAR 6.103-6 (national security)",
            "10 U.S.C. 3204(a)(7) as implemented by FAR 6.103-7 (public interest)",
            "41 U.S.C. 1901 (FAR 12.102 procedures)",
            "41 U.S.C. 1903 (FAR 12.102 procedures)",
          ],
        },
      ],
    },
    {
      id: "item5",
      title: "5. Demonstration that the authority cited applies",
      citation: "FAR 6.104-1(a)(5)",
      tier: "binding",
      fields: [
        {
          key: "authority_rationale",
          label: "Rationale for the authority",
          kind: "textarea",
          required: true,
          help: "Substantiate why the contractor is the only responsible source or how the acquisition meets the authority: limited rights in data, proprietary processes, specialized labor skills, exclusive knowledge or equipment, unique capabilities, previous work.",
        },
        {
          key: "urgency_harm",
          label: "Harm to the Government if the action is not executed",
          kind: "textarea",
          required: true,
          showIf: isUrgency,
          help: "Required when FAR 6.103-2 is cited.",
        },
        {
          key: "urgency_not_delay",
          label: "Statement that the urgency was not created by delay in processing",
          kind: "textarea",
          required: true,
          showIf: isUrgency,
        },
      ],
    },
    {
      id: "item6",
      title: "6. Efforts to solicit offers from as many potential sources as practicable",
      citation: "FAR 6.104-1(a)(6), publicized under FAR Subpart 5.1",
      tier: "binding",
      fields: [
        {
          key: "notice_date",
          label: "Date the notice was published to the Government Point of Entry",
          kind: "date",
          required: true,
          showIf: (v) => !isUrgency(v),
        },
        {
          key: "notice_exemption",
          label: "FAR 5.101(b)(1) exemption and the extent competition was limited",
          kind: "textarea",
          required: true,
          showIf: isUrgency,
          help: "Unusual and compelling urgency precludes competition; explain the extent maximum practicable competition was obtained, NFS CG 1806.12(a).",
        },
      ],
    },
    {
      id: "item7",
      title: "7. Determination that the anticipated cost will be fair and reasonable",
      citation: "FAR 6.104-1(a)(7)",
      tier: "binding",
      standingText:
        "The Contracting Officer's signature on this document indicates that the Contracting Officer has determined that the anticipated cost to the Government will be fair and reasonable. The contractor must submit a proposal to be evaluated and negotiated by the Government. Prior to execution of the contractual instrument a proposal analysis will be performed to ensure the final agreed-to price is fair and reasonable.",
      fields: [
        {
          key: "price_analysis_plan",
          label: "Planned proposal analysis under FAR Subpart 15.4",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "item8",
      title: "8. Market research conducted and the results",
      citation: "FAR 6.104-1(a)(8), FAR Part 10",
      tier: "binding",
      fields: [
        {
          key: "market_research",
          label: "Market research and results, or the reasons it was not conducted",
          kind: "textarea",
          required: true,
          help: "Reliance on the FAR 5.101 notice alone is not sufficient.",
        },
      ],
    },
    {
      id: "item9",
      title: "9. Other facts supporting the use of other than full and open competition",
      citation: "FAR 6.104-1(a)(9)",
      tier: "binding",
      fields: [
        { key: "other_facts", label: "Other facts, or none", kind: "textarea", required: true },
        {
          key: "duplicated_cost",
          label: "Estimated cost of duplicated work and how it was derived",
          kind: "textarea",
          required: true,
          showIf: isFollowOn,
          help: "Required when FAR 6.103-1(c)(2) is cited for a follow-on acquisition.",
        },
        {
          key: "injury_chronology",
          label: "Quantified injury and chronology of events",
          kind: "textarea",
          required: true,
          showIf: isUrgency,
          help: "NFS CG 1806.12(a): quantify the serious injury with its basis, any probable personal injury or loss of life, and the chronology that caused the urgency.",
        },
        {
          key: "extension_statements",
          label: "Three statements for extending existing services",
          kind: "textarea",
          showIf: (v) => isUrgency(v) && (v["action_type"] ?? "").startsWith("Extension"),
          required: true,
          help: "NFS CG 1806.12(b): the successor acquisition was started early enough, the circumstances that prevented timely award, and why no other source could compete for the interim requirement.",
        },
      ],
    },
    {
      id: "item10",
      title: "10. Sources that expressed an interest in writing",
      citation: "FAR 6.104-1(a)(10), notice publicized under FAR Subpart 5.1",
      tier: "binding",
      fields: [
        {
          key: "interested_sources",
          label: "Posting and closing dates, sources, responses and their disposition",
          kind: "textarea",
          required: true,
          help: "If a notice was not required, describe the exception and why it applies.",
        },
      ],
    },
    {
      id: "item11",
      title: "11. Actions to remove barriers to competition",
      citation: "FAR 6.104-1(a)(11)",
      tier: "binding",
      fields: [
        {
          key: "barriers",
          label: "Actions the agency may take before any subsequent acquisition",
          kind: "textarea",
          required: true,
          help: "Default: The Agency will continue to examine the market in the future for alternative solutions or new sources before executing any subsequent acquisitions for the same requirements.",
        },
      ],
    },
  ],
  signature: (estimatedValue, thresholds) => {
    const co = thresholdValue(thresholds, "JOFOC approval tier: contracting officer certification", 900000);
    const ca = thresholdValue(thresholds, "JOFOC approval tier: competition advocate", 20000000);
    const hca = thresholdValue(thresholds, "JOFOC approval tier: head of contracting activity (NASA)", 150000000);
    const value = estimatedValue ?? 0;
    const base = [
      "Technical Representative certification: I certify that the facts presented in this justification are accurate and complete.",
      "Contracting Officer certification: I hereby certify that the above justification is accurate and complete to the best of my knowledge and belief.",
    ];
    const citation = "FAR 6.104-2 Table 6-1";
    const note =
      thresholds.find((t) => t.name.startsWith("JOFOC approval tier: contracting officer"))?.note ?? undefined;
    if (value <= co) return { tierLabel: `Up to ${money(co)}`, citation, blocks: base, note };
    if (value <= ca)
      return {
        tierLabel: `Over ${money(co)} to ${money(ca)}`,
        citation,
        blocks: [...base, "Competition Advocate approval."],
        note,
      };
    if (value <= hca)
      return {
        tierLabel: `Over ${money(ca)} to ${money(hca)}`,
        citation,
        blocks: [
          ...base,
          "Competition Advocate concurrence.",
          "HQ Office of General Counsel: required when NOJMO, ESDMD, or SOMD actions require HCA approval.",
          "Head of Contracting Activity approval.",
        ],
        note,
      };
    return {
      tierLabel: `Over ${money(hca)}, and all class justifications`,
      citation,
      blocks: [
        ...base,
        "Competition Advocate concurrence.",
        "Head of Contracting Activity.",
        "HQ Office of General Counsel.",
        "Agency Competition Advocate.",
        "Senior Procurement Executive approval.",
      ],
      note,
    };
  },
};

// ------------------------------------------ NASA Technical Evaluation Report
const ter: TemplateDef = {
  key: "technical-evaluation-report",
  name: "NASA Technical Evaluation Report",
  tab: "054",
  badge: {
    citation: "FAR 15.404-4, FAR 15.404-9(c)(4)(ii), NFS CG 1815.45(b)",
    tier: "guidance",
    revision: "HQ revision 07/2026, effective 7/30/2026",
    note: "Mandatory above the simplified acquisition threshold for a sole-source proposal; optional at or below it.",
  },
  lead: "Items 1 through 7 are standard. Section 8 is tailored; mark anything that does not apply as N/A.",
  sections: [
    {
      id: "header",
      title: "Memorandum header",
      citation: "NFS CG 1815.45(b)",
      tier: "guidance",
      fields: [
        { key: "memo_date", label: "Date", kind: "date", required: true },
        { key: "office_name", label: "Reply to attention of (NASA office name)", kind: "text", required: true },
        { key: "to_co", label: "To: contracting officer and organizational code", kind: "text", bind: "co_name", required: true },
        { key: "from_evaluator", label: "From: technical evaluator and organizational code", kind: "text", required: true },
        { key: "subject", label: "Subject: title of acquisition and proposal date", kind: "text", bind: "title", required: true },
      ],
    },
    {
      id: "item1",
      title: "1. Technical requirement and background",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [
        {
          key: "background",
          label: "Requirement, changes, and impact",
          kind: "textarea",
          bind: "description_of_requirement",
          required: true,
        },
      ],
    },
    {
      id: "item2",
      title: "2. Technical evaluation team members",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [{ key: "team", label: "Names, organizations, and the lead evaluator", kind: "textarea", required: true }],
    },
    {
      id: "item3",
      title: "3. Fact-finding",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [{ key: "fact_finding", label: "When, where, who attended, and any revisions", kind: "textarea", required: true }],
    },
    {
      id: "item4",
      title: "4. Ground rules and assumptions",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [{ key: "ground_rules", label: "Reasonableness and any differences of opinion", kind: "textarea", required: true }],
    },
    {
      id: "item5",
      title: "5. Data requirements documents (DRDs)",
      citation: "NFS 1852 DRD program",
      tier: "guidance",
      fields: [{ key: "drds", label: "Acceptability of proposed DRD changes, or N/A", kind: "textarea", required: true }],
    },
    {
      id: "item6",
      title: "6. Government furnished property and information",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [
        {
          key: "gfp",
          label: "Quantity, item serial number, need date, owner, and the Government's ability to provide it, or N/A",
          kind: "textarea",
          required: true,
        },
      ],
    },
    {
      id: "item7",
      title: "7. Overall acceptability of the technical proposal",
      citation: "FAR 15.404-4",
      tier: "binding",
      fields: [
        {
          key: "acceptability",
          label: "Acceptable or unacceptable for negotiations",
          kind: "select",
          required: true,
          options: ["Acceptable for negotiations", "Unacceptable for negotiations"],
        },
        { key: "acceptability_basis", label: "Basis, including proposal methodology", kind: "textarea", required: true },
        {
          key: "ae_six_percent",
          label: "Architect-engineering 6 percent limit: where reductions are being taken",
          kind: "textarea",
          help: "FAR 15.404-9(c)(4)(ii). Complete only for architect-engineering services for public works or utilities.",
        },
      ],
    },
    {
      id: "item8",
      title: "8. Evaluation of resources",
      citation: "FAR 15.404-4",
      tier: "binding",
      standingText: "Mark any part that does not apply as N/A. Do not delete it; N/A shows it was reviewed.",
      fields: [
        { key: "res_labor", label: "a. Direct labor: hours, skill mix, and schedule", kind: "textarea", required: true },
        { key: "res_material", label: "b. Material: quantity, type, and necessity", kind: "textarea", required: true },
        { key: "res_travel", label: "c. Travel", kind: "textarea", required: true },
        { key: "res_subcontracts", label: "d. Subcontractor effort", kind: "textarea", required: true },
        { key: "res_tooling", label: "e. Special tooling and test equipment", kind: "textarea", required: true },
        { key: "res_odc", label: "f. Other direct costs, training, consultants, and IWTs", kind: "textarea", required: true },
      ],
    },
  ],
};

export const TEMPLATES: TemplateDef[] = [nf1707, jofoc, ter];

export function templateByKey(key: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Pre-fill every field that exists on the record. */
export function prefill(def: TemplateDef, acq: Record<string, unknown>): Values {
  const out: Values = {};
  for (const s of def.sections) {
    for (const f of s.fields) {
      const raw = f.bind ? acq[f.bind] : undefined;
      if (raw === null || raw === undefined || raw === "") {
        out[f.key] = "";
        continue;
      }
      out[f.key] = typeof raw === "boolean" ? (raw ? "Yes" : "No") : String(raw);
    }
  }
  return out;
}

export function visibleSections(def: TemplateDef, v: Values): SectionDef[] {
  return def.sections.filter((s) => !s.showIf || s.showIf(v));
}

export function visibleFields(s: SectionDef, v: Values): FieldDef[] {
  return s.fields.filter((f) => !f.showIf || f.showIf(v));
}

export function validate(def: TemplateDef, v: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const s of visibleSections(def, v)) {
    for (const f of visibleFields(s, v)) {
      if (f.required && !(v[f.key] ?? "").trim()) errors[f.key] = `${f.label} is required.`;
    }
  }
  return errors;
}

export type RenderedDoc = {
  title: string;
  badgeLine: string;
  blocks: { heading: string; citation?: string | undefined; lines: string[] }[];
};

/** One rendering used by the printable view and by both exports. */
export function renderDocument(
  def: TemplateDef,
  v: Values,
  acquisitionId: string,
  signature?: SignatureBlock,
): RenderedDoc {
  const blocks = visibleSections(def, v).map((s) => {
    const lines: string[] = [];
    if (s.standingText) lines.push(s.standingText);
    for (const f of visibleFields(s, v)) {
      const raw = (v[f.key] ?? "").trim();
      const value =
        f.kind === "money" && raw && !Number.isNaN(Number(raw.replace(/[$,]/g, "")))
          ? money(Number(raw.replace(/[$,]/g, "")))
          : raw;
      lines.push(`${f.label}: ${value || "—"}`);
    }
    return { heading: s.title, citation: s.citation, lines };
  });
  if (signature) {
    blocks.push({
      heading: `Signatures — ${signature.tierLabel}`,
      citation: signature.citation,
      lines: signature.note ? [...signature.blocks, `Note: ${signature.note}`] : signature.blocks,
    });
  }
  return {
    title: `${def.name} — ${acquisitionId}`,
    badgeLine: `${def.badge.citation} · ${def.badge.tier} · ${def.badge.revision}${def.badge.note ? ` · ${def.badge.note}` : ""}`,
    blocks,
  };
}

/** Word export. The docx library is loaded on demand in the browser. */
export async function exportDocx(doc: RenderedDoc, fileName: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(doc.title)] }),
    new Paragraph({ children: [new TextRun({ text: doc.badgeLine, size: 18 })] }),
    new Paragraph({ children: [new TextRun({ text: "Prototype. Not an official NASA system.", size: 18 })] }),
  ];
  for (const b of doc.blocks) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.heading)] }));
    if (b.citation) children.push(new Paragraph({ children: [new TextRun({ text: b.citation, italics: true, size: 18 })] }));
    for (const line of b.lines) children.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  const document = new Document({
    styles: {
      default: { document: { run: { font: "IBM Plex Sans", size: 22, color: "000000" } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 30, bold: true, color: "000000", font: "IBM Plex Sans" },
          paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, color: "000000", font: "IBM Plex Sans" },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** PDF export through the browser print dialog, on white with the version badge in the footer. */
export function exportPdf(doc: RenderedDoc, headerLine: string) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = doc.blocks
    .map(
      (b) =>
        `<section><h2>${esc(b.heading)}</h2>${b.citation ? `<p class="cite">${esc(b.citation)}</p>` : ""}${b.lines
          .map((l) => `<p>${esc(l)}</p>`)
          .join("")}</section>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #000; background: #fff; font-size: 12pt; line-height: 1.5; }
  header, footer { font-size: 9pt; }
  h1 { font-size: 18pt; } h2 { font-size: 13pt; margin-bottom: 2px; }
  .cite { font-size: 9pt; font-style: italic; margin-top: 0; }
  section { margin-bottom: 14px; }
</style></head><body>
<header>${esc(headerLine)}</header>
<h1>${esc(doc.title)}</h1>
${body}
<footer><p>${esc(doc.badgeLine)}</p><p>Prototype. Not an official NASA system.</p></footer>
<script>window.onload = function () { window.print(); }<\/script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
