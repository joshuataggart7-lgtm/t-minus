import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { askTMinus, type AskAnswer, type AskRefusal } from "@/lib/ask.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NovaProps = {
  acquisitionId?: string | null;
  documentLabel?: string | null;
  rowLabel?: string | null;
  className?: string;
};

function scopeFor({ acquisitionId, documentLabel, rowLabel }: NovaProps) {
  return [acquisitionId || "workspace", documentLabel, rowLabel].filter(Boolean).join(" · ");
}

export function Nova(props: NovaProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskAnswer | AskRefusal | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();
  const ask = useServerFn(askTMinus);
  const scope = scopeFor(props);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const run = useMutation({
    mutationFn: () => ask({ data: { question: `Scope: ${scope}. ${question.trim()}` } }),
    onSuccess: (answer) => setResult(answer),
    onError: (error) =>
      setResult({
        ok: false,
        message: error instanceof Error ? `The question was not answered: ${error.message}` : "The question was not answered.",
      }),
  });

  return (
    <div className={cn("inline-flex", props.className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-accent-cyan bg-transparent text-accent-cyan hover:border-accent-cyan hover:text-accent-cyan focus-visible:ring-accent-cyan"
        aria-expanded={open}
        aria-controls={titleId}
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden="true" />
        Nova
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-foreground/20 p-3 pt-16 sm:p-6 sm:pt-20" onMouseDown={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[calc(100vh-6rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-background p-5 text-foreground shadow-lg"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 id={titleId} className="text-[18px] leading-6 font-medium">Nova · {scope}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">AI draft · not written to the record</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close Nova" onClick={() => setOpen(false)}>
                <X aria-hidden="true" />
              </Button>
            </div>

            <p className="mt-4 text-[13px] text-muted-foreground">Scope: {scope}</p>
            <label htmlFor={inputId} className="mt-4 block text-[13px] text-muted-foreground">
              Ask about loaded rules, thresholds, reviews, or templates
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={inputId}
                ref={inputRef}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && question.trim().length > 2) run.mutate();
                  if (event.key === "Escape") setOpen(false);
                }}
              />
              <Button type="button" disabled={run.isPending || question.trim().length < 3} onClick={() => run.mutate()}>
                {run.isPending ? "Asking" : "Ask"}
              </Button>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Nova uses only loaded references. Without a matching citation, Nova refuses to answer.
            </p>

            {run.isPending ? <p role="status" className="mt-4 text-[15px] text-muted-foreground">Reading the references.</p> : null}
            {result && !result.ok ? <p role="status" className="mt-4 max-w-[70ch] text-[15px] leading-[22px]">{result.message}</p> : null}
            {result && result.ok ? (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-3 inline-block border border-border px-2 py-1 text-[13px] text-muted-foreground">AI draft, not yet reviewed</p>
                <p className="max-w-[70ch] whitespace-pre-wrap text-[15px] leading-[22px]">{result.answer}</p>
                <h3 className="mb-2 mt-5 text-[15px] font-medium">Sources</h3>
                <ul className="border border-border">
                  {result.sources.map((source) => (
                    <li key={`${source.kind}-${source.citation}`} className="border-b border-border p-3 text-[13px] leading-[18px] last:border-0">
                      <p>
                        {source.url ? <a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.citation}</a> : source.citation}
                        {source.title ? ` — ${source.title}` : ""}
                      </p>
                      <p className="text-muted-foreground" data-numeric>
                        Tier: {source.tier} · {source.kind}{source.source ? ` · ${source.source}` : ""}{source.effectiveDate ? ` · effective ${source.effectiveDate}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}