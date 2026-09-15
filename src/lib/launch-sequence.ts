// The launch sequence: which phases apply, which documents each phase needs,
// which reviews are triggered, and what puts the clock on hold.
// Phase order and planned days come from phase_plan; review citations and
// planned days come from review_rules. Nothing regulatory is invented here
// beyond the phase citation labels.

import { matchStrategy, type RefData } from "@/lib/intake";
import { overrideValue } from "@/lib/center-config";

export type AcqRow = Record<string, unknown> & {
  acquisition_id: string;
  competition?: string | null;
  acquisition_method?: string | null;
  contract_type?: string | null;
  estimated_value?: number | string | null;
  includes_it?: boolean | null;
  hardware_deliverable?: boolean | null;
  igce_attached?: boolean | null;
  sow_attached?: boolean | null;
  funds_certified?: boolean | null;
  acquisition_forecast_verified?: boolean | null;
  jofoc_authority_citation?: string | null;
  enterprise_psl_check?: string | null;
  set_aside?: string | null;
  current_phase?: string | null;
  clock_state?: string | null;
  regulatory_baseline_date?: string | null;
  target_award_date?: string | null;
  co_name?: string | null;
  nf1707_answers?: Record<string, unknown> | null;
  title?: string | null;
  description_of_requirement?: string | null;
  center_code?: string | null;
  mission_id?: string | null;
  need_date?: string | null;
  naics_code?: string | null;
  psc_code?: string | null;
  place_of_performance?: string | null;
  period_of_performance_start?: string | null;
  period_of_performance_end?: string | null;
  hold_reason?: string | null;
  hold_owner?: string | null;
  status?: string | null;
  vendor_legal_name?: string | null;
};

export type PhasePlanRow = {
  acquisition_type: string | null;
  phase: string | null;
  planned_days: number | null;
  order: number | null;
  note: string | null;
};

export type ReviewRuleRow = {
  rule_id: string;
  reviewer_role: string;
  trigger: string | null;
  citation: string | null;
  planned_days: number | null;
  note: string | null;
};

export type PollRow = {
  poll_id: string;
  acquisition_id: string | null;
  phase: string | null;
  reviewer_role: string | null;
  reviewer_name: string | null;
  vote: string | null;
  reason: string | null;
  due_date: string | null;
};

/** Boolean or text columns on the record that stand in for an attachment. */
export type DocField =
  | "igce_attached"
  | "sow_attached"
  | "funds_certified"
  | "acquisition_forecast_verified"
  | "jofoc_authority_citation";

export type RequiredDoc = {
  label: string;
  citation: string;
  field?: DocField;
  /** what it links to when there is no toggle */
  link?: "templates" | "checks" | "packet" | "form";
  /** template opened for this file, rather than the templates library */
  templateKey?: string;
  /** generated form opened for this file */
  formKey?: string;
  /**
   * False when a regulation, NFS text, Companion Guide entry, PCD or
   * Enterprise Procurement Strategy requires the document at this value or
   * condition. Optional documents are offered, never required.
   */
  optional?: boolean;
  note?: string;
};

export function acquisitionType(acq: AcqRow) {
  return /sole/i.test(String(acq.competition ?? ""))
    ? "commercial_ffp_13_5_sole_source"
    : "commercial_ffp_13_5_competed";
}

export const PHASE_CITATIONS: Record<string, string> = {
  Intake: "NF 1707; NFS 1807.7201 (Acquisition Forecast affirmation)",
  "Market Research": "RFO FAR 10.001; NFS CG 1810.12",
  JOFOC: "RFO FAR 6.104-2 Table 6-1; NFS CG 1806.16",
  Synopsis: "RFO FAR 5.203; FAR 12.603 (combined synopsis/solicitation)",
  "Solicitation/Quote": "FAR 12.603; NFS CG 1804.11 (NCMS is the system of record)",
  "Technical Evaluation": "FAR 13.106-2 (evaluation of quotations)",
  "Price Reasonableness": "FAR 12.204(b)(1); FAR 13.106-3",
  "Responsibility Check": "FAR 9.104-1; FAR 9.105-2; FAR 52.204-7 (SAM)",
  "Go/No-go Poll": "NFS 1801.770 legal review; Center policy for the review chain",
  Award: "FAR 13.302-3; NFS CG 1804.11 (award written in NCMS)",
  "FPDS-NG Report": "FAR 4.604 (contract action reporting)",
  Administration: "FAR Part 42; FAR 4.801 (contract file)",
  Closeout: "FAR 4.804 (closeout of contract files)",
};

