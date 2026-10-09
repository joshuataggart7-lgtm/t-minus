import { writeAudit } from "@/lib/audit";
import { FadeStrip } from "@/components/fade-strip";
import { loadTechnicalRecord } from "@/lib/eqr-summary";
import { phaseAlias, storedPhaseNames } from "@/lib/phase-alias";
import { auditActionLabel, auditFieldLabel, auditTextLabel, auditValueLabel, storedAs } from "@/lib/audit-display";
import { checkDocsFrom, fileSelfCheck } from "@/lib/file-self-check";
import { ConflictNote } from "@/components/threshold-conflicts-panel";
import { changesSince, useLastLook, type LookRow } from "@/lib/since-last-look";
import { SinceLastLookPanel } from "@/components/since-last-look-panel";
import { FileSelfCheckPanel } from "@/components/file-self-check-panel";
import { DECISION_LABEL, PHASE_EXIT_RULE, REVIEW_KIND_LABEL, decisionAudit, decisionOptions, decisionOutcome, type ReviewDecision } from "@/lib/review-decisions";
import { ReviewDecisionFields, rationaleMissing } from "@/components/review-decision-fields";
import { DEMO_READ_ONLY_NOTE, failureText, isDemoSession } from "@/lib/demo-guard";
import { useCanWrite } from "@/lib/use-can-write";
import { TableScrollRegion } from "@/components/table-scroll-region";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { usePresenter } from "@/lib/presenter";
import { copyAsNewSample } from "@/lib/copy-sample";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { ReviewCard } from "@/components/review-card";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pollOptions } from "@/lib/poll";
import { loadStateAuditRows } from "@/lib/launch-events";
import { cparsRecorded } from "@/lib/state-audit";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState, FilePageSkeleton } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadModTasks, storedClauseList } from "@/lib/clause-impact";
import { useRole } from "@/components/role-context";
import { RegulationSidebar } from "@/components/regulation-sidebar";
import { Nf1707Signoffs } from "@/components/nf1707-signoffs";

import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import { addDays, daysBetween, formatMoney, todayISO, type RefData } from "@/lib/intake";
import { DIRECTIVE_CITATION, REVIEW_STATUSES, reviewStatus } from "@/lib/directives";
import {
  acquisitionType,
  acquisitionTypeWords,
  buildPacket,
  buildSequence,
  docSatisfied,
  generatorKey,
  NCMS_CHECKLIST,
  phaseLabel,
  stepLabel,
  phaseOverrunDays,
  pollBoard,
  reviewerNameForRole,
  jofocAuthorityFor,
  REVIEW_PHASES,
  reviewRulesForPhase,
  type AcqRow,
  type BoardEntry,
  type PhaseView,
  type RequiredDoc,
} from "@/lib/launch-sequence";
import type { PhasePlanRow } from "@/lib/launch-sequence";
import { awardConfidence, historyFrom } from "@/lib/confidence";
import {
  IDIQ_CLAUSE_DELTA_WITHHELD_NOTE,
  PACKET_CANDIDATE_NUMBERS,
  RFO_RESERVED_212_NOTE,
  selectPacketClauses,
} from "@/lib/clause-packet";
import { orderPacketForScreen } from "@/lib/ncms-handoff";
import { CorToRequestPanel } from "@/components/cor-to-request-panel";
import { ClausePicker } from "@/components/clause-picker";
import { PilotKnownGapsLine } from "@/components/pilot-known-gaps";
import { FilePhaseStepper } from "@/components/file-phase-stepper";
import { CiteChip, DataTable, EmptyCell, StatusChip } from "@/components/ui-mc";
import { dueView, holdAlertText, holdShortLabel, phasePosition, phasePositionText } from "@/lib/file-timeline";
import { certifiedDataBasis, CERTIFIED_DATA_LABEL } from "@/lib/certified-data";
import { AdvisoryTag } from "@/components/advisory-tag";
import { LockHint } from "@/components/demo-lock";
import { CLAUSE_FILLIN_NOTE, clauseFillinText } from "@/lib/clause-fillins";
import { isSimplifiedCommercial } from "@/lib/memo-draft";
import { SebCockpitPanel } from "@/components/seb-cockpit-panel";
import { ReadReceiptsPanel } from "@/components/read-receipts-panel";
import { loadReadReceiptCount } from "@/lib/read-receipts";

import { ClauseChangeBanner } from "@/components/clause-change-banner";
import { SolicitationKlmPanel } from "@/components/solicitation-klm-panel";
import { SectionJPanel } from "@/components/section-j-panel";
import { attachmentsForSectionJ } from "@/lib/section-j";
import { CdrlPanel } from "@/components/cdrl-panel";
import { SowClauseAssistPanel } from "@/components/sow-clause-assist-panel";
import { Table12FillinsPanel } from "@/components/table-12-fillins-panel";
import { AwardHandoffPanel } from "@/components/award-handoff-panel";
import { Nf1098AssemblyPanel } from "@/components/nf1098-assembly-panel";
import { FpdsFillAidSummary } from "@/components/fpds-fill-aid-summary";
import { buildNf1098Assembly } from "@/lib/nf1098-assembly";
import { cdrlForPacket, loadCdrl } from "@/lib/cdrl";
import { PaymentMilestonesPanel } from "@/components/payment-milestones-panel";
import { loadPaymentMilestones, paymentMilestonesForPacket } from "@/lib/payment-milestones";
import {
  LM_AUTHORED_CHIP,
  LM_STUB_CHIP,
  lmAuthored,
  loadFactors,
  loadSectionL,
  loadSectionM,
  methodShell,
  sectionLLines,
  sectionMLines,
} from "@/lib/solicitation-lm";
import { acquisitionProfile, modAuthorityText, modRows } from "@/lib/vehicles";
import { buildFormatScaffold, scaffoldForPacket } from "@/lib/format-scaffold";
import { loadSectionK, sectionKForPacket } from "@/lib/solicitation-k";
import { FormatScaffoldPanel } from "@/components/format-scaffold-panel";
import { ClinSchedulePanel } from "@/components/clin-schedule-panel";
import {
  ensureClinScheduleFromIgce,
  loadClinSchedule,
  scheduleToScaffoldClins,
} from "@/lib/clin-schedule";
import { evaluateCompanionGates } from "@/lib/companion-gates";
import { CompanionGatesPanel } from "@/components/companion-gates-panel";
import { loadDeviationsForAcquisition } from "@/lib/pcd-adoption";
import { PcdAdoptionPanel } from "@/components/pcd-adoption-panel";
import { BlackoutNoticePanel } from "@/components/blackout-notice-panel";
import { DraftRfpAlertPanel } from "@/components/draft-rfp-alert-panel";
import { EnterprisePslPanel } from "@/components/enterprise-psl-panel";
import { ThresholdConflictsPanel } from "@/components/threshold-conflicts-panel";
import { CenterLocalClausesPanel } from "@/components/center-local-clauses-panel";
import { PracticeLinksPanel } from "@/components/practice-links-panel";
import { DeterminationHelpersPanel } from "@/components/determination-helpers-panel";
import { OfficeInvitePanel } from "@/components/office-invite-panel";
import { DocumentVersionsPanel } from "@/components/document-versions-panel";
import type { StoredEstimate } from "@/lib/estimator";
import { exportNearBundle } from "@/lib/near-export";
import { exportBriefingBook, briefingFacts } from "@/lib/briefing-book";
import { exportFpdsFillingSheet } from "@/lib/fpds-filling-sheet";
import { exportEvidencePack } from "@/lib/evidence-pack";
import { requiredTabs, offeredTabs, buildFileIndex, type IndexOpen } from "@/lib/file-index";

/** The stored upload behind an index row, when the row is an upload. */
const attachmentIdOf = (open: IndexOpen | null) => (open?.kind === "attachment" ? open.attachmentId : "");
import {
  ATTACHMENT_ACCEPT,
  docKey,
  downloadAttachment,
  igceFromFile,
  loadAttachments,
  removeAttachment,
  saveIgceClins,
  uploadAttachment,
  type AttachmentRow,
} from "@/lib/attachments";
import { alsoRecordedHold, holdOwnerDisplay, resolveHold, attachedKeys as keysFrom } from "@/lib/hold";
import { TEMPLATES } from "@/lib/template-engine";
import { StandaloneDraft } from "@/components/standalone-draft";
import { NewOrderPanel } from "@/components/new-order-panel";
import { FORM_NAMES, GENERATED_FORM_KEYS } from "@/lib/nf1787";
import { recommendedOfficialForm } from "@/lib/sf-forms";
import { signedInName } from "@/lib/account-name";
import { boardReadiness } from "@/lib/board-readiness";
import { loadClarifications } from "@/lib/clarifications";
import { protestWindow } from "@/lib/protest-window";
import {
  ANTICIPATED_AWARD_TBD,
  ANTICIPATED_AWARD_TBD_NOTE,
  FORECAST_CITATION,
  FORECAST_FIELDS,
  forecastCsv,
  forecastEntry,
  satValue,
  type ForecastAcq,
} from "@/lib/forecast";
import { ExplainThis } from "@/components/explain-this";
import { Nova } from "@/components/nova";
import { MarketResearchEngine } from "@/components/market-research-engine";
import {
  explainHold,
  explainDocRow,
  explainMissingDoc,
  fileStory,
  fileStoryProvenance,
  explainReview,
  explainStatus,
  explainWarrant,
} from "@/lib/explain";
import { successorFor } from "@/lib/successor";
import { buildEmailDrafts } from "@/lib/email-drafts";
import { EmailDraftsPanel } from "@/components/email-drafts-panel";
import { WhatIfPanel } from "@/components/what-if-panel";
import { VehiclePanel } from "@/components/vehicle-panel";
import { ModificationsPanel } from "@/components/modifications-panel";
import { CloseoutPanel } from "@/components/closeout-panel";
import { SituationMemoPanel } from "@/components/situation-memo-panel";
import { DeadlinesPanel } from "@/components/deadlines-panel";
import { ageInDays, thresholdFor } from "@/lib/aging";
import { computeMetrics, formatDate, formatStamp, holdSince } from "@/lib/metrics";
import { LaunchCountdown, LaunchCountdownCompact, countdownText, countdownView, type CountdownView } from "@/components/launch-countdown";
import { deriveOverviewAcquisitionState, overviewCountdownView, STORED_LAUNCH_NOTE } from "@/components/mission-control/operational-state";
import { fileStatusLine } from "@/components/mission-control/file-status";
import { MissionReadinessChip } from "@/components/mission-control/primitives";
import { explainWorkReadiness } from "@/components/mission-control/readiness";
import {
  MissionNavigator,
  MissionNavSection,
  MISSION_NAV_CURRENT,
  MISSION_NAV_REVEAL,
  MISSION_NAV_SET_ALL,
  stickyOffset,
  type MissionNavItem,
} from "@/components/mission-control/mission-navigator";
import { exclusionFlagFrom, type SweepCheckRow } from "@/lib/sweep-flag";
import {
  buildModificationPacket,
  clauseDelta,
  CLOSEOUT_CHECKLIST,
  cparsView,
  optionSchedule,
  postAward,
  retentionView,
  SF30_CHECKLIST,
  type OptionPeriod,
  type PostAward,
} from "@/lib/post-award";
import { methodDisplayLabel } from "@/lib/rfo-simplified-cites";

/** Phases that carry the NCMS clause packet. */
const PACKET_PHASES: readonly string[] = [
  "Solicitation/Quote",
  "Technical Evaluation",
  "Price Reasonableness",
  "Award",
  // An awarded vehicle still shows the clauses it carries, so the packet can
  // be read on a file already in administration.
  "Administration",
];

