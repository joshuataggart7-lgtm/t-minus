import { writeAudit } from "@/lib/audit";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { AppShell, LoadingNote, ErrorNote } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { LockHint, useDemoLocked } from "@/components/demo-lock";
import { DetailsList, DetailsSection, McPageHeader, StatusChip, WithDetailsPanel, type StatusTone } from "@/components/ui-mc";
import { DEMO_READ_ONLY_NOTE, failureText, isDemoSession } from "@/lib/demo-guard";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import { useDeskData, daysUntil, heroDocForReviewer, pollMatchesReviewer, type DeskCard, type HeroDoc } from "@/lib/desk-data";
import { phaseCitation, type PollRow } from "@/lib/launch-sequence";
import { phaseAlias } from "@/lib/phase-alias";
import {
  DECISION_LABEL,
  REVIEW_KIND_LABEL,
  decisionAudit,
  decisionOptions,
  decisionOutcome,
  normalizeDecision,
  reviewKindFor,
  type ReviewDecision,
  type ReviewKind,
} from "@/lib/review-decisions";
import { ReviewDecisionFields, rationaleMissing } from "@/components/review-decision-fields";
import { loadReceiptsForAcquisitions, receiptStamp, recordReadReceiptQuietly, type ReceiptKind } from "@/lib/read-receipts";
import { explainWorkReadiness } from "@/components/mission-control/readiness";
import type { MissionReadiness } from "@/components/mission-control/primitives";
import { dayWord } from "@/lib/pluralize";

// The reviewer inbox and the approver's landing share this screen. Each card is
// one file with the reviews waiting on it; the decision panel beside the cards
// holds the formal decision for the review you chose. The decision is written
// to the same polls row and audit entry the file page uses.

const READINESS_TONE: Record<MissionReadiness, StatusTone> = { GO: "ontrack", WATCH: "attention", HOLD: "atrisk", LAUNCHED: "launched" };

export type InboxMode = "reviews" | "approvals";

type Row = { poll: PollRow; card: DeskCard };

// Verified text only: each quotation is verbatim from the regulation or form
// text on file.
const RULES: { kinds: readonly ReviewKind[]; quote: string; cite: string }[] = [
  {
    kinds: ["approval"],
    quote: "The justification for other than full and open competition must be approved in writing.",
    cite: "RFO FAR 6.104-2(a)",
  },
  {
    kinds: ["approval", "concurrence"],
    quote: "Contracting officers must obtain concurrences and approvals for justifications.",
    cite: "NFS CG 1806.16",
  },
  {
    kinds: ["small_business"],
    quote: "Nonconcurrence by either the SBA PCR or OSBP SBS must be resolved following FAR 19.102(f) and (g).",
    cite: "NF 1787 instructions",
  },
];

const COPY: Record<InboxMode, { eyebrow: string; title: string; empty: string; stat: string; panel: string }> = {
  reviews: {
    eyebrow: "Reviews",
    title: "Reviewer inbox",
    empty: "No review is waiting on your decision.",
    stat: "Reviews waiting on you",
    panel: "Your decision",
  },
  approvals: {
    eyebrow: "Approvals",
    title: "Approvals",
    empty: "No approval is waiting on your decision.",
    stat: "Approvals waiting on you",
    panel: "Your approval decision",
  },
};

function dueText(poll: PollRow): { text: string; tone: StatusTone; chip: string } {
  if (!poll.due_date) return { text: "No due date recorded", tone: "neutral", chip: "No due date" };
  const due = daysUntil(poll.due_date);
  if (due !== null && due < 0) {
    const late = Math.abs(due);
    return { text: `Due ${poll.due_date} · ${late} ${dayWord(late)} past due`, tone: "atrisk", chip: "Past due" };
  }
  const left = due ?? 0;
  return {
    text: `Due ${poll.due_date} · ${left} ${dayWord(left)} left`,
    tone: left <= 7 ? "attention" : "ontrack",
    chip: left <= 7 ? "Due this week" : "On track",
  };
}

