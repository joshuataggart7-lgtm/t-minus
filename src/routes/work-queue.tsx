import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import { daysBetween, todayISO, type RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow } from "@/lib/launch-sequence";
import { attachedKeys as keysFrom, savedDocKeys } from "@/lib/hold";
import { awardConfidence, historyFrom, type AwardConfidence } from "@/lib/confidence";
import { RowKeysHint, useRowKeysContainer } from "@/components/row-keys";
import { PilotKnownGapsLine } from "@/components/pilot-known-gaps";
import {
  computeMetrics,
  awardDateFor,
  holdSince,
  statusColor,
  type AcqMetrics,
  type MissionRow,
} from "@/lib/metrics";

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

type Card = {
  m: AcqMetrics;
  column: Column;
  owner: string;
  mission: string;
  nextTask: string;
  dependency: string;
  daysInPhase: number | null;
  /** Days to award, with the need date standing in when no target is set. */
  days: number | null;
  /** Planned working days and the range prior files of this profile took. */
  confidence: AwardConfidence;
};

function columnFor(m: AcqMetrics): Column {
  if (m.clockState === "launched") return "Launched";
  if (m.clockState === "hold") return "Blocked";
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
  const [sortBy, setSortBy] = useState<"owner" | "phase" | "days">("owner");
  const rowsRef = useRowKeysContainer<HTMLTableSectionElement>();
  const [scope, setScope] = useState<"all" | "mine" | "branch" | "center">("all");
  const [missionId, setMissionId] = useState<string>("all");

  const q = useQuery({
    queryKey: ["work-queue"],
    enabled: authState === "signed-in",
    refetchInterval: 5000,
    queryFn: async () => {
      const [missions, acqs, plan, rules, overrides, thresholds, strategies, polls, log, users] = await Promise.all([
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
    const history = historyFrom(q.data.acqs as unknown as AcqRow[], q.data.log);
    return q.data.acqs
      .filter((a) => String(a.clock_state ?? "") !== "scrubbed")
      .map((acq) => {
        const mission = q.data.missions.find((m) => m.mission_id === acq.mission_id) ?? null;
        const m = computeMetrics(acq, {
          attachedKeys: keysFrom(q.data.attachments ?? [], acq.acquisition_id),
          savedKeys: savedDocKeys(q.data.documents ?? [], q.data.templates ?? [], acq.acquisition_id),
          roster: q.data.users ?? [],
          plan: q.data.plan,
          rules: q.data.rules,
          polls: q.data.polls,
          ref,
          mission,
          holdSince: holdSince(acq.acquisition_id, q.data.log),
          awardDate: awardDateFor(acq.acquisition_id, q.data.log, acq.target_award_date ?? null),
        });
        const current = m.phases.find((p) => p.status === "current") ?? null;
        const nextTask = m.nextAction;
        const dependency = m.blocker === "None"
          ? "None"
          : `${m.blocker}${m.blockerOwner ? ` · owner ${m.blockerOwner}` : ""}`;
        // The file page falls back to the need date when no target award date
        // is recorded, so a running clock never reads "Clock not started".
        const running = m.clockState !== "launched" && m.clockState !== "scrubbed";
        const target =
          (acq.target_award_date as string | null) ?? ((acq as Record<string, unknown>)["need_date"] as string | null) ?? null;
        return {
          m,
          column: columnFor(m),
          owner: (acq.co_name as string) ?? "Unassigned",
          mission: mission?.name ?? "No mission linked",
          nextTask,
          dependency,
          daysInPhase: current?.actual_days ?? null,
          days: m.daysToAward ?? (running && target ? daysBetween(today, target) : null),
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

  // The list view sorts by owner, phase or days to award; the board keeps its order.
  const sortedList = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortBy === "owner") return a.owner.localeCompare(b.owner);
      if (sortBy === "phase") return String(a.m.currentPhase ?? "").localeCompare(String(b.m.currentPhase ?? ""));
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

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-4">
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
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
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
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
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
            const items = filtered.filter((c) => c.column === col);
            return (
              <section key={col} aria-label={col}>
                <div className="flex min-h-11 items-baseline justify-between border-b border-border pb-3">
                <h2 className="text-[15px] leading-6 font-medium">{col}</h2>
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
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
          >
            <option value="owner">Owner</option>
            <option value="phase">Phase</option>
            <option value="days">Days to award</option>
          </select>
        </div>
        <RowKeysHint />
        <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2">Acquisition</th>
              <th scope="col" className="p-2">Mission</th>
              <th scope="col" className="p-2">Owner</th>
              <th scope="col" className="p-2">Column</th>
              <th scope="col" className="p-2">Phase</th>
              <th scope="col" className="p-2">Next task</th>
              <th scope="col" className="p-2">Dependency</th>
              <th scope="col" className="p-2">Days in phase</th>
              <th scope="col" className="p-2">Days to award</th>
              <th scope="col" className="p-2">Status</th>
            </tr>
          </thead>
          <tbody ref={rowsRef}>
            {sortedList.map((c) => (
              <tr
                key={c.m.acq.acquisition_id}
                data-row-nav
                tabIndex={0}
                className="border-b border-border last:border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <td className="p-2">
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: c.m.acq.acquisition_id }}
                    className="text-primary hover:text-primary-hover"
                  >
                    {String(c.m.acq.title ?? c.m.acq.acquisition_id)}
                  </Link>
                  <Link
                    to="/files/$acquisitionId"
                    params={{ acquisitionId: c.m.acq.acquisition_id }}
                    hash="launch-sequence"
                    data-row-action="exit"
                    className="sr-only"
                  >
                    Open the launch sequence for {c.m.acq.acquisition_id}
                  </Link>
                  {/^write\b/i.test(c.nextTask ?? "") ? (
                    <Link
                      to="/files/$acquisitionId"
                      params={{ acquisitionId: c.m.acq.acquisition_id }}
                      data-row-action="write"
                      className="sr-only"
                    >
                      {c.nextTask} on {c.m.acq.acquisition_id}
                    </Link>
                  ) : null}
                </td>
                <td className="p-2">{c.mission}</td>
                <td className="p-2">{c.owner}</td>
                <td className="p-2">{c.column}</td>
                <td className="p-2">{c.m.currentPhase ?? "Not started"}</td>
                <td className="p-2">{c.nextTask}</td>
                <td className="p-2">{c.dependency}</td>
                <td className="p-2" data-numeric>
                  {c.daysInPhase ?? "—"}
                </td>
                <td className="p-2" data-numeric>
                  <LaunchCountdownCompact view={countdownView(c.m)} />
                  {c.m.clockState === "launched" || c.m.clockState === "scrubbed" ? null : (
                    <span className="mt-1 block text-[12px] leading-[16px] text-muted-foreground">
                      {c.confidence.sentence}
                    </span>
                  )}
                </td>
                <td className="p-2">
                  <span
                    className="inline-block border-l-2 pl-2"
                    style={{ borderColor: statusColor(c.m.status) }}
                  >
                    {c.m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      params={{ acquisitionId: c.m.acq.acquisition_id }}
      className="block rounded-xl border border-border bg-background p-4 shadow-none transition-colors duration-150 hover:border-primary"
      style={{ borderLeftWidth: 4, borderLeftColor: statusColor(c.m.status) }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{c.m.status}</p>
          <p className="mt-1 text-[15px] leading-[22px] font-medium">
            {String(c.m.acq.title ?? c.m.acq.acquisition_id)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[28px] leading-8 font-semibold" data-numeric>
            {c.m.clockState === "launched"
              ? (c.m.daysSinceAward ?? 0)
              : c.m.clockState === "scrubbed"
                ? "—"
                : (c.days ?? "—")}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {c.m.clockState === "launched" ? "Since award" : c.m.clockState === "scrubbed" ? "Clock stopped" : "To award"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">{c.mission}</p>
      <p className="mt-2 text-[13px]">Owner: {c.owner}</p>
      <p className="mt-1 text-[13px]">Phase: {c.m.currentPhase ?? "Not started"}</p>
      <p className="mt-1 text-[13px]">Next: {c.nextTask}</p>
      <p className="mt-1 text-[13px]">Waiting on: {c.dependency}</p>
      <p className="mt-2 text-[13px] text-muted-foreground" data-numeric>
        {c.daysInPhase ?? "Not recorded"} days in phase
      </p>
    </Link>
  );
}
