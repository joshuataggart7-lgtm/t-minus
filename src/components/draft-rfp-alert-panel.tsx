// Draft RFP alert — a named local reminder. T-Minus does not publish to
// SAM.gov; nothing here holds the file or blocks a phase exit.

import { DRFP_CITATION, DRFP_NO_SAM_PUBLISH, draftRfpAlert } from "@/lib/draft-rfp-alert";

export function DraftRfpAlertPanel({ acq }: { acq: Record<string, unknown> | null | undefined }) {
  if (!acq) return null;
  const alert = draftRfpAlert(acq);

  return (
    <section
      id="draft-rfp-alert"
      aria-label="Draft RFP alert"
      className="mb-10 max-w-[80ch] rounded-xl border border-border bg-background p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] leading-6 font-medium">Draft RFP alert</h2>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      <p className="mt-2 text-[15px] leading-[22px]">{alert.headline}</p>
      <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{alert.detail}</p>

      <p className="mt-3 border-t border-border pt-2 text-[13px] leading-[18px] text-muted-foreground">
        {DRFP_NO_SAM_PUBLISH}
      </p>
      {alert.applicable ? (
        <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
          Authority for early exchanges: {DRFP_CITATION}.
        </p>
      ) : null}
    </section>
  );
}
