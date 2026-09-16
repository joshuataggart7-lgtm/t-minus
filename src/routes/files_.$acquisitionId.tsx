import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { usePresenter } from "@/lib/presenter";
import { copyAsNewSample } from "@/lib/copy-sample";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
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
  pollBoard,
  reviewerNameForRole,
  REVIEW_PHASES,
  reviewRulesForPhase,
  type AcqRow,
  type BoardEntry,
  type PhaseView,
  type RequiredDoc,
} from "@/lib/launch-sequence";
import { PACKET_CANDIDATE_NUMBERS, selectPacketClauses } from "@/lib/clause-packet";
import { orderPacketForScreen } from "@/lib/ncms-handoff";
import { ClausePicker } from "@/components/clause-picker";
import { acquisitionProfile } from "@/lib/vehicles";
import { buildFormatScaffold, scaffoldForPacket } from "@/lib/format-scaffold";
import { FormatScaffoldPanel } from "@/components/format-scaffold-panel";
import { evaluateCompanionGates } from "@/lib/companion-gates";
import { CompanionGatesPanel } from "@/components/companion-gates-panel";
import type { StoredEstimate } from "@/lib/estimator";
import { exportNearBundle } from "@/lib/near-export";
import { exportBriefingBook, briefingFacts } from "@/lib/briefing-book";
import { exportFpdsFillingSheet } from "@/lib/fpds-filling-sheet";
import { exportEvidencePack } from "@/lib/evidence-pack";
import { buildFileIndex } from "@/lib/file-index";
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
import { resolveHold, attachedKeys as keysFrom } from "@/lib/hold";
import { TEMPLATES } from "@/lib/template-engine";
import { FORM_NAMES, GENERATED_FORM_KEYS } from "@/lib/nf1787";
import { signedInName } from "@/lib/account-name";
import { protestWindow } from "@/lib/protest-window";
import {
  FORECAST_CITATION,
  FORECAST_FIELDS,
  forecastCsv,
  forecastEntry,
  satValue,
  type ForecastAcq,
} from "@/lib/forecast";
import { ExplainThis } from "@/components/explain-this";
import { MarketResearchEngine } from "@/components/market-research-engine";
import {
  explainHold,
  explainDocRow,
  explainMissingDoc,
  fileStory,
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
import { ageInDays, thresholdFor } from "@/lib/aging";
import { awardDateFor, computeMetrics, formatDate, holdSince } from "@/lib/metrics";
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

export const Route = createFileRoute("/files_/$acquisitionId")({
  head: () => ({
    meta: [
      { title: "Acquisition file — T-Minus" },
      {
        name: "description",
        content: "The clock line, the launch sequence, the poll board, and the thresholds for one acquisition.",
      },
      { property: "og:title", content: "Acquisition file — T-Minus" },
      {
        property: "og:description",
        content: "Clock line, launch sequence, poll board, and thresholds for one acquisition.",
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
  if (state === "hold") return "var(--atrisk)";
  if (state === "launched") return "var(--ontrack)";
  return "var(--ontrack)";
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
            <span className="font-medium">{t.clause_number}</span> — {t.change_kind} ({t.change_source ?? "source not recorded"})
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

function FilePage() {
  const { acquisitionId } = Route.useParams();
  const coldPathSample = acquisitionId === "A-2027-0101" || acquisitionId === "A-2027-0102";
  const { authState, user, hasAnyRole } = useRole();
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
  const canWrite = hasAnyRole(["specialist", "hq"]);
  const [mode, setMode] = useState<Mode>("veteran");
  const presenter = usePresenter();
  const navigate = useNavigate();
  const [step, setStep] = useState<number | null>(null);
  const [showFullSequence, setShowFullSequence] = useState(false);
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
  const [voteChoice, setVoteChoice] = useState<"go" | "no-go">("go");
  const [actionDialog, setActionDialog] = useState<FileActionDialog | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["acquisition-file", acquisitionId],
    enabled: authState === "signed-in",
    // The poll board updates live as reviewers vote.
    refetchInterval: 5000,
    queryFn: async () => {
      const [acq, log, plan, rules, thresholds, strategies, polls, clauses, nfApprovals] = await Promise.all([
        supabase.from("acquisition_facts").select("*").eq("acquisition_id", acquisitionId).maybeSingle(),
        supabase
          .from("audit_log")
          .select("*")
          .eq("acquisition_id", acquisitionId)
          .order("logged_at", { ascending: false }),
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
      ]);
      const { data: memoRouting } = await supabase
        .from("memo_routing")
        .select("center_code,document_key,approving_official_title");
      const { data: centers } = await supabase
        .from("centers")
        .select("center_code,aging_threshold_days");
      const { data: overrides } = await supabase.from("center_overrides").select("*");
      const { data: people } = await supabase
        .from("users")
        .select("name,role,title,center_code,warrant_limit");
      const { data: successors } = await supabase
        .from("acquisition_facts")
        .select("acquisition_id")
        .eq("successor_of", acquisitionId);
      // Whether market research has already been run on this file.
      const { data: researchRuns } = await supabase
        .from("research_runs")
        .select("run_id")
        .eq("acquisition_id", acquisitionId);
      const [fileDocs, fileTemplates] = await Promise.all([
        supabase
          .from("documents")
          .select("template_id,version,saved_by,saved_at,issue_on_nf1858,memo_header,field_values")
          .eq("acquisition_id", acquisitionId),
        supabase.from("templates").select("template_id,name,nf_1098_tab"),
      ]);
      let mission = null as { name: string | null; milestone_date: string | null } | null;
      if (acq.data?.mission_id) {
        const m = await supabase
          .from("missions")
          .select("name,milestone_date")
          .eq("mission_id", acq.data.mission_id)
          .maybeSingle();
        mission = m.data;
      }
      return {
        acq: acq.data as AcqRow | null,
        centers: centers ?? [],
        overrides: overrides ?? [],
        people: people ?? [],
        researchRuns: researchRuns ?? [],
        log: log.data ?? [],
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

  // Acquisition Forecast entry, NFS 1807.72: a byproduct of the record for
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
      await supabase.from("audit_log").insert({
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
    void supabase.from("audit_log").insert({
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

  // The most recent recorded check on this file, read only. Running a check
  // stays where it already lives; this is a stamp and a link.
  const lastCheckQ = useQuery({
    queryKey: ["file-last-check", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data } = await supabase
        .from("sam_checks")
        .select("check_type,checked_at,checked_by")
        .eq("acquisition_id", acquisitionId)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });
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

  const phases: PhaseView[] = useMemo(
    () =>
      acq
        ? buildSequence(acq, q.data?.plan ?? [], todayISO(), daysBetween, {
            attachedKeys: keysFrom(attachments),
            savedKeys,
          })
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
    return computeMetrics(acq, {
      roster: q.data?.people ?? [],
      plan: q.data?.plan ?? [],
      rules: q.data?.rules ?? [],
      polls: q.data?.polls ?? [],
      ref,
      mission: q.data?.mission
        ? { mission_id: String(acq.mission_id ?? ""), name: q.data.mission.name ?? "Mission", program: null, center_code: acq.center_code ?? null, milestone: null, milestone_date: q.data.mission.milestone_date, priority: null, program_owner: null, leadership_note: null }
        : null,
      holdSince: holdSince(acq.acquisition_id, q.data?.log ?? []),
      awardDate: awardDateFor(acq.acquisition_id, q.data?.log ?? [], acq.target_award_date ?? null),
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
    if ((boards[current] ?? []).some((b) => b.vote === "pending")) return { label: "Open the poll" };
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
      const key = doc.docKey ?? docKey(doc.field, doc.label);
      return docSatisfied(doc, acq, Boolean(attachmentFor(key)), savedKeys) === false;
    });
  }, [acq, currentPhase, attachments, savedKeys]);

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
      currentPhase
        ? (boards[currentPhase.phase] ?? []).filter((entry) => entry.poll_id && entry.vote === "pending")
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
      setVoteChoice("go");
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
          .filter((p) => (p.phase ?? "") === phase)
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
      await supabase.from("audit_log").insert({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: "Poll opened",
        field: "polls",
        new_value: `${rows.length} reviewer${rows.length === 1 ? "" : "s"}`,
        reason: `${phase} requires review`,
        phase,
      });
    },
    onSuccess: () => {
      setActionDialog(null);
      setBanner("The poll is open. Reviewers can vote on the documents for that phase.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`The poll did not open: ${e.message}. Try again.`),
  });

  // A reviewer who answered by email: the contracting officer records the vote
  // on their behalf, and the audit entry says so.
  const recordVote = useMutation({
    mutationFn: async (input: {
      entry: BoardEntry;
      choice: "go" | "no-go";
      received: string;
      note: string;
    }) => {
      if (!acq) return;
      if (!input.entry.poll_id) throw new Error("Open the poll for this phase first");
      if (input.choice === "no-go" && !input.note.trim()) throw new Error("A No-go needs a reason");
      const who = await signedInName(actorName);
      const note = input.note.trim() || null;
      const { error } = await supabase
        .from("polls")
        .update({
          vote: input.choice,
          reason: note,
          voted_at: new Date(`${input.received}T12:00:00Z`).toISOString(),
        })
        .eq("poll_id", input.entry.poll_id);
      if (error) throw new Error(error.message);
      await supabase.from("audit_log").insert({
        acquisition_id: acq.acquisition_id,
        actor: who,
        action: input.choice === "go" ? "Go recorded" : "No-go recorded",
        field: input.entry.reviewer_role,
        old_value: input.entry.vote,
        new_value: input.choice,
        reason: `recorded by ${who} on behalf of ${input.entry.reviewer_name}${note ? `: ${note}` : ""}; received ${input.received}`,
        phase: input.entry.phase,
      });
    },
    onSuccess: () => {
      setVoteRow(null);
      setVoteNote("");
      setActionDialog(null);
      setBanner("The vote is recorded with the date it was received.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`The vote did not save: ${e.message}. Try again.`),
  });

  // Age of the current hold, against the Center's own aging window.
  const holdAge = ageInDays((acq?.['hold_started_at'] as string | null) ?? null);
  const holdThreshold = thresholdFor(
    acq?.center_code ? String(acq.center_code) : null,
    (q.data?.centers ?? []) as { center_code: string; aging_threshold_days?: number | null }[],
  );

  // When the CO has not entered a target award date, the forecast's anticipated
  // award date stands in, so a running clock always shows days to award.
  const effectiveTargetAward =
    (acq?.target_award_date as string | null) ??
    (forecast && /^\d{4}-\d{2}-\d{2}$/.test(forecast.anticipated_award_date)
      ? forecast.anticipated_award_date
      : null);
  const days =
    lifecycle?.daysToAward ??
    (effectiveTargetAward
      ? Math.round(
          (new Date(effectiveTargetAward + "T00:00:00Z").getTime() - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()) /
            86_400_000,
        )
      : null);

  const currentIndex = Math.max(
    0,
    phases.findIndex((p) => p.status === "current"),
  );
  const focusIndex = mode === "novice" ? (step ?? currentIndex) : currentIndex;
  const shownPhases = showFullSequence
    ? phases
    : phases.slice(Math.max(0, focusIndex - 1), Math.min(phases.length, focusIndex + 2));

  const setDoc = useMutation({
    mutationFn: async ({ doc, attach, reason }: { doc: RequiredDoc; attach: boolean; reason?: string }) => {
      if (!acq || !doc.field) return;
      const who = await signedInName(actorName);
      const value = doc.field === "jofoc_authority_citation" ? (attach ? "RFO FAR 6.301(a)(1)" : "") : attach;
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

      await supabase.from("audit_log").insert([
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
      await supabase.from("audit_log").insert([
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
      await supabase.from("audit_log").insert([
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
    onError: (e: Error) => setBanner(`That file did not attach: ${e.message}. Try again.`),
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
      await supabase.from("audit_log").insert({
        acquisition_id: acq.acquisition_id,
        actor: actorName,
        action: "Responsibility finding recorded",
        field: "responsibility_finding",
        old_value: finding,
        new_value: next,
        reason:
          next === "responsible"
            ? "Affirmative determination made by the contracting officer's signature on the SF 1449 (FAR 9.105-2(a)(1))"
            : next === "nonresponsibility"
              ? "Nonresponsibility memorandum required (FAR 9.105-2(a)(1))"
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
      await supabase.from("audit_log").insert({
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
        .eq("current_phase", phase)
        .select("acquisition_id");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("The phase changed before this action finished. Refresh and try again");
      const completed = completeCurrentRequirements.map((doc) => doc.label);
      const completeNote = completed.length
        ? ` Required for ${phase}, complete: ${completed.join("; ")}.`
        : "";
      const { error: auditError } = await supabase.from("audit_log").insert({
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
      const currentIndex = phases.findIndex((phase) => phase.phase === acq.current_phase);
      const fpdsIndex = phases.findIndex((phase) => phase.phase === "FPDS-NG Report");
      const administrationIndex = phases.findIndex((phase) => phase.phase === "Administration");
      const preAwardComplete = currentIndex >= 0 && (
        (fpdsIndex >= 0 && currentIndex >= fpdsIndex) ||
        (fpdsIndex < 0 && administrationIndex >= 0 && currentIndex >= administrationIndex)
      );
      if ((q.data?.nfApprovals ?? []).some((a) => a.status === "non_concurred")) {
        throw new Error("A NF 1707 non-concurrence is open. Clear it before launch");
      }
      if (!preAwardComplete || lifecycle?.hold || lifecycle?.board.some((entry) => entry.vote === "pending")) {
        throw new Error("Complete the current pre-award phase and its required reviews before launch");
      }
      const { error } = await supabase
        .from("acquisition_facts")
        .update({
          clock_state: "launched",
          hold_reason: null,
          hold_owner: null,
          hold_started_at: null,
          status: "awarded",
          current_phase: "Administration",
        })
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        acquisition_id: acq.acquisition_id,
        actor: who,
        action: "Launched",
        field: "clock_state",
        old_value: String(acq.clock_state ?? ""),
        new_value: "launched",
        reason: "Award made",
      });
    },
    onSuccess: () => {
      setBanner("Launched.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`${e.message}.`),
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
                  : (effectiveState ?? "—"),
          days,
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
          fpds: {
            acq: acq as unknown as Record<string, unknown>,
            awardDate: lifecycle?.awardDate ?? null,
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

  // The contract format the record carries decides the scaffold the officer
  // sees: SF 1449 streamlined on a commercial file, UCF sections otherwise.
  const formatScaffold = useMemo(
    () => buildFormatScaffold(acq as unknown as Record<string, unknown> | null, packetSelection),
    [acq, packetSelection],
  );

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
      await supabase.from("audit_log").insert({
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
      await supabase.from("audit_log").insert({
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
      await supabase.from("audit_log").insert({
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
      await supabase.from("audit_log").insert({
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
    void supabase.from("audit_log").insert({
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
    if (heroAction.label === "Open the poll" && currentPhase) {
      return <Button className="max-w-full whitespace-normal text-left" onClick={() => showActionDialog({ kind: "open-poll", phase: currentPhase.phase })}>{label}</Button>;
    }
    return <Button className="max-w-full whitespace-normal text-left" onClick={openLaunchSequence}>{label}</Button>;
  };

  return (
    <AppShell>
      {q.isLoading ? <LoadingNote what="the acquisition file" /> : null}

      {banner ? (
        <p className="mb-6 border-l-2 py-1 pl-3 text-[13px]" style={{ borderColor: "var(--attention)" }}>
          {banner}
        </p>
      ) : null}

      {!q.isLoading && effectiveState === "hold" && hold ? (
        <section aria-label="Current hold" className="mb-5 border-l-2 border-atrisk py-2 pl-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="max-w-[80ch] text-[15px] leading-[22px]">{hold.reason}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Owner: {hold.owner}
                {holdAge !== null
                  ? holdAge >= holdThreshold
                    ? ` · ${holdAge} days, past the ${holdThreshold}-day Center window`
                    : ` · ${holdAge} days; aging after ${holdThreshold} days`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {primaryAction("Fix")}
              <ExplainThis explanation={explainHold(hold, acq as AcqRow)} label="Why?" />
            </div>
          </div>
        </section>
      ) : null}

      {!q.isLoading ? <section aria-label="Clock line" className="mb-10 min-w-0 rounded-xl border border-border bg-background p-7 lg:p-10">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-primary" data-numeric>{acquisitionId}</p>
            <h1 className={presenter ? "mt-2 text-[28px] leading-9 font-semibold" : "mt-2 text-[24px] leading-8 font-semibold"}>{acq?.title ?? acquisitionId}</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {acq?.center_code ?? ""} · {acq ? acquisitionTypeWords(acq) : "Loading the file"}
            </p>
            {acq && !q.isLoading ? (
              <p className="mt-3 max-w-[80ch] text-[13px] leading-5 text-muted-foreground">
                {fileStory(acq as AcqRow, q.data?.mission?.name ?? null, q.data?.mission?.milestone_date ?? null, lifecycle?.currentPhase ?? null, effectiveState ?? null)}
              </p>
            ) : null}
          </div>
          <div className="grid min-w-0 gap-7 border-t border-border pt-7 sm:grid-cols-[auto_minmax(0,1fr)] lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <div className="min-w-0 sm:min-w-32">
            <p className={presenter ? "text-[48px] leading-[52px] font-semibold" : "text-[40px] leading-[44px] font-semibold"} data-numeric>
              {effectiveState === "launched" ? (lifecycle?.daysSinceAward ?? 0) : effectiveState === "scrubbed" ? "Stopped" : days === null ? "Not started" : days}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {effectiveState === "launched"
                ? "Days since award"
                : effectiveState === "scrubbed"
                  ? "Countdown"
                  : "Calendar days to target award date"}
            </p>
            {confidence && effectiveState !== "launched" && effectiveState !== "scrubbed" ? (
              <p className="mt-2 max-w-[44ch] text-[13px] leading-[18px] text-muted-foreground">
                {confidence.sentence}
              </p>
            ) : null}
            <p className="mt-4 text-[15px] font-medium">
              {effectiveState === "running"
                ? "Clock running"
                : effectiveState === "hold"
                  ? "On hold"
                  : effectiveState === "launched"
                    ? "Launched"
                    : (effectiveState ?? "—")}
            </p>
            </div>
            <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">Current phase</p>
            <p className="mt-1 text-[18px] leading-6 font-medium">{lifecycle?.currentPhase ?? "Not started"}</p>
            {/* Only a Required row reads as missing here. With none missing the
                line says the phase is ready to exit. */}
            <p className="mt-4 max-w-[48ch] text-[15px] leading-[22px]">
              {lifecycle?.blocker && lifecycle.blocker !== "None"
                ? lifecycle.blocker
                : currentPhase && !missingCurrentRequirements.length && !pendingCurrentReviews.length &&
                    effectiveState !== "launched" && effectiveState !== "scrubbed"
                  ? `Ready to exit ${currentPhase.phase}`
                  : (lifecycle?.nextAction ?? "Loading")}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {lifecycle?.blockerOwner ?? (effectiveState === "launched" ? "Post-award next action" : effectiveState === "scrubbed" ? "No countdown" : "Next action")}
            </p>
            <div className="mt-5 flex min-w-0 flex-wrap items-center gap-2">
              {heroAction && canWrite ? primaryAction() : null}
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
            </div>
          </div>
        </div>
      </section> : null}

      {acq ? (
        <section aria-label="Related actions" className="mb-8 max-w-[80ch] border-t border-border pt-3">
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
              NCMS handoff packet
            </button>
            <Link to="/checks" className="text-primary underline-offset-2 hover:underline">
              Checks
            </Link>
            <span className="text-muted-foreground" data-numeric>
              {lastCheckQ.data
                ? `Last check: ${lastCheckQ.data.check_type ?? "Check"} · ${formatDate(lastCheckQ.data.checked_at)}`
                : "No check recorded on this file yet."}
            </span>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Both exports are local files. T-Minus writes nothing to NEAR, NCMS, or SAM.gov.
          </p>
        </section>
      ) : null}

      {acq && canWrite ? (
        <EmailDraftsPanel
          drafts={buildEmailDrafts({
            acq: acq as unknown as Record<string, unknown>,
            coName: String(acq.co_name ?? actorName),
            phase: lifecycle?.currentPhase ?? "the current phase",
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
        <details aria-label="Warrant check" className="mb-8 max-w-[80ch] rounded-xl border border-border bg-background">
          <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">Warrant check</summary>
          <div className="border-t border-border px-5 py-4">
          {warrant.exceeds ? (
            <p
              className="border-l-2 py-1 pl-3 text-[15px] leading-[22px]"
              style={{ borderColor: "var(--at-risk)" }}
            >
              <span style={{ color: "var(--at-risk)" }}>Red flag:</span> the estimated value{" "}
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
              No warrant limit is recorded for {warrant.coName}, so the estimated value of{" "}
              <span data-numeric>{formatMoney(warrant.value)}</span> cannot be checked against a
              warrant.
            </p>
          ) : (
            <p className="text-[15px] leading-[22px] text-muted-foreground">
              Within warrant: the estimated value{" "}
              <span data-numeric>{formatMoney(warrant.value)}</span> is at or below the warrant of{" "}
              {warrant.coName}, <span data-numeric>{formatMoney(warrant.limit as number)}</span>.
            </p>
          )}
          </div>
        </details>
      ) : null}


      {!successor && effectiveState === "launched" ? (
        <section aria-label="Successor clock" className="mb-10 max-w-[70ch] border-t border-border pt-4">
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
        <section aria-label="Successor clock" className="mb-10 max-w-[70ch] border-t border-border pt-4">
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
        </section>
      ) : null}

      <details aria-label="Acquisition Forecast" className="mb-8 max-w-[80ch] rounded-xl border border-border bg-background">
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
            <table className="w-full border border-border text-[13px] leading-[18px]">
              <caption className="sr-only">Acquisition Forecast entry for this file</caption>
              <tbody>
                {FORECAST_FIELDS.map((f) => (
                  <tr key={f.key} className="border-b border-border last:border-b-0">
                    <th scope="row" className="w-[42%] px-3 py-2 text-left font-medium">
                      {f.header}
                    </th>
                    <td className="px-3 py-2">{forecast[f.key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <section aria-label="Estimate at intake" className="mb-10 max-w-[70ch]">
          <h2 className="mb-2 text-[18px] font-medium leading-[24px]">Estimate at intake</h2>
          <p className="text-[15px] leading-[22px]">{intakeEstimate.sentence}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Contracting officer {intakeEstimate.hours_co.toLocaleString("en-US")} hours · specialist{" "}
            {intakeEstimate.hours_cs.toLocaleString("en-US")} hours · recorded{" "}
            {intakeEstimate.estimated_at.slice(0, 10)}
          </p>
        </section>
      ) : null}

      {lifecycle && lifecycle.upcomingReviews.length > 0 ? (
        <section aria-labelledby="upcoming-reviews" className="mb-8 max-w-[80ch] border-t border-border pt-4">
          <h2 id="upcoming-reviews" className="text-[18px] leading-6 font-medium">Upcoming reviews</h2>
          <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
            {lifecycle.upcomingReviews.map((review) => (
              <li key={`${review.phase}-${review.reviewer_role}`}>{review.phase} · {review.reviewer_role} · {review.reviewer_name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <VehiclePanel acq={acq as Record<string, unknown> | null} todayISO={todayISO()} />

      <ModificationsPanel
        acq={acq as Record<string, unknown> | null}
        canWrite={canWrite}
        actor={actorName}
        onBanner={setBanner}
      />

      <CloseoutPanel
        acq={acq as Record<string, unknown> | null}
        canWrite={canWrite}
        actor={actorName}
        onBanner={setBanner}
        cparsRecorded={(q.data?.log ?? []).some((r) => /cpars/i.test(`${r.action ?? ""} ${r.field ?? ""}`))}
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

      <details aria-label="Contract file index" className="mb-8 rounded-xl border border-border bg-background">
        <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">Contract file index</summary>
        <div className="border-t border-border px-5 py-4">
        <p className="mb-4 text-[13px] text-muted-foreground">
          Built from the documents in this file, by NF 1098 tab. FAR 4.801 contract file.
        </p>
        <table className="w-full border border-border text-[13px] leading-[18px]">
          <caption className="sr-only">NF 1098 tabs present in this file and required tabs with no document</caption>
          <thead>
            <tr className="border-b border-border bg-canvas text-left">
              <th scope="col" className="px-3 py-2 font-medium">Tab</th>
              <th scope="col" className="px-3 py-2 font-medium">Document</th>
              <th scope="col" className="px-3 py-2 font-medium">Phase</th>
              <th scope="col" className="px-3 py-2 font-medium">Memo (NF 1858)</th>
              <th scope="col" className="px-3 py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {fileIndex.present.map((t) => (
              <tr key={`p-${t.tab}-${t.templateName}`} className="border-b border-border">
                <td className="px-3 py-2" data-numeric>{t.tab}</td>
                <td className="px-3 py-2">{t.templateName}</td>
                <td className="px-3 py-2">{t.phase}</td>
                <td className="px-3 py-2">
                  {t.documents.at(-1)?.memo
                    ? `Yes, to ${t.documents.at(-1)?.memoTo ?? "addressee not set"}`
                    : "No"}
                </td>
                <td className="px-3 py-2">
                  Present, {t.documents.length} version{t.documents.length === 1 ? "" : "s"}
                  {t.documents.at(-1)?.savedAt ? `, latest ${formatDate(String(t.documents.at(-1)!.savedAt).slice(0, 10))}` : ""}
                </td>
              </tr>
            ))}
            {fileIndex.missing.map((t) => (
              <tr key={`m-${t.tab}`} className="border-b border-border">
                <td className="px-3 py-2" data-numeric>{t.tab}</td>
                <td className="px-3 py-2">{t.templateName}</td>
                <td className="px-3 py-2">{t.phase}</td>
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2" style={{ color: "var(--attention)" }}>
                  Required for this acquisition type, no document
                </td>
              </tr>
            ))}
            {fileIndex.present.length === 0 && fileIndex.missing.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                  No tabbed documents are saved on this file yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </details>

      <CompanionGatesPanel gates={companionGates} />

      <details id="launch-sequence" open aria-label="Launch sequence" className={`mb-12 rounded-xl border border-border bg-background${presenter ? " presenter-step" : ""}`}>
        <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">Launch sequence</summary>
        <div className="border-t border-border p-5">

        <div className="mb-5 flex items-center justify-between gap-4">
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

        <ol className="border-l border-border pl-6">
          {shownPhases.map((p) => (
            <li key={p.phase} className="relative mb-8">
              <span
                aria-hidden="true"
                className="absolute -left-[31px] top-1 size-3 rounded-full border-2"
                style={{
                  borderColor: p.status === "upcoming" ? "var(--border)" : statusColor(acq?.clock_state),
                  background:
                    p.status === "complete"
                      ? statusColor(acq?.clock_state)
                      : p.status === "current"
                        ? "var(--panel)"
                        : "transparent",
                }}
              />
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-[18px] leading-6 font-medium">
                  {p.order}. {p.phase}
                </h3>
                <span className="text-[13px] text-muted-foreground">
                  {p.status === "complete" ? "Complete" : p.status === "current" ? "In work" : "Not started"}
                </span>
                <span className="text-[13px] text-muted-foreground" data-numeric>
                  {p.actual_days === null ? "—" : p.actual_days} of {p.planned_days} planned days
                </span>
              </div>
              <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">{p.citation}</p>
              {mode === "novice" ? <p className="mt-2 max-w-[80ch] text-[15px]">{p.guidance}</p> : null}

              <ul className="mt-3 max-w-[80ch]">
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
                      className="mb-2 flex flex-wrap items-baseline gap-3 text-[15px]"
                    >
                      <span>{d.label}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {d.optional ? "Offered" : "Required"}
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
                            <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(saved || attached))} label={saved || attached ? "Why this row" : "Why?"} />
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
                             <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(state))} label={state ? "Why this row" : "Why?"} />
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
                             <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(state))} label={state === false ? "Why?" : "Why this row"} />
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
                             <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(attached))} label={attached ? "Why this row" : "Why?"} />
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
                            <ExplainThis explanation={explainDocRow(d, p.phase, Boolean(state))} label={state === false ? "Why?" : "Why this row"} />
                          </span>

                        </>
                      )}
                      <span className="text-[13px] text-muted-foreground">{d.citation}</span>
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
                <div className="mt-3 max-w-[80ch] border border-border p-4">
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
                      determination (FAR 9.105-2(a)(1)). No memorandum is generated.
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
                      <span className="ml-2 text-muted-foreground">FAR 9.105-2(a)(1)</span>
                    </p>
                  ) : (
                    <p className="mt-3 text-[13px] text-muted-foreground">
                      Record the finding once the SAM.gov check and the FAR 9.104-1 factors have been reviewed.
                    </p>
                  )}
                </div>
              ) : null}


              {(p.phase === "Solicitation/Quote" || p.phase === "Award") && (
                <div className="mt-3 max-w-[80ch] border border-border p-4">
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
                      Demo note: clause reconciliation for this IDIQ vehicle is not complete. Don’t open the clause
                      delta on this file during the walkthrough — the packet below is illustrative, not the
                      reconciled vehicle clause set.
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
                    />
                  ) : null}
                  {packetSelection.length > 0 ? (
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
                  ) : null}
                  <FormatScaffoldPanel scaffold={formatScaffold} />
                  {p.phase === "Award" && packetSelection.some((c) => Array.isArray(c.fill_ins) && c.fill_ins.length > 0) ? (
                    <div className="mt-3 border border-border p-4">
                      <h5 className="text-[15px] font-medium">Fill-ins the award carries</h5>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        Read from the clause matrices. The officer sets each value before the award is written in NCMS.
                      </p>
                      <ul className="mt-2 space-y-1 text-[13px]">
                        {packetSelection
                          .filter((c) => Array.isArray(c.fill_ins) && c.fill_ins.length > 0)
                          .map((c) => (
                            <li key={c.clause_number}>
                              <span data-numeric>{c.clause_number}</span>{" "}
                              <span className="text-muted-foreground">
                                {(c.fill_ins as unknown[]).map((v) => String(v)).join("; ")}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                  <button type="button" onClick={downloadPacket} className="mt-3 text-[15px] text-primary">
                    Download the handoff packet
                  </button>
                </div>
              )}

              {p.phase === "Administration" ? (
                <div className="mt-3 max-w-[80ch] space-y-4">
                  <div className="border border-border p-4">
                    <h4 className="text-[15px] font-medium">Option exercise</h4>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Option dates come only from the contract schedule on the record. The
                      preliminary notice is due {options.noticeLeadDays} days before the option period begins (FAR
                      52.217-9 fill-in).
                    </p>
                    <table className="mt-3 w-full text-[13px] leading-[18px]">
                      <caption className="sr-only">Option periods and notice dates</caption>
                      <thead>
                        <tr className="border-y border-border text-left">
                          <th scope="col" className="p-2">Period</th>
                          <th scope="col" className="p-2">Start</th>
                          <th scope="col" className="p-2">End</th>
                          <th scope="col" className="p-2">Preliminary notice due</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border">
                          <td className="p-2">Base period</td>
                          <td className="p-2" data-numeric>{options.baseStart ?? "not recorded"}</td>
                          <td className="p-2" data-numeric>{options.baseEnd ?? "not recorded"}</td>
                          <td className="p-2">—</td>
                        </tr>
                        {options.periods.map((o) => (
                          <tr key={o.label} className="border-b border-border">
                            <td className="p-2">{o.label}</td>
                            <td className="p-2" data-numeric>{o.start ?? "not recorded"}</td>
                            <td className="p-2" data-numeric>{o.end ?? "not recorded"}</td>
                            <td className="p-2" data-numeric>{o.noticeDue ?? "not recorded"}</td>
                          </tr>
                        ))}
                        {options.periods.length === 0 ? (
                          <tr className="border-b border-border"><td colSpan={4} className="p-2 text-muted-foreground">Option dates are not recorded in the contract schedule.</td></tr>
                        ) : null}
                      </tbody>
                    </table>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="text-[13px]" htmlFor="option-notice-date">
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
                            reason: "FAR 17.207(a) preliminary notification to the contractor",
                            phase: "Administration",
                          })
                        }
                        className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                        data-numeric
                      />
                      <label className="text-[13px]" htmlFor="option-exercised-date">
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
                            reason: "FAR 17.207(c) determination signed and the option exercised",
                            phase: "Administration",
                          })
                        }
                        className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                        data-numeric
                      />
                    </div>

                    <p className="mt-3 text-[13px]">
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "option-exercise-notification", acquisitionId }}
                        className="text-primary"
                      >
                        Open the preliminary notice
                      </Link>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "option-exercise-determination", acquisitionId }}
                        className="text-primary"
                      >
                        Open the option exercise determination
                      </Link>
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        downloadModPacket("option exercise", "FAR 43.103(b)(1); FAR 52.217-9", options.periods[0] ?? null)
                      }
                      className="mt-3 text-[15px] text-primary"
                    >
                      Download the SF 30 handoff packet for the option modification
                    </button>
                  </div>

                  <div className="border border-border p-4">
                    <h4 className="text-[15px] font-medium">Contracting officer's representative</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <label className="text-[13px]" htmlFor="cor-appointed-date">
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
                            reason: "FAR 1.602-2(d) written appointment",
                            phase: "Administration",
                          })
                        }
                        className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                        data-numeric
                      />
                      <label className="text-[13px]" htmlFor="cor-cancelled-date">
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
                            reason: "FAR 1.602-2(d) appointment cancelled",
                            phase: "Administration",
                          })
                        }
                        className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                        data-numeric
                      />
                    </div>
                    <p className="mt-3 text-[13px]">
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "cor-appointment", acquisitionId }}
                        className="text-primary"
                      >
                        Open the appointment letter
                      </Link>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "cor-cancellation", acquisitionId }}
                        className="text-primary"
                      >
                        Open the cancellation memorandum
                      </Link>
                      <span className="ml-2 text-muted-foreground">NF 1098 tab 074 · FAR 1.602-2(d)</span>
                    </p>
                  </div>

                  <div className="border border-border p-4">
                    <h4 className="text-[15px] font-medium">CPARS input</h4>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {cpars.thresholdValue === null
                        ? "No CPARS threshold row is loaded."
                        : cpars.applies
                          ? `Required: the value is above ${formatMoney(cpars.thresholdValue)}.`
                          : `Not required: the value is at or below ${formatMoney(cpars.thresholdValue)}.`}{" "}
                      {cpars.citation ?? ""}
                    </p>
                    {cpars.applies ? (
                      <p className="mt-2 text-[13px]" data-numeric>
                        Evaluation period {awardDate ?? "not recorded"} to {cpars.periodEnd ?? "not recorded"}; input due{" "}
                        {cpars.dueDate ?? "not recorded"} (120 days after the period ends).
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="text-[13px]" htmlFor="cpars-submitted">
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
                        className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                        data-numeric
                      />
                      <Link
                        to="/documents/$templateKey/$acquisitionId"
                        params={{ templateKey: "cpars-input", acquisitionId }}
                        className="text-[13px] text-primary"
                      >
                        Open the CPARS input form
                      </Link>
                    </div>
                  </div>

                  {/* A clause delta only exists once there is a contract to modify. */}
                  {!String(acq?.["contract_number"] ?? "").trim() ? (
                    <div className="border border-border p-4">
                      <h4 className="text-[15px] font-medium">SF 30 modifications</h4>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        No contract number is recorded on this file yet. The clause delta appears after award, when
                        there is a contract to modify. Until then, clause changes are re-checked against the
                        solicitation.
                      </p>
                    </div>
                  ) : (
                  <div className="border border-border p-4">
                    <h4 className="text-[15px] font-medium">SF 30 modifications</h4>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      The modification of record is written in NCMS (NFS 1804.171). The clause set is read from the
                      clause matrices; removed clauses are struck and never carried forward.
                    </p>
                    {clauseDeltaWithheld ? (
                      <p className="mt-2 border border-border p-3 text-[13px] leading-[18px] text-muted-foreground">
                        Demo note: clause reconciliation for this IDIQ vehicle is not complete, so the clause delta
                        is withheld on this file. It is not shown on screen and is not part of the walkthrough. The
                        vehicle clause set is reconciled against the matrices before any modification is written in
                        NCMS.
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-[13px]" data-numeric>
                          {delta.updated.length} updated · {delta.removed.length} removed ·{" "}
                          {delta.unchanged.length} unchanged
                        </p>
                        <table className="mt-3 w-full text-[13px] leading-[18px]">
                          <caption className="sr-only">Clause delta for the modification</caption>
                          <thead>
                            <tr className="border-y border-border text-left">
                              <th scope="col" className="p-2">Clause</th>
                              <th scope="col" className="p-2">Change</th>
                              <th scope="col" className="p-2">Recorded status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ...delta.removed.map((c) => ({ c, change: "Removed" })),
                              ...delta.updated.map((c) => ({ c, change: "Updated" })),
                            ].map(({ c, change }) => (
                              <tr key={`${change}-${c.clause_number}`} className="border-b border-border">
                                <td className="p-2" data-numeric>{c.clause_number}</td>
                                <td className="p-2">
                                  <StatusMark
                                    color={change === "Removed" ? "var(--atrisk)" : "var(--attention)"}
                                    className="text-[13px]"
                                  >
                                    {change}
                                  </StatusMark>
                                </td>
                                <td className="p-2 text-muted-foreground">{c.status ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {modFillIns.length > 0 ? (
                          <div className="mt-3 border border-border p-3">
                            <h5 className="text-[15px] font-medium">Fill-ins on the updated clauses</h5>
                            <ul className="mt-2 space-y-1 text-[13px]">
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
                    <ul className="mt-3 list-disc pl-5 text-[13px] text-muted-foreground">
                      {SF30_CHECKLIST.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => downloadModPacket("administrative", "FAR 43.103(b); FAR 43.301", null)}
                      className="mt-3 text-[15px] text-primary"
                    >
                      Download the SF 30 handoff packet
                    </button>
                  </div>
                  )}
                </div>
              ) : null}

              {p.phase === "Closeout" ? (
                <div className="mt-3 max-w-[80ch] border border-border p-4">
                  <h4 className="text-[15px] font-medium">Closeout</h4>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="text-[13px]" htmlFor="closeout-pr">
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
                      className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                      data-numeric
                    />
                    <label className="text-[13px]" htmlFor="final-payment">
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
                          reason: "Records retention runs from final payment (FAR 4.805)",
                          phase: "Closeout",
                        })
                      }
                      className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                      data-numeric
                    />
                  </div>

                  <p className="mt-3 text-[13px]">
                    Records retention date{" "}
                    <span data-numeric>{retention.date ?? "not computed"}</span>
                    <span className="ml-2 text-muted-foreground">
                      {retention.years === null
                        ? "No retention row is loaded in thresholds."
                        : `${retention.years} years from the ${retention.fromLabel} (${retention.from ?? "no date"}). ${retention.citation ?? ""}`}
                    </span>
                  </p>

                  <h5 className="mt-4 text-[15px]">Closeout Transfer Checklist</h5>
                  <ul className="mt-2 list-disc pl-5 text-[13px] text-muted-foreground">
                    {CLOSEOUT_CHECKLIST.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[13px]">
                    <Link
                      to="/documents/$templateKey/$acquisitionId"
                      params={{ templateKey: "closeout-checklist", acquisitionId }}
                      className="text-primary"
                    >
                      Open the Closeout Transfer Checklist
                    </Link>
                    <span className="ml-2 text-muted-foreground">HQ 06/2026 · FAR 4.804-5; FAR 4.805</span>
                  </p>
                </div>
              ) : null}


              {p.phase === "Award" && protestDeadlines.length ? (
                <div className="mt-3 max-w-[80ch] border border-border p-4">
                  <h4 className="text-[15px] font-medium">Protest window</h4>
                  <p className="mt-1 text-[13px] text-muted-foreground">
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

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="text-[13px]" htmlFor="debriefing-date">
                      Debriefing date
                    </label>
                    <input
                      id="debriefing-date"
                      type="date"
                      value={debriefingDate ?? ""}
                      disabled={!canWrite}
                      onChange={(e) => setDebriefing.mutate(e.target.value)}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                      data-numeric
                    />
                    {debriefingDate && canWrite ? (
                      <button
                        type="button"
                        onClick={() => setDebriefing.mutate("")}
                        className="text-[13px] text-primary"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">
                        Leave blank if no debriefing was required.
                      </span>
                    )}
                  </div>

                  <table className="mt-3 w-full text-[13px] leading-[18px]">
                    <caption className="sr-only">Protest deadlines for this award</caption>
                    <thead>
                      <tr className="border-y border-border text-left">
                        <th scope="col" className="p-2">Deadline</th>
                        <th scope="col" className="p-2">Date</th>
                        <th scope="col" className="p-2">Days</th>
                        <th scope="col" className="p-2">Measured from</th>
                        <th scope="col" className="p-2">Citation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {protestDeadlines.map((d) => (
                        <tr key={d.key} className="border-b border-border align-top">
                          <td className="p-2">{d.label}</td>
                          <td className="p-2" data-numeric>
                            {d.date ?? "—"}
                          </td>
                          <td className="p-2" data-numeric>
                            {d.days === null ? "—" : `${d.days} days`}
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
                          <td className="p-2 text-muted-foreground">{d.measuredFrom}</td>
                          <td className="p-2 text-muted-foreground">
                            {d.citation ?? "—"}
                            {d.note ? <span className="block">{d.note}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className="mt-3 text-[13px]">
                    <Link to="/watch" search={{ tag: "Bid protest" }} className="text-primary">
                      Open the Watch items for protests
                    </Link>
                  </p>
                </div>
              ) : null}


              {effectiveState !== "launched" && (REVIEW_PHASES as readonly string[]).includes(p.phase) ? (
                <div id={`poll-${p.phase}`} className="mt-3 max-w-[80ch] border border-border">
                  <table className="w-full text-[13px] leading-[18px]">
                    <caption className="p-2 text-left text-muted-foreground">
                      Go/No-go poll for {p.phase}. Reviewers vote; approval stays with the contracting officer.
                    </caption>
                    <thead>
                      <tr className="border-y border-border text-left">
                        <th scope="col" className="p-2">Reviewer</th>
                        <th scope="col" className="p-2">Name</th>
                        <th scope="col" className="p-2">Vote</th>
                        <th scope="col" className="p-2">Due</th>
                        <th scope="col" className="p-2">Citation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(boards[p.phase] ?? []).length ? (
                        (boards[p.phase] ?? []).map((b) => (
                          <tr key={`${b.phase}-${b.reviewer_role}`} className="border-b border-border align-top">
                            <td className="p-2">{b.reviewer_role}</td>
                            <td className="p-2">{b.reviewer_name}</td>
                            <td className="p-2">
                              <StatusMark
                                color={
                                  b.vote === "go"
                                    ? "var(--ontrack)"
                                    : b.vote === "no-go"
                                      ? "var(--atrisk)"
                                      : "var(--attention)"
                                }
                              >
                                {b.vote === "go" ? "Go" : b.vote === "no-go" ? "No-go" : "Pending"}
                                {b.reason ? ` — ${b.reason}` : ""}
                                {b.poll_id ? "" : " (poll not opened)"}
                              </StatusMark>
                            </td>

                            <td className="p-2" data-numeric>
                              {b.due_date ?? "—"}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {b.citation}
                              <span className="mt-1 block">
                                <ExplainThis explanation={explainReview(b, acq as AcqRow)} />
                              </span>
                              {canWrite && b.poll_id ? (
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  onClick={() => showActionDialog({ kind: "vote", entry: b })}
                                  className="mt-1 h-auto p-0"
                                >
                                  Record vote
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="p-2 text-muted-foreground" colSpan={5}>
                            No review is triggered for this acquisition at this phase.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {canWrite && (boards[p.phase] ?? []).some((b) => !b.poll_id) ? (
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => showActionDialog({ kind: "open-poll", phase: p.phase })}
                        className="h-auto p-0"
                      >
                        Open the poll for {p.phase}
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

      <section className="mb-12 max-w-[80ch]">
        <h2 className="mb-2 text-[18px] leading-6 font-medium">Directive compliance</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">{DIRECTIVE_CITATION}</p>
        <label className="mb-3 flex items-center gap-2 text-[15px]">
          <input
            type="checkbox"
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

      {coldPathSample ? (
      <details aria-label="Thresholds" className="mb-12 rounded-xl border border-border bg-background">
        <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">
          Thresholds <span className="ml-2 text-[13px] font-normal text-muted-foreground">{q.data?.thresholds?.length ?? 0} entries</span>
        </summary>
        <div className="overflow-x-auto border-t border-border px-5 py-4">
        <p className="mb-3 max-w-[80ch] text-[13px] text-muted-foreground">
          Where {value === null ? "this acquisition" : formatMoney(value)} sits against each threshold in the table.
        </p>
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
                  <td className="p-2">{t.name}</td>
                  <td className="p-2" data-numeric>
                    {tv === null ? "—" : tv >= 1000 ? formatMoney(tv) : tv}
                  </td>
                  <td className="p-2">{above === null ? "—" : above ? "At or above" : "Below"}</td>
                  <td className="p-2">{t.tier}</td>
                  <td className="p-2" data-numeric>
                    {t.effective_date ?? "—"}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {t.citation}
                    {t.note && /conflict/i.test(t.note) ? (
                      <span className="mt-1 block" style={{ color: "var(--attention)" }}>
                        Conflict: {t.note}
                      </span>
                    ) : t.note ? (
                      <span className="mt-1 block">{t.note}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </details>
      ) : (
      <section className="mb-12">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Thresholds</h2>
        <p className="mb-3 max-w-[80ch] text-[13px] text-muted-foreground">
          Where {value === null ? "this acquisition" : formatMoney(value)} sits against each threshold in the table.
        </p>
        <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Threshold</th><th scope="col" className="p-2">Value</th><th scope="col" className="p-2">This acquisition</th><th scope="col" className="p-2">Tier</th><th scope="col" className="p-2">Effective</th><th scope="col" className="p-2">Citation and note</th>
            </tr>
          </thead>
          <tbody>{(q.data?.thresholds ?? []).map((t) => { const tv = t.value === null ? null : Number(t.value); const above = value !== null && tv !== null ? value >= tv : null; return <tr key={t.threshold_id} className="border-b border-border align-top"><td className="p-2">{t.name}</td><td className="p-2" data-numeric>{tv === null ? "—" : tv >= 1000 ? formatMoney(tv) : tv}</td><td className="p-2">{above === null ? "—" : above ? "At or above" : "Below"}</td><td className="p-2">{t.tier}</td><td className="p-2" data-numeric>{t.effective_date ?? "—"}</td><td className="p-2 text-muted-foreground">{t.citation}{t.note ? <span className="mt-1 block">{t.note}</span> : null}</td></tr>; })}</tbody>
        </table>
      </section>
      )}

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
                ? `Exit ${actionDialog.phase}`
                : actionDialog?.kind === "scrub"
                  ? `Scrub ${acquisitionId}`
                  : actionDialog?.kind === "remove"
                    ? `Remove ${actionDialog.doc.label}`
                    : actionDialog?.kind === "vote"
                      ? `Record ${actionDialog.entry.reviewer_role} vote`
                      : actionDialog?.kind === "open-poll"
                        ? `Open the ${actionDialog.phase} poll`
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
                      ? `This records the vote received from ${actionDialog.entry.reviewer_name} in the file audit history.`
                      : "This creates one pending seat for every required reviewer using the current Center reviewer table."}
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
                      the {entry.reviewer_role} vote
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
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium">Vote</legend>
                <div className="flex gap-4">
                  {(["go", "no-go"] as const).map((choice) => (
                    <label key={choice} className="flex items-center gap-2 text-[15px]">
                      <input type="radio" name="vote-choice" checked={voteChoice === choice} onChange={() => setVoteChoice(choice)} />
                      {choice === "go" ? "Go" : "No-go"}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block text-[13px]" htmlFor="vote-received">
                Date received
                <input id="vote-received" type="date" value={voteReceived} onChange={(e) => setVoteReceived(e.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-input bg-background px-3" />
              </label>
              <label className="block text-[13px]" htmlFor="vote-note">
                {voteChoice === "no-go" ? "Reason (required)" : "Note (optional)"}
                <textarea
                  id="vote-note"
                  value={voteNote}
                  onChange={(e) => setVoteNote(e.target.value)}
                  required={voteChoice === "no-go"}
                  aria-required={voteChoice === "no-go"}
                  className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2"
                />
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
                (actionDialog?.kind === "vote" && voteChoice === "no-go")
                  ? "destructive"
                  : "default"
              }
              disabled={
                !actionDialog ||
                ((actionDialog.kind === "exit" || actionDialog.kind === "scrub" || actionDialog.kind === "remove") && !actionReason.trim()) ||
                (actionDialog.kind === "exit" && Boolean(missingCurrentRequirements.length || pendingCurrentReviews.length)) ||
                (actionDialog.kind === "vote" && voteChoice === "no-go" && !voteNote.trim()) ||
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
                ? `Exit ${actionDialog.phase}`
                : actionDialog?.kind === "scrub"
                  ? "Scrub the acquisition"
                  : actionDialog?.kind === "remove"
                    ? "Remove the file"
                    : actionDialog?.kind === "vote"
                      ? voteChoice === "no-go"
                        ? "Record No-go"
                        : "Record Go"
                      : actionDialog?.kind === "open-poll"
                        ? "Open the poll"
                        : "Confirm"}
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="mb-10 min-w-0">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Facts of record</h2>
        <dl className="grid max-w-[80ch] gap-x-8 md:grid-cols-2">
          {(
            [
              ["Mission", q.data?.mission?.name ?? String(acq?.mission_id ?? "—")],
              ["Mission need date", String(acq?.need_date ?? "—")],
              ["Estimated value", value === null ? "—" : formatMoney(value)],
              ["Contract type", String(acq?.contract_type ?? "—")],
              ["Acquisition method", String(acq?.acquisition_method ?? "—")],
              ["Competition", String(acq?.competition ?? "—")],
              ["Set-aside", String(acq?.set_aside ?? "—")],
              ["NAICS", String(acq?.naics_code ?? "—")],
              ["PSC", String(acq?.psc_code ?? "—")],
              ["Place of performance", String(acq?.place_of_performance ?? "—")],
              [
                "Period of performance",
                `${acq?.period_of_performance_start ?? "—"} to ${acq?.period_of_performance_end ?? "—"}`,
              ],
              ["Regulatory baseline date", String(acq?.regulatory_baseline_date ?? "—")],
              [
                "Current phase",
                // The phase the file is actually in: a later phase cannot start
                // while an earlier one is short a required document.
                phases.find((p) => p.status === "current")?.phase ?? String(acq?.current_phase ?? "—"),
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

      {coldPathSample ? (
      <details aria-label="Audit trail" className="mb-10 min-w-0 rounded-xl border border-border bg-background">
        <summary className="cursor-pointer px-5 py-4 text-[18px] leading-6 font-medium">
          Audit trail <span className="ml-2 text-[13px] font-normal text-muted-foreground">{q.data?.log.length ?? 0} entries</span>
        </summary>
        <div className="min-w-0 border-t border-border px-5 py-4">
        {q.data?.log.length ? (
          <div className="w-full min-w-0 overflow-x-auto">
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
              {q.data.log.map((row) => (
                <tr key={row.log_id} className="border-b border-border align-top">
                  <td className="p-2">{new Date(row.logged_at).toLocaleString()}</td>
                  <td className="p-2">{row.actor}</td>
                  <td className="p-2">{row.action}</td>
                  <td className="p-2">{row.field}</td>
                  <td className="p-2">{row.new_value}</td>
                  <td className="p-2">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-muted-foreground">No entries yet for this file.</p>
        )}
        </div>
      </details>
      ) : (
      <section className="mb-10 min-w-0">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Audit trail</h2>
        {q.data?.log.length ? <div className="w-full min-w-0 overflow-x-auto"><table className="min-w-[760px] border border-border bg-background text-[13px] leading-[18px]"><thead><tr className="border-b border-border text-left"><th scope="col" className="p-2">Logged</th><th scope="col" className="p-2">Actor</th><th scope="col" className="p-2">Action</th><th scope="col" className="p-2">Field</th><th scope="col" className="p-2">New value</th><th scope="col" className="p-2">Reason</th></tr></thead><tbody>{q.data.log.map((row) => <tr key={row.log_id} className="border-b border-border align-top"><td className="p-2">{new Date(row.logged_at).toLocaleString()}</td><td className="p-2">{row.actor}</td><td className="p-2">{row.action}</td><td className="p-2">{row.field}</td><td className="p-2">{row.new_value}</td><td className="p-2">{row.reason}</td></tr>)}</tbody></table></div> : <p className="text-muted-foreground">No entries yet for this file.</p>}
      </section>
      )}

      <Link to="/files" className="text-primary underline underline-offset-2">
        Back to Files
      </Link>
    </AppShell>
  );
}