export const PHASE_GUIDANCE: Record<string, string> = {
  Intake: "Confirm the requirement, the money, and the mission date. The clock starts here.",
  "Market Research":
    "Find out who can do this work and at what price. Write down what you found and where you looked.",
  JOFOC:
    "Only for a sole source. Write the justification, cite the authority, and route it for the approval its dollar tier calls for.",
  Synopsis: "Post the notice so the market can see it. Commercial buys may combine notice and solicitation.",
  "Solicitation/Quote":
    "Build the solicitation in NCMS. T-Minus hands over the facts, the clause list, and the attachments.",
  "Technical Evaluation": "Judge each quote against the stated criteria. Record who evaluated and why.",
  "Price Reasonableness":
    "Write the price negotiation memorandum. It is the determination of record; no separate price memo is made.",
  "Responsibility Check":
    "Check the vendor in SAM: registration, exclusions, and integrity records. Signing the SF 1449 is the determination.",
  "Go/No-go Poll": "Each required reviewer votes Go or No-go by name. A No-go needs a reason.",
  Award: "Award in NCMS from the handoff packet, then mark the file Launched.",
  "FPDS-NG Report": "Report the action so the public record matches the file.",
  Administration: "Run the contract: deliveries, invoices, and past performance.",
  Closeout: "Close the file when everything is delivered, paid, and filed.",
};

/** Micro-purchase threshold, above which the NF 1787 is coordinated. */
const MICRO_PURCHASE = 10_000;
/** Value at which the NF 1787A becomes the market research document of record. */
const MRR_THRESHOLD = 2_000_000;

export function requiredDocs(phase: string, acq?: AcqRow): RequiredDoc[] {
  switch (phase) {
    case "Intake":
      return [
        {
          label: "NF 1707 intake, Acquisition Forecast affirmed",
          citation: "NFS 1807.7201",
          field: "acquisition_forecast_verified",
        },
        {
          label: "Independent government cost estimate (IGCE)",
          citation: "FAR 15.404-1",
          field: "igce_attached",
        },
        {
          label: "Statement of work or performance work statement",
          citation: "FAR 11.101",
          field: "sow_attached",
        },
      ];
    case "Market Research": {
      const value = Number(acq?.estimated_value ?? 0);
      const mrrRequired = value >= MRR_THRESHOLD;
      return [
        {
          label: "Market research memorandum",
          citation: "RFO FAR 10.001",
          link: "templates",
          templateKey: "market-research-memo",
          ...(mrrRequired
            ? { optional: true, note: "At this value the NF 1787A is the market research document of record." }
            : { note: "Below $2,000,000 this memorandum is the market research document of record." }),
        },
        {
          label: mrrRequired ? "NF 1787A market research report" : "NF 1787A market research report (offered)",
          citation: "NFS CG 1810.12(c)",
          link: "form",
          formKey: "nf-1787a",
          optional: !mrrRequired,
          note: mrrRequired
            ? "Required at an estimated value of $2,000,000 or more."
            : "Offered below $2,000,000; the memorandum is the document of record.",
        },
        {
          label: "NF 1787 small business coordination",
          citation: "NFS 1819.202-70",
          link: "form",
          formKey: "nf-1787",
          optional: value <= MICRO_PURCHASE,
          note:
            value <= MICRO_PURCHASE
              ? "Offered at or below the micro-purchase threshold."
              : "Required above the micro-purchase threshold, with the exceptions in the threshold table.",
        },
      ];
    }
    case "JOFOC":
      return [
        {
          label: "Justification for other than full and open competition",
          citation: "RFO FAR 6.104-2",
          field: "jofoc_authority_citation",
        },
      ];
    case "Synopsis":
      return [{ label: "Presolicitation or combined synopsis notice", citation: "RFO FAR 5.203", link: "templates" }];
    case "Solicitation/Quote":
      return [
        { label: "NCMS handoff packet", citation: "NFS CG 1804.11", link: "packet" },
        { label: "Funds certified for the period", citation: "31 U.S.C. 1502", field: "funds_certified" },
      ];
    case "Technical Evaluation":
      return [{ label: "NASA technical evaluation report", citation: "FAR 13.106-2", link: "templates" }];
    case "Price Reasonableness":
      return [
        {
          label: "Price negotiation memorandum (PNM)",
          citation: "FAR 12.204(b)(1)",
          link: "templates",
          note: "The PNM is the price reasonableness determination of record. No separate determination is generated.",
        },
      ];
    case "Responsibility Check":
      return [
        {
          label: "SAM.gov entity registration and exclusion results",
          citation: "FAR 9.104-1; FAR 52.204-7",
          link: "checks",
        },
        {
          label: "Integrity records count (FAPIIS)",
          citation: "FAR 9.104-6",
          link: "checks",
        },
        {
          label: "SF 1449 signature",
          citation: "FAR 9.105-2",
          link: "packet",
          note: "The contracting officer's signature on the SF 1449 is the affirmative responsibility determination. A separate memorandum is generated only on a finding of nonresponsibility.",
        },
      ];
    case "Go/No-go Poll":
      return [{ label: "Recorded votes from every required reviewer", citation: "Center policy" }];
    case "Award":
      return [
        { label: "NCMS handoff packet", citation: "NFS CG 1804.11", link: "packet" },
        { label: "SF 1449 award document (written in NCMS)", citation: "FAR 12.204", link: "packet" },
      ];
    case "FPDS-NG Report":
      return [{ label: "FPDS-NG contract action report", citation: "FAR 4.604" }];
    case "Administration":
      return [
        { label: "CPARS past performance evaluation", citation: "RFO FAR Part 42", link: "templates" },
        { label: "COR appointment letter", citation: "FAR 1.602-2(d)", link: "templates" },
        {
          label: "Option exercise: preliminary notice and determination",
          citation: "FAR 17.207(a) and (c)",
          link: "templates",
        },
        {
          label: "SF 30 modification handoff packet",
          citation: "FAR 43.301; NFS CG 1804.11",
          link: "packet",
          note: "The modification of record is written in NCMS. T-Minus hands over the facts and the clause delta.",
        },
      ];
    case "Closeout":
      return [
        { label: "Closeout Transfer Checklist", citation: "FAR 4.804-5", link: "templates" },
        { label: "Contract file complete and retained", citation: "FAR 4.801; FAR 4.805", link: "templates" },
      ];
    default:
      return [];
  }
}

