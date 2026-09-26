import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { loadLaunchEvents } from "@/lib/launch-events";
import type { CenterOverrideRow } from "@/lib/center-config";
import { formatMoney, todayISO, type RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow } from "@/lib/launch-sequence";
import { attachedKeys as keysFrom, savedDocKeys } from "@/lib/hold";
import { awardConfidence, historyFrom, type AwardConfidence } from "@/lib/confidence";
import { RowKeysHint, useRowKeysContainer } from "@/components/row-keys";
import { PilotKnownGapsLine } from "@/components/pilot-known-gaps";
import {
  computeMetrics,
  holdSince,
  type AcqMetrics,
  type MissionRow,
} from "@/lib/metrics";
import { LaunchCountdownCompact } from "@/components/launch-countdown";
import { MissionReadinessChip, missionReadinessClass } from "@/components/mission-control/primitives";
import { explainWorkReadiness, type ReadinessExplanation } from "@/components/mission-control/readiness";
import { deriveOverviewAcquisitionState, overviewCountdownView } from "@/components/mission-control/operational-state";
import {
  PriorityBand,
  WorkTriageSignal,
  priorityBand,
  type PriorityBandValue,
} from "@/components/mission-control/work-triage";

export const Route = createFileRoute("/work-queue")({
  head: () => ({
    meta: [
      { title: "Work Queue — T-Minus" },
      {
        name: "description",
        content: "Files you own, what each one is waiting on, and when the next decision is due.",
      },
      { property: "og:title", content: "Work Queue — T-Minus" },
      {
        property: "og:description",
        content: "Files you own, what each one is waiting on, and when the next decision is due.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkQueuePage,
});

const COLUMNS = ["Ready", "In progress", "Blocked", "Awaiting Go/No-go", "Launched"] as const;
type Column = (typeof COLUMNS)[number];
const COLUMN_LABEL: Record<Column, string> = {
  Ready: "Not started",
  "In progress": "In progress",
  Blocked: "Blocked",
  "Awaiting Go/No-go": "Awaiting Go/No-go",
  Launched: "Launched",
};

type Card = {
  m: AcqMetrics;
  column: Column;
  acquisitionId: string;
  title: string;
  owner: string;
  mission: string;
  value: string;
  method: string;
  priority: number | null;
  priorityBand: PriorityBandValue | null;
  readiness: ReadinessExplanation;
  nextTask: string;
  dependency: string;
  daysInPhase: number | null;
  /** Recorded target days to award; forecasts never masquerade as targets. */
  days: number | null;
  /** Planned working days and the range prior files of this profile took. */
  confidence: AwardConfidence;
};

function columnFor(m: AcqMetrics, readiness = explainWorkReadiness(m)): Column {
  if (readiness.state === "LAUNCHED") return "Launched";
  if (readiness.state === "HOLD") return "Blocked";
  if (m.board.some((b) => b.vote === "pending")) return "Awaiting Go/No-go";
  const started = m.phases.some((p) => p.status === "complete") || m.clockState === "running";
  return started ? "In progress" : "Ready";
}

function WorkQueuePage() {
  const { authState, user, roles } = useRole();
  const today = todayISO();
  // A requester and a reviewer each have their own desk. The board is the
  // contracting queue and is not their home.
  const isAdministrator = roles.includes("administrator");
  const deskInstead =
    isAdministrator || roles.includes("specialist")
      ? null
      : roles.includes("requester")
        ? ("/requester" as const)
        : roles.includes("reviewer")
          ? ("/reviewer-inbox" as const)
          : null;

  const [view, setView] = useState<"board" | "list">("board");
  const [sortBy, setSortBy] = useState<"owner" | "phase" | "days" | "priority">("owner");
  const rowsRef = useRowKeysContainer<HTMLTableSectionElement>();
  const [scope, setScope] = useState<"all" | "mine" | "branch" | "center">("all");
  const [missionId, setMissionId] = useState<string>("all");

  const q = useQuery({
    queryKey: ["work-queue"],
    enabled: authState === "signed-in",
    refetchInterval: 5000,
    queryFn: async () => {
      const [missions, acqs, plan, rules, overrides, thresholds, strategies, polls, log, users, launches] = await Promise.all([
        supabase.from("missions").select("*").order("priority"),
        supabase.from("acquisition_facts").select("*").order("acquisition_id"),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("review_rules").select("*"),
        supabase.from("center_overrides").select("*"),
        supabase.from("thresholds").select("*"),
        supabase.from("enterprise_strategies").select("*"),
        supabase.from("polls").select("*"),
        supabase
          .from("audit_log")
          .select("acquisition_id,action,actor,logged_at,phase")
          .order("logged_at", { ascending: false })
          .limit(500),
        supabase.from("users").select("name,title,center_code"),
        loadLaunchEvents(),
      ]);
      const attachments = await supabase.from("document_attachments").select("acquisition_id,doc_key");
      const [documents, templateRows] = await Promise.all([
        supabase.from("documents").select("acquisition_id,template_id"),
        supabase.from("templates").select("template_id,name"),
      ]);
      return {
        missions: (missions.data ?? []) as MissionRow[],
        acqs: (acqs.data ?? []) as unknown as AcqRow[],
        plan: (plan.data ?? []) as PhasePlanRow[],
        rules: (rules.data ?? []) as ReviewRuleRow[],
        overrides: overrides.data ?? [],
        thresholds: thresholds.data ?? [],
        strategies: strategies.data ?? [],
        polls: (polls.data ?? []) as PollRow[],
        attachments: attachments.data ?? [],
        documents: documents.data ?? [],
        templates: templateRows.data ?? [],
        log: log.data ?? [],
        launches,
        users: (users.data ?? []) as { name: string; title: string | null; center_code: string | null }[],
      };
    },
  });

  const ref: RefData = useMemo(
    () => ({
      thresholds: (q.data?.thresholds ?? []).map((t) => ({
        name: t.name,
        value: t.value === null ? null : Number(t.value),
        citation: t.citation,
        note: t.note,
      })),
      overrides: (q.data?.overrides ?? []) as unknown as CenterOverrideRow[],
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

  const cards: Card[] = useMemo(() => {
    if (!q.data) return [];
    const history = historyFrom(q.data.acqs as unknown as AcqRow[], q.data.launches);
    return q.data.acqs
      .filter((a) => String(a.clock_state ?? "") !== "scrubbed")
      .map((acq) => {
        const operational = deriveOverviewAcquisitionState(acq, [...q.data.log, ...q.data.launches]);
        const mission = q.data.missions.find((m) => m.mission_id === acq.mission_id) ?? null;
        const m = computeMetrics(operational.acquisition, {
          attachedKeys: keysFrom(q.data.attachments ?? [], acq.acquisition_id),
          savedKeys: savedDocKeys(q.data.documents ?? [], q.data.templates ?? [], acq.acquisition_id),
          roster: q.data.users ?? [],
          plan: q.data.plan,
          rules: q.data.rules,
          polls: q.data.polls,
          ref,
          mission,
          holdSince: holdSince(acq.acquisition_id, q.data.log),
          awardDate: operational.actualAwardDate,
        });
        const current = m.phases.find((p) => p.status === "current") ?? null;
        const readiness = explainWorkReadiness(m);
        const recordedValue = acq.estimated_value;
        const rawValue = recordedValue === null || recordedValue === undefined || recordedValue === ""
          ? null
          : Number(recordedValue);
        const priority = mission?.priority ?? null;
        const dependency = m.blocker === "None"
          ? "None"
          : `${m.blocker}${m.blockerOwner ? ` · owner ${m.blockerOwner}` : ""}`;
        return {
          m,
          column: columnFor(m, readiness),
          acquisitionId: acq.acquisition_id,
          title: String(acq.title ?? acq.acquisition_id),
          owner: String(acq.co_name ?? "").trim() || "Not recorded",
          mission: mission?.name ?? "No mission linked",
          value: rawValue !== null && Number.isFinite(rawValue) ? `IGCE ${formatMoney(rawValue)}` : "Not recorded",
          method: String(acq.acquisition_method ?? "").trim() || "Not recorded",
          priority,
          priorityBand: priorityBand(priority),
          readiness,
          nextTask: readiness.nextAction,
          dependency,
          daysInPhase: current?.actual_days ?? null,
          days: m.daysToAward,
          confidence: awardConfidence(acq as unknown as AcqRow, history, q.data.plan as PhasePlanRow[]),
        };
      });
  }, [q.data, ref]);

  // The seeded users carry a Center but no branch, so "My branch" reads the
  // branch of the files the signed-in person owns.
  const myBranch = useMemo(() => {
    const owned = cards.find((c) => c.owner.startsWith(user.name.split(" ")[0] ?? "") || c.owner === user.name);
    return owned ? String(owned.m.acq['branch_code'] ?? "") : "";
  }, [cards, user.name]);

  const filtered = useMemo(
    () =>
      cards.filter((c) => {
        if (missionId !== "all" && c.m.acq.mission_id !== missionId) return false;
        if (scope === "mine")
          return c.owner === user.name || String(c.m.acq['requester_name'] ?? "") === user.name;
        if (scope === "branch") return Boolean(myBranch) && String(c.m.acq['branch_code'] ?? "") === myBranch;
        if (scope === "center") return String(c.m.acq.center_code ?? "") === user.center_code;
        return true;
      }),
    [cards, missionId, scope, user, myBranch],
  );

  const priorityRank = (card: Card) => {
    if (card.priorityBand === "P1") return 0;
    if (card.priorityBand === "P2–3") return 1;
    if (card.priorityBand === "P4+") return 2;
    return 3;
  };

  // The list view sorts by owner, phase, target days, or the mission's recorded priority.
  const sortedList = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortBy === "owner") return a.owner.localeCompare(b.owner);
      if (sortBy === "phase") return String(a.m.currentPhase ?? "").localeCompare(String(b.m.currentPhase ?? ""));
      if (sortBy === "priority") return priorityRank(a) - priorityRank(b);
      const value = (c: Card) => (typeof c.days === "number" ? c.days : Number.POSITIVE_INFINITY);
      return value(a) - value(b);
    });
    return rows;
  }, [filtered, sortBy]);

  if (deskInstead) return <Navigate to={deskInstead} replace />;

  return (
    <AppShell>
      <PageHeader
        title="Work Queue"
        lead="Files you own, what each one is waiting on, and when the next decision is due."
      />

      <div className="mc-work-toolbar mb-6 flex flex-wrap items-end">
        <Link
          to="/intake"
          className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground"
        >
          Start an intake
        </Link>

        <div>
          <label htmlFor="scope" className="block text-[13px] text-muted-foreground">
            Show
          </label>
          <select
            id="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
             className="mt-1 rounded-[var(--mc-radius-control)] border border-border bg-background px-3 py-2 text-[15px]"
          >
            <option value="all">Everything</option>
            <option value="mine">Mine</option>
            <option value="branch">My branch{myBranch ? ` (${myBranch})` : ""}</option>
            <option value="center">My Center ({user.center_code})</option>
          </select>
        </div>

        <div>
          <label htmlFor="mission" className="block text-[13px] text-muted-foreground">
            Mission
          </label>
          <select
            id="mission"
            value={missionId}
            onChange={(e) => setMissionId(e.target.value)}
             className="mt-1 rounded-[var(--mc-radius-control)] border border-border bg-background px-3 py-2 text-[15px]"
          >
            <option value="all">Every mission</option>
            {(q.data?.missions ?? []).map((m) => (
              <option key={m.mission_id} value={m.mission_id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div role="group" aria-label="View" className="flex gap-4">
          {(["board", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={
                view === v
                  ? "border-b-2 border-primary pb-1 text-[15px] font-medium text-foreground"
                  : "border-b-2 border-transparent pb-1 text-[15px] text-muted-foreground hover:text-foreground"
              }
            >
              {v === "board" ? "Board" : "List"}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-6 text-[13px] text-muted-foreground">
        Cards open the file. Status changes happen in the file, not by dragging.
      </p>

      {q.isLoading ? (
        <LoadingNote what="the queue" />
      ) : q.isError ? (
        <ErrorNote message="The queue did not load. Refresh the page; if it fails again, open Seed status to confirm the records loaded." />
      ) : filtered.length === 0 ? (
        <EmptyState
          sentence="No file matches this filter."
          action={
            <button
              type="button"
              onClick={() => {
                setScope("all");
                setMissionId("all");
              }}
              className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground"
            >
              Show everything
            </button>
          }
        />
      ) : view === "board" ? (

        <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = filtered
              .filter((c) => c.column === col)
              .sort((a, b) => priorityRank(a) - priorityRank(b));
            return (
              <section key={col} aria-label={COLUMN_LABEL[col]}>
                <div className="flex min-h-11 items-baseline justify-between border-b border-border pb-3">
                <h2 className="text-[15px] leading-6 font-medium">{COLUMN_LABEL[col]}</h2>
                <p className="text-[13px] text-muted-foreground" data-numeric>
                  {items.length} {items.length === 1 ? "file" : "files"}
                </p>
                </div>
                <ul className="mt-4 space-y-4">
                  {items.length === 0 ? (
                    <li className="text-[13px] text-muted-foreground">No file is in this column.</li>
                  ) : null}
                  {items.map((c) => (
                    <li key={c.m.acq.acquisition_id}>
                      <CardView c={c} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <>
        <div className="mb-4">
          <label htmlFor="sort" className="block text-[13px] text-muted-foreground">Sort by</label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
             className="mt-1 rounded-[var(--mc-radius-control)] border border-border bg-background px-3 py-2 text-[15px]"
          >
            <option value="owner">Owner</option>
            <option value="phase">Phase</option>
            <option value="days">Days to award</option>
            <option value="priority">Priority</option>
          </select>
        </div>
        <RowKeysHint />
        <div className="mc-work-table-wrap mt-3">
        <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Acquisition</th>
              <th scope="col" className="p-2 whitespace-nowrap">Priority</th>
              <th scope="col" className="p-2">Status</th>
              <th scope="col" className="p-2">T±</th>
              <th scope="col" className="p-2">Owner</th>
              <th scope="col" className="p-2">Next task</th>
              <th scope="col" className="p-2">Waiting on</th>
              <th scope="col" className="p-2">Phase</th>
            </tr>
          </thead>
          <tbody ref={rowsRef}>
            {sortedList.map((c) => (
              <tr
                key={c.acquisitionId}
                data-row-nav
                tabIndex={0}
                className={`mc-work-table-row ${missionReadinessClass(c.readiness.state, "is")} border-b border-border align-top last:border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                <td className="p-2 break-words">
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: c.acquisitionId }}
                    className="text-primary hover:text-primary-hover"
                  >
                    <span className="block text-[12px] text-muted-foreground" data-numeric>{c.acquisitionId}</span>
                    <span className="block font-medium">{c.title}</span>
                  </Link>
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: c.acquisitionId }}
                    hash="launch-sequence"
                    data-row-action="exit"
                    className="sr-only"
                  >
                    Open the launch sequence for {c.acquisitionId}
                  </Link>
                  {/^write\b/i.test(c.nextTask ?? "") ? (
                    <Link
                      to="/files/$acquisitionId"
                      params={{ acquisitionId: c.acquisitionId }}
                      data-row-action="write"
                      className="sr-only"
                    >
                      {c.nextTask} on {c.acquisitionId}
                    </Link>
                  ) : null}
                  <span className="mt-1 block text-[12px] text-muted-foreground">{c.value} · {c.method}</span>
                  <span className="mt-1 block text-[12px] text-muted-foreground">{c.mission}</span>
                </td>
                <td className="p-2 whitespace-nowrap"><PriorityBand priority={c.priority} /></td>
                <td className="p-2"><MissionReadinessChip state={c.readiness.state} /><WorkTriageSignal readiness={c.readiness} /><span className="mt-1 block text-[12px] text-muted-foreground">Column: {COLUMN_LABEL[c.column]}</span></td>
                <td className="p-2" data-numeric>
                  <span className="whitespace-nowrap"><LaunchCountdownCompact view={overviewCountdownView(c.m)} /></span>
                  {c.readiness.state === "LAUNCHED" ? null : (
                    <span className="mt-1 block text-[12px] leading-[16px] text-muted-foreground">
                      {c.confidence.sentence}
                    </span>
                  )}
                </td>
                <td className="p-2 break-words">{c.owner}</td>
                <td className="p-2 break-words">{c.nextTask}</td>
                <td className="p-2 break-words">{c.dependency}</td>
                <td className="p-2 break-words">{c.m.currentPhase ?? "Not started"}<span className="mt-1 block text-[12px] text-muted-foreground" data-numeric>{c.daysInPhase ?? "Not recorded"} days in phase</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </>
      )}

      <p className="mt-6 text-[13px] text-muted-foreground" data-numeric>
        {filtered.length} of {cards.length} files shown. Today is {today}.
      </p>
      <PilotKnownGapsLine className="mt-8" />
    </AppShell>
  );
}

function CardView({ c }: { c: Card }) {
  return (
    <Link
      to="/files/$acquisitionId"
      params={{ acquisitionId: c.acquisitionId }}
      className={`mc-work-card ${missionReadinessClass(c.readiness.state, "is")} block transition-colors duration-150 hover:border-primary`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <span className="text-[12px] text-muted-foreground" data-numeric>{c.acquisitionId}</span>
          <p className="mt-1 break-words text-[15px] leading-[22px] font-medium">
            {c.title}
          </p>
        </div>
        <MissionReadinessChip state={c.readiness.state} />
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="whitespace-nowrap text-[24px] leading-7 font-semibold" data-numeric><LaunchCountdownCompact view={overviewCountdownView(c.m)} /></p>
          <p className="text-[12px] text-muted-foreground">{c.readiness.state === "LAUNCHED" ? "Since award" : "To award"}</p>
        </div>
        <PriorityBand priority={c.priority} />
      </div>
      <WorkTriageSignal readiness={c.readiness} />
      <p className="mt-3 text-[13px] font-medium">Next: {c.nextTask}</p>
      <p className="mt-2 break-words text-[12px] leading-4 text-muted-foreground">{c.mission} · {c.value} · {c.method}</p>
      <p className="mt-1 text-[12px] leading-4 text-muted-foreground">Owner: {c.owner} · Waiting on: {c.dependency}</p>
      <p className="mt-1 text-[12px] leading-4 text-muted-foreground" data-numeric>
        Phase: {c.m.currentPhase ?? "Not started"} · {c.daysInPhase ?? "Not recorded"} days in phase
      </p>
    </Link>
  );
}
