import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import type { CenterOverrideRow } from "@/lib/center-config";
import type { RefData } from "@/lib/intake";
import type { AcqRow, PhasePlanRow, PollRow, ReviewRuleRow } from "@/lib/launch-sequence";
import { computeMetrics, holdSince, type AcqMetrics, type MissionRow } from "@/lib/metrics";
import { agingItems, type CenterRow, type UserRow } from "@/lib/aging";
import { buildDigest, digestSections, digestAnnouncementBody, exportDigestPdf } from "@/lib/digest";

export const Route = createFileRoute("/digest")({
  head: () => ({
    meta: [
      { title: "Leadership digest — T-Minus" },
      {
        name: "description",
        content:
          "The week in one page: launched this week, at risk, aging holds, holds by reason by Center, and days returned to missions.",
      },
      { property: "og:title", content: "Leadership digest — T-Minus" },
      {
        property: "og:description",
        content: "A weekly digest computed from the record, exportable to PDF and postable as an announcement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DigestPage,
});

function DigestPage() {
  const { authState, user, role } = useRole();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["leadership-digest"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [missions, acqs, plan, rules, overrides, thresholds, strategies, polls, log, centers, users] = await Promise.all([
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
        supabase.from("centers").select("center_code,center_name,aging_threshold_days"),
        supabase.from("users").select("name,role,title,center_code,supervisor_name,supervisor_email"),
      ]);
      return {
        missions: (missions.data ?? []) as unknown as MissionRow[],
        acqs: (acqs.data ?? []) as unknown as AcqRow[],
        plan: (plan.data ?? []) as PhasePlanRow[],
        rules: (rules.data ?? []) as ReviewRuleRow[],
        overrides: overrides.data ?? [],
        thresholds: thresholds.data ?? [],
        strategies: strategies.data ?? [],
        polls: (polls.data ?? []) as PollRow[],
        log: log.data ?? [],
        centers: (centers.data ?? []) as unknown as CenterRow[],
        users: (users.data ?? []) as unknown as UserRow[],
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

  const metrics: AcqMetrics[] = useMemo(() => {
    if (!q.data) return [];
    return q.data.acqs.map((acq) =>
      computeMetrics(acq, {
        roster: q.data.users ?? [],
        plan: q.data.plan,
        rules: q.data.rules,
        polls: q.data.polls,
        ref,
        mission: q.data.missions.find((m) => m.mission_id === acq.mission_id) ?? null,
        holdSince: holdSince(acq.acquisition_id, q.data.log),
      }),
    );
  }, [q.data, ref]);

  const digest = useMemo(() => {
    if (!q.data) return null;
    const aging = agingItems(q.data.acqs, q.data.polls, q.data.centers, q.data.users);
    return buildDigest(metrics, aging);
  }, [q.data, metrics]);

  const sections = useMemo(() => (digest ? digestSections(digest) : []), [digest]);

  async function postAsAnnouncement() {
    if (!digest) return;
    setBusy(true);
    setMsg(null);
    const posted_at = new Date().toISOString();
    const title = `Leadership digest, week of ${digest.weekStart}`;
    const { error } = await supabase.from("announcements").insert({
      title,
      body: digestAnnouncementBody(digest),
      severity: "notice",
      audience_roles: null,
      audience_centers: null,
      effective_from: posted_at,
      effective_until: null,
      link: "/digest",
      requires_acknowledgment: false,
      posted_by: user.name,
      posted_at,
    });
    if (error) {
      setMsg(`The digest did not post: ${error.message}. Check that you are signed in as HQ, then send it again.`);
      setBusy(false);
      return;
    }
    await supabase.from("audit_log").insert({
      acquisition_id: null,
      actor: user.name,
      action: "Leadership digest sent",
      field: "announcement",
      old_value: null,
      new_value: title,
      reason: "Weekly digest",
      logged_at: posted_at,
    });
    setMsg("The digest is posted as an announcement.");
    setBusy(false);
  }

  return (
    <AppShell>
      <PageHeader
        title="Leadership digest"
        lead="The week in one page. Every figure is computed from the record; nothing here is typed by hand."
      />

      {q.isLoading ? <LoadingNote what="the week's figures" /> : null}
      {q.error ? <ErrorNote message={`The digest could not load: ${(q.error as Error).message}. Reload the page.`} /> : null}

      {digest ? (
        <>
          <p className="text-[13px] text-muted-foreground">
            Week of {digest.weekStart} through {digest.weekEnd}. Generated {new Date(digest.generatedAt).toLocaleString()}.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[13px]"
              onClick={() => {
                if (!exportDigestPdf(digest)) {
                  setMsg("The print window did not open. Allow pop-ups for this site, then export again.");
                }
              }}
            >
              Export as PDF
            </button>
            {role === "hq" ? (
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-[13px]"
                onClick={() => void postAsAnnouncement()}
                disabled={busy}
              >
                {busy ? "Sending" : "Send as an announcement"}
              </button>
            ) : null}
            <Link to="/" className="self-center text-[13px] text-primary underline">
              Compare with the Acquisitions tab
            </Link>
          </div>

          {msg ? (
            <p role="status" className="mt-3 max-w-[80ch] text-[13px]">
              {msg}
            </p>
          ) : null}

          {sections.map((s) => (
            <section key={s.heading} className="mt-8">
              <h2 className="text-[18px] leading-6 font-medium">{s.heading}</h2>
              <ul className="mt-2 max-w-[80ch] space-y-1 text-[13px] leading-[18px]">
                {s.lines.map((line) => (
                  <li key={line} data-numeric>
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : null}
    </AppShell>
  );
}
