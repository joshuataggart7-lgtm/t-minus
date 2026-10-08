import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCanWrite } from "@/lib/use-can-write";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, LoadingNote, ErrorNote } from "@/components/app-shell";
import { DataTable, McPageHeader, StatusChip, type StatusTone } from "@/components/ui-mc";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import {
  DEVIATION_TEMPLATE,
  DEVIATION_TYPES,
  deviationClock,
  loadDeviations,
  logDeviation,
  type DeviationRow,
  type DeviationType,
} from "@/lib/deviations";

export const Route = createFileRoute("/deviations")({
  head: () => ({
    meta: [
      { title: "Deviations and waivers · T-Minus" },
      {
        name: "description",
        content: "FAR and NFS deviation requests, each with its legal, policy and HCA review board and its own clock.",
      },
      { property: "og:title", content: "Deviations and waivers · T-Minus" },
      {
        property: "og:description",
        content: "Deviation requests with their reviewers, their decision clock, and the decision on record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeviationsPage,
});

const inputClass = "mc-pa-input";

function statusTone(row: DeviationRow): StatusTone {
  if (row.decision === "approved") return "ontrack";
  if (row.decision === "denied" || row.decision === "disapproved") return "atrisk";
  return row.clock_state === "running" ? "attention" : "neutral";
}

function DeviationsPage() {
  const { authState, user } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canWrite = useCanWrite();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    citation: "",
    deviation_type: "individual" as DeviationType,
    acquisition_id: "",
    regulation_text: "",
    proposed_text: "",
    justification: "",
    need_date: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["deviations"], enabled: authState === "signed-in", queryFn: loadDeviations });
  const acqs = useQuery({
    queryKey: ["deviation-acquisitions"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_facts")
        .select("acquisition_id,title,center_code")
        .order("acquisition_id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const centre = acqs.data?.find((a) => a.acquisition_id === form.acquisition_id)?.center_code ?? user.center_code;
      const { data, error } = await supabase
        .from("deviation_requests")
        .insert({
          acquisition_id: form.acquisition_id || null,
          center_code: centre,
          title: form.title.trim(),
          citation: form.citation.trim(),
          deviation_type: form.deviation_type,
          regulation_text: form.regulation_text.trim() || null,
          proposed_text: form.proposed_text.trim() || null,
          justification: form.justification.trim() || null,
          requester_name: user.name,
          need_date: form.need_date || null,
        } as never)
        .select("deviation_id,acquisition_id")
        .single();
      if (error) throw new Error(error.message);
      const created = data as unknown as { deviation_id: string; acquisition_id: string | null };
      await logDeviation({
        acquisitionId: created.acquisition_id,
        actor: user.name,
        action: "Deviation request created",
        field: "deviation_request",
        newValue: `${form.citation.trim()} — ${form.title.trim()}`,
        reason: `${DEVIATION_TEMPLATE.name} (NF 1098 tab 33); ${DEVIATION_TEMPLATE.citation}`,
      });
      return created.deviation_id;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["deviations"] });
      void navigate({ to: "/deviations/$deviationId", params: { deviationId: id } });
    },
    onError: (e) => setMessage(e instanceof Error ? `The request was not saved: ${e.message}` : "It was not saved."),
  });

  const rows = q.data ?? [];
  const ready = form.title.trim().length > 2 && form.citation.trim().length > 2;

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Oversight"
        title="Deviations and waivers"
        lead="FAR and NFS deviation requests, each with its own review board (Approve or Disapprove) and its own clock to the decision."
        actions={canWrite ? (
          <button type="button" className={open ? "mc-req-button is-secondary" : "mc-req-button"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Close the request form" : "New deviation request"}
          </button>
        ) : undefined}
      />

      <p className="mc-pa-callout is-info mb-6">
        {DEVIATION_TEMPLATE.name} · NF 1098 tab {DEVIATION_TEMPLATE.tab} · {DEVIATION_TEMPLATE.revision} ·{" "}
        {DEVIATION_TEMPLATE.citation} · guidance
      </p>

      {authState !== "signed-in" ? <LoadingNote what="your sign-in" /> : null}
      {q.isLoading ? <LoadingNote what="the deviation requests" /> : null}
      {q.error ? <ErrorNote message="The list did not load. Reload the page and try again." /> : null}
      {message ? (
        <p role="status" className="mb-6 text-[15px]">
          {message}
        </p>
      ) : null}

      {canWrite ? (
        <section className="mb-6">
          {open ? (
            <form
              className="mc-kpanel max-w-[80ch]"
              onSubmit={(e) => {
                e.preventDefault();
                if (ready) create.mutate();
              }}
            >
              <div className="mb-4">
                <label htmlFor="dv-title" className="mc-pa-label">
                  What the deviation is for (required)
                </label>
                <input
                  id="dv-title"
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="dv-citation" className="mc-pa-label">
                  Regulation being deviated from (required)
                </label>
                <input
                  id="dv-citation"
                  className={inputClass}
                  placeholder="RFO FAR 52.216-18"
                  value={form.citation}
                  onChange={(e) => setForm({ ...form, citation: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="dv-type" className="mc-pa-label">
                  Type of deviation
                </label>
                <select
                  id="dv-type"
                  className={inputClass}
                  value={form.deviation_type}
                  onChange={(e) => setForm({ ...form, deviation_type: e.target.value as DeviationType })}
                >
                  {DEVIATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {`${t.label}: ${t.citation}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="dv-acq" className="mc-pa-label">
                  Acquisition it is attached to
                </label>
                <select
                  id="dv-acq"
                  className={inputClass}
                  value={form.acquisition_id}
                  onChange={(e) => setForm({ ...form, acquisition_id: e.target.value })}
                >
                  <option value="">Standalone, not attached to an acquisition</option>
                  {(acqs.data ?? []).map((a) => (
                    <option key={a.acquisition_id} value={a.acquisition_id}>
                      {`${a.acquisition_id} · ${a.title}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="dv-need" className="mc-pa-label">
                  Date the decision is needed
                </label>
                <input
                  id="dv-need"
                  type="date"
                  className={inputClass}
                  value={form.need_date}
                  onChange={(e) => setForm({ ...form, need_date: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="dv-reg" className="mc-pa-label">
                  What the regulation requires
                </label>
                <textarea
                  id="dv-reg"
                  rows={3}
                  className={inputClass}
                  value={form.regulation_text}
                  onChange={(e) => setForm({ ...form, regulation_text: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="dv-prop" className="mc-pa-label">
                  What is proposed instead
                </label>
                <textarea
                  id="dv-prop"
                  rows={3}
                  className={inputClass}
                  value={form.proposed_text}
                  onChange={(e) => setForm({ ...form, proposed_text: e.target.value })}
                />
              </div>
              <div className="mb-6">
                <label htmlFor="dv-just" className="mc-pa-label">
                  Justification
                </label>
                <textarea
                  id="dv-just"
                  rows={4}
                  className={inputClass}
                  value={form.justification}
                  onChange={(e) => setForm({ ...form, justification: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="mc-req-button"
                disabled={!ready || create.isPending}
              >
                {create.isPending ? "Saving" : "Save the request"}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {q.data ? (
        <section className="mc-kpanel">
          <div className="mc-kpanel-head"><div>
            <h2 className="mc-kpanel-title">Requests on record</h2>
            <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground" data-numeric>
              {rows.length ? `${rows.length} ${rows.length === 1 ? "request" : "requests"}, each with its own clock to the decision.` : "Each request opens its own review board and starts its own clock."}
            </p>
          </div></div>
          <div className="mt-4">
            <DataTable
              label="Deviation requests"
              rowKey={(r) => r.deviation_id}
              rows={rows}
              empty={
                <div>
                  <p className="font-medium text-foreground">No deviation requests yet.</p>
                  <p className="mt-1 max-w-[70ch] text-muted-foreground">
                    Deviation requests will appear here.
                  </p>
                  {canWrite && !open ? (
                    <button type="button" className="mc-req-button mt-3" onClick={() => setOpen(true)}>
                      New deviation request
                    </button>
                  ) : null}
                </div>
              }
              columns={[
                { key: "request", header: "Request", rowHeader: true, cell: (r) => <Link to="/deviations/$deviationId" params={{ deviationId: r.deviation_id }} className="text-primary underline">{r.title}</Link> },
                { key: "reg", header: "Regulation", cell: (r) => r.citation },
                { key: "acq", header: "Attached to", nowrap: true, cell: (r) => r.acquisition_id ?? "Standalone" },
                { key: "clock", header: "Clock", nowrap: true, cell: (r) => <span data-numeric>{deviationClock(r).reading}</span> },
                { key: "state", header: "State", cell: (r) => <StatusChip tone={statusTone(r)} label={deviationClock(r).state} /> },
              ]}
            />
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
