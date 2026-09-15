import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState, StatusMark } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import {
  agingItems,
  digestBySupervisor,
  DEFAULT_AGING_DAYS,
  type CenterRow,
  type UserRow,
} from "@/lib/aging";
import type { AcqRow, PollRow } from "@/lib/launch-sequence";

export const Route = createFileRoute("/escalations")({
  head: () => ({
    meta: [
      { title: "Aging holds and escalation — T-Minus" },
      {
        name: "description",
        content: "Holds and pending Go/No-go polls past the Center's aging threshold, gathered for each supervisor.",
      },
      { property: "og:title", content: "Aging holds and escalation — T-Minus" },
      {
        property: "og:description",
        content: "Every aging hold and pending poll, its age in days, its owner, and the supervisor it escalates to.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EscalationsPage,
});

function EscalationsPage() {
  const { authState, user, role } = useRole();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const canConfigure = role === "hq";

  const q = useQuery({
    queryKey: ["aging-escalations"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [acqs, polls, centers, users] = await Promise.all([
        supabase.from("acquisition_facts").select("*"),
        supabase.from("polls").select("*"),
        supabase.from("centers").select("center_code,center_name,aging_threshold_days").order("center_code"),
        supabase.from("users").select("name,role,title,center_code,supervisor_name,supervisor_email"),
      ]);
      const [plan, attachments] = await Promise.all([
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("document_attachments").select("acquisition_id,doc_key"),
      ]);
      // The hold shown here is recomputed from the record and the stored files,
      // so this page, the work queue and the file header read the same cause.
      const rows = ((acqs.data ?? []) as unknown as AcqRow[]).map((acq) => {
        if (acq.clock_state === "launched" || acq.status === "scrubbed") return acq;
        const cause = holdFromRecord(
          acq,
          (plan.data ?? []) as never,
          keysFrom(attachments.data ?? [], acq.acquisition_id),
        );
        return {
          ...acq,
          hold_reason: cause?.reason ?? null,
          hold_owner: cause?.owner ?? null,
          clock_state: cause ? "hold" : acq.clock_state,
        } as AcqRow;
      });
      return {
        acqs: rows,
        polls: (polls.data ?? []) as unknown as PollRow[],
        centers: (centers.data ?? []) as unknown as CenterRow[],
        users: (users.data ?? []) as unknown as UserRow[],
      };
    },
  });

  const items = useMemo(
    () => agingItems(q.data?.acqs ?? [], q.data?.polls ?? [], q.data?.centers ?? [], q.data?.users ?? []),
    [q.data],
  );
  const digest = useMemo(() => digestBySupervisor(items), [items]);

  const setThreshold = useMutation({
    mutationFn: async ({ centerCode, days }: { centerCode: string; days: number }) => {
      const { error } = await supabase
        .from("centers")
        .update({ aging_threshold_days: days } as never)
        .eq("center_code", centerCode);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        acquisition_id: null,
        actor: user.name,
        action: "Aging threshold changed",
        field: "aging_threshold_days",
        old_value: null,
        new_value: `${centerCode}: ${days} days`,
        reason: "Center policy",
        phase: null,
      } as never);
    },
    onSuccess: () => {
      setBanner("The aging threshold is saved. Center policy sets this number.");
      void qc.invalidateQueries({ queryKey: ["aging-escalations"] });
    },
    onError: (e: Error) => setBanner(`That number did not save: ${e.message}. Try again.`),
  });

  return (
    <AppShell>
      <PageHeader
        title="Aging holds and escalation"
        lead="Every hold and every pending Go/No-go poll carries an age in days. Past the number of days the Center sets, the item is aging and appears in the digest for the owner's supervisor."
      />
      {banner ? (
        <p role="status" className="mb-4 max-w-[70ch] text-[13px]">
          {banner}
        </p>
      ) : null}

      {q.isLoading ? <LoadingNote what="the aging holds and polls" /> : null}
      {q.isError ? <ErrorNote message="The aging items did not load. Refresh the page to try again." /> : null}

      {q.data ? (
        <>
          <h2 className="section-title text-[18px] leading-6 font-medium">Open holds and pending polls</h2>
          {items.length === 0 ? (
            <EmptyState sentence="No file is on hold and no poll is waiting on a vote." />
          ) : (
            <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-2">Acquisition</th>
                  <th scope="col" className="p-2">Center</th>
                  <th scope="col" className="p-2">Waiting on</th>
                  <th scope="col" className="p-2">Owner</th>
                  <th scope="col" className="p-2">Age</th>
                  <th scope="col" className="p-2">Aging after</th>
                  <th scope="col" className="p-2">Standing</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={`${item.kind}-${item.acquisitionId}-${i}`} className="border-b border-border last:border-0">
                    <td className="p-2">
                      <Link
                        to="/files/$acquisitionId"
                        params={{ acquisitionId: item.acquisitionId }}
                        className="text-primary underline"
                      >
                        {item.acquisitionId}
                      </Link>
                    </td>
                    <td className="p-2">{item.centerCode}</td>
                    <td className="p-2">{item.subject}</td>
                    <td className="p-2">{item.owner}</td>
                    <td className="p-2" data-numeric>
                      {item.ageDays} days
                    </td>
                    <td className="p-2" data-numeric>
                      {item.thresholdDays} days
                    </td>
                    <td className="p-2">
                      {item.aging ? (
                        <StatusMark color="var(--needsattention)" className="text-[13px] leading-[18px]">
                          Aging
                        </StatusMark>
                      ) : (
                        <StatusMark color="var(--ontrack)" className="text-[13px] leading-[18px]">
                          Within the Center window
                        </StatusMark>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="section-title mt-10 text-[18px] leading-6 font-medium">Supervisor digest</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
            One entry per aging item, gathered for the supervisor recorded on the owner's user record.
          </p>
          {digest.length === 0 ? (
            <EmptyState sentence="Nothing is aging, so no digest entry has been raised." />
          ) : (
            digest.map((group) => (
              <div key={group.supervisor} className="mt-4">
                <h3 className="text-[15px] leading-[22px] font-medium">
                  {group.supervisor}
                  {group.supervisorEmail ? ` · ${group.supervisorEmail}` : ""}
                </h3>
                <ul className="mt-1 max-w-[70ch] text-[13px] leading-[22px]">
                  {group.items.map((item, i) => (
                    <li key={`${item.acquisitionId}-${i}`}>
                      {item.acquisitionId}: {item.subject} — {item.ageDays} days with {item.owner}
                      {item.phase ? ` at ${item.phase}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          <h2 className="section-title mt-10 text-[18px] leading-6 font-medium">Aging threshold by Center</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
            Center policy sets the number of days. The default is {DEFAULT_AGING_DAYS} days.
          </p>
          <table className="mt-3 w-full max-w-[640px] border border-border bg-background text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-2">Center</th>
                <th scope="col" className="p-2">Aging after</th>
              </tr>
            </thead>
            <tbody>
              {(q.data.centers ?? []).map((c) => (
                <tr key={c.center_code} className="border-b border-border last:border-0">
                  <td className="p-2">
                    {c.center_code} — {c.center_name}
                  </td>
                  <td className="p-2">
                    <label className="sr-only" htmlFor={`aging-${c.center_code}`}>
                      Aging threshold in days for {c.center_code}
                    </label>
                    <input
                      id={`aging-${c.center_code}`}
                      type="number"
                      min={0}
                      max={90}
                      className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-[13px]"
                      defaultValue={c.aging_threshold_days ?? DEFAULT_AGING_DAYS}
                      disabled={!canConfigure}
                      onBlur={(e) =>
                        setThreshold.mutate({ centerCode: c.center_code, days: Number(e.target.value || 0) })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!canConfigure ? (
            <p className="mt-2 max-w-[70ch] text-[13px] text-muted-foreground">
              HQ sets these numbers.
            </p>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
