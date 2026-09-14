/**
 * NF 1787 (Small Business Coordination) and NF 1787A (Market Research) as
 * generated forms.
 *
 * Both blank forms are dynamic XFA documents. The field paths below are the
 * paths in the form's own template, so a filled form can be exported either as
 * the original form carrying its data, or as a flattened rendering of the
 * answers. Every value comes from the acquisition record, the NF 1707 answers
 * or the set-aside evidence search: nothing here is typed twice.
 *
 * Signature and concurrence fields are deliberately left blank. They are
 * completed in the Approvals step.
 */

export type FormValue = string | boolean;

export type FormField = {
  /** Path in the XFA template, used by the populated export. */
  path: string;
  label: string;
  value: FormValue;
  /** Shown under the field in the preview when the record cannot answer it. */
  gap?: string;
};

export type FormSection = {
  title: string;
  citation?: string;
  fields: FormField[];
};

export type GeneratedForm = {
  key: FormKey;
  name: string;
  citation: string;
  /** Blank form served from the app, used by the populated export. */
  pdf: string;
  sections: FormSection[];
};

export type FormKey = "nf-1787" | "nf-1787a";

import {
  findingText,
  respondentsFromFinding,
  type FindingMap,
} from "@/lib/research-findings";

export type FormRespondent = {
  uei: string;
  name: string;
  category: string;
  assessment: string;
};

/** SBA size standard for the record's NAICS, read from the seeded table. */
export type SizeStandard = {
  naicsCode: string;
  naicsTitle: string;
  /** Which of the two form cells the standard fills. */
  standardType: "employees" | "receipts";
  employees: number | null;
  receiptsUsd: number | null;
  citation: string;
  effectiveDate: string;
  note: string;
};

export type FormCtx = {
  /** Values drafted by the market research evidence engine, keyed by target. */
  findings?: FindingMap;
  acquisitionId: string;
  acq: Record<string, unknown>;
  missionName: string;
  coName: string;
  specialistName: string;
  /** Rows from the set-aside evidence search; empty when it has not been run. */
  respondents: FormRespondent[];
  /** Label of the evidence run, or null when the search has never been run. */
  evidenceLabel: string | null;
  gates: { services: boolean | null; it: boolean | null; hardware: boolean | null };
  /** SBA size standard for the record's NAICS, or null when none is seeded. */
  sizeStandard?: SizeStandard | null;
  /** Simplified acquisition threshold from the threshold table, with its citation. */
  simplifiedAcquisition?: { value: number; citation: string } | null;
};

export const GENERATED_FORM_KEYS: FormKey[] = ["nf-1787", "nf-1787a"];

export const FORM_NAMES: Record<FormKey, string> = {
  "nf-1787": "NF 1787, Small Business Coordination Record",
  "nf-1787a": "NF 1787A, Market Research Report",
};

const TO_COMPLETE = (what: string) => `[Contracting officer to complete: ${what}]`;

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

const dollars = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n) || !v) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
};

const yesNo = (v: boolean | null): { yes: boolean; no: boolean } => ({ yes: v === true, no: v === false });

const has = (text: string, needle: string) => text.toLowerCase().includes(needle);

/** The set-aside choice on the record, reduced to the form's own rows. */
type SetAsideRow =
  | "full-open"
  | "sole-source"
  | "total-sb"
  | "partial-sb"
  | "8a"
  | "hubzone"
  | "sdvosb"
  | "wosb"
  | "edwosb"
  | "none";

export function setAsideRow(setAside: string, competition: string): SetAsideRow {
  const s = setAside.toLowerCase();
  const c = competition.toLowerCase();
  if (has(s, "8(a)")) return "8a";
  if (has(s, "hubzone")) return "hubzone";
  if (has(s, "sdvosb") || has(s, "service-disabled")) return "sdvosb";
  if (has(s, "edwosb")) return "edwosb";
  if (has(s, "wosb") || has(s, "women")) return "wosb";
  if (has(s, "partial")) return "partial-sb";
  if (has(s, "total") || has(s, "small business")) return "total-sb";
  if (has(c, "sole source") || has(c, "brand name") || has(c, "limited")) return "sole-source";
  if (has(c, "competitive")) return "full-open";
  return "none";
}

