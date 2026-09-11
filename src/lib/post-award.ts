/**
 * Post-award modules: option exercise, COR appointment, CPARS input,
 * closeout, and SF 30 modification packets.
 *
 * Every date and dollar figure is derived from the acquisition record or read
 * from the thresholds and clauses tables. Nothing regulatory is hard-coded
 * beyond the citation labels that name the rule being applied.
 */

import type { AcqRow } from "@/lib/launch-sequence";
import type { ThresholdRow } from "@/lib/protest-window";

export type PostAward = {
  option_notice_date?: string;
  option_notice_sent?: string;
  option_exercised_date?: string;
  cor_appointed_name?: string;
  cor_appointed_date?: string;
  cor_cancelled_date?: string;
  cpars_submitted_date?: string;
  closeout_pr_number?: string;
  final_payment_date?: string;
  closeout_completed_date?: string;
};

/** Read the post-award block off the record. */
export function postAward(acq: AcqRow | null | undefined): PostAward {
  const raw = acq?.["post_award"];
  return raw && typeof raw === "object" ? (raw as PostAward) : {};
}

const isoAdd = (iso: string, { days = 0, years = 0 }: { days?: number; years?: number }) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() + years);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const thresholdRow = (rows: ThresholdRow[], name: string) =>
  rows.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase()) ?? null;

// ------------------------------------------------------------ option periods

/** Preliminary notice lead, FAR 52.217-9: the standard NASA fill-in is 60 days. */
export const OPTION_NOTICE_LEAD_DAYS = 60;

export type OptionPeriod = {
  label: string;
  start: string | null;
  end: string | null;
  noticeDue: string | null;
};

/**
 * Option-year dates from the record. The base period is the recorded period of
 * performance; where none is recorded, it runs one year from the award date.
 */
export function optionSchedule(acq: AcqRow | null | undefined, awardDate: string | null, count = 2) {
  const start = (acq?.period_of_performance_start as string | null) ?? awardDate ?? null;
  let end = (acq?.period_of_performance_end as string | null) ?? null;
  const derivedBase = !acq?.period_of_performance_end;
  if (!end && start) end = isoAdd(start, { years: 1, days: -1 });
  const periods: OptionPeriod[] = [];
  let cursor = end;
  for (let i = 1; i <= count; i += 1) {
    const s = cursor ? isoAdd(cursor, { days: 1 }) : null;
    const e = s ? isoAdd(s, { years: 1, days: -1 }) : null;
    periods.push({
      label: `Option period ${i}`,
      start: s,
      end: e,
      noticeDue: s ? isoAdd(s, { days: -OPTION_NOTICE_LEAD_DAYS }) : null,
    });
    cursor = e;
  }
  return { baseStart: start, baseEnd: end, derivedBase, periods };
}

// --------------------------------------------------------------------- CPARS

export type CparsView = {
  applies: boolean;
  thresholdValue: number | null;
  citation: string | null;
  note: string | null;
  dueDate: string | null;
  periodEnd: string | null;
};

/**
 * CPARS is required where the value exceeds the threshold row. The first
 * evaluation covers the twelve months after award and is due within 120 days
 * of the end of that period (FAR 42.1502(a); FAR 42.1503(f)).
 */
export function cparsView(
  acq: AcqRow | null | undefined,
  thresholds: ThresholdRow[],
  awardDate: string | null,
): CparsView {
  const row = thresholdRow(thresholds, "CPARS past performance evaluation");
  const limit = row?.value === null || row?.value === undefined ? null : Number(row.value);
  const value = Number(acq?.estimated_value ?? 0);
  const periodEnd = awardDate ? isoAdd(awardDate, { years: 1, days: -1 }) : null;
  return {
    applies: limit !== null && value > limit,
    thresholdValue: limit,
    citation: row?.citation ?? null,
    note: row?.note ?? null,
    periodEnd,
    dueDate: periodEnd ? isoAdd(periodEnd, { days: 120 }) : null,
  };
}

// ------------------------------------------------------------------ closeout

export type RetentionView = {
  years: number | null;
  citation: string | null;
  note: string | null;
  from: string | null;
  fromLabel: string;
  date: string | null;
};

