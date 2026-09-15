import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { loadModTasks } from "@/lib/clause-impact";
import { useRole } from "@/components/role-context";
import { RegulationSidebar } from "@/components/regulation-sidebar";
import { Nf1707Signoffs } from "@/components/nf1707-signoffs";
import { userForRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import { addDays, daysBetween, formatMoney, todayISO, type RefData } from "@/lib/intake";
import { DIRECTIVE_CITATION, REVIEW_STATUSES, reviewStatus } from "@/lib/directives";
import {
  acquisitionType,
  buildPacket,
  buildSequence,
  computeHold,
  docSatisfied,
  NCMS_CHECKLIST,
  PACKET_CLAUSE_NUMBERS,
  pollBoard,
  REVIEW_PHASES,
  reviewRulesForPhase,
  type AcqRow,
  type BoardEntry,
  type PhaseView,
  type RequiredDoc,
} from "@/lib/launch-sequence";
import type { StoredEstimate } from "@/lib/estimator";
import { exportNearBundle } from "@/lib/near-export";
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
  explainMissingDoc,
  explainReview,
  explainStatus,
  explainWarrant,
} from "@/lib/explain";
import { successorFor } from "@/lib/successor";
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

/** The prototype has one seeded reviewer account; every review seat is
 *  assigned to it so the demo path can vote. */
