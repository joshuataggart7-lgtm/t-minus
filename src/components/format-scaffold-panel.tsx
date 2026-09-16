import { useState } from "react";
import type { FormatScaffold } from "@/lib/format-scaffold";
import { SECTION_J_EMPTY, sectionJSummary } from "@/lib/section-j";
import { CDRL_EMPTY } from "@/lib/cdrl";
import { PAYMENT_MILESTONES_EMPTY } from "@/lib/payment-milestones";

/**
 * The contract format scaffold an officer carries into NCMS. SF 1449
 * streamlined blocks on a commercial file, Uniform Contract Format sections
 * otherwise. Nothing here is a signed form; NCMS remains the system of record
 * (NFS 1804.171) and T-Minus does not write to it.
 */
export function FormatScaffoldPanel({ scaffold }: { scaffold: FormatScaffold | null }) {
  const [open, setOpen] = useState(false);
  if (!scaffold) return null;

  return (
    <div className="mt-3 border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[15px] font-medium">
          {scaffold.mode === "sf1449" ? "SF 1449 streamlined scaffold" : "Uniform Contract Format scaffold"}
        </h4>
        <span className="text-[13px] text-muted-foreground">{scaffold.formatLabel}</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[13px] text-primary underline-offset-2 hover:underline"
        >
          {open ? "Hide the scaffold" : "Show the scaffold"}
        </button>
      </div>
      <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
        {scaffold.formatSource} Filled from this record for the handoff packet; it is not a signed form.
      </p>

      {open ? (
        <div className="mt-3 space-y-5">
          {scaffold.mode === "sf1449" ? (
            <section>
              <h5 className="text-[15px] font-medium">Blocks from the record</h5>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {scaffold.blocks.map((b) => (
                  <div key={b.label} className="flex flex-wrap gap-2 border-b border-border py-1 text-[13px]">
                    <dt className="text-muted-foreground">{b.label}</dt>
                    <dd className="ml-auto text-right" data-numeric>{b.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <section>
              <h5 className="text-[15px] font-medium">Sections A through M</h5>
              <table className="mt-2 w-full text-[13px] leading-[18px]">
                <caption className="sr-only">Uniform Contract Format sections and the clauses in each</caption>
                <thead>
                  <tr className="border-y border-border text-left">
                    <th scope="col" className="p-2">Section</th>
                    <th scope="col" className="p-2">Title</th>
                    <th scope="col" className="p-2">Clauses from this record</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.ucfSections.map((sec) => (
                    <tr key={sec.section} className="border-b border-border align-top">
                      <td className="p-2" data-numeric>{sec.section}</td>
                      <td className="p-2">{sec.title}</td>
                      <td className="p-2 text-muted-foreground">
                        {sec.section === "J"
                          ? [
                              sectionJSummary(scaffold.attachments),
                              sec.clauses.length > 0
                                ? `Clauses placed in Section J by the matrices: ${sec.clauses.map((c) => c.clause_number).join(", ")}.`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : sec.clauses.length === 0
                            ? "None prescribed from this record."
                            : sec.clauses.map((c) => c.clause_number).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h5 className="text-[15px] font-medium">Line items</h5>
            {scaffold.clins.length === 0 ? (
              <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
                No line items are on the schedule for this file yet. The contracting office adds them on the
                schedule above; none are invented here.
              </p>
            ) : (
            <table className="mt-2 w-full text-[13px] leading-[18px]">
              <caption className="sr-only">Line items from the schedule on this file</caption>
              <thead>
                <tr className="border-y border-border text-left">
                  <th scope="col" className="p-2">CLIN</th>
                  <th scope="col" className="p-2">Description</th>
                  <th scope="col" className="p-2">Quantity</th>
                  <th scope="col" className="p-2">Unit</th>
                  <th scope="col" className="p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {scaffold.clins.map((c) => (
                  <tr key={c.clin} className="border-b border-border align-top">
                    <td className="p-2" data-numeric>{c.clin}</td>
                    <td className="p-2">
                      {c.description}
                      <span className="block text-muted-foreground">{c.note}</span>
                    </td>
                    <td className="p-2" data-numeric>{c.quantity}</td>
                    <td className="p-2">{c.unit}</td>
                    <td className="p-2" data-numeric>{c.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </section>

          <section>
            <h5 className="text-[15px] font-medium">
              {scaffold.mode === "sf1449" ? "Attachments" : "Section J — List of attachments"}
            </h5>
            {scaffold.attachments.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">{SECTION_J_EMPTY}</p>
            ) : (
              <table className="mt-2 w-full text-[13px] leading-[18px]">
                <caption className="sr-only">Attachments on this file with their NF 1098 tab</caption>
                <thead>
                  <tr className="border-y border-border text-left">
                    <th scope="col" className="p-2">NF 1098 tab</th>
                    <th scope="col" className="p-2">Label</th>
                    <th scope="col" className="p-2">File name</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.attachments.map((a) => (
                    <tr key={`${a.nf_1098_tab}-${a.label}-${a.file_name}`} className="border-b border-border align-top">
                      <td className="p-2" data-numeric>{a.nf_1098_tab}</td>
                      <td className="p-2">{a.label}</td>
                      <td className="p-2 text-muted-foreground">{a.file_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-[13px] text-muted-foreground">
              {scaffold.cdrl.length === 0
                ? CDRL_EMPTY
                : `${scaffold.cdrl.length} data requirement${scaffold.cdrl.length === 1 ? "" : "s"} recorded on this file; the handoff packet carries them.`}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {scaffold.paymentMilestones.length === 0
                ? PAYMENT_MILESTONES_EMPTY
                : `${scaffold.paymentMilestones.length} payment milestone${scaffold.paymentMilestones.length === 1 ? "" : "s"} recorded on this file; the handoff packet carries them.`}
            </p>
          </section>

          <section>
            <h5 className="text-[15px] font-medium">Instructions to offerors</h5>
            <p className="mt-1 inline-block border border-border px-2 py-0.5 text-[13px] text-muted-foreground">
              {scaffold.lm?.chip ?? "L/M are handoff stubs — not the solicitation of record"}
            </p>
            <ul className="mt-2 space-y-1 text-[13px]">
              {scaffold.instructions.map((line) => (
                <li key={line.text}>
                  {line.text}
                  {line.citation ? <span className="ml-2 text-muted-foreground">{line.citation}</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h5 className="text-[15px] font-medium">
              {scaffold.evaluation.mode === "competitive" ? "Evaluation factors" : "Evaluation on a sole-source file"}
            </h5>
            <p className="mt-1 inline-block border border-border px-2 py-0.5 text-[13px] text-muted-foreground">
              {scaffold.lm?.chip ?? "L/M are handoff stubs — not the solicitation of record"}
            </p>
            <ul className="mt-2 space-y-1 text-[13px]">
              {scaffold.evaluation.lines.map((line) => (
                <li key={line.text}>
                  {line.text}
                  {line.citation ? <span className="ml-2 text-muted-foreground">{line.citation}</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h5 className="text-[15px] font-medium">Clauses this format carries</h5>
            <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
              Selected by the clause engine from this record. Each clause keeps the reason it applies and the
              fill-in the matrices carry.
            </p>
            {scaffold.clauses.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                No clauses are selected on this file yet.
              </p>
            ) : (
              <table className="mt-2 w-full text-[13px] leading-[18px]">
                <caption className="sr-only">Clauses, the section they sit in, why each applies, and its fill-in</caption>
                <thead>
                  <tr className="border-y border-border text-left">
                    <th scope="col" className="p-2">Clause</th>
                    <th scope="col" className="p-2">Title</th>
                    <th scope="col" className="p-2">Section</th>
                    <th scope="col" className="p-2">Why it applies</th>
                    <th scope="col" className="p-2">Fill-in</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.clauses.map((c) => (
                    <tr key={c.clause_number} className="border-b border-border align-top">
                      <td className="p-2" data-numeric>{c.clause_number}</td>
                      <td className="p-2">{c.title}</td>
                      <td className="p-2">{c.section}</td>
                      <td className="p-2 text-muted-foreground">{c.reason}</td>
                      <td className="p-2 text-muted-foreground">
                        {c.fillIns ?? "No fill-in recorded on the file or in the matrices."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

        </div>
      ) : null}
    </div>
  );
}
