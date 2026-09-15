/**
 * Document body drafter.
 *
 * Every document is drafted from the record: the acquisition facts, the
 * research log, the clause packet, the Center routing table and the contract
 * file index. Where the record cannot answer a field, the draft carries
 * "[Contracting officer to complete: ...]" so the gap is visible in the export
 * rather than a heading with nothing under it.
 *
 * Citations follow the record's own acquisition method: the simplified
 * commercial citations on FAR 13, FAR 13.5 and FAR 12 files, the Part 15
 * citations otherwise.
 */

import type { Values } from "@/lib/template-engine";
import { findingText, type FindingMap } from "@/lib/research-findings";

export type ResearchLogLine = {
  source: string;
  query: string;
  ranAt: string;
  count: number | null;
  outcome: string;
};

export type PacketClauseLine = {
  clause_number: string;
  title: string;
  effective_date: string | null;
  ucf_section: string | null;
};

export type NoticeFacts = {
  /** Date the notice document was saved, taken as the posting date. */
  postedOn: string | null;
  /** Response or closing date carried on the saved notice. */
  closesOn: string | null;
  noticeType: string | null;
  /** Quotations received, when the record carries a count. */
  quotesReceived: number | null;
};

export type MemoDraftCtx = {
  acquisitionId: string;
  acq: Record<string, unknown>;
  missionName: string;
  /** Names of the documents already on this file, used for cross-references. */
  fileDocuments: string[];
  /** Set-aside evidence search, when it has been run. */
  evidence: { runOn: string; sources: number; smallBusinesses: number } | null;
  /** Values drafted by the market research evidence engine, keyed by target. */
  findings?: FindingMap;
  /** One line per public-source search the engine ran on this file. */
  researchLog?: ResearchLogLine[];
  /** The clause packet this file carries, the same list the NCMS handoff shows. */
  clauses?: PacketClauseLine[];
  /** The SAM.gov notice saved on this file, when there is one. */
  notice?: NoticeFacts | null;
  /** SBA size standard for the record's NAICS code. */
  sizeStandard?: string | null;
  /** Award date the clock uses: the target date, or the forecast date behind it. */
  awardDate?: string | null;
  /** Contracting officer's user record. */
  co?: { name: string; email: string | null; phone: string | null } | null;
  /** Values already filled on the form, so a draft can follow a chosen option. */
  values?: Values;
  /** Today, so a determination carries its date. */
  today?: string;
};

const gap = (what: string) => `[Contracting officer to complete: ${what}]`;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

const dollars = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && v
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "";
};

/** True on a FAR 13, FAR 13.5 or FAR Part 12 commercial file. */
export function isSimplifiedCommercial(acq: Record<string, unknown>): boolean {
  const method = `${str(acq["acquisition_method"])} ${str(acq["contract_format"])}`;
  if (/part\s*15|15\.\d/i.test(method) && !/13\.5|13\b|simplified/i.test(method)) return false;
  return /13\.5|\b13\b|\b12\b|simplified|commercial/i.test(method);
}

/** The price-analysis citation this record calls for. */
export function priceAnalysisCitation(acq: Record<string, unknown>): string {
  return isSimplifiedCommercial(acq) ? "FAR 13.106-3 and FAR 12.209" : "FAR 15.404-1";
}

/** One line per source: source, query, date, count. */
export function researchLogLines(log: ResearchLogLine[] | undefined): string[] {
  return (log ?? []).map((l) => {
    const query = l.query.replace(/api_key=[^&\s]*/gi, "api_key=[redacted]");
    const count = l.count === null ? l.outcome : `${l.count} result${l.count === 1 ? "" : "s"}`;
    return `${l.source} · ${query} · ${l.ranAt} · ${count}`;
  });
}

function ruleOfTwo(ctx: MemoDraftCtx): string {
  const engine = findingText(ctx.findings, "memo.findings");
  if (engine) return engine;
  if (ctx.evidence) {
    return ctx.evidence.smallBusinesses >= 2
      ? `${ctx.evidence.smallBusinesses} small business concerns were identified as capable of meeting the requirement. The expectation of offers from two or more responsible small business concerns at fair market prices is met (FAR 19.502-2).`
      : `${ctx.evidence.smallBusinesses} small business concerns were identified. The expectation of offers from two or more responsible small business concerns is not supported on this record (FAR 19.502-2).`;
  }
  return gap("state the number of sources, their small business capability and the Rule of Two result");
}

