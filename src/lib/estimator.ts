/**
 * Intake estimate.
 *
 * A compact port of the Procurement LOE Estimator's pre-award model
 * (t-minus-seed/Procurement_LOE_Estimator.html): the same thresholds, the same
 * scale factors, the same calendar-month timeline, and the same task hours for
 * the phases that run from intake to award. It is driven by five intake
 * answers: value, competition, pricing, instrument, and requirement type.
 *
 * The phases the request will pass through come from phase_plan, not from here.
 */

import type { IntakeFacts, RefData } from "@/lib/intake";
import { parseMoney } from "@/lib/intake";

/** RFO FAR thresholds, Oct 1, 2025 inflation adjustment (estimator model). */
const TH = { SAT: 350_000, CCPD: 2_500_000 };

export type Pricing = "FFP" | "COST" | "TM";
export type Instrument = "STANDALONE" | "IDIQ" | "TO";
export type ReqType = "SERVICES" | "SUPPLIES" | "RD" | "CONSTRUCTION";

export type EstimatorInputs = {
  value: number;
  soleSource: boolean;
  pricing: Pricing;
  instrument: Instrument;
  reqType: ReqType;
  /** Simplified or commercial simplified procedures shorten every task. */
  procedures: "SAP" | "COMM_SIMP" | "NEGOTIATED";
};

export type EstimateTask = { phase: string; name: string; hours: number; cs: number };

export type Estimate = {
  inputs: EstimatorInputs;
  monthsToAward: number;
  months: { planning: number; solicitation: number; evaluation: number; award: number };
  phases: string[];
  plannedDaysToAward: number;
  hours: { total: number; co: number; cs: number };
  tasks: EstimateTask[];
  /** Plain-words summary shown to the requester. */
  sentence: string;
};

/** Reads the five estimator answers out of the intake form. */
export function inputsFromFacts(f: IntakeFacts): EstimatorInputs {
  const value = parseMoney(f.estimated_value) ?? 0;
  const soleSource = /sole/i.test(f.competition);

  const type = f.contract_type.toLowerCase();
  const pricing: Pricing = /cost-plus/.test(type)
    ? "COST"
    : /time-and-materials|labor-hour/.test(type)
      ? "TM"
      : "FFP";

  const method = f.acquisition_method.toLowerCase();
  const instrument: Instrument = /indefinite-delivery/.test(type)
    ? "IDIQ"
    : /existing contract vehicle|gwac/.test(method)
      ? "TO"
      : "STANDALONE";

  const procedures: EstimatorInputs["procedures"] = /13\.5|commercial simplified/.test(method)
    ? "COMM_SIMP"
    : /simplified acquisition/.test(method) || value <= TH.SAT
      ? "SAP"
      : "NEGOTIATED";

  const text = `${f.title} ${f.description_of_requirement}`.toLowerCase();
  const psc = f.psc_code.trim().toUpperCase();
  const reqType: ReqType = /research|development|study|experiment/.test(text)
    ? "RD"
    : /construction|renovation|facility repair/.test(text)
      ? "CONSTRUCTION"
      : /^[A-Z]/.test(psc)
        ? "SERVICES"
        : "SUPPLIES";

  return { value, soleSource, pricing, instrument, reqType, procedures };
}

/** Phase names from intake through award, from the seeded phase plan. */
export function phasesToAward(ref: RefData, soleSource: boolean) {
  const type = soleSource ? "commercial_ffp_13_5_sole_source" : "commercial_ffp_13_5_competed";
  const rows = ref.phasePlan.filter((p) => p.acquisition_type === type);
  const names: string[] = [];
  let days = 0;
  for (const r of rows) {
    names.push(r.phase ?? "");
    days += r.planned_days ?? 0;
    if ((r.phase ?? "").toLowerCase() === "award") break;
  }
  return { names, days };
}

const MONTH_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

export function inWords(n: number) {
  return MONTH_WORDS[n] ?? String(n);
}

