import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { signedInName } from "@/lib/account-name";
import { useDeskData, daysUntil, heroDocForPhase, pollMatchesReviewer, type DeskCard } from "@/lib/desk-data";
import { phaseCitation, type PollRow } from "@/lib/launch-sequence";

export const Route = createFileRoute("/reviewer-inbox")({
  head: () => ({
    meta: [
      { title: "Reviewer inbox — T-Minus" },
      {
        name: "description",
        content: "Reviews waiting on you, the one document to read, and your Go or No-go.",
      },
      { property: "og:title", content: "Reviewer inbox — T-Minus" },
      {
        property: "og:description",
        content: "Reviews waiting on you, the one document to read, and your Go or No-go.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewerInbox,
});

type Row = { poll: PollRow; card: DeskCard };

function ReviewerInbox() {
  const { authState, user } = useRole();
  const qc = useQueryClient();
  const { desk, isLoading, isError } = useDeskData(authState === "signed-in");
  const [openPoll, setOpenPoll] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  const { rows, matchMode } = useMemo(() => {
    if (!desk) return { rows: [] as Row[], matchMode: "named" as "named" | "all-pending" };
    const pending = desk.polls.filter((p) => (p.vote ?? "pending") === "pending");
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
  }, [desk, user.name, user.title]);

  // The reviewer casts their own vote into the same polls row the file page
  // writes, with the same audit entry.
  const vote = useMutation({
    mutationFn: async (input: { row: Row; choice: "go" | "no-go"; reason: string }) => {
      if (input.choice === "no-go" && !input.reason.trim()) throw new Error("A No-go needs a reason");
      const who = await signedInName(user.name);
      const reason = input.reason.trim() || null;
      const { error } = await supabase
        .from("polls")
        .update({ vote: input.choice, reason, voted_at: new Date().toISOString() })
        .eq("poll_id", input.row.poll.poll_id);
      if (error) throw new Error(error.message);
      await supabase.from("audit_log").insert({
        acquisition_id: input.row.card.m.acq.acquisition_id,
        actor: who,
        action: input.choice === "go" ? "Go recorded" : "No-go recorded",
        field: input.row.poll.reviewer_role,
        old_value: "pending",
        new_value: input.choice,
        reason: `cast by ${who} in the reviewer inbox${reason ? `: ${reason}` : ""}`,
        phase: input.row.poll.phase,
      });
    },
    onSuccess: () => {
      setOpenPoll(null);
      setNote("");
      setBanner("Your vote is recorded on the file and in the audit log.");
      void qc.invalidateQueries({ queryKey: ["desk-data"] });
      void qc.invalidateQueries({ queryKey: ["work-queue"] });
    },
    onError: (e: Error) => setBanner(`The vote did not save: ${e.message}. Try again.`),
  });

  return (
    <AppShell>
      <PageHeader
        title="Reviewer inbox"
        lead={`Reviews waiting on ${user.name}. Read the one document for the phase, then vote Go or No-go.`}
      />

      {banner ? (
        <p role="status" className="mb-6 max-w-[80ch] border-l-2 border-primary py-1 pl-3 text-[15px]">
          {banner}
        </p>
      ) : null}

      {isLoading ? (
        <LoadingNote what="your reviews" />
      ) : isError ? (
        <ErrorNote message="Your reviews did not load. Refresh the page; if it fails again, open Seed status to confirm the records loaded." />
      ) : rows.length === 0 ? (
        <EmptyState
          sentence="No review is waiting on a vote."
          action={
            <Link to="/files" className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground">
              Open Files
            </Link>
          }
        />
      ) : (
        <>
          {matchMode === "all-pending" ? (
            <p className="mb-6 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">
              No open review names {user.name}, so every open review on the prototype is listed. The
              reviewer of record on each row is shown beside it.
            </p>
          ) : null}

          <ul className="divide-y divide-border border-y border-border">
            {rows.map(({ poll, card }) => {
              const id = card.m.acq.acquisition_id;
              const phase = poll.phase ?? "";
              const hero = heroDocForPhase(card.m, phase);
              const due = daysUntil(poll.due_date);
              const isOpen = openPoll === poll.poll_id;
              return (
                <li key={poll.poll_id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <h2 className="text-[15px] leading-6 font-medium">
                      <Link
                        to="/files/$acquisitionId"
                        params={{ acquisitionId: id }}
                        className="text-primary hover:text-primary-hover"
                      >
                        {String((card.m.acq as Record<string, unknown>)['title'] ?? id)}
                      </Link>{" "}
                      <span className="font-normal text-muted-foreground" data-numeric>
                        {id}
                      </span>
                    </h2>
                    <p className="text-[13px] text-muted-foreground" data-numeric>
                      {poll.due_date
                        ? due !== null && due < 0
                          ? `Due ${poll.due_date} · ${Math.abs(due)} days past due`
                          : `Due ${poll.due_date} · ${due} days left`
                        : "No due date recorded"}
                    </p>
                  </div>

                  <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                    {phase} · {poll.reviewer_role} · reviewer of record {poll.reviewer_name ?? "not named"} ·{" "}
                    {phaseCitation(phase, card.m.acq)}
                  </p>

                  <p className="mt-2 text-[15px] leading-[22px]">
                    The one document to read:{" "}
                    {hero ? (
                      hero.kind === "template" ? (
                        <Link
                          to="/documents/$templateKey/$acquisitionId"
                          params={{ templateKey: hero.key, acquisitionId: id }}
                          className="text-primary hover:text-primary-hover"
                        >
                          {hero.doc.label}
                        </Link>
                      ) : (
                        <Link
                          to="/forms/$formKey/$acquisitionId"
                          params={{ formKey: hero.key, acquisitionId: id }}
                          className="text-primary hover:text-primary-hover"
                        >
                          {hero.doc.label}
                        </Link>
                      )
                    ) : (
                      <Link
                        to="/files/$acquisitionId"
                        params={{ acquisitionId: id }}
                        className="text-primary hover:text-primary-hover"
                      >
                        the file record for this phase
                      </Link>
                    )}
                    {hero ? ` (${hero.doc.citation})` : ""}.
                  </p>

                  {isOpen ? (
                    <div className="mt-3 max-w-[70ch] rounded-lg border border-border p-4">
                      <label htmlFor={`note-${poll.poll_id}`} className="block text-[13px] text-muted-foreground">
                        Note. A No-go needs a reason.
                      </label>
                      <textarea
                        id={`note-${poll.poll_id}`}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                      />
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={vote.isPending}
                          onClick={() => vote.mutate({ row: { poll, card }, choice: "go", reason: note })}
                          className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground"
                        >
                          Go
                        </button>
                        <button
                          type="button"
                          disabled={vote.isPending}
                          onClick={() => vote.mutate({ row: { poll, card }, choice: "no-go", reason: note })}
                          className="rounded-lg border px-4 py-2 text-[15px]"
                          style={{ borderColor: "var(--atrisk)" }}
                        >
                          No-go
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenPoll(null);
                            setNote("");
                          }}
                          className="rounded-lg border border-border px-4 py-2 text-[15px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenPoll(poll.poll_id);
                        setNote("");
                        setBanner(null);
                      }}
                      className="mt-3 rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground"
                    >
                      Vote on this review
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AppShell>
  );
}