export function docSatisfied(doc: RequiredDoc, acq: AcqRow, hasFile?: boolean): boolean | null {
  if (!doc.field) return null;
  // A stored file is the only thing that makes a row read Attached. When the
  // caller knows whether a file exists, that answer decides.
  if (hasFile !== undefined) return hasFile;
  const v = acq[doc.field];
  if (doc.field === "jofoc_authority_citation") return Boolean(String(v ?? "").trim());
  // A null value means the record has never carried this answer, which is not
  // the same as a document that was removed. Only an explicit false holds.
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

// ------------------------------------------------------------------ reviews

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function answeredYes(acq: AcqRow, needle: RegExp) {
  const answers = acq.nf1707_answers;
  if (!answers || typeof answers !== "object") return false;
  // The seeded answers hold the section code in the key ("S5V") or inside the
  // recorded answer text ("S5Vn2 YES: ..."), so both are checked.
  return Object.entries(answers as Record<string, unknown>).some(
    ([k, v]) =>
      (needle.test(k) || needle.test(String(v))) &&
      (v === "1" || v === true || /yes/i.test(String(v))),
  );
}

/** Evaluate a review_rules row against the record. Citation, days, and the
 *  trigger text always come from the row, never from here. */
export function reviewApplies(rule: ReviewRuleRow, acq: AcqRow, ref: RefData): boolean {
  const role = rule.reviewer_role.toLowerCase();
  const value = num(acq.estimated_value);
  const center = (acq['center_code'] ?? null) as string | null;
  // A Center configuration row, when one is in effect, replaces the value the
  // rule would otherwise read from the thresholds table.
  const ovThr = (name: string) => overrideValue(ref.overrides, center, "threshold", name);
  const thr = (name: string) =>
    ovThr(name) ??
    ref.thresholds.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase())?.value ??
    null;
  const trigger = overrideValue(ref.overrides, center, "review_trigger", rule.reviewer_role);
  const sat = thr("Simplified acquisition threshold") ?? 350_000;
  const micro = thr("Micro-purchase threshold") ?? 15_000;
  const certified = thr("Certified cost or pricing data (FAR text)") ?? 2_500_000;
  const jofoc = Boolean(String(acq.jofoc_authority_citation ?? "").trim());

  if (role.startsWith("legal review")) return jofoc || value >= (trigger ?? sat);
  if (role.startsWith("pricing review"))
    return /cost/i.test(String(acq.contract_type ?? "")) || value >= (trigger ?? certified);
  if (role.startsWith("small business")) return value > (trigger ?? micro);
  if (role.startsWith("procurement strategy meeting")) return value > (trigger ?? 10_000_000);
  if (role.includes("notification of procurement action"))
    return value >= (trigger ?? 7_000_000) && value < 30_000_000;
  if (role.startsWith("anosca")) return value >= (trigger ?? 30_000_000);
  if (role.startsWith("cio authorization")) return Boolean(acq.includes_it);
  if (role.startsWith("public announcement")) return value >= 7_000_000 && /8\(a\)/i.test(String(acq.set_aside ?? ""));
  if (role.startsWith("enterprise strategy"))
    return (
      value > sat &&
      Boolean(matchStrategy(ref, `${acq.title ?? ""} ${acq.description_of_requirement ?? ""}`))
    );
  if (role.startsWith("flight operations")) return /A-102\.7/i.test(String(acq.enterprise_psl_check ?? ""));
  if (role.startsWith("aviation safety")) return answeredYes(acq, /S5V/i);
  if (role.startsWith("section 508")) return Boolean(acq.includes_it);
  if (role.startsWith("quality assurance")) return Boolean(acq.hardware_deliverable);
  if (role.startsWith("sources sought")) return value >= 50_000_000;
  return false;
}