/** Paragraph 4: one line per source, drafted from the research log. */
function researchParagraph(ctx: MemoDraftCtx): string {
  const lines = researchLogLines(ctx.researchLog);
  if (lines.length) return ["Sources searched:", ...lines].join("\n");
  const engineResearch = findingText(ctx.findings, "memo.research");
  if (engineResearch) return `Sources searched: ${engineResearch}`;
  if (ctx.evidence) {
    return `A SAM.gov registered-entity and subaward search was run on ${ctx.evidence.runOn} for NAICS ${str(
      ctx.acq["naics_code"],
    )}. It returned ${ctx.evidence.sources} sources, of which ${ctx.evidence.smallBusinesses} are small business under that code.`;
  }
  return gap("record the sources searched, the dates and the techniques used, or run market research");
}

function marketResearch(ctx: MemoDraftCtx): Values {
  const a = ctx.acq;
  const value = dollars(a["estimated_value"]);
  const competition = str(a["competition"]);
  const setAside = str(a["set_aside"]);
  const commercialDetermination = str(a["commercial_determination"]);
  const prior = str(a["successor_of"]);
  const start = str(a["period_of_performance_start"]);
  const end = str(a["period_of_performance_end"]);
  const commercialityOnFile = ctx.fileDocuments.some((d) => /commercial/i.test(d));

  const research = [researchParagraph(ctx)];
  if (prior) research.push(`The contract file for the prior acquisition ${prior} was reviewed.`);

  const basis = [
    competition ? `on a ${competition.toLowerCase()} basis` : "",
    setAside && !/none/i.test(setAside) ? `as a ${setAside.toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const conclusion = basis
    ? `The acquisition will be conducted ${basis}, consistent with the research above, and the procedures of ${
        str(a["acquisition_method"]) || "the acquisition method on the record"
      } apply.`
    : gap("state the competition and set-aside the research supports");

  return {
    purpose: `This memorandum records the market research conducted for ${str(a["title"]) || ctx.acquisitionId} and the conclusions drawn from it (FAR 10.002(e)).`,
    requirement: `${str(a["description_of_requirement"]) || gap("add the description of the requirement to the record")} The requirement supports ${
      ctx.missionName || gap("name the mission")
    }${start && end ? `, with performance from ${start} through ${end}` : ""}${value ? `, at an estimated value of ${value}` : ""}.`,
    research: research.join("\n"),
    findings: ruleOfTwo(ctx),
    commercial: commercialDetermination
      ? `The requirement is a ${commercialDetermination.toLowerCase()} within FAR 2.101, so the procedures of FAR Part 12 apply.${
          commercialityOnFile ? " The commerciality determination on this file states the basis in full." : ""
        }`
      : gap("record the commerciality determination, then cross-reference it here"),
    conclusion,
  };
}

function commerciality(ctx: MemoDraftCtx): Values {
  const a = ctx.acq;
  const determination = str(a["commercial_determination"]);
  const simplified = isSimplifiedCommercial(a);
  const category = /product|item/i.test(determination)
    ? "Commercial product (FAR 2.101 'commercial product')"
    : determination
    ? "Commercial service (FAR 2.101 'commercial service')"
    : "";
  const procedures = simplified
    ? "FAR Part 12 with FAR 13.5 simplified procedures"
    : "FAR Part 12 with FAR Part 15 procedures";
  return {
    requirement_description: str(a["description_of_requirement"]) || gap("add the description of the requirement to the record"),
    determination_basis:
      determination || gap("state whether the requirement is a commercial product or service, and on what basis"),
    category,
    procedures,
    market_research: researchParagraph(ctx) + "\n" + ruleOfTwo(ctx),
    customary_practice:
      "Firm-fixed-price by flight hour with a daily availability rate is the customary commercial arrangement for chartered aircraft services; no tailoring of FAR 52.212-4 is proposed. Drafted from the record, confirm.",
    determination: `The requirement is a commercial service within the meaning of FAR 2.101 and will be acquired under FAR Part 12 using the simplified procedures of FAR 12.201-1.`,
    determined_on: ctx.today ?? "",
  };
}

/** How competition was handled, drafted from the record. */
function competitionBasis(ctx: MemoDraftCtx): string {
  const a = ctx.acq;
  const naics = str(a["naics_code"]);
  const size = ctx.sizeStandard ? `size standard ${ctx.sizeStandard}` : "size standard [not recorded on the SBA table]";
  const setAside = str(a["set_aside"]);
  const posted = ctx.notice?.postedOn ?? "[not yet posted]";
  const quotes = ctx.notice?.quotesReceived;
  if (/sole/i.test(str(a["competition"]))) {
    const authority = str(a["jofoc_authority_citation"]);
    return [
      `Awarded on a sole-source basis under FAR Part 12 with the simplified procedures of RFO FAR 12.201-1 (Table 12-1) and the limitation on competition at FAR 6.104${
        authority ? `, on the authority of ${authority}` : ""
      }.`,
      `NAICS ${naics || "[not recorded]"}, ${size}.`,
      `A notice of intent to sole source was posted to SAM.gov on ${posted}.`,
    ].join(" ");
  }
  return [
    `Competed as a ${setAside ? setAside.toLowerCase() : "[set-aside not recorded]"} under FAR Part 12 with the simplified procedures of RFO FAR 12.201-1 (Table 12-1), NAICS ${
      naics || "[not recorded]"
    }, ${size}.`,
    `A combined synopsis/solicitation was posted to SAM.gov on ${posted}; ${
      quotes === null || quotes === undefined ? "[quotations received not yet recorded]" : `${quotes} quotation${quotes === 1 ? "" : "s"} were received`
    }.`,
  ].join(" ");
}

function packetTransmittal(ctx: MemoDraftCtx): Values {
  const a = ctx.acq;
  const vendor = str(a["vendor_legal_name"]);
  const value = dollars(a["estimated_value"]);
  const strategy = str(a["enterprise_psl_check"]);
  const by = ctx.awardDate || str(a["target_award_date"]);
  return {
    action: `This package supports the award of ${str(a["title"]) || ctx.acquisitionId}${
      vendor ? ` to ${vendor}` : ""
    }${value ? ` at ${value}` : ""}.`,
    competition_basis: competitionBasis(ctx),
    strategy: strategy
      ? `The Enterprise Procurement Strategies were reviewed. ${strategy}`
      : "The Enterprise Procurement Strategies were reviewed; no mandatory strategy applies to this requirement.",
    request: `Review and concurrence are requested so the award can be made by ${
      by || gap("set the target award date on the record")
    }.`,
  };
}

function coordination(ctx: MemoDraftCtx): Values {
  const a = ctx.acq;
  return {
    matter: gap("state what was coordinated and with whom"),
    positions: gap("state the position each organization took"),
    agreement: gap("state what was agreed"),
    next_step: `Next step, owned by ${str(a["co_name"]) || "the contracting officer"}${
      str(a["target_award_date"]) ? `, before ${str(a["target_award_date"])}` : ""
    }. ${gap("state the next step")}`,
  };
}

function waiverDeviation(ctx: MemoDraftCtx): Values {
  return {
    relief: gap("state the relief requested"),
    rationale: gap("state why the relief is needed and the effect on the mission"),
    alternatives: gap("state the alternatives considered and why they do not work"),
    approval_level: gap("name the official whose approval is requested"),
    provision: gap("cite the regulation or clause the request is from"),
    period: gap("state the period the relief applies to"),
  };
}

/** The statutory authority the record calls for, before the CO changes it. */
export function jofocAuthorityDefault(acq: Record<string, unknown>): string {
  if (isSimplifiedCommercial(acq)) return "41 U.S.C. 1901 (FAR 12.102 procedures)";
  return "";
}

function jofoc(ctx: MemoDraftCtx): Values {
  const a = ctx.acq;
  const v = ctx.values ?? {};
  const authority = str(v["authority"]) || jofocAuthorityDefault(a);
  const vendor = str(a["vendor_legal_name"]) || "the intended source";
  const value = dollars(a["estimated_value"]);
  const basis = str(a["jofoc_authority_citation"]);
  const rationale = authority.includes("1901")
    ? `The authority cited is 41 U.S.C. 1901, carried out through the procedures of FAR 12.102 as applied by RFO FAR 12.201-1. The requirement is a commercial service with an estimated value of ${
        value || "the amount on the record"
      }, within the ceiling for simplified procedures for commercial products and services, so the acquisition is conducted under those procedures rather than full and open competition. ${vendor} is the only responsible source able to meet the requirement within the mission need date on the record.${
        basis ? ` Basis of record: ${basis}` : ""
      } Drafted from the record, confirm.`
    : authority
    ? `The authority cited is ${authority}. ${vendor} is the only responsible source able to meet the requirement; the basis on the record is ${
        basis || "[state the basis]"
      }. Drafted from the record, confirm.`
    : gap("choose the statutory authority in item 4, then draft this item against it");

  const noticeLine = ctx.notice?.postedOn
    ? `A notice of intent to sole source was posted to SAM.gov on ${ctx.notice.postedOn}${
        ctx.notice.closesOn ? `, closing ${ctx.notice.closesOn}` : ""
      }.`
    : "Notice of intent not yet posted (Synopsis phase).";

  const researchLines = researchLogLines(ctx.researchLog);
  const market = researchLines.length
    ? ["Market research was conducted from public sources:", ...researchLines, ruleOfTwo(ctx)].join("\n")
    : gap("run market research on this file, or record the research and its results");

  return {
    authority,
    authority_rationale: rationale,
    price_analysis_plan: `Price reasonableness will be determined under ${priceAnalysisCitation(
      a,
    )} before award, using the quotation received, the independent Government cost estimate and prior prices for the same service. Drafted from the record, confirm.`,
    market_research: market,
    notice_status: noticeLine,
    interested_sources: ctx.notice?.postedOn
      ? `${noticeLine} Responses received and their disposition are recorded in the contract file. Drafted from the record, confirm.`
      : noticeLine,
  };
}

/** Provisions come before clauses in the notice. */
const PROVISION_NUMBERS = new Set([
  "52.212-1",
  "52.212-2",
  "52.212-3",
  "52.204-7",
  "52.204-16",
  "52.204-22",
  "52.209-2",
  "52.209-7",
  "52.233-2",
]);

const isProvision = (c: PacketClauseLine) =>
  PROVISION_NUMBERS.has(c.clause_number) || /^[KLM]$/i.test(String(c.ucf_section ?? "").trim());

function clauseNote(ctx: MemoDraftCtx): string {
  const list = ctx.clauses ?? [];
  if (!list.length) return gap("open the NCMS handoff packet so the clause list can be carried into the notice");
  const line = (c: PacketClauseLine) =>
    `${c.clause_number} ${c.title}${c.effective_date ? ` (${c.effective_date})` : ""}`;
  const provisions = list.filter(isProvision).map(line);
  const clauses = list.filter((c) => !isProvision(c)).map(line);
  return [
    provisions.length ? "Provisions:" : "",
    ...provisions,
    clauses.length ? "Clauses:" : "",
    ...clauses,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Date fifteen calendar days after the day given. */
function plusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function samNotice(ctx: MemoDraftCtx): Values {
  const a = ctx.acq;
  const start = str(a["period_of_performance_start"]);
  const end = str(a["period_of_performance_end"]);
  const posting = ctx.notice?.postedOn || ctx.today || "";
  const fifteen = posting ? plusDays(posting, 15) : "";
  const entered = str(ctx.values?.["response_date"]);
  const response = entered && fifteen ? (entered > fifteen ? entered : fifteen) : fifteen || entered;
  return {
    period_of_performance: start && end ? `${start} to ${end}` : start || end,
    response_date: response,
    response_rule: posting
      ? `Later of 15 calendar days after posting (${fifteen}) and the date the contracting officer enters. Posted ${
          ctx.notice?.postedOn ? ctx.notice.postedOn : `${posting}, not yet posted`
        }. RFO FAR 5.203; FAR 12.603(c).`
      : "Later of 15 calendar days after posting and the date the contracting officer enters. RFO FAR 5.203; FAR 12.603(c).",
    evaluation_basis:
      "Award will be made to the responsible quoter whose quotation is the lowest price technically acceptable, conforming to this notice (FAR 13.106-2(b)). Change this to a best value tradeoff if the file calls for one. Drafted from the record, confirm.",
    clause_note: clauseNote(ctx),
    poc_email: ctx.co?.email ?? "",
    poc_phone: ctx.co?.phone ?? "[not recorded on the contracting officer's user record]",
  };
}

const DRAFTERS: Record<string, (ctx: MemoDraftCtx) => Values> = {
  "market-research-memo": marketResearch,
  commerciality,
  "packet-transmittal-memo": packetTransmittal,
  "coordination-memo": coordination,
  "waiver-deviation-request": waiverDeviation,
  jofoc,
  "sam-notice": samNotice,
};

/** Drafted text for a document, keyed by template field. */
export function draftMemoBody(templateKey: string, ctx: MemoDraftCtx): Values {
  const drafter = DRAFTERS[templateKey];
  return drafter ? drafter(ctx) : {};
}

/** Fills only the fields the contracting officer has left empty. */
export function applyMemoDraft(values: Values, draft: Values): Values {
  const next = { ...values };
  for (const [key, text] of Object.entries(draft)) {
    if (!String(next[key] ?? "").trim()) next[key] = text;
  }
  return next;
}

/** Keys the draft actually filled, so the Source panel can say so. */
export function draftedKeys(values: Values, draft: Values): string[] {
  return Object.entries(draft)
    .filter(([key, text]) => String(text ?? "").trim() && (values[key] ?? "") === text)
    .map(([key]) => key);
}
