import { Button } from "@/components/ui/button";
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
    <section
      aria-label="FPDS fill aid"
      className="mt-3 break-inside-avoid border border-border p-4"
    >
      <h4 className="text-[15px] font-medium">FPDS fill aid</h4>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
        A fill aid for the person keying FPDS-NG by hand. It is not a live FPDS submission;
        T-Minus does not connect to FPDS and writes nothing there. Every line is read from this
        record and blanks stay blank.
      </p>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
        <span data-numeric>{sheet.recordedCount}</span> fields recorded ·{" "}
        <span data-numeric>{sheet.uncertainCount}</span> to confirm against the signed award ·{" "}
        <span data-numeric>{sheet.blankCount}</span> not recorded on this file.
      </p>
      {onExport ? (
        <div className="mt-3">
          <Button variant="outline" onClick={onExport} disabled={exporting}>
            {exporting ? "Building the fill sheet" : "Open the FPDS fill sheet"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
