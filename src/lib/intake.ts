import { addCalendarDays, calendarDaysBetween, todayCT } from "@/lib/calendar-date";
import { COMMERCIAL_SIMPLIFIED_METHOD, igceCite, isCommercialSimplifiedMethod, WRITTEN_ACQUISITION_PLAN_THRESHOLD } from "@/lib/rfo-simplified-cites";
import { isFar13Method, newContractPlanKey } from "@/lib/phase-plan-key";
// Intake validation and the red-flag scan that runs before an intake is saved.

export type IntakeFacts = {
  title: string;
  mission_id: string;
  mission_directorate_code: string;
  mission_directorate_name: string;
  mission_directorate_other: string;
  sponsoring_agency: string;
  is_reimbursable: boolean;
  /** the acquisition this one replaces, when it is a follow-on */
  successor_of: string;
  center_code: string;
  center_name: string;
  branch_code: string;
  requester_name: string;
  requester_org_code: string;
  pr_number: string;
  description_of_requirement: string;
  estimated_value: string;
  need_date: string;
  period_of_performance_start: string;
  period_of_performance_end: string;
  place_of_performance: string;
  naics_code: string;
  psc_code: string;
  contract_type: string;
  hybrid_contract_type: string;
  acquisition_method: string;
  competition: string;
  set_aside: string;
  jofoc_authority_citation: string;
  lead_to_delivery_days: string;
  funding_fiscal_year: string;
  funds_certified: boolean;
  igce_attached: boolean;
  sow_attached: boolean;
  hardware_deliverable: boolean;
  right_to_repair_statement: boolean;
  includes_it: boolean;
  cio_review_flagged: boolean;
  acquisition_forecast_verified: boolean;
  enterprise_psl_check: string;
};

export const EMPTY_FACTS: IntakeFacts = {
  title: "",
  mission_id: "",
  mission_directorate_code: "",
  mission_directorate_name: "",
  mission_directorate_other: "",
  sponsoring_agency: "",
  is_reimbursable: false,
  successor_of: "",
  center_code: "ARC",
  center_name: "Ames Research Center",
  branch_code: "",
  requester_name: "",
  requester_org_code: "",
  pr_number: "",
  description_of_requirement: "",
  estimated_value: "",
  need_date: "",
  period_of_performance_start: "",
  period_of_performance_end: "",
  place_of_performance: "",
  naics_code: "",
  psc_code: "",
  contract_type: "",
  hybrid_contract_type: "",
  acquisition_method: "",
  competition: "",
  set_aside: "",
  jofoc_authority_citation: "",
  lead_to_delivery_days: "30",
  funding_fiscal_year: "",
  funds_certified: false,
  igce_attached: false,
  sow_attached: false,
  hardware_deliverable: false,
  right_to_repair_statement: false,
  includes_it: false,
  cio_review_flagged: false,
  acquisition_forecast_verified: false,
  enterprise_psl_check: "",
};

export const CONTRACT_TYPES = [
  "Firm-fixed-price (FFP)",
  "Fixed-price with economic price adjustment (FP-EPA)",
  "Fixed-price incentive (FPIF)",
  "Cost-plus-fixed-fee (CPFF)",
  "Cost-plus-incentive-fee (CPIF)",
  "Cost-plus-award-fee (CPAF)",
  "Cost-no-fee / cost-sharing",
  "Time-and-materials (T&M)",
  "Labor-hour (LH)",
  "Indefinite-delivery indefinite-quantity (IDIQ)",
  "Blanket purchase agreement (BPA) call",
  "Purchase order",
];

export const ACQUISITION_METHODS = [
  COMMERCIAL_SIMPLIFIED_METHOD,
  "RFO FAR Part 13 simplified acquisition (non-commercial)",
  "RFO FAR Part 12 commercial, Part 15 procedures",
  "RFO FAR Part 15 negotiated",
  "RFO FAR subpart 8.4 GSA schedule order",
  "RFO FAR subpart 16.5 order under existing IDIQ / GWAC",
  "RFO FAR Part 14 sealed bidding",
  "Other transaction / Space Act (not a FAR contract)",
];

