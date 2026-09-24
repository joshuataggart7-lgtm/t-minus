// Invite another office — advisory only. Existing poll rows are shown as they
// stand; the invite text is copy-only. Nothing is sent, no poll row is created,
// and nothing here holds the file or blocks a phase exit.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deriveOverviewAcquisitionState } from "@/components/mission-control/operational-state";
import type { AcqRow } from "@/lib/launch-sequence";
import {
  NO_OPEN_REVIEW_NOTE,
  NO_SEND_NOTE,
  inviteName,
  inviteText,
  loadInviteData,
  openPolls,
  voteLabel,
} from "@/lib/office-invite";

export function OfficeInvitePanel({
  acquisitionId,
  acq,
  onBanner,
}: {
  acquisitionId: string;
  acq: Record<string, unknown> | null | undefined;
  onBanner?: (s: string) => void;
}) {
  const q = useQuery({
    queryKey: ["office-invite", acquisitionId],
    queryFn: () => loadInviteData(acquisitionId),
  });
  // Phase from the shared operational remap (award only from a recorded
  // Launched audit), never raw current_phase / clock_state.
  const logQ = useQuery({
    queryKey: ["office-invite-log", acquisitionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("acquisition_id,action,logged_at")
        .eq("acquisition_id", acquisitionId)
        .eq("action", "Launched");
      return data ?? [];
    },
  });
  const phase = acq
    ? (deriveOverviewAcquisitionState(acq as unknown as AcqRow, logQ.data ?? []).acquisition.current_phase ?? null)
    : null;
  const [role, setRole] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const polls = q.data?.polls ?? [];
  const open = openPolls(polls);
  const roles = q.data?.roles ?? [];
  const chosen = role || roles[0] || "";
  const draft = chosen
    ? inviteText({
        acquisitionId,
        title: (acq?.['title'] as string | null | undefined) ?? null,
        phase: logQ.isSuccess ? phase : null,
        role: chosen,
      })
    : "";

  return (
    <section
      id="invite-another-office"
      aria-label="Invite another office"
      className="mb-10 max-w-[80ch] rounded-xl border border-border bg-background p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] leading-6 font-medium">Invite another office</h2>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      <h3 className="mt-4 text-[15px] font-medium leading-[22px]">Reviews open on this file</h3>
      {open.length === 0 ? (
        <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground">{NO_OPEN_REVIEW_NOTE}</p>
      ) : (
        <ul className="mt-2 list-none">
          {open.map((p) => (
            <li key={p.poll_id} className="border-t border-border py-2 text-[13px] leading-[18px]">
              <span className="font-medium">{p.reviewer_role ?? "Office not recorded"}</span>
              <span className="text-muted-foreground">
                {" "}
                — {inviteName(p)} · {voteLabel(p)} · due {p.due_date ?? "Not recorded"}
                {p.phase ? ` · ${p.phase}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 text-[15px] font-medium leading-[22px]">Write an invite</h3>
      <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{NO_SEND_NOTE}</p>

      {roles.length === 0 ? (
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
          No reviewer offices are loaded, so no invite text can be written.
        </p>
      ) : (
        <>
          <label className="mt-3 block text-[13px] text-muted-foreground" htmlFor="invite-office-role">
            Office to invite
          </label>
          <select
            id="invite-office-role"
            value={chosen}
            onChange={(e) => {
              setRole(e.target.value);
              setNote(null);
            }}
            className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[13px]"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap border border-border bg-muted/30 p-3 text-[13px] leading-[18px]">
            {draft}
          </pre>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[13px] hover:bg-muted"
              onClick={() => {
                void navigator.clipboard?.writeText(draft).then(
                  () => {
                    setNote("Copied. Paste it into your mail client.");
                    onBanner?.("The invite text was copied. T-Minus did not send or post anything.");
                  },
                  () => setNote("The copy did not go through. Select the text and copy it by hand."),
                );
              }}
            >
              Copy the invite
            </button>
            {note ? <span className="text-[13px] text-muted-foreground">{note}</span> : null}
          </div>
        </>
      )}
    </section>
  );
}
