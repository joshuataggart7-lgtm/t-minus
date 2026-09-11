/**
 * E9. Ask T-Minus.
 *
 * A question box on every page. The answer is drawn only from the loaded
 * references, thresholds, review rules and templates, is labelled an AI draft,
 * and always shows its sources with their tier.
 */

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { askTMinus, type AskAnswer, type AskRefusal } from "@/lib/ask.functions";

export function AskTMinus() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskAnswer | AskRefusal | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ask = useServerFn(askTMinus);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const run = useMutation({
    mutationFn: () => ask({ data: { question: question.trim() } }),
    onSuccess: (r) => setResult(r),
    onError: (e) =>
      setResult({
        ok: false,
        message: e instanceof Error ? `The question was not answered: ${e.message}` : "The question was not answered.",
      }),
  });

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Ask T-Minus
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Ask T-Minus"
          className="absolute right-0 z-40 mt-2 w-[min(38rem,90vw)] rounded-xl border border-border bg-background p-4 shadow-lg"
        >
          <label htmlFor="ask-question" className="block text-[13px] text-muted-foreground">
            Ask a question about the rules, thresholds, reviews or forms
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="ask-question"
              ref={inputRef}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && question.trim().length > 2) run.mutate();
                if (e.key === "Escape") setOpen(false);
              }}
            />
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground disabled:opacity-50"
              disabled={run.isPending || question.trim().length < 3}
              onClick={() => run.mutate()}
            >
              {run.isPending ? "Asking" : "Ask"}
            </button>
          </div>

          <p className="mt-2 text-[13px] text-muted-foreground">
            Answers come only from the references loaded here. Nothing is answered without a citation.
          </p>

          {run.isPending ? (
            <p role="status" className="mt-4 text-[15px] text-muted-foreground">
              Reading the references.
            </p>
          ) : null}

          {result && result.ok === false ? (
            <p role="status" className="mt-4 max-w-[70ch] text-[15px] leading-[22px]">
              {result.message}
            </p>
          ) : null}

          {result && result.ok ? (
            <div className="mt-4">
              <p className="mb-2 inline-block border border-border px-2 py-1 text-[13px] text-muted-foreground">
                AI draft, not yet reviewed
              </p>
              <p className="max-w-[70ch] text-[15px] leading-[22px] whitespace-pre-wrap">{result.answer}</p>

              <h3 className="mt-5 mb-2 text-[15px] font-medium">Sources</h3>
              <ul className="border border-border">
                {result.sources.map((s) => (
                  <li key={`${s.kind}-${s.citation}`} className="border-b border-border p-3 text-[13px] leading-[18px] last:border-0">
                    <p className="text-foreground">
                      {s.url ? (
                        <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                          {s.citation}
                        </a>
                      ) : (
                        s.citation
                      )}
                      {s.title ? ` — ${s.title}` : ""}
                    </p>
                    <p className="text-muted-foreground" data-numeric>
                      Tier: {s.tier} · {s.kind}
                      {s.source ? ` · ${s.source}` : ""}
                      {s.effectiveDate ? ` · effective ${s.effectiveDate}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13px] text-muted-foreground" data-numeric>
                Drafted by {result.model} on {new Date(result.answeredAt).toLocaleString()}.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="mt-4 rounded-lg border border-border px-3 py-2 text-[13px]"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
