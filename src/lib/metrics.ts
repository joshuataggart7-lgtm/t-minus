// Executive metrics. Every figure here is recomputed on read from the record,
// the phase plan, and the polls. Nothing is stored.

import { dateCT } from "@/lib/calendar-date";
import { addDays, daysBetween, todayISO, type RefData } from "@/lib/intake";
import {
  buildSequence,
  computeHold,
  docRowKey,
  docSatisfied,
  generatorKey,
  pollBoard,
  REVIEW_PHASES,
  type AcqRow,
  type BoardEntry,
  type ReviewerPerson,
  type PhasePlanRow,
  type PhaseView,
  type PollRow,
  type ReviewRuleRow,
} from "@/lib/launch-sequence";
import { resolveHold } from "@/lib/hold";

export type MissionRow = {
  mission_id: string;
  name: string;
  program: string | null;
  center_code: string | null;
  milestone: string | null;
  milestone_date: string | null;
  priority: number | null;
  program_owner: string | null;
  leadership_note: string | null;
};

export type StatusWord = "On Track" | "Needs Attention" | "At Risk" | "Launched";

export type AcqMetrics = {
  acq: AcqRow;
  phases: PhaseView[];
  /** Reviews for the current phase only. Future reviews never block this file. */
  board: BoardEntry[];
  upcomingReviews: BoardEntry[];
  hold: { reason: string; owner: string; doc?: { phase: string; label: string } } | null;
  clockState: string;
  currentPhase: string | null;
  nextDecision: string;
  nextDecisionDate: string | null;
  daysToNextDecision: number | null;
  daysToAward: number | null;
  awardDate: string | null;
  daysSinceAward: number | null;
  forecastAwardDate: string | null;
  scheduleImpactDays: number | null;
  timeSavedDays: number;
  status: StatusWord;
  blocker: string;
  blockerOwner: string | null;
  blockerSince: string | null;
  nextAction: string;
  deadline: string | null;
};

const dayFmt = (iso: string | null) => {
  if (!iso) return "no date";
  // A calendar date or a full timestamp both read as a calendar date here,
  // so a checked_at stamp never renders as "Invalid Date".
  const when = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(when.getTime())) return "no date";
  return when.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};


export function formatDate(iso: string | null) {
  return dayFmt(iso);
}

