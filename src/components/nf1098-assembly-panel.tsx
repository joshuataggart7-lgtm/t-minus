import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  assemblyToText,
  buildNf1098Assembly,
  type Nf1098AssemblyInput,
} from "@/lib/nf1098-assembly";

/**
 * Contract-file assembly checklist: NF 1098 tabs on the record, required tabs
 * with nothing filed, and the enclosures the record can account for. Advisory
 * only — a missing tab never holds a phase exit, and nothing is written to
 * NCMS.
 */
export function Nf1098AssemblyPanel({
  acquisitionId,
  input,
  onExport,
  exporting,
}: {
  acquisitionId: string;
  input: Nf1098AssemblyInput;
  onExport?: () => void;
  exporting?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const assembly = buildNf1098Assembly(input);
  const rows = [...assembly.tabs, ...assembly.enclosures];

  async function copy() {
    try {
      await navigator.clipboard.writeText(assemblyToText(assembly, acquisitionId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 border border-border p-4">
      <h4 className="text-[15px] font-medium">Contract-file assembly (NF 1098)</h4>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">{assembly.chip}</p>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
        <span data-numeric>{assembly.counts.presentTabs}</span> tabs present ·{" "}
        <span data-numeric>{assembly.counts.missingTabs}</span> required tabs with nothing filed ·{" "}
        <span data-numeric>{assembly.counts.recorded}</span> enclosures recorded ·{" "}
        <span data-numeric>{assembly.counts.notRecorded}</span> not recorded.
      </p>

      <table className="mt-3 w-full text-[13px] leading-[18px]">
        <caption className="sr-only">Contract-file assembly checklist for {acquisitionId}</caption>
        <thead>
          <tr className="border-y border-border text-left">
            <th scope="col" className="p-2">Tab or enclosure</th>
            <th scope="col" className="p-2">Item</th>
            <th scope="col" className="p-2">Status</th>
            <th scope="col" className="p-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.slot}-${r.item}-${i}`} className="border-b border-border align-top">
              <td className="p-2" data-numeric>{r.slot}</td>
              <td className="p-2">{r.item}</td>
              <td className="p-2">
                <span className={r.status === "Missing" ? "text-[hsl(var(--status-risk))]" : undefined}>
                  {r.status}
                </span>
              </td>
              <td className="p-2 text-muted-foreground">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap gap-2">
        {onExport ? (
          <Button variant="outline" onClick={onExport} disabled={exporting}>
            {exporting ? "Building the evidence pack" : "Export evidence pack"}
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => void copy()}>
          {copied ? "Checklist copied" : "Copy assembly checklist"}
        </Button>
      </div>
    </div>
  );
}