export const COMPETITION_CHOICES = [
  "Competitive",
  "Limited sources (RFO FAR 8.401(b); GSAR subpart 538.71 / 16.505)",
  "Sole source",
  "Brand name",
];

export const SET_ASIDES = [
  "None",
  "Total small business set-aside",
  "Partial small business",
  "8(a)",
  "8(a) sole source",
  "HUBZone",
  "HUBZone sole source",
  "Service-disabled veteran-owned",
  "SDVOSB sole source",
  "Women-owned small business",
  "WOSB/EDWOSB sole source",
  "Local area (RFO FAR subpart 26.2)",
];

export const CENTERS = [
  ["HQ", "NASA Headquarters"], ["ARC", "Ames Research Center"],
  ["AFRC", "Armstrong Flight Research Center"], ["GRC", "Glenn Research Center"],
  ["GSFC", "Goddard Space Flight Center"], ["JPL", "Jet Propulsion Laboratory"],
  ["JSC", "Johnson Space Center"], ["KSC", "Kennedy Space Center"],
  ["LaRC", "Langley Research Center"], ["MSFC", "Marshall Space Flight Center"],
  ["SSC", "Stennis Space Center"], ["Other", "Other"],
] as const;

export const MISSION_DIRECTORATES = [
  ["HSMD", "Human Spaceflight Mission Directorate"],
  ["RTMD", "Research and Technology Mission Directorate"],
  ["SMD", "Science Mission Directorate"],
  ["MSD", "Mission Support Directorate"],
  ["CENTER", "Center institutional / operations"],
  ["REIMBURSABLE", "Reimbursable or other-agency (Economy Act, Space Act, etc.)"],
  ["OTHER", "Other (specify)"],
] as const;

export function parseMoney(v: string): number | null {
  const cleaned = v.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(n: number | null): string {
  if (n === null) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function fieldErrors(f: IntakeFacts): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e["title"] = "Enter a short title for this requirement.";
  if (!f.mission_id) e["mission_id"] = "Choose the mission this supports.";
  if (!f.mission_directorate_code) e["mission_directorate_code"] = "Choose a mission directorate.";
  if (f.mission_directorate_code === "OTHER" && !f.mission_directorate_other.trim())
    e["mission_directorate_other"] = "Specify the mission directorate.";
  if (f.is_reimbursable && !f.sponsoring_agency.trim())
    e["sponsoring_agency"] = "Enter the sponsoring agency.";
  if (!f.center_code) e["center_code"] = "Choose the Center.";
  if (!f.requester_name.trim()) e["requester_name"] = "Enter the requester's name.";
  if (!f.description_of_requirement.trim())
    e["description_of_requirement"] = "Describe the requirement in a sentence or two.";

  const value = parseMoney(f.estimated_value);
  if (f.estimated_value.trim() === "") e["estimated_value"] = "Enter the estimated value in dollars.";
  else if (value === null || value <= 0)
    e["estimated_value"] = "Enter a dollar figure, for example 1,450,000.";

  if (!f.need_date) e["need_date"] = "Enter the mission need date.";
  else if (f.need_date <= todayISO()) e["need_date"] = "The need date has to fall after today.";
  if (f.naics_code && !/^\d{6}$/.test(f.naics_code.trim()))
    e["naics_code"] = "NAICS is six digits, for example 481219.";
  if (!f.naics_code.trim()) e["naics_code"] = "Enter the six-digit NAICS code.";
  if (f.psc_code && !/^[A-Za-z0-9]{4}$/.test(f.psc_code.trim()))
    e["psc_code"] = "PSC is four characters, for example V121.";
  if (!f.psc_code.trim()) e["psc_code"] = "Enter the four-character PSC code.";
  if (!f.contract_type) e["contract_type"] = "Choose a contract type.";
  if (!f.acquisition_method) e["acquisition_method"] = "Choose an acquisition method.";
  if (!f.competition) e["competition"] = "Choose the competition approach.";
  if (/limited sources|sole source|brand name/i.test(f.competition) && !f.jofoc_authority_citation)
    e["jofoc_authority_citation"] = "Choose the authority for this competition approach.";

  const start = f.period_of_performance_start;
  const end = f.period_of_performance_end;
  if (start && end && start >= end)
    e["period_of_performance_end"] = "The end date has to fall after the start date.";
  if (f.need_date && end && f.need_date > end)
    e["need_date"] = "The need date falls after the period of performance ends. Check the dates.";

  const lead = Number(f.lead_to_delivery_days);
  if (!Number.isFinite(lead) || lead < 0)
    e["lead_to_delivery_days"] = "Enter the days from award until the mission has what it bought.";
  return e;
}

export type RedFlag = {
  id: string;
  title: string;
  detail: string;
  citation?: string;
  blocking: boolean;
};

export type RefData = {
  /** Per-Center threshold and review-trigger overrides in effect. */
  overrides?: import("@/lib/center-config").CenterOverrideRow[];
  thresholds: { name: string | null; value: number | null; citation: string | null; note: string | null }[];
  phasePlan: { acquisition_type: string | null; phase: string | null; planned_days: number | null }[];
  strategies: {
    psl: string;
    name: string | null;
    buying_location: string | null;
    mandatory_vehicles: string | null;
    required_coordination: string | null;
  }[];
};

function threshold(ref: RefData, name: string): number | null {
  const row = ref.thresholds.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase());
  return row?.value ?? null;
}