function decisionTone(raw: string | null | undefined, kind: ReviewKind): StatusTone {
  const outcome = decisionOutcome(normalizeDecision(raw, kind));
  return outcome === "favorable" ? "ontrack" : outcome === "unfavorable" ? "atrisk" : "neutral";
}

function decisionText(raw: string | null | undefined, kind: ReviewKind): string {
  const d = normalizeDecision(raw, kind);
  return d ? DECISION_LABEL[d] : "Pending";
}

/** The polls read selects every column; voted_at is present on the row. */
function votedAt(p: PollRow): string {
  return String((p as PollRow & { voted_at?: string | null }).voted_at ?? "");
}

function fileTitle(card: DeskCard | undefined, id: string): string {
  return card ? String((card.m.acq as Record<string, unknown>)["title"] ?? id) : id;
}

export function ReviewInbox({ mode }: { mode: InboxMode }) {
  const copy = COPY[mode];
  const { authState, user } = useRole();
  const locked = useDemoLocked();
  const qc = useQueryClient();
  const { desk, isLoading, isError } = useDeskData(authState === "signed-in");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const inMode = (p: PollRow) => (mode === "approvals" ? reviewKindFor(p.reviewer_role) === "approval" : true);

  const { rows, matchMode } = useMemo(() => {
    if (!desk) return { rows: [] as Row[], matchMode: "named" as "named" | "all-pending" };
    const pending = desk.polls.filter((p) => (p.vote ?? "pending") === "pending" && inMode(p));
    const named = pending.filter((p) => pollMatchesReviewer(p, { name: user.name, title: user.title }));
    const chosen = named.length > 0 ? named : pending;
    const built = chosen
      .map((poll) => {
        const card = desk.cards.find((c) => c.m.acq.acquisition_id === poll.acquisition_id);
        return card ? { poll, card } : null;
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => String(a.poll.due_date ?? "9999").localeCompare(String(b.poll.due_date ?? "9999")));
    return { rows: built, matchMode: named.length > 0 ? ("named" as const) : ("all-pending" as const) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desk, user.name, user.title, mode]);

  // Decisions already on record: yours by name, or in Approvals every recorded
  // approval when none names you.
  const decided = useMemo(() => {
    if (!desk) return { list: [] as PollRow[], mine: true };
    const all = desk.polls.filter((p) => (p.vote ?? "pending") !== "pending" && inMode(p));
    const mine = all.filter((p) => (p.reviewer_name ?? "").trim() === user.name.trim());
    const list = (mine.length || mode === "reviews" ? mine : all)
      .slice()
      .sort((a, b) => votedAt(b).localeCompare(votedAt(a)))
      .slice(0, 8);
    return { list, mine: mine.length > 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desk, user.name, mode]);

  const groups = useMemo(() => {
    const byId = new Map<string, { card: DeskCard; polls: PollRow[] }>();
    for (const { poll, card } of rows) {
      const id = card.m.acq.acquisition_id;
      const group = byId.get(id) ?? { card, polls: [] };
      group.polls.push(poll);
      byId.set(id, group);
    }
    return [...byId.values()];
  }, [rows]);

  const ids = useMemo(() => Array.from(new Set(rows.map((r) => r.card.m.acq.acquisition_id))), [rows]);
  const receiptsQ = useQuery({
    queryKey: ["read-receipts-inbox", ids.join(",")],
    enabled: authState === "signed-in" && ids.length > 0,
    queryFn: () => loadReceiptsForAcquisitions(ids),
  });
  const receipts = receiptsQ.data ?? [];

  const openedNote = (id: string, kind: ReceiptKind, key: string): string | null => {
    const hit = receipts.find((r) => r.acquisition_id === id && r.doc_kind === kind && r.doc_key === key);
    return hit ? `Opened by ${hit.opened_by} · ${receiptStamp(hit.opened_at)}` : null;
  };

  const noteOpen = (id: string, kind: ReceiptKind, key: string, label: string, pollId: string) => {
    void signedInName(user.name).then((who) => {
      recordReadReceiptQuietly({
        acquisitionId: id,
        docKind: kind,
        docKey: key,
        docLabel: label,
        openedBy: who,
        pollId,
        source: "reviewer-inbox",
      });
    });
  };

  const vote = useMutation({
    mutationFn: async (input: { row: Row; choice: ReviewDecision; reason: string }) => {
      if (await isDemoSession()) throw new Error(DEMO_READ_ONLY_NOTE);
      if (rationaleMissing(input.choice, input.reason)) throw new Error(`${DECISION_LABEL[input.choice]} needs a written rationale`);
      const who = await signedInName(user.name);
      const reason = input.reason.trim() || null;
      const { data, error } = await supabase
        .from("polls")
        .update({ vote: input.choice, reason, voted_at: new Date().toISOString() })
        .eq("poll_id", input.row.poll.poll_id)
        .select("poll_id");
      if (error) throw new Error(error.message);
      if ((data ?? []).length === 0) throw new Error("no review was updated");
      const entryAudit = decisionAudit({
        decision: input.choice,
        reviewerName: who,
        reviewerRole: input.row.poll.reviewer_role ?? "Reviewer",
        date: new Date().toISOString().slice(0, 10),
        rationale: reason,
        previousRaw: input.row.poll.vote,
        previousReason: input.row.poll.reason,
      });
      await writeAudit({
        acquisition_id: input.row.card.m.acq.acquisition_id,
        actor: who,
        action: entryAudit.action,
        field: input.row.poll.reviewer_role,
        old_value: entryAudit.old_value,
        new_value: entryAudit.new_value,
        reason: `${entryAudit.reason} (recorded in ${mode === "approvals" ? "Approvals" : "the reviewer inbox"})`,
        phase: input.row.poll.phase,
      });
    },
    onSuccess: () => {
      setSelected(null);
      setNote("");
      setDecision(null);
      setBanner("Your decision is recorded on the file and in the audit log.");
      void qc.invalidateQueries({ queryKey: ["desk-data"] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(failureText("The decision did not save", e)),
  });

  const choose = (pollId: string) => {
    setSelected(pollId);
    setNote("");
    setDecision(null);
    setBanner(null);
    // Below 1280px the panel sits under the cards; bring it into view.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const active = rows.find((r) => r.poll.poll_id === selected) ?? null;
  const activeKind = active ? reviewKindFor(active.poll.reviewer_role) : null;
  const pastDue = rows.filter((r) => {
    const d = daysUntil(r.poll.due_date);
    return d !== null && d < 0;
  }).length;
  const thisWeek = rows.filter((r) => {
    const d = daysUntil(r.poll.due_date);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const kindsShown = new Set<ReviewKind>(
    active ? [activeKind as ReviewKind] : mode === "approvals" ? ["approval"] : rows.map((r) => reviewKindFor(r.poll.reviewer_role)),
  );
  const rules = RULES.filter((r) => r.kinds.some((k) => kindsShown.has(k)));

  const docLink = (row: Row, hero: HeroDoc | null) => {
    const id = row.card.m.acq.acquisition_id;
    const cls = "text-primary hover:text-primary-hover";
    if (!hero) {
      return (
        <Link to="/files/$acquisitionId" params={{ acquisitionId: id }} className={cls}>
          the file record for this phase
        </Link>
      );
    }
    if (hero.kind === "file") {
      return (
        <Link to="/files/$acquisitionId" params={{ acquisitionId: id }} onClick={() => noteOpen(id, "file", "file", hero.doc.label, row.poll.poll_id)} className={cls}>
          {hero.doc.label}
        </Link>
      );
    }
    if (hero.kind === "template") {
      return (
        <Link
          to="/documents/$templateKey/$acquisitionId"
          params={{ templateKey: hero.key, acquisitionId: id }}
          onClick={() => noteOpen(id, "template", hero.key, hero.doc.label, row.poll.poll_id)}
          className={cls}
        >
          {hero.doc.label}
        </Link>
      );
    }
    return (
      <Link
        to="/forms/$formKey/$acquisitionId"
        params={{ formKey: hero.key, acquisitionId: id }}
        onClick={() => noteOpen(id, "form", hero.key, hero.doc.label, row.poll.poll_id)}
        className={cls}
      >
        {hero.doc.label}
      </Link>
    );
  };

  const heroFor = (row: Row) => heroDocForReviewer(row.card.m, row.poll.reviewer_role ?? "", String(phaseAlias(row.poll.phase ?? "")));

  const panel = (
    <div ref={panelRef} className="mc-rv-panel" id="rv-decision">
      <DetailsSection title={copy.panel}>
        {active && activeKind ? (
          <div className="mc-rv-decision">
            <p className="mc-req-id" data-numeric>
              {active.card.m.acq.acquisition_id}
            </p>
            <p className="mc-rv-decision-role">{active.poll.reviewer_role ?? "Review"}</p>
            <DetailsList
              items={[
                { term: "Review type", value: REVIEW_KIND_LABEL[activeKind] },
                { term: "Reviewer of record", value: active.poll.reviewer_name ?? "Not named" },
                { term: "Due", value: <span data-numeric>{active.poll.due_date ?? "Not recorded"}</span> },
              ]}
            />
            <p className="mc-rv-read">
              Read first: {docLink(active, heroFor(active))}
            </p>
            <fieldset disabled={locked || vote.isPending} aria-disabled={locked || undefined} className="mc-rv-fields">
              <ReviewDecisionFields
                idPrefix={`rv-${active.poll.poll_id}`}
                options={decisionOptions(activeKind, null)}
                decision={decision}
                onDecision={setDecision}
                rationale={note}
                onRationale={setNote}
                kindLabel={REVIEW_KIND_LABEL[activeKind]}
                disabled={locked || vote.isPending}
              />
              <div className="mc-rv-actions">
                <button
                  type="button"
                  disabled={locked || vote.isPending || !decision || rationaleMissing(decision, note)}
                  onClick={() => decision && vote.mutate({ row: active, choice: decision, reason: note })}
                  className={`mc-rv-record ${decisionOutcome(decision) === "unfavorable" ? "is-negative" : ""}`}
                >
                  {decision ? `Record ${DECISION_LABEL[decision]}` : "Record decision"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setNote("");
                    setDecision(null);
                  }}
                  className="mc-rv-cancel"
                >
                  Cancel
                </button>
              </div>
            </fieldset>
            {locked ? <LockHint className="mt-3" lead="Decisions are recorded by the named reviewer." /> : null}
          </div>
        ) : (
          <p className="mc-rv-hint">
            {rows.length ? "Choose a review on the left to read its document and record your decision." : copy.empty}
          </p>
        )}
      </DetailsSection>
      <DetailsSection title="Written reasons">
        <p className="mc-rv-hint">
          A written reason is required for {mode === "approvals" ? "Disapprove" : "Nonconcur, Disapprove, Not legally sufficient, and any decision with comments"}.
          The reason is saved with the decision and in the audit log.
        </p>
        {rules.map((r) => (
          <blockquote key={r.cite} className="mc-eval-rule mc-rv-rule">
            <p>{r.quote}</p>
            <footer>{r.cite}</footer>
          </blockquote>
        ))}
        {mode === "reviews" && kindsShown.has("legal") ? (
          <p className="mc-rv-hint">The three legal sufficiency labels are T-Minus practice.</p>
        ) : null}
      </DetailsSection>
    </div>
  );

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow={copy.eyebrow}
        {...(locked ? { scope: "Read-only in the demo" } : {})}
        title={copy.title}
        lead={
          mode === "approvals"
            ? `Approvals waiting on ${user.name}. Read the document, then approve or disapprove with a written reason when you disapprove.`
            : `Reviews waiting on ${user.name}. Read the one document for the phase, then record your formal decision.`
        }
      />

      {banner ? (
        <p role="status" className="mc-rv-banner">
          {banner}
        </p>
      ) : null}

      {isLoading ? (
        <LoadingNote what={mode === "approvals" ? "your approvals" : "your reviews"} layout="cards" />
      ) : isError ? (
        <ErrorNote message="Your reviews did not load. Refresh the page. If it still fails, tell the T-Minus team." />
      ) : (
        <>
          <nav className="mc-rv-stats" aria-label={`${copy.title} in numbers`}>
            <a href="#rv-list" className="mc-today-stat is-mine">
              <span className="mc-today-stat-value" data-numeric>
                {rows.length}
              </span>
              <span className="mc-today-stat-label">{copy.stat}</span>
            </a>
            <a href="#rv-list" className={`mc-today-stat ${pastDue ? "is-late" : ""}`}>
              <span className="mc-today-stat-value" data-numeric>
                {pastDue}
              </span>
              <span className="mc-today-stat-label">Past due</span>
            </a>
            <a href="#rv-list" className="mc-today-stat">
              <span className="mc-today-stat-value" data-numeric>
                {thisWeek}
              </span>
              <span className="mc-today-stat-label">Due in the next 7 days</span>
            </a>
          </nav>

          <WithDetailsPanel panelLabel={copy.panel} panel={panel}>
            <div id="rv-list">
              {matchMode === "all-pending" && rows.length ? (
                <p className="mc-today-scope">
                  No open {mode === "approvals" ? "approval" : "review"} names you, so every open{" "}
                  {mode === "approvals" ? "approval" : "review"} in this prototype is shown. Each one lists its reviewer of record.
                </p>
              ) : null}

              {rows.length === 0 ? (
                <div className="mc-kpanel mc-rv-empty">
                  <p className="mc-kpanel-title">{copy.empty}</p>
                  <p className="mc-req-meta">
                    New {mode === "approvals" ? "approvals" : "reviews"} appear here when a contracting officer routes a file to you.
                  </p>
                  <div className="mc-kpanel-actions mt-3">
                    <Link to="/files" className="mc-rv-record">
                      Open Files
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mc-rv-list">
                  {groups.map(({ card, polls }) => {
                    const id = card.m.acq.acquisition_id;
                    const readiness = explainWorkReadiness(card.m, { acq: card.m.acq, attachedKeys: card.attachedKeys, savedKeys: card.savedKeys }).state;
                    return (
                      <article key={id} className="mc-kpanel" aria-labelledby={`rv-${id}`}>
                        <header className="mc-kpanel-head">
                          <div className="min-w-0">
                            <p className="mc-req-id" data-numeric>
                              {id}
                            </p>
                            <h2 id={`rv-${id}`} className="mc-kpanel-title">
                              <Link to="/files/$acquisitionId" params={{ acquisitionId: id }} className="hover:text-primary">
                                {fileTitle(card, id)}
                              </Link>
                            </h2>
                            <p className="mc-req-meta" data-numeric>
                              {polls.length} open {polls.length === 1 ? (mode === "approvals" ? "approval" : "review") : mode === "approvals" ? "approvals" : "reviews"} on this file
                            </p>
                          </div>
                          <div className="mc-kpanel-status">
                            <span className="mc-req-h">File status</span>
                            <StatusChip label={readiness} tone={READINESS_TONE[readiness]} />
                          </div>
                        </header>
                        {polls.map((poll) => {
                          const row = { poll, card };
                          const phase = String(phaseAlias(poll.phase ?? ""));
                          const kind = reviewKindFor(poll.reviewer_role);
                          const hero = heroFor(row);
                          const due = dueText(poll);
                          const isActive = selected === poll.poll_id;
                          const rkind: ReceiptKind = hero ? (hero.kind as ReceiptKind) : "file";
                          const rkey = hero ? (hero.kind === "file" ? "file" : hero.key) : "file";
                          const opened = openedNote(id, rkind, rkey);
                          return (
                            <section key={poll.poll_id} className={`mc-kpanel-section mc-rv-review ${isActive ? "is-active" : ""}`} aria-label={poll.reviewer_role ?? "Review"}>
                              <div className="mc-rv-review-head">
                                <div className="min-w-0">
                                  <h3 className="mc-rv-review-title">{poll.reviewer_role ?? "Review"}</h3>
                                  <p className="mc-req-meta">
                                    {REVIEW_KIND_LABEL[kind]} · reviewer of record {poll.reviewer_name ?? "not named"}
                                  </p>
                                </div>
                                <StatusChip label={due.chip} tone={due.tone} />
                              </div>
                              <p className="mc-req-meta" data-numeric>
                                {due.text} · {phase} · {phaseCitation(phase, card.m.acq)}
                              </p>
                              <p className="mc-req-text mt-2">
                                The one document to read: {docLink(row, hero)}
                                {hero ? ` (${hero.doc.citation})` : ""}.
                              </p>
                              {opened ? <p className="mc-req-meta mt-1">{opened}</p> : null}
                              <div className="mc-kpanel-actions mt-3">
                                <button
                                  type="button"
                                  aria-pressed={isActive}
                                  aria-controls="rv-decision"
                                  onClick={() => choose(poll.poll_id)}
                                  className={isActive ? "mc-rv-cancel" : "mc-rv-record"}
                                >
                                  {isActive ? "Selected" : locked ? "View decision options" : "Record a decision"}
                                </button>
                              </div>
                            </section>
                          );
                        })}
                      </article>
                    );
                  })}
                </div>
              )}

              {decided.list.length ? (
                <section className="mc-kpanel mc-rv-history" aria-labelledby="rv-history">
                  <header className="mc-kpanel-head">
                    <div className="min-w-0">
                      <h2 id="rv-history" className="mc-kpanel-title">
                        {decided.mine ? "Decisions you recorded" : mode === "approvals" ? "Approvals on record" : "Decisions on record"}
                      </h2>
                      <p className="mc-req-meta">Most recent first. Each decision and its reason are also in the audit log.</p>
                    </div>
                  </header>
                  <ul className="mc-rv-history-list">
                    {decided.list.map((p) => {
                      const kind = reviewKindFor(p.reviewer_role);
                      const card = desk?.cards.find((c) => c.m.acq.acquisition_id === p.acquisition_id);
                      return (
                        <li key={p.poll_id} className="mc-rv-history-item">
                          <div className="mc-rv-review-head">
                            <div className="min-w-0">
                              <p className="mc-req-id" data-numeric>
                                {p.acquisition_id} · {votedAt(p) ? votedAt(p).slice(0, 10) : "date not recorded"}
                              </p>
                              <p className="mc-rv-review-title">
                                <Link to="/files/$acquisitionId" params={{ acquisitionId: String(p.acquisition_id) }} className="hover:text-primary">
                                  {fileTitle(card, String(p.acquisition_id))}
                                </Link>
                              </p>
                              <p className="mc-req-meta">
                                {p.reviewer_role ?? "Review"} · {p.reviewer_name ?? "reviewer not named"}
                              </p>
                            </div>
                            <StatusChip label={decisionText(p.vote, kind)} tone={decisionTone(p.vote, kind)} />
                          </div>
                          {p.reason ? <p className="mc-req-text mt-1">{p.reason}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          </WithDetailsPanel>
        </>
      )}
    </AppShell>
  );
}