/** A date or a timestamp, shown as a real date and time. Never "Invalid Date". */
export function formatStamp(value: string | null | undefined) {
  if (!value) return "no date";
  const raw = value.length === 10 ? `${value}T00:00:00Z` : value;
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return "no date";
  return when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusColor(status: StatusWord) {
  if (status === "At Risk") return "var(--atrisk)";
  if (status === "Needs Attention") return "var(--attention)";
  if (status === "Launched") return "var(--panel)";
  return "var(--ontrack)";
}

/** When the current hold began. Null unless the STORED acquisition_facts
 *  clock_state is "hold". Reads only this file's audit rows with
 *  field = "clock_state", newest first. The last clear is the newest row whose
 *  new_value (trimmed, lower-cased) is exactly "running", "launched" or
 *  "scrubbed"; any other clock_state row neither starts nor ends a hold.
 *  Candidates are rows newer than that clear whose new_value is "hold",
 *  whose action is not "Scrubbed" and does not match /clear|resum/i. The
 *  start is the newest candidate whose old_value is not "hold", else the
 *  oldest candidate. hold_started_at is not read.
 *  Columns read: audit_log.acquisition_id, field, action, old_value,
 *  new_value, logged_at; acquisition_facts.clock_state. */
export function holdSince(
  acq: { acquisition_id: string; clock_state?: unknown } | Record<string, unknown>,
  log: { acquisition_id: string | null; action: string | null; field?: string | null; old_value?: string | null; new_value?: string | null; logged_at: string | null }[],
): string | null {
  const row = acq as Record<string, unknown>;
  if (String(row["clock_state"] ?? "").trim().toLowerCase() !== "hold") return null;
  const id = row["acquisition_id"];
  const rows = log
    .filter((l) => l.acquisition_id === id && l.field === "clock_state")
    .sort((a, b) => String(b.logged_at ?? "").localeCompare(String(a.logged_at ?? "")));
  const norm = (v: string | null | undefined) => String(v ?? "").trim().toLowerCase();
  const lastClear = rows.find((l) => ["running", "launched", "scrubbed"].includes(norm(l.new_value)));
  const holdRows = rows.filter(
    (l) =>
      norm(l.new_value) === "hold" &&
      l.action !== "Scrubbed" &&
      !/clear|resum/i.test(l.action ?? "") &&
      (!lastClear || String(l.logged_at ?? "") > String(lastClear.logged_at ?? "")),
  );
  if (!holdRows.length) return null;
  const start = holdRows.find((l) => l.old_value !== "hold") ?? holdRows[holdRows.length - 1]!;
  return start.logged_at ? dateCT(String(start.logged_at)) : null;
}

/** The recorded launch event is the award date; target date is a legacy fallback. */
export function awardDateFor(
  acquisitionId: string,
  log: { acquisition_id: string | null; action: string | null; logged_at: string | null }[],
  fallback: string | null = null,
): string | null {
  const row = log
    .filter((l) => l.acquisition_id === acquisitionId && l.action === "Launched")
    .sort((a, b) => String(b.logged_at ?? "").localeCompare(String(a.logged_at ?? "")))[0];
  return row?.logged_at ? (dateCT(String(row.logged_at)) ?? fallback) : fallback;
}

/** The words the file page hero uses for a missing Required row. */
export function heroActionLabel(doc: {
  label: string;
  field?: string | null;
  templateKey?: string | null;
  formKey?: string | null;
}): string {
  const generator = generatorKey(doc as never);
  if (generator) {
    if (generator === "market-research-memo") return "Write the memorandum";
    if (generator === "nf-1787") return "Write the NF 1787";
    if (generator === "nf-1787a") return "Write the NF 1787A";
    if (generator === "pnm") return "Write the PNM";
    return `Write the ${doc.label}`;
  }
  if (doc.field === "igce_attached") return "Attach the IGCE";
  if (doc.field === "sow_attached") return "Attach the SOW/PWS";
  return `Attach the ${doc.label}`;
}

export function computeMetrics(
  acq: AcqRow,
  opts: {
    plan: PhasePlanRow[];
    rules: ReviewRuleRow[];
    polls: PollRow[];
    ref: RefData;
    mission?: MissionRow | null;
    holdSince?: string | null;
    awardDate?: string | null;
    today?: string;
    /** Center reviewer table: who holds each reviewing role. */
    roster?: ReviewerPerson[];
    /** Document keys with a stored file, so a cleared cause never lingers. */
    attachedKeys?: Set<string>;
    /** Generator keys with a saved version, so a written document clears its row. */
    savedKeys?: Set<string>;
  },
): AcqMetrics {
  const today = opts.today ?? todayISO();
  const phases = buildSequence(acq, opts.plan, today, daysBetween, {
    attachedKeys: opts.attachedKeys,
    savedKeys: opts.savedKeys,
  });
  const allBoards = REVIEW_PHASES.flatMap((phase) =>
    pollBoard(
      acq,
      opts.rules,
      opts.polls.filter((p) => p.acquisition_id === acq.acquisition_id),
      opts.ref,
      acq.target_award_date ?? null,
      phase,
      opts.roster ?? [],
    ),
  );
  const current = phases.find((p) => p.status === "current") ?? null;
  const board = allBoards.filter((entry) => entry.phase === current?.phase);
  const upcomingReviews = allBoards.filter((entry) => {
    const phase = phases.find((p) => p.phase === entry.phase);
    return phase?.status === "upcoming";
  });
  const scrubbed = acq.status === "scrubbed" || acq.clock_state === "scrubbed";
  const launched = acq.clock_state === "launched";
  const hold = launched || scrubbed ? null : resolveHold(acq, phases, board, opts.attachedKeys, opts.savedKeys);
  const clockState =
    launched || scrubbed
      ? (launched ? "launched" : "scrubbed")
      : hold
        ? "hold"
        : String(acq.clock_state ?? "running");

  // Planned exit of the current phase. One source of truth with the launch
  // sequence line and the award forecast: the days already worked in the phase
  // (PhaseView.actual_days, from the recorded day the phase began) against its
  // planned days. A phase already past its plan has a planned exit in the past.
  let plannedExit: string | null = null;
  if (current && current.actual_days !== null) {
    plannedExit = addDays(today, current.planned_days - current.actual_days);
  }

  const pendingDue = board
    .filter((b) => b.vote === "pending" && b.due_date)
    .map((b) => b.due_date as string)
    .sort()[0];

  const candidates = [plannedExit, pendingDue].filter(Boolean) as string[];
  let nextDecisionDate = candidates.length ? candidates.sort()[0] : null;
  let nextDecision = pendingDue && pendingDue === nextDecisionDate
    ? `${board.find((b) => b.due_date === pendingDue && b.vote === "pending")?.reviewer_role ?? "Reviewer"} vote`
    : current
      ? `Exit ${current.phase}`
      : "None open";

  if (scrubbed) {
    nextDecision = "Clock stopped";
    nextDecisionDate = null;
  } else if (launched) {
    const administration = phases.find((p) => p.phase === "Administration" && p.status !== "complete");
    const closeout = phases.find((p) => p.phase === "Closeout" && p.status !== "complete");
    nextDecision = administration ? "Complete Administration" : closeout ? "Complete Closeout" : "Post-award work complete";
    nextDecisionDate = null;
  }
  const daysToNextDecision = nextDecisionDate ? daysBetween(today, nextDecisionDate) : null;
  const daysToAward = launched || scrubbed || !acq.target_award_date ? null : daysBetween(today, String(acq.target_award_date));
  const awardDate = launched ? (opts.awardDate ?? (acq.target_award_date ? String(acq.target_award_date) : null)) : null;
  const daysSinceAward = awardDate ? Math.max(0, daysBetween(awardDate, today)) : null;

  const awardIndex = phases.findIndex((p) => p.phase === "Award");
  const throughAward = awardIndex >= 0 ? phases.slice(0, awardIndex + 1) : phases;
  // Days still to run through award: what is left of the current phase (none
  // once it is past plan) plus every later phase's planned days.
  const remaining = throughAward
    .filter((p) => p.status !== "complete")
    .reduce(
      (sum, p) =>
        sum + (p.status === "current" && p.actual_days !== null ? Math.max(0, p.planned_days - p.actual_days) : p.planned_days),
      0,
    );
  const holdDays = clockState === "hold" && opts.holdSince ? Math.max(0, daysBetween(opts.holdSince, today)) : 0;
  const forecastAwardDate =
    clockState === "launched" ? (acq.target_award_date ? String(acq.target_award_date) : null) : addDays(today, remaining + holdDays);

  const lead = Number(acq['lead_to_delivery_days'] ?? 0) || 0;
  const milestoneDate = opts.mission?.milestone_date ?? null;
  const scheduleImpactDays =
    milestoneDate && forecastAwardDate
      ? daysBetween(addDays(forecastAwardDate, lead), String(milestoneDate))
      : null;

  const timeSavedDays = phases
    .filter((p) => p.status === "complete")
    .reduce((sum, p) => sum + (p.planned_days - (p.actual_days ?? p.planned_days)), 0);

  const behind = phases.some(
    (p) => p.status === "current" && p.actual_days !== null && p.actual_days > p.planned_days,
  );
  const pollSoon = board.some(
    (b) => b.vote === "pending" && b.due_date && daysBetween(today, b.due_date) <= 3,
  );

  let status: StatusWord;
  if (clockState === "launched") status = "Launched";
  else if (clockState === "hold" || (scheduleImpactDays !== null && scheduleImpactDays < 0)) status = "At Risk";
  else if (behind || pollSoon) status = "Needs Attention";
  else status = "On Track";

  let blocker = "None";
  let blockerOwner: string | null = null;
  // The next step says the same thing the file page hero says: write or attach
  // the Required document that is missing, in the same words.
  let heroLabel: string | null = null;
  if (launched || scrubbed) {
    blocker = "None";
  } else if (hold) {
    blocker = hold.reason;
    blockerOwner = hold.owner;
  } else {
    const pending = board.find((b) => b.vote === "pending");
    // Only a Required row blocks. An offered row never reads as missing.
    const missingDoc = current?.docs.find(
      (d) =>
        !d.optional &&
        (d.field || generatorKey(d)) &&
        docSatisfied(
          d,
          acq,
          opts.attachedKeys ? opts.attachedKeys.has(docRowKey(d)) : undefined,
          opts.savedKeys,
        ) === false,
    );
    if (pending) {
      blocker = `${pending.reviewer_role} has not voted`;
      blockerOwner = pending.reviewer_name;
    } else if (missingDoc) {
      blocker = `${missingDoc.label} is missing`;
      blockerOwner = (acq.co_name as string) ?? null;
    }
    if (missingDoc) heroLabel = heroActionLabel(missingDoc);
  }

  return {
    acq,
    phases,
    board,
    upcomingReviews,
    hold,
    clockState,
    currentPhase: current?.phase ?? (acq.current_phase ? String(acq.current_phase) : null),
    nextDecision,
    nextDecisionDate: nextDecisionDate ?? null,
    daysToNextDecision,
    daysToAward,
    awardDate,
    daysSinceAward,
    forecastAwardDate,
    scheduleImpactDays,
    timeSavedDays,
    status,
    blocker,
    blockerOwner,
    blockerSince: opts.holdSince ?? null as string | null,
    nextAction: heroLabel ?? nextDecision,
    deadline: nextDecisionDate ?? null,
  };
}

/** The one sentence leadership reads. No AI; a leadership_note replaces it. */
export function callout(m: AcqMetrics, mission: MissionRow): string {
  if (mission.leadership_note) return mission.leadership_note;
  const impact = m.scheduleImpactDays ?? 0;
  const word = impact < 0 ? "after" : "before";
  const owner = m.blockerOwner ?? "unassigned";
  const since = m.blockerSince ? ` since ${dayFmt(m.blockerSince)}` : "";
  return `${mission.name}: ${m.blocker}${since}, owner ${owner}. Award forecast ${Math.abs(impact)} days ${word} ${mission.milestone ?? "the milestone"}. Decision needed: ${m.nextDecision} by ${dayFmt(m.nextDecisionDate)}.`;
}

/** The acquisition that speaks for the mission: critical path first, then the
 *  tightest schedule impact. */
export function missionDriver(rows: AcqMetrics[]): AcqMetrics | null {
  if (!rows.length) return null;
  const critical = rows.filter((r) => r.acq['is_critical_path']);
  const pool = critical.length ? critical : rows;
  return [...pool].sort(
    (a, b) => (a.scheduleImpactDays ?? 9999) - (b.scheduleImpactDays ?? 9999),
  )[0]!;
}

const URGENCY: Record<StatusWord, number> = {
  "At Risk": 0,
  "Needs Attention": 1,
  Launched: 2,
  "On Track": 3,
};

export function urgencyRank(m: AcqMetrics) {
  return URGENCY[m.status] * 10_000 + (m.scheduleImpactDays ?? 9999);
}