export const Route = createFileRoute("/files_/$acquisitionId")({
  head: () => ({
    meta: [
      { title: "Acquisition file · T-Minus" },
      {
        name: "description",
        content: "The clock line, the launch sequence, the reviews and approvals, and the thresholds for one acquisition.",
      },
      { property: "og:title", content: "Acquisition file · T-Minus" },
      {
        property: "og:description",
        content: "Clock line, launch sequence, reviews and approvals, and thresholds for one acquisition.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <PageHeader title="This file could not be loaded" lead="Go back to Files and open it again." />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <PageHeader title="File not found" lead="Go back to Files and choose an acquisition." />
    </AppShell>
  ),
  component: FilePage,
});

type Mode = "novice" | "veteran";

type FileActionDialog =
  | { kind: "exit"; phase: string }
  | { kind: "scrub" }
  | { kind: "remove"; doc: RequiredDoc }
  | { kind: "open-poll"; phase: string }
  | { kind: "vote"; entry: BoardEntry };

function requirementId(phase: string, label: string) {
  return `requirement-${phase}-${label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/* Reviewer names come from the Center reviewer table at the moment the poll
 * opens, the same source the poll board reads. */

function statusColor(state: string | null | undefined) {
  if (state === "hold") return "var(--mc-readiness-hold)";
  if (state === "launched") return "var(--mc-readiness-launched)";
  return "var(--mc-readiness-go)";
}

/* The launch sequence phase line. Plain wording built only from the phase row's
 * own figures: days worked so far, the planned days, and the phase name. */
function phaseDayLine(p: Pick<PhaseView, "phase" | "status" | "actual_days" | "planned_days">) {
  const dayWord = (n: number) => (n === 1 ? "day" : "days");
  const planned = p.planned_days;
  const actual = p.actual_days;
  if (actual === null) {
    return p.status === "complete"
      ? `Start or end date not recorded, ${planned} planned ${dayWord(planned)}`
      : `${planned} planned ${dayWord(planned)}`;
  }
  const diff = Math.abs(actual - planned);
  if (p.status === "complete") {
    const note = actual > planned ? `${diff} over` : actual < planned ? `${diff} under` : "on plan";
    return `Took ${actual} ${dayWord(actual)}, ${planned} planned (${note})`;
  }
  if (p.status === "current") {
    const over = phaseOverrunDays(p);
    const note = over !== null ? `${over} over` : actual < planned ? `${diff} left` : "on plan";
    return `${actual} ${dayWord(actual)} in ${phaseLabel(p)}, ${planned} planned (${note})`;
  }
  return `${planned} planned ${dayWord(planned)}`;
}

function ClauseModTasks({ acquisitionId }: { acquisitionId: string }) {
  const { authState } = useRole();
  const q = useQuery({
    queryKey: ["clause-mod-tasks", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: async () => (await loadModTasks()).filter((t) => t.acquisition_id === acquisitionId),
  });
  const tasks = q.data ?? [];
  if (tasks.length === 0) return null;
  return (
    <section aria-label="Clause change mod tasks" className="mb-12">
      <h2 className="mb-1 text-[18px] leading-6 font-medium">Clause change mod tasks</h2>
      <p className="mb-4 text-[13px] text-muted-foreground">
        A clause on this contract changed status.{" "}
        <Link to="/clause-changes" className="text-primary">
          Open the clause change impact list
        </Link>
        .
      </p>
      <ul className="max-w-[80ch] space-y-2 border-t border-border pt-3">
        {tasks.map((t) => (
          <li key={t.task_id} className="text-[13px] leading-[18px]">
            <span className="font-medium">{t.clause_number}</span> · {t.change_kind} ({t.change_source ?? "source not recorded"})
            <span className="block text-muted-foreground">
              {t.status === "complete" ? "Complete" : "Open"} · {t.owner_name ?? "Owner not recorded"} · due{" "}
              {t.deadline_date ?? "no date"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The lower half of the file page, one tab per kind of work. The launch
// sequence above the tabs stays where it is.
const FILE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "reviews", label: "Reviews" },
  { key: "documents", label: "Documents" },
  { key: "post-award", label: "Post-award" },
  { key: "details", label: "Details" },
  { key: "audit", label: "Audit trail" },
] as const;
type FileTabKey = (typeof FILE_TABS)[number]["key"];
const FILE_TAB_LABEL: Record<FileTabKey, string> = Object.fromEntries(FILE_TABS.map((t) => [t.key, t.label])) as Record<FileTabKey, string>;

function FilePage() {
  const { acquisitionId } = Route.useParams();
  const coldPathSample = acquisitionId === "A-2027-0101" || acquisitionId === "A-2027-0102";
  const { authState, user, readOnly } = useRole();
  const lastLook = useLastLook(user.name, acquisitionId);
  const qc = useQueryClient();
  // Every audit row carries the real account name, never "Signed-in user".
  const [actorName, setActorName] = useState(user.name);
  useEffect(() => {
    let live = true;
    void signedInName(user.name).then((n) => {
      if (live) setActorName(n);
    });
    return () => {
      live = false;
    };
  }, [user.name]);
  const canWrite = useCanWrite();
  const [mode, setMode] = useState<Mode>("veteran");
  const presenter = usePresenter();
  const navigate = useNavigate();
  const [step, setStep] = useState<number | null>(null);
  const [showFullSequence, setShowFullSequence] = useState(false);
  const [fileTab, setFileTab] = useState<FileTabKey>("overview");
  // Show the tab that holds an element, synchronously, so the caller can
  // measure and scroll to it straight away.
  const showTabFor = (el: Element | null | undefined) => {
    const panel = el?.closest<HTMLElement>("[data-file-tab-panel]");
    const key = panel?.dataset["fileTabPanel"] as FileTabKey | undefined;
    if (panel && key && panel.hidden) flushSync(() => setFileTab(key));
  };
  const showTabForRef = useRef(showTabFor);
  showTabForRef.current = showTabFor;
  useEffect(() => {
    const onReveal = (e: Event) => showTabForRef.current((e as CustomEvent<{ target?: Element }>).detail?.target);
    window.addEventListener(MISSION_NAV_REVEAL, onReveal);
    return () => window.removeEventListener(MISSION_NAV_REVEAL, onReveal);
  }, []);
  const onFileTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = FILE_TABS.map((t) => t.key);
    const at = keys.indexOf(fileTab);
    const next =
      event.key === "ArrowRight" ? keys[(at + 1) % keys.length]
      : event.key === "ArrowLeft" ? keys[(at - 1 + keys.length) % keys.length]
      : event.key === "Home" ? keys[0]
      : event.key === "End" ? keys[keys.length - 1]
      : null;
    if (!next) return;
    event.preventDefault();
    setFileTab(next);
    window.requestAnimationFrame(() => document.getElementById(`file-tab-${next}`)?.focus());
  };
  // Expand all shows every phase of the launch sequence, not only the
  // "Past, now, and next" window; Collapse secondary returns to the window.
  useEffect(() => {
    const onSetAll = (e: Event) => setShowFullSequence(Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open));
    window.addEventListener(MISSION_NAV_SET_ALL, onSetAll);
    return () => window.removeEventListener(MISSION_NAV_SET_ALL, onSetAll);
  }, []);
  const [banner, setBanner] = useState<string | null>(null);
  // Edits in progress on the proposed price row, before they are saved.
  const [priceDraft, setPriceDraft] = useState<{ price: string; received: string } | null>(null);
  // Which phase the regulation sidebar is showing. Empty until the file loads,
  // then it follows the current phase unless the reader picks another.
  const [regPhase, setRegPhase] = useState<string | null>(null);
  // Which reviewer row the contracting officer is recording a vote for.
  const [voteRow, setVoteRow] = useState<string | null>(null);
  const [voteReceived, setVoteReceived] = useState<string>(todayISO());
  const [voteNote, setVoteNote] = useState("");
  const [voteChoice, setVoteChoice] = useState<ReviewDecision | null>(null);
  const [actionDialog, setActionDialog] = useState<FileActionDialog | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["acquisition-file", acquisitionId],
    enabled: authState === "signed-in",
    // The poll board updates live as reviewers vote (cadence in lib/poll.ts).
    ...pollOptions,
    queryFn: async () => {
      // Every read here is independent of the others, so they run together.
      // Only the mission read below needs the acquisition row first.
      const [
        acq, auditHead, stateLog, plan, rules, thresholds, strategies, polls, clauses, nfApprovals,
        memoRoutingRes, centersRes, overridesRes, peopleRes, successorsRes, researchRunsRes, fileDocs, fileTemplates,
      ] = await Promise.all([
        supabase.from("acquisition_facts").select("*").eq("acquisition_id", acquisitionId).maybeSingle(),
        supabase.from("audit_log").select("log_id", { count: "exact", head: true }).eq("acquisition_id", acquisitionId),
        loadStateAuditRows(acquisitionId),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("review_rules").select("*"),
        supabase.from("thresholds").select("*"),
        supabase.from("enterprise_strategies").select("*"),
        supabase.from("polls").select("*").eq("acquisition_id", acquisitionId),
        supabase
          .from("clauses")
          .select("clause_number,title,ucf_section,source,status,effective_date,disposition,fill_ins")
          .in("clause_number", PACKET_CANDIDATE_NUMBERS),
        supabase.from("nf1707_approvals").select("*").eq("acquisition_id", acquisitionId).order("form_section"),
        supabase
          .from("memo_routing")
          .select("center_code,document_key,approving_official_title"),
        supabase
          .from("centers")
          .select("center_code,aging_threshold_days"),
        supabase.from("center_overrides").select("*"),
        supabase
          .from("users")
          .select("name,role,title,center_code,warrant_limit"),
        supabase
          .from("acquisition_facts")
          .select("acquisition_id")
          .eq("successor_of", acquisitionId),
        // Whether market research has already been run on this file.
        supabase
          .from("research_runs")
          .select("run_id")
          .eq("acquisition_id", acquisitionId),
        supabase
          .from("documents")
          .select("template_id,version,saved_by,saved_at,issue_on_nf1858,memo_header,field_values")
          .eq("acquisition_id", acquisitionId),
        supabase.from("templates").select("template_id,name,nf_1098_tab"),
      ]);
      const memoRouting = memoRoutingRes.data;
      const centers = centersRes.data;
      const overrides = overridesRes.data;
      const people = peopleRes.data;
      const successors = successorsRes.data;
      const researchRuns = researchRunsRes.data;
      let mission = null as { name: string | null; milestone_date: string | null } | null;
      if (acq.data?.mission_id) {
        const m = await supabase
          .from("missions")
          .select("name,milestone_date")
          .eq("mission_id", acq.data.mission_id)
          .maybeSingle();
        mission = m.data;
      }
      // A failed read is an error, not an endless wait.
      if (acq.error) throw acq.error;
      return {
        acq: acq.data as AcqRow | null,
        centers: centers ?? [],
        overrides: overrides ?? [],
        people: people ?? [],
        researchRuns: researchRuns ?? [],
        auditCount: auditHead.count ?? 0,
        stateLog,
        plan: plan.data ?? [],
        rules: rules.data ?? [],
        thresholds: thresholds.data ?? [],
        strategies: strategies.data ?? [],
        polls: polls.data ?? [],
        clauses: (clauses.data ?? []).filter(
          (c) => !/remov/i.test(`${c.status ?? ""} ${c.disposition ?? ""}`) && c.clause_number !== "52.212-5",
        ),
        mission,
        successors: successors ?? [],
        documents: fileDocs.data ?? [],
        templates: fileTemplates.data ?? [],
        nfApprovals: nfApprovals.data ?? [],
        memoRouting: memoRouting ?? [],
      };
    },
  });

  const acq = q.data?.acq ?? null;
  const intakeEstimate = (acq?.['intake_estimate'] ?? null) as StoredEstimate | null;

  // Warrant check: the assigned contracting officer's warrant limit, read from
  // the users table, against the estimated value of this acquisition.
  const warrant = useMemo(() => {
    const value = acq?.estimated_value == null ? null : Number(acq.estimated_value);
    const coName = acq?.co_name ?? null;
    if (!coName || value === null || !Number.isFinite(value)) return null;
    const co = (q.data?.people ?? []).find((p) => p.name === coName);
    if (!co) return { coName, value, limit: null as number | null, exceeds: false, unknown: true };
    const limit = co.warrant_limit == null ? null : Number(co.warrant_limit);
    if (limit === null || !Number.isFinite(limit))
      return { coName, value, limit: null as number | null, exceeds: false, unknown: true };
    return { coName, value, limit, exceeds: value > limit, unknown: false };
  }, [acq, q.data?.people]);

  // Acquisition Forecast entry, NFS CG 1807.70: a byproduct of the record for
  // every intake above the simplified acquisition threshold.
  const thresholdRows = useMemo(
    () =>
      (q.data?.thresholds ?? []).map((t) => ({
        name: t.name,
        value: t.value,
        citation: t.citation,
        superseded_date: t.superseded_date,
      })),
    [q.data?.thresholds],
  );
  const sat = useMemo(() => satValue(thresholdRows), [thresholdRows]);
  const forecast = useMemo(
    () => (acq ? forecastEntry(acq as unknown as ForecastAcq, thresholdRows) : null),
    [acq, thresholdRows],
  );

  // The NF 1707 forecast affirmation is satisfied once the entry exists.
  const affirmed = useRef(false);
  useEffect(() => {
    if (!acq || !forecast || !canWrite) return;
    if (acq.acquisition_forecast_verified === true || affirmed.current) return;
    affirmed.current = true;
    void (async () => {
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ acquisition_forecast_verified: true })
        .eq("acquisition_id", acq.acquisition_id);
      if (error) {
        affirmed.current = false;
        return;
      }
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: "Acquisition Forecast entry generated",
        field: "acquisition_forecast_verified",
        old_value: String(acq.acquisition_forecast_verified ?? "not recorded"),
        new_value: "true",
        reason: `${FORECAST_CITATION}; entry exists, NF 1707 affirmation satisfied`,
        phase: null,
      } as never);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    })();
  }, [acq, forecast, canWrite, actorName, qc, acquisitionId]);

  function exportForecastCsv() {
    if (!forecast || !acq) return;
    const csv = forecastCsv([forecast]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `acquisition-forecast-${acq.acquisition_id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    void writeAudit({
      acquisition_id: acq.acquisition_id,
      actor: actorName,
      action: "Acquisition Forecast entry exported to CSV",
      field: "acquisition_forecast",
      old_value: null,
      new_value: forecast.value_range,
      reason: FORECAST_CITATION,
      phase: null,
    } as never);
    setBanner("The forecast entry downloaded as a CSV file in the forecast's format.");
  }


  // Prior files of the same profile, for the honest days-to-award range. Read
  // only: the public fields of every record and the recorded launch events.
  const auditListQ = useInfiniteQuery({
    queryKey: ["acquisition-file", acquisitionId, "audit-list"],
    enabled: authState === "signed-in",
    staleTime: 30_000,
    initialPageParam: null as { logged_at: string; log_id: string } | null,
    queryFn: async ({ pageParam }) => {
      let query = supabase.from("audit_log").select("*").eq("acquisition_id", acquisitionId);
      if (pageParam) {
        query = query.or(`logged_at.lt."${pageParam.logged_at}",and(logged_at.eq."${pageParam.logged_at}",log_id.lt.${pageParam.log_id})`);
      }
      const { data, error } = await query
        .order("logged_at", { ascending: false })
        .order("log_id", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (last) => {
      if (last.length < 200) return undefined;
      const row = last[last.length - 1];
      if (!row) return undefined;
      return { logged_at: String(row.logged_at), log_id: String(row.log_id) };
    },
  });
  useEffect(() => {
    if (auditListQ.error) console.error("Audit trail read failed", auditListQ.error);
  }, [auditListQ.error]);
  const auditRows = useMemo(() => auditListQ.data?.pages.flat() ?? [], [auditListQ.data]);

  const sinceChanges = useMemo(
    () => (lastLook.ready && lastLook.since ? changesSince(auditRows as LookRow[], lastLook.since) : []),
    [auditRows, lastLook.ready, lastLook.since],
  );

  const historyQ = useQuery({
    queryKey: ["award-history"],
    enabled: authState === "signed-in",
    staleTime: 300_000,
    queryFn: async () => {
      const [acqs, launched] = await Promise.all([
        supabase.from("acquisition_facts").select("*"),
        supabase.from("audit_log").select("acquisition_id,action,logged_at").eq("action", "Launched"),
      ]);
      return { acqs: acqs.data ?? [], launched: launched.data ?? [] };
    },
  });

  const confidence = useMemo(() => {
    if (!acq || !q.data?.plan) return null;
    const history = historyFrom(
      (historyQ.data?.acqs ?? []) as unknown as AcqRow[],
      historyQ.data?.launched ?? [],
    );
    return awardConfidence(acq as AcqRow, history, q.data.plan as PhasePlanRow[]);
  }, [acq, q.data?.plan, historyQ.data]);

  // The successor clock reads the same phase plan the launch sequence reads.
  const successor = useMemo(() => {
    if (!acq) return null;
    const linked = (q.data?.successors ?? []).map((s) => ({
      acquisition_id: s.acquisition_id,
      successor_of: acquisitionId,
    })) as unknown as AcqRow[];
    return successorFor(acquisitionId, [acq, ...linked], q.data?.plan ?? []);
  }, [acq, q.data?.successors, q.data?.plan, acquisitionId]);

  const ref: RefData = useMemo(
    () => ({
      overrides: (q.data?.overrides ?? []) as unknown as CenterOverrideRow[],
      thresholds: (q.data?.thresholds ?? []).map((t) => ({
        name: t.name,
        value: t.value === null ? null : Number(t.value),
        citation: t.citation,
        note: t.note,
      })),
      phasePlan: (q.data?.plan ?? []).map((p) => ({
        acquisition_type: p.acquisition_type,
        phase: p.phase,
        planned_days: p.planned_days,
      })),
      strategies: (q.data?.strategies ?? []).map((s) => ({
        psl: s.psl,
        name: s.name,
        buying_location: s.buying_location,
        mandatory_vehicles: s.mandatory_vehicles,
        required_coordination: s.required_coordination,
      })),
    }),
    [q.data],
  );


  // Files uploaded against the documents on this record.
  const attachQ = useQuery({
    queryKey: ["file-attachments", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadAttachments(acquisitionId),
  });
  const attachments = useMemo(() => attachQ.data ?? [], [attachQ.data]);

  // The schedule of line items. Empty schedules are filled once from the
  // estimate already on the file; an existing schedule is never overwritten.
  const clinQ = useQuery({
    queryKey: ["clin-schedule", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: async () => {
      try {
        return await ensureClinScheduleFromIgce(acquisitionId);
      } catch {
        return loadClinSchedule(acquisitionId);
      }
    },
  });
  const scheduleClins = useMemo(
    () => scheduleToScaffoldClins(clinQ.data ?? []),
    [clinQ.data],
  );

  // Data requirements. Optional, and empty unless the office recorded some.
  const cdrlQ = useQuery({
    queryKey: ["cdrl", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadCdrl(acquisitionId),
  });
  const cdrlItems = useMemo(() => cdrlForPacket(cdrlQ.data ?? []), [cdrlQ.data]);

  // Payment milestones. Optional, and empty unless the office recorded some.
  const paymentQ = useQuery({
    queryKey: ["payment-milestones", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadPaymentMilestones(acquisitionId),
  });
  const paymentItems = useMemo(
    () => paymentMilestonesForPacket(paymentQ.data ?? [], clinQ.data ?? []),
    [paymentQ.data, clinQ.data],
  );


  // Sections L and M as the officer saved them. The workspace, the scaffold and
  // the handoff packet all read these rows, so they cannot disagree.
  const sectionLQ = useQuery({
    queryKey: ["section-l", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadSectionL(acquisitionId),
  });
  const sectionKQ = useQuery({
    queryKey: ["section-k", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadSectionK(acquisitionId),
  });
  const sectionMQ = useQuery({
    queryKey: ["section-m", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadSectionM(acquisitionId),
  });
  const factorsQ = useQuery({
    queryKey: ["section-m-factors", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadFactors(acquisitionId),
  });
  const clarificationsQ = useQuery({
    queryKey: ["clarifications", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadClarifications(acquisitionId),
  });

  // Deviation requests linked to this file, read only, for the advisory
  // regulatory baseline & deviations panel.
  const deviationsQ = useQuery({
    queryKey: ["file-deviations", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: async () => {
      try {
        return await loadDeviationsForAcquisition(acquisitionId);
      } catch {
        return [];
      }
    },
  });

  // The most recent recorded check on this file, read only. Running a check
  // stays where it already lives; this is a stamp and a link.
  const lastCheckQ = useQuery({
    queryKey: ["file-last-check", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data } = await supabase
        .from("sam_checks")
        .select("check_type,checked_at,checked_by,vendor_uei,response_json")
        .eq("acquisition_id", acquisitionId)
        .order("checked_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });
  const lastCheck = (lastCheckQ.data ?? [])[0] ?? null;
  // A sweep flag is a question for the contracting officer, not a hold. A newer
  // clean check on the same UEI answers it, so the flag clears itself.
  const sweepFlag = useMemo(
    () => exclusionFlagFrom((lastCheckQ.data ?? []) as SweepCheckRow[]),
    [lastCheckQ.data],
  );
  const attachmentFor = (key: string): AttachmentRow | null =>
    attachments.find((row) => row.doc_key === key) ?? null;

  // Documents T-Minus writes itself: the latest saved version of each, by the
  // generator key of the launch-sequence row it satisfies.
  const savedDocs = useMemo(() => {
    const byId = new Map<string, string>();
    for (const t of q.data?.templates ?? []) {
      const def = TEMPLATES.find((d) => d.name === t.name);
      if (def) byId.set(t.template_id, def.key);
      // The generated forms file their versions the same way the templates do.
      for (const key of GENERATED_FORM_KEYS) {
        if (FORM_NAMES[key] === t.name) byId.set(t.template_id, key);
      }
    }
    const out = new Map<string, { version: number; savedAt: string | null }>();
    for (const d of (q.data?.documents ?? []) as {
      template_id: string | null;
      version: number | null;
      saved_at: string | null;
    }[]) {
      const key = d.template_id ? byId.get(d.template_id) : undefined;
      if (!key) continue;
      const version = Number(d.version ?? 1);
      const current = out.get(key);
      if (!current || version >= current.version) out.set(key, { version, savedAt: d.saved_at });
    }
    return out;
  }, [q.data?.documents, q.data?.templates]);
  const savedKeys = useMemo(() => new Set(savedDocs.keys()), [savedDocs]);

  // Display remap only: phases (rail, file index, sidebar) read the same
  // operational acquisition as the countdown, so clock_state=launched with no
  // recorded Launched audit never marks Administration current.
  const phases: PhaseView[] = useMemo(
    () =>
      acq
        ? buildSequence(
            deriveOverviewAcquisitionState(acq, q.data?.stateLog ?? []).acquisition as typeof acq,
            q.data?.plan ?? [],
            todayISO(),
            daysBetween,
            {
              attachedKeys: keysFrom(attachments),
              savedKeys,
            },
          )
        : [],
    [acq, q.data, attachments, savedKeys],
  );

  // NF 1098 contract file index: tabs present, and required tabs with no document.
  const fileIndex = useMemo(
    () =>
      buildFileIndex(
        (q.data?.documents ?? []) as never,
        q.data?.templates ?? [],
        phases.map((p) => p.phase),
        attachments,
        acq ?? undefined,
      ),
    [q.data?.documents, q.data?.templates, phases, attachments, acq],
  );

  const requiredTabSet = useMemo(
    () => new Set(requiredTabs(phases.map((p) => p.phase), acq ?? undefined).map((t) => t.tab)),
    [phases, acq],
  );
  // Offered tabs come from the same launch sequence rule, so the index and the
  // sequence always read the same (RFO FAR 1.404(b) for the COR appointment).
  const offeredTabSet = useMemo(
    () => new Set(offeredTabs(phases.map((p) => p.phase), acq ?? undefined).map((t) => t.tab)),
    [phases, acq],
  );

  const boards = useMemo(() => {
    const out: Record<string, BoardEntry[]> = {};
    if (!acq) return out;
    for (const phase of REVIEW_PHASES) {
      out[phase] = pollBoard(
        acq,
        q.data?.rules ?? [],
        q.data?.polls ?? [],
        ref,
        acq.target_award_date ?? null,
        phase,
        q.data?.people ?? [],
      );
    }
    return out;
  }, [acq, q.data, ref]);

  const board = useMemo(() => Object.values(boards).flat(), [boards]);

  const lifecycle = useMemo(() => {
    if (!acq) return null;
    const operational = deriveOverviewAcquisitionState(acq, q.data?.stateLog ?? []);
    return computeMetrics(operational.acquisition as typeof acq, {
      roster: q.data?.people ?? [],
      plan: q.data?.plan ?? [],
      rules: q.data?.rules ?? [],
      polls: q.data?.polls ?? [],
      ref,
      mission: q.data?.mission
        ? { mission_id: String(acq.mission_id ?? ""), name: q.data.mission.name ?? "Mission", program: null, center_code: acq.center_code ?? null, milestone: null, milestone_date: q.data.mission.milestone_date, priority: null, program_owner: null, leadership_note: null }
        : null,
      holdSince: holdSince(acq, q.data?.stateLog ?? []),
      awardDate: operational.actualAwardDate,
      attachedKeys: keysFrom(attachments),
      savedKeys,
    });
  }, [acq, q.data, ref, attachments, savedKeys]);

  const phaseNames = useMemo(() => phases.map((p) => p.phase), [phases]);
  const sidebarPhase =
    regPhase && phaseNames.includes(regPhase)
      ? regPhase
      : (phases.find((p) => p.status === "current")?.phase ?? phaseNames[0] ?? "Intake");

  const hold = lifecycle?.hold ?? null;
  const effectiveState = lifecycle?.clockState ?? null;
  const readinessExplanation = lifecycle
    ? explainWorkReadiness(lifecycle, { acq: lifecycle.acq, attachedKeys: keysFrom(attachments), savedKeys })
    : null;
  const readiness = readinessExplanation?.state ?? null;

  // The one action for the current blocker, shown in the hero. It does the same
  // thing as the matching row in the launch sequence.
  const heroAction = useMemo((): {
    label: string;
    doc?: RequiredDoc;
    generated?: RequiredDoc;
  } | null => {
    if (!acq || !lifecycle || effectiveState === "launched" || effectiveState === "scrubbed") return null;
    const current = lifecycle.currentPhase;
    if (!current) return null;
    const currentPhase = phases.find((phase) => phase.phase === current);
    if (!currentPhase) return null;
    // Research comes before the memorandum that reports it. Once a run exists,
    // the action follows the missing row instead.
    const hasResearch = (q.data?.researchRuns ?? []).length > 0;
    if (current === "Market Research" && !hasResearch) return { label: "Run market research" };
    for (const d of currentPhase.docs) {
        const generator = generatorKey(d);
        if (d.optional || (!d.field && !generator)) continue;
        // A row that may follow award (urgency justification, RFO FAR 6.103-2(d)) is not the next step.
        if (d.dueAfterAward) continue;
        const key = d.docKey ?? docKey(d.field, d.label);
        const state = docSatisfied(
          d,
          acq,
          Boolean(attachments.find((row) => row.doc_key === key)),
          savedKeys,
        );
        if (state !== false) continue;
        // A document T-Minus writes is opened, never asked for as an upload.
        if (generator) {
          const label = generator === "market-research-memo"
            ? "Write the memorandum"
            : generator === "nf-1787"
              ? "Write the NF 1787"
              : generator === "nf-1787a"
                ? "Write the NF 1787A"
                : generator === "pnm"
                  ? "Write the PNM"
                  : `Write the ${d.label}`;
          return { label, generated: d };
        }
        const label = d.field === "igce_attached"
          ? "Attach the IGCE"
          : d.field === "sow_attached"
            ? "Attach the SOW/PWS"
            : `Attach the ${d.label}`;
        return { label, doc: d };
    }
    // Reviews of a justification that may follow award (RFO FAR 6.103-2(d)) are not the next step.
    if (!currentPhase.followsAward?.length && (boards[current] ?? []).some((b) => b.vote === "pending")) return { label: "Send the review requests" };
    return { label: `Exit ${current}` };
  }, [acq, lifecycle, effectiveState, phases, attachments, boards, savedKeys, q.data?.researchRuns]);

  const currentPhase = useMemo(
    () => phases.find((phase) => phase.phase === lifecycle?.currentPhase) ?? null,
    [phases, lifecycle?.currentPhase],
  );

  const missingCurrentRequirements = useMemo(() => {
    if (!acq || !currentPhase) return [];
    return currentPhase.docs.filter((doc) => {
      if (doc.optional) return false;
      // Before award, a row that may follow award (RFO FAR 6.103-2(d)) does not block exit.
      if (doc.dueAfterAward && effectiveState !== "launched") return false;
      const key = doc.docKey ?? docKey(doc.field, doc.label);
      return docSatisfied(doc, acq, Boolean(attachmentFor(key)), savedKeys) === false;
    });
  }, [acq, currentPhase, attachments, savedKeys, effectiveState]);

  // Display only (ep05 C4): a phase marked complete while one of its Required
  // rows still reads unmet on the record. The row test is the same one the
  // launch sequence draws; the exit gate and the phase status are unchanged.
  const openRequiredByPhase = useMemo(() => {
    const out = new Map<string, RequiredDoc[]>();
    if (!acq) return out;
    for (const p of phases) {
      if (p.status !== "complete") continue;
      const open = p.docs.filter((d) => {
        if (d.optional) return false;
        if (d.dueAfterAward && effectiveState !== "launched") return false;
        const key = d.docKey ?? docKey(d.field, d.label);
        const generator = generatorKey(d);
        return docSatisfied(d, acq, d.field || generator || d.attachOnly ? Boolean(attachmentFor(key)) : undefined, savedKeys) === false;
      });
      if (open.length) out.set(p.phase, open);
    }
    return out;
  }, [acq, phases, attachments, savedKeys, effectiveState]);

  const holdDoc = hold?.doc;
  const holdRequirementHref =
    holdDoc && phases.some((p) => p.phase === holdDoc.phase && p.docs.some((d) => d.label === holdDoc.label))
      ? `#${requirementId(holdDoc.phase, holdDoc.label)}`
      : "#launch-sequence";

  // Open the launch sequence and bring a hash target into view. Requirement
  // rows render only in the full sequence, so expand it and wait for the row.
  // Make a target focusable only while it is revealed, so plain text never
  // grabs the focus ring from an ordinary click.
  const focusTarget = (el: HTMLElement) => {
    el.setAttribute("tabindex", "-1");
    el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
    el.focus({ preventScroll: true });
  };
  const clampBelowHeader = (el: HTMLElement) => {
    // Below the app header and the file identity strip.
    const minTop = stickyOffset() + 4;
    const top = el.getBoundingClientRect().top;
    if (top < minTop) window.scrollBy(0, top - minTop);
  };
  // Layout-stability hold: keep a revealed target in place while sections
  // above it load. Stops at the first user action, after ~1500 ms without a
  // layout change (re-armed while any query is still on its first load), or
  // at a 15 s cap.
  const pinStopRef = useRef<(() => void) | null>(null);
  const holdInterruptedRef = useRef(false);
  const stopPin = () => {
    pinStopRef.current?.();
    pinStopRef.current = null;
  };
  const place = (el: HTMLElement, block: ScrollLogicalPosition) => {
    el.scrollIntoView({ block });
    clampBelowHeader(el);
  };
  const pinTarget = (el: HTMLElement, block: ScrollLogicalPosition) => {
    stopPin();
    holdInterruptedRef.current = false;
    let placedTop = el.getBoundingClientRect().top;
    let raf = 0;
    let quiet = 0;
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    const firstLoadPending = () => qc.isFetching({ predicate: (query) => query.state.data === undefined }) > 0;
    const armQuiet = () => {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(() => {
        if (firstLoadPending()) armQuiet();
        else stop();
      }, 1500);
    };
    const replace = () => {
      if (!el.isConnected) return;
      place(el, block);
      placedTop = el.getBoundingClientRect().top;
      armQuiet();
    };
    const container = document.getElementById("main-content");
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => replace()) : null;
    const onUser = () => {
      holdInterruptedRef.current = true;
      stop();
    };
    const stop = () => {
      observer?.disconnect();
      window.cancelAnimationFrame(raf);
      window.clearTimeout(quiet);
      window.clearTimeout(cap);
      for (const ev of events) window.removeEventListener(ev, onUser, { capture: true });
      if (pinStopRef.current === stop) pinStopRef.current = null;
    };
    const tick = () => {
      if (el.isConnected && Math.abs(el.getBoundingClientRect().top - placedTop) > 2) replace();
      raf = window.requestAnimationFrame(tick);
    };
    const cap = window.setTimeout(stop, 15000);
    for (const ev of events) window.addEventListener(ev, onUser, { capture: true, passive: true });
    pinStopRef.current = stop;
    if (container && observer) observer.observe(container);
    armQuiet();
    raf = window.requestAnimationFrame(tick);
  };
  useEffect(() => () => stopPin(), []);
  const revealHash = (rawHash: string, opts: { updateHash?: boolean } = {}) => {
    const hash = (() => {
      const h = rawHash.replace(/^#/, "");
      try {
        return decodeURIComponent(h);
      } catch {
        return h;
      }
    })();
    const sequence = document.getElementById("launch-sequence") as HTMLDetailsElement | null;
    const finish = (el: HTMLElement, block: ScrollLogicalPosition) => {
      place(el, block);
      focusTarget(el);
      if (opts.updateHash) window.history.replaceState(window.history.state, "", "#" + el.id);
      pinTarget(el, block);
      // The "On this file" highlight follows the section shown.
      window.dispatchEvent(new CustomEvent(MISSION_NAV_CURRENT, { detail: { id: el.id } }));
    };
    const showSequence = () => {
      if (!sequence) return;
      sequence.open = true;
      finish(sequence, "start");
    };
    if (hash === "launch-sequence") {
      showSequence();
      return;
    }
    if (!hash.startsWith("requirement-")) {
      // Any other section or row on the page: open its tab and its details.
      const el = hash ? document.getElementById(hash) : null;
      if (!el) return;
      showTabFor(el);
      let node: HTMLElement | null = el;
      while (node) {
        if (node instanceof HTMLDetailsElement) node.open = true;
        node = node.parentElement;
      }
      const inner = el.querySelector<HTMLDetailsElement>(":scope > details, :scope > .mc-nav-section-content > details");
      if (inner) inner.open = true;
      finish(el, "start");
      return;
    }
    if (sequence) sequence.open = true;
    setShowFullSequence(true);
    let frames = 0;
    const tryRow = () => {
      const el = document.getElementById(hash);
      if (el) {
        finish(el, "center");
        return;
      }
      frames += 1;
      if (frames < 10) window.requestAnimationFrame(tryRow);
      else showSequence();
    };
    window.requestAnimationFrame(tryRow);
  };
  const revealHashRef = useRef(revealHash);
  revealHashRef.current = revealHash;
  const loadHash = () => {
    const h = window.location.hash.replace(/^#/, "");
    return h || null;
  };
  const handledLoadHash = useRef(false);
  const phasesReady = Boolean(acq) && phases.length > 0;
  useEffect(() => {
    if (!phasesReady || handledLoadHash.current) return;
    handledLoadHash.current = true;
    const h = loadHash();
    // A microtask, so opening a tab can flush outside the effect.
    if (h) queueMicrotask(() => revealHashRef.current(h));
  }, [phasesReady]);
  // Re-centre once the page's section queries have settled.
  const sectionsLoading = [q, attachQ, historyQ, deviationsQ, clinQ, cdrlQ, paymentQ, sectionLQ, sectionKQ, sectionMQ, factorsQ, clarificationsQ, lastCheckQ].some((x) => x.isLoading);
  const handledSettledHash = useRef(false);
  useEffect(() => {
    if (!phasesReady || sectionsLoading || handledSettledHash.current) return;
    handledSettledHash.current = true;
    // The user interrupted the hold, or a hold is still re-placing the target.
    if (holdInterruptedRef.current || pinStopRef.current) return;
    const h = loadHash();
    if (h) queueMicrotask(() => revealHashRef.current(h));
  }, [phasesReady, sectionsLoading]);
  useEffect(() => {
    const onHash = () => {
      const h = loadHash();
      if (h) revealHashRef.current(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // The Required rows this phase has already satisfied. Named on the audit row
  // so the record says what was complete when the phase was exited.
  const completeCurrentRequirements = useMemo(() => {
    if (!acq || !currentPhase) return [];
    return currentPhase.docs.filter((doc) => {
      if (doc.optional) return false;
      const key = doc.docKey ?? docKey(doc.field, doc.label);
      return docSatisfied(doc, acq, Boolean(attachmentFor(key)), savedKeys) !== false;
    });
  }, [acq, currentPhase, attachments, savedKeys]);



  const pendingCurrentReviews = useMemo(
    () =>
      currentPhase && !currentPhase.followsAward?.length
        ? (boards[currentPhase.phase] ?? []).filter((entry) => entry.poll_id && entry.vote !== "favorable")
        : [],
    [boards, currentPhase],
  );

  const showActionDialog = (dialog: FileActionDialog) => {
    setActionDialog(dialog);
    setActionReason("");
    setActionError(null);
    if (dialog.kind === "vote") {
      setVoteRow(dialog.entry.poll_id);
      setVoteReceived(todayISO());
      setVoteNote("");
      setVoteChoice(null);
    }
  };

  const openLaunchSequence = () => {
    const el = document.getElementById("launch-sequence") as HTMLDetailsElement | null;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // "Explain this" for the status and the hold, built from the same rules.
  const statusExplanation = useMemo(() => {
    const behind = phases.find(
      (p) => p.status === "current" && p.actual_days !== null && p.actual_days > p.planned_days,
    );
    const soon = board.find(
      (b) => b.vote === "pending" && b.due_date && daysBetween(todayISO(), b.due_date) <= 3,
    );
    const word =
      effectiveState === "launched"
        ? "Launched"
        : effectiveState === "hold"
          ? "At Risk"
          : behind || soon
            ? "Needs Attention"
            : "On Track";
    return explainStatus({
      status: word,
      clockState: effectiveState,
      holdReason: hold?.reason ?? null,
      scheduleImpactDays: null,
      behindPhase: behind?.phase ?? null,
      pollDueSoon: soon?.reviewer_role ?? null,
    });
  }, [phases, board, effectiveState, hold]);


  // Open the poll for a review phase: one row per applicable review rule, with
  // the due date taken from the rule's planned days.
  const openPoll = useMutation({
    mutationFn: async (phase: string) => {
      if (!acq) return;
      const rules = reviewRulesForPhase(phase, acq, q.data?.rules ?? [], ref);
      const existing = new Set(
        (q.data?.polls ?? [])
          .filter((p) => phaseAlias(p.phase ?? "") === phase)
          .map((p) => (p.reviewer_role ?? "").toLowerCase()),
      );
      const rows = rules
        .filter((r) => !existing.has(r.reviewer_role.toLowerCase()))
        .map((r) => ({
          acquisition_id: acq.acquisition_id,
          phase,
          reviewer_role: r.reviewer_role,
          reviewer_name: reviewerNameForRole(r.reviewer_role, acq.center_code ?? null, q.data?.people ?? []),
          vote: "pending",
          due_date: addDays(todayISO(), r.planned_days ?? 5),
        }));
      if (!rows.length) return;
      const { error } = await supabase.from("polls").insert(rows);
      if (error) throw error;
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: "Review requests sent",
        field: "polls",
        new_value: `${rows.length} reviewer${rows.length === 1 ? "" : "s"}`,
        reason: `${phase} requires review`,
        phase,
      });
    },
    onSuccess: () => {
      setActionDialog(null);
      setBanner("The review requests are open. Each reviewer records a decision on the documents for that phase.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`The review requests did not open: ${e.message}. Try again.`),
  });

  // A reviewer who answered by email: the contracting officer records the
  // decision on their behalf, and the audit entry says so. A nonconcurrence
  // resolved on elevation is recorded the same way, naming the deciding official.
  const recordVote = useMutation({
    mutationFn: async (input: {
      entry: BoardEntry;
      choice: ReviewDecision | null;
      received: string;
      note: string;
    }) => {
      if (await isDemoSession()) throw new Error(DEMO_READ_ONLY_NOTE);
      if (!acq) return;
      if (!input.entry.poll_id) throw new Error("Send the review requests for this phase first");
      if (!input.choice) throw new Error("Choose a decision");
      if (rationaleMissing(input.choice, input.note)) throw new Error(`${DECISION_LABEL[input.choice]} needs a written rationale`);
      const choice = input.choice;
      const who = await signedInName(actorName);
      const note = input.note.trim() || null;
      const { data, error } = await supabase
        .from("polls")
        .update({
          vote: choice,
          reason: note,
          voted_at: new Date(`${input.received}T12:00:00Z`).toISOString(),
        })
        .eq("poll_id", input.entry.poll_id)
        .select("poll_id");
      if (error) throw new Error(error.message);
      if ((data ?? []).length === 0) throw new Error("no review was updated");
      const entryAudit = decisionAudit({
        decision: choice,
        reviewerName: choice === "nonconcur_resolved" ? who : input.entry.reviewer_name,
        reviewerRole: input.entry.reviewer_role,
        date: input.received,
        rationale: note,
        previousRaw: input.entry.decision,
        previousReason: input.entry.reason,
        recordedBy: choice === "nonconcur_resolved" ? null : who,
      });
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: who,
        action: entryAudit.action,
        field: input.entry.reviewer_role,
        old_value: entryAudit.old_value,
        new_value: entryAudit.new_value,
        reason: entryAudit.reason,
        phase: input.entry.phase,
      });
    },
    onSuccess: () => {
      setVoteRow(null);
      setVoteNote("");
      setActionDialog(null);
      setBanner("The decision is recorded with the date it was received.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(failureText("The decision did not save", e)),
  });

  // Age of the current hold, against the Center's own aging window.
  const holdAge = ageInDays((acq?.['hold_started_at'] as string | null) ?? null);
  const holdThreshold = thresholdFor(
    acq?.center_code ? String(acq.center_code) : null,
    (q.data?.centers ?? []) as { center_code: string; aging_threshold_days?: number | null }[],
  );

  // When the CO has not entered a target award date, the forecast's anticipated
  // award date stands in — and it is labelled a forecast, never a target.
  const hasTargetAward = Boolean(acq?.target_award_date);
  const effectiveTargetAward =
    (acq?.target_award_date as string | null) ??
    (forecast && /^\d{4}-\d{2}-\d{2}$/.test(forecast.anticipated_award_date)
      ? forecast.anticipated_award_date
      : null);
  const days =
    lifecycle?.daysToAward ??
    (effectiveTargetAward
      ? daysBetween(todayISO(), effectiveTargetAward)
      : null);
  const fileCountdownView: CountdownView = lifecycle
    ? overviewCountdownView(lifecycle)
    : effectiveState === "launched"
      ? { mode: "launched", days: 0, prefix: "T+", badge: null, caption: "days since award", holdReason: null, tone: "cyan", pastTarget: false }
      : effectiveState === "scrubbed"
        ? { mode: "stopped", days: null, prefix: null, badge: null, caption: "Clock stopped", holdReason: null, tone: "muted", pastTarget: false }
        : days === null
          ? { mode: "not-started", days: null, prefix: null, badge: null, caption: "No target award date recorded", holdReason: null, tone: "muted", pastTarget: false }
          : {
              mode: hasTargetAward ? (days < 0 ? "overdue" : "running") : "forecast",
              days: Math.abs(days),
              prefix: days < 0 ? null : "T−",
              badge: hasTargetAward ? (days < 0 ? "OVERDUE" : null) : "FORECAST",
              caption: days < 0
                ? hasTargetAward ? `target ${formatDate(effectiveTargetAward)}` : "days past the forecast award date"
                : hasTargetAward ? "days to the target award date" : "days to forecast award. No target date on file.",
              holdReason: null,
              tone: hasTargetAward && days < 0 ? "red" : "cyan",
              pastTarget: days < 0,
            };
  // Which certified cost or pricing data figure this file reads (award date
  // decides), and the informational note for $2.5M to $10M under the statute.
  const certifiedBasis = certifiedDataBasis(acq as Record<string, unknown> | null, q.data?.thresholds ?? []);
  const statusLine = readinessExplanation ? fileStatusLine(readinessExplanation, fileCountdownView, currentPhase) : null;

  const currentIndex = Math.max(
    0,
    phases.findIndex((p) => p.status === "current"),
  );
  const focusIndex = mode === "novice" ? (step ?? currentIndex) : currentIndex;
  // The NCMS clause packet renders once, under the phase in work. A file past
  // Administration keeps it under the last packet phase it reached; a file not
  // yet at Solicitation/Quote shows none.
  const packetPhase = (() => {
    const cur = lifecycle?.currentPhase ?? null;
    if (cur && PACKET_PHASES.includes(cur)) return cur;
    const curIdx = cur ? phases.findIndex((x) => x.phase === cur) : -1;
    const reached = phases.filter((x, i) =>
      PACKET_PHASES.includes(x.phase) && (curIdx >= 0 ? i <= curIdx : x.status !== "upcoming"),
    );
    return reached.length ? reached[reached.length - 1]!.phase : null;
  })();
  const goToPacket = () => {
    const show = () => {
      const packet = document.getElementById("clause-packet");
      if (packet instanceof HTMLDetailsElement) packet.open = true;
      if (packet) place(packet, "start");
    };
    if (document.getElementById("clause-packet")) return show();
    const idx = phases.findIndex((x) => x.phase === packetPhase);
    if (idx >= 0) setStep(idx);
    window.setTimeout(show, 50);
  };

  const shownPhases = showFullSequence
    ? phases
    : phases.slice(Math.max(0, focusIndex - 1), Math.min(phases.length, focusIndex + 2));

  const setDoc = useMutation({
    mutationFn: async ({ doc, attach, reason }: { doc: RequiredDoc; attach: boolean; reason?: string }) => {
      if (!acq || !doc.field) return;
      const who = await signedInName(actorName);
      const value = doc.field === "jofoc_authority_citation" ? (attach ? jofocAuthorityFor(acq) : "") : attach;
      const next: Record<string, unknown> = { [doc.field]: value, updated_at: new Date().toISOString() };

      // recompute the clock with the new value applied
      const after = { ...acq, [doc.field]: value } as AcqRow;
      // The stored files decide, so a hold reason never outlives its cause.
      const keys = keysFrom(attachments);
      const rowKey = doc.docKey ?? docKey(doc.field, doc.label);
      if (attach) keys.add(rowKey);
      else keys.delete(rowKey);
      const cause = resolveHold(
        after,
        buildSequence(after, q.data?.plan ?? [], todayISO(), daysBetween, { attachedKeys: keys, savedKeys }),
        board,
        keys,
      );
      if (acq.clock_state !== "launched") {
        next["clock_state"] = cause ? "hold" : "running";
        next["hold_reason"] = cause?.reason ?? null;
        next["hold_owner"] = cause?.owner ?? null;
        // the hold's age runs from the moment it went on
        next["hold_started_at"] = cause
          ? ((acq['hold_started_at'] as string | null) ?? new Date().toISOString())
          : null;
      }

      const { error } = await supabase
        .from("acquisition_facts")
        .update(next as never)
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;

      await writeAudit([
        {
          acquisition_id: acq.acquisition_id,
          actor: who,
          action: attach ? "Document attached" : "Document removed",
          field: doc.field,
          old_value: String(acq[doc.field] ?? ""),
          new_value: String(value),
          reason: reason?.trim() || doc.label,
        },
        {
          acquisition_id: acq.acquisition_id,
          actor: who,
          action: cause ? "Clock on hold" : "Clock resumed",
          field: "clock_state",
          old_value: String(acq.clock_state ?? ""),
          new_value: cause ? "hold" : "running",
          reason: cause?.reason ?? "Cause cleared",
        },
      ]);
      return cause;
    },
    onSuccess: (cause) => {
      setBanner(cause ? `On hold: ${cause.reason}` : "Cause cleared. The clock is running again.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`That change did not save: ${e.message}. Try again.`),
  });

  // The price the single source proposed, recorded on the file and read by the
  // technical evaluation report and the price negotiation memorandum.
  const setProposedPrice = useMutation({
    mutationFn: async ({ price, received }: { price: string; received: string }) => {
      if (!acq) return;
      const who = await signedInName(actorName);
      const amount = price.trim() === "" ? null : Number(price);
      const { error } = await supabase
        .from("acquisition_facts")
        .update({
          proposed_price: amount,
          proposed_price_received: received.trim() === "" ? null : received,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await writeAudit([
        {
          acquisition_id: acq.acquisition_id,
          actor: who,
          action: "Proposed price recorded",
          field: "proposed_price",
          old_value: String(acq['proposed_price'] ?? ""),
          new_value: amount === null ? "" : String(amount),
          reason: received ? `Proposal received ${received}` : "Proposed price from the intended source",
        },
      ]);
    },
    onSuccess: () => {
      setBanner("The proposed price is on the record.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`That change did not save: ${e.message}. Try again.`),
  });

  // Funds certified for the period of performance: a certification the CO
  // records on the file under 31 U.S.C. 1502, not a stored document.
  const setFundsCertified = useMutation({
    mutationFn: async (certified: boolean) => {
      if (!acq) return;
      const who = await signedInName(actorName);
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ funds_certified: certified, updated_at: new Date().toISOString() } as never)
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await writeAudit([
        {
          acquisition_id: acq.acquisition_id,
          actor: who,
          action: certified ? "Funds certified for the period" : "Funds certification withdrawn",
          field: "funds_certified",
          old_value: String(acq['funds_certified'] ?? ""),
          new_value: String(certified),
          reason: "Certification recorded on the file for the period of performance",
        },
      ]);
    },
    onSuccess: () => {
      setBanner("The funds certification is on the record.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`That change did not save: ${e.message}. Try again.`),
  });

  // Attaching a required document: store the file, index it, audit it, and only
  // then mark the row Attached. Cancelling the picker changes nothing.
  const attachDoc = useMutation({
    mutationFn: async ({ doc, file }: { doc: RequiredDoc; file: File }) => {
      const key = doc.docKey ?? docKey(doc.field, doc.label);
      let total: number | null = null;
      let clinCount = 0;
      let readFailed = false;
      if (key === "igce_attached") {
        try {
          const read = await igceFromFile(file);
          if (read) {
            total = read.total;
            if (read.clins.length) {
              await saveIgceClins(acquisitionId, read.clins);
              clinCount = read.clins.length;
            }
          } else readFailed = true;
        } catch {
          readFailed = true;
        }
      }
      await uploadAttachment({ acquisitionId, key, label: doc.label, file, actor: actorName, parsedTotal: total, tab: doc.tab });
      const satisfies = key !== "igce_attached" || total !== null;
      if (doc.field && satisfies) await setDoc.mutateAsync({ doc, attach: true });
      return { fileName: file.name, label: doc.label, total, clinCount, satisfies, readFailed };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["file-attachments", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
      if (!result) return;
      const clins = result.clinCount ? ` ${result.clinCount} CLIN rows were read into the estimate builder.` : "";
      if (result.satisfies) {
        setBanner(
          `${result.label} attached: ${result.fileName}.${clins}${result.total !== null ? ` Total read: ${result.total.toLocaleString()}.` : ""}`,
        );
      } else {
        setBanner(
          `${result.fileName} was stored, but no total was found${result.readFailed ? " and the file is not a readable spreadsheet" : ""}. The IGCE red flag stays until a total is found.`,
        );
      }
    },
    onError: (e: Error) => setBanner(failureText("That file did not attach", e)),
  });

  const detachDoc = useMutation({
    mutationFn: async ({ doc, reason }: { doc: RequiredDoc; reason: string }) => {
      const key = doc.docKey ?? docKey(doc.field, doc.label);
      const row = attachmentFor(key);
      if (row) await removeAttachment(row, actorName, reason);
      if (doc.field) await setDoc.mutateAsync({ doc, attach: false, reason });
      return doc.label;
    },
    onSuccess: (label) => {
      setActionDialog(null);
      void qc.invalidateQueries({ queryKey: ["file-attachments", acquisitionId] });
      setBanner(`${label} removed. The row reads Missing again.`);
    },
    onError: (e: Error) => setBanner(`That file did not come off: ${e.message}. Try again.`),
  });

  async function openAttachment(row: AttachmentRow) {
    const url = await downloadAttachment(row);
    if (url) window.open(url, "_blank", "noopener");
    else setBanner("That file could not be opened. Try attaching it again.");
  }

  /** The contract file index opens an upload by its stored row. */
  async function openIndexAttachment(attachmentId: string) {
    const row = attachments.find((a) => a.attachment_id === attachmentId);
    if (!row) {
      setBanner("That file could not be opened. Try attaching it again.");
      return;
    }
    await openAttachment(row);
  }

  const finding = (acq?.["responsibility_finding"] as string | null) ?? null;

  // The responsibility finding decides whether a memorandum exists at all.
  const setFinding = useMutation({
    mutationFn: async (value: string) => {
      if (!acq) return;
      const next = value === "" ? null : value;
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ responsibility_finding: next, updated_at: new Date().toISOString() } as never)
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: "Responsibility finding recorded",
        field: "responsibility_finding",
        old_value: finding,
        new_value: next,
        reason:
          next === "responsible"
            ? "Affirmative determination made by the contracting officer's signature on the SF 1449 (RFO FAR 9.105-2(a)(1))"
            : next === "nonresponsibility"
              ? "Nonresponsibility memorandum required (RFO FAR 9.105-2(a)(1))"
              : "Finding cleared",
        phase: "Responsibility Check",
      });
      return next;
    },
    onSuccess: (next) => {
      setBanner(
        next === "responsible"
          ? "Finding recorded. The SF 1449 signature is the affirmative determination; no memorandum is written."
          : next === "nonresponsibility"
            ? "Finding recorded. The nonresponsibility memorandum is now available on this phase."
            : "The finding is cleared.",
      );
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`The finding did not save: ${e.message}. Try again.`),
  });

  const scrub = useMutation({
    mutationFn: async (reason: string) => {
      if (!acq) return;
      const who = await signedInName(actorName);
      const { error } = await supabase
        .from("acquisition_facts")
        .update({
          clock_state: "scrubbed",
          hold_reason: reason,
          hold_owner: who,
          status: "scrubbed",
          hold_started_at: new Date().toISOString(),
        })
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: who,
        action: "Scrubbed",
        field: "clock_state",
        old_value: String(acq.clock_state ?? ""),
        new_value: "hold",
        reason,
      });
    },
    onSuccess: () => {
      setActionDialog(null);
      setBanner("The acquisition is scrubbed and the reason is in the record.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setActionError(`The acquisition was not scrubbed: ${e.message}. Try again.`),
  });

  const exitPhase = useMutation({
    mutationFn: async ({ phase, reason }: { phase: string; reason: string }) => {
      if (!acq) return;
      if (!reason.trim()) throw new Error("Enter the reason for exiting this phase");
      if (missingCurrentRequirements.length || pendingCurrentReviews.length) {
        throw new Error("Complete every Required row and required review listed below before exiting");
      }
      const index = phases.findIndex((item) => item.phase === phase);
      const next = index >= 0 ? phases[index + 1] : null;
      if (!next) throw new Error("There is no next phase in this acquisition's plan");
      const who = await signedInName(actorName);
      const { data, error } = await supabase
        .from("acquisition_facts")
        .update({
          current_phase: next.phase,
          clock_state: "running",
          hold_reason: null,
          hold_owner: null,
          hold_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("acquisition_id", acq.acquisition_id)
        .in("current_phase", storedPhaseNames(phase))
        .select("acquisition_id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("The phase changed before this action finished. Refresh and try again");
      const completed = completeCurrentRequirements.map((doc) => doc.label);
      const completeNote = completed.length
        ? ` Required for ${phase}, complete: ${completed.join("; ")}.`
        : "";
      const { error: auditError } = await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: who,
        action: `Phase exited: ${phase} → ${next.phase}`,
        field: "current_phase",
        old_value: phase,
        new_value: next.phase,
        reason: `${reason.trim()}${completeNote}`,
        phase,
      });
      if (auditError) throw new Error(auditError.message);
      return next.phase;
    },
    onSuccess: (next) => {
      setActionDialog(null);
      setBanner(`The ${next} phase has started and its clock is running.`);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setActionError(`${e.message}.`),
  });

  const launch = useMutation({
    mutationFn: async () => {
      if (!acq) return;
      const who = await signedInName(actorName);
      const currentIndex = phases.findIndex((phase) => phase.phase === phaseAlias(acq.current_phase));
      const fpdsIndex = phases.findIndex((phase) => phase.phase === "FPDS-NG Report");
      const administrationIndex = phases.findIndex((phase) => phase.phase === "Administration");
      // The phase after the FPDS report on this plan: Administration, or the
      // definitization window on a letter contract, or Closeout on a
      // ratification.
      const launchPhase = (fpdsIndex >= 0 ? phases[fpdsIndex + 1]?.phase : undefined) ?? "Administration";
      const preAwardComplete = currentIndex >= 0 && (
        (fpdsIndex >= 0 && currentIndex >= fpdsIndex) ||
        (fpdsIndex < 0 && administrationIndex >= 0 && currentIndex >= administrationIndex)
      );
      if ((q.data?.nfApprovals ?? []).some((a) => a.status === "non_concurred")) {
        throw new Error("An NF 1707 non-concurrence is open. Clear it before launch");
      }
      if (!preAwardComplete || lifecycle?.hold || lifecycle?.board.some((entry) => entry.vote !== "favorable")) {
        throw new Error("Complete the current pre-award phase and its required reviews before launch");
      }
      const { data: fresh, error: freshError } = await supabase
        .from("acquisition_facts")
        .select("clock_state,hold_reason,hold_owner,hold_started_at,status,current_phase")
        .eq("acquisition_id", acq.acquisition_id)
        .maybeSingle();
      if (freshError || !fresh) {
        throw new Error("Launch not recorded: the file could not be read. Refresh and try again");
      }
      const before = {
        clock_state: fresh.clock_state ?? null,
        hold_reason: fresh.hold_reason ?? null,
        hold_owner: fresh.hold_owner ?? null,
        hold_started_at: fresh.hold_started_at ?? null,
        status: fresh.status ?? null,
        current_phase: fresh.current_phase ?? null,
      };
      const { data: launchedRows, error } = await supabase
        .from("acquisition_facts")
        .update({
          clock_state: "launched",
          hold_reason: null,
          hold_owner: null,
          hold_started_at: null,
          status: "awarded",
          current_phase: launchPhase,
        })
        .eq("acquisition_id", acq.acquisition_id)
        .select("acquisition_id");
      if (error) throw error;
      if (!launchedRows || launchedRows.length === 0) {
        throw new Error("Launch not recorded: the file was not updated. Refresh and try again");
      }
      const { error: auditError } = await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: who,
        action: "Launched",
        field: "clock_state",
        old_value: String(acq.clock_state ?? ""),
        new_value: "launched",
        reason: "Award made",
      });
      if (auditError) {
        const { data: revertedRows, error: revertError } = await supabase
          .from("acquisition_facts")
          .update(before)
          .eq("acquisition_id", acq.acquisition_id)
          .eq("clock_state", "launched")
          .eq("current_phase", launchPhase)
          .select("acquisition_id");
        if (!revertError && revertedRows && revertedRows.length > 0) {
          throw new Error(`Launch not recorded: the audit entry could not be saved (${auditError.message}). The file was put back to its previous state. Try again`);
        }
        throw new Error(`Launch not recorded: the audit entry could not be saved (${auditError.message}) and the file could not be put back (${revertError?.message ?? "no matching row"}). Refresh before doing anything else`);
      }
    },
    onSuccess: () => {
      setBanner("Launched.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["reporting-operational"] });
      void qc.invalidateQueries({ queryKey: ["desk-data"] });
      void qc.invalidateQueries({ queryKey: ["leadership-digest"] });
      void qc.invalidateQueries({ queryKey: ["award-history"] });
    },
    onError: (e: Error) => {
      setBanner(`${e.message}.`);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["reporting-operational"] });
      void qc.invalidateQueries({ queryKey: ["desk-data"] });
      void qc.invalidateQueries({ queryKey: ["leadership-digest"] });
      void qc.invalidateQueries({ queryKey: ["award-history"] });
    },
  });

  const nearExport = useMutation({
    mutationFn: async () => exportNearBundle(acquisitionId, actorName),
    onSuccess: (r) => {
      setBanner(`Export ready: ${r.fileName}.`);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: unknown) =>
      setBanner(
        `The export could not be built: ${e instanceof Error ? e.message : "unknown reason"}. Try again in a moment.`,
      ),
  });

  // A short board pack built from this record. Synthetic, printable, local.
  const briefingExport = useMutation({
    mutationFn: async () => {
      if (!acq) throw new Error("The record is still loading");
      const who = await signedInName(actorName);
      return exportBriefingBook(
        {
          acquisitionId: acq.acquisition_id,
          title: String(acq.title ?? acq.acquisition_id),
          missionName: q.data?.mission?.name ?? null,
          centerName: (acq["center_name"] as string | null) ?? acq.center_code ?? null,
          isSample: Boolean(acq["is_seed"]),
          currentPhase: lifecycle?.currentPhase ?? "Not started",
          clockState:
            effectiveState === "running"
              ? "Clock running"
              : effectiveState === "hold"
                ? "On hold"
                : effectiveState === "launched"
                  ? "Launched"
                  : (effectiveState ?? "Not recorded"),
          days,
          countdown: fileCountdownView,
          targetAwardDate: effectiveTargetAward,
          nextAction: lifecycle?.nextAction ?? "Not recorded",
          blocker: lifecycle?.blocker ?? null,
          blockerOwner: lifecycle?.blockerOwner ?? null,
          facts: briefingFacts(acq as unknown as Record<string, unknown>),
          recommendedClauseCount: packetClauses.length,
          appliedClauseCount: appliedClauseNumbers?.length ?? null,
          exampleClauses: packetSelection.slice(0, 3).map((c) => ({
            clause_number: c.clause_number,
            title: c.title ?? null,
            reason: c.reason ?? null,
            ucf_section: c.ucf_section ?? null,
          })),
          format: formatScaffold
            ? {
                formatLabel: formatScaffold.formatLabel,
                mode: formatScaffold.mode,
                clins: formatScaffold.clins.map((c) => ({
                  clin: c.clin,
                  description: c.description,
                  amount: c.amount,
                  note: c.note,
                })),
                instructions: formatScaffold.instructions,
                evaluation: formatScaffold.evaluation,
              }
            : null,
          // Same Section K object the Award handoff view prints — no second source.
          sectionK: formatScaffold?.sectionK ?? null,
          // Same NF 1098 assembly input the evidence pack and panel use.
          assemblyCounts: buildNf1098Assembly({
            fileIndex,
            scaffold: formatScaffold,
            recommendedClauseCount: packetClauses.length,
            appliedClauseCount: appliedClauseNumbers?.length ?? null,
          }).counts,
          clins: scheduleClins.map((c) => ({
            clin: c.clin,
            description: c.description,
            amount: c.amount,
            note: c.note,
          })),
          methodShellLabel: shell
            ? `${shell.path === "sf1449" ? "SF 1449" : "UCF"} / ${shell.partFamily === "12_13" ? "Part 12-13" : "Part 15"}`
            : null,
          competitive: shell ? shell.competitive : null,
          sectionJCount: sectionJ.length,
          boardReadiness: boardReadiness({
            shell,
            l: sectionLQ.data ?? null,
            m: sectionMQ.data ?? null,
            factors: factorsQ.data ?? [],
            clarificationCount: clarificationsQ.data?.length ?? 0,
            // Real count off the record, or no line at all.
            receiptCount: await loadReadReceiptCount(acquisitionId)
              .catch(() => null),
            technicalRecord: await loadTechnicalRecord(acquisitionId).catch(() => null),
          }),

          gates: companionGates
            .filter((g) => g.applies)
            .map((g) => ({
              name: g.name,
              status: g.status,
              citation: g.citation,
              trigger: g.trigger,
              evidence: g.evidence,
            })),

        },
        who,
      );
    },
    onSuccess: (fileName) => {
      setBanner(`The briefing book downloaded as ${fileName}. It is a synthetic pack for this prototype; open it and print to PDF.`);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: unknown) =>
      setBanner(
        `The briefing book could not be built: ${e instanceof Error ? e.message : "unknown reason"}. Try again in a moment.`,
      ),
  });

  // A printable aid for the person keying FPDS. T-Minus does not connect to
  // FPDS: every line is read from the record, and blanks stay blank.
  const fpdsExport = useMutation({
    mutationFn: async () => {
      if (!acq) throw new Error("The record is still loading");
      const who = await signedInName(actorName);
      return exportFpdsFillingSheet(
        {
          acq: acq as unknown as Record<string, unknown>,
          awardDate: lifecycle?.awardDate ?? null,
          centerName: (acq["center_name"] as string | null) ?? acq.center_code ?? null,
        },
        who,
      );
    },
    onSuccess: (fileName) => {
      setBanner(
        `The FPDS filling sheet downloaded as ${fileName}. It is a fill aid, not a live FPDS submission; confirm every line against the signed award.`,
      );
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: unknown) =>
      setBanner(
        `The FPDS filling sheet could not be built: ${e instanceof Error ? e.message : "unknown reason"}. Try again in a moment.`,
      ),
  });

  // One zip built locally from the record: documents in NF 1098 order, the
  // research and audit CSVs, the clause packet and the FPDS filling sheet.
  const evidencePack = useMutation({
    mutationFn: async () => {
      if (!acq) throw new Error("The record is still loading");
      const who = await signedInName(actorName);
      return exportEvidencePack(
        {
          acquisitionId: acq.acquisition_id,
          title: String(acq.title ?? acq.acquisition_id),
          isSample: Boolean(acq["is_seed"]),
          clauses: packetSelection,
          appliedClauseNumbers: appliedClauseNumbers ?? null,
          assembly: {
            fileIndex,
            scaffold: formatScaffold,
            recommendedClauseCount: packetClauses.length,
            appliedClauseCount: appliedClauseNumbers?.length ?? null,
          },
          fpds: {
            acq: acq as unknown as Record<string, unknown>,
            awardDate: lifecycle?.awardDate ?? null,
            isLaunched: readiness === "LAUNCHED",
            centerName: (acq["center_name"] as string | null) ?? acq.center_code ?? null,
          },
        },
        who,
      );
    },
    onSuccess: (r) => {
      setBanner(
        `The evidence pack downloaded as ${r.fileName} with ${r.entries} files. It is built from this record only; nothing was sent anywhere.`,
      );
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: unknown) =>
      setBanner(
        `The evidence pack could not be built: ${e instanceof Error ? e.message : "unknown reason"}. Try again in a moment.`,
      ),
  });

  // A demo copy: same intake facts, same requester package, fresh clock.
  const copySample = useMutation({
    mutationFn: async () => copyAsNewSample(acquisitionId, actorName),
    onSuccess: (newId) => {
      void navigate({ to: "/files/$acquisitionId", params: { acquisitionId: newId } });
    },
    onError: (e: unknown) =>
      setBanner(
        `The copy could not be made: ${e instanceof Error ? e.message : "unknown reason"}. Try again in a moment.`,
      ),
  });

  // The clause list is built from this record, not from a fixed set.
  const packetClauses = useMemo(
    () => selectPacketClauses(acq, q.data?.clauses ?? [], q.data?.thresholds ?? []),
    [acq, q.data?.clauses, q.data?.thresholds],
  );

  // Clauses the officer has applied to the file. Until Apply is used, the
  // packet carries every recommended clause.
  const appliedClauseNumbers = useMemo(
    () => storedClauseList(acq?.["contract_clauses"]),
    [acq],
  );
  const packetSelection = useMemo(
    () =>
      appliedClauseNumbers && appliedClauseNumbers.length > 0
        ? packetClauses.filter((c) => appliedClauseNumbers.includes(c.clause_number))
        : packetClauses,
    [packetClauses, appliedClauseNumbers],
  );

  // Fill-ins the award carries, read from the record first and the matrices
  // second, with blanks left reading "Not recorded".
  const awardFillins = useMemo(
    () =>
      packetSelection
        .map((c) => ({
          clause_number: c.clause_number,
          text: clauseFillinText((acq as Record<string, unknown> | null) ?? null, c.clause_number, c.fill_ins),
        }))
        .filter((row): row is { clause_number: string; text: string } => Boolean(row.text)),
    [packetSelection, acq],
  );


  // The contract format the record carries decides the scaffold the officer
  // sees: SF 1449 streamlined on a commercial file, UCF sections otherwise.
  // The method on the record drives the shell: SF 1449 with Part 12/13 voice,
  // or the Uniform Contract Format with Part 15 voice.
  const shell = useMemo(
    () => methodShell(acq as unknown as Record<string, unknown> | null),
    [acq],
  );

  const lmOverride = useMemo(() => {
    if (!acq || !shell) return null;
    const facts = acq as unknown as Record<string, unknown>;
    const l = sectionLQ.data ?? null;
    const m = sectionMQ.data ?? null;
    const factors = factorsQ.data ?? [];
    const authored = lmAuthored(l, m, factors);
    return {
      methodLabel: shell.methodLabel,
      partFamily: shell.partFamily,
      authored,
      chip: authored ? LM_AUTHORED_CHIP : LM_STUB_CHIP,
      instructions: sectionLLines(
        facts,
        shell,
        l,
        packetSelection.some((c) => c.clause_number === "52.212-1"),
      ),
      evaluation: sectionMLines(
        shell,
        m,
        factors,
        packetSelection.some((c) => c.clause_number === "52.212-2"),
      ),
      sectionL: {
        volumes: l?.volumes ?? null,
        page_limit: l?.page_limit ?? null,
        submission_instructions: l?.submission_instructions ?? null,
        response_due_note: l?.response_due_note ?? null,
      },
      sectionM: {
        lpta: m?.lpta ?? false,
        notes: m?.notes ?? null,
        suppressed_sole_source: !shell.competitive,
        factors: factors.map((f) => ({
          name: f.name,
          relative_importance: f.relative_importance ?? "Not recorded",
          description: f.description ?? null,
        })),
      },
    };
  }, [acq, shell, sectionLQ.data, sectionMQ.data, factorsQ.data, packetSelection]);

  // Section K as recorded, in the shell the method calls for. The panel and
  // the packet read the same rows, so they cannot disagree.
  const sectionK = useMemo(
    () =>
      sectionKForPacket(
        sectionKQ.data ?? null,
        shell,
        packetSelection.filter((c) => (c.ucf_section ?? "").trim().toUpperCase() === "K"),
      ),
    [sectionKQ.data, shell, packetSelection],
  );

  // Section J is the attachments on the record, for either format.
  const sectionJ = useMemo(() => attachmentsForSectionJ(attachments), [attachments]);

  const formatScaffold = useMemo(
    () =>
      buildFormatScaffold(
        acq as unknown as Record<string, unknown> | null,
        packetSelection,
        scheduleClins,
        lmOverride,
        sectionJ,
        cdrlItems,
        paymentItems,
        sectionK,
      ),
    [acq, packetSelection, scheduleClins, lmOverride, sectionJ, cdrlItems, paymentItems, sectionK],
  );

  // The official form the method on the record points at. A suggestion only:
  // every other official form stays reachable from this file.
  const suggestedOfficialForm = useMemo(() => {
    const rec = recommendedOfficialForm(acq as unknown as Record<string, unknown> | null);
    return rec ? { key: rec.key, name: FORM_NAMES[rec.key], why: rec.why } : null;
  }, [acq]);

  // Companion gates: exits read from the seeded review rules and this record.
  const companionGates = useMemo(
    () =>
      evaluateCompanionGates(acq, q.data?.rules ?? [], ref, {
        savedKeys,
        attachedKeys: keysFrom(attachments),
        board,
      }),
    [acq, q.data?.rules, ref, savedKeys, attachments, board],
  );

  function downloadPacket() {
    if (!acq) return;
    const packet = orderPacketForScreen(
      {
        ...buildPacket(acq, packetSelection, phases, board),
        contract_format: (acq as Record<string, unknown>)["contract_format"] ?? null,
        format_scaffold: scaffoldForPacket(formatScaffold),
      },
      acq as unknown as Record<string, unknown>,
    );
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const fileName = `ncms-handoff-${acq.acquisition_id}.json`;
    const a = document.createElement("a");
    a.href = url;
    // Setting the name and putting the link in the page before the click is
    // what keeps the browser from renaming the file to the blob id.
    a.setAttribute("download", fileName);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    // The packet is a local file the officer carries into NCMS by hand.
    // T-Minus does not write to NCMS, and this prototype makes no claim to.
    setBanner(
      `The handoff packet downloaded as ${fileName}. It is a local file for this prototype; writing the record into NCMS is planned and not available here.`,
    );
  }

  const value = acq?.estimated_value ? Number(acq.estimated_value) : null;

  // Protest window: the award date is the day the file was marked Launched,
  // and the target award date when no such entry exists.
  const awardDate = lifecycle?.awardDate ?? null;
  const debriefingDate = (acq?.['debriefing_date'] as string | null | undefined) ?? null;
  const protestDeadlines = useMemo(
    () =>
      acq?.clock_state === "launched"
        ? protestWindow(awardDate, debriefingDate, q.data?.thresholds ?? [], todayISO())
        : [],
    [acq?.clock_state, awardDate, debriefingDate, q.data?.thresholds],
  );

  const setDebriefing = useMutation({
    mutationFn: async (next: string) => {
      if (!acq) return;
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ debriefing_date: next || null, updated_at: new Date().toISOString() })
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: "Debriefing date recorded",
        field: "debriefing_date",
        old_value: debriefingDate ?? "",
        new_value: next || "",
        reason: "Protest window recomputed",
        phase: "Award",
      });
    },
    onSuccess: () => {
      setBanner("The debriefing date is recorded and the protest deadlines are recomputed.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`The debriefing date did not save: ${e.message}. Try again.`),
  });

  // The period of performance end drives the successor clock; a launched file
  // that never recorded one can record it here.
  const setPopEnd = useMutation({
    mutationFn: async (next: string) => {
      if (!acq) return;
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ period_of_performance_end: next || null, updated_at: new Date().toISOString() })
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: "Period of performance end recorded",
        field: "period_of_performance_end",
        old_value: (acq.period_of_performance_end as string | null) ?? "",
        new_value: next || "",
        reason: "Successor clock recomputed",
        phase: String(acq.current_phase ?? "Administration"),
      });
    },
    onSuccess: () => {
      setBanner("The period of performance end is recorded and the successor clock is recomputed.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`The end date did not save: ${e.message}. Try again.`),
  });

  // ------------------------------------- directive compliance (hardware buys)
  const setDirective = useMutation({
    mutationFn: async (input: {
      patch: Record<string, boolean | string>;
      field: string;
      action: string;
      newValue: string;
    }) => {
      if (!acq) return;
      const { data, error } = await supabase
        .from("acquisition_facts")
        .update({ ...input.patch, updated_at: new Date().toISOString() } as never)
        .eq("acquisition_id", acq.acquisition_id)
        .select("acquisition_id");
      if (error) throw error;
      if (!data || data.length === 0)
        throw new Error("Changing this file requires Contracting, HQ, or Administrator access.");
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: input.action,
        field: input.field,
        old_value: String((acq as Record<string, unknown>)[input.field] ?? ""),
        new_value: input.newValue,
        reason: "OP memo, March 17, 2026",
        phase: acq.current_phase ?? null,
      } as never);
    },
    onSuccess: () => {
      setBanner("Recorded. Directive compliance is updated.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`That did not save: ${e.message}. Try again.`),
  });

  // ------------------------------------------------------ post-award modules
  const pa = postAward(acq);
  const options = useMemo(() => optionSchedule(acq, awardDate), [acq, awardDate]);
  // The option exercise path reads its authority and its checklist from the
  // same source the modification wizard uses. Nothing here is a gate.
  const optionExercise = useMemo(() => {
    const acqRow = (acq ?? null) as unknown as Record<string, unknown> | null;
    const method = String(acqRow?.["acquisition_method"] ?? "");
    return {
      authority: modAuthorityText("option_exercise", acqRow),
      rows: modRows({ mod_type: "option_exercise" }, { method }),
    };
  }, [acq]);
  const cpars = useMemo(() => cparsView(acq, q.data?.thresholds ?? [], awardDate), [acq, awardDate, q.data?.thresholds]);
  const retention = useMemo(
    () => retentionView(q.data?.thresholds ?? [], pa.final_payment_date ?? null, awardDate),
    [q.data?.thresholds, pa.final_payment_date, awardDate],
  );
  const delta = useMemo(() => clauseDelta(q.data?.clauses ?? []), [q.data?.clauses]);
  // The clause set on an IDIQ vehicle is not reconciled yet, so the delta is
  // withheld rather than shown as if it were the vehicle's clause set.
  const clauseDeltaWithheld = useMemo(() => {
    const acqRow = q.data?.acq;
    if (!acqRow) return false;
    const profile = acquisitionProfile(acqRow);
    return profile === "idiq_parent" || profile === "order_under_idiq";
  }, [q.data?.acq]);

  // Fill-ins the matrices carry on the clauses this modification updates.
  const modFillIns = useMemo(() => {
    const rows = (q.data?.clauses ?? []) as { clause_number: string | null; fill_ins?: unknown }[];
    return delta.updated
      .map((c) => {
        const match = rows.find((r) => r.clause_number === c.clause_number);
        const fills = Array.isArray(match?.fill_ins)
          ? (match.fill_ins as unknown[]).map((v) => String(v)).filter(Boolean)
          : [];
        return { clause_number: c.clause_number, fills: fills.join("; ") };
      })
      .filter((r) => r.fills.length > 0);
  }, [delta, q.data?.clauses]);

  const savePostAward = useMutation({
    mutationFn: async (input: { patch: PostAward; action: string; field: string; reason: string; phase: string }) => {
      if (!acq) return;
      const next = { ...pa, ...input.patch };
      const { error } = await supabase
        .from("acquisition_facts")
        .update({ post_award: next, updated_at: new Date().toISOString() } as never)
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await writeAudit({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: input.action,
        field: input.field,
        old_value: String((pa as Record<string, string | undefined>)[input.field] ?? ""),
        new_value: String((input.patch as Record<string, string | undefined>)[input.field] ?? ""),
        reason: input.reason,
        phase: input.phase,
      });
    },
    onSuccess: () => {
      setBanner("Recorded.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`That did not save: ${e.message}. Try again.`),
  });

  function downloadModPacket(kind: "option exercise" | "administrative", authority: string, period: OptionPeriod | null) {
    if (!acq) return;
    const packet = buildModificationPacket(acq, kind, authority, delta, period);
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sf30-handoff-${acq.acquisition_id}-${kind.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    void writeAudit({
      acquisition_id: acq.acquisition_id,
      actor: actorName,
      action: "SF 30 modification handoff packet built",
      field: "modification",
      old_value: null,
      new_value: kind,
      reason: `${authority}; ${delta.updated.length} clauses updated, ${delta.removed.length} removed`,
      phase: "Administration",
    });
  }

  const primaryAction = (label = heroAction?.label ?? "Next") => {
    if (!heroAction || !canWrite) return null;
    if (heroAction.generated) {
      return heroAction.generated.templateKey ? (
        <Button asChild className="max-w-full whitespace-normal text-left">
          <Link
            to="/documents/$templateKey/$acquisitionId"
            params={{ templateKey: heroAction.generated.templateKey, acquisitionId }}
          >
            {label}
          </Link>
        </Button>
      ) : (
        <Button asChild className="max-w-full whitespace-normal text-left">
          <Link
            to="/forms/$formKey/$acquisitionId"
            params={{ formKey: heroAction.generated.formKey ?? "nf-1787", acquisitionId }}
          >
            {label}
          </Link>
        </Button>
      );
    }
    if (heroAction.doc) {
      return (
        <Button asChild disabled={attachDoc.isPending} className="max-w-full whitespace-normal text-left">
          <label className="cursor-pointer">
            {attachDoc.isPending ? "Attaching" : label}
            <input
              type="file"
              className="sr-only"
              accept={ATTACHMENT_ACCEPT}
              disabled={attachDoc.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && heroAction.doc) attachDoc.mutate({ doc: heroAction.doc, file });
                event.target.value = "";
              }}
            />
          </label>
        </Button>
      );
    }
    if (heroAction.label.startsWith("Exit ") && currentPhase) {
      return <Button className="max-w-full whitespace-normal text-left" onClick={() => showActionDialog({ kind: "exit", phase: currentPhase.phase })}>{label}</Button>;
    }
    if (heroAction.label === "Send the review requests" && currentPhase) {
      return <Button className="max-w-full whitespace-normal text-left" onClick={() => showActionDialog({ kind: "open-poll", phase: currentPhase.phase })}>{label}</Button>;
    }
    return <Button className="max-w-full whitespace-normal text-left" onClick={openLaunchSequence}>{label}</Button>;
  };

  // Print opens the launch sequence and the file index so the handout is whole.
  useEffect(() => {
    const onBeforePrint = () => {
      document.querySelectorAll<HTMLDetailsElement>("details[data-print], details[data-mission-nav-collapsible]").forEach((d) => {
        d.open = true;
      });
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  // Contract file index rows: tabs with a document, then required tabs with none.
  type FileIndexRow =
    | { kind: "present"; t: (typeof fileIndex.present)[number]; officialDoc: (typeof fileIndex.present)[number]["documents"][number] | undefined; latest: (typeof fileIndex.present)[number]["documents"][number] | undefined }
    | { kind: "missing"; t: (typeof fileIndex.missing)[number] };
  const fileIndexRows: FileIndexRow[] = [
    ...fileIndex.present.map((t): FileIndexRow => {
      const officialDoc = t.documents.find((d) => d.official);
      return { kind: "present", t, officialDoc, latest: officialDoc ?? t.documents.at(-1) };
    }),
    ...fileIndex.missing.map((t): FileIndexRow => ({ kind: "missing", t })),
  ];

  // Phases that carry a review board, in launch sequence order, and the
  // requested reviews still waiting for a decision.
  const reviewPhases = phases.filter((p) => (boards[p.phase] ?? []).length > 0);
  const pendingReviewCount = reviewPhases.reduce(
    (n, p) => n + (boards[p.phase] ?? []).filter((b) => b.poll_id && b.vote === "pending").length,
    0,
  );

  const selfCheck = useMemo(() => {
    if (!acq) return [];
    return fileSelfCheck({
      acq,
      phases,
      attachedKeys: keysFrom(attachments),
      savedKeys,
      documents: checkDocsFrom(q.data?.documents ?? [], q.data?.templates ?? []),
      hours: (clinQ.data ?? []).map((line) => ({
        quantity: line.quantity,
        unit: line.unit_of_issue,
        description: line.description,
      })),
    });
  }, [acq, phases, attachments, savedKeys, q.data?.documents, q.data?.templates, clinQ.data]);

  const missionNavItems = useMemo<MissionNavItem[]>(() => {
    const phaseOpenCount = missingCurrentRequirements.length + pendingCurrentReviews.length;
    const companionOpenCount = companionGates.filter((gate) => gate.applies && gate.status === "Open").length;
    const missingFileCount = fileIndex.missing.length;
    const auditCount = q.data?.auditCount ?? 0;
    return [
      ...(effectiveState === "hold" && hold
        ? [{ id: "current-hold", label: "Current hold", badge: { tone: "hold" as const, text: "HOLD" } }]
        : []),
      { id: "summary-clock", label: "Summary & clock" },
      {
        id: "launch-sequence",
        label: "Launch sequence",
        badge: phaseOpenCount > 0 ? { tone: "watch" as const, text: `${phaseOpenCount} open` } : null,
      },
      ...(sinceChanges.length > 0
        ? [{
            id: "since-last-look",
            label: "Since you last looked",
            group: FILE_TAB_LABEL.overview,
            badge: { tone: "neutral" as const, text: String(sinceChanges.length) },
          }]
        : []),
      ...(selfCheck.length > 0
        ? [{
            id: "file-self-check",
            label: "Disagrees with itself",
            group: FILE_TAB_LABEL.overview,
            badge: { tone: "watch" as const, text: String(selfCheck.length) },
          }]
        : []),
      { id: "schedule-forecast", label: "Schedule & forecast", group: FILE_TAB_LABEL.overview },
      { id: "coordination", label: "Coordination", group: FILE_TAB_LABEL.overview },
      { id: "alerts-determinations", label: "Alerts & determinations", group: FILE_TAB_LABEL.overview },
      {
        id: "reviews-approvals",
        label: "Reviews and approvals",
        group: FILE_TAB_LABEL.reviews,
        badge: pendingReviewCount > 0 ? { tone: "watch" as const, text: `${pendingReviewCount} pending` } : null,
      },
      {
        id: "companion-gates",
        label: "Companion gates",
        group: FILE_TAB_LABEL.reviews,
        badge: companionOpenCount > 0 ? { tone: "watch" as const, text: `${companionOpenCount} open` } : null,
      },
      { id: "directive-compliance", label: "Directive compliance", group: FILE_TAB_LABEL.reviews },
      {
        id: "contract-file-index",
        label: "Contract file index",
        group: FILE_TAB_LABEL.documents,
        badge: missingFileCount > 0 ? { tone: "neutral" as const, text: `${missingFileCount} missing` } : null,
      },
      { id: "exports-peer-systems", label: "Exports & peer systems", group: FILE_TAB_LABEL.documents },
      { id: "vehicle-orders-post-award", label: "Vehicle, orders & post-award", group: FILE_TAB_LABEL["post-award"] },
      { id: "thresholds", label: "Thresholds", group: FILE_TAB_LABEL.details },
      { id: "facts-of-record", label: "Facts of record", group: FILE_TAB_LABEL.details },
      { id: "reference-links", label: "Reference links", group: FILE_TAB_LABEL.details },
      {
        id: "audit-trail",
        label: "Audit trail",
        group: FILE_TAB_LABEL.audit,
        badge: auditCount > 0 ? { tone: "neutral" as const, text: String(auditCount) } : null,
      },
    ];
  }, [companionGates, effectiveState, fileIndex.missing.length, hold, missingCurrentRequirements.length, pendingCurrentReviews.length, pendingReviewCount, q.data?.auditCount, selfCheck.length, sinceChanges.length]);

  const fileTabBadges: Partial<Record<FileTabKey, string>> = {
    ...(selfCheck.length > 0 ? { overview: String(selfCheck.length) } : {}),
    ...(pendingReviewCount > 0 ? { reviews: `${pendingReviewCount} pending` } : {}),
    ...(fileIndex.missing.length > 0 ? { documents: `${fileIndex.missing.length} missing` } : {}),
    ...((q.data?.auditCount ?? 0) > 0 ? { audit: String(q.data?.auditCount ?? 0) } : {}),
  };

  // P1-E: on a client navigation the record arrives a moment after the route
  // does. Until it is in hand the page says it is loading rather than painting
  // an empty file that reads like a record with nothing on it.
  // Hero visibility drives the identity strip.
  const [heroEl, setHeroEl] = useState<HTMLElement | null>(null);
  const [stripShown, setStripShown] = useState(false);
  useEffect(() => {
    if (!heroEl || typeof IntersectionObserver === "undefined") return;
    const headerH = document.querySelector("header.sticky")?.getBoundingClientRect().height ?? 56;
    const observer = new IntersectionObserver(
      ([entry]) => setStripShown(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < headerH)),
      { rootMargin: `-${Math.round(headerH)}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(heroEl);
    return () => observer.disconnect();
  }, [heroEl]);

  const filePosition = phasePosition(phases);
  const nextDecisionDue = dueView(lifecycle?.nextDecisionDate ?? null);
  // The hold panel carries the full reason once; the tiles, the clock and the
  // rail use a short name that points back to it.
  const holdShort = effectiveState === "hold" && hold ? holdShortLabel(hold.reason) : "";
  const heroCountdownView: CountdownView = holdShort ? { ...fileCountdownView, holdReason: holdShort } : fileCountdownView;
  // An overdue next decision names what is late: the phase exit or a review.
  const nextDecisionOverdueText =
    nextDecisionDue?.overdue
      ? `${lifecycle?.nextDecision?.startsWith("Exit ") ? "Current phase" : "Review decision"} overdue by ${Math.abs(nextDecisionDue.days)} ${Math.abs(nextDecisionDue.days) === 1 ? "day" : "days"}`
      : null;
  const targetPassedText =
    fileCountdownView.pastTarget && fileCountdownView.days !== null && effectiveState !== "launched"
      ? fileCountdownView.days === 0
        ? "Target award date is today"
        : `Target award passed ${fileCountdownView.days} ${fileCountdownView.days === 1 ? "day" : "days"} ago`
      : null;
  // Display only: a clock past its target reads OVERDUE beside the readiness
  // badge, the same word the countdown shows. Readiness and gates are unchanged.
  const showOverdueBadge = Boolean(targetPassedText) && (fileCountdownView.days ?? 0) > 0 && effectiveState !== "scrubbed";

  // The rail's attention list reads the same figures as the hero and the
  // section badges. It adds no rule of its own.
  const railAttention = (() => {
    const items: { key: string; tone: "hold" | "watch"; text: string; sub?: string; target: string }[] = [];
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    if (effectiveState === "hold" && hold) {
      items.push({ key: "hold", tone: "hold", text: `On hold: ${holdShort || hold.reason}`, sub: `Owner: ${holdOwnerDisplay(hold.owner)}`, target: "current-hold" });
    }
    if (nextDecisionDue?.overdue && lifecycle) {
      items.push({ key: "overdue", tone: "hold", text: `${lifecycle.nextDecision}: ${(nextDecisionOverdueText ?? nextDecisionDue.text).toLowerCase()}`, sub: `Planned for ${nextDecisionDue.dateText}`, target: "launch-sequence" });
    }
    if (missingCurrentRequirements.length && currentPhase) {
      items.push({
        key: "missing",
        tone: "watch",
        text: `${plural(missingCurrentRequirements.length, "required document", "required documents")} missing in ${phaseLabel(currentPhase)}`,
        sub: missingCurrentRequirements.slice(0, 3).map((d) => d.label).join(", "),
        target: missingCurrentRequirements[0] ? requirementId(currentPhase.phase, missingCurrentRequirements[0].label) : "launch-sequence",
      });
    }
    if (pendingCurrentReviews.length && currentPhase) {
      items.push({
        key: "reviews",
        tone: "watch",
        text: `${plural(pendingCurrentReviews.length, "review decision", "review decisions")} pending`,
        sub: pendingCurrentReviews.slice(0, 3).map((b) => b.reviewer_role).join(", "),
        target: `poll-${currentPhase.phase}`,
      });
    }
    for (const p of phases) {
      const open = openRequiredByPhase.get(p.phase);
      if (!open?.length || !open[0]) continue;
      items.push({
        key: `open-${p.phase}`,
        tone: "watch",
        text: `${phaseLabel(p)} not complete: ${plural(open.length, "required item", "required items")} open`,
        sub: open.slice(0, 3).map((d) => d.label).join(", "),
        target: requirementId(p.phase, open[0].label),
      });
    }
    const openGates = companionGates.filter((gate) => gate.applies && gate.status === "Open").length;
    if (openGates) items.push({ key: "gates", tone: "watch", text: `${plural(openGates, "companion gate", "companion gates")} open`, target: "companion-gates" });
    if (fileIndex.missing.length) {
      items.push({ key: "index", tone: "watch", text: `${plural(fileIndex.missing.length, "tab", "tabs")} missing from the contract file index`, target: "contract-file-index" });
    }
    return items;
  })();

  // Bring a section or row into view below the sticky chrome. Requirement rows
  // and the launch sequence go through revealHash, which opens and waits.
  const jumpToSection = (id: string) => {
    if (id === "launch-sequence" || id.startsWith("requirement-")) {
      revealHash(`#${id}`, { updateHash: true });
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    showTabFor(el);
    if (id.startsWith("poll-")) {
      const sequence = document.getElementById("launch-sequence") as HTMLDetailsElement | null;
      if (sequence) sequence.open = true;
    }
    if (el instanceof HTMLDetailsElement) el.open = true;
    const inner = el.querySelector<HTMLDetailsElement>(":scope > details, :scope > .mc-nav-section-content > details");
    if (inner) inner.open = true;
    place(el, "start");
    focusTarget(el.querySelector<HTMLElement>("h2, summary") ?? el);
    window.history.replaceState(window.history.state, "", `#${id}`);
    window.dispatchEvent(new CustomEvent(MISSION_NAV_CURRENT, { detail: { id } }));
  };

  // A step in the phase row shows that phase in the launch sequence.
  const showPhase = (index: number) => {
    const p = phases[index];
    if (!p) return;
    const sequence = document.getElementById("launch-sequence") as HTMLDetailsElement | null;
    if (sequence) sequence.open = true;
    if (!shownPhases.includes(p)) setShowFullSequence(true);
    let frames = 0;
    const tryPhase = () => {
      const el = document.getElementById(`phase-${p.order}`);
      if (el) {
        place(el, "start");
        focusTarget(el.querySelector<HTMLElement>("h3") ?? el);
        pinTarget(el, "start");
        return;
      }
      frames += 1;
      if (frames < 10) window.requestAnimationFrame(tryPhase);
    };
    window.requestAnimationFrame(tryPhase);
  };

  if (q.isPending || q.isLoading || q.isFetching && !q.data) {
    return (
      <AppShell kit>
        <FilePageSkeleton acquisitionId={acquisitionId} />
      </AppShell>
    );
  }

  // The record could not be read or does not exist: say so and offer the way
  // back rather than waiting forever.
  if (q.isError || !acq) {
    return (
      <AppShell kit>
        <ErrorNote
          message={
            q.isError
              ? "The acquisition file did not load. Refresh the page. If it still fails, tell the T-Minus team."
              : `No acquisition file was found for ${acquisitionId}. Check the link, or open Files to pick a record.`
          }
        />
        <Link to="/files" activeOptions={{ exact: true }} className="mt-4 inline-block text-[15px] text-primary">
          Back to Files
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell kit>
      {/* Quiet print-only header: the record's id and title on the handout. */}
      <div data-print="header" className="hidden">
        <p className="text-[13px]">{acquisitionId}</p>
        <p className="text-[15px] font-medium">{acq?.title ?? acquisitionId}</p>
      </div>


      {banner ? (
        <p className="mb-6 border-l-2 py-1 pl-3 text-[13px]" style={{ borderColor: "var(--attention)" }}>
          {banner}
        </p>
      ) : null}

      {!q.isLoading && effectiveState === "hold" && hold ? (
        <MissionNavSection id="current-hold" label="Current hold">
        <section aria-label="Current hold" className="mc-file-hold">
          <div className="grid min-w-0 grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="max-w-[80ch] text-[15px] leading-[22px]">
                <a
                  href={holdRequirementHref}
                  onClick={(e) => { e.preventDefault(); revealHash(holdRequirementHref, { updateHash: true }); }}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {holdAlertText(hold.reason)}
                </a>
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Owner: {holdOwnerDisplay(hold.owner)}
                {holdAge !== null
                  ? holdAge >= holdThreshold
                    ? ` · ${holdAge} days, past the ${holdThreshold}-day Center window`
                    : ` · ${holdAge} days; aging after ${holdThreshold} days`
                  : ""}
              </p>
              {acq && alsoRecordedHold(acq as AcqRow, hold) ? (
                <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">{alsoRecordedHold(acq as AcqRow, hold)}</p>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              {primaryAction("Fix")}
              <ExplainThis explanation={explainHold(hold, acq as AcqRow)} label="Why?" />
              <Nova acquisitionId={acquisitionId} rowLabel={`hold · ${hold.reason}`} />
            </div>
          </div>
        </section>
        </MissionNavSection>
      ) : null}

      {!q.isLoading ? (
      <div className="mc-file-layout">
        <div className="mc-file-main">

      {/* Identity strip: once the hero scrolls away, the file, its state and
          the clock stay in view. Display only; the actions live in the hero. */}
      <div className="mc-file-strip-anchor no-print">
        <div data-file-strip className={`mc-file-strip${stripShown ? " is-shown" : ""}`} aria-hidden={!stripShown}>
          <span className="mc-file-strip-id" data-numeric>{acquisitionId}</span>
          {readiness ? <MissionReadinessChip state={readiness} /> : null}
          <span className="mc-file-strip-title">{acq?.title ?? acquisitionId}</span>
          <span className="mc-file-strip-phase" data-numeric>
            {filePosition.number !== null && filePosition.name ? `${phasePositionText(filePosition)}: ${filePosition.name}` : phasePositionText(filePosition)}
          </span>
          <LaunchCountdownCompact view={heroCountdownView} className="mc-file-strip-clock" />
        </div>
      </div>

      <details className="no-print mc-file-jump min-[1440px]:hidden">
        <summary>Jump to section</summary>
        <MissionNavigator items={missionNavItems} label="On this file" />
      </details>

      <MissionNavSection id="summary-clock" label="Summary & clock">
      <section ref={setHeroEl} data-print="story" aria-label="Clock line" className="mc-file-hero">
        <div className="mc-file-hero-top">
          <div className="min-w-0">
            <div className="mc-file-hero-eyebrow">
              <span className="mc-file-hero-id" data-numeric>{acquisitionId}</span>
              {readiness && !(readiness === "HOLD" && fileCountdownView.mode === "hold") ? <MissionReadinessChip state={readiness} /> : null}
              {showOverdueBadge ? (
                <span className="mc-state mc-state-hold" title={targetPassedText ?? undefined}>OVERDUE</span>
              ) : null}
              <span className="mc-file-hero-type">{acq?.center_code ?? ""} · {acq ? acquisitionTypeWords(acq) : "Loading the file"}</span>
            </div>
            <h1 className={presenter ? "mc-file-hero-title is-presenter" : "mc-file-hero-title"}>{acq?.title ?? acquisitionId}</h1>
            {/* On hold the reason already leads the page in the hold panel. */}
            {statusLine?.reason && !(effectiveState === "hold" && hold) ? (
              <p className="mc-file-hero-status">
                {statusLine.state} · {statusLine.reason}
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="mc-file-hero-actions">
              {heroAction && canWrite ? primaryAction() : null}
              {heroAction && !canWrite && readOnly ? (
                <Button disabled variant="outline" aria-describedby="file-hero-lock" className="mc-btn-locked max-w-full whitespace-normal text-left">{heroAction.label}</Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">More</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem asChild>
                    <span><ExplainThis explanation={statusExplanation} label="Explain this status" /></span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/documents/$templateKey/$acquisitionId" params={{ templateKey: "memorandum-for-record", acquisitionId }}>Write a memo to file</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={nearExport.isPending} onSelect={() => nearExport.mutate()}>
                    {nearExport.isPending ? "Building the export" : "Export file for NEAR"}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={briefingExport.isPending} onSelect={() => briefingExport.mutate()}>
                    {briefingExport.isPending ? "Building the briefing book" : "Export briefing book"}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={fpdsExport.isPending} onSelect={() => fpdsExport.mutate()}>
                    {fpdsExport.isPending ? "Building the FPDS filling sheet" : "FPDS filling sheet (fill aid)"}
                  </DropdownMenuItem>
                  {/* Review-and-sign path: the official blank filled from this
                      record. Signature blocks stay empty. */}
                  {shell?.path === "sf1449" ? (
                    <DropdownMenuItem asChild>
                      <Link to="/forms/$formKey/$acquisitionId" params={{ formKey: "sf-1449", acquisitionId }}>
                        Filled SF 1449 for signature
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {String(acq?.["contract_number"] ?? "").trim() ? (
                    <DropdownMenuItem asChild>
                      <Link to="/forms/$formKey/$acquisitionId" params={{ formKey: "sf-30", acquisitionId }}>
                        Filled SF 30 for signature
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem disabled={evidencePack.isPending} onSelect={() => evidencePack.mutate()}>
                    {evidencePack.isPending ? "Building the evidence pack" : "Export evidence pack (zip)"}
                  </DropdownMenuItem>
                  {canWrite ? (
                    <DropdownMenuItem disabled={copySample.isPending} onSelect={() => copySample.mutate()}>
                      {copySample.isPending ? "Copying the file" : "Copy as new sample"}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  {!presenter ? (
                    <DropdownMenuItem onSelect={() => { setMode(mode === "novice" ? "veteran" : "novice"); setStep(currentIndex); }}>
                      Use {mode === "novice" ? "Veteran" : "Novice"} view
                    </DropdownMenuItem>
                  ) : null}
                  {canWrite && acq?.clock_state !== "launched" ? (
                    <>
                      <DropdownMenuItem onSelect={() => showActionDialog({ kind: "scrub" })}>Scrub with a reason</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => launch.mutate()}>Launched (manual)</DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              {heroAction && (heroAction.doc?.citation || heroAction.generated?.citation) ? (
                <ExplainThis
                  explanation={explainMissingDoc(heroAction.doc ?? heroAction.generated as RequiredDoc, currentPhase?.phase ?? "Current phase")}
                  label="Why?"
                />
              ) : null}
            </div>
            {heroAction && !canWrite && readOnly ? <div id="file-hero-lock"><LockHint className="mt-2" /></div> : null}
          </div>
        </div>

        <div className="mc-file-glance">
          <div className="mc-glance mc-glance-clock">
            <LaunchCountdown
              view={heroCountdownView}
              acquisitionId={acquisitionId}
            />
            <p className="mc-glance-state">
              {effectiveState === "running"
                ? "Clock running"
                : effectiveState === "hold"
                  ? "On hold"
                  : effectiveState === "launched"
                    ? "Launched"
                    : (effectiveState ?? "Not recorded")}
              {targetPassedText ? <span className="mc-glance-state-note">{targetPassedText}</span> : null}
            </p>
            {confidence && effectiveState !== "launched" && effectiveState !== "scrubbed" ? (
              <p className="mc-glance-sub">{confidence.sentence}</p>
            ) : null}
            {acq && String((acq as AcqRow).clock_state ?? "").toLowerCase() === "launched" && effectiveState !== "launched" ? (
              <p className="mc-glance-sub">{STORED_LAUNCH_NOTE}</p>
            ) : null}
          </div>
          <div className="mc-glance">
            <p className="mc-glance-label">Where it is</p>
            <p className="mc-glance-value">{currentPhase ? phaseLabel(currentPhase) : (lifecycle?.currentPhase ? stepLabel(lifecycle.currentPhase, acq as AcqRow) : "Not started")}</p>
            <p className="mc-glance-sub" data-numeric>
              {phasePositionText(filePosition)}
              {currentPhase ? ` · ${phaseDayLine(currentPhase)}` : ""}
            </p>
          </div>
          <div className="mc-glance">
            <p className="mc-glance-label">{lifecycle?.blocker && lifecycle.blocker !== "None" ? "What is blocking" : "What is next"}</p>
            {/* Only a Required row reads as missing here. With none missing the
                line says the phase is ready to exit. */}
            <p className="mc-glance-value is-text">
              {holdShort
                ? `On hold: ${holdShort}`
                : lifecycle?.blocker && lifecycle.blocker !== "None"
                ? lifecycle.blocker
                : currentPhase && !missingCurrentRequirements.length && !pendingCurrentReviews.length &&
                    effectiveState !== "launched" && effectiveState !== "scrubbed"
                  ? // On WATCH or HOLD the line carries the overrun (same figure as the
                    // rail) or the reason, so it never reads as an all-clear.
                    `Ready to exit ${phaseLabel(currentPhase)}${
                      currentPhase.followsAward?.length
                        ? `. Not blocking award: the justification and approval may follow award (RFO FAR 6.103-2(d)); post it within 30 days after award (RFO FAR 6.301(b)(1))`
                        : ""
                    }${
                      statusLine && statusLine.state !== "GO" && statusLine.state !== "LAUNCHED"
                        ? statusLine.overrunDays !== null
                          ? `. ${statusLine.overrunDays} ${statusLine.overrunDays === 1 ? "day" : "days"} over plan.`
                          : statusLine.reason
                            ? `. ${statusLine.reason}.`
                            : ""
                        : ""
                    }`
                  : (lifecycle?.nextAction ?? "Loading")}
            </p>
            <p className="mc-glance-sub">
              {lifecycle?.blockerOwner
                ? `Owner: ${holdOwnerDisplay(lifecycle.blockerOwner)}`
                : lifecycle?.blocker && lifecycle.blocker !== "None"
                  ? "Owner not recorded"
                  : effectiveState === "launched" ? "Post-award next action" : effectiveState === "scrubbed" ? "No countdown" : "Nothing is blocking"}
            </p>
            {heroAction && !canWrite && readOnly ? (
              <LockHint className="mt-1" lead={`${heroAction.label} is locked here.`} />
            ) : null}
            {holdShort ? (
              <p className="mc-glance-sub">
                <a
                  href="#current-hold"
                  onClick={(e) => { e.preventDefault(); jumpToSection("current-hold"); }}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Read the reason
                </a>
              </p>
            ) : null}
          </div>
          <div className="mc-glance mc-glance-next">
            <p className="mc-glance-label">Next decision</p>
            <p className="mc-glance-value is-text">{lifecycle?.nextDecision ?? "Loading"}</p>
            {nextDecisionDue ? (
              nextDecisionDue.overdue ? (
                <p className="mc-glance-sub">
                  <span className="mc-due is-overdue" title={`Planned for ${nextDecisionDue.dateText}`}>{nextDecisionOverdueText ?? nextDecisionDue.text}</span>
                </p>
              ) : (
                <p className="mc-glance-sub" data-numeric>{nextDecisionDue.text}</p>
              )
            ) : (
              <p className="mc-glance-sub">No date planned</p>
            )}
            <p className="mc-glance-sub">
              Contracting officer: {String(acq?.co_name ?? "").trim() || "Not assigned"}
            </p>
          </div>
        </div>

        {acq && !q.isLoading ? (
          <div className="mc-file-hero-story">
            <p>
              {fileStory(acq as AcqRow, q.data?.mission?.name ?? null, q.data?.mission?.milestone_date ?? null, lifecycle?.currentPhase ?? null, effectiveState ?? null, (acq as AcqRow).need_date ?? null, (acq as AcqRow).period_of_performance_start ?? null)}
            </p>
            <p className="mc-file-hero-prov">{fileStoryProvenance()}</p>
          </div>
        ) : null}
      </section>
      </MissionNavSection>

      <FilePhaseStepper phases={phases} daysToPhaseExit={lifecycle?.nextDecision?.startsWith("Exit") ? lifecycle.daysToNextDecision : null} onSelect={showPhase} />

      <details id="launch-sequence" data-print="sequence" open aria-label="Launch sequence" className={`mc-seq${presenter ? " presenter-step" : ""}`}>
        <summary className="mc-seq-summary">
          <span>Launch sequence</span>
          <span className="mc-seq-summary-note" data-numeric>{phasePositionText(filePosition)}</span>
        </summary>
        <div className="mc-seq-body">

        <div className="mc-seq-toolbar">
          <p className="text-[13px] text-muted-foreground">
            {showFullSequence ? `All ${phases.length} phases` : "Past, now, and next"}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowFullSequence((value) => !value)}>
            {showFullSequence ? "Show current window" : "Show full sequence"}
          </Button>
        </div>

        {mode === "novice" ? (
          <div className="mb-4 flex items-center gap-3 text-[13px]">
            <button
              type="button"
              disabled={focusIndex === 0}
              onClick={() => setStep(Math.max(0, focusIndex - 1))}
              className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
            >
              Previous phase
            </button>
            <span className="text-muted-foreground" data-numeric>
              Phase {focusIndex + 1} of {phases.length}
            </span>
            <button
              type="button"
              disabled={focusIndex >= phases.length - 1}
              onClick={() => setStep(Math.min(phases.length - 1, focusIndex + 1))}
              className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
            >
              Next phase
            </button>
          </div>
        ) : null}

        <ol className="mc-seq-list">
          {shownPhases.map((p) => (
            <li key={p.phase} id={`phase-${p.order}`} className={`mc-seq-phase is-${p.status}`}>
              <span
                aria-hidden="true"
                className="mc-seq-dot"
                style={{
                   borderColor: p.status === "upcoming" ? "var(--border)" : statusColor(effectiveState),
                  background:
                    p.status === "complete"
                       ? statusColor(effectiveState)
                      : p.status === "current"
                        ? "var(--panel)"
                        : "transparent",
                }}
              />
              <div className="mc-seq-phase-head">
                <h3 className="mc-seq-phase-title">
                  <span className="mc-seq-phase-n" data-numeric>{p.order}</span> {phaseLabel(p)}
                </h3>
                {openRequiredByPhase.get(p.phase)?.length ? (
                  <StatusChip
                    label={`Not complete · ${openRequiredByPhase.get(p.phase)?.length} required ${openRequiredByPhase.get(p.phase)?.length === 1 ? "item" : "items"} open`}
                    tone="attention"
                  />
                ) : (
                  <StatusChip
                    label={p.status === "complete" ? "Complete" : p.status === "current" ? "In work" : "Not started"}
                    tone={p.status === "complete" ? "ontrack" : p.status === "current" ? "info" : "neutral"}
                  />
                )}
                <span className="mc-seq-phase-days" data-numeric>
                  {phaseDayLine(p)}
                </span>
              </div>
              <p className="mc-seq-phase-cite">{p.citation}</p>
              {openRequiredByPhase.get(p.phase)?.length ? (
                <p className="mc-phase-open-note max-w-[80ch]">
                  This phase does not count as complete. Still open:{" "}
                  {openRequiredByPhase.get(p.phase)?.map((d) => d.label).join("; ")}. The file has moved on, and the
                  phase reads complete once the item is on the record.
                </p>
              ) : null}
              {mode === "novice" ? <p className="mt-2 max-w-[80ch] text-[15px]">{p.guidance}</p> : null}

              <ul className="mc-seq-rows">
                {p.docs.map((d) => {
                  const key = d.docKey ?? docKey(d.field, d.label);
                  const attached = attachmentFor(key);
                  const generator = generatorKey(d);
                  const saved = generator ? savedDocs.get(generator) : undefined;
                  const state = docSatisfied(
                    d,
                    acq ?? ({ acquisition_id: "" } as AcqRow),
                    d.field || generator || d.attachOnly ? Boolean(attached) : undefined,
                    savedKeys,
                  );
                  const busy = attachDoc.isPending || detachDoc.isPending;
                  return (
                    <li
                      id={requirementId(p.phase, d.label)}
                      key={d.label}
                      className={`mc-seq-row ${state === true ? "is-done" : state === false ? (d.optional ? "is-offered" : "is-needed") : "is-info"}`}
                    >
                      <span className="mc-seq-row-head">
                        <span className="mc-seq-row-label">{d.label}</span>
                        <span className={`mc-seq-tag${d.optional ? " is-offered" : ""}`}>
                          {d.optional ? "Offered" : "Required"}
                        </span>
                        {d.citation ? (
                          <span className="mc-seq-row-cite">{d.citation}</span>
                        ) : null}
                      </span>
                      {generator ? (
                        <>
                          <StatusMark
                            color={saved ? "var(--ontrack)" : "var(--atrisk)"}
                            className="text-[13px]"
                          >
                            {saved
                              ? `Saved, version ${saved.version}${saved.savedAt ? `, ${formatDate(String(saved.savedAt).slice(0, 10))}` : ""}`
                              : `Needs ${d.label}`}
                          </StatusMark>
                          {d.templateKey ? (
                            <Link
                              to="/documents/$templateKey/$acquisitionId"
                              params={{ templateKey: d.templateKey, acquisitionId }}
                              className="text-[13px] text-primary"
                            >
                              {saved ? "Open the saved document" : "Write the document for this file"}
                            </Link>
                          ) : (
                            <Link
                              to="/forms/$formKey/$acquisitionId"
                              params={{ formKey: d.formKey ?? "nf-1787", acquisitionId }}
                              className="text-[13px] text-primary"
                            >
                              {saved ? "Open the saved form" : "Write the form for this file"}
                            </Link>
                          )}
                          {attached ? (
                            <button
                              type="button"
                              onClick={() => void openAttachment(attached)}
                              className="text-[13px] text-primary"
                            >
                              {attached.file_name}
                            </button>
                          ) : null}
                          {canWrite ? (
                            attached ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => showActionDialog({ kind: "remove", doc: d })}
                                className="text-[13px] text-primary disabled:opacity-60"
                              >
                                Remove the external copy
                              </button>
                            ) : (
                              <label className="cursor-pointer text-[13px] text-primary">
                                {busy ? "Attaching" : "Attach an external copy"}
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept={ATTACHMENT_ACCEPT}
                                  disabled={busy}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) attachDoc.mutate({ doc: d, file });
                                    event.target.value = "";
                                  }}
                                />
                              </label>
                            )
                          ) : null}
                          <span className="block w-full">
                            <span className="flex flex-wrap items-center gap-2">
                              <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(saved || attached))} label={saved || attached ? "Why this row" : "Why?"} />
                              <span className="mc-seq-nova"><Nova acquisitionId={acquisitionId} rowLabel={`document row · ${d.label}`} /></span>
                            </span>
                          </span>

                        </>
                       ) : d.field === "funds_certified" ? (
                         <>
                           <StatusMark
                             color={state ? "var(--ontrack)" : "var(--atrisk)"}
                             className="text-[13px]"
                           >
                              {state ? "Certified for the period of performance" : "Needs funds certification"}
                           </StatusMark>
                           {canWrite ? (
                             <button
                               type="button"
                               disabled={setFundsCertified.isPending}
                               onClick={() => setFundsCertified.mutate(!state)}
                               className="rounded-lg border border-input px-3 py-1.5 text-[13px] text-primary disabled:opacity-60"
                             >
                               {setFundsCertified.isPending
                                 ? "Saving"
                                 : state
                                   ? "Withdraw the certification"
                                   : "Mark funds certified"}
                             </button>
                           ) : null}
                           {state ? (
                             <span className="block w-full text-[13px] text-muted-foreground">
                               Sample certification for this prototype file.
                             </span>
                           ) : null}
                           <span className="block w-full">
                              <span className="flex flex-wrap items-center gap-2">
                                <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(state))} label={state ? "Why this row" : "Why?"} />
                                <span className="mc-seq-nova"><Nova acquisitionId={acquisitionId} rowLabel={`document row · ${d.label}`} /></span>
                              </span>
                           </span>

                         </>
                       ) : d.field === "proposed_price" ? (
                         <>
                           <StatusMark
                             color={state ? "var(--ontrack)" : "var(--atrisk)"}
                             className="text-[13px]"
                           >
                             {state
                               ? `Recorded, ${formatMoney(Number(acq?.["proposed_price"] ?? 0))}${
                                   acq?.['proposed_price_received']
                                     ? `, received ${formatDate(String(acq['proposed_price_received']).slice(0, 10))}`
                                     : ""
                                 }`
                                : "Needs the proposed price"}
                           </StatusMark>
                           {canWrite ? (
                             <span className="flex w-full flex-wrap items-end gap-3">
                               <label className="text-[13px]">
                                 Proposed price
                                 <input
                                   type="number"
                                   min={0}
                                   step="0.01"
                                   value={priceDraft?.price ?? String(acq?.['proposed_price'] ?? "")}
                                   onChange={(event) =>
                                     setPriceDraft({
                                       price: event.target.value,
                                       received:
                                         priceDraft?.received ??
                                         String(acq?.['proposed_price_received'] ?? ""),
                                     })
                                   }
                                   className="mt-1 block w-44 rounded-lg border border-input bg-background px-3 py-1.5"
                                 />
                               </label>
                               <label className="text-[13px]">
                                 Date received
                                 <input
                                   type="date"
                                   value={
                                     priceDraft?.received ??
                                     String(acq?.['proposed_price_received'] ?? "").slice(0, 10)
                                   }
                                   onChange={(event) =>
                                     setPriceDraft({
                                       price: priceDraft?.price ?? String(acq?.['proposed_price'] ?? ""),
                                       received: event.target.value,
                                     })
                                   }
                                   className="mt-1 block rounded-lg border border-input bg-background px-3 py-1.5"
                                 />
                               </label>
                               <button
                                 type="button"
                                 disabled={setProposedPrice.isPending}
                                 onClick={() =>
                                   setProposedPrice.mutate(
                                     {
                                       price: priceDraft?.price ?? String(acq?.['proposed_price'] ?? ""),
                                       received:
                                         priceDraft?.received ??
                                         String(acq?.['proposed_price_received'] ?? "").slice(0, 10),
                                     },
                                     { onSuccess: () => setPriceDraft(null) },
                                   )
                                 }
                                 className="rounded-lg border border-input px-3 py-1.5 text-[13px] text-primary disabled:opacity-60"
                               >
                                 {setProposedPrice.isPending ? "Saving" : "Save the price"}
                               </button>
                             </span>
                           ) : null}
                           <span className="block w-full">
                              <span className="flex flex-wrap items-center gap-2">
                                <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(state))} label={state === false ? "Why?" : "Why this row"} />
                                <span className="mc-seq-nova"><Nova acquisitionId={acquisitionId} rowLabel={`document row · ${d.label}`} /></span>
                              </span>
                           </span>

                         </>
                       ) : d.attachOnly ? (
                         <>
                           <StatusMark
                             color={attached ? "var(--ontrack)" : "var(--atrisk)"}
                             className="text-[13px]"
                           >
                            {attached ? "Attached" : `Needs ${d.label}`}
                           </StatusMark>
                           {attached ? (
                             <button
                               type="button"
                               onClick={() => void openAttachment(attached)}
                               className="text-[13px] text-primary"
                             >
                               {attached.file_name}
                             </button>
                           ) : null}
                           {canWrite ? (
                             attached ? (
                               <button
                                 type="button"
                                 disabled={busy}
                                 onClick={() => showActionDialog({ kind: "remove", doc: d })}
                                 className="text-[13px] text-primary disabled:opacity-60"
                               >
                                 Remove the external copy
                               </button>
                             ) : (
                               <label className="cursor-pointer text-[13px] text-primary">
                                 {busy
                                   ? "Attaching"
                                   : d.handoff
                                     ? "Attach the signed copy"
                                     : "Template planned; attach an external copy"}
                                 <input
                                   type="file"
                                   className="sr-only"
                                   accept={ATTACHMENT_ACCEPT}
                                   disabled={busy}
                                   onChange={(event) => {
                                     const file = event.target.files?.[0];
                                     if (file) attachDoc.mutate({ doc: d, file });
                                     event.target.value = "";
                                   }}
                                 />
                               </label>
                             )
                           ) : null}
                           {d.note ? (
                             <span className="block w-full text-[13px] text-muted-foreground">{d.note}</span>
                           ) : null}
                           <span className="block w-full">
                              <span className="flex flex-wrap items-center gap-2">
                                <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(attached))} label={attached ? "Why this row" : "Why?"} />
                                <span className="mc-seq-nova"><Nova acquisitionId={acquisitionId} rowLabel={`document row · ${d.label}`} /></span>
                              </span>
                           </span>

                         </>
                       ) : state === null ? (
                        d.link === "packet" ? (
                          <span className="block">
                            <button type="button" onClick={downloadPacket} className="text-[13px] text-primary">
                              Download the handoff packet
                            </button>
                            <span className="block text-[13px] text-muted-foreground">
                              Downloads a local file. Writing the record into NCMS is planned and not available
                              in this prototype.
                            </span>
                          </span>
                        ) : d.link === "checks" ? (
                          <Link to="/checks" className="text-[13px] text-primary">
                            Open Checks
                          </Link>
                        ) : d.link === "form" && d.formKey ? (
                          <Link
                            to="/forms/$formKey/$acquisitionId"
                            params={{ formKey: d.formKey, acquisitionId }}
                            className="text-[13px] text-primary"
                          >
                            Open the form for this file
                          </Link>
                        ) : d.link === "templates" ? (
                          d.templateKey ? (
                            <Link
                              to="/documents/$templateKey/$acquisitionId"
                              params={{ templateKey: d.templateKey, acquisitionId }}
                              className="text-[13px] text-primary"
                            >
                              Open the document for this file
                            </Link>
                          ) : (
                            <Link to="/templates" className="text-[13px] text-primary">
                              Open the template
                            </Link>
                          )
                        ) : null
                      ) : (
                        <>
                          <StatusMark
                            color={state ? "var(--ontrack)" : "var(--atrisk)"}
                            className="text-[13px]"
                          >
                            {state ? "Attached" : `Needs ${d.label}`}
                          </StatusMark>

                          {attached ? (
                            <button
                              type="button"
                              onClick={() => void openAttachment(attached)}
                              className="text-[13px] text-primary"
                            >
                              {attached.file_name}
                            </button>
                          ) : null}

                          {canWrite ? (
                            attached || state ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => showActionDialog({ kind: "remove", doc: d })}
                                className="text-[13px] text-primary disabled:opacity-60"
                              >
                                Remove
                              </button>
                            ) : (
                              <label className="cursor-pointer text-[13px] text-primary">
                                {busy ? "Attaching" : "Attach"}
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept={ATTACHMENT_ACCEPT}
                                  disabled={busy}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) attachDoc.mutate({ doc: d, file });
                                    event.target.value = "";
                                  }}
                                />
                              </label>
                            )
                          ) : null}
                          <span className="block w-full">
                            <span className="flex flex-wrap items-center gap-2">
                              <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(state))} label={state === false ? "Why?" : "Why this row"} />
                              <span className="mc-seq-nova"><Nova acquisitionId={acquisitionId} rowLabel={`document row · ${d.label}`} /></span>
                            </span>
                          </span>

                        </>
                      )}
                      {d.note ? (
                        <span className="block w-full text-[13px] text-muted-foreground">{d.note}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {p.phase === "Market Research" ? (
                <MarketResearchEngine
                  acquisitionId={acquisitionId}
                  canWrite={canWrite}
                  onConfirmed={() => void q.refetch()}
                />
              ) : null}

              {p.phase === "Price Reasonableness" ? (
                <p className="mt-3 max-w-[80ch] text-[13px]">
                  <Link
                    to="/documents/$templateKey/$acquisitionId"
                    params={{ templateKey: "pnm", acquisitionId }}
                    className="text-primary"
                  >
                    Open the price negotiation memorandum
                  </Link>
                  <span className="ml-2 text-muted-foreground">
                    RFO FAR 12.204(a) · where the price reasonableness finding is recorded
                  </span>
                </p>
              ) : null}

              {p.phase === "Responsibility Check" ? (
                <div className="mt-3 w-full [&_p]:max-w-[80ch] border border-border p-4">
                  <p className="text-[15px] font-medium">Finding</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="text-[13px]" htmlFor="responsibility-finding">
                      Contracting officer's responsibility finding
                    </label>
                    <select
                      id="responsibility-finding"
                      value={finding ?? ""}
                      disabled={!canWrite}
                      onChange={(e) => setFinding.mutate(e.target.value)}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                    >
                      <option value="">Not yet determined</option>
                      <option value="responsible">Responsible</option>
                      <option value="nonresponsibility">Nonresponsibility</option>
                    </select>
                  </div>
                  {finding === "responsible" ? (
                    <p className="mt-3 text-[13px] text-muted-foreground">
                      The contracting officer's signature on the SF 1449 is the affirmative responsibility
                      determination (RFO FAR 9.105-2(a)(1)). No memorandum is generated.
                    </p>
                  ) : finding === "nonresponsibility" ? (
                    <p className="mt-3 text-[13px]">
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "nonresponsibility", acquisitionId }}
                        className="text-primary"
                      >
                        Open the determination of nonresponsibility memorandum
                      </Link>
                      <span className="ml-2 text-muted-foreground">RFO FAR 9.105-2(a)(1)</span>
                    </p>
                  ) : (
                    <p className="mt-3 text-[13px] text-muted-foreground">
                      Record the finding once the SAM.gov check and the RFO FAR 9.104-1 factors have been reviewed.
                    </p>
                  )}
                </div>
              ) : null}


              {p.phase === "Price Reasonableness" && certifiedBasis.gapNote ? (
                <div className="mt-3 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">
                  <AdvisoryTag text="Informational. Never holds the file or blocks a phase exit." />
                  <p className="mt-1">{certifiedBasis.gapNote}</p>
                </div>
              ) : null}
              {p.phase === packetPhase ? (
                // The packet runs many screens. It stays one click away under
                // the phase; Expand all, print, and every packet link open it.
                <details id="clause-packet" data-mission-nav-collapsible className="mc-packet">
                <summary className="mc-packet-summary">
                  <span>NCMS clause packet and handoff</span>
                  <span className="mc-packet-note" data-numeric>
                    {q.isLoading ? "Loading the clause list" : `${packetSelection.length} clauses`}
                  </span>
                </summary>
                <div className="mc-packet-body [&_p]:max-w-[80ch]">
                  <p className="text-[15px]">
                    NCMS is the system of record for the solicitation and the award. T-Minus hands over a packet.
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-[13px] text-muted-foreground">
                    {NCMS_CHECKLIST.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[13px] text-muted-foreground" data-numeric>
                    {q.isLoading
                      ? "Loading the clause list."
                      : `${packetSelection.length} clauses in the packet, selected from this record and read from the PCD 26-03B and NFS 1852 matrices.`}
                  </p>
                  {acq && (acquisitionProfile(acq) === "idiq_parent" || acquisitionProfile(acq) === "order_under_idiq") ? (
                    <p className="mt-2 max-w-[80ch] border border-border p-3 text-[13px] leading-[18px] text-muted-foreground">
                      {IDIQ_CLAUSE_DELTA_WITHHELD_NOTE}
                    </p>
                  ) : null}
                  {acq ? (
                    <ClausePicker
                      acquisitionId={acquisitionId}
                      recommended={packetClauses}
                      clauseRows={q.data?.clauses ?? []}
                      applied={appliedClauseNumbers}
                      actorName={actorName}
                      phase={p.phase}
                      facts={(acq as Record<string, unknown> | null) ?? null}
                      regionContext={`${p.phase} phase`}
                    />
                  ) : null}
                  {acq ? (
                    <SowClauseAssistPanel
                      acquisitionId={acquisitionId}
                      sowOnFile={keysFrom(attachments).has("sow_attached")}
                      facts={acq as Record<string, unknown>}
                      recommended={packetClauses}
                      canWrite={canWrite}
                      actor={actorName}
                      phase={p.phase}
                      onBanner={setBanner}
                      regionContext={`${p.phase} phase`}
                    />
                  ) : null}
                  {acq ? (
                    <Table12FillinsPanel
                      acquisitionId={acquisitionId}
                      facts={acq as Record<string, unknown>}
                      recommended={packetClauses}
                      canWrite={canWrite}
                      actor={actorName}
                      phase={p.phase}
                      onBanner={setBanner}
                      regionContext={`${p.phase} phase`}
                    />
                  ) : null}
                  {packetSelection.length > 0 ? (
                    <TableScrollRegion baseClassName="overflow-x-auto" label={`Packet clauses table, ${p.phase} phase`}>
<table className="mt-3 w-full text-[13px] leading-[18px]">
                      <caption className="sr-only">Clauses in the packet and why each is included</caption>
                      <thead>
                        <tr className="border-y border-border text-left">
                          <th scope="col" className="p-2">Clause</th>
                          <th scope="col" className="p-2">Title</th>
                          <th scope="col" className="p-2">Why it is included</th>
                          <th scope="col" className="p-2">Matrix status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packetSelection.map((c) => (
                          <tr key={c.clause_number} className="border-b border-border align-top">
                            <td className="p-2" data-numeric>{c.clause_number}</td>
                            <td className="p-2">{c.title}</td>
                            <td className="p-2">{c.reason}</td>
                            <td className="p-2 text-muted-foreground">{c.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
</TableScrollRegion>
                  ) : null}
                  <ClinSchedulePanel
                    acquisitionId={acquisitionId}
                    canWrite={canWrite}
                    actor={actorName}
                    onBanner={setBanner}
                    regionContext={`${p.phase} phase`}
                  />
                  <SolicitationKlmPanel
                    acquisitionId={acquisitionId}
                    shell={shell}
                    clauses={packetSelection}
                    simplifiedCommercial={Boolean(acq && isSimplifiedCommercial(acq as Record<string, unknown>))}
                    canWrite={canWrite}
                    actor={actorName}
                    onBanner={setBanner}
                    regionContext={`${p.phase} phase`}
                  />
                  <SebCockpitPanel
                    acquisitionId={acquisitionId}
                    shell={shell}
                    canWrite={canWrite}
                    actor={actorName}
                    onBanner={setBanner}
                    regionContext={`${p.phase} phase`}
                  />
                  <ReadReceiptsPanel acquisitionId={acquisitionId} regionContext={`${p.phase} phase`} />
                  <SectionJPanel attachments={attachments} mode={formatScaffold?.mode ?? "ucf"} regionContext={`${p.phase} phase`} />
                  <PaymentMilestonesPanel
                    acquisitionId={acquisitionId}
                    canWrite={canWrite}
                    actor={actorName}
                    onBanner={setBanner}
                    regionContext={`${p.phase} phase`}
                  />
                  <CdrlPanel
                    acquisitionId={acquisitionId}
                    canWrite={canWrite}
                    actor={actorName}
                    onBanner={setBanner}
                    facts={acq as unknown as Record<string, unknown> | null}
                    regionContext={`${p.phase} phase`}
                  />
                  <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
                    {formatScaffold?.lm?.chip ?? LM_STUB_CHIP}
                  </p>
                  <FormatScaffoldPanel scaffold={formatScaffold} regionContext={`${p.phase} phase`} />
                  <AwardHandoffPanel
                    scaffold={formatScaffold}
                    defaultOpen={p.phase === "Award"}
                    acquisitionId={acquisitionId}
                    suggestedForm={suggestedOfficialForm}
                    regionContext={`${p.phase} phase`}
                    assemblyCounts={
                      buildNf1098Assembly({
                        fileIndex,
                        scaffold: formatScaffold,
                        recommendedClauseCount: packetClauses.length,
                        appliedClauseCount: appliedClauseNumbers?.length ?? null,
                      }).counts
                    }
                  />
                  {acq ? (
                    <FpdsFillAidSummary
                      input={{
                        acq: acq as unknown as Record<string, unknown>,
                        awardDate: lifecycle?.awardDate ?? null,
                        isLaunched: readiness === "LAUNCHED",
                        centerName: (acq["center_name"] as string | null) ?? acq.center_code ?? null,
                      }}
                      onExport={() => fpdsExport.mutate()}
                      exporting={fpdsExport.isPending}
                    />
                  ) : null}
                  <Nf1098AssemblyPanel
                    acquisitionId={acquisitionId}
                    input={{
                      fileIndex,
                      scaffold: formatScaffold,
                      recommendedClauseCount: packetClauses.length,
                      appliedClauseCount: appliedClauseNumbers?.length ?? null,
                    }}
                    onExport={() => evidencePack.mutate()}
                    exporting={evidencePack.isPending}
                    regionContext={`${p.phase} phase`}
                  />
                  {p.phase === "Award" && awardFillins.length > 0 ? (
                    <div className="mc-pa-card mt-3">
                      <h5 className="mc-req-h">Fill-ins the award carries</h5>
                      <p className="mc-pa-sub">{CLAUSE_FILLIN_NOTE}</p>
                      <ul className="mc-pa-list mt-2">
                        {awardFillins.map((row) => (
                          <li key={row.clause_number}>
                            <span data-numeric>{row.clause_number}</span>{" "}
                            <span className="text-muted-foreground">{row.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <button type="button" onClick={downloadPacket} className="mc-pa-link mt-3">
                    Download the handoff packet
                  </button>
                </div>
                </details>
              ) : packetPhase && p.status === "complete" && PACKET_PHASES.includes(p.phase) ? (
                <p className="mc-pa-sub mt-3">
                  Clause packet: see{" "}
                  <a
                    href="#clause-packet"
                    onClick={(e) => {
                      e.preventDefault();
                      goToPacket();
                    }}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {packetPhase}
                  </a>
                  .
                </p>
              ) : null}

              {p.phase === "Administration" ? (
                <div className="mc-pa-stack mt-3 w-full">
                  <div className="mc-kpanel mc-pa">
                    <div className="mc-pa-card-head">
                      <h4 className="mc-kpanel-title">Option exercise</h4>
                      <StatusChip
                        label={pa.option_exercised_date ? `Exercised ${pa.option_exercised_date}` : options.periods.length === 0 ? "No option dates recorded" : "Not exercised"}
                        tone={pa.option_exercised_date ? "ontrack" : options.periods.length === 0 ? "neutral" : "attention"}
                      />
                    </div>
                    <p className="mc-pa-sub">
                      Option dates come only from the contract schedule on the record. The
                      preliminary notice is due {options.noticeLeadDays} days before the option period begins (FAR
                      52.217-9 fill-in).
                    </p>
                    <TableScrollRegion baseClassName="mc-dt-wrap mt-3" className="stack" label="Option periods table">
<table className="mc-dt stack">
                      <caption className="sr-only">Option periods and notice dates</caption>
                      <thead>
                        <tr>
                          <th scope="col">Period</th>
                          <th scope="col">Start</th>
                          <th scope="col">End</th>
                          <th scope="col">Preliminary notice due</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td data-label="Period">Base period</td>
                          <td data-label="Start" data-numeric>{options.baseStart ?? "not recorded"}</td>
                          <td data-label="End" data-numeric>{options.baseEnd ?? "not recorded"}</td>
                          <td data-label="Preliminary notice due"><EmptyCell>Not applicable</EmptyCell></td>
                        </tr>
                        {options.periods.map((o) => (
                          <tr key={o.label}>
                            <td data-label="Period">{o.label}</td>
                            <td data-label="Start" data-numeric>{o.start ?? "not recorded"}</td>
                            <td data-label="End" data-numeric>{o.end ?? "not recorded"}</td>
                            <td data-label="Preliminary notice due" data-numeric>{o.noticeDue ?? "not recorded"}</td>
                          </tr>
                        ))}
                        {options.periods.length === 0 ? (
                          <tr><td colSpan={4} className="text-muted-foreground">Option dates are not recorded in the contract schedule.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
</TableScrollRegion>

                    {(() => {
                      const noticeOn = pa.option_notice_date ?? pa.option_notice_sent ?? null;
                      const exercisedOn = pa.option_exercised_date ?? null;
                      const next = options.periods[0] ?? null;
                      const stateFor = (citation: string) => {
                        if (citation.startsWith("RFO FAR 17.204-1(b)(1)")) {
                          return noticeOn ? `Recorded ${noticeOn}` : "Open, not recorded";
                        }
                        if (citation.startsWith("RFO FAR 17.204-1(b)")) {
                          return exercisedOn ? `Recorded ${exercisedOn}` : "Open, not recorded";
                        }
                        return exercisedOn ? "Due with the modification" : "Open, not recorded";
                      };
                      return (
                        <>
                          <div className="mc-pa-h mt-4">
                            <h5 className="mc-req-h">What an option exercise carries</h5>
                            <AdvisoryTag />
                          </div>
                          <p className="mc-pa-sub">Checklist read from the record.</p>
                          <TableScrollRegion baseClassName="mc-dt-wrap mt-3" className="stack" label="Option checklist table">
<table className="mc-dt stack">
                            <caption className="sr-only">Option exercise checklist</caption>
                            <thead>
                              <tr>
                                <th scope="col">Step</th>
                                <th scope="col">Citation</th>
                                <th scope="col">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {optionExercise.rows.map((r) => (
                                <tr key={r.label}>
                                  <td data-label="Step">
                                    {r.templateKey ? (
                                      <Link
                                        to="/documents/$templateKey/$acquisitionId"
                                        params={{ templateKey: r.templateKey, acquisitionId }}
                                        className="mc-pa-link"
                                      >
                                        {r.label}
                                      </Link>
                                    ) : (
                                      r.label
                                    )}
                                  </td>
                                  <td data-label="Citation">{r.citation ? <CiteChip cite={r.citation} /> : <EmptyCell />}</td>
                                  <td data-label="Status">
                                    {(() => {
                                      const st = stateFor(r.citation);
                                      return (
                                        <StatusChip
                                          label={st}
                                          tone={st.startsWith("Recorded") ? "ontrack" : st.startsWith("Due") ? "info" : "attention"}
                                        />
                                      );
                                    })()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
</TableScrollRegion>
                          <p className="mc-pa-sub mt-2">
                            {next && next.start && next.end
                              ? `The option must be exercised within ${next.label}, ${next.start} to ${next.end}.`
                              : "No option period start and end are recorded, so the exercise window cannot be read from the file."}
                          </p>
                        </>
                      );
                    })()}


                    <div className="mc-pa-dates mt-3">
                      <label className="mc-pa-label" htmlFor="option-notice-date">
                        Preliminary notice sent on
                      </label>
                      <input
                        id="option-notice-date"
                        type="date"
                        value={pa.option_notice_date ?? ""}
                        disabled={!canWrite}
                        onChange={(e) =>
                          savePostAward.mutate({
                            patch: { option_notice_date: e.target.value },
                            action: "Option preliminary notice recorded",
                            field: "option_notice_date",
                            reason: "RFO FAR 17.204-1(b)(1) preliminary notification to the contractor",
                            phase: "Administration",
                          })
                        }
                        className="mc-pa-input"
                        data-numeric
                      />
                      <label className="mc-pa-label" htmlFor="option-exercised-date">
                        Option exercised on
                      </label>
                      <input
                        id="option-exercised-date"
                        type="date"
                        value={pa.option_exercised_date ?? ""}
                        disabled={!canWrite}
                        onChange={(e) =>
                          savePostAward.mutate({
                            patch: { option_exercised_date: e.target.value },
                            action: "Option exercised",
                            field: "option_exercised_date",
                            reason: "RFO FAR 17.204-1(b) determination signed and the option exercised",
                            phase: "Administration",
                          })
                        }
                        className="mc-pa-input"
                        data-numeric
                      />
                    </div>

                    <p className="mc-pa-text mt-3">
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "option-exercise-notification", acquisitionId }}
                        className="mc-pa-link"
                      >
                        Open the preliminary notice
                      </Link>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "option-exercise-determination", acquisitionId }}
                        className="mc-pa-link"
                      >
                        Open the option exercise determination
                      </Link>
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        downloadModPacket("option exercise", optionExercise.authority, options.periods[0] ?? null)
                      }
                      className="mc-pa-link mt-3"
                    >
                      Download the SF 30 handoff packet for the option modification
                    </button>
                    <p className="mc-pa-sub mt-2">
                      SF 30 block 13 authority: {optionExercise.authority}. The signed modification is
                      built and signed in NCMS (NFS CG 1804.11(b)); T-Minus produces the handoff packet only.
                    </p>
                    <p className="mc-pa-sub mt-2">
                      To draft the modification itself, open Modifications on this file, choose New
                      modification, and pick Option exercise.
                    </p>
                  </div>

                  <div className="mc-kpanel mc-pa">
                    <h4 className="mc-kpanel-title">Contracting officer's representative</h4>
                    <div className="mc-pa-dates mt-2">
                      <label className="mc-pa-label" htmlFor="cor-appointed-date">
                        Appointed on
                      </label>
                      <input
                        id="cor-appointed-date"
                        type="date"
                        value={pa.cor_appointed_date ?? ""}
                        disabled={!canWrite}
                        onChange={(e) =>
                          savePostAward.mutate({
                            patch: { cor_appointed_date: e.target.value },
                            action: "COR appointment recorded",
                            field: "cor_appointed_date",
                            reason: "RFO FAR 1.404(a) written appointment",
                            phase: "Administration",
                          })
                        }
                        className="mc-pa-input"
                        data-numeric
                      />
                      <label className="mc-pa-label" htmlFor="cor-cancelled-date">
                        Cancelled on
                      </label>
                      <input
                        id="cor-cancelled-date"
                        type="date"
                        value={pa.cor_cancelled_date ?? ""}
                        disabled={!canWrite}
                        onChange={(e) =>
                          savePostAward.mutate({
                            patch: { cor_cancelled_date: e.target.value },
                            action: "COR appointment cancelled",
                            field: "cor_cancelled_date",
                            reason: "RFO FAR 1.404(a) appointment cancelled",
                            phase: "Administration",
                          })
                        }
                        className="mc-pa-input"
                        data-numeric
                      />
                    </div>
                    <p className="mc-pa-text mt-3">
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "cor-appointment", acquisitionId }}
                        className="mc-pa-link"
                      >
                        Open the appointment letter
                      </Link>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "cor-cancellation", acquisitionId }}
                        className="mc-pa-link"
                      >
                        Open the cancellation memorandum
                      </Link>
                      <span className="ml-2 text-muted-foreground">NF 1098 tab 074 · RFO FAR 1.404(a)</span>
                    </p>
                  </div>

                  <div className="mc-kpanel mc-pa">
                    <div className="mc-pa-card-head">
                      <h4 className="mc-kpanel-title">CPARS input</h4>
                      <StatusChip
                        label={pa.cpars_submitted_date ? "Entered" : cpars.applies ? "Required" : cpars.thresholdValue === null ? "Not determined" : "Not required"}
                        tone={pa.cpars_submitted_date ? "ontrack" : cpars.applies ? "attention" : "neutral"}
                      />
                    </div>
                    <p className="mc-pa-sub">
                      {cpars.thresholdValue === null
                        ? "No CPARS threshold row is loaded."
                        : cpars.applies
                          ? `Required: the value is above ${formatMoney(cpars.thresholdValue)}.`
                          : `Not required: the value is at or below ${formatMoney(cpars.thresholdValue)}.`}{" "}
                      {cpars.citation ?? ""}
                    </p>
                    {cpars.applies ? (
                      <p className="mc-pa-text mt-2" data-numeric>
                        Evaluation period {awardDate ?? "not recorded"} to {cpars.periodEnd ?? "not recorded"}; input due{" "}
                        {cpars.dueDate ?? "not recorded"} (120 days after the period ends).
                      </p>
                    ) : null}
                    <div className="mc-pa-dates mt-3">
                      <label className="mc-pa-label" htmlFor="cpars-submitted">
                        Entered in CPARS on
                      </label>
                      <input
                        id="cpars-submitted"
                        type="date"
                        value={pa.cpars_submitted_date ?? ""}
                        disabled={!canWrite}
                        onChange={(e) =>
                          savePostAward.mutate({
                            patch: { cpars_submitted_date: e.target.value },
                            action: "CPARS input entered",
                            field: "cpars_submitted_date",
                            reason: cpars.citation ?? "RFO FAR Part 42",
                            phase: "Administration",
                          })
                        }
                        className="mc-pa-input"
                        data-numeric
                      />
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "cpars-input", acquisitionId }}
                        className="mc-pa-link"
                      >
                        Open the CPARS input form
                      </Link>
                    </div>
                  </div>

                  {/* A clause delta only exists once there is a contract to modify. */}
                  {!String(acq?.["contract_number"] ?? "").trim() ? (
                    <div className="mc-kpanel mc-pa">
                      <h4 className="mc-kpanel-title">SF 30 modifications</h4>
                      <p className="mc-pa-sub">
                        No contract number is recorded on this file yet. The clause delta appears after award, when
                        there is a contract to modify. Until then, clause changes are re-checked against the
                        solicitation.
                      </p>
                    </div>
                  ) : (
                  <div className="mc-kpanel mc-pa">
                    <h4 className="mc-kpanel-title">SF 30 modifications</h4>
                    <p className="mc-pa-sub">
                      The modification of record is written in NCMS (NFS CG 1804.11(b)). The clause set is read from the
                      clause matrices; removed clauses are struck and never carried forward.
                    </p>
                    {clauseDeltaWithheld ? (
                      <p className="mc-pa-callout is-info mt-2">
                        {IDIQ_CLAUSE_DELTA_WITHHELD_NOTE}
                      </p>
                    ) : (
                      <>
                        <p className="mc-pa-text mt-2" data-numeric>
                          {delta.updated.length} updated · {delta.removed.length} removed ·{" "}
                          {delta.unchanged.length} unchanged
                        </p>
                        <TableScrollRegion baseClassName="mc-dt-wrap mt-3" label="Clause delta table">
<table className="mc-dt">
                          <caption className="sr-only">Clause delta for the modification</caption>
                          <thead>
                            <tr>
                              <th scope="col">Clause</th>
                              <th scope="col">Change</th>
                              <th scope="col">Recorded status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ...delta.removed.map((c) => ({ c, change: "Removed" })),
                              ...delta.updated.map((c) => ({ c, change: "Updated" })),
                            ].map(({ c, change }) => (
                              <tr key={`${change}-${c.clause_number}`}>
                                <td data-numeric>{c.clause_number}</td>
                                <td>
                                  <StatusMark
                                    color={change === "Removed" ? "var(--atrisk)" : "var(--attention)"}
                                    className="text-[13px]"
                                  >
                                    {change}
                                  </StatusMark>
                                </td>
                                <td className="text-muted-foreground">{c.status ?? <EmptyCell />}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
</TableScrollRegion>
                        {modFillIns.length > 0 ? (
                          <div className="mc-pa-card mt-3">
                            <h5 className="mc-req-h">Fill-ins on the updated clauses</h5>
                            <ul className="mc-pa-list mt-2">
                              {modFillIns.map((row) => (
                                <li key={row.clause_number}>
                                  <span data-numeric>{row.clause_number}</span>{" "}
                                  <span className="text-muted-foreground">{row.fills}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    )}
                    <ul className="mc-pa-list is-meta mt-3">
                      {SF30_CHECKLIST.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => downloadModPacket("administrative", "RFO FAR 43.203(b); RFO FAR 43.401", null)}
                      className="mc-pa-link mt-3"
                    >
                      Download the SF 30 handoff packet
                    </button>
                  </div>
                  )}
                </div>
              ) : null}

              {p.phase === "Closeout" ? (
                <div className="mc-kpanel mc-pa mt-3 w-full">
                  <h4 className="mc-kpanel-title">Closeout</h4>
                  <div className="mc-pa-dates mt-3">
                    <label className="mc-pa-label" htmlFor="closeout-pr">
                      NASA closeout requisition (PR) number
                    </label>
                    <input
                      id="closeout-pr"
                      type="text"
                      defaultValue={pa.closeout_pr_number ?? ""}
                      disabled={!canWrite}
                      onBlur={(e) =>
                        e.target.value !== (pa.closeout_pr_number ?? "") &&
                        savePostAward.mutate({
                          patch: { closeout_pr_number: e.target.value },
                          action: "Closeout requisition recorded",
                          field: "closeout_pr_number",
                          reason: "NASA closeout PR recorded for the contract file",
                          phase: "Closeout",
                        })
                      }
                      className="mc-pa-input"
                      data-numeric
                    />
                    <label className="mc-pa-label" htmlFor="final-payment">
                      Final payment made on
                    </label>
                    <input
                      id="final-payment"
                      type="date"
                      value={pa.final_payment_date ?? ""}
                      disabled={!canWrite}
                      onChange={(e) =>
                        savePostAward.mutate({
                          patch: { final_payment_date: e.target.value },
                          action: "Final payment recorded",
                          field: "final_payment_date",
                          reason: "Records retention runs from final payment (RFO FAR 4.309)",
                          phase: "Closeout",
                        })
                      }
                      className="mc-pa-input"
                      data-numeric
                    />
                  </div>

                  <p className="mc-pa-text mt-3">
                    {retention.years === null ? (
                      "No retention period is loaded."
                    ) : retention.fromLabel === "final payment" && retention.date ? (
                      <>
                        Records are kept for <span data-numeric>{retention.years} years</span> after final payment. The retention date is <span data-numeric>{retention.date}</span>.{" "}
                        <CiteChip cite="RFO FAR 4.309" />
                      </>
                    ) : (
                      <>
                        Records are kept for <span data-numeric>{retention.years} years</span> after final payment. Final payment is not recorded, so the retention date is not computed.{" "}
                        <CiteChip cite="RFO FAR 4.309" />
                      </>
                    )}
                  </p>

                  <h5 className="mc-req-h mt-4">Closeout Transfer Checklist</h5>
                  <ul className="mc-pa-list is-meta mt-2">
                    {CLOSEOUT_CHECKLIST.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mc-pa-text mt-3">
                    <Link
                      to="/documents/$templateKey/$acquisitionId"
                      params={{ templateKey: "closeout-checklist", acquisitionId }}
                      className="mc-pa-link"
                    >
                      Open the Closeout Transfer Checklist
                    </Link>
                    <span className="ml-2 text-muted-foreground">HQ 06/2026 · RFO FAR 4.308-1; RFO FAR 4.309</span>
                  </p>
                </div>
              ) : null}


              {p.phase === "Award" && protestDeadlines.length ? (
                <div className="mc-kpanel mc-pa mt-3 w-full">
                  <h4 className="mc-kpanel-title">Protest window</h4>
                  <p className="mc-pa-sub">
                    Counted from the award date{" "}
                    <span data-numeric>{awardDate ?? "not recorded"}</span>
                    {debriefingDate ? (
                      <>
                        {" "}
                        and the debriefing held <span data-numeric>{debriefingDate}</span>
                      </>
                    ) : null}
                    . The day counts come from the thresholds table.
                  </p>

                  <div className="mc-pa-dates mt-3">
                    <label className="mc-pa-label" htmlFor="debriefing-date">
                      Debriefing date
                    </label>
                    <input
                      id="debriefing-date"
                      type="date"
                      value={debriefingDate ?? ""}
                      disabled={!canWrite}
                      onChange={(e) => setDebriefing.mutate(e.target.value)}
                      className="mc-pa-input"
                      data-numeric
                    />
                    {debriefingDate && canWrite ? (
                      <button
                        type="button"
                        onClick={() => setDebriefing.mutate("")}
                        className="mc-pa-link"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="mc-req-meta">
                        Leave blank if no debriefing was required.
                      </span>
                    )}
                  </div>

                  <TableScrollRegion baseClassName="mc-dt-wrap mt-3" label="Protest deadlines table">
<table className="mc-dt">
                    <caption className="sr-only">Protest deadlines for this award</caption>
                    <thead>
                      <tr>
                        <th scope="col">Deadline</th>
                        <th scope="col">Date</th>
                        <th scope="col">Days</th>
                        <th scope="col">Measured from</th>
                        <th scope="col">Citation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {protestDeadlines.map((d) => (
                        <tr key={d.key}>
                          <td>{d.label}</td>
                          <td data-numeric>
                            {d.date ?? <EmptyCell />}
                          </td>
                          <td data-numeric>
                            {d.days === null ? <EmptyCell /> : `${d.days} days`}
                            {d.daysRemaining === null ? (
                              ""
                            ) : (
                              <span className="block text-muted-foreground">
                                {d.daysRemaining >= 0
                                  ? `${d.daysRemaining} days remaining`
                                  : `closed ${Math.abs(d.daysRemaining)} days ago`}
                              </span>
                            )}
                          </td>
                          <td className="text-muted-foreground">{d.measuredFrom}</td>
                          <td className="text-muted-foreground">
                            {d.citation ?? <EmptyCell />}
                            {d.note ? <span className="block">{d.note}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
</TableScrollRegion>

                  <p className="mc-pa-text mt-3">
                    <Link to="/watch" search={{ tag: "Bid protest" }} className="mc-pa-link">
                      Open the Watch items for protests
                    </Link>
                  </p>
                </div>
              ) : null}


              {effectiveState !== "launched" && (REVIEW_PHASES as readonly string[]).includes(p.phase) ? (
                <div id={`poll-${p.phase}`} className="mc-review-board">
                  <p className="mc-review-board-cap">
                    Required reviews, concurrences and approvals for {phaseLabel(p)}. Each reviewer records a formal decision by name.
                  </p>
                  {(boards[p.phase] ?? []).length ? (
                    <div className="mc-review-grid">
                      {(boards[p.phase] ?? []).map((b) => (
                        <ReviewCard
                          key={`${b.phase}-${b.reviewer_role}`}
                          entry={b}
                          launched={effectiveState === "launched"}
                          explain={<ExplainThis explanation={explainReview(b, acq as AcqRow)} />}
                          action={
                            canWrite && b.poll_id ? (
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={() => showActionDialog({ kind: "vote", entry: b })}
                                className="h-auto p-0"
                              >
                                Record decision
                              </Button>
                            ) : null
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mc-review-board-empty">No review is triggered for this acquisition at this phase.</p>
                  )}
                  {canWrite && (boards[p.phase] ?? []).some((b) => !b.poll_id) ? (
                    <div className="mc-review-board-foot">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => showActionDialog({ kind: "open-poll", phase: p.phase })}
                        className="h-auto p-0"
                      >
                        Send the review requests for {phaseLabel(p)}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        </div>
      </details>

      <div className="mc-file-footnote">
        <PilotKnownGapsLine />
        <p>Panels marked Advisory never hold the file or block a phase exit.</p>
      </div>

      {/* Lower half in tabs. Every section stays mounted; a hidden tab only
          hides it. Jumps, rail links and hash links open the tab first. */}
      <div className="mc-file-tabs" id="file-tabs">
        <FadeStrip role="tablist" aria-label="Sections of this file" className="mc-tabs no-print" onKeyDown={onFileTabKey}>
          {FILE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`file-tab-${t.key}`}
              aria-controls={`file-panel-${t.key}`}
              aria-selected={fileTab === t.key}
              tabIndex={fileTab === t.key ? 0 : -1}
              className="mc-tab"
              onClick={() => {
                flushSync(() => setFileTab(t.key));
                // The "On this file" highlight moves to the tab's first section.
                window.dispatchEvent(new CustomEvent(MISSION_NAV_CURRENT, { detail: { id: `file-panel-${t.key}` } }));
              }}
            >
              <span>{t.label}</span>
              {fileTabBadges[t.key] ? <span className="mc-tab-badge">{fileTabBadges[t.key]}</span> : null}
            </button>
          ))}
        </FadeStrip>
        <div
          role="tabpanel"
          id="file-panel-overview"
          aria-labelledby="file-tab-overview"
          data-file-tab-panel="overview"
          hidden={fileTab !== "overview"}
          className="mc-tab-panel"
        >
      <SinceLastLookPanel since={lastLook.since} ready={lastLook.ready} changes={sinceChanges} />
      <FileSelfCheckPanel acquisitionId={acquisitionId} findings={selfCheck} />
      <MissionNavSection id="schedule-forecast" label="Schedule & forecast">
      {!successor && effectiveState === "launched" ? (
        <section aria-label="Successor clock" className="mb-10 w-full [&_p]:max-w-[70ch] border-t border-border pt-4">
          <h2 className="section-title text-[18px] leading-6 font-medium">Successor clock</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            This file has no period of performance end recorded, so the date its successor must start
            cannot be computed. Record the end date to start the successor clock.
          </p>
          <label className="mt-3 block text-[13px]" htmlFor="pop-end">
            Period of performance end
          </label>
          <input
            id="pop-end"
            type="date"
            className="mt-1 h-9 rounded-lg border border-border bg-background px-2 text-[13px]"
            defaultValue=""
            disabled={!canWrite}
            onChange={(e) => setPopEnd.mutate(e.target.value)}
          />
        </section>
      ) : null}

      {successor ? (
        <section aria-label="Successor clock" className="mb-10 w-full [&_p]:max-w-[70ch] border-t border-border pt-4">
          <h2 className="section-title text-[18px] leading-6 font-medium">Successor clock</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Period of performance ends {formatDate(String(acq?.period_of_performance_end))}, less{" "}
            {successor.plannedDays} planned pre-award days plus a 30-day transition allowance.
          </p>
          <p className="mt-3 text-[28px] leading-[34px] font-semibold" data-numeric>
            {formatDate(successor.startBy)}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">The successor acquisition must start by this date</p>
          <p className="mt-3 text-[13px]">
            {successor.successorId ? (
              <>
                Successor file{" "}
                <Link
                  to="/files/$acquisitionId"
                  params={{ acquisitionId: successor.successorId }}
                  className="text-primary underline"
                >
                  {successor.successorId}
                </Link>{" "}
                is linked to this one.
              </>
            ) : successor.overdue ? (
              <StatusMark color="var(--atrisk)" className="text-[13px] leading-[18px]">
                {`Successor overdue by ${Math.abs(successor.daysUntilStart)} days; no successor file is linked`}
              </StatusMark>
            ) : (
              `No successor file is linked yet; ${successor.daysUntilStart} days until it must start.`
            )}
          </p>
          {effectiveState === "launched" && !successor.successorId ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              This file is in Administration. The follow-on acquisition must start by {formatDate(successor.startBy)} so
              it can be awarded before the period of performance ends. Start it from Intake and link it as the
              successor of this file.
            </p>
          ) : null}
          <p className="mt-2 text-[13px] text-muted-foreground">
            Advisory only: the successor clock never places a hold, changes the phase, or creates a file on its own.
          </p>
        </section>
      ) : null}

      <details aria-label="Acquisition Forecast" className="mb-8 w-full [&_p]:max-w-[80ch] rounded-xl border border-border bg-background">
        <summary className="cursor-pointer px-5 py-4 text-[18px] font-medium leading-[24px]">Acquisition Forecast</summary>
        <div className="border-t border-border px-5 py-4">
        <p className="mb-3 text-[13px] text-muted-foreground">
          {FORECAST_CITATION} · binding
          {sat ? ` · simplified acquisition threshold ${formatMoney(sat.value)} (${sat.citation})` : ""}
        </p>
        {q.isLoading ? (
          <LoadingNote what="the forecast facts" />
        ) : forecast ? (
          <>
            <TableScrollRegion baseClassName="overflow-x-auto" label="Forecast entry table">
<table className="w-full border border-border text-[13px] leading-[18px]">
              <caption className="sr-only">Acquisition Forecast entry for this file</caption>
              <tbody>
                {FORECAST_FIELDS.map((f) => (
                  <tr key={f.key} className="border-b border-border last:border-b-0">
                    <th scope="row" className="w-[42%] px-3 py-2 text-left font-medium">
                      {f.header}
                    </th>
                    <td className="px-3 py-2">
                      {forecast[f.key]}
                      {f.key === "anticipated_award_date" && forecast[f.key] === ANTICIPATED_AWARD_TBD ? (
                        <span className="mt-1 block text-muted-foreground">
                          {ANTICIPATED_AWARD_TBD_NOTE}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</TableScrollRegion>
            <p className="mt-2 text-[15px] leading-[22px]">
              {acq?.acquisition_forecast_verified
                ? "The entry exists, so the NF 1707 forecast affirmation is satisfied."
                : "The entry exists. The NF 1707 affirmation is marked satisfied by a specialist or HQ."}
            </p>
            <button
              type="button"
              onClick={exportForecastCsv}
              className="mt-3 rounded-lg border border-border px-3 py-2 text-[13px]"
            >
              Export forecast entry to CSV
            </button>
          </>
        ) : (
          <p className="text-[15px] leading-[22px]">
            This acquisition is at or below the simplified acquisition threshold, so it has no forecast
            entry.
          </p>
        )}
        </div>
      </details>

      {phaseNames.length ? (
        <RegulationSidebar phase={sidebarPhase} phases={phaseNames} onPhaseChange={setRegPhase} compact={coldPathSample} />
      ) : null}

      {intakeEstimate ? (
        <section aria-label="Estimate at intake" className="mb-10 w-full [&_p]:max-w-[70ch]">
          <h2 className="mb-2 text-[18px] font-medium leading-[24px]">Estimate at intake</h2>
          {/* Calendar days from the phase plan, the same source as the file
              timeline. The stored sentence's months figure is not shown. */}
          <p className="text-[15px] leading-[22px]">
            {Number.isFinite(Number(intakeEstimate.planned_days_to_award)) && Number(intakeEstimate.planned_days_to_award) > 0
              ? `At intake the phase plan put award ${Number(intakeEstimate.planned_days_to_award).toLocaleString("en-US")} calendar days out, through ${(intakeEstimate.phases ?? []).length} phases, with about ${Number(intakeEstimate.hours_total ?? 0).toLocaleString("en-US")} hours of contracting work.`
              : `At intake the estimate was about ${Number(intakeEstimate.hours_total ?? 0).toLocaleString("en-US")} hours of contracting work, through ${(intakeEstimate.phases ?? []).length} phases.`}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Contracting officer {intakeEstimate.hours_co.toLocaleString("en-US")} hours · specialist{" "}
            {intakeEstimate.hours_cs.toLocaleString("en-US")} hours · recorded{" "}
            {intakeEstimate.estimated_at.slice(0, 10)}
          </p>
        </section>
      ) : null}

      {lifecycle && lifecycle.upcomingReviews.length > 0 ? (
        <section aria-labelledby="upcoming-reviews" className="mb-8 w-full [&_p]:max-w-[80ch] border-t border-border pt-4">
          <h2 id="upcoming-reviews" className="text-[18px] leading-6 font-medium">Upcoming reviews</h2>
          <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
            {lifecycle.upcomingReviews.map((review) => (
              <li key={`${review.phase}-${review.reviewer_role}`}>{review.phase} · {review.reviewer_role} · {review.reviewer_name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <DeadlinesPanel
        acq={acq as Record<string, unknown> | null}
        awardDate={awardDate}
        debriefingDate={debriefingDate}
        thresholds={(q.data?.thresholds ?? []) as never}
        noticePostedDate={null}
        quoteDueDate={(acq?.['proposed_price_received'] as string | null | undefined) ?? null}
      />
      </MissionNavSection>

      <MissionNavSection id="coordination" label="Coordination" collapsible summary="Requests and offices on this file">
      {acq ? (
        <CorToRequestPanel
          acq={acq as unknown as Record<string, unknown>}
          profile={acquisitionProfile(acq)}
          actorName={actorName}
          canWrite={canWrite}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] })}
        />
      ) : null}

      {acq && canWrite ? (
        <EmailDraftsPanel
          drafts={buildEmailDrafts({
            acq: acq as unknown as Record<string, unknown>,
            coName: String(acq.co_name ?? actorName),
            phase: lifecycle?.currentPhase ? stepLabel(lifecycle.currentPhase, acq as AcqRow) : "the current phase",
            citation: currentPhase?.citation ?? "",
            missingLabels: missingCurrentRequirements.map((d) => ({ label: d.label, citation: d.citation })),
            pendingReviewers: pendingCurrentReviews.map((e) => ({
              role: e.reviewer_role,
              name: e.reviewer_name,
              due: e.due_date,
            })),
            vendorOutcome:
              acq.clock_state === "launched" && acq.vendor_legal_name
                ? { vendor: String(acq.vendor_legal_name), successful: true }
                : null,
          })}
          onCopied={(label) => setBanner(`${label} copied. Paste it into your mail client; T-Minus sends no mail.`)}
        />
      ) : null}

      {acq ? (
        <WhatIfPanel
          acq={acq}
          plan={(q.data?.plan ?? []) as never}
          thresholds={(q.data?.thresholds ?? []) as never}
          clauseRows={q.data?.clauses ?? []}
        />
      ) : null}

      {warrant ? (
        <details aria-label="Warrant check" className="mb-8 w-full [&_p]:max-w-[80ch] rounded-xl border border-border bg-background">
          <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">Warrant check</summary>
          <div className="border-t border-border px-5 py-4">
          {warrant.exceeds ? (
            <p
              className="border-l-2 py-1 pl-3 text-[15px] leading-[22px]"
              style={{ borderColor: "var(--at-risk)" }}
            >
              <span style={{ color: "var(--at-risk)" }}>Red flag:</span> the IGCE{" "}
              <span data-numeric>{formatMoney(warrant.value)}</span> exceeds the warrant of{" "}
              {warrant.coName}, <span data-numeric>{formatMoney(warrant.limit as number)}</span>. A
              contracting officer with a warrant at or above the value has to sign the award.
            </p>
          ) : null}
          {warrant.exceeds ? (
            <div className="mt-2">
              <ExplainThis
                explanation={explainWarrant({
                  coName: warrant.coName,
                  value: warrant.value,
                  limit: warrant.limit as number,
                })}
              />
            </div>
          ) : warrant.unknown ? (
            <p className="text-[15px] leading-[22px] text-muted-foreground">
              No warrant limit is recorded for {warrant.coName}, so the IGCE of{" "}
              <span data-numeric>{formatMoney(warrant.value)}</span> cannot be checked against a
              warrant.
            </p>
          ) : (
            <p className="text-[15px] leading-[22px] text-muted-foreground">
              Within warrant: the IGCE{" "}
              <span data-numeric>{formatMoney(warrant.value)}</span> is at or below the warrant of{" "}
              {warrant.coName}, <span data-numeric>{formatMoney(warrant.limit as number)}</span>.
            </p>
          )}
          </div>
        </details>
      ) : null}
      </MissionNavSection>

      <MissionNavSection id="alerts-determinations" label="Alerts & determinations">
      <PcdAdoptionPanel
        baselineDate={(acq?.regulatory_baseline_date as string | null | undefined) ?? null}
        deviations={deviationsQ.data ?? []}
      />

      <BlackoutNoticePanel acq={acq as Record<string, unknown> | null} onBanner={setBanner} />

      <DraftRfpAlertPanel acq={acq as Record<string, unknown> | null} />

      <EnterprisePslPanel acq={acq as Record<string, unknown> | null} />

      <ThresholdConflictsPanel />



      <DeterminationHelpersPanel acq={acq as Record<string, unknown> | null} acquisitionId={acquisitionId} />

      <OfficeInvitePanel
        acquisitionId={acquisitionId}
        acq={acq as Record<string, unknown> | null}
        onBanner={setBanner}
      />

      <DocumentVersionsPanel acquisitionId={acquisitionId} />

      {acq && isSimplifiedCommercial(acq as Record<string, unknown>) ? (
        <section aria-label="Reserved clause note" className="mb-12 w-full [&_p]:max-w-[80ch] border border-border p-4">
          <p className="text-[15px] leading-[22px]">
            <span className="font-medium">RFO FAR 52.212-5 is Reserved on this commercial file.</span>{" "}
            {RFO_RESERVED_212_NOTE}
          </p>
        </section>
      ) : null}
      </MissionNavSection>
        </div>
        <div
          role="tabpanel"
          id="file-panel-reviews"
          aria-labelledby="file-tab-reviews"
          data-file-tab-panel="reviews"
          hidden={fileTab !== "reviews"}
          className="mc-tab-panel"
        >
      <MissionNavSection id="reviews-approvals" label="Reviews and approvals">
      <section className="mc-tab-section" aria-labelledby="reviews-approvals-title">
        <h2 id="reviews-approvals-title" className="mc-tab-section-title">Reviews and approvals</h2>
        <p className="mc-tab-section-lead">{PHASE_EXIT_RULE}</p>
        {effectiveState === "launched" ? (
          <p className="mc-tab-section-lead">This file is launched. The decisions below are the record as it stands.</p>
        ) : null}
        {reviewPhases.length ? (
          reviewPhases.map((p) => (
            <div key={p.phase} className="mc-review-group">
              <div className="mc-review-group-head">
                <h3>
                  Phase {phases.indexOf(p) + 1}: {phaseLabel(p)}
                </h3>
                <StatusChip
                  label={openRequiredByPhase.get(p.phase)?.length ? "Not complete · required item open" : p.status === "complete" ? "Complete" : p.status === "current" ? "In work" : "Not started"}
                  tone={openRequiredByPhase.get(p.phase)?.length ? "attention" : p.status === "complete" ? "ontrack" : p.status === "current" ? "info" : "neutral"}
                />
              </div>
              <div className="mc-review-grid">
                {(boards[p.phase] ?? []).map((b) => (
                  <ReviewCard
                    key={`${b.phase}-${b.reviewer_role}`}
                    entry={b}
                    showOverdue={effectiveState !== "launched"}
                    launched={effectiveState === "launched"}
                    explain={<ExplainThis explanation={explainReview(b, acq as AcqRow)} />}
                    action={
                      canWrite && b.poll_id && effectiveState !== "launched" ? (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => showActionDialog({ kind: "vote", entry: b })}
                          className="h-auto p-0"
                        >
                          Record decision
                        </Button>
                      ) : null
                    }
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="mc-tab-section-lead">No review is triggered for this acquisition yet.</p>
        )}
      </section>
      </MissionNavSection>

      <MissionNavSection id="companion-gates" label="Companion gates" collapsible defaultOpen summary={`${companionGates.length} gate${companionGates.length === 1 ? "" : "s"}`}>
      <ClauseChangeBanner acquisitionId={acquisitionId} />

      <CompanionGatesPanel gates={companionGates} />
      </MissionNavSection>

      <MissionNavSection id="directive-compliance" label="Directive compliance" collapsible summary="Directive checklist for this file">
      <section className="mb-12 w-full [&_p]:max-w-[80ch]">
        <h2 className="mb-2 text-[18px] leading-6 font-medium">Directive compliance</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">{DIRECTIVE_CITATION}</p>
        {readOnly ? <LockHint className="mb-3" /> : null}
        <label className="mb-3 flex items-center gap-2 text-[15px]">
          <input
            type="checkbox"
            disabled={!canWrite}
            checked={!!acq?.hardware_deliverable}
            onChange={(e) =>
              setDirective.mutate({
                patch: { hardware_deliverable: e.target.checked },
                field: "hardware_deliverable",
                action: "Hardware deliverable recorded",
                newValue: e.target.checked ? "true" : "false",
              })
            }
          />
          This acquisition has a hardware deliverable
        </label>
        {acq?.hardware_deliverable ? (
          <div className="border-t border-border pt-3">
            <label className="mb-3 flex items-center gap-2 text-[15px]">
              <input
                type="checkbox"
                disabled={!canWrite}
                checked={!!acq?.["right_to_repair_statement"]}
                onChange={(e) =>
                  setDirective.mutate({
                    patch: { right_to_repair_statement: e.target.checked },
                    field: "right_to_repair_statement",
                    action: "Right to Repair requirements statement recorded",
                    newValue: e.target.checked ? "attached" : "not attached",
                  })
                }
              />
              Right to Repair requirements statement attached
            </label>
            <label htmlFor="clause-review" className="block text-[13px] text-muted-foreground">
              Restrictive-clause review
            </label>
            <select
              id="clause-review"
              disabled={!canWrite}
              className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
              value={reviewStatus(acq?.["restrictive_clause_review"])}
              onChange={(e) =>
                setDirective.mutate({
                  patch: { restrictive_clause_review: e.target.value },
                  field: "restrictive_clause_review",
                  action: "Restrictive-clause review status recorded",
                  newValue: e.target.value,
                })
              }
            >
              {REVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="mt-3 text-[13px] text-muted-foreground">
              This file appears on{" "}
              <Link to="/directives" className="text-primary underline">
                Directive compliance
              </Link>{" "}
              with these two answers.
            </p>
          </div>
        ) : null}
      </section>
      </MissionNavSection>
        </div>
        <div
          role="tabpanel"
          id="file-panel-documents"
          aria-labelledby="file-tab-documents"
          data-file-tab-panel="documents"
          hidden={fileTab !== "documents"}
          className="mc-tab-panel"
        >
      <MissionNavSection
        id="contract-file-index"
        label="Contract file index"
        collapsible
        defaultOpen
        summary={`${fileIndex.present.length} of ${fileIndex.present.length + fileIndex.missing.length} tabs on file`}
      >
      <div data-print="index" aria-label="Contract file index" className="mc-index">
        <p className="mc-index-lead">
          Every document on this file, drafted or uploaded: its NEAR file element (NF 1098 tab for actions
          before Oct 1, 2024), version, who saved or
          uploaded it and when. Each row opens the official version. Required tabs with no document
          are listed at the end. RFO FAR 4.101 contract file.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="mc-index-print"
        >
          Print the cover sheet
        </button>
        <DataTable
          label="File index table"
          caption="NF 1098 tabs present in this file and required tabs with no document"
          rows={fileIndexRows}
          rowKey={(row) => (row.kind === "present" ? `p-${row.t.tab}-${row.t.templateName}` : `m-${row.t.tab}`)}
          rowClassName={(row) => (row.kind === "missing" ? "is-missing" : undefined)}
          empty={<p className="text-muted-foreground">No documents are saved or uploaded on this file yet.</p>}
          columns={[
            { key: "tab", header: "Tab", numeric: true, nowrap: true, width: "4.5rem", cell: (row) => row.t.tab },
            {
              key: "doc",
              header: "Document",
              cell: (row) => (
                <>
                  {row.kind === "present" && row.t.open?.kind === "document" ? (
                    <Link
                      className="text-primary underline-offset-2 hover:underline"
                      to="/documents/$templateKey/$acquisitionId"
                      params={{ templateKey: row.t.open.templateKey, acquisitionId }}
                    >
                      {row.t.templateName}
                    </Link>
                  ) : row.kind === "present" && row.t.open?.kind === "form" ? (
                    <Link
                      className="text-primary underline-offset-2 hover:underline"
                      to="/forms/$formKey/$acquisitionId"
                      params={{ formKey: row.t.open.formKey, acquisitionId }}
                    >
                      {row.t.templateName}
                    </Link>
                  ) : row.kind === "present" && row.t.open?.kind === "attachment" ? (
                    <button
                      type="button"
                      className="text-left text-primary underline-offset-2 hover:underline"
                      onClick={() => void openIndexAttachment(attachmentIdOf(row.t.open))}
                    >
                      {row.t.templateName}
                    </button>
                  ) : (
                    row.t.templateName
                  )}
                  {row.kind === "present" && row.latest && row.t.origin === "uploaded" ? (
                    <span className="mc-index-sub">{row.latest.templateName}</span>
                  ) : null}
                  {row.t.nearOrder ? (
                    <span className="mc-index-sub">
                      NEAR order {row.t.nearOrder} · {row.t.nearTitle}
                    </span>
                  ) : null}
                  {row.t.nearNotes ? (
                    <span className="mc-index-sub">
                      What to file here: {row.t.nearNotes.replace(/\n/g, " ").replace(/·\s*/g, "").trim()}
                    </span>
                  ) : null}
                </>
              ),
            },
            {
              key: "source",
              header: "Source",
              nowrap: true,
              cell: (row) =>
                row.kind === "missing" ? <EmptyCell>Not on file</EmptyCell> : row.t.origin === "uploaded" ? "Uploaded" : "Generated",
            },
            {
              key: "official",
              header: "Official",
              nowrap: true,
              cell: (row) =>
                row.kind === "missing" ? (
                  <EmptyCell>None</EmptyCell>
                ) : row.t.origin === "uploaded" ? (
                  <EmptyCell>Not applicable</EmptyCell>
                ) : row.officialDoc ? (
                  "Official"
                ) : (
                  "Draft"
                ),
            },
            {
              key: "version",
              header: "Version",
              numeric: true,
              cell: (row) => (row.kind === "missing" ? <EmptyCell>None</EmptyCell> : row.latest?.version ?? <EmptyCell />),
            },
            {
              key: "saved",
              header: "Saved",
              nowrap: true,
              cell: (row) =>
                row.kind === "missing" ? (
                  <EmptyCell>None</EmptyCell>
                ) : row.latest?.savedAt ? (
                  formatDate(String(row.latest.savedAt).slice(0, 10))
                ) : (
                  "Not recorded"
                ),
            },
            {
              key: "by",
              header: "By",
              cell: (row) => (row.kind === "missing" ? <EmptyCell>None</EmptyCell> : row.latest?.savedBy ?? "Not recorded"),
            },
            {
              key: "required",
              header: "Required here",
              nowrap: true,
              cell: (row) =>
                row.kind === "missing"
                  ? "Required"
                  : requiredTabSet.has(row.t.tab)
                    ? "Required"
                    : offeredTabSet.has(row.t.tab)
                      ? "Offered"
                      : "Not required",
            },
            {
              key: "memo",
              header: "Memo (NF 1858)",
              cell: (row) =>
                row.kind === "missing" ? (
                  <StatusMark color="var(--attention)">No document on this tab</StatusMark>
                ) : row.latest?.memo ? (
                  `Yes, to ${row.latest.memoTo ?? "addressee not set"}`
                ) : (
                  "No"
                ),
            },
          ]}
        />
      </div>
      </MissionNavSection>

      <MissionNavSection id="exports-peer-systems" label="Exports & peer systems" collapsible summary="NEAR export, NCMS packet and peer systems">
      {acq ? (
        <>
        <section aria-label="Peer systems" className="mb-8 w-full [&_p]:max-w-[80ch] border-t border-border pt-3">
          <p className="mb-1 text-[13px] text-muted-foreground">Peer systems</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] leading-[18px]">
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline disabled:text-muted-foreground"
              disabled={nearExport.isPending}
              onClick={() => nearExport.mutate()}
            >
              {nearExport.isPending ? "Building the NEAR export" : "NEAR export"}
            </button>
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => downloadPacket()}
            >
              NCMS packet (local; planned write-back)
            </button>
            <Link to="/checks" className="text-primary underline-offset-2 hover:underline">
              Checks
            </Link>
            <span className="text-muted-foreground" data-numeric>
              {lastCheck
                ? `Last check: ${lastCheck.check_type ?? "Check"} · ${formatStamp(lastCheck.checked_at)}`
                : "No check recorded on this file yet."}
            </span>
          </div>
          {sweepFlag ? (
            <p className="mt-3 max-w-[80ch] border-l-2 border-destructive pl-3 text-[13px]">
              Flagged for contracting officer review: {sweepFlag.why} Checked{" "}
              {formatStamp(sweepFlag.checkedAt)}. The clock was not changed. Run a record check on this UEI; a clean
              result clears the flag.
            </p>
          ) : null}
          <p className="mt-2 text-[13px] text-muted-foreground">
            NEAR export and NCMS packet are local files. T-Minus writes nothing to NEAR, NCMS, or SAM.gov.
            The handoff is a local packet you key into NCMS, which stays the system of record under NFS CG
            1804.11(b); writing into NCMS from here is planned and not available in this prototype.
          </p>
        </section>
        </>
      ) : null}
      </MissionNavSection>
        </div>
        <div
          role="tabpanel"
          id="file-panel-post-award"
          aria-labelledby="file-tab-post-award"
          data-file-tab-panel="post-award"
          hidden={fileTab !== "post-award"}
          className="mc-tab-panel"
        >
      <MissionNavSection id="vehicle-orders-post-award" label="Vehicle, orders & post-award" collapsible defaultOpen summary="Standalone drafts, orders and modifications">
      <StandaloneDraft acquisitionId={acquisitionId} canWrite={canWrite} />

      <NewOrderPanel
        acq={acq as Record<string, unknown> | null}
        canWrite={canWrite}
        actor={actorName}
      />

      <VehiclePanel acq={acq as Record<string, unknown> | null} todayISO={todayISO()} />

      <ModificationsPanel
        acq={acq as Record<string, unknown> | null}
        canWrite={canWrite}
        actor={actorName}
        onBanner={setBanner}
      />

      <SituationMemoPanel
        acq={acq as Record<string, unknown> | null}
        actor={actorName}
        onBanner={setBanner}
        operational={
          lifecycle && readiness
            ? {
                phase: lifecycle.currentPhase ? stepLabel(lifecycle.currentPhase, acq as AcqRow) : "Not recorded",
                readiness,
                countdownLine: (() => {
                  const view = overviewCountdownView(lifecycle);
                  return view.pastTarget
                    ? countdownText(view, { omitBadge: view.badge === readiness })
                    : view.days === null || !view.prefix
                      ? view.caption
                      : `${view.prefix}${view.days}${view.badge && view.badge !== readiness ? ` ${view.badge}` : ""}`;
                })(),
                holdReason: lifecycle.hold?.reason ?? null,
                holdOwner: lifecycle.hold?.owner ?? null,
              }
            : null
        }
      />

      <CloseoutPanel
        acq={acq as Record<string, unknown> | null}
        canWrite={canWrite}
        actor={actorName}
        onBanner={setBanner}
        cparsRecorded={cparsRecorded(q.data?.stateLog ?? [])}
      />

      <ClauseModTasks acquisitionId={acquisitionId} />

      <Nf1707Signoffs
        acquisitionId={acquisitionId}
        centerCode={acq?.center_code ?? null}
        storedAnswers={(acq?.['nf1707_answers'] ?? {}) as Record<string, unknown>}
        rows={q.data?.nfApprovals ?? []}
        routing={q.data?.memoRouting ?? []}
        canWrite={canWrite}
        actor={actorName}
        onBanner={setBanner}
        onChanged={async () => { await qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] }); void qc.invalidateQueries({ queryKey: ["work-queue"] }); }}
      />
      </MissionNavSection>
        </div>
        <div
          role="tabpanel"
          id="file-panel-details"
          aria-labelledby="file-tab-details"
          data-file-tab-panel="details"
          hidden={fileTab !== "details"}
          className="mc-tab-panel"
        >
      <MissionNavSection id="thresholds" label="Thresholds" collapsible defaultOpen summary={`${q.data?.thresholds?.length ?? 0} entries`}>
      {coldPathSample ? (
        <section className="mb-12">
          <h2 className="mb-4 text-[18px] leading-6 font-medium">Thresholds</h2>
          <p className="mb-3 max-w-[80ch] text-[13px] text-muted-foreground">
            Where {value === null ? "this acquisition" : `the IGCE of ${formatMoney(value)}`} sits against each threshold in the table.
          </p>
        <TableScrollRegion baseClassName="overflow-x-auto" label="Market thresholds table">
<table className="w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Threshold</th>
              <th scope="col" className="p-2">Value</th>
              <th scope="col" className="p-2">This acquisition</th>
              <th scope="col" className="p-2">Tier</th>
              <th scope="col" className="p-2">Effective</th>
              <th scope="col" className="p-2">Citation and note</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.thresholds ?? []).map((t) => {
              const tv = t.value === null ? null : Number(t.value);
              const above = value !== null && tv !== null ? value >= tv : null;
              return (
                <tr key={t.threshold_id} className="border-b border-border align-top">
                  <td className="p-2">
                    {t.name}
                    {/^certified cost or pricing data \(statute/i.test(t.name ?? "") ? (
                      <span className="mt-1 block text-[12px] text-muted-foreground">{CERTIFIED_DATA_LABEL}</span>
                    ) : null}
                  </td>
                  <td className="p-2" data-numeric>
                    {tv === null ? "Not recorded" : tv >= 1000 ? formatMoney(tv) : tv}
                  </td>
                  <td className="p-2">{above === null ? "Not recorded" : above ? "At or above" : "Below"}</td>
                  <td className="p-2">{t.tier}</td>
                  <td className="p-2" data-numeric>
                    {t.effective_date ?? "Not recorded"}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {t.citation}
                    {t.note && /conflict/i.test(t.note) ? (
                      <ConflictNote note={t.note} className="mt-1 block" />
                    ) : t.note ? (
                      <span className="mt-1 block">{t.note}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
</TableScrollRegion>
        </section>
      ) : (
      <section className="mb-12">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Thresholds</h2>
        <p className="mb-3 max-w-[80ch] text-[13px] text-muted-foreground">
          Where {value === null ? "this acquisition" : `the IGCE of ${formatMoney(value)}`} sits against each threshold in the table.
        </p>
        <TableScrollRegion baseClassName="overflow-x-auto" label="HCA thresholds table">
<table className="w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Threshold</th><th scope="col" className="p-2">Value</th><th scope="col" className="p-2">This acquisition</th><th scope="col" className="p-2">Tier</th><th scope="col" className="p-2">Effective</th><th scope="col" className="p-2">Citation and note</th>
            </tr>
          </thead>
          <tbody>{(q.data?.thresholds ?? []).map((t) => { const tv = t.value === null ? null : Number(t.value); const above = value !== null && tv !== null ? value >= tv : null; return <tr key={t.threshold_id} className="border-b border-border align-top"><td className="p-2">{t.name}</td><td className="p-2" data-numeric>{tv === null ? "Not recorded" : tv >= 1000 ? formatMoney(tv) : tv}</td><td className="p-2">{above === null ? "Not recorded" : above ? "At or above" : "Below"}</td><td className="p-2">{t.tier}</td><td className="p-2" data-numeric>{t.effective_date ?? "Not recorded"}</td><td className="p-2 text-muted-foreground">{t.citation}{t.note ? <ConflictNote note={t.note} className="mt-1 block" /> : null}</td></tr>; })}</tbody>
        </table>
</TableScrollRegion>
      </section>
      )}
      </MissionNavSection>

      <MissionNavSection id="facts-of-record" label="Facts of record" collapsible defaultOpen summary="13 fields">
      <section className="mb-10 min-w-0">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Facts of record</h2>
        <dl className="grid max-w-[80ch] gap-x-8 md:grid-cols-2">
          {(
            [
              ["Mission", q.data?.mission?.name ?? String(acq?.mission_id ?? "Not recorded")],
              ["Mission need date", String(acq?.need_date ?? "Not recorded")],
              ["Estimated value", value === null ? "Not recorded" : formatMoney(value)],
              ["Contract type", String(acq?.contract_type ?? "Not recorded")],
              ["Acquisition method", methodDisplayLabel(String(acq?.acquisition_method ?? "Not recorded"))],
              ["Competition", String(acq?.competition ?? "Not recorded")],
              ["Set-aside", String(acq?.set_aside ?? "Not recorded")],
              ["NAICS", String(acq?.naics_code ?? "Not recorded")],
              ["PSC", String(acq?.psc_code ?? "Not recorded")],
              ["Place of performance", String(acq?.place_of_performance ?? "Not recorded")],
              [
                "Period of performance",
                acq?.period_of_performance_start || acq?.period_of_performance_end
                  ? `${acq?.period_of_performance_start ?? "Not recorded"} to ${acq?.period_of_performance_end ?? "Not recorded"}`
                  : "Not recorded",
              ],
              ["Regulatory baseline date", String(acq?.regulatory_baseline_date ?? "Not recorded")],
              [
                "Current phase",
                // The phase the file is actually in: a later phase cannot start
                // while an earlier one is short a required document.
                (() => { const cur = phases.find((p) => p.status === "current"); return cur ? phaseLabel(cur) : String(phaseAlias(acq?.current_phase) ?? "Not recorded"); })(),
              ],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="mb-3">
              <dt className="text-[13px] text-muted-foreground">{k}</dt>
              <dd className="text-[15px]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      </MissionNavSection>

      <MissionNavSection
        id="reference-links"
        label="Reference links"
        collapsible
        summary="Center clauses and practice links"
      >
      <CenterLocalClausesPanel />

      <PracticeLinksPanel />
      </MissionNavSection>
        </div>
        <div
          role="tabpanel"
          id="file-panel-audit"
          aria-labelledby="file-tab-audit"
          data-file-tab-panel="audit"
          hidden={fileTab !== "audit"}
          className="mc-tab-panel"
        >
      <MissionNavSection id="audit-trail" label="Audit trail" collapsible defaultOpen summary={`${q.data?.auditCount ?? 0} entries`}>
        <section className="mb-10 min-w-0">
          <h2 className="mb-4 text-[18px] leading-6 font-medium">Audit trail</h2>
        {auditListQ.isLoading ? (
          <LoadingNote what="the audit trail" />
        ) : auditListQ.isError ? (
          <>
            <ErrorNote message="The audit trail couldn't load." />
            <Button type="button" variant="secondary" disabled={auditListQ.isFetching} onClick={() => void auditListQ.refetch()}>
              Retry
            </Button>
          </>
        ) : auditRows.length ? (
          <TableScrollRegion baseClassName="overflow-x-auto" label="Audit trail table" className="w-full min-w-0">
<table className="min-w-[760px] border border-border bg-background text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-2">Logged</th>
                <th scope="col" className="p-2">Actor</th>
                <th scope="col" className="p-2">Action</th>
                <th scope="col" className="p-2">Field</th>
                <th scope="col" className="p-2">New value</th>
                <th scope="col" className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((row) => (
                <tr key={row.log_id} className="border-b border-border align-top">
                  <td className="p-2">{new Date(row.logged_at).toLocaleString()}</td>
                  <td className="p-2">{row.actor}</td>
                  <td className="p-2" title={storedAs(row.action, auditActionLabel(row.action))}>{auditActionLabel(row.action)}</td>
                  <td className="p-2" title={storedAs(row.field, auditFieldLabel(row.field))}>{auditFieldLabel(row.field)}</td>
                  <td className="p-2" title={storedAs(row.new_value, auditValueLabel(row.action, row.new_value))}>{auditValueLabel(row.action, row.new_value)}</td>
                  <td className="p-2" title={storedAs(row.reason, auditTextLabel(row.reason))}>{auditTextLabel(row.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
</TableScrollRegion>
        ) : (
          <p className="text-muted-foreground">No entries yet for this file.</p>
        )}
        {auditRows.length && auditListQ.hasNextPage ? (
          <Button type="button" variant="secondary" onClick={() => auditListQ.fetchNextPage()} disabled={auditListQ.isFetchingNextPage}>Show 200 more</Button>
        ) : null}
        </section>
      </MissionNavSection>
        </div>
      </div>

      <Dialog
        open={actionDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActionDialog(null);
            setActionError(null);
            setVoteRow(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.kind === "exit"
                ? `Exit ${stepLabel(actionDialog.phase, acq as AcqRow)}`
                : actionDialog?.kind === "scrub"
                  ? `Scrub ${acquisitionId}`
                  : actionDialog?.kind === "remove"
                    ? `Remove ${actionDialog.doc.label}`
                    : actionDialog?.kind === "vote"
                      ? `Record the ${actionDialog.entry.reviewer_role} decision`
                      : actionDialog?.kind === "open-poll"
                        ? `Send the ${stepLabel(actionDialog.phase, acq as AcqRow)} review requests`
                        : "Confirm action"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.kind === "exit"
                ? "This completes the current phase, records the reason, and starts the next phase clock."
                : actionDialog?.kind === "scrub"
                  ? "This stops the countdown and removes the file from active work queues while keeping its audit history."
                  : actionDialog?.kind === "remove"
                    ? "This removes the file copy and marks the requirement as needing attention again."
                    : actionDialog?.kind === "vote"
                      ? `This records the decision received from ${actionDialog.entry.reviewer_name}, with the date, the rationale and your name, in the file audit history.`
                      : "This creates one pending review for every required reviewer using the current Center reviewer table."}
            </DialogDescription>
          </DialogHeader>

          {actionDialog?.kind === "exit" && (missingCurrentRequirements.length || pendingCurrentReviews.length) ? (
            <div className="border-l-2 border-atrisk pl-3 text-[13px]">
              <p className="font-medium">
                {missingCurrentRequirements.length + pendingCurrentReviews.length === 1
                  ? "This phase needs one more step before it can exit."
                  : `This phase needs ${missingCurrentRequirements.length + pendingCurrentReviews.length} more steps before it can exit.`}
              </p>
              <ul className="mt-2 space-y-2">
                {missingCurrentRequirements.map((doc) => {
                  const generator = generatorKey(doc);
                  return (
                    <li key={doc.label}>
                      Needs{" "}
                      {generator && doc.templateKey ? (
                        <Link
                          to="/documents/$templateKey/$acquisitionId"
                          params={{ templateKey: doc.templateKey, acquisitionId }}
                          className="text-primary underline"
                        >
                          {doc.label}
                        </Link>
                      ) : generator && doc.formKey ? (
                        <Link
                          to="/forms/$formKey/$acquisitionId"
                          params={{ formKey: doc.formKey, acquisitionId }}
                          className="text-primary underline"
                        >
                          {doc.label}
                        </Link>
                      ) : (
                        <a
                          href={`#${requirementId(actionDialog.phase, doc.label)}`}
                          onClick={() => setActionDialog(null)}
                          className="text-primary underline"
                        >
                          {doc.label}
                        </a>
                      )}
                      {doc.citation ? (
                        <span className="block text-muted-foreground">{doc.citation}</span>
                      ) : null}
                    </li>
                  );
                })}
                {pendingCurrentReviews.map((entry) => (
                  <li key={entry.reviewer_role}>
                    Needs{" "}
                    <a href={`#poll-${actionDialog.phase}`} onClick={() => setActionDialog(null)} className="text-primary underline">
                      {entry.vote === "unfavorable" && entry.decision
                        ? `the ${entry.reviewer_role} ${DECISION_LABEL[entry.decision]} resolved`
                        : `the ${entry.reviewer_role} decision`}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : actionDialog?.kind === "exit" && completeCurrentRequirements.length ? (
            <div className="border-l-2 border-border pl-3 text-[13px] text-muted-foreground">
              {completeCurrentRequirements.length === 1
                ? "One required item is complete and will be named in the record."
                : `${completeCurrentRequirements.length} required items are complete and will be named in the record.`}
            </div>
          ) : null}


          {actionDialog?.kind === "vote" ? (
            <div className="space-y-4">
              <ReviewDecisionFields
                idPrefix="vote"
                options={decisionOptions(actionDialog.entry.kind, actionDialog.entry.decision, true)}
                decision={voteChoice}
                onDecision={setVoteChoice}
                rationale={voteNote}
                onRationale={setVoteNote}
                kindLabel={REVIEW_KIND_LABEL[actionDialog.entry.kind]}
              />
              <label className="block text-[13px]" htmlFor="vote-received">
                Date received
                <input id="vote-received" type="date" value={voteReceived} onChange={(e) => setVoteReceived(e.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-input bg-background px-3" />
              </label>
            </div>
          ) : actionDialog?.kind === "exit" || actionDialog?.kind === "scrub" || actionDialog?.kind === "remove" ? (
            <label className="block text-[13px]" htmlFor="action-reason">
              Reason (required)
              <textarea
                id="action-reason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                required
                aria-required="true"
                className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </label>

          ) : null}

          {actionError ? <p role="alert" className="text-[13px] text-destructive">{actionError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              variant={
                actionDialog?.kind === "scrub" ||
                actionDialog?.kind === "remove" ||
                (actionDialog?.kind === "vote" && decisionOutcome(voteChoice) === "unfavorable")
                  ? "destructive"
                  : "default"
              }
              disabled={
                !actionDialog ||
                ((actionDialog.kind === "exit" || actionDialog.kind === "scrub" || actionDialog.kind === "remove") && !actionReason.trim()) ||
                (actionDialog.kind === "exit" && Boolean(missingCurrentRequirements.length || pendingCurrentReviews.length)) ||
                (actionDialog.kind === "vote" && (!voteChoice || rationaleMissing(voteChoice, voteNote))) ||
                exitPhase.isPending || scrub.isPending || detachDoc.isPending || openPoll.isPending || recordVote.isPending
              }
              onClick={async () => {
                if (!actionDialog) return;
                setActionError(null);
                try {
                  if (actionDialog.kind === "exit") await exitPhase.mutateAsync({ phase: actionDialog.phase, reason: actionReason });
                  if (actionDialog.kind === "scrub") await scrub.mutateAsync(actionReason);
                  if (actionDialog.kind === "remove") await detachDoc.mutateAsync({ doc: actionDialog.doc, reason: actionReason });
                  if (actionDialog.kind === "open-poll") await openPoll.mutateAsync(actionDialog.phase);
                  if (actionDialog.kind === "vote") await recordVote.mutateAsync({ entry: actionDialog.entry, choice: voteChoice, received: voteReceived, note: voteNote });
                  setActionDialog(null);
                } catch (error) {
                  setActionError(error instanceof Error ? error.message : "That action did not finish. Try again.");
                }
              }}
            >
              {actionDialog?.kind === "exit"
                ? `Exit ${stepLabel(actionDialog.phase, acq as AcqRow)}`
                : actionDialog?.kind === "scrub"
                  ? "Scrub the acquisition"
                  : actionDialog?.kind === "remove"
                    ? "Remove the file"
                    : actionDialog?.kind === "vote"
                      ? voteChoice
                        ? `Record ${DECISION_LABEL[voteChoice]}`
                        : "Record decision"
                      : actionDialog?.kind === "open-poll"
                        ? "Send the review requests"
                        : "Confirm"}
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Link to="/files" activeOptions={{ exact: true }} className="text-primary underline underline-offset-2">
        Back to Files
      </Link>
        </div>

        {/* Context rail: what needs attention and the section index. Sticky,
            and never taller than the window, so it scrolls inside itself. */}
        <aside className="mc-file-rail no-print" aria-label="File context">
          <section className="mc-rail-card" aria-labelledby="rail-attention">
            <h2 id="rail-attention" className="mc-rail-title">Needs attention</h2>
            {railAttention.length ? (
              <ul className="mc-rail-list">
                {railAttention.map((item) => (
                  <li key={item.key} className={`mc-rail-item is-${item.tone}`}>
                    <a href={`#${item.target}`} onClick={(e) => { e.preventDefault(); jumpToSection(item.target); }}>
                      <span className="mc-rail-item-text">{item.text}</span>
                      {item.sub ? <span className="mc-rail-item-sub">{item.sub}</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mc-rail-empty">Nothing open on this file right now.</p>
            )}
          </section>
          <section className="mc-rail-card" aria-label="People on this file">
            <h2 className="mc-rail-title">People</h2>
            <dl className="mc-rail-people">
              <div><dt>Contracting officer</dt><dd>{String(acq?.co_name ?? "").trim() || "Not assigned"}</dd></div>
              {String(acq?.["requester_name"] ?? "").trim() ? (
                <div><dt>Requester</dt><dd>{String(acq?.["requester_name"])}</dd></div>
              ) : null}
              {q.data?.mission?.name ? (
                <div><dt>Mission</dt><dd>{q.data.mission.name}</dd></div>
              ) : null}
            </dl>
          </section>
          <div className="mc-rail-card">
            <MissionNavigator items={missionNavItems} />
          </div>
        </aside>
      </div>
      ) : null}
    </AppShell>
  );
}
