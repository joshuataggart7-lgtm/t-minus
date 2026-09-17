// "Show me the text": what the prototype actually holds for a citation.
//
// When the loaded regulation corpus carries the section, the verbatim text is
// shown with its corpus, retrieval date, source link, and whether it binds.
// When it does not, T-Minus says so plainly and keeps the official link from
// the reference list. No regulation text is ever generated here.

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CITE_HEADING_ONLY_NOTE,
  citationHasCompanionGuide,
  citationTokens,
  useCiteCorpus,
} from "@/lib/cite-stub";
import { formatRefDate, tierLabel, type RegRefRow } from "@/lib/regulation-sidebar";
import {
  formatRetrieved,
  loadLiveSections,
  nearbyCitations,
  resolveSections,
  type RegulationSection,
} from "@/lib/regulation-sections";

const NO_BODY_NOTE =
  "The full regulation paragraph is not loaded in this prototype. Read the authority at its official source before relying on it.";

const NFS_CG_NOTE = "NFS Companion Guide text is not loaded in this prototype.";

const CORPUS_LABEL: Record<string, string> = {
  far_rfo: "FAR (RFO)",
  nfs: "NFS",
  pcd: "PCD",
  far_companion: "FAR Companion",
  nfs_companion: "NFS Companion Guide",
  buying_guide: "Buying guide",
};

function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Corpus rows whose citation or part matches a token in the citation shown. */
export function corpusRowsFor(citation: string | null | undefined, rows: RegRefRow[] | undefined): RegRefRow[] {
  const tokens = citationTokens(citation).map(normalise);
  if (tokens.length === 0 || !rows) return [];
  return rows.filter((r) => {
    const hay = normalise(`${r.citation ?? ""} ${r.title ?? ""} ${r.far_part ?? ""} ${r.nfs_part ?? ""}`);
    return tokens.some((t) => hay.includes(t));
  });
}

/** Live regulation_sections rows, loaded once per session. */
export function useLiveSections() {
  const q = useQuery({
    queryKey: ["regulation-sections-live"],
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: loadLiveSections,
  });
  return { rows: q.data, loading: q.isPending, failed: q.isError };
}

function SectionBlock({ s }: { s: RegulationSection }) {
  return (
    <li>
      <p className="font-medium">
        {s.citation}
        {s.heading ? ` · ${s.heading}` : ""}
      </p>
      <p className="text-muted-foreground">
        {CORPUS_LABEL[s.corpus] ?? s.corpus} · {s.corpus_revision} · loaded {formatRetrieved(s.retrieved_at)}
      </p>
      <p className="mt-1">
        {s.binding ? (
          <span className="border border-border px-2 py-0.5 text-[12px]">Binding authority</span>
        ) : (
          <span className="border border-border px-2 py-0.5 text-[12px]">Non-binding practice guidance</span>
        )}
      </p>
      <p className="mt-2 whitespace-pre-wrap">{s.text}</p>
      <a
        href={s.source_url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-primary underline-offset-2 hover:underline"
      >
        Read it at the official source
      </a>
    </li>
  );
}

export function ShowTheText({ citation }: { citation: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { rows, state } = useCiteCorpus();
  const sections = useLiveSections();
  if (!String(citation ?? "").trim()) return null;

  const resolved = resolveSections(citation, sections.rows);
  const matches = corpusRowsFor(citation, rows);
  const isCompanionGuide = citationHasCompanionGuide(citation);
  const nearby = resolved.length === 0 ? nearbyCitations(citation, sections.rows) : [];

  return (
    <span className="inline-block align-baseline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="text-[13px] text-primary underline-offset-2 hover:underline"
      >
        {open ? "Hide the reference" : "Show me the text"}
      </button>
      {open ? (
        <div id={id} className="mt-2 max-w-[70ch] border border-border bg-background p-4 text-[13px] leading-[18px]">
          <p className="font-medium">{citation}</p>

          {sections.loading ? (
            <p className="mt-2 text-muted-foreground">Loading the loaded regulation text.</p>
          ) : resolved.length > 0 ? (
            <ul className="mt-2 space-y-4">
              {resolved.map((s) => (
                <SectionBlock key={s.id} s={s} />
              ))}
            </ul>
          ) : (
            <>
              {isCompanionGuide ? <p className="mt-1 text-muted-foreground">{NFS_CG_NOTE}</p> : null}
              <p className="mt-2 text-muted-foreground">
                The citation is recorded, but the section text is not loaded in this prototype.
                {nearby.length > 0
                  ? ` The loaded corpus carries ${nearby.slice(0, 4).join(", ")} instead.`
                  : ""}{" "}
                {NO_BODY_NOTE}
              </p>
              {state.loading ? (
                <p className="mt-2 text-muted-foreground">Loading the reference list.</p>
              ) : matches.length > 0 ? (
                <ul className="mt-2 space-y-3">
                  {matches.slice(0, 4).map((r) => (
                    <li key={r.ref_id}>
                      <p className="font-medium">
                        {r.citation ?? "Citation not recorded"} · {tierLabel(r.tier)}
                      </p>
                      <p>{r.title ?? "Title not recorded"}</p>
                      <p className="text-muted-foreground">
                        {r.source ?? "Source not recorded"} · effective {formatRefDate(r.effective_date)}
                      </p>
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Read it at the official source
                        </a>
                      ) : (
                        <p className="text-muted-foreground">No official link is recorded for this reference.</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  No reference row for this citation is loaded either, so it is shown as recorded text only.
                </p>
              )}
            </>
          )}
        </div>
      ) : null}
    </span>
  );
}