export function phaseDaysToAward(ref: RefData, competition: string, method?: string): number {
  // Competed, noncommercial FAR 15 reads the negotiated plan when it is seeded.
  const type = newContractPlanKey({ competition, method }, ref.phasePlan);
  const rows = ref.phasePlan.filter((p) => p.acquisition_type === type);
  let total = 0;
  for (const r of rows) {
    total += r.planned_days ?? 0;
    if ((r.phase ?? "").toLowerCase() === "award") break;
  }
  return total;
}

const STOPWORDS = new Set(["and", "or", "of", "for", "the", "with", "to", "a"]);

/** A strategy matches when every word of its category name appears in the
 *  requirement text as a whole word. Substring matching is too loose. */
export function matchStrategy(ref: RefData, text: string) {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return (
    ref.strategies.find((s) => {
      const name = (s.name ?? "").toLowerCase().trim();
      if (!name) return false;
      const words = name
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
      if (!words.length) return false;
      return words.every((w) => hay.includes(` ${w} `));
    }) ?? null
  );
}

function crossesOctoberFirst(start: string, end: string) {
  if (!start || !end) return false;
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let y = s.getUTCFullYear(); y <= e.getUTCFullYear(); y++) {
    const oct = new Date(Date.UTC(y, 9, 1));
    if (oct > s && oct <= e) return true;
  }
  return false;
}

export function daysBetween(fromISO: string, toISO: string) {
  return calendarDaysBetween(fromISO, toISO);
}

export function todayISO() {
  return todayCT();
}

export function addDays(iso: string, days: number) {
  return addCalendarDays(iso, days);
}

/** Files staged on the intake screen, which the facts themselves do not carry. */
export type IntakeDocs = { pr?: boolean; nf1707?: boolean };

