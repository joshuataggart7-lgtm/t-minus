import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pollOptions } from "@/lib/poll";
import { useMemo, useState } from "react";
import { AppShell, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { McPageHeader, StatusChip, type StatusTone } from "@/components/ui-mc";
import type { MissionReadiness } from "@/components/mission-control/primitives";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { loadLaunchEvents, loadStateAuditRows } from "@/lib/launch-events";
import type { CenterOverrideRow } from "@/lib/center-config";
import { formatMoney, todayISO, type RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow } from "@/lib/launch-sequence";
import { attachedKeys as keysFrom, holdOwnerDisplay, savedDocKeys } from "@/lib/hold";
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
import { missionReadinessClass } from "@/components/mission-control/primitives";
import { loadAttachmentKeyRows, loadDocumentKeyRows } from "@/lib/evidence-rows";
import { explainWorkReadiness, type ReadinessExplanation } from "@/components/mission-control/readiness";
import { deriveOverviewAcquisitionState, overviewCountdownView } from "@/components/mission-control/operational-state";
import {
  PriorityBand,
  WorkTriageSignal,
  priorityBand,
  type PriorityBandValue,
} from "@/components/mission-control/work-triage";
import { methodDisplayLabel } from "@/lib/rfo-simplified-cites";

export const Route = createFileRoute("/work-queue")({
  head: () => ({
    meta: [
      { title: "Work Queue · T-Minus" },
      {
        name: "description",
        content: "Files you own, what each one is waiting on, and when the next decision is due.",
      },
      { property: "og:title", content: "Work Queue · T-Minus" },
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

const COLUMNS = ["Ready", "In progress", "Blocked", "Awaiting decisions", "Launched"] as const;
type Column = (typeof COLUMNS)[number];
const COLUMN_LABEL: Record<Column, string> = {
  Ready: "Not started",
  "In progress": "In progress",
  Blocked: "Blocked",
  "Awaiting decisions": "Awaiting review decisions",
  Launched: "Launched",
};

const READINESS_TONE: Record<MissionReadiness, StatusTone> = { GO: "ontrack", WATCH: "attention", HOLD: "atrisk", LAUNCHED: "launched" };

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
  if (m.board.some((b) => b.vote === "pending")) return "Awaiting decisions";
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
    ...pollOptions,
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
        loadStateAuditRows(),
        supabase.from("users").select("name,title,center_code"),
        loadLaunchEvents(),
      ]);
      const attachments = await loadAttachmentKeyRows();
      const [documents, templateRows] = await Promise.all([
        loadDocumentKeyRows(),
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
        attachments,
        documents: documents as { acquisition_id: string | null; template_id: string | null }[],
        templates: templateRows.data ?? [],
        stateLog: log,
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
        const operational = deriveOverviewAcquisitionState(acq, [...q.data.stateLog, ...q.data.launches]);
        const mission = q.data.missions.find((m) => m.mission_id === acq.mission_id) ?? null;
        const keys = {
          acq: operational.acquisition,
          attachedKeys: keysFrom(q.data.attachments ?? [], acq.acquisition_id),
          savedKeys: savedDocKeys(q.data.documents ?? [], q.data.templates ?? [], acq.acquisition_id),
        };
        const m = computeMetrics(operational.acquisition, {
          attachedKeys: keys.attachedKeys,
          savedKeys: keys.savedKeys,
          roster: q.data.users ?? [],
          plan: q.data.plan,
          rules: q.data.rules,
          polls: q.data.polls,
          ref,
          mission,
          holdSince: holdSince(acq, q.data.stateLog),
          awardDate: operational.actualAwardDate,
        });
        const current = m.phases.find((p) => p.status === "current") ?? null;
        const readiness = explainWorkReadiness(m, keys);
        const recordedValue = acq.estimated_value;
        const rawValue = recordedValue === null || recordedValue === undefined || recordedValue === ""
          ? null
          : Number(recordedValue);
        const priority = mission?.priority ?? null;
        const dependency = m.blocker === "None"
          ? "None"
          : `${m.blocker}${m.blockerOwner ? ` · owner ${holdOwnerDisplay(m.blockerOwner)}` : ""}`;
        return {
          m,
          column: columnFor(m, readiness),
          acquisitionId: acq.acquisition_id,
          title: String(acq.title ?? acq.acquisition_id),
          owner: String(acq.co_name ?? "").trim() || "Not recorded",
          mission: mission?.name ?? "No mission linked",
          value: rawValue !== null && Number.isFinite(rawValue) ? `IGCE ${formatMoney(rawValue)}` : "Not recorded",
          method: methodDisplayLabel(String(acq.acquisition_method ?? "").trim()) || "Not recorded",
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
    <AppShell kit>
      <McPageHeader
        eyebrow="Contracting desk"
        title="Work Queue"
        lead="Files you own, what each one is waiting on, and when the next decision is due. Cards open the file; status changes happen in the file, not by dragging."
        actions={
          <Link to="/intake" className="mc-req-button">
            Start an intake
          </Link>
        }
      />

      <div className="mc-wq-toolbar">
        <div className="mc-wq-field">
          <label htmlFor="scope" className="mc-field-label">
            Show
          </label>
          <select id="scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="mc-input">
            <option value="all">Everything</option>
            <option value="mine">Mine</option>
            <option value="branch">My branch{myBranch ? ` (${myBranch})` : ""}</option>
            <option value="center">My Center ({user.center_code})</option>
          </select>
        </div>

        <div className="mc-wq-field">
          <label htmlFor="mission" className="mc-field-label">
            Mission
          </label>
          <select id="mission" value={missionId} onChange={(e) => setMissionId(e.target.value)} className="mc-input">
            <option value="all">Every mission</option>
            {(q.data?.missions ?? []).map((m) => (
              <option key={m.mission_id} value={m.mission_id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {view === "list" ? (
          <div className="mc-wq-field">
            <label htmlFor="sort" className="mc-field-label">Sort by</label>
            <select id="sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="mc-input">
              <option value="owner">Owner</option>
              <option value="phase">Phase</option>
              <option value="days">Days to award</option>
              <option value="priority">Priority</option>
            </select>
          </div>
        ) : null}

        <div role="group" aria-label="View" className="mc-seg">
          {(["board", "list"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className="mc-seg-btn">
              {v === "board" ? "Board" : "List"}
            </button>
          ))}
        </div>

        <p className="mc-wq-count" data-numeric>
          {filtered.length} of {cards.length} files shown
        </p>
      </div>

      {q.isLoading ? (
        <LoadingNote what="the queue" />
      ) : q.isError ? (
        <ErrorNote message="The queue did not load. Refresh the page. If it still fails, tell the T-Minus team." />
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
        (() => {
          const byCol = COLUMNS.map((col) => ({
            col,
            items: filtered.filter((c) => c.column === col).sort((a, b) => priorityRank(a) - priorityRank(b)),
          }));
          const shown = byCol.filter((x) => x.items.length > 0);
          const empty = byCol.filter((x) => x.items.length === 0);
          return (
            <>
              {/* Columns with files share the width; they wrap instead of clipping, so every column stays in view. */}
              <div className="mc-wq-board" style={{ ["--cols" as string]: String(Math.max(shown.length, 1)) }}>
                {shown.map(({ col, items }) => (
                  <section key={col} aria-label={COLUMN_LABEL[col]} className="mc-wq-col">
                    <div className="mc-wq-col-head">
                      <h2>{COLUMN_LABEL[col]}</h2>
                      <span className="mc-today-count" data-numeric aria-label={`${items.length} ${items.length === 1 ? "file" : "files"}`}>
                        {items.length}
                      </span>
                    </div>
                    <ul className="mc-wq-cards">
                      {items.map((c) => (
                        <li key={c.m.acq.acquisition_id}>
                          <CardView c={c} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              {empty.length ? (
                <p className="mc-wq-empty-cols">
                  No files in: {empty.map((x) => COLUMN_LABEL[x.col]).join(", ")}.
                </p>
              ) : null}
            </>
          );
        })()
      ) : (
        <>
        <RowKeysHint className="mb-3" />
        <div className="mc-dt-wrap mc-wq-table-wrap" role="region" aria-label="Work Queue files table" tabIndex={0}>
        <table className="mc-dt mc-wq-table max-md:block">
          <thead className="max-md:hidden">
            <tr className="border-b border-border text-left">
              <th scope="col">Acquisition</th>
              <th scope="col" className="whitespace-nowrap">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">T±</th>
              <th scope="col">Owner</th>
              <th scope="col">Next task</th>
              <th scope="col">Waiting on</th>
              <th scope="col">Phase</th>
            </tr>
          </thead>
          <tbody ref={rowsRef} className="max-md:block">
            {sortedList.map((c) => (
              <tr
                key={c.acquisitionId}
                data-row-nav
                tabIndex={0}
                className={`mc-work-table-row ${missionReadinessClass(c.readiness.state, "is")} align-top focus:outline-none focus-visible:ring-2 focus-visible:ring-primary max-md:mb-3 max-md:block max-md:border max-md:p-3 max-md:last:border`}
              >
                <td data-label="Acquisition" className="break-words max-md:block max-md:h-auto max-md:min-h-0 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[12px] max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]">
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: c.acquisitionId }}
                    className="mc-files-link"
                  >
                    <span className="mc-files-id" data-numeric>{c.acquisitionId}</span>
                    <span className="mc-files-title">{c.title}</span>
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
                  <span className="mt-1 block text-[14px] leading-5 text-[var(--mc-meta-ink)]">{c.value} · {c.method}</span>
                  <span className="mt-1 block text-[14px] leading-5 text-[var(--mc-meta-ink)]">{c.mission}</span>
                </td>
                <td data-label="Priority" className="whitespace-nowrap max-md:mt-3 max-md:block max-md:h-auto max-md:min-h-0 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[12px] max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]"><PriorityBand priority={c.priority} /></td>
                <td data-label="Status" className="max-md:mt-3 max-md:block max-md:h-auto max-md:min-h-0 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[12px] max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]"><StatusChip label={c.readiness.state} tone={READINESS_TONE[c.readiness.state]} /><WorkTriageSignal readiness={c.readiness} /><span className="mt-1 block text-[14px] leading-5 text-[var(--mc-meta-ink)]">Column: {COLUMN_LABEL[c.column]}</span></td>
                <td data-label="Countdown" className="max-md:mt-3 max-md:block max-md:h-auto max-md:min-h-0 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[12px] max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]" data-numeric>
                  <span className="whitespace-nowrap max-md:whitespace-normal"><LaunchCountdownCompact view={overviewCountdownView(c.m)} hideBadge={overviewCountdownView(c.m).mode === "hold"} /></span>
                  {c.readiness.state === "LAUNCHED" ? null : (
                    <span className="mt-1 block text-[14px] leading-5 text-[var(--mc-meta-ink)]">
                      {c.confidence.sentence}
                    </span>
                  )}
                </td>
                <td data-label="Owner" className="break-words max-md:mt-3 max-md:block max-md:h-auto max-md:min-h-0 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[12px] max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]">{c.owner}</td>
                <td data-label="Next task" className="break-words max-md:mt-3 max-md:block max-md:h-auto max-md:min-h-0 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[12px] max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]">{c.nextTask}</td>
                <td data-label="Waiting on" className="break-words max-md:mt-3 max-md:block max-md:h-auto max-md:min-h-0 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[12px] max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]">{c.dependency}</td>
                <td data-label="Phase" className="break-words max-md:mt-3 max-md:block max-md:h-auto max-md:min-h-0 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[12px] max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]">{c.m.currentPhaseLabel ?? "Not started"}<span className="mt-1 block text-[14px] leading-5 text-[var(--mc-meta-ink)]" data-numeric>{c.daysInPhase ?? "Not recorded"} days in phase</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </>
      )}

      <p className="mt-6 text-[14px] text-[var(--mc-meta-ink)]" data-numeric>
        Today is {today}.
      </p>
      <PilotKnownGapsLine className="mt-8" />
    </AppShell>
  );
}

function CardView({ c }: { c: Card }) {
  const view = overviewCountdownView(c.m);
  return (
    <Link
      to="/files/$acquisitionId"
      params={{ acquisitionId: c.acquisitionId }}
      className={`mc-work-card mc-wq-card ${missionReadinessClass(c.readiness.state, "is")}`}
    >
      <div className="mc-wq-card-top">
        <span className="mc-files-id" data-numeric>{c.acquisitionId}</span>
        <StatusChip label={c.readiness.state} tone={READINESS_TONE[c.readiness.state]} />
      </div>
      <p className="mc-wq-card-title">{c.title}</p>
      <div className="mc-wq-card-t">
        <div>
          <p className="mc-wq-card-count" data-numeric>
            <LaunchCountdownCompact view={view} hideBadge={view.mode === "hold"} />
          </p>
          <p className="mc-wq-card-meta">{c.readiness.state === "LAUNCHED" ? "Since award" : "To award"}</p>
        </div>
        <PriorityBand priority={c.priority} />
      </div>
      <WorkTriageSignal readiness={c.readiness} />
      <p className="mc-wq-card-next">
        <span className="mc-wq-card-label">Next</span> {c.nextTask}
      </p>
      <dl className="mc-wq-card-facts">
        <div>
          <dt>Owner</dt>
          <dd>{c.owner}</dd>
        </div>
        <div>
          <dt>Waiting on</dt>
          <dd>{c.dependency}</dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd data-numeric>
            {c.m.currentPhaseLabel ?? "Not started"} · {c.daysInPhase ?? "Not recorded"} days in phase
          </dd>
        </div>
      </dl>
      <p className="mc-wq-card-meta">{c.mission} · {c.value} · {c.method}</p>
    </Link>
  );
}