const soleSourceLike = (competition: string) =>
  has(competition.toLowerCase(), "sole source") || has(competition.toLowerCase(), "brand name");

/** NF 1787A, Market Research Report. */
export function buildNf1787A(ctx: FormCtx): GeneratedForm {
  const a = ctx.acq;
  const competition = str(a["competition"]);
  const setAside = str(a["set_aside"]);
  const row = setAsideRow(setAside, competition);
  const jofoc = Boolean(str(a["jofoc_authority_citation"])) || soleSourceLike(competition);
  const prior = str(a["successor_of"]);
  const commercial = str(a["commercial_determination"]);
  const strategy = str(a["enterprise_psl_check"]);
  const services = ctx.gates.services;
  const evidence = ctx.evidenceLabel;
  const smallCount = ctx.respondents.filter((r) => has(r.category.toLowerCase(), "small")).length;

  const researched = (target: string) => findingText(ctx.findings, target);
  const researchedOn = (target: string) => Boolean(findingText(ctx.findings, target));
  const researchedRespondents = respondentsFromFinding(ctx.findings);
  const researchText = evidence
    ? `SAM.gov registered-entity and subaward search for NAICS ${str(a["naics_code"])}, ${evidence}. ${
        ctx.respondents.length
      } sources reviewed, ${smallCount} identified as small business.`
    : TO_COMPLETE("run the set-aside evidence search, or record the research performed");

  const determination =
    row === "total-sb"
      ? `Two or more responsible small business concerns are expected to submit offers at fair market prices. The requirement is set aside for small business under FAR 19.502-2.`
      : row === "full-open"
        ? `Market research does not support a set-aside at this value; the requirement is solicited on a full and open basis.`
        : row === "sole-source"
          ? `Market research supports other than full and open competition; the justification is documented separately.`
          : setAside
            ? `Market research supports the ${setAside} approach recorded on this acquisition.`
            : TO_COMPLETE("record the set-aside determination");

  return {
    key: "nf-1787a",
    name: FORM_NAMES["nf-1787a"],
    citation: "NFS CG 1810.12(c)",
    pdf: "/forms/NF1787A.pdf",
    sections: [
      {
        title: "Section I. Requirement",
        fields: [
          { path: "form1.Page1.Section1.ProjectTitle", label: "Project title", value: str(a["title"]) },
          { path: "form1.Page1.Section1.MissionSupported", label: "Mission supported", value: ctx.missionName },
          {
            path: "form1.Page1.Section1.RequirementsDirectorate",
            label: "Requirements directorate",
            value: str(a["mission_directorate_name"]) || str(a["mission_directorate_code"]),
          },
          {
            path: "form1.Page1.Section1.Description.DescriptionOfRequirement",
            label: "Description of requirement",
            value:
              str(a["description_of_requirement"]) ||
              TO_COMPLETE("add the description of the requirement to the record"),
          },
          { path: "form1.Page1.Section1.TotalValue", label: "Total value", value: dollars(a["estimated_value"]) },
          { path: "form1.Page1.Section1.PRNumber", label: "Purchase request number", value: str(a["pr_number"]) },
          { path: "form1.Page1.Section1.ProductCode", label: "Product service code", value: str(a["psc_code"]) },
          { path: "form1.Page1.Section1.NAICSCode", label: "NAICS code", value: str(a["naics_code"]) },
          {
            path: "form1.Page1.Section1.NAICS.WOSBYes",
            label: "NAICS is WOSB eligible",
            value: row === "wosb",
          },
          {
            path: "form1.Page1.Section1.NAICS.EDWOSBYes",
            label: "NAICS is EDWOSB eligible",
            value: row === "edwosb",
          },
          {
            path: "form1.Page1.Section1.NAICS.WOSBNo",
            label: "NAICS is not WOSB or EDWOSB eligible",
            value: row !== "wosb" && row !== "edwosb",
          },
          {
            path: "form1.Page1.Section1.ConsolidationOrFollowOn.PriorContractYes",
            label: "Prior contract for this requirement",
            value: Boolean(prior),
          },
          {
            path: "form1.Page1.Section1.ConsolidationOrFollowOn.PriorContractNo",
            label: "No prior contract",
            value: !prior,
          },
          {
            path: "form1.Page1.Section1.ConsolidationOrFollowOn.FollowOnYes",
            label: "Follow-on acquisition",
            value: Boolean(prior),
          },
          {
            path: "form1.Page1.Section1.ConsolidationOrFollowOn.FollowOnNo",
            label: "Not a follow-on acquisition",
            value: !prior,
          },
          {
            path: "form1.Page1.Section1.AffirmativeSection508OrJOFOC.JOFOCYes",
            label: "Justification for other than full and open competition required",
            value: jofoc,
          },
          {
            path: "form1.Page1.Section1.AffirmativeSection508OrJOFOC.JOFOCNo",
            label: "No justification required",
            value: !jofoc,
          },
          {
            path: "form1.Page1.Section1.GovtServices.ServicesYes",
            label: "Requirement includes services",
            value: services === true,
          },
          {
            path: "form1.Page1.Section1.GovtServices.ServicesNo",
            label: "Requirement does not include services",
            value: services === false,
            ...(services === null ? { gap: "Answer the services gate on Intake." } : {}),
          },
        ],
      },
      {
        title: "Sections II and III. Mandatory sources and strategic sourcing",
        citation: "FAR 8.002; Enterprise Procurement Strategies",
        fields: [
          {
            path: "form1.Page1.Section3.StrategicSourcing",
            label: "Enterprise strategy or strategic sourcing vehicle",
            value: strategy || "No mandatory strategy applies",
          },
          {
            path: "form1.Page1.Section3.StrategicSourcingInput",
            label: "Strategic sourcing detail",
            value: strategy ? `Recorded on the acquisition as ${strategy}.` : "",
          },
        ],
      },
      {
        title: "Section IV. Research conducted",
        citation: "FAR 10.002",
        fields: [
          {
            path: "form1.Page1.Section4.FieldHeader1.ckHistory",
            label: "Procurement history reviewed",
            value: researchedOn("nf1787a.ckHistory") || Boolean(prior),
          },
          {
            path: "form1.Page1.Section4.ProcurementHistory",
            label: "Procurement history",
            value:
              researched("nf1787a.ProcurementHistory") || (prior ? `Prior contract file ${prior} reviewed.` : ""),
          },
          {
            path: "form1.Page1.Section4.FieldHeader2.ckResults",
            label: "Results of the sources search",
            value: researchedOn("nf1787a.ckResults"),
          },
          {
            path: "form1.Page1.Section4.IdentifyResults",
            label: "Identify the results",
            value: researched("nf1787a.IdentifyResults"),
          },
          {
            path: "form1.Page1.Section4.FieldHeader7.ckQuery",
            label: "Database query, SAM.gov",
            value: researchedOn("nf1787a.ckQuery") || Boolean(evidence),
          },
          {
            path: "form1.Page1.Section4.CiteInformation",
            label: "Information cited",
            value: researched("nf1787a.CiteInformation") || researchText,
          },
          {
            path: "form1.Page1.Section4.FieldHeader8.ckSBA",
            label: "SBA size standard reviewed",
            value: researchedOn("nf1787a.ckSBA"),
          },
          {
            path: "form1.Page1.Section4.SBA",
            label: "SBA size standard",
            value: researched("nf1787a.SBA"),
          },
          {
            path: "form1.Page1.Section4.FieldHeader11.ckMarketResearch",
            label: "Market research report prepared",
            value: true,
          },
          {
            path: "form1.Page1.Section4.MarketResearch",
            label: "Market research summary",
            value: researched("nf1787a.MarketResearch") || researchText,
          },
          {
            path: "form1.Page1.Section4.SuppliesAndServices.SuppliesServices",
            label: "Supplies and services researched",
            value: str(a["title"]),
          },
        ],
      },
      {
        title: "Section V. Commercial products and services",
        citation: "FAR 12.101; FAR 10.001(a)(3)",
        fields: [
          {
            path: "form1.Page1.Section5.CommercialItem.MetByCommercialItems",
            label: "Requirement can be met by commercial products or services",
            value: has(commercial.toLowerCase(), "commercial") && !has(commercial.toLowerCase(), "non"),
          },
          {
            path: "form1.Page1.Section5.CommercialItem.NonCommercialItems",
            label: "Requirement is not commercial",
            value: has(commercial.toLowerCase(), "non"),
          },
          {
            path: "form1.Page1.Section5.CommercialItem.ElaborateOtherDetermination",
            label: "Commerciality determination",
            value:
              [commercial, researched("nf1787a.commerciality")].filter(Boolean).join(" ") ||
              TO_COMPLETE("record the commerciality determination"),
          },
        ],
      },
      {
        title: "Section VI. Respondents",
        citation: "FAR 19.502-2(b)",
        fields: (researchedRespondents.length ? researchedRespondents : ctx.respondents).length
          ? (researchedRespondents.length ? researchedRespondents : ctx.respondents).flatMap((r, i) => [
              { path: `form1.Page1.Section6.MarketResearch[${i}].UEI`, label: `Respondent ${i + 1} UEI`, value: r.uei },
              {
                path: `form1.Page1.Section6.MarketResearch[${i}].Respondent`,
                label: `Respondent ${i + 1}`,
                value: r.name,
              },
              {
                path: `form1.Page1.Section6.MarketResearch[${i}].SBCategoryText`,
                label: `Respondent ${i + 1} small business category`,
                value: r.category,
              },
              {
                path: `form1.Page1.Section6.MarketResearch[${i}].OverallAssessment`,
                label: `Respondent ${i + 1} assessment`,
                value: r.assessment,
              },
            ])
          : [
              {
                path: "form1.Page1.Section6.MarketResearch.Respondent",
                label: "Respondents",
                value: TO_COMPLETE("run market research so the respondents fill in"),
              },
            ],
      },
      {
        title: "Section VIII. Determination",
        citation: "FAR 19.502-2",
        fields: [{ path: "form1.Page1.Section8.Determination", label: "Determination", value: determination }],
      },
      {
        title: "Sections IX and X. Signatures",
        citation: "Completed in the Approvals step",
        fields: [
          { path: "form1.Page1.Section9.TPOC.FullName", label: "Technical point of contact", value: "" },
          { path: "form1.Page1.Section10.Preparer.FullName", label: "Preparer", value: "" },
        ],
      },
    ],
  };
}

