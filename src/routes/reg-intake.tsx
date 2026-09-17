import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import {
  DATASETS,
  datasetById,
  diffDataset,
  diffSentence,
  readUpload,
  type Diff,
  type DiffRow,
} from "@/lib/reg-intake";
import {
  applySectionDiff,
  BINDING_CORPORA,
  daysSince,
  diffSections,
  filesCitingChangedSections,
  GUIDANCE_CORPORA,
  loadLiveSections,
  oldestRetrievedByCorpus,
  parseSectionFile,
  readSectionUpload,
  sectionDiffSentence,
  type SectionDiff,
  type SectionUpload,
} from "@/lib/regulation-sections";

/** The two text intake types. Both stage a difference before anything is written. */
const TEXT_TYPES = [
  {
    id: "regulation_text",
    label: "Regulation text",
    fileHint: "regulation_sections.jsonl",
    binding: true,
    corpora: BINDING_CORPORA as readonly string[],
  },
  {
    id: "practice_guidance",
    label: "Practice guidance",
    fileHint: "practice_guidance.jsonl",
    binding: false,
    corpora: GUIDANCE_CORPORA as readonly string[],
  },
] as const;

type TextTypeId = (typeof TEXT_TYPES)[number]["id"];

const isTextType = (id: string): id is TextTypeId => TEXT_TYPES.some((t) => t.id === id);

type LooseTable = {
  select: (cols: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
  insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
  update: (row: unknown) => { eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }> };
  delete: () => { eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }> };
};
/** Regulatory tables are chosen at run time, so the table name is a string here. */
const table = (name: string): LooseTable =>
  (supabase as unknown as { from: (t: string) => LooseTable }).from(name);

