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
  /** The JOFOC saved on this file, when there is one, so the notice can read item 5. */
  jofocValues?: Values | null;
  /** The SAM.gov notice saved on this file, for the basis for award and criteria. */
  noticeValues?: Values | null;
  /** The evaluation of quotations record, so the recommendation carries forward. */
  evaluationValues?: Values | null;
  /** Today, so a determination carries its date. */
  today?: string;
  /** Audit trail on this file, oldest first, for the chronology memorandum. */
  audit?: AuditLine[];
  /** Phases in the file's launch sequence, in order. */
  phases?: PhaseLine[];
  /** The people records, so a memorandum names a person by role and name. */
  people?: { name: string; title?: string | null; aliases?: string[] }[];
};

export type AuditLine = {
  action: string;
  field: string | null;
  actor: string | null;
  reason: string | null;
  phase: string | null;
  at: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export type PhaseLine = {
  phase: string;
  status: "complete" | "current" | "upcoming";
};

const onlyDate = (iso: string) => String(iso ?? "").slice(0, 10);

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

/**
 * What a recorded search actually asked for, in plain words. The raw request
 * URL stays in the research log; a document prints the parameters instead.
 */
export function searchedFor(line: ResearchLogLine): string {
  const q = line.query ?? "";
  const parts: string[] = [];
  const param = (name: string) => {
    const m = new RegExp(`[?&]${name}=([^&\\s]+)`, "i").exec(q);
    return m ? decodeURIComponent(m[1]!) : "";
  };
  const naics = param("naicsCode") || param("ncode") || /naics[_ ]?code\s*=\s*'?(\d{2,6})/i.exec(q)?.[1] || /naics[= ](\d{2,6})/i.exec(q)?.[1] || "";
  if (naics) parts.push(`NAICS ${naics}`);
  const psc = param("pscCode") || /psc(?:=|\s+)([A-Z0-9]+)/i.exec(q)?.[1] || "";
  if (psc) parts.push(`PSC ${psc}`);
  const state = param("physicalAddressProvinceOrStateCode") || param("state") || /\bin\s+([A-Z]{2})\b/.exec(q)?.[1] || /\b([A-Z]{2})\s+place of performance\b/.exec(q)?.[1] || "";
  if (state) parts.push(`${state} place of performance`);
  else if (/entities\?/i.test(q)) parts.push("nationwide");
  const usDate = (v: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    return m ? `${m[3]}-${m[1]}-${m[2]}` : v;
  };
  const from = usDate(param("postedFrom")) || /(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/.exec(q)?.[1] || "";
  const to = usDate(param("postedTo")) || /(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/.exec(q)?.[2] || "";
  if (from && to) parts.push(`${/usaspending|awards under/i.test(`${line.source} ${q}`) ? "" : "posted "}${from} to ${to}`);
  const kept = [...new Set(parts.filter(Boolean))];
  if (/usaspending|awards under/i.test(`${line.source} ${q}`) && (naics || psc)) {
    const codes = [naics ? `NAICS ${naics}` : "", psc ? `PSC ${psc}` : ""].filter(Boolean).join(" and ");
    return [`awards under ${codes}`, from && to ? `${from} to ${to}` : ""].filter(Boolean).join(", ");
  }
  return kept.length ? kept.join(", ") : "the parameters recorded in the research log";
}

/** One line per source: source, what was searched, date, count. */
export function researchLogLines(log: ResearchLogLine[] | undefined): string[] {
  const seen = new Set<string>();
  return (log ?? []).flatMap((l) => {
    const source = l.source.replace(/\s+(?:API|endpoint)$/i, "").trim();
    const searched = searchedFor(l);
    const key = `${source}|${searched}|${onlyDate(l.ranAt)}|${l.count ?? l.outcome}`.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    // An export never prints an error body, a URL or JSON. A source that failed
    // reads "not available (service error)"; the detail stays in the log.
    const notRunReason = /not configured|not run|skipped|no api|publishes no search api/i.test(l.outcome)
      ? "not available (not run)"
      : "not available (service error)";
    const count = l.count === null
      ? (/^not available\b/i.test(l.outcome) && !/http|\{|\}/.test(l.outcome)
          ? l.outcome.toLowerCase()
          : notRunReason)
      : `${l.count} result${l.count === 1 ? "" : "s"}`;
    return [`${source}, ${searched}; ${onlyDate(l.ranAt)}; ${count}`];
  });
}

/**
 * True where the record is not competed: a sole-source or brand-name buy. A
 * Rule of Two conclusion is never printed on such a file.
 */
export function isSoleSourceRecord(acq: Record<string, unknown>): boolean {
  const text = `${str(acq["competition"])} ${str(acq["acquisition_method"])} ${str(acq["set_aside"])}`;
  if (/sole[- ]source|not competed|other than full and open|brand[- ]name|single source/i.test(text)) return true;
  return Boolean(str(acq["jofoc_authority_citation"]));
}

/** Registrant and small business counts from the latest research run. */
function researchCounts(ctx: MemoDraftCtx): { n: number; m: number } | null {
  const engine = findingText(ctx.findings, "memo.findings") ?? "";
  const match = /(\d[\d,]*)\s+(?:sources?|registrants?)[\s\S]{0,80}?of which\s+(\d[\d,]*)/i.exec(engine);
  if (match) return { n: Number(match[1]!.replace(/,/g, "")), m: Number(match[2]!.replace(/,/g, "")) };
  if (ctx.evidence) return { n: ctx.evidence.sources, m: ctx.evidence.smallBusinesses };
  return null;
}

/** The findings sentence a sole-source or brand-name file carries. */
export function soleSourceFindings(acq: Record<string, unknown>, counts: { n: number; m: number } | null, inJofoc: boolean): string {
  if (!counts)
    return gap(
      "state the registrants under the NAICS code, how many are small business, and why none can meet the requirement",
    );
  const naics = str(acq["naics_code"]) || "the code on the record";
  const where = inJofoc ? "as described in item 5" : "as stated in the requirement";
  const basis = inJofoc ? "in item 5" : "in the justification";
  return `${counts.n} registrants were identified under NAICS ${naics}, of which ${counts.m} are small business. None was identified as able to meet the requirement ${where} within the mission need date; the contracting officer's basis for that conclusion is recorded ${basis}. This finding will be revisited if a source responds to the notice of intent.`;
}

function ruleOfTwo(ctx: MemoDraftCtx, inJofoc = false): string {
  // The findings sentence follows the record's competition.
  if (isSoleSourceRecord(ctx.acq)) return soleSourceFindings(ctx.acq, researchCounts(ctx), inJofoc);
  const engine = findingText(ctx.findings, "memo.findings");
  if (engine) return engine;
  if (ctx.evidence) {
    return ctx.evidence.smallBusinesses >= 2
      ? `${ctx.evidence.smallBusinesses} small business concerns were identified as capable of meeting the requirement. The expectation of offers from two or more responsible small business concerns at fair market prices is met (FAR 19.502-2).`
      : `${ctx.evidence.smallBusinesses} small business concerns were identified. The expectation of offers from two or more responsible small business concerns is not supported on this record (FAR 19.502-2).`;
  }
  return gap("state the number of sources, their small business capability and the Rule of Two result");
}

/** Paragraph 4: the sources searched, written as one prose paragraph. */
function researchParagraph(ctx: MemoDraftCtx): string {
  const log = ctx.researchLog ?? [];
  if (log.length) {
    const seen = new Set<string>();
    const clauses: string[] = [];
    for (const l of log) {
      const source = l.source.replace(/\s+(?:API|endpoint)$/i, "").trim();
      const key = `${source}|${searchedFor(l)}|${onlyDate(l.ranAt)}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const outcome =
        l.count === null
          ? "which was not available"
          : `which returned ${l.count} result${l.count === 1 ? "" : "s"}`;
      clauses.push(`${source} was searched for ${searchedFor(l)} on ${onlyDate(l.ranAt)}, ${outcome}`);
    }
    return `${clauses.join("; ")}.`;
  }
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

  // The conclusion is prose written from the method, never the method or
  // competition code itself.
  const methodProse = (() => {
    const m = `${str(a["acquisition_method"])} ${commercialDetermination}`.toLowerCase();
    if (m.includes("8.4")) return "the ordering procedures of FAR Subpart 8.4 apply";
    if (m.includes("part 15") || m.includes("far 15") || m.includes("negotiat"))
      return "the procedures of FAR Part 15 apply";
    if (m.includes("13.5") || m.includes("commercial") || m.includes("part 12"))
      return "the simplified procedures for commercial products and services under RFO FAR 12.201-1 apply";
    if (m.includes("13") || m.includes("simplified"))
      return "the simplified acquisition procedures of FAR Part 13 apply";
    return "";
  })();
  const basis = [
    /sole|brand/i.test(competition)
      ? "as a sole source"
      : competition
        ? `on a ${competition.toLowerCase()} basis`
        : "",
    /total small business/i.test(setAside)
      ? "as a total small business set-aside"
      : setAside && !/none/i.test(setAside)
        ? `as a ${setAside.toLowerCase()}`
        : "",
  ]
    .filter(Boolean)
    .join(" ");
  const conclusion =
    basis && methodProse
      ? `The acquisition will be conducted ${basis}, consistent with the research above, and ${methodProse}.`
      : basis
        ? `The acquisition will be conducted ${basis}, consistent with the research above.`
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

/**
 * The pricing arrangement the record states, taken from the requirement text.
 * Returns "" when the record carries no pricing description.
 */
export function pricingArrangement(acq: Record<string, unknown>): string {
  const text = str(acq["pricing_description"]) || str(acq["description_of_requirement"]);
  if (!text) return "";
  const m =
    /((?:firm[- ]fixed[- ]price|fixed[- ]price|cost[- ]plus[^.,;]*|time[- ]and[- ]materials|labor[- ]hour|indefinite[- ]delivery)[^.;]*)/i.exec(
      text,
    );
  return m?.[1] ? m[1].trim().replace(/\s+/g, " ") : "";
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
    customary_practice: (() => {
      const pricing = pricingArrangement(a);
      if (!pricing) {
        return gap(
          "state the customary commercial practice for this requirement, from the pricing arrangement on the record",
        );
      }
      const sentence = pricing.charAt(0).toUpperCase() + pricing.slice(1);
      return `${sentence} is the pricing arrangement on the record and the customary commercial practice for this requirement; no tailoring of FAR 52.212-4 is proposed. Drafted from the record, confirm.`;
    })(),
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
  const posted = ctx.notice?.postedOn;
  const quotes = ctx.notice?.quotesReceived;
  if (/sole/i.test(str(a["competition"]))) {
    const authority = str(a["jofoc_authority_citation"]);
    return [
      `Awarded on a sole-source basis under FAR Part 12 with the simplified procedures of RFO FAR 12.201-1 (Table 12-1) and the limitation on competition at FAR 6.104${
        authority ? `, on the authority of ${authority}` : ""
      }.`,
      `NAICS ${naics || "[not recorded]"}, ${size}.`,
      posted
        ? `A notice of intent to sole source was posted to SAM.gov on ${posted}.`
        : "A notice of intent to sole source will be posted to SAM.gov.",
    ].join(" ");
  }
  return [
    `Competed as a ${setAside ? setAside.toLowerCase() : "[set-aside not recorded]"} under FAR Part 12 with the simplified procedures of RFO FAR 12.201-1 (Table 12-1), NAICS ${
      naics || "[not recorded]"
    }, ${size}.`,
    posted
      ? `A combined synopsis/solicitation was posted to SAM.gov on ${posted}; ${
          quotes === null || quotes === undefined
            ? "quotations will be recorded on receipt"
            : `${quotes} quotation${quotes === 1 ? " was" : "s were"} received`
        }.`
      : "A combined synopsis/solicitation will be posted to SAM.gov; quotations will be recorded on receipt.",
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
  const rationale = authority.includes("1901")
    ? `The authority cited is 41 U.S.C. 1901, carried out through the procedures of FAR 12.102 as applied by RFO FAR 12.201-1. The requirement is a commercial service with an estimated value of ${
        value || "the amount on the record"
      }, within the ceiling for simplified procedures for commercial products and services, so the acquisition is conducted under those procedures rather than full and open competition. ${vendor} is the only responsible source able to meet the requirement within the mission need date on the record. Drafted from the record, confirm.`
    : authority
    ? `The authority cited is ${authority}. ${vendor} is the only responsible source able to meet the requirement within the mission need date on the record. Drafted from the record, confirm.`
    : gap("choose the statutory authority in item 4, then draft this item against it");

  const noticeLine = ctx.notice?.postedOn
    ? `A notice of intent to sole source was posted to SAM.gov on ${ctx.notice.postedOn}${
        ctx.notice.closesOn ? `, closing ${ctx.notice.closesOn}` : ""
      }.`
    : "Notice of intent not yet posted (Synopsis phase).";

  const researchLines = researchLogLines(ctx.researchLog);
  const market = researchLines.length
    ? ["Market research was conducted from public sources:", ...researchLines, ruleOfTwo(ctx, true)].join("\n")
    : gap("run market research on this file, or record the research and its results");

  return {
    authority,
    authority_rationale: rationale,
    // Items 6 and 10 read the posting and closing dates back from the notice
    // of intent once it has been saved in the Synopsis phase.
    notice_date: ctx.notice?.postedOn ?? "",
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
    sole_source_basis:
      str(ctx.jofocValues?.["authority_rationale"]) ||
      gap("state why only this source can meet the need, or draft the JOFOC first"),
    authority: samNoticeAuthority(a),
    poc_email: ctx.co?.email ?? "",
    poc_phone: ctx.co?.phone ?? "",
  };
}

/**
 * Authority as the public notice prints it. A FAR 13.5 commercial file cites
 * the statute with the procedures it is carried out under, never the internal
 * picker note the record stores.
 */
export function samNoticeAuthority(acq: Record<string, unknown>): string {
  const recorded = str(acq["jofoc_authority_citation"]);
  if (isSimplifiedCommercial(acq) || /1901/.test(recorded)) {
    return "41 U.S.C. 1901, commercial simplified procedures under RFO FAR 12.201-1";
  }
  return recorded;
}

// -------------------------------------------- memorandum for record (MFR)

/** Purpose as the memorandum states it, including the CO's own wording. */
export function mfrPurposeLabel(values: Values | undefined): string {
  const purpose = str(values?.["purpose"]);
  if (purpose === "Other") return str(values?.["purpose_other"]) || "Other";
  return purpose;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "15 September", the way a memorandum reads a date inside a sentence. */
function day(iso: string): string {
  const d = onlyDate(iso);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""}`.trim();
}

/** "14 Sep 2026", the way a hold or a vote is dated in a memorandum. */
function stamp(iso: string): string {
  const d = onlyDate(iso);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${Number(m[3])} ${(MONTHS[Number(m[2]) - 1] ?? "").slice(0, 3)} ${m[1]}`.trim();
}

/** The person by role and name, never by account name. */
function personPhrase(ctx: MemoDraftCtx, actor: string | null | undefined): string {
  const name = str(actor);
  if (!name) return "the contracting officer";
  const roster = ctx.people ?? [];
  const row = roster.find(
    (p) =>
      p.name.trim().toLowerCase() === name.toLowerCase() ||
      (p.aliases ?? []).some((alias) => alias.trim().toLowerCase() === name.toLowerCase()),
  );
  const coName = str(ctx.acq["co_name"]);
  const title = str(row?.title);
  const displayName = row?.name ?? name;
  const narrativeTitle = /contracting specialist/i.test(title)
    ? "contract specialist"
    : /contracting officer/i.test(title)
      ? "contracting officer"
      : title.toLowerCase();
  if (title) return `the ${narrativeTitle}, ${displayName}`;
  if (name === coName) return `the contracting officer, ${name}`;
  return `the specialist, ${name}`;
}

/** "Legal review" from "Legal review (Center Chief Counsel)". */
const seatName = (field: string | null) => str(field).replace(/\s*\(.*\)\s*$/, "") || "The review seat";

const cleanClause = (value: string | null | undefined) => str(value).replace(/[.!?]+\s*$/, "");

/** A document title for narrative prose, never an implementation field code. */
export function chronologyDocumentTitle(field: string | null, reason?: string | null): string {
  const code = str(field).toLowerCase();
  const recorded = cleanClause(reason);
  if (code === "acquisition_forecast_verified" || /nf\s*1707|requester sections/i.test(recorded)) {
    return "NF 1707 requester sections";
  }
  if (code === "igce_attached" || /independent government cost estimate|\bigce\b/i.test(recorded)) return "IGCE";
  if (code === "sow_attached" || /statement of work|performance work statement|sow\/?pws/i.test(recorded)) {
    return "SOW/PWS";
  }
  const raw = str(field);
  if (/^nf[-_ ]?1787a?$/i.test(raw)) return raw.toUpperCase().replace(/[-_ ]/g, " ");
  if (/^jofoc$/i.test(raw)) return "JOFOC";
  if (raw && !/^[a-z][a-z0-9_]*$/i.test(raw)) return raw;
  if (recorded && !/^[a-z][a-z0-9_]*$/i.test(recorded)) return recorded;
  return raw || recorded || "document";
}

const docName = (a: AuditLine) => chronologyDocumentTitle(a.field, a.reason);

function researchSourceName(source: string): string {
  if (/entity management/i.test(source)) return "SAM.gov Entity Management";
  if (/opportunit/i.test(source)) return "SAM.gov Opportunities";
  if (/usaspending/i.test(source)) return "USAspending";
  if (/sba table|size standard/i.test(source)) return "the SBA size standards table";
  if (/t-minus prior/i.test(source)) return "prior T-Minus actions";
  if (/gsa calc/i.test(source)) return "GSA CALC";
  if (/gsa elibrary/i.test(source)) return "GSA eLibrary";
  return source.replace(/\s+(?:API|endpoint).*$/i, "").trim();
}

/** One complete chronology sentence for the latest market-research run. */
export function chronologyResearchSentence(ctx: MemoDraftCtx): string | null {
  const research = ctx.researchLog ?? [];
  if (!research.length) return null;
  const runDate = research.map((line) => onlyDate(line.ranAt)).filter(Boolean).sort().at(-1) ?? "";
  const latest = research.filter((line) => onlyDate(line.ranAt) === runDate);
  const sources = [
    ...new Set(latest.filter((line) => line.count !== null).map((line) => researchSourceName(line.source)).filter(Boolean)),
  ];
  const counts = researchCounts(ctx);
  const notices = latest
    .filter((line) => /opportunit|notice/i.test(line.source))
    .reduce((total, line) => total + (line.count ?? 0), 0);
  const finding = ctx.findings?.["memo.findings"];
  const confirmed = Boolean(finding?.confirmed || ctx.findings?.["memo.research"]?.confirmed);
  const conclusion = isSoleSourceRecord(ctx.acq)
    ? counts
      ? `${counts.n} registrants were identified after de-duplication, and the research supported the sole-source finding on the record`
      : "the research supported the sole-source finding on the record"
    : counts
      ? `${counts.n} registrants were identified after de-duplication, including ${counts.m} small businesses, so the Rule of Two was ${counts.m >= 2 ? "met" : "not met"}`
      : cleanClause(finding?.value) || "the Rule of Two result was recorded on the file";
  return `Market research was run on ${day(runDate)} using ${sources.join(", ") || "the sources recorded in the research log"}; ${conclusion}, and ${notices} notice${notices === 1 ? " was" : "s were"} found after de-duplication. The contracting officer ${confirmed ? "confirmed the finding" : "has not confirmed the finding"}.`;
}

/**
 * One narrative paragraph per phase, drafted from the audit trail. Each fact is
 * stated once: same-day churn on one document collapses into a single sentence,
 * a hold reads as one sentence with its cause and clearance, and people are
 * named by role and name.
 */
function chronologyParagraphs(ctx: MemoDraftCtx): string {
  const audit = (ctx.audit ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
  const phases = (ctx.phases ?? []).filter((p) => p.status !== "upcoming");
  if (!phases.length || !audit.length)
    return gap("no audit history is recorded on this file yet, so the chronology cannot be drafted");

  // Phase windows. A phase cannot begin before the one before it ended, so the
  // dates are walked forward and held in order.
  const windows: { phase: string; status: string; entered: string; exited: string }[] = [];
  let floor = "";
  for (const p of phases) {
    const own = audit.filter((a) => str(a.phase).toLowerCase() === p.phase.toLowerCase());
    let entered = own.length ? onlyDate(own[0]!.at) : floor;
    let exited = own.length ? onlyDate(own[own.length - 1]!.at) : entered;
    if (floor && entered < floor) entered = floor;
    if (exited < entered) exited = entered;
    windows.push({ phase: p.phase, status: p.status, entered, exited });
    floor = exited;
  }

  // Events with no phase of their own belong to the window they fall inside.
  const windowFor = (at: string) => {
    const d = onlyDate(at);
    for (const w of windows) if (d >= w.entered && d <= w.exited) return w.phase;
    const last = windows[windows.length - 1];
    return d > (last?.exited ?? "") ? (last?.phase ?? "") : (windows[0]?.phase ?? "");
  };

  const researchSentence = chronologyResearchSentence(ctx);
  const researchDay = (ctx.researchLog ?? []).map((line) => onlyDate(line.ranAt)).filter(Boolean).sort().at(-1) ?? "";

  const noise = /checked out|check-out released|reporting extract/i;
  const paragraphs: string[] = [];
  const said = new Set<string>();

  for (const w of windows) {
    const rows = audit.filter(
      (a) =>
        !noise.test(a.action) &&
        (str(a.phase).toLowerCase() === w.phase.toLowerCase() || (!str(a.phase) && windowFor(a.at) === w.phase)),
    );
    const sentences: string[] = [];
    const push = (text: string) => {
      const key = text.toLowerCase().replace(/\s+/g, " ").trim();
      if (said.has(key)) return;
      said.add(key);
      sentences.push(text);
    };

    push(
      w.status === "current"
        ? `The file entered the ${w.phase} phase on ${day(w.entered)} and remained in it as of ${day(w.exited)}.`
        : `The file entered the ${w.phase} phase on ${day(w.entered)} and left it on ${day(w.exited)}.`,
    );

    const handled = new Set<AuditLine>();

    // Documents. Every attach, remove and save on one document in one phase is
    // stated once, with the version that is on file at the end.
    const docRows = rows.filter((a) => /document attached|document removed|document saved|version saved/i.test(a.action));
    const groups = new Map<string, AuditLine[]>();
    for (const a of docRows) {
      handled.add(a);
      const key = docName(a).toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    for (const list of groups.values()) {
      const label = docName(list[0]!);
      const on = day(list[list.length - 1]!.at);
      const attaches = list.filter((a) => /document attached/i.test(a.action));
      const removes = list.filter((a) => /document removed/i.test(a.action));
      const saves = list.filter((a) => /document saved|version saved/i.test(a.action));
      const version =
        [...attaches].reverse().map((a) => str(a.newValue)).find((v) => /\.[a-z0-9]{2,5}$/i.test(v)) ?? "";
      if (attaches.length && removes.length) {
        push(
          `The ${label} was attached, removed and re-attached on ${on}${
            version ? `; the version on file is ${version}` : ""
          }.`,
        );
      } else if (attaches.length) {
        push(`The ${label} was attached on ${on}${version ? ` as ${version}` : ""}.`);
      } else if (removes.length) {
        push(`The ${label} was removed from the file on ${on}.`);
      }
      if (saves.length) {
        const saved = saves[saves.length - 1]!;
        const versionMatch = /version\s+(\d+)/i.exec(str(saved.newValue));
        push(
          `The ${label} was saved as version ${versionMatch?.[1] ?? (str(saved.newValue).replace(/^version\s*/i, "") || "not recorded")} on ${day(saved.at)} by ${personPhrase(ctx, saved.actor)}.`,
        );
      }
    }

    // Holds. Cause and clearance in one sentence, never the stored field code.
    const isHoldRow = (a: AuditLine) =>
      /on hold|clock held/i.test(a.action) ||
      (/clock_state|clock state/i.test(str(a.field)) && /hold/i.test(str(a.newValue)));
    const isClearRow = (a: AuditLine) =>
      /clock resumed|hold cleared/i.test(a.action) ||
      (/clock_state|clock state/i.test(str(a.field)) && /running|resumed/i.test(str(a.newValue)));
    const holds = rows.filter(isHoldRow);
    const clears = rows.filter(isClearRow);
    holds.forEach((h, i) => {
      handled.add(h);
      const clear = clears[i];
      if (clear) handled.add(clear);
      const missing = /:\s*(.+?)\s+is missing\b/i.exec(str(h.reason))?.[1];
      const cause = chronologyDocumentTitle(missing ?? h.field, missing ?? h.reason);
      const sameDay = clear ? onlyDate(clear.at) === onlyDate(h.at) : false;
      push(
        clear
          ? `The clock went on hold on ${stamp(h.at)} because the ${cause} was missing; it resumed ${
              sameDay ? "the same day" : `on ${stamp(clear.at)}`
            } when the ${cause} was attached.`
          : `The clock went on hold on ${stamp(h.at)} because the ${cause} was missing.`,
      );
    });
    clears.filter((c) => !handled.has(c)).forEach((c) => {
      handled.add(c);
      push(`The hold was cleared and the clock resumed on ${stamp(c.at)}.`);
    });

    for (const a of rows) {
      if (handled.has(a)) continue;
      const on = day(a.at);
      if (/poll opened/i.test(a.action)) {
        push(`The go/no-go poll was opened on ${on}.`);
      } else if (/vote|go recorded|no-go/i.test(a.action)) {
        const noGo = /no-go/i.test(a.action) || /no-go/i.test(str(a.newValue));
        const recorded = /recorded by\s+(.+?)\s+on behalf of\s+(.+?)(?::|;|$)/i.exec(str(a.reason));
        const reviewer = recorded?.[2] ?? null;
        const recorder = recorded?.[1] ?? str(a.actor);
        push(
          `${seatName(a.field)}: ${noGo ? "No-go" : "Go"} recorded ${stamp(a.at)} by ${
            recorder ? personPhrase(ctx, recorder) : "the contracting officer"
          }${reviewer ? ` on behalf of ${reviewer}` : ""}.`,
        );
      } else if (/market research run|research finding confirmed/i.test(a.action)) {
        if (w.phase === "Market Research" && researchSentence) push(researchSentence);
      } else if (/red flag|scan/i.test(a.action)) {
        push(`A red-flag scan was run on ${on} and ${cleanClause(a.reason) || "recorded its findings on the file"}.`);
      } else if (/exclusions sweep/i.test(a.action)) {
        push(`An exclusions sweep was run on ${on} and ${cleanClause(a.reason) || "returned no matching exclusion"}.`);
      } else if (/set-aside evidence/i.test(a.action)) {
        push(`Set-aside evidence was assembled on ${on}${cleanClause(a.reason) ? `, ${cleanClause(a.reason)}` : ""}.`);
      } else if (/set-aside decision/i.test(a.action)) {
        push(`The set-aside decision was confirmed on ${on}${str(a.newValue) ? ` as ${str(a.newValue)}` : ""}.`);
      } else if (/sign-off/i.test(a.action)) {
        push(`${str(a.field) || "A sign-off"} was completed on ${on} by ${personPhrase(ctx, a.actor)}.`);
      } else if (/clock started|intake submitted/i.test(a.action)) {
        push(`The intake was submitted and the clock started on ${on}.`);
      } else {
        // Stored field codes and engine notes never print in the narrative.
        const note = cleanClause(a.reason)
          .replace(/saved from the (?:template|form) engine/gi, "")
          .replace(/\bclock_state\b/gi, "the clock state")
          .trim();
        const action = /^[a-z][a-z0-9_]*$/.test(a.action) ? a.action.replace(/_/g, " ") : a.action;
        push(`${action} was recorded on ${on} by ${personPhrase(ctx, a.actor)}${note ? `, ${note}` : ""}.`);
      }
    }

    if (w.phase === "Market Research" && researchDay && researchSentence) push(researchSentence);

    if (sentences.length === 1) sentences.push("No further activity was recorded against this phase.");
    // At most six sentences to a phase, so the memorandum stays a narrative.
    paragraphs.push(sentences.slice(0, 6).join(" "));
  }

  return paragraphs.join("\n\n");
}

function memorandumForRecord(ctx: MemoDraftCtx): Values {
  const purpose = mfrPurposeLabel(ctx.values);
  const pr = str(ctx.acq["pr_number"]);
  const phase = str(ctx.acq["current_phase"]) || "the current phase";
  const title = str(ctx.acq["title"]);
  const today = ctx.today ?? "";
  const opening =
    purpose === "Chronology of the acquisition to date"
      ? `This memorandum records the chronology of acquisition ${ctx.acquisitionId}${
          title ? `, ${title}` : ""
        }${pr ? `, requisition ${pr}` : ""}, which stood in the ${phase} phase on ${today}.`
      : `This memorandum is placed in the file for acquisition ${ctx.acquisitionId}${
          title ? `, ${title}` : ""
        }${pr ? `, requisition ${pr}` : ""}, which stood in the ${phase} phase on ${today}.${
          purpose ? ` Its purpose is ${purpose.charAt(0).toLowerCase()}${purpose.slice(1)}.` : ""
        }`;
  const out: Values = { opening, file_tab: "001" };
  if (purpose === "Chronology of the acquisition to date") out["body"] = chronologyParagraphs(ctx);
  return out;
}

/**
 * Evaluation of quotations record (FAR 13.106-2). The basis for award and the
 * criteria come from the notice on the file; the rest is the officer's.
 */
function evaluationOfQuotations(ctx: MemoDraftCtx): Values {
  const notice = ctx.noticeValues ?? {};
  const basisText = str(notice["evaluation_basis"]);
  const award = /best value|tradeoff/i.test(basisText)
    ? "Best value tradeoff"
    : basisText
      ? "Lowest price technically acceptable"
      : "";
  const out: Values = {};
  if (award) out["award_basis"] = award;
  out["evaluation_criteria"] =
    basisText ||
    gap("state the evaluation criteria as the notice stated them, or save the notice first");
  return out;
}

/** The recommended quoter on the evaluation record carries into the PNM. */
function priceNegotiation(ctx: MemoDraftCtx): Values {
  const evaluation = ctx.evaluationValues;
  if (!evaluation) return {};
  const out: Values = {};
  const name = str(evaluation["recommended_quoter"]);
  const uei = str(evaluation["recommended_uei"]);
  const price = str(evaluation["recommended_price"]);
  if (name) out["vendor_legal_name"] = name;
  if (uei) out["vendor_uei"] = uei;
  if (price) out["quoted_price"] = price;
  const comparison = str(evaluation["price_comparison"]);
  if (comparison) out["price_variance"] = comparison;
  return out;
}

const DRAFTERS: Record<string, (ctx: MemoDraftCtx) => Values> = {
  "evaluation-of-quotations": evaluationOfQuotations,
  pnm: priceNegotiation,
  "memorandum-for-record": memorandumForRecord,
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
