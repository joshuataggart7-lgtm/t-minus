/**
 * Memorandum body drafter.
 *
 * A memorandum is drafted from the record, the way the JOFOC and the technical
 * evaluation report are drafted: every body section gets text. Where the record
 * cannot answer a section, the draft carries
 * "[Contracting officer to complete: ...]" so the gap is visible in the export
 * rather than a numbered heading with nothing under it.
 */

import type { Values } from "@/lib/template-engine";

export type MemoDraftCtx = {
  acquisitionId: string;
  acq: Record<string, unknown>;
  missionName: string;
  /** Names of the documents already on this file, used for cross-references. */
  fileDocuments: string[];
  /** Set-aside evidence search, when it has been run. */
  evidence: { runOn: string; sources: number; smallBusinesses: number } | null;
};

const gap = (what: string) => `[Contracting officer to complete: ${what}]`;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

const dollars = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && v
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "";
};

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

  const research: string[] = [];
  if (ctx.evidence) {
    research.push(
      `A SAM.gov registered-entity and subaward search was run on ${ctx.evidence.runOn} for NAICS ${str(
        a["naics_code"],
      )}. It returned ${ctx.evidence.sources} sources, of which ${ctx.evidence.smallBusinesses} are small business under that code.`,
    );
  } else {
    research.push(gap("record the sources searched, the dates and the techniques used, or run the set-aside evidence search"));
  }
  if (prior) research.push(`The contract file for the prior acquisition ${prior} was reviewed.`);

  const findings = ctx.evidence
    ? ctx.evidence.smallBusinesses >= 2
      ? `${ctx.evidence.smallBusinesses} small business concerns were identified as capable of meeting the requirement. The expectation of offers from two or more responsible small business concerns at fair market prices is met (FAR 19.502-2).`
      : `${ctx.evidence.smallBusinesses} small business concerns were identified. The expectation of offers from two or more responsible small business concerns is not supported on this record (FAR 19.502-2).`
    : gap("state the number of sources, their small business capability and the Rule of Two result");

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
    research: research.join(" "),
    findings,
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
  return {
    requirement_description: str(a["description_of_requirement"]) || gap("add the description of the requirement to the record"),
    determination_basis:
      determination || gap("state whether the requirement is a commercial product or service, and on what basis"),
  };
}

function packetTransmittal(ctx: MemoDraftCtx): Values {
  const a = ctx.acq;
  const vendor = str(a["vendor_legal_name"]);
  const value = dollars(a["estimated_value"]);
  const competition = str(a["competition"]);
  const strategy = str(a["enterprise_psl_check"]);
  return {
    action: `This package supports the award of ${str(a["title"]) || ctx.acquisitionId}${
      vendor ? ` to ${vendor}` : ""
    }${value ? ` at ${value}` : ""}.`,
    competition_basis: competition
      ? `Competition was handled as ${competition.toLowerCase()}${
          str(a["jofoc_authority_citation"]) ? `, under ${str(a["jofoc_authority_citation"])}` : ""
        }.`
      : gap("state how competition was handled and any notice issued"),
    strategy: strategy
      ? `The Enterprise Procurement Strategies were reviewed. ${strategy}`
      : "The Enterprise Procurement Strategies were reviewed; no mandatory strategy applies to this requirement.",
    request: `Review and concurrence are requested so the award can be made by ${
      str(a["target_award_date"]) || gap("set the target award date on the record")
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

const DRAFTERS: Record<string, (ctx: MemoDraftCtx) => Values> = {
  "market-research-memo": marketResearch,
  commerciality,
  "packet-transmittal-memo": packetTransmittal,
  "coordination-memo": coordination,
  "waiver-deviation-request": waiverDeviation,
};

/** Drafted text for a memorandum, keyed by template field. */
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
