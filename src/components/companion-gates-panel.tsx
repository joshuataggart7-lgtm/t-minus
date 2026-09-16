import { useState } from "react";
import { StatusMark } from "@/components/status-mark";
import { gateSummary, type CompanionGate } from "@/lib/companion-gates";

/**
 * Companion gates: the exits a file clears before it moves on. Each row says
 * whether it applies, why, and what the file shows today. A gate never puts
 * the file on hold by itself.
 */
export function CompanionGatesPanel({ gates }: { gates: CompanionGate[] }) {
  const [open, setOpen] = useState(false);
  if (gates.length === 0) return null;
  const applicable = gates.filter((g) => g.applies);

  return (
    <section className="mt-6 max-w-[80ch] border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[18px] font-medium leading-[24px]">Companion gates</h3>
        <span className="text-[13px] text-muted-foreground" data-numeric>
          {gateSummary(gates)}
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[13px] text-primary underline-offset-2 hover:underline"
        >
          {open ? "Hide the gates" : "Show the gates"}
        </button>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Read from the seeded review rules and this record. A gate is a checklist for the officer, not a hold.
      </p>
      {open ? (
        <table className="mt-3 w-full text-[13px] leading-[18px]">
          <caption className="sr-only">Companion gates, what triggers each, and what this file shows</caption>
          <thead>
            <tr className="border-y border-border text-left">
              <th scope="col" className="p-2">Gate</th>
              <th scope="col" className="p-2">Applies</th>
              <th scope="col" className="p-2">Why</th>
              <th scope="col" className="p-2">Status</th>
              <th scope="col" className="p-2">What the file shows</th>
            </tr>
          </thead>
          <tbody>
            {[...applicable, ...gates.filter((g) => !g.applies)].map((g) => (
              <tr key={g.key} className="border-b border-border align-top">
                <td className="p-2">{g.name}</td>
                <td className="p-2">{g.applies ? "Yes" : "No"}</td>
                <td className="p-2 text-muted-foreground">
                  {g.trigger}
                  <span className="block">{g.citation}</span>
                </td>
                <td className="p-2">
                  {g.status === "Satisfied" ? (
                    <StatusMark color="var(--ontrack)" className="text-[13px]">Satisfied</StatusMark>
                  ) : g.status === "Open" ? (
                    <StatusMark color="var(--attention)" className="text-[13px]">Open</StatusMark>
                  ) : (
                    <span className="text-muted-foreground">Not applicable</span>
                  )}
                </td>
                <td className="p-2 text-muted-foreground">{g.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
