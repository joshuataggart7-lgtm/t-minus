import { useEffect, useId, useState } from "react";
import type { Explanation } from "@/lib/explain";
import { citeStatus, useCiteCorpus } from "@/lib/cite-stub";
import { ShowTheText } from "@/components/show-the-text";

/**
 * "Explain this": a side panel that shows why a flag, hold, or status fired,
 * the rule and citation behind it, and what would clear it. It opens over the
 * page instead of navigating, so the officer never loses their place. Every
 * line comes from the rule's own fields; nothing is generated.
 */
export function ExplainThis({ explanation, label = "Explain this" }: { explanation: Explanation; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const corpus = useCiteCorpus();
  const cite = citeStatus(explanation.citation, corpus.rows, corpus.state);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="inline-block align-baseline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
        className="text-[13px] text-primary underline-offset-2 hover:underline"
      >
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 print:hidden">
          <button
            type="button"
            aria-label="Close the explanation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-foreground/20"
          />
          <aside
            id={id}
            role="dialog"
            aria-modal="true"
            aria-label={explanation.heading}
            className="absolute inset-y-0 right-0 w-full max-w-[28rem] overflow-y-auto border-l border-border bg-background p-6 text-left text-[13px] leading-[18px] shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-[18px] leading-6 font-medium">{explanation.heading}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg border border-border px-3 py-1 text-[13px] hover:border-primary"
              >
                Close
              </button>
            </div>
            <p className="mt-4 font-medium">Why this fired</p>
            <ul className="mt-1 list-disc pl-5">
              {explanation.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="mt-3 font-medium">The rule</p>
            <p className="mt-1">{explanation.rule ?? "Not recorded"}</p>
            <p className="mt-3 font-medium">Citation</p>
            <p className="mt-1 text-muted-foreground">{explanation.citation ?? "Not recorded"}</p>
            {cite.kind === "stub" ? <p className="mt-1 text-muted-foreground">{cite.note}</p> : null}
            {explanation.citation ? (
              <p className="mt-1">
                <ShowTheText citation={explanation.citation} />
              </p>
            ) : null}
            {explanation.note ? <p className="mt-1 text-muted-foreground">{explanation.note}</p> : null}
            <p className="mt-3 font-medium">What would clear it</p>
            <ul className="mt-1 list-disc pl-5">
              {explanation.clears.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-4 text-muted-foreground">Press Escape to close. Nothing here changes the file.</p>
          </aside>
        </div>
      ) : null}
    </span>
  );
}