export function estimate(inputs: EstimatorInputs, ref: RefData): Estimate {
  const { value: V, soleSource, pricing, instrument, reqType, procedures } = inputs;
  const isSAP = procedures === "SAP";
  const isTO = instrument === "TO";
  const isCost = pricing === "COST";
  const scale = isSAP ? 0.4 : isTO ? 0.55 : procedures === "COMM_SIMP" ? 0.75 : 1;

  const tasks: EstimateTask[] = [];
  const add = (phase: string, name: string, hours: number, cs: number, scaled = true) => {
    const h = Math.max(0, Math.round(scaled ? hours * scale : hours));
    if (h > 0) tasks.push({ phase, name, hours: h, cs });
  };

  // Acquisition planning
  let h = 6;
  if (V > 1e6) h = 10;
  if (V > 10e6) h = 16;
  if (V > 50e6) h = 24;
  add("Acquisition planning", "Purchase request review and intake", h, 0.6);

  h = 8;
  if (V > 1e6) h = 12;
  if (V > 10e6) h = 24;
  if (V > 50e6) h = 40;
  add("Acquisition planning", "Acquisition plan and strategy", h, 0.5);

  h = 8;
  if (soleSource) h = 12;
  if (V > 10e6) h += 4;
  add("Acquisition planning", "Market research", h, 0.7);

  if (soleSource && V > TH.SAT) {
    h = 16;
    if (V > 10e6) h = 28;
    if (V > 50e6) h = 40;
    add("Acquisition planning", "Justification for other than full and open competition", h, 0.5, false);
  }

  if (reqType === "SERVICES") {
    h = V > 5e6 ? 6 : 4;
    add("Acquisition planning", "Inherently governmental function review", h, 0.5);
  }

  // Solicitation
  h = isTO ? 8 : 16;
  if (V > 5e6) h += 8;
  if (V > 50e6) h += 16;
  add("Solicitation", "Solicitation drafting and assembly", h, 0.7);

  h = V > TH.SAT ? 10 : 6;
  add("Solicitation", "Clause selection and representations", h, 0.8);

  add("Solicitation", "SAM.gov presolicitation and solicitation notices", soleSource ? 2 : 3, 0.9);

  h = 4;
  if (!soleSource && V > 5e6) h = 10;
  add("Solicitation", "Questions, answers, and amendments", h, 0.6);

  // Evaluation, negotiation, and award
  h = soleSource ? 6 : 12;
  if (!soleSource && V > 5e6) h += 8;
  add("Evaluation and award", "Quotation or proposal evaluation", h, 0.4);

  if (!isSAP) {
    h = 6;
    if (V > 5e6) h = 10;
    if (V > 50e6) h = 16;
    add("Evaluation and award", "Technical evaluation coordination and fact-finding", h, 0.5);
  }

  h = 8;
  if (V > TH.CCPD) h = 16;
  if (V > 10e6) h = 24;
  if (V > 50e6) h = 40;
  if (isCost) h = Math.round(h * 1.5);
  add("Evaluation and award", "Cost or price analysis", h, 0.6);

  if (soleSource && V > TH.SAT) {
    h = 12;
    if (V > 10e6) h = 20;
    if (V > 50e6) h = 32;
    add("Evaluation and award", "Prenegotiation position memorandum", h, 0.5, false);
  }

  h = soleSource ? 8 : 4;
  if (V > 5e6) h += 8;
  if (isCost) h += 8;
  add("Evaluation and award", "Negotiations", h, 0.3);

  add("Evaluation and award", "Responsibility determination", V > TH.SAT ? 5 : 3, 0.8, false);

  h = 6;
  if (V > 5e6) h = 10;
  if (V > 50e6) h = 16;
  add("Evaluation and award", "Price negotiation memorandum and award documentation", h, 0.5);

  add("Evaluation and award", "Award execution and FPDS-NG report", 6, 0.7);

  const total = tasks.reduce((n, t) => n + t.hours, 0);
  const csH = Math.round(tasks.reduce((n, t) => n + t.hours * t.cs, 0));
  const coH = total - csH;

  // Calendar months, straight from the estimator's timeline model.
  let planning = 2;
  if (V > 10e6) planning = 4;
  if (V > 50e6) planning = 6;
  if (soleSource) planning = Math.max(planning - 1, 1);
  if (isSAP || isTO) planning = 1;
  let solicitation = soleSource ? 1 : 2;
  if (isSAP) solicitation = 1;
  const evaluation = !soleSource && V > 10e6 ? 2 : 1;
  const award = 1;
  const monthsToAward = planning + solicitation + evaluation + award;

  const { names: phases, days: plannedDaysToAward } = phasesToAward(ref, soleSource);

  const sentence =
    `This request is expected to take about ${inWords(monthsToAward)} month${monthsToAward === 1 ? "" : "s"} ` +
    `to award, through ${inWords(phases.length)} phase${phases.length === 1 ? "" : "s"}, ` +
    `and about ${total.toLocaleString("en-US")} hours of contracting work. ` +
    `If you need it sooner, talk to your contracting officer now.`;

  return {
    inputs,
    monthsToAward,
    months: { planning, solicitation, evaluation, award },
    phases,
    plannedDaysToAward,
    hours: { total, co: coH, cs: csH },
    tasks,
    sentence,
  };
}

/** The shape stored on the acquisition and read back by the status views. */
export type StoredEstimate = {
  months_to_award: number;
  phases: string[];
  hours_total: number;
  hours_co: number;
  hours_cs: number;
  planned_days_to_award: number;
  inputs: EstimatorInputs;
  sentence: string;
  estimated_at: string;
};

export function toStored(e: Estimate): StoredEstimate {
  return {
    months_to_award: e.monthsToAward,
    phases: e.phases,
    hours_total: e.hours.total,
    hours_co: e.hours.co,
    hours_cs: e.hours.cs,
    planned_days_to_award: e.plannedDaysToAward,
    inputs: e.inputs,
    sentence: e.sentence,
    estimated_at: new Date().toISOString(),
  };
}