/** Phases that require a recorded Go/No-go from reviewers. */
export const REVIEW_PHASES = ["JOFOC", "Go/No-go Poll"] as const;

/** Short plain word for a reviewer role, used in hold text: "legal", "pricing". */
export function shortRole(role: string): string {
  const head = role.split(/\(|,|\//)[0] ?? role;
  return head.replace(/review|coordination|authorization|meeting/gi, "").trim().toLowerCase() || role.toLowerCase();
}

/** Which review rules apply to a given phase of this acquisition. */
export function reviewRulesForPhase(
  phase: string,
  acq: AcqRow,
  rules: ReviewRuleRow[],
  ref: RefData,
): ReviewRuleRow[] {
  const applicable = rules.filter((r) => reviewApplies(r, acq, ref));
  if (phase === "JOFOC") return applicable.filter((r) => /^legal review/i.test(r.reviewer_role));
  if (phase === "Go/No-go Poll") return applicable;
  return [];
}

/** Which phase a template's document belongs to. */
export function phaseForTemplate(templateKey: string): string {
  if (templateKey === "jofoc") return "JOFOC";
  if (templateKey === "nf-1707") return "Intake";
  if (templateKey === "tech-eval" || templateKey === "technical-evaluation-report")
    return "Technical Evaluation";
  if (templateKey === "nonresponsibility") return "Responsibility Check";
  if (templateKey === "pnm") return "Price Reasonableness";
  if (
    templateKey === "commerciality" ||
    templateKey === "fair-opportunity-brand-name" ||
    templateKey === "consolidation-determination" ||
    templateKey === "bundling-determination" ||
    templateKey === "economy-act-determination" ||
    templateKey === "commercial-tm-lh-determination"
  )
    return "Market Research";
  if (templateKey === "option-justification") return "Solicitation/Quote";
  if (templateKey === "option-exercise-determination" || templateKey === "option-exercise-notification")
    return "Administration";
  if (templateKey === "cor-appointment" || templateKey === "cor-cancellation" || templateKey === "cpars-input")
    return "Administration";
  if (templateKey === "closeout-checklist") return "Closeout";
  return "Go/No-go Poll";
}

export type BoardEntry = {
  poll_id: string | null;
  phase: string;
  reviewer_role: string;
  reviewer_name: string;
  vote: "go" | "no-go" | "pending";
  reason: string | null;
  due_date: string | null;
  planned_days: number | null;
  citation: string | null;
  trigger: string | null;
  note: string | null;
};

export type ReviewerPerson = { name: string; title?: string | null; center_code?: string | null };

/**
 * The office that holds each review. A review belongs to a role, never to a
 * person by default; the person is whoever holds that role at the Center.
 */
export function reviewerTitleForRole(role: string): string {
  const r = role.toLowerCase();
  if (/legal|counsel/.test(r)) return "Center Chief Counsel";
  if (/small business/.test(r)) return "Center Small Business Specialist";
  if (/flight operations|aviation/.test(r)) return "Flight Operations Office";
  if (/enterprise strategy/.test(r)) return "OP enterprise strategy owner";
  if (/pricing/.test(r)) return "Center Pricing Officer";
  if (/quality/.test(r)) return "Center Quality Assurance Officer";
  if (/508|cio|ocio|it authorization|security/.test(r)) return "Center Chief Information Officer";
  if (/anosca|npa|announcement|notification|sources sought/.test(r)) return "Center Procurement Officer";
  if (/procurement strategy|acquisition plan/.test(r)) return "Center Procurement Officer";
  return role;
}

/**
 * The person holding a review, looked up by role from the Center's reviewer
 * table. When nobody holds the role the row names the role, never a person who
 * happens to be a reviewer elsewhere.
 */
export function reviewerNameForRole(
  role: string,
  center: string | null = null,
  roster: ReviewerPerson[] = [],
): string {
  const title = reviewerTitleForRole(role).toLowerCase();
  const match = (p: ReviewerPerson) => (p.title ?? "").trim().toLowerCase() === title;
  const atCenter = roster.find((p) => match(p) && (p.center_code ?? "") === (center ?? ""));
  const anywhere = atCenter ?? roster.find((p) => match(p) && (p.center_code ?? "") === "HQ");
  return anywhere?.name ?? `Unassigned, role: ${reviewerTitleForRole(role)}`;
}

export function pollBoard(
  acq: AcqRow,
  rules: ReviewRuleRow[],
  polls: PollRow[],
  ref: RefData,
  dueDate: string | null,
  phase = "Go/No-go Poll",
  roster: ReviewerPerson[] = [],
): BoardEntry[] {
  const forPhase = polls.filter((p) => (p.phase ?? "Go/No-go Poll") === phase);
  const center = (acq['center_code'] ?? null) as string | null;
  return reviewRulesForPhase(phase, acq, rules, ref).map((r) => {
    const row = forPhase.find((p) => (p.reviewer_role ?? "").toLowerCase() === r.reviewer_role.toLowerCase());
    const vote = (row?.vote ?? "pending") as BoardEntry["vote"];
    // The role decides the person. A name stored on a cast vote stands, because
    // that person actually voted; an unvoted row always reads from the roster.
    const byRole = reviewerNameForRole(r.reviewer_role, center, roster);
    const voted = vote === "go" || vote === "no-go";
    return {
      poll_id: row?.poll_id ?? null,
      phase,
      reviewer_role: r.reviewer_role,
      reviewer_name: (voted ? row?.reviewer_name : null) ?? byRole,
      vote: vote === "go" || vote === "no-go" ? vote : "pending",
      reason: row?.reason ?? null,
      due_date: row?.due_date ?? dueDate,
      planned_days: r.planned_days,
      citation: r.citation,
      trigger: r.trigger,
      note: r.note,
    };
  });
}

// ------------------------------------------------------------------ sequence

export type PhaseView = {
  phase: string;
  planned_days: number;
  order: number;
  status: "complete" | "current" | "upcoming";
  actual_days: number | null;
  docs: RequiredDoc[];
  citation: string;
  guidance: string;
  needsPoll: boolean;
};

export function buildSequence(
  acq: AcqRow,
  plan: PhasePlanRow[],
  todayISO: string,
  daysBetween: (a: string, b: string) => number,
): PhaseView[] {
  const type = acquisitionType(acq);
  const rows = plan
    .filter((p) => p.acquisition_type === type && p.phase)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const currentIndex = rows.findIndex(
    (r) => (r.phase ?? "").toLowerCase() === String(acq.current_phase ?? "").toLowerCase(),
  );
  const baseline = acq.regulatory_baseline_date ?? null;
  const elapsed = baseline ? Math.max(0, daysBetween(baseline, todayISO)) : null;

  let cumulative = 0;
  return rows.map((r, i) => {
    const planned = r.planned_days ?? 0;
    const before = cumulative;
    cumulative += planned;
    const status: PhaseView["status"] =
      currentIndex < 0 ? "upcoming" : i < currentIndex ? "complete" : i === currentIndex ? "current" : "upcoming";
    let actual: number | null = null;
    if (status === "complete") actual = planned;
    if (status === "current" && elapsed !== null) actual = Math.max(0, elapsed - before);
    const phase = r.phase as string;
    return {
      phase,
      planned_days: planned,
      order: r.order ?? i + 1,
      status,
      actual_days: actual,
      docs: requiredDocs(phase, acq),
      citation: PHASE_CITATIONS[phase] ?? "",
      guidance: PHASE_GUIDANCE[phase] ?? "",
      needsPoll: phase === "Go/No-go Poll",
    };
  });
}

// --------------------------------------------------------------------- hold

export type HoldCause = { reason: string; owner: string } | null;

export function computeHold(acq: AcqRow, phases: PhaseView[], board: BoardEntry[]): HoldCause {
  const owner = acq.co_name ? `Contracting officer: ${acq.co_name}` : "Contracting officer";
  const currentIndex = phases.findIndex((p) => p.status === "current");
  const throughCurrent = currentIndex < 0 ? phases : phases.slice(0, currentIndex + 1);

  for (const p of throughCurrent) {
    for (const d of p.docs) {
      if (d.optional) continue;
      if (docSatisfied(d, acq) === false)
        return { reason: `${p.phase}: ${d.label} is missing`, owner };
    }
  }

  // A No-go holds the file at once, whichever review phase it came from.
  const nogo = board.find((b) => b.vote === "no-go");
  if (nogo)
    return {
      reason: `No-go: ${shortRole(nogo.reviewer_role)}${nogo.reason ? ` — ${nogo.reason}` : ""}`,
      owner: `${nogo.reviewer_name} (${nogo.reviewer_role})`,
    };

  // A vote still pending when its phase has been left holds the file too.
  const indexOf = (phase: string) => phases.findIndex((p) => p.phase === phase);
  const pending = board.find((b) => {
    const i = indexOf(b.phase);
    return b.vote === "pending" && i >= 0 && currentIndex > i;
  });
  if (pending)
    return {
      reason: `${pending.phase}: ${pending.reviewer_role} has not voted`,
      owner: `${pending.reviewer_name} (${pending.reviewer_role})`,
    };
  return null;
}

// ------------------------------------------------------------- NCMS packet

/** Commercial simplified-procedures clause set. Numbers only; the status,
 *  date, and disposition are read from the clauses table. FAR 52.212-5 is
 *  Reserved and is never included. */
export const PACKET_CLAUSE_NUMBERS = [
  "52.204-7",
  "52.204-13",
  "52.204-24",
  "52.209-6",
  "52.212-1",
  "52.212-3",
  "52.212-4",
  "52.219-6",
  "52.222-3",
  "52.222-21",
  "52.222-26",
  "52.223-18",
  "52.225-13",
  "52.232-33",
  "52.233-3",
  "52.233-4",
  "52.247-34",
  "1852.203-70",
  "1852.204-76",
  "1852.245-70",
];

export const NCMS_CHECKLIST = [
  "Create the solicitation or award in NCMS from these facts.",
  "Insert the clause list below, with fill-ins, in the SF 1449 streamlined format.",
  "Attach the SOW or PWS, the IGCE, and the evaluation criteria.",
  "Enter the funding line and the requisition number.",
  "Route for the signatures NCMS requires; NCMS holds the document of record.",
];

export function buildPacket(
  acq: AcqRow,
  clauses: { clause_number: string | null; title: string | null; ucf_section: string | null; source: string | null; status: string | null; effective_date: string | null; fill_ins: unknown }[],
  phases: PhaseView[],
  board: BoardEntry[],
) {
  return {
    generated: new Date().toISOString(),
    note: "T-Minus handoff packet. NCMS is the contract writing system of record (NFS CG 1804.11). This packet is not the solicitation or the contract.",
    acquisition: acq,
    clauses,
    checklist: NCMS_CHECKLIST,
    record_to_date: phases.map((p) => ({
      phase: p.phase,
      status: p.status,
      planned_days: p.planned_days,
      actual_days: p.actual_days,
      required_documents: p.docs
        .filter((d) => !d.optional)
        .map((d) => `${d.label} (${d.citation})`),
      offered_documents: p.docs.filter((d) => d.optional).map((d) => `${d.label} (${d.citation})`),
    })),
    reviews: board,
  };
}