export const Route = createFileRoute("/reg-intake")({
  head: () => ({
    meta: [
      { title: "Regulatory data intake — T-Minus" },
      {
        name: "description",
        content:
          "HQ loads a new PCD list, clause matrix, template list, or thresholds file, reviews the difference, and applies it.",
      },
      { property: "og:title", content: "Regulatory data intake — T-Minus" },
      {
        property: "og:description",
        content: "Upload regulatory data, see what changes, set the effective date, and apply it with a notice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegIntakePage,
});

const todayISO = () => new Date().toISOString().slice(0, 10);

function RegIntakePage() {
  const { authState, hasRole, user } = useRole();
  const qc = useQueryClient();
  const isHq = hasRole("hq");

  const [datasetId, setDatasetId] = useState<string>(DATASETS[0]!.id);
  const textType = isTextType(datasetId) ? TEXT_TYPES.find((t) => t.id === datasetId)! : null;
  const dataset = datasetById(datasetId);
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [effective, setEffective] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sectionRows, setSectionRows] = useState<SectionUpload[] | null>(null);

  const q = useQuery({
    queryKey: ["reg-intake", dataset.table],
    enabled: authState === "signed-in" && !textType,
    queryFn: async () => {
      const { data, error } = await table(dataset.table).select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Record<string, unknown>[];
    },
  });

  const live = useQuery({
    queryKey: ["regulation-sections-live"],
    enabled: authState === "signed-in",
    queryFn: loadLiveSections,
  });

  const reminders = useMemo(() => {
    const rows = live.data ?? [];
    const loaded = oldestRetrievedByCorpus(rows);
    const seen = new Set(loaded.map((l) => l.corpus));
    const all = [...BINDING_CORPORA, ...GUIDANCE_CORPORA];
    return all.map((corpus) => {
      const hit = loaded.find((l) => l.corpus === corpus);
      if (!seen.has(corpus) || !hit) return `${corpus} text not loaded`;
      const days = daysSince(hit.retrieved_at);
      return `${corpus} text last loaded ${days === null ? "on an unrecorded date" : `${days} day${days === 1 ? "" : "s"} ago`}`;
    });
  }, [live.data]);

  const incoming = useMemo(() => {
    if (!text || textType) return null;
    try {
      // The file is read exactly as written; the effective date is recorded
      // with the change rather than written into rows that leave it blank.
      return readUpload(dataset, text);
    } catch {
      return null;
    }
  }, [text, dataset, textType]);

  const diff: Diff | null = useMemo(() => {
    if (!incoming || !q.data) return null;
    return diffDataset(dataset, incoming, q.data);
  }, [incoming, q.data, dataset]);

  const sectionDiff: SectionDiff | null = useMemo(() => {
    if (!textType || !sectionRows || !live.data) return null;
    return diffSections(sectionRows, live.data);
  }, [textType, sectionRows, live.data]);

  const pick = async (file: File | null) => {
    setMessage(null);
    setProblem(null);
    setSectionRows(null);
    if (!file) {
      setFileName(null);
      setText(null);
      return;
    }
    const body = await file.text();
    setFileName(file.name);
    setText(body);
    if (textType) {
      try {
        const parsed = parseSectionFile(body);
        setSectionRows(await readSectionUpload(parsed, textType.binding, textType.corpora));
      } catch (e) {
        setSectionRows(null);
        setProblem(
          `${e instanceof Error ? e.message : String(e)} Check the file is one section per line and upload it again.`,
        );
      }
    }
  };

  /** Text intake: supersede what is replaced, insert the new text, log it. */
  const applySections = async () => {
    if (!sectionDiff || !textType) return;
    setBusy(true);
    setMessage(null);
    setProblem(null);
    const now = new Date().toISOString();
    const actor = user.name;
    try {
      await applySectionDiff(sectionDiff);
      const summary = sectionDiffSentence(textType.label, sectionDiff);
      const touched = [...sectionDiff.changed, ...sectionDiff.removed, ...sectionDiff.added].map((r) => r.citation);
      let citing: string[] = [];
      try {
        citing = await filesCitingChangedSections(
          [...sectionDiff.changed, ...sectionDiff.removed].map((r) => r.citation),
        );
      } catch {
        citing = [];
      }
      const citingLine =
        citing.length > 0
          ? `Live files citing changed sections: ${citing.join(", ")}.`
          : "No live file cites a section whose text changed.";

      const { error: logError } = await supabase.from("audit_log").insert([
        {
          acquisition_id: null,
          actor,
          action: "Regulation text applied",
          field: "regulation_sections",
          old_value: `${live.data?.length ?? 0} live sections`,
          new_value: `${summary} ${citingLine}`,
          reason: reason.trim() || fileName,
          logged_at: now,
        },
      ] as never);
      if (logError) throw new Error(logError.message);

      setMessage(
        `${summary} ${touched.length} citation${touched.length === 1 ? "" : "s"} touched. Superseded text stays readable. ${citingLine}`,
      );
      setText(null);
      setFileName(null);
      setSectionRows(null);
      await qc.invalidateQueries({ queryKey: ["regulation-sections-live"] });
    } catch (e) {
      setProblem(
        `${e instanceof Error ? e.message : String(e)} Check that you are signed in as HQ, then apply again.`,
      );
    }
    setBusy(false);
  };

  const apply = async () => {
    if (!diff || !incoming) return;
    setBusy(true);
    setMessage(null);
    setProblem(null);
    const now = new Date().toISOString();
    const actor = user.name;
    try {
      for (const row of diff.added) {
        const { error } = await table(dataset.table).insert(row.incoming);
        if (error) throw new Error(error.message);
      }
      for (const row of diff.changed) {
        const { error } = await table(dataset.table).update(row.incoming).eq(dataset.pk, row.pkValue);
        if (error) throw new Error(error.message);
      }
      for (const row of diff.removed) {
        const { error } = await table(dataset.table).delete().eq(dataset.pk, row.pkValue);
        if (error) throw new Error(error.message);
      }

      const summary = diffSentence(dataset, diff, effective);
      const entries: Record<string, unknown>[] = [
        {
          acquisition_id: null,
          actor,
          action: "Regulatory data applied",
          field: dataset.table,
          old_value: `${q.data?.length ?? 0} rows loaded`,
          new_value: summary,
          reason: reason.trim() || fileName,
          logged_at: now,
        },
      ];
      for (const row of diff.changed.slice(0, 200)) {
        for (const c of row.changes) {
          entries.push({
            acquisition_id: null,
            actor,
            action: "Regulatory row changed",
            field: `${dataset.table}.${c.column} (${row.label})`,
            old_value: c.from,
            new_value: c.to,
            reason: `Effective ${effective}`,
            logged_at: now,
          });
        }
      }
      const { error: logError } = await supabase.from("audit_log").insert(entries as never);
      if (logError) throw new Error(logError.message);

      const { error: noticeError } = await supabase.from("announcements").insert({
        title: `Regulatory data updated: ${dataset.label}`,
        body: `${summary}${reason.trim() ? ` ${reason.trim()}` : ""} Loaded from ${fileName ?? "an uploaded file"} by ${actor}. Every figure and citation in T-Minus now reads from the updated rows.`,
        severity: "notice",
        audience_roles: null,
        audience_centers: null,
        effective_from: new Date(`${effective}T00:00:00`).toISOString(),
        effective_until: null,
        link: "/watch",
        requires_acknowledgment: false,
        posted_by: actor,
        posted_at: now,
      });
      if (noticeError) throw new Error(noticeError.message);

      setMessage(`${summary} An announcement is posted.`);
      setText(null);
      setFileName(null);
      await qc.invalidateQueries({ queryKey: ["reg-intake", dataset.table] });
    } catch (e) {
      setProblem(
        `${e instanceof Error ? e.message : String(e)} Check that you are signed in as HQ, then apply again.`,
      );
    }
    setBusy(false);
  };

  const field = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px]";

  return (
    <AppShell>
      <PageHeader
        title="Regulatory data intake"
        lead="HQ loads a new PCD list, clause matrix, template list, or thresholds file. T-Minus shows what changes against what is loaded before anything is written."
      />

      {!isHq ? (
        <p className="max-w-[80ch] text-muted-foreground">
          This action requires HQ or Administrator.
        </p>
      ) : null}

      {isHq ? (
        <section className="max-w-[80ch]">
          <h2 className="section-title">Upload</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dataset" className="text-[14px]">
                What is in the file
              </label>
              <select
                id="dataset"
                className={field}
                value={datasetId}
                onChange={(e) => {
                  setDatasetId(e.target.value);
                  setText(null);
                  setFileName(null);
                  setMessage(null);
                  setProblem(null);
                }}
              >
                {DATASETS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} ({d.fileHint})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="effective" className="text-[14px]">
                Effective date of this change
              </label>
              <input
                id="effective"
                type="date"
                className={field}
                value={effective}
                onChange={(e) => setEffective(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="file" className="text-[14px]">
                File (comma separated values)
              </label>
              <input
                id="file"
                type="file"
                accept=".csv,text/csv"
                className={field}
                onChange={(e) => void pick(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label htmlFor="reason" className="text-[14px]">
                Note for the record
              </label>
              <input
                id="reason"
                className={field}
                value={reason}
                placeholder="PCD number or HQ transmittal"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        </section>
      ) : null}

      {q.isLoading ? (
        <div className="mt-8">
          <LoadingNote what="the loaded regulatory data" />
        </div>
      ) : null}
      {q.error ? (
        <div className="mt-8">
          <ErrorNote message={`${(q.error as Error).message} Reload the page to try again.`} />
        </div>
      ) : null}

      {message ? (
        <p role="status" className="mt-8 max-w-[80ch] border-l-2 py-1 pl-3" style={{ borderColor: "var(--ontrack)" }}>
          {message}
        </p>
      ) : null}
      {problem ? (
        <div className="mt-8">
          <ErrorNote message={problem} />
        </div>
      ) : null}

      {isHq && !text ? (
        <div className="mt-8">
          <EmptyState sentence={`Nothing is staged. ${dataset.table} holds ${q.data?.length ?? 0} rows today.`} />
        </div>
      ) : null}

      {diff ? (
        <section className="mt-10">
          <h2 className="section-title">Difference against what is loaded</h2>
          <p className="mt-2 max-w-[80ch] text-muted-foreground">{diffSentence(dataset, diff, effective)}</p>

          <DiffTable heading="Changed rows" rows={diff.changed} kind="changed" />
          <DiffTable heading="New rows" rows={diff.added} kind="added" />
          <DiffTable heading="Rows no longer in the file" rows={diff.removed} kind="removed" />

          {isHq ? (
            <div className="mt-8 flex items-center gap-4">
              <button
                type="button"
                disabled={busy || diff.added.length + diff.changed.length + diff.removed.length === 0}
                onClick={() => void apply()}
                className="rounded-lg border border-border px-3 py-2 text-[14px] text-primary hover:border-primary disabled:opacity-60"
              >
                {busy ? "Applying" : "Apply and post the notice"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setText(null);
                  setFileName(null);
                }}
                className="rounded-lg border border-border px-3 py-2 text-[14px] hover:border-primary"
              >
                Discard the upload
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}

function DiffTable({
  heading,
  rows,
  kind,
}: {
  heading: string;
  rows: DiffRow[];
  kind: "added" | "changed" | "removed";
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-[16px] font-medium">
        {heading} ({rows.length})
      </h3>
      <table className="mt-3 w-full border-collapse text-[13px]">
        <caption className="sr-only">{heading}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-2 pr-4">
              Row
            </th>
            <th scope="col" className="py-2 pr-4">
              Field
            </th>
            <th scope="col" className="py-2 pr-4">
              Loaded now
            </th>
            <th scope="col" className="py-2">
              In the file
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            kind === "changed" ? (
              r.changes.map((c, i) => (
                <tr key={`${r.key}-${c.column}`} className="border-b border-border align-top">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    {i === 0 ? r.label : ""}
                  </th>
                  <td className="py-2 pr-4">{c.column}</td>
                  <td className="py-2 pr-4">{c.from || "not recorded"}</td>
                  <td className="py-2">{c.to || "not recorded"}</td>
                </tr>
              ))
            ) : (
              <tr key={r.key} className="border-b border-border align-top">
                <th scope="row" className="py-2 pr-4 text-left font-normal">
                  {r.label}
                </th>
                <td className="py-2 pr-4">{kind === "added" ? "whole row" : "whole row"}</td>
                <td className="py-2 pr-4">{kind === "removed" ? "loaded" : "not loaded"}</td>
                <td className="py-2">{kind === "added" ? "new in the file" : "not in the file"}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
