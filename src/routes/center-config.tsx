import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { TriggerTableEditor } from "@/components/trigger-table-editor";
import { supabase } from "@/integrations/supabase/client";
import { CENTER_POLICY_NOTE, todayISO, type CenterOverrideRow } from "@/lib/center-config";
import { MEMO_DOCUMENT_KEYS, type MemoRoutingRow } from "@/lib/nf1858";
import { PeopleRoles } from "@/components/people-roles";
import { PeopleContacts } from "@/components/people-contacts";
import { RoutingCsvImport } from "@/components/routing-csv-import";

export const Route = createFileRoute("/center-config")({
  head: () => ({
    meta: [
      { title: "Center configuration — T-Minus" },
      {
        name: "description",
        content: "Per-Center overrides of threshold values and review rule triggers, each with an effective date.",
      },
      { property: "og:title", content: "Center configuration — T-Minus" },
      {
        property: "og:description",
        content: "HQ and Center procurement officers set threshold and review trigger values by Center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CenterConfigPage,
});

function CenterConfigPage() {
  const { authState, hasRole, hasAnyRole, user } = useRole();
  const qc = useQueryClient();
  const mayEdit = hasAnyRole(["hq", "specialist"]);

  const [center, setCenter] = useState("");
  const [kind, setKind] = useState<"threshold" | "review_trigger">("review_trigger");
  const [target, setTarget] = useState("");
  const [value, setValue] = useState("");
  const [effective, setEffective] = useState(todayISO());
  const [note, setNote] = useState(CENTER_POLICY_NOTE);
  const [citation, setCitation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [newCenter, setNewCenter] = useState("");
  const [newDocKey, setNewDocKey] = useState("");

  const q = useQuery({
    queryKey: ["center-config"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [centers, overrides, thresholds, rules, routing] = await Promise.all([
        supabase.from("centers").select("center_code,center_name").order("center_code"),
        supabase.from("center_overrides").select("*").order("effective_date", { ascending: false }),
        supabase.from("thresholds").select("name,value,citation").order("name"),
        supabase.from("review_rules").select("reviewer_role,trigger,citation").order("reviewer_role"),
        supabase.from("memo_routing").select("*").order("center_code").order("document_key"),
      ]);
      return {
        centers: centers.data ?? [],
        overrides: (overrides.data ?? []) as unknown as CenterOverrideRow[],
        thresholds: thresholds.data ?? [],
        rules: rules.data ?? [],
        routing: (routing.data ?? []) as unknown as MemoRoutingRow[],
      };
    },
  });

  const targetOptions =
    kind === "threshold"
      ? (q.data?.thresholds ?? []).map((t) => ({ name: t.name ?? "", citation: t.citation ?? "" }))
      : (q.data?.rules ?? []).map((r) => ({ name: r.reviewer_role, citation: r.citation ?? "" }));

  async function log(action: string, field: string, oldValue: string | null, newValue: string | null, reason: string) {
    await supabase.from("audit_log").insert({
      acquisition_id: null,
      actor: user?.name ?? "Unknown",
      action,
      field,
      old_value: oldValue,
      new_value: newValue,
      reason,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setProblem(null);
    if (!center || !target || !value.trim()) {
      setProblem("Choose a Center, choose what it overrides, and enter a value.");
      return;
    }
    const n = Number(value.replace(/[$,]/g, ""));
    if (!Number.isFinite(n)) {
      setProblem("The value must be a number, such as 750000.");
      return;
    }
    const { error } = await supabase.from("center_overrides").insert({
      center_code: center,
      kind,
      target,
      value: n,
      note: note.trim() || null,
      citation: citation.trim() || null,
      effective_date: effective,
      set_by: user?.name ?? null,
    });
    if (error) {
      setProblem(`The override was not saved: ${error.message}`);
      return;
    }
    await log(
      "Center configuration set",
      `${center} · ${target}`,
      null,
      String(n),
      note.trim() || CENTER_POLICY_NOTE,
    );
    setValue("");
    setMessage(`${center} now uses ${n.toLocaleString()} for ${target}, effective ${effective}.`);
    void qc.invalidateQueries({ queryKey: ["center-config"] });
  }

  async function supersede(row: CenterOverrideRow) {
    const { error } = await supabase
      .from("center_overrides")
      .update({ superseded_date: todayISO() })
      .eq("override_id", row.override_id);
    if (error) {
      setProblem(`The override was not ended: ${error.message}`);
      return;
    }
    await log(
      "Center configuration ended",
      `${row.center_code} · ${row.target}`,
      row.value === null ? null : String(row.value),
      null,
      note.trim() || CENTER_POLICY_NOTE,
    );
    setMessage(`${row.target} at ${row.center_code} returns to the seeded value today.`);
    void qc.invalidateQueries({ queryKey: ["center-config"] });
  }

  async function saveRouting(row: MemoRoutingRow) {
    setMessage(null);
    setProblem(null);
    const { error } = await supabase.from("memo_routing").upsert(
      {
        center_code: row.center_code,
        document_key: row.document_key,
        approving_official_title: row.approving_official_title,
        thru_chain: row.thru_chain ?? [],
        memo_default: row.memo_default,
        updated_by: user?.name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "center_code,document_key" },
    );
    if (error) {
      setProblem(`The routing was not saved: ${error.message}`);
      return;
    }
    await log(
      "Memorandum routing set",
      `${row.center_code} · ${row.document_key}`,
      null,
      row.approving_official_title,
      CENTER_POLICY_NOTE,
    );
    setMessage(`${row.center_code} memoranda of this type now go to ${row.approving_official_title}.`);
    void qc.invalidateQueries({ queryKey: ["center-config"] });
  }

  const rows = q.data?.overrides ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Center configuration"
        lead="Threshold values and review rule triggers can be set per Center with an effective date. Legal and pricing triggers are Center policy; every change is logged."
      />

      {q.isLoading ? <LoadingNote what="the Center configuration" /> : null}
      {q.error ? <ErrorNote message="The Center configuration could not be read. Refresh the page to try again." /> : null}

      {hasRole("administrator") ? <PeopleRoles actorName={user?.name ?? "Unknown"} /> : null}
      <PeopleContacts actorName={user?.name ?? "Unknown"} mayEdit={mayEdit} />

      {mayEdit ? (
        <form onSubmit={save} className="mt-8 max-w-[70ch] border-t border-border pt-6">
          <h2 className="text-lg font-medium">Set an override</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted">Center</span>
              <select
                value={center}
                onChange={(e) => setCenter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">Choose a Center</option>
                {(q.data?.centers ?? []).map((c) => (
                  <option key={c.center_code} value={c.center_code}>
                    {c.center_code} — {c.center_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted">What it overrides</span>
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as "threshold" | "review_trigger");
                  setTarget("");
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="review_trigger">Review rule trigger</option>
                <option value="threshold">Threshold value</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-muted">{kind === "threshold" ? "Threshold" : "Reviewer"}</span>
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  const found = targetOptions.find((o) => o.name === e.target.value);
                  setCitation(found?.citation ?? "");
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">Choose one</option>
                {targetOptions.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted">Dollar value</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Effective date</span>
              <input
                type="date"
                value={effective}
                onChange={(e) => setEffective(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Citation</span>
              <input
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Note</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground">
            Save override
          </button>
          {message ? <p className="mt-3 text-sm text-ontrack">{message}</p> : null}
          {problem ? <p className="mt-3 text-sm text-atrisk">{problem}</p> : null}
        </form>
      ) : (
        <p className="mt-6 text-muted">
          This action requires Contracting, HQ, or Administrator.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-medium">Overrides</h2>
        {rows.length === 0 && !q.isLoading ? (
          <EmptyState sentence="No Center overrides are set. Every Center uses the seeded values." />
        ) : null}
        {rows.length > 0 ? (
          <table className="mt-3 w-full border-collapse text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Center</th>
                <th scope="col" className="py-2 pr-4 font-medium">Overrides</th>
                <th scope="col" className="py-2 pr-4 font-medium">Target</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Value</th>
                <th scope="col" className="py-2 pr-4 font-medium">Effective</th>
                <th scope="col" className="py-2 pr-4 font-medium">State</th>
                <th scope="col" className="py-2 pr-4 font-medium">Citation</th>
                <th scope="col" className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ended = Boolean(r.superseded_date && r.superseded_date <= todayISO());
                const pending = r.effective_date > todayISO();
                return (
                  <tr key={r.override_id} className="border-b border-border align-top">
                    <td className="py-2 pr-4">{r.center_code}</td>
                    <td className="py-2 pr-4">{r.kind === "threshold" ? "Threshold" : "Review trigger"}</td>
                    <td className="py-2 pr-4">{r.target}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.value === null ? "—" : Number(r.value).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{r.effective_date}</td>
                    <td className="py-2 pr-4">
                      {ended ? `Ended ${r.superseded_date}` : pending ? "Not yet effective" : "In effect"}
                    </td>
                    <td className="py-2 pr-4 text-muted">{r.citation || r.note || CENTER_POLICY_NOTE}</td>
                    <td className="py-2">
                      {mayEdit && !ended ? (
                        <button
                          type="button"
                          className="rounded-lg border border-border px-3 py-1 text-primary"
                          onClick={() => void supersede(r)}
                        >
                          End today
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Memorandum routing, NF 1858</h2>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted">
          To and Thru on a memorandum read from this table. The seeded ARC titles are placeholders; edit them for
          your Center.
        </p>
        {(q.data?.routing ?? []).length === 0 && !q.isLoading ? (
          <EmptyState sentence="No memorandum routing is set. Add a row for a Center and document type." />
        ) : null}
        <table className="mt-3 w-full border-collapse text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th scope="col" className="py-2 pr-4 font-medium">Center</th>
              <th scope="col" className="py-2 pr-4 font-medium">Document type</th>
              <th scope="col" className="py-2 pr-4 font-medium">Approving official title (To)</th>
              <th scope="col" className="py-2 pr-4 font-medium">Thru chain, comma separated</th>
              <th scope="col" className="py-2 pr-4 font-medium">Issue on NF 1858 by default</th>
              <th scope="col" className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.routing ?? []).map((r) => (
              <MemoRoutingRowEditor key={r.routing_id} row={r} mayEdit={mayEdit} onSaved={saveRouting} />
            ))}
          </tbody>
        </table>
        {mayEdit ? (
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCenter || !newDocKey) {
                setProblem("Choose a Center and a document type before adding a route.");
                return;
              }
              void saveRouting({
                center_code: newCenter,
                document_key: newDocKey,
                approving_official_title: "Branch Chief (placeholder)",
                thru_chain: [],
                memo_default: true,
              } as MemoRoutingRow);
            }}
          >
            <label className="block text-sm">
              <span className="text-muted">Center</span>
              <select
                value={newCenter}
                onChange={(e) => setNewCenter(e.target.value)}
                className="mt-1 rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">Choose a Center</option>
                {(q.data?.centers ?? []).map((c) => (
                  <option key={c.center_code} value={c.center_code}>
                    {c.center_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted">Document type</span>
              <select
                value={newDocKey}
                onChange={(e) => setNewDocKey(e.target.value)}
                className="mt-1 rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="">Choose a document type</option>
                {MEMO_DOCUMENT_KEYS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg border border-border px-4 py-2 text-primary">
              Add a route
            </button>
          </form>
        ) : null}
      </section>

      {mayEdit ? (
        <RoutingCsvImport
          actorName={user?.name ?? "Unknown"}
          centers={(q.data?.centers ?? []).map((c) => c.center_code)}
          documentKeys={MEMO_DOCUMENT_KEYS.map((k) => k.key)}
          onApplied={() => void qc.invalidateQueries({ queryKey: ["center-config"] })}
        />
      ) : null}

      <TriggerTableEditor mayEdit={hasAnyRole(["hq"]) || hasRole("administrator")} actor={user.name} />
    </AppShell>
  );
}

function MemoRoutingRowEditor({
  row,
  mayEdit,
  onSaved,
}: {
  row: MemoRoutingRow;
  mayEdit: boolean;
  onSaved: (row: MemoRoutingRow) => Promise<void>;
}) {
  const [title, setTitle] = useState(row.approving_official_title ?? "");
  const [thru, setThru] = useState((row.thru_chain ?? []).join(", "));
  const [def, setDef] = useState(row.memo_default !== false);
  return (
    <tr className="border-b border-border align-top">
      <td className="py-2 pr-4">{row.center_code}</td>
      <td className="py-2 pr-4">
        {MEMO_DOCUMENT_KEYS.find((k) => k.key === row.document_key)?.name ?? row.document_key}
        {row.note ? <div className="text-muted">{row.note}</div> : null}
      </td>
      <td className="py-2 pr-4">
        <label className="sr-only" htmlFor={`title-${row.routing_id}`}>Approving official title</label>
        <input
          id={`title-${row.routing_id}`}
          value={title}
          disabled={!mayEdit}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-2 py-1"
        />
      </td>
      <td className="py-2 pr-4">
        <label className="sr-only" htmlFor={`thru-${row.routing_id}`}>Thru chain</label>
        <input
          id={`thru-${row.routing_id}`}
          value={thru}
          disabled={!mayEdit}
          onChange={(e) => setThru(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-2 py-1"
        />
      </td>
      <td className="py-2 pr-4">
        <label className="sr-only" htmlFor={`def-${row.routing_id}`}>Issue on NF 1858 by default</label>
        <input
          id={`def-${row.routing_id}`}
          type="checkbox"
          checked={def}
          disabled={!mayEdit}
          onChange={(e) => setDef(e.target.checked)}
        />
      </td>
      <td className="py-2">
        {mayEdit ? (
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1 text-primary"
            onClick={() =>
              void onSaved({
                ...row,
                approving_official_title: title,
                thru_chain: thru.split(",").map((t) => t.trim()).filter(Boolean),
                memo_default: def,
              })
            }
          >
            Save
          </button>
        ) : null}
      </td>
    </tr>
  );
}
