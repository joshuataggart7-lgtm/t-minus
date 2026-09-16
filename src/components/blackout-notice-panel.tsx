// Blackout notice — a named local draft aid. Nothing is issued, emailed, or
// posted; nothing here holds the file or blocks a phase exit.

import {
  BLACKOUT_CITATION,
  BLACKOUT_NOT_RECORDED,
  blackoutDraft,
  blackoutFacts,
} from "@/lib/blackout-notice";

export function BlackoutNoticePanel({
  acq,
  onBanner,
}: {
  acq: Record<string, unknown> | null | undefined;
  onBanner: (s: string) => void;
}) {
  if (!acq) return null;
  const facts = blackoutFacts(acq);
  const draft = blackoutDraft(acq);

  return (
    <section
      id="blackout-notice"
      aria-label="Blackout notice"
      className="mb-10 max-w-[80ch] rounded-xl border border-border bg-background p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] leading-6 font-medium">Blackout notice</h2>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{BLACKOUT_NOT_RECORDED}</p>

      <dl className="mt-3 text-[13px] leading-[18px]">
        <div className="flex flex-wrap gap-x-2 border-t border-border py-2">
          <dt className="font-medium">Acquisition</dt>
          <dd className="text-muted-foreground">
            {facts.acquisitionId} — {facts.title}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 border-t border-border py-2">
          <dt className="font-medium">Contracting officer</dt>
          <dd className="text-muted-foreground">{facts.coName}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2 border-t border-border py-2">
          <dt className="font-medium">Practice citation</dt>
          <dd className="text-muted-foreground">{BLACKOUT_CITATION}</dd>
        </div>
      </dl>

      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap border border-border bg-muted/30 p-3 text-[13px] leading-[18px]">
        {draft}
      </pre>

      <button
        type="button"
        className="mt-3 rounded-lg border border-border px-3 py-2 text-[13px] hover:bg-muted"
        onClick={() => {
          void navigator.clipboard?.writeText(draft);
          onBanner("The blackout notice draft was copied. T-Minus did not send or post anything.");
        }}
      >
        Copy the draft
      </button>
    </section>
  );
}