/** NF 1787, Small Business Coordination Record. */
export function buildNf1787(ctx: FormCtx): GeneratedForm {
  const a = ctx.acq;
  const competition = str(a["competition"]);
  const setAside = str(a["set_aside"]);
  const row = setAsideRow(setAside, competition);
  const contractType = str(a["contract_type"]).toLowerCase();
  const sole = soleSourceLike(competition);
  const value = Number(a["estimated_value"] ?? 0);
  const start = str(a["period_of_performance_start"]);
  const end = str(a["period_of_performance_end"]);
  const prior = str(a["successor_of"]);
  const competitiveVariant = !sole;
  const method = str(a["acquisition_method"]).toLowerCase();

  // The vehicle box follows the acquisition method, with the record's own
  // vehicle words taking precedence when it names one.
  const bpa = has(contractType, "bpa") || has(method, "8.4") || has(method, "blanket");
  const mac = has(contractType, "mac") || has(contractType, "gwac") || has(method, "gwac");
  const idiq = !mac && (has(contractType, "idiq") || has(contractType, "indefinite") || has(method, "16.5"));
  const simplified = has(method, "far 13") || has(method, "13.5") || has(method, "simplified");
  const po = !bpa && !mac && !idiq && (has(contractType, "purchase order") || simplified);
  const negotiated =
    has(method, "far 15") || has(method, "part 15") || (has(method, "far 12") && has(method, "15"));
  const definitive = !bpa && !mac && !idiq && !po && (negotiated || Boolean(contractType));

  const size = ctx.sizeStandard ?? null;
  const researchedStandard = findingText(ctx.findings, "nf1787.size_standard");
  const sizeSource = size
    ? `${size.citation}, effective ${size.effectiveDate}${size.note ? ` (${size.note})` : ""}`
    : researchedStandard
      ? `SBA table of small business size standards: ${researchedStandard}`
      : "";
  const employeeStandard =
    size && size.standardType === "employees" && size.employees
      ? `${size.employees.toLocaleString("en-US")} employees`
      : "";
  const receiptsStandard =
    size && size.standardType === "receipts" && size.receiptsUsd ? dollars(size.receiptsUsd) : "";

  const sat = ctx.simplifiedAcquisition ?? null;
  const overSat = sat ? value > sat.value : null;

  const rowField = (path: string, label: string, on: boolean): FormField => ({ path, label, value: on });

  return {
    key: "nf-1787",
    name: FORM_NAMES["nf-1787"],
    citation: "NFS 1819.202-70",
    pdf: "/forms/NF1787.pdf",
    sections: [
      {
        title: "Header",
        fields: [
          { path: "form1.Initial", label: "Initial coordination", value: true },
          { path: "form1.Revised", label: "Revised coordination", value: false },
          {
            path: "form1.Page2.HeaderSection.PurchaseRequestNo",
            label: "Purchase request number",
            value: str(a["pr_number"]),
          },
          {
            path: "form1.Page2.HeaderSection.TotalEstimatedValue",
            label: "Total estimated value",
            value: dollars(a["estimated_value"]),
          },
          { path: "form1.Page2.HeaderSection.QuantityAmt", label: "Quantity or amount", value: "1 lot" },
          {
            path: "form1.Page2.BorderSub.TotLengthContract",
            label: "Delivery or period of performance",
            value: start && end ? `${start} through ${end}` : TO_COMPLETE("record the period of performance"),
          },
          {
            path: "form1.Page2.ItemDescription",
            label: "Description of items or services",
            value: str(a["description_of_requirement"]) || str(a["title"]),
          },
          { path: "form1.Page2.Sec678Sub.NAICSCode", label: "NAICS code", value: str(a["naics_code"]) },
          {
            path: "form1.Page2.Sec678Sub.NumberEmployees",
            label: "Size standard, number of employees",
            value: employeeStandard,
            ...(size ? {} : { gap: "No SBA size standard is seeded for this NAICS code." }),
          },
          {
            path: "form1.Page2.Sec678Sub.Receipts",
            label: "Size standard, average annual receipts",
            value: receiptsStandard,
          },
          {
            path: "form1.Page2.Sec678Sub.SizeStandardSource",
            label: "Size standard source",
            value: sizeSource,
          },
          rowField(
            "form1.Page2.Sec678Sub.ThresholdYes",
            "Exceeds the simplified acquisition threshold",
            overSat === true,
          ),
          rowField(
            "form1.Page2.Sec678Sub.ThresholdNo",
            "Does not exceed the simplified acquisition threshold",
            overSat === false,
          ),
          {
            path: "form1.Page2.Sec678Sub.ThresholdSource",
            label: "Simplified acquisition threshold",
            value: sat ? `${dollars(sat.value)}, ${sat.citation}` : "",
            ...(sat ? {} : { gap: "The simplified acquisition threshold is not loaded." }),
          },
        ],
      },
      {
        title: "Contract vehicle",
        citation: "Set from the acquisition method on the record",
        fields: [
          rowField("form1.Page2.MidSection.PO", "Purchase order", po),
          rowField("form1.Page2.MidSection.DEFINITIVE", "Definitive contract", definitive),
          rowField("form1.Page2.MidSection.BPA", "Blanket purchase agreement", bpa),
          rowField("form1.Page2.MidSection.IDIQ", "Indefinite delivery indefinite quantity", idiq),
          rowField("form1.Page2.MidSection.MAC", "Multiple award contract", mac),
        ],
      },
      {
        title: "Recommended acquisition approach",
        citation: "FAR 19.502; NFS 1819",
        fields: [
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub1.a", "a. Full and open", row === "full-open"),
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub2.c", "c. Sole source", row === "sole-source"),
          {
            path: "form1.Page2.LowerSection.LeftSide.InnerSub2.SelectSS",
            label: "Sole source authority",
            value: sole ? str(a["jofoc_authority_citation"]) || TO_COMPLETE("cite the authority") : "",
          },
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub2.e", "d. Small business set-aside, total", row === "total-sb"),
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub2.f", "e. Small business set-aside, partial", row === "partial-sb"),
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub2.g", "f. 8(a)", row === "8a"),
          rowField(
            competitiveVariant
              ? "form1.Page2.LowerSection.LeftSide.InnerSub2.gCompetitive"
              : "form1.Page2.LowerSection.LeftSide.InnerSub2.gSoleSource",
            competitiveVariant ? "8(a) competitive" : "8(a) sole source",
            row === "8a",
          ),
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub2.h", "g. HUBZone", row === "hubzone"),
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub2.i", "h. SDVOSB", row === "sdvosb"),
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub2.j", "i. WOSB", row === "wosb"),
          rowField("form1.Page2.LowerSection.LeftSide.InnerSub2.k", "j. EDWOSB", row === "edwosb"),
        ],
      },
      {
        title: "Prior acquisition and market research report",
        fields: [
          rowField("form1.Page2.Sec9Sub.PriorYes", "Prior contract for this requirement", Boolean(prior)),
          rowField("form1.Page2.Sec9Sub.PriorNo", "No prior contract", !prior),
          { path: "form1.Page2.Sec9Sub.YesText1", label: "Prior contract file", value: prior },
          rowField("form1.Page2.LowerSection.MRRsub.MRRreqYes", "NF 1787A required", value >= 2_000_000),
          rowField("form1.Page2.LowerSection.MRRsub.MRRreqNo", "NF 1787A not required", value < 2_000_000),
          {
            path: "form1.Page2.LowerSection.MRRsub.Explain",
            label: "Explanation",
            value:
              value >= 2_000_000
                ? "Estimated value is $2,000,000 or more; the NF 1787A is required (NFS CG 1810.12(c))."
                : "Estimated value is under $2,000,000; the market research memorandum is the document of record (NFS CG 1810.12(c)).",
          },
          {
            path: "form1.Page2.Remarks",
            label: "Remarks",
            // The set-aside evidence from the market research engine is carried
            // into Remarks, with its source and date until it is confirmed.
            value: `Acquisition ${ctx.acquisitionId}. ${competition}${setAside ? `, ${setAside}` : ""}.${
              findingText(ctx.findings, "nf1787.remarks") ? ` ${findingText(ctx.findings, "nf1787.remarks")}` : ""
            }`,
          },
        ],
      },
      {
        title: "Signatures and concurrence",
        citation: "Completed in the Approvals step",
        fields: [
          { path: "form1.Page2.SignSub.ContractSp", label: "Contract specialist", value: "" },
          { path: "form1.Page2.SignSub.ContractorOfficerName", label: "Contracting officer", value: "" },
          { path: "form1.Page2.SignSub.SBA_SPECIALIST", label: "Small business specialist", value: "" },
          { path: "form1.Page2.SignSub.S16.SBA_Rep", label: "SBA procurement center representative", value: "" },
        ],
      },
    ],
  };
}

export function buildForm(key: FormKey, ctx: FormCtx): GeneratedForm {
  return key === "nf-1787" ? buildNf1787(ctx) : buildNf1787A(ctx);
}

/**
 * XFA data document for the populated export. Each field path becomes a
 * nested element so the original form binds the value when it is opened.
 */
export function xfaDatasets(form: GeneratedForm): string {
  type Node = { children: Map<string, Node>; value?: string };
  const root: Node = { children: new Map() };
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  for (const section of form.sections) {
    for (const field of section.fields) {
      const parts = field.path.split(".").map((p) => p.replace(/\[\d+\]$/, ""));
      let node = root;
      for (const part of parts) {
        if (!node.children.has(part)) node.children.set(part, { children: new Map() });
        node = node.children.get(part)!;
      }
      node.value = typeof field.value === "boolean" ? (field.value ? "1" : "0") : field.value;
    }
  }
  const render = (node: Node): string => {
    if (!node.children.size) return escape(node.value ?? "");
    return [...node.children.entries()].map(([name, child]) => `<${name}>${render(child)}</${name}>`).join("");
  };
  return `<?xml version="1.0" encoding="UTF-8"?><xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data>${render(
    root,
  )}</xfa:data></xfa:datasets>`;
}
