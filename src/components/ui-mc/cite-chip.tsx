import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isPracticeCite, matchCite, type CitePart } from "@/lib/cite-match";

type Loaded = { parts: CitePart[]; source: string };

/**
 * A citation shown exactly as written. Opening it shows the regulation text only
 * when that text is held on file and verified (src/lib/verified-reg-text.ts, built
 * from the official RFO text). Anything else says plainly that no text is on file.
 * The verified text loads on first open so pages do not carry it up front.
 */
export function CiteChip({ cite, children, className }: { cite: string; children?: ReactNode; className?: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const practice = isPracticeCite(cite);

  function onOpenChange(open: boolean) {
    if (!open || loaded) return;
    import("@/lib/verified-reg-text")
      .then((mod) => setLoaded({ parts: matchCite(cite, mod.VERIFIED_REG_TEXT), source: mod.VERIFIED_REG_SOURCE }))
      .catch(() => setFailed(true));
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("mc-cite-chip", practice && "is-practice", className)}
          aria-label={`Citation: ${cite}. Show the regulation text on file`}
        >
          {children ?? cite}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="mc-cite-pop">
        {practice ? <p className="mc-cite-note">Center or T-Minus practice, not a regulation.</p> : null}
        {failed ? <p className="mc-cite-note">The regulation text did not load. Close this and try again.</p> : null}
        {!loaded && !failed ? <p className="mc-cite-note">Loading the regulation text on file...</p> : null}
        {loaded
          ? loaded.parts.map((part, i) => (
              <div key={i} className="mc-cite-part">
                <h3>{part.text}</h3>
                {part.matches.length === 0 ? (
                  <p className="mc-cite-note">No regulation text for this citation is held on file. Read it at the official source.</p>
                ) : (
                  part.matches.map((m, j) =>
                    m.entry ? (
                      <div key={j}>
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
                        No verified text for {m.written} is held on file. Read it at the official source.
                      </p>
                    ),
                  )
                )}
              </div>
            ))
          : null}
        {loaded && loaded.parts.some((p) => p.matches.some((m) => m.entry)) ? (
          <p className="mc-cite-source">{loaded.source}</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