/** Records retention runs from final payment; the year count is a threshold row. */
export function retentionView(
  thresholds: ThresholdRow[],
  finalPaymentDate: string | null,
  awardDate: string | null,
): RetentionView {
  const row = thresholdRow(thresholds, "Contract file records retention after final payment (years)");
  const years = row?.value === null || row?.value === undefined ? null : Number(row.value);
  const from = finalPaymentDate ?? awardDate ?? null;
  return {
    years,
    citation: row?.citation ?? null,
    note: row?.note ?? null,
    from,
    fromLabel: finalPaymentDate ? "final payment" : "award date, until final payment is recorded",
    date: from && years !== null ? isoAdd(from, { years }) : null,
  };
}

/** FAR 4.804-5 closeout steps, shown as the transfer checklist. */
export const CLOSEOUT_CHECKLIST = [
  "Disposition of classified material is completed.",
  "Final patent and royalty reports are cleared.",
  "Final contractor performance evaluation is in CPARS.",
  "Property clearance is completed and government property is accounted for.",
  "All interim or disallowed costs are settled.",
  "Price revision is completed and the final price is recorded.",
  "Subcontracts are settled by the prime contractor.",
  "Prior year indirect cost rates are settled.",
  "Termination docket is completed, or none exists.",
  "Contract audit is completed.",
  "Contractor's closing statement and final invoice are received.",
  "Final payment is made and the requisition is recorded.",
  "Contract funds status is reconciled and excess funds are deobligated.",
  "The contract file is complete and ready for transfer to records (FAR 4.801, FAR 4.805).",
];

// ------------------------------------------------------- SF 30 clause delta

export type ClauseRow = {
  clause_number: string | null;
  title: string | null;
  ucf_section: string | null;
  source: string | null;
  status: string | null;
  effective_date: string | null;
  disposition?: string | null;
  fill_ins?: unknown;
};

export type ClauseDelta = {
  updated: ClauseRow[];
  removed: ClauseRow[];
  unchanged: ClauseRow[];
};

/**
 * Clause delta for a modification: the disposition and status recorded in the
 * clause matrices decide the bucket. Removed clauses never carry into a new
 * document; they are listed so the modification can strike them.
 */
export function clauseDelta(rows: ClauseRow[]): ClauseDelta {
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const n = r.clause_number ?? "";
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  const text = (r: ClauseRow) => `${r.disposition ?? ""} ${r.status ?? ""}`.toLowerCase();
  return {
    removed: unique.filter((r) => /removed|deleted|not in nfs matrix/.test(text(r))),
    updated: unique.filter((r) => !/removed|deleted|not in nfs matrix/.test(text(r)) && /updated|new|revised/.test(text(r))),
    unchanged: unique.filter(
      (r) => !/removed|deleted|not in nfs matrix/.test(text(r)) && !/updated|new|revised/.test(text(r)),
    ),
  };
}

export const SF30_CHECKLIST = [
  "Create the SF 30 modification in NCMS from these facts.",
  "Enter the modification authority and the block 13 checkbox it belongs to.",
  "Strike the clauses listed as removed and insert the updated versions with their fill-ins.",
  "Attach the supporting determination for this modification.",
  "Route for the signatures NCMS requires; NCMS holds the modification of record.",
];

export function buildModificationPacket(
  acq: AcqRow,
  kind: "option exercise" | "administrative" | "supplemental agreement",
  authority: string,
  delta: ClauseDelta,
  period: OptionPeriod | null,
) {
  return {
    generated: new Date().toISOString(),
    note: "T-Minus handoff packet for an SF 30 modification. NCMS is the contract writing system of record (NFS CG 1804.11). This packet is not the modification.",
    form: "SF 30, Amendment of Solicitation/Modification of Contract",
    modification_kind: kind,
    modification_authority: authority,
    acquisition: acq,
    option_period: period,
    clause_delta: {
      removed: delta.removed,
      updated: delta.updated,
      unchanged_count: delta.unchanged.length,
    },
    checklist: SF30_CHECKLIST,
  };
}
