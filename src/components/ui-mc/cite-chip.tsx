import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isPracticeCite, matchCite, officialSourceFor, splitCite, type CitePart } from "@/lib/cite-match";

type Loaded = { part: CitePart; source: string };

/**
 * A citation shown as compact chips, one per cited authority, each exactly as
 * written. Opening a chip shows regulation text only when that text is held on
 * file and verified (src/lib/verified-reg-text.ts, from the official RFO text).
 * Anything else says plainly that no text is on file, and links to the official
 * source only where a reliable address exists (acquisition.gov for RFO FAR).
 * The verified text loads on first open so pages do not carry it up front.
 */
export function CiteChip({ cite, className, label }: { cite: string; className?: string; label?: string }) {
  const parts = splitCite(cite);
  return (
    <span className={cn("mc-cite-chips", className)} role="list" aria-label={label ?? `Citations: ${cite}`}>
      {parts.map((part, i) => (
        <span role="listitem" key={`${i}-${part}`}>
          <CitePartChip part={part} />
        </span>
      ))}
    </span>
  );
}

function CitePartChip({ part }: { part: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const practice = isPracticeCite(part);
  const official = officialSourceFor(part);

  function onOpenChange(open: boolean) {
    if (!open || loaded) return;
    import("@/lib/verified-reg-text")
      .then((mod) => {
        const [first] = matchCite(part, mod.VERIFIED_REG_TEXT);
        setLoaded({ part: first ?? { text: part, matches: [] }, source: mod.VERIFIED_REG_SOURCE });
      })
      .catch(() => setFailed(true));
  }

  const hasText = Boolean(loaded?.part.matches.some((m) => m.entry));

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("mc-cite-chip", practice && "is-practice")}
          aria-label={`${part}. Show the regulation text on file`}
        >
          {part}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={8}
        collisionPadding={{ top: 16, bottom: 16, left: 16, right: 28 }}
        className="mc-cite-pop"
      >
        {/* The arrow keeps pointing at the chip when the popover shifts away from a screen edge. */}
        <PopoverPrimitive.Arrow className="mc-cite-arrow" width={16} height={8} />
        <div className="mc-cite-body">
        <h3>{part}</h3>
        {practice ? <p className="mc-cite-note">Center or T-Minus practice, not a regulation.</p> : null}
        {failed ? <p className="mc-cite-note">The regulation text did not load. Close this and try again.</p> : null}
        {!loaded && !failed ? <p className="mc-cite-note">Loading the regulation text on file...</p> : null}
        {loaded
          ? loaded.part.matches.length === 0
            ? <p className="mc-cite-note">No regulation text for this citation is held in T-Minus.</p>
            : loaded.part.matches.map((m, j) =>
                m.entry ? (
                  <div key={j} className="mc-cite-match">
                    <p className="mc-cite-note">
                      {m.shown === m.wanted
                        ? `${m.written}, in section ${m.entry.s}, ${m.entry.t}`
                        : `The text of ${m.written} is not on file by itself. This is the enclosing text, RFO FAR ${m.shown}, in section ${m.entry.s}, ${m.entry.t}`}
                    </p>
                    <div className="mc-cite-text">
                      {m.entry.p.map(([level, text], k) => (
                        <p key={k} data-level={level}>
                          {text}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p key={j} className="mc-cite-note">
                    No verified text for {m.written} is held in T-Minus.
                  </p>
                ),
              )
          : null}
        {hasText && loaded ? <p className="mc-cite-source">{loaded.source}</p> : null}
        {loaded || failed ? (
          official ? (
            <p className="mc-cite-link">
              <a href={official.url} target="_blank" rel="noopener noreferrer">
                {official.label}
              </a>
              <span className="sr-only"> (opens in a new tab)</span>
            </p>
          ) : !hasText ? (
            <p className="mc-cite-source">No official online copy is linked for this source.</p>
          ) : null
        ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
