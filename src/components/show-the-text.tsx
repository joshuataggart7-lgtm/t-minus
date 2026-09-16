// "Show me the text": what the prototype actually holds for a citation.
//
// T-Minus does not carry the FAR, RFO or NFS body text. This control shows the
// reference row it holds — title, tier, source, effective date, official link —
// and says plainly that the regulation paragraph itself is not loaded. No
// regulation text is ever generated here.

import { useId, useState } from "react";
import { citationHasCompanionGuide, citationTokens, useCiteCorpus } from "@/lib/cite-stub";
import { formatRefDate, tierLabel, type RegRefRow } from "@/lib/regulation-sidebar";

const NO_BODY_NOTE =
  "The full regulation paragraph is not loaded in this prototype. Read the authority at its official source before relying on it.";

const NFS_CG_NOTE =
  "NFS Companion Guide text is not loaded in this prototype.";

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

export function ShowTheText({ citation }: { citation: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { rows, state } = useCiteCorpus();
  if (!String(citation ?? "").trim()) return null;
  const matches = corpusRowsFor(citation, rows);
  const isCompanionGuide = citationHasCompanionGuide(citation);
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
          {isCompanionGuide ? (
            <p className="mt-1 text-muted-foreground">{NFS_CG_NOTE}</p>
          ) : null}
          {state.loading ? (
            <p className="mt-2 text-muted-foreground">Loading the reference list.</p>
          ) : state.failed || !rows || rows.length === 0 ? (
            <p className="mt-2 text-muted-foreground">
              The reference list is not loaded in this session, so this citation is shown as recorded text only.{" "}
              {NO_BODY_NOTE}
            </p>
          ) : matches.length === 0 ? (
            <p className="mt-2 text-muted-foreground">
              The citation is recorded, but no reference row for it is loaded. {NO_BODY_NOTE}
            </p>
          ) : (
            <>
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
              <p className="mt-2 text-muted-foreground">{NO_BODY_NOTE}</p>
            </>
          )}
        </div>
      ) : null}
    </span>
  );
}