export function scanRedFlags(f: IntakeFacts, ref: RefData, docs?: IntakeDocs): RedFlag[] {
  const flags: RedFlag[] = [];
  const value = parseMoney(f.estimated_value) ?? 0;

  if (!f.igce_attached)
    flags.push({
      id: "igce",
      title: "No independent government cost estimate attached",
      detail:
        !/13/.test(String(f.acquisition_method ?? "")) && !isCommercialSimplifiedMethod(f.acquisition_method) && value > WRITTEN_ACQUISITION_PLAN_THRESHOLD
          ? "Attach the IGCE before the clock starts. Where a written acquisition plan applies, its cost/price element must provide it."
          : "Attach the IGCE before the clock starts. Requiring it at intake is a T-Minus/Center rule; it supports the price reasonableness determination.",
      // Simplified acquisitions rest on RFO FAR 12.204(a) (commercial) or RFO FAR
      // 13.203(a) (noncommercial); other buys on RFO FAR 15.404-1(b)(5), plus
      // NFS CG 1807.14(b)(3) where a written acquisition plan applies.
      citation: igceCite(String(f.acquisition_method ?? ""), value),
      blocking: true,
    });

  if (!f.sow_attached)
    flags.push({
      id: "sow",
      title: "No statement of work or performance work statement attached",
      detail: "Attach the SOW or PWS so the requirement can be solicited as written. Requiring it before the clock starts is a T-Minus/Center rule, not a FAR requirement.",
      citation: "RFO FAR 11.102(a)(2)(i); RFO FAR 37.301-1(c); RFO FAR 7.503",
      blocking: true,
    });

  // NFS CG 1807.711: the PR is developed in Core Financial, solicitations wait
  // for the funds certification, and an NF 1707 not already given to the
  // procurement office must accompany the PR. These are CG procedures; T-Minus
  // shows them as attention flags and does not hold the clock for them.
  if (docs && !docs.pr && !String(f.pr_number ?? "").trim())
    flags.push({
      id: "pr",
      title: "No purchase request number or copy on the file",
      detail: "Record the PR number from Core Financial or attach the PR. A solicitation waits for the PR's funds certification. T-Minus does not hold the clock for this.",
      citation: "NFS CG 1807.711(b) and (c)",
      blocking: false,
    });

  if (docs && !docs.nf1707)
    flags.push({
      id: "nf1707",
      title: "Signed NF 1707 from the requester not attached",
      detail: "Attach the approved, dated NF 1707. If it was not given to the procurement office earlier, it must accompany the purchase request. It is not needed for a within-scope action whose approvals were already obtained. T-Minus does not hold the clock for this.",
      citation: "NFS CG 1807.711(a) and (b)",
      blocking: false,
    });

  const ceiling = threshold(ref, "Commercial simplified procedures ceiling");
  if (isCommercialSimplifiedMethod(f.acquisition_method) && ceiling && value > ceiling) {
    flags.push({
      id: "far135-ceiling",
      title: "Estimated value is above the commercial simplified procedures ceiling",
      detail: `${formatMoney(value)} is above ${formatMoney(ceiling)}. Choose another method or reduce the estimate.`,
      citation: "RFO FAR 12.201-1(a); RFO FAR 12.001(c); RFO FAR 12.102 Table 12-1 (formerly RFO FAR 12.201-1)",
      blocking: true,
    });
  }

  // At or below the SAT, a sole source under Part 13 rests on a D&F that only
  // one source is reasonably available (RFO FAR 13.101(b)); Part 6 does not
  // apply (RFO FAR 6.001(a)). A commercial one documents the decision and its
  // basis (RFO FAR 12.102(a)).
  const satValue = threshold(ref, "Simplified acquisition threshold") ?? 350_000;
  const method = String(f.acquisition_method ?? "");
  const withinSat = value > 0 && value <= satValue;
  const commercialRoute = isCommercialSimplifiedMethod(method) || /\bPart 12\b|\b12\.201|\b12\b/.test(method);
  const simplifiedSole = withinSat ? (commercialRoute ? "commercial" : isFar13Method(method) ? "noncommercial" : null) : null;
  if (/sole|limited sources|brand name/i.test(f.competition) && !f.jofoc_authority_citation.trim())
    flags.push(
      simplifiedSole === "noncommercial"
        ? {
            id: "jofoc",
            title: "Sole source selected with no single-source basis recorded",
            detail:
              "Record the basis for soliciting one source. Under Part 13 at or below the SAT, a determination and findings that only one source is reasonably available supports it; Part 6 does not apply.",
            citation: "RFO FAR 13.101(b); RFO FAR 6.001(a)",
            blocking: true,
          }
        : simplifiedSole === "commercial"
          ? {
              id: "jofoc",
              title: "Sole source selected with no single-source basis recorded",
              detail: "At or below the SAT, document the decision that only one source is available and the basis for it.",
              citation: "RFO FAR 12.102(a)",
              blocking: true,
            }
          : {
              id: "jofoc",
              title: "Sole source selected with no JOFOC authority cited",
              detail: "Record the authority for other than full and open competition.",
              citation: "RFO FAR 6.104-1(a)(4); RFO FAR 6.104-2",
              blocking: true,
            },
    );

  // Below the micro-purchase threshold the purchase card comes first.
  const mpt = threshold(ref, "Micro-purchase threshold");
  if (mpt && value > 0 && value <= mpt)
    flags.push({
      id: "micro-purchase",
      title: "Estimated value is at or below the micro-purchase threshold",
      detail: `${formatMoney(value)} is at or below ${formatMoney(mpt)}. The NASA purchase card must be used for micro-purchase threshold transactions to the maximum extent practicable. Consider the purchase card before opening a full acquisition file. T-Minus does not hold the clock for this.`,
      citation: "RFO FAR 2.101 (micro-purchase threshold); NFS CG 1812.42(a)",
      blocking: false,
    });

  if (
    /firm-fixed-price/i.test(f.contract_type) &&
    crossesOctoberFirst(f.period_of_performance_start, f.period_of_performance_end) &&
    !f.funds_certified
  )
    flags.push({
      id: "funding",
      title: "Period of performance crosses October 1 without funds certified for the full period",
      detail: "Certify funds for the full period or plan a severable period within the fiscal year.",
      citation: "31 U.S.C. 1502; RFO FAR 32.703-3",
      blocking: true,
    });

  if (f.includes_it && !f.cio_review_flagged)
    flags.push({
      id: "cio",
      title: "Information technology selected without CIO review flagged",
      detail: "CIO authorization applies to IT at any value. Flag the review in Section 2.",
      citation: "FITARA; NFS CG 1839.11; PCD 25-06A",
      blocking: true,
    });

  if (f.need_date) {
    const lead = Number(f.lead_to_delivery_days) || 0;
    const planned = phaseDaysToAward(ref, f.competition, f.acquisition_method);
    const earliest = addDays(todayISO(), planned + lead);
    if (earliest > f.need_date)
      flags.push({
        id: "schedule",
        title: "The need date cannot be met by the planned phase days",
        detail: `The planned phases run ${planned} days to award, plus ${lead} days to delivery. The earliest delivery is ${earliest}, after the need date of ${f.need_date}.`,
        citation: "phase_plan (LOE Estimator timeline model)",
        blocking: false,
      });
  }

  const sat = threshold(ref, "Simplified acquisition threshold");
  if (sat && value > sat) {
    const match = matchStrategy(ref, `${f.title} ${f.description_of_requirement}`);
    if (match && !f.enterprise_psl_check.trim())
      flags.push({
        id: "psl",
        title: `Enterprise strategy match: ${match.psl} ${match.name ?? ""}`.trim(),
        detail: `Buying location ${match.buying_location ?? "not stated"}. Mandatory vehicle: ${match.mandatory_vehicles ?? "not stated"}. Required coordination: ${match.required_coordination ?? "not stated"}. Record the contracting officer's determination in the enterprise strategy field.`,
        citation: "Enterprise Procurement Strategies, Rev. May 20, 2026 (A-100)",
        blocking: true,
      });
  }

  if (f.hardware_deliverable && !f.right_to_repair_statement)
    flags.push({
      id: "right-to-repair",
      title: "Hardware deliverable without a Right to Repair requirements statement",
      detail: "Add the Right to Repair requirements statement for hardware deliverables.",
      citation:
        "Administrator's Workforce Directive, February 9, 2026; OP memo, March 17, 2026; NFS 1827 revision",
      blocking: true,
    });

  return flags;
}