const REVIEWER_NAME = userForRole("reviewer").name;

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
  const { authState, user, role } = useRole();
  const qc = useQueryClient();
  const canWrite = role === "specialist" || role === "hq";
  const [mode, setMode] = useState<Mode>("veteran");
  const [step, setStep] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  // Which phase the regulation sidebar is showing. Empty until the file loads,
  // then it follows the current phase unless the reader picks another.
  const [regPhase, setRegPhase] = useState<string | null>(null);

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
          .in("clause_number", PACKET_CLAUSE_NUMBERS),
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
      const [fileDocs, fileTemplates] = await Promise.all([
        supabase
          .from("documents")
          .select("template_id,version,saved_by,saved_at,issue_on_nf1858,memo_header")
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
        actor: user.name,
        action: "Acquisition Forecast entry generated",
        field: "acquisition_forecast_verified",
        old_value: String(acq.acquisition_forecast_verified ?? "not recorded"),
        new_value: "true",
        reason: `${FORECAST_CITATION}; entry exists, NF 1707 affirmation satisfied`,
        phase: null,
      } as never);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    })();
  }, [acq, forecast, canWrite, user.name, qc, acquisitionId]);

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
      actor: user.name,
      action: "Acquisition Forecast entry exported to CSV",
      field: "acquisition_forecast",
      old_value: null,
      new_value: forecast.value_range,
      reason: FORECAST_CITATION,
      phase: null,
    } as never);
    setBanner("The forecast entry downloaded as a CSV file in the forecast's format.");
  }


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

  const phases: PhaseView[] = useMemo(
    () => (acq ? buildSequence(acq, q.data?.plan ?? [], todayISO(), daysBetween) : []),
    [acq, q.data],
  );

  // Files uploaded against the documents on this record.
  const attachQ = useQuery({
    queryKey: ["file-attachments", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: () => loadAttachments(acquisitionId),
  });
  const attachments = useMemo(() => attachQ.data ?? [], [attachQ.data]);
  const attachmentFor = (key: string): AttachmentRow | null =>
    attachments.find((row) => row.doc_key === key) ?? null;

  // NF 1098 contract file index: tabs present, and required tabs with no document.
  const fileIndex = useMemo(
    () =>
      buildFileIndex(
        (q.data?.documents ?? []) as never,
        q.data?.templates ?? [],
        phases.map((p) => p.phase),
        attachments,
      ),
    [q.data?.documents, q.data?.templates, phases, attachments],
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
      plan: q.data?.plan ?? [],
      rules: q.data?.rules ?? [],
      polls: q.data?.polls ?? [],
      ref,
      mission: q.data?.mission
        ? { mission_id: String(acq.mission_id ?? ""), name: q.data.mission.name ?? "Mission", program: null, center_code: acq.center_code ?? null, milestone: null, milestone_date: q.data.mission.milestone_date, priority: null, program_owner: null, leadership_note: null }
        : null,
      holdSince: holdSince(acq.acquisition_id, q.data?.log ?? []),
      awardDate: awardDateFor(acq.acquisition_id, q.data?.log ?? [], acq.target_award_date ?? null),
    });
  }, [acq, q.data, ref]);

  const phaseNames = useMemo(() => phases.map((p) => p.phase), [phases]);
  const sidebarPhase =
    regPhase && phaseNames.includes(regPhase)
      ? regPhase
      : (phases.find((p) => p.status === "current")?.phase ?? phaseNames[0] ?? "Intake");

  const hold = lifecycle?.hold ?? null;
  const effectiveState = lifecycle?.clockState ?? null;

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
          reviewer_name: REVIEWER_NAME,
          vote: "pending",
          due_date: addDays(todayISO(), r.planned_days ?? 5),
        }));
      if (!rows.length) return;
      const { error } = await supabase.from("polls").insert(rows);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        acquisition_id: acq.acquisition_id,
        actor: user.name,
        action: "Poll opened",
        field: "polls",
        new_value: `${rows.length} reviewer${rows.length === 1 ? "" : "s"}`,
        reason: `${phase} requires review`,
        phase,
      });
    },
    onSuccess: () => {
      setBanner("The poll is open. Reviewers can vote on the documents for that phase.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: Error) => setBanner(`The poll did not open: ${e.message}. Try again.`),
  });

  // Age of the current hold, against the Center's own aging window.
  const holdAge = ageInDays((acq?.['hold_started_at'] as string | null) ?? null);
  const holdThreshold = thresholdFor(
    acq?.center_code ? String(acq.center_code) : null,
    (q.data?.centers ?? []) as { center_code: string; aging_threshold_days?: number | null }[],
  );

  const days = lifecycle?.daysToAward ?? null;

  const currentIndex = Math.max(
    0,
    phases.findIndex((p) => p.status === "current"),
  );
  const shownPhases = mode === "novice" ? phases.slice(step || currentIndex, (step || currentIndex) + 1) : phases;

  const setDoc = useMutation({
    mutationFn: async ({ doc, attach }: { doc: RequiredDoc; attach: boolean }) => {
      if (!acq || !doc.field) return;
      const value = doc.field === "jofoc_authority_citation" ? (attach ? "RFO FAR 6.301(a)(1)" : "") : attach;
      const next: Record<string, unknown> = { [doc.field]: value, updated_at: new Date().toISOString() };

      // recompute the clock with the new value applied
      const after = { ...acq, [doc.field]: value } as AcqRow;
      const cause = computeHold(after, buildSequence(after, q.data?.plan ?? [], todayISO(), daysBetween), board);
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
          actor: user.name,
          action: attach ? "Document attached" : "Document removed",
          field: doc.field,
          old_value: String(acq[doc.field] ?? ""),
          new_value: String(value),
          reason: doc.label,
        },
        {
          acquisition_id: acq.acquisition_id,
          actor: user.name,
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
    },
    onError: (e: Error) => setBanner(`That change did not save: ${e.message}. Try again.`),
  });

  // Attaching a required document: store the file, index it, audit it, and only
  // then mark the row Attached. Cancelling the picker changes nothing.
  const attachDoc = useMutation({
    mutationFn: async ({ doc, file }: { doc: RequiredDoc; file: File }) => {
      const key = docKey(doc.field, doc.label);
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
      await uploadAttachment({ acquisitionId, key, label: doc.label, file, actor: user.name, parsedTotal: total });
      const satisfies = key !== "igce_attached" || total !== null;
      if (doc.field && satisfies) await setDoc.mutateAsync({ doc, attach: true });
      return { fileName: file.name, label: doc.label, total, clinCount, satisfies, readFailed };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["file-attachments", acquisitionId] });
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
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
    mutationFn: async (doc: RequiredDoc) => {
      const key = docKey(doc.field, doc.label);
      const row = attachmentFor(key);
      if (row) await removeAttachment(row, user.name);
      if (doc.field) await setDoc.mutateAsync({ doc, attach: false });
      return doc.label;
    },
    onSuccess: (label) => {
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
        actor: user.name,
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
    },
    onError: (e: Error) => setBanner(`The finding did not save: ${e.message}. Try again.`),
  });

  const scrub = useMutation({
    mutationFn: async (reason: string) => {
      if (!acq) return;
      const { error } = await supabase
        .from("acquisition_facts")
        .update({
          clock_state: "hold",
          hold_reason: reason,
          hold_owner: user.name,
          status: "scrubbed",
          hold_started_at: new Date().toISOString(),
        })
        .eq("acquisition_id", acq.acquisition_id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        acquisition_id: acq.acquisition_id,
        actor: user.name,
        action: "Scrubbed",
        field: "clock_state",
        old_value: String(acq.clock_state ?? ""),
        new_value: "hold",
        reason,
      });
    },
    onSuccess: () => {
      setBanner("The acquisition is scrubbed and the reason is in the record.");
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
  });

  const launch = useMutation({
    mutationFn: async () => {
      if (!acq) return;
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
        actor: user.name,
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
    },
    onError: (e: Error) => setBanner(`${e.message}.`),
  });

  const nearExport = useMutation({
    mutationFn: async () => exportNearBundle(acquisitionId, user.name),
    onSuccess: (r) => {
      setBanner(`Export ready: ${r.fileName}.`);
      void qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: unknown) =>
      setBanner(
        `The export could not be built: ${e instanceof Error ? e.message : "unknown reason"}. Try again in a moment.`,
      ),
  });


  function downloadPacket() {
    if (!acq) return;
    const packet = buildPacket(acq, q.data?.clauses ?? [], phases, board);
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ncms-handoff-${acq.acquisition_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        actor: user.name,
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
        actor: user.name,
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
        throw new Error("Your role cannot change this file. Switch to the contracting specialist role");
      await supabase.from("audit_log").insert({
        acquisition_id: acq.acquisition_id,
        actor: user.name,
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
        actor: user.name,
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
      actor: user.name,
      action: "SF 30 modification handoff packet built",
      field: "modification",
      old_value: null,
      new_value: kind,
      reason: `${authority}; ${delta.updated.length} clauses updated, ${delta.removed.length} removed`,
      phase: "Administration",
    });
  }

  return (
    <AppShell>
      <PageHeader
        title={acq?.title ?? acquisitionId}
        lead={acq ? `${acquisitionId} · ${acq.center_code ?? ""} · ${acquisitionType(acq).replace(/_/g, " ")}` : "Loading the file."}
      />

      {q.isLoading ? <LoadingNote what="the acquisition file" /> : null}

      {banner ? (
        <p className="mb-6 border-l-2 py-1 pl-3 text-[13px]" style={{ borderColor: "var(--attention)" }}>
          {banner}
        </p>
      ) : null}

      {!q.isLoading ? <section aria-label="Clock line" className="mb-10 rounded-lg bg-panel px-8 py-8 text-panel-foreground">
        <div className="grid gap-8 sm:grid-cols-4">
          <div>
            <p className="clock-figure" data-numeric>
              {effectiveState === "launched" ? (lifecycle?.daysSinceAward ?? 0) : effectiveState === "scrubbed" ? "Stopped" : days === null ? "Not started" : days}
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">
              {effectiveState === "launched" ? "Days since award" : effectiveState === "scrubbed" ? "Countdown" : "Days to award"}
            </p>
          </div>
          <div>
            <p className="text-[18px] leading-6 font-medium" data-numeric>
              {effectiveState === "launched" ? (lifecycle?.awardDate ?? "Not recorded") : (acq?.target_award_date ?? "Not recorded")}
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">{effectiveState === "launched" ? "Award date" : "Target award date"}</p>
          </div>
          <div>
            <p className="text-[18px] leading-6 font-medium">
              {effectiveState === "running"
                ? "Clock running"
                : effectiveState === "hold"
                  ? "On hold"
                  : effectiveState === "launched"
                    ? "Launched"
                    : (effectiveState ?? "—")}
            </p>
            <p className="mt-1 text-[13px] text-panel-muted">Clock state</p>
          </div>
          <div>
            <p className="text-[18px] leading-6 font-medium">{lifecycle?.blocker === "None" ? lifecycle.nextAction : lifecycle?.blocker ?? "Loading"}</p>
            <p className="mt-1 text-[13px] text-panel-muted">
              {lifecycle?.blockerOwner ?? (effectiveState === "launched" ? "Post-award next action" : effectiveState === "scrubbed" ? "No countdown" : "Next action")}
            </p>
            {effectiveState === "hold" && holdAge !== null ? (
              <p className="mt-1 text-[13px] text-panel-muted">
                {holdAge >= holdThreshold
                  ? `Aging: on hold ${holdAge} days, past the ${holdThreshold}-day Center window`
                  : `On hold ${holdAge} days; aging after ${holdThreshold} days`}
              </p>
            ) : null}
          </div>
        </div>
      </section> : null}

      <div className="mb-10 flex flex-wrap items-start gap-6">
        <ExplainThis explanation={statusExplanation} label="Explain this status" />
        {hold ? (
          <ExplainThis explanation={explainHold(hold, acq as AcqRow)} label="Explain this hold" />
        ) : null}
      </div>


      {warrant ? (
        <section aria-label="Warrant check" className="mb-10 max-w-[70ch]">
          <h2 className="mb-1 text-[18px] leading-6 font-medium">Warrant check</h2>
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
        </section>
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

      {phaseNames.length ? (
        <RegulationSidebar phase={sidebarPhase} phases={phaseNames} onPhaseChange={setRegPhase} />
      ) : null}

      <section aria-label="Acquisition Forecast" className="mb-10 max-w-[70ch]">
        <h2 className="mb-1 text-[18px] font-medium leading-[24px]">Acquisition Forecast</h2>
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
      </section>


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

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-muted-foreground">View</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {(["novice", "veteran"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setStep(currentIndex);
              }}
              aria-pressed={mode === m}
              className={
                mode === m
                  ? "bg-primary px-3 py-2 text-[13px] text-primary-foreground"
                  : "px-3 py-2 text-[13px] text-muted-foreground"
              }
            >
              {m === "novice" ? "Novice mode" : "Veteran mode"}
            </button>
          ))}
        </div>
        {canWrite && acq?.clock_state !== "launched" ? (
          <>
            <button
              type="button"
              onClick={() => launch.mutate()}
              className="rounded-lg border border-border px-3 py-2 text-[13px]"
            >
              Launched
            </button>
            <button
              type="button"
              onClick={() => {
                const reason = window.prompt("Why is this acquisition being scrubbed?");
                if (reason?.trim()) scrub.mutate(reason.trim());
              }}
              className="rounded-lg border border-border px-3 py-2 text-[13px]"
              style={{ color: "var(--atrisk)" }}
            >
              Scrub with a reason
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => nearExport.mutate()}
          disabled={nearExport.isPending}
          className="rounded-lg border border-border px-3 py-2 text-[13px] disabled:opacity-40"
        >
          {nearExport.isPending ? "Building the export" : "Export file for NEAR"}
        </button>
      </div>

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

      <ClauseModTasks acquisitionId={acquisitionId} />

      <Nf1707Signoffs
        acquisitionId={acquisitionId}
        centerCode={acq?.center_code ?? null}
        storedAnswers={(acq?.['nf1707_answers'] ?? {}) as Record<string, unknown>}
        rows={q.data?.nfApprovals ?? []}
        routing={q.data?.memoRouting ?? []}
        canWrite={canWrite}
        actor={user.name}
        onBanner={setBanner}
        onChanged={async () => { await qc.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] }); }}
      />

      <section aria-label="Contract file index" className="mb-12">
        <h2 className="mb-1 text-[18px] leading-6 font-medium">Contract file index</h2>
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
      </section>

      <section aria-label="Launch sequence" className="mb-12">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Launch sequence</h2>

        {mode === "novice" ? (
          <div className="mb-4 flex items-center gap-3 text-[13px]">
            <button
              type="button"
              disabled={(step || currentIndex) === 0}
              onClick={() => setStep(Math.max(0, (step || currentIndex) - 1))}
              className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
            >
              Previous phase
            </button>
            <span className="text-muted-foreground" data-numeric>
              Phase {(step || currentIndex) + 1} of {phases.length}
            </span>
            <button
              type="button"
              disabled={(step || currentIndex) >= phases.length - 1}
              onClick={() => setStep(Math.min(phases.length - 1, (step || currentIndex) + 1))}
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
                  const key = docKey(d.field, d.label);
                  const attached = attachmentFor(key);
                  const state = docSatisfied(
                    d,
                    acq ?? ({ acquisition_id: "" } as AcqRow),
                    d.field ? Boolean(attached) : undefined,
                  );
                  const busy = attachDoc.isPending || detachDoc.isPending;
                  return (
                    <li key={d.label} className="mb-2 flex flex-wrap items-baseline gap-3 text-[15px]">
                      <span>{d.label}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {d.optional ? "Offered" : "Required"}
                      </span>
                      {state === null ? (
                        d.link === "packet" ? (
                          <button type="button" onClick={downloadPacket} className="text-[13px] text-primary">
                            Open the NCMS handoff packet
                          </button>
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
                            {state ? "Attached" : "Missing"}
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
                                onClick={() => detachDoc.mutate(d)}
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
                          {state === false ? (
                            <span className="block w-full">
                              <ExplainThis explanation={explainMissingDoc(d, p.phase)} />
                            </span>
                          ) : null}
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
                    FAR 12.204(b)(1) · the determination of record for price reasonableness
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
                    {q.data?.clauses.length ?? 0} clauses in the packet, read from the clause table.
                  </p>
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

                  <div className="border border-border p-4">
                    <h4 className="text-[15px] font-medium">SF 30 modifications</h4>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      The modification of record is written in NCMS (NFS CG 1804.11). The clause delta below is read
                      from the clause matrices; removed clauses are struck and never carried forward.
                    </p>
                    <p className="mt-2 text-[13px]" data-numeric>
                      {delta.updated.length} updated · {delta.removed.length} removed · {delta.unchanged.length}{" "}
                      unchanged
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
                <div className="mt-3 max-w-[80ch] border border-border">
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
                      <button
                        type="button"
                        onClick={() => openPoll.mutate(p.phase)}
                        className="text-[13px] text-primary"
                      >
                        Open the poll for {p.phase}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

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

      <section className="mb-12">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Thresholds</h2>
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
      </section>

      <section className="mb-10">
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
              ["Current phase", String(acq?.current_phase ?? "—")],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="mb-3">
              <dt className="text-[13px] text-muted-foreground">{k}</dt>
              <dd className="text-[15px]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">Audit trail</h2>
        {q.data?.log.length ? (
          <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
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
        ) : (
          <p className="text-muted-foreground">No entries yet for this file.</p>
        )}
      </section>

      <Link to="/files" className="text-primary underline underline-offset-2">
        Back to Files
      </Link>
    </AppShell>
  );
}
