import { StatusChip } from "@/components/ui-mc";
import { buildFpdsSheet, type FpdsInput } from "@/lib/fpds-filling-sheet";

/**
 * A compact view of the FPDS fill aid, so the counts and the banner copy are
 * readable without opening the HTML. Nothing here is a submission: T-Minus
 * does not connect to FPDS and a person keys every value by hand.
 */
export function FpdsFillAidSummary({
  input,
  onExport,
  exporting,
}: {
  input: FpdsInput;
  onExport?: () => void;
  exporting?: boolean;
}) {
  let sheet;
  try {
    sheet = buildFpdsSheet(input);
  } catch {
    return null;
  }

  return (
    <section aria-label="FPDS fill aid" className="mc-kpanel mc-pa mt-3 break-inside-avoid">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
          <h4 className="mc-kpanel-title">FPDS fill aid</h4>
          <p className="mc-pa-sub">
            A fill aid for the person keying FPDS-NG by hand. It is not a live FPDS submission;
            T-Minus does not connect to FPDS and writes nothing there. Every line is read from this
            record and blanks stay blank.
          </p>
        </div>
        <div className="mc-kpanel-status">
          <StatusChip label="Keyed by hand" tone="info" />
        </div>
      </div>
      <div className="mc-pa-stats" role="list" aria-label="FPDS fill aid counts">
        <div role="listitem" className="is-ontrack">
          <strong data-numeric>{sheet.recordedCount}</strong>
          <span>fields recorded</span>
        </div>
        <div role="listitem" className={sheet.uncertainCount > 0 ? "is-attention" : "is-ontrack"}>
          <strong data-numeric>{sheet.uncertainCount}</strong>
          <span>to confirm against the signed award</span>
        </div>
        <div role="listitem" className={sheet.blankCount > 0 ? "is-attention" : "is-ontrack"}>
          <strong data-numeric>{sheet.blankCount}</strong>
          <span>not recorded on this file</span>
        </div>
      </div>
      {onExport ? (
        <div className="mc-pa-actions">
          <button type="button" className="mc-req-button is-secondary" onClick={onExport} disabled={exporting}>
            {exporting ? "Building the fill sheet" : "Open the FPDS fill sheet"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
