import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import {
  DEVIATION_REVIEWERS,
  DEVIATION_TEMPLATE,
  DEVIATION_TYPES,
  addDays,
  boardSummary,
  deviationBoard,
  deviationClock,
  loadDeviation,
  logDeviation,
} from "@/lib/deviations";

export const Route = createFileRoute("/deviations_/$deviationId")({
  head: () => ({
    meta: [
      { title: "Deviation request — T-Minus" },
      { name: "description", content: "A FAR or NFS deviation request with its poll, its clock and its decision." },
      { property: "og:title", content: "Deviation request — T-Minus" },
      { property: "og:description", content: "Legal, policy and HCA votes on one deviation request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeviationDetail,
});

const totalPlannedDays = DEVIATION_REVIEWERS.reduce((n, r) => n + r.plannedDays, 0);

function DeviationDetail() {
  const { deviationId } = Route.useParams();
  const { authState, user, hasAnyRole } = useRole();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canWrite = hasAnyRole(["specialist", "hq"]);
  const canVote = hasAnyRole(["reviewer", "hq"]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState("");

  const q = useQuery({
    queryKey: ["deviation", deviationId],
    enabled: authState === "signed-in",
    queryFn: () => loadDeviation(deviationId),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["deviation", deviationId] });
  const request = q.data?.request ?? null;

  const startClock = useMutation({
    mutationFn: async () => {
      if (!request) return;
      const now = new Date();
      const target = request.target_decision_date ?? addDays(now, totalPlannedDays);
      const { error } = await supabase
        .from("deviation_requests")
        .update({
          clock_started_at: now.toISOString(),
          clock_state: "running",
          status: "in review",
          target_decision_date: target,
        } as never)
        .eq("deviation_id", deviationId);
      if (error) throw new Error(error.message);
      let elapsed = 0;
      const votes = DEVIATION_REVIEWERS.map((r) => {
        elapsed += r.plannedDays;
        return {
          deviation_id: deviationId,
          reviewer_role: r.role,
          due_date: addDays(now, elapsed),
        };
      });
      const { error: vErr } = await supabase.from("deviation_votes").insert(votes as never);
      if (vErr) throw new Error(vErr.message);
      await logDeviation({
        acquisitionId: request.acquisition_id,
        actor: user.name,
        action: "Deviation clock started",
        field: "clock_state",
        oldValue: "not started",
        newValue: `running; decision due ${target}`,
        reason: `${DEVIATION_TEMPLATE.name}; legal, policy and HCA poll opened`,
      });
    },
    onSuccess: () => void refresh(),
    onError: (e) => setMessage(e instanceof Error ? `The clock did not start: ${e.message}` : "It did not start."),
  });

  const vote = useMutation({
    mutationFn: async (v: { voteId: string | null; reviewerRole: string; choice: "Go" | "No-go" }) => {
      if (!request) return;
      const reason = reasons[v.reviewerRole]?.trim() ?? "";
      if (v.choice === "No-go" && reason.length < 3) throw new Error("A No-go needs a reason.");
      const patch = {
        vote: v.choice,
        reason: v.choice === "No-go" ? reason : reason || null,
        reviewer_name: user.name,
        voted_at: new Date().toISOString(),
      };
      const { error } = v.voteId
        ? await supabase.from("deviation_votes").update(patch as never).eq("vote_id", v.voteId)
        : await supabase
            .from("deviation_votes")
            .insert({ deviation_id: deviationId, reviewer_role: v.reviewerRole, ...patch } as never);
      if (error) throw new Error(error.message);
      await logDeviation({
        acquisitionId: request.acquisition_id,
        actor: user.name,
        action: `Deviation ${v.choice}`,
        field: `poll.${v.reviewerRole.toLowerCase()}`,
        newValue: v.choice,
        reason: reason || `${v.reviewerRole} vote on ${request.citation}`,
      });
    },
    onSuccess: () => {
      setMessage(null);
      void refresh();
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "The vote was not recorded."),
  });

  const decide = useMutation({
    mutationFn: async (decision: "approved" | "denied") => {
      if (!request) return;
      if (decision === "denied" && decisionReason.trim().length < 3) throw new Error("A denial needs a reason.");
      const { error } = await supabase
        .from("deviation_requests")
        .update({
          decision,
          decision_reason: decisionReason.trim() || null,
          decided_by: user.name,
          decided_at: new Date().toISOString(),
          clock_state: "stopped",
          status: decision,
        } as never)
        .eq("deviation_id", deviationId);
      if (error) throw new Error(error.message);
      await logDeviation({
        acquisitionId: request.acquisition_id,
        actor: user.name,
        action: `Deviation ${decision}`,
        field: "decision",
        newValue: decision,
        reason: decisionReason.trim() || `HCA decision on ${request.citation} (FAR 1.404)`,
      });
    },
    onSuccess: () => void refresh(),
    onError: (e) => setMessage(e instanceof Error ? e.message : "The decision was not recorded."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!request) return;
      await supabase.from("deviation_votes").delete().eq("deviation_id", deviationId);
      const { error } = await supabase.from("deviation_requests").delete().eq("deviation_id", deviationId);
      if (error) throw new Error(error.message);
      await logDeviation({
        acquisitionId: request.acquisition_id,
        actor: user.name,
        action: "Deviation request deleted",
        field: "deviation_request",
        oldValue: `${request.citation} — ${request.title}`,
        reason: "Request withdrawn",
      });
    },
    onSuccess: () => void navigate({ to: "/deviations" }),
    onError: (e) => setMessage(e instanceof Error ? e.message : "It was not deleted."),
  });

  if (authState !== "signed-in") {
    return (
      <AppShell>
        <LoadingNote what="your sign-in" />
      </AppShell>
    );
  }
  if (q.isLoading) {
    return (
      <AppShell>
        <LoadingNote what="the deviation request" />
      </AppShell>
    );
  }
  if (q.error || !request) {
    return (
      <AppShell>
        <ErrorNote message="This deviation request did not load. Go back to Deviations and open it again." />
      </AppShell>
    );
  }

  const clock = deviationClock(request);
  const board = deviationBoard(q.data?.votes ?? []);
  const typeLabel = DEVIATION_TYPES.find((t) => t.value === request.deviation_type);

  return (
    <AppShell>
      <PageHeader title={request.title} lead={`${request.citation} · ${typeLabel?.label ?? request.deviation_type}`} />

      <p className="mb-2 text-[13px] text-muted-foreground">
        {DEVIATION_TEMPLATE.name} · NF 1098 tab {DEVIATION_TEMPLATE.tab} · {DEVIATION_TEMPLATE.revision} ·{" "}
        {DEVIATION_TEMPLATE.citation} · guidance
      </p>

      <section className="mc-work-summary mb-8">
        <p className="text-[15px]" data-numeric>
          <StatusMark color={clock.decided ? "var(--mc-readiness-go)" : clock.state === "Running" ? "var(--mc-readiness-watch)" : "var(--muted-foreground)"}>
            {clock.state}
          </StatusMark>
        </p>
        <p className="mt-2 text-[28px] leading-[34px] font-semibold" data-numeric>
          {clock.reading}
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground" data-numeric>
          Requested by {request.requester_name} · needed by {request.need_date ?? "not stated"} ·{" "}
          {request.acquisition_id ? (
            <Link to="/files/$acquisitionId" params={{ acquisitionId: request.acquisition_id }} className="text-primary">
              {request.acquisition_id}
            </Link>
          ) : (
            "standalone"
          )}
        </p>
        {!clock.decided && request.clock_state !== "running" && canWrite ? (
          <button
            type="button"
            className="mt-4 bg-primary px-4 py-2 text-[15px] text-primary-foreground [border-radius:var(--mc-radius-control)]"
            onClick={() => startClock.mutate()}
            disabled={startClock.isPending}
          >
            Start the clock
          </button>
        ) : null}
      </section>

      {message ? (
        <p role="status" className="mb-6 text-[15px]">
          {message}
        </p>
      ) : null}

      <section className="mb-10 max-w-[80ch]">
        <h2 className="mb-3 text-[18px] leading-6 font-medium">The request</h2>
        <dl className="text-[15px] leading-[22px]">
          <dt className="text-muted-foreground">What the regulation requires</dt>
          <dd className="mb-3">{request.regulation_text ?? "Not recorded"}</dd>
          <dt className="text-muted-foreground">What is proposed instead</dt>
          <dd className="mb-3">{request.proposed_text ?? "Not recorded"}</dd>
          <dt className="text-muted-foreground">Justification</dt>
          <dd>{request.justification ?? "Not recorded"}</dd>
        </dl>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-[18px] leading-6 font-medium">Go / No-go poll</h2>
        <p className="mb-3 text-[15px]">{boardSummary(board)}</p>
        <div className="mc-work-table-wrap border border-border bg-background">
        <table className="w-full text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-3 py-2 font-medium">Reviewer</th>
              <th scope="col" className="px-3 py-2 font-medium">Due</th>
              <th scope="col" className="px-3 py-2 font-medium">Vote</th>
              <th scope="col" className="px-3 py-2 font-medium">Reason</th>
              {canVote && !clock.decided ? (
                <th scope="col" className="px-3 py-2 font-medium">Record a vote</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {board.map((b) => (
              <tr key={b.reviewer_role} className="border-b border-border align-top last:border-0">
                <td className="px-3 py-2">
                  {b.reviewer_role}
                  <span className="block text-muted-foreground">{b.who}</span>
                  <span className="block text-muted-foreground">{b.citation}</span>
                </td>
                <td className="px-3 py-2" data-numeric>
                  {b.due_date ?? "Not set"}
                </td>
                <td className="px-3 py-2">
                  <StatusMark
                     color={b.vote === "Go" ? "var(--mc-readiness-go)" : b.vote === "No-go" ? "var(--mc-readiness-hold)" : "var(--muted-foreground)"}
                  >
                    {b.vote === "pending" ? "Not voted" : b.vote}
                  </StatusMark>
                  {b.reviewer_name ? <span className="block text-muted-foreground">{b.reviewer_name}</span> : null}
                </td>
                <td className="px-3 py-2">{b.reason ?? "—"}</td>
                {canVote && !clock.decided ? (
                  <td className="px-3 py-2">
                    <label htmlFor={`reason-${b.reviewer_role}`} className="block text-muted-foreground">
                      Reason (required for No-go)
                    </label>
                    <input
                      id={`reason-${b.reviewer_role}`}
                      className="mt-1 w-full border border-border bg-background px-2 py-1 [border-radius:var(--mc-radius-control)]"
                      value={reasons[b.reviewer_role] ?? ""}
                      onChange={(e) => setReasons({ ...reasons, [b.reviewer_role]: e.target.value })}
                    />
                    <span className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="border border-border px-3 py-1 text-primary [border-radius:var(--mc-radius-control)]"
                        onClick={() => vote.mutate({ voteId: b.vote_id, reviewerRole: b.reviewer_role, choice: "Go" })}
                      >
                        Go
                      </button>
                      <button
                        type="button"
                        className="border px-3 py-1 [border-radius:var(--mc-radius-control)]"
                        style={{ borderColor: "var(--mc-readiness-hold)", color: "var(--mc-readiness-hold)" }}
                        onClick={() => vote.mutate({ voteId: b.vote_id, reviewerRole: b.reviewer_role, choice: "No-go" })}
                      >
                        No-go
                      </button>
                    </span>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {canWrite ? (
        <section className="mb-10 max-w-[70ch]">
          <h2 className="mb-3 text-[18px] leading-6 font-medium">Decision</h2>
          {clock.decided ? (
            <p className="text-[15px]">
              {request.decision === "approved" ? "Approved" : "Denied"} by {request.decided_by} on{" "}
              {request.decided_at?.slice(0, 10)}
              {request.decision_reason ? ` — ${request.decision_reason}` : ""}.
            </p>
          ) : (
            <>
              <label htmlFor="decision-reason" className="block text-[13px] text-muted-foreground">
                Reason (required to deny)
              </label>
              <input
                id="decision-reason"
                className="mt-1 mb-3 w-full border border-border bg-background px-3 py-2 text-[15px] [border-radius:var(--mc-radius-control)]"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
              />
              <span className="flex gap-2">
                <button
                  type="button"
                  className="bg-primary px-4 py-2 text-[15px] text-primary-foreground [border-radius:var(--mc-radius-control)]"
                  onClick={() => decide.mutate("approved")}
                >
                  Approve the deviation
                </button>
                <button
                  type="button"
                  className="border px-4 py-2 text-[15px] [border-radius:var(--mc-radius-control)]"
                  style={{ borderColor: "var(--mc-readiness-hold)", color: "var(--mc-readiness-hold)" }}
                  onClick={() => decide.mutate("denied")}
                >
                  Deny the deviation
                </button>
              </span>
            </>
          )}
          <p className="mt-6">
            <button
              type="button"
              className="text-[13px] underline"
              style={{ color: "var(--atrisk)" }}
              onClick={() => remove.mutate()}
            >
              Delete this request
            </button>
          </p>
        </section>
      ) : null}
    </AppShell>
  );
}
