import { useId, useState } from "react";
import type { Explanation } from "@/lib/explain";
import { citeStatus, useCiteCorpus } from "@/lib/cite-stub";

/**
 * "Explain this": a small disclosure that shows why a flag, hold, or status
 * fired, the rule and citation behind it, and what would clear it. Every line
 * comes from the rule's own fields; nothing is generated.
 */
export function ExplainThis({ explanation, label = "Explain this" }: { explanation: Explanation; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const corpus = useCiteCorpus();
  const cite = citeStatus(explanation.citation, corpus.rows, corpus.state);
  return (
    <span className="inline-block align-baseline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="text-[13px] text-primary underline-offset-2 hover:underline"
      >
        {open ? "Hide the explanation" : label}
      </button>
      {open ? (
        <div id={id} className="mt-2 max-w-[70ch] border border-border bg-background p-4 text-[13px] leading-[18px]">
          <p className="text-[15px] leading-[22px] font-medium">{explanation.heading}</p>
          <p className="mt-2 font-medium">Why this fired</p>
          <ul className="mt-1 list-disc pl-5">
            {explanation.why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 font-medium">The rule</p>
          <p className="mt-1">{explanation.rule ?? "Not recorded"}</p>
          <p className="mt-2 font-medium">Citation</p>
          <p className="mt-1 text-muted-foreground">{explanation.citation ?? "Not recorded"}</p>
          {cite.kind === "stub" ? <p className="mt-1 text-muted-foreground">{cite.note}</p> : null}
          {explanation.citation ? (
            <p className="mt-1">
              <ShowTheText citation={explanation.citation} />
            </p>
          ) : null}
          {explanation.note ? <p className="mt-1 text-muted-foreground">{explanation.note}</p> : null}
          <p className="mt-2 font-medium">What would clear it</p>
          <ul className="mt-1 list-disc pl-5">
            {explanation.clears.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
