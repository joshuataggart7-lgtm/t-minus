import { CLAUSE_FILLIN_NOTE } from "@/lib/clause-fillins";
// Award handoff.
//
// One place an officer reads top to bottom and keys into NCMS. Nothing here is
// new: every block is the same data the local handoff packet carries, in the
// same order — header blocks, the line-item schedule, instructions and
// evaluation, the ordered clauses with their fill-ins, the attachments, the
// data requirements, and an unsigned signature block. Signatures are never
// invented; the contracting officer signs in NCMS, which stays the system of
// record (NFS 1804.171). T-Minus does not write to NCMS.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { FormatScaffold } from "@/lib/format-scaffold";
import { SECTION_J_EMPTY } from "@/lib/section-j";
import { CDRL_EMPTY } from "@/lib/cdrl";
import { PAYMENT_MILESTONES_EMPTY } from "@/lib/payment-milestones";

const NCMS_CHIP = "NCMS is the system of record. T-Minus does not write to NCMS.";

function Head({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h5 className="text-[15px] font-medium">
      <span className="text-muted-foreground" data-numeric>
        {n}.
      </span>{" "}
      {children}
    </h5>
  );
}

export function AwardHandoffPanel({
  scaffold,
  defaultOpen = false,
  acquisitionId,
  suggestedForm,
  assemblyCounts,
}: {
  scaffold: FormatScaffold | null;
  defaultOpen?: boolean;
  acquisitionId?: string;
  /** The official form the record points at. A suggestion, never a lock. */
  suggestedForm?: { key: string; name: string; why: string } | null;
  /** NF 1098 assembly counts from the same builder the checklist uses. */
  assemblyCounts?: {
    presentTabs: number;
    missingTabs: number;
    recorded: number;
    notRecorded: number;
  } | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!scaffold) return null;

  const sf = scaffold.mode === "sf1449";
  const jTitle = sf ? "Attachments" : "Section J — List of attachments";

  // Partial records are normal on a live file. Read every list defensively so a
  // half-built scaffold still renders instead of throwing.
  const blocks = scaffold.blocks ?? [];
  const clins = scaffold.clins ?? [];
  const attachments = scaffold.attachments ?? [];
  const cdrl = scaffold.cdrl ?? [];
  const payments = scaffold.paymentMilestones ?? [];

  // Soft readiness strip: advisory only, never holds a phase or blocks exit.
  const notRecorded = blocks.filter((b) => b.value === "Not recorded").length;
  const clauses = scaffold.clauses ?? [];
  // Derive blanks defensively from the fill-in string already on each clause.
  const clausesWithBlanks = clauses.filter((c) =>
    (c.fillIns ?? "").includes("Not recorded"),
  ).length;
  const lmLines = (scaffold.instructions ?? []).length + (scaffold.evaluation?.lines ?? []).length;
  const kRows = scaffold.sectionK?.checklist?.length ?? 0;
  const readiness = [
    `Cover: ${notRecorded} of ${blocks.length} fields not recorded`,
    clins.length > 0 ? `Schedule: ${clins.length} line items` : "Schedule: no line items",
    clauses.length > 0
      ? `Clauses: ${clauses.length} selected — ${clausesWithBlanks} with a Not recorded fill-in`
      : "Clauses: none selected yet",
    lmLines > 0
      ? `${sf ? "Instructions and evaluation" : "Sections L and M"}: ${lmLines} lines recorded`
      : `${sf ? "Instructions and evaluation" : "Sections L and M"}: nothing recorded`,
    scaffold.sectionK
      ? `Representations and certifications: ${kRows} checklist rows · SAM ${scaffold.sectionK.sam_status}`
      : "Representations and certifications: not recorded",
    attachments.length > 0
      ? `Attachments: ${attachments.length}`
      : `Attachments: ${SECTION_J_EMPTY}`,
    cdrl.length > 0 ? `CDRL: ${cdrl.length} items` : "CDRL: empty",
    payments.length > 0
      ? `Payment milestones: ${payments.length}`
      : "Payment milestones: empty",
    "Signatures: blank on purpose — signed in NCMS",
  ];
  if (assemblyCounts) {
    readiness.push(
      `NF 1098: ${assemblyCounts.presentTabs} tabs present · ${assemblyCounts.missingTabs} required tabs missing`,
      `Enclosures: ${assemblyCounts.recorded} recorded · ${assemblyCounts.notRecorded} not recorded`,
    );
  }
  const allEnclosuresEmpty =
    clins.length === 0 && attachments.length === 0 && cdrl.length === 0 && payments.length === 0;

  return (
    <div className="mt-4 border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[18px] font-medium leading-[24px]">Award handoff</h4>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[15px] text-primary"
          aria-expanded={open}
        >
          {open ? "Close the Award handoff" : "Open the Award handoff"}
        </button>
      </div>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
        The handoff packet in reading order: {scaffold.formatLabel}.{" "}
        {scaffold.lm?.methodLabel ?? "Acquisition method not recorded"}. The downloaded packet
        carries the same content.
      </p>
      {suggestedForm && acquisitionId ? (
        <p className="mt-2 max-w-[80ch] text-[13px]">
          <Link
            to="/forms/$formKey/$acquisitionId"
            params={{ formKey: suggestedForm.key, acquisitionId }}
            className="text-primary underline-offset-2 hover:underline"
          >
            Fill the {suggestedForm.name}
          </Link>{" "}
          <span className="text-muted-foreground">
            {suggestedForm.why} Other official forms stay open on this file.
          </span>
        </p>
      ) : null}
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
        {suggestedForm && acquisitionId
          ? "The filled preview and PDF export are for a human field check in desktop Adobe Acrobat Reader; a blank form in Chrome or PDF.js is expected for XFA files. This is guidance, not an Adobe verification."
          : "No official form is suggested from this record. Any form you open here exports for a human field check in desktop Adobe Acrobat Reader; a blank form in Chrome or PDF.js is expected for XFA files. This is guidance, not an Adobe verification."}
      </p>
      <p className="mt-2 inline-block border border-border px-2 py-0.5 text-[13px] text-muted-foreground">
        {NCMS_CHIP}
      </p>

      {open ? (
        <div className="mt-4 space-y-6">
          <section aria-label="Packet completeness" className="break-inside-avoid">
            <h5 className="text-[15px] font-medium">Packet completeness — advisory</h5>
            <ul className="mt-1 max-w-[80ch] border-l-2 border-border pl-3 text-[13px] leading-[18px] text-muted-foreground">
              {readiness.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {allEnclosuresEmpty ? (
                <li>
                  No line items, attachments, data requirements or payment milestones are
                  recorded yet — the packet prints the cover blocks only.
                </li>
              ) : null}
              <li>Advisory only — nothing here holds the file or blocks a phase.</li>
              <li>
                Counts read the record as it stands. No form on this file is Adobe verified; a
                person checks the fields in desktop Adobe Acrobat Reader.
              </li>
            </ul>
          </section>

          <section>
            <Head n={1}>{sf ? "SF 1449 blocks" : "Uniform Contract Format — cover blocks"}</Head>
            <p className="mt-1 text-[13px] text-muted-foreground">{scaffold.formatSource}</p>
            <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-[13px] leading-[18px] sm:grid-cols-2">
              {scaffold.blocks.map((b) => (
                <div key={b.label} className="flex justify-between gap-4 border-b border-border py-1">
                  <dt className="text-muted-foreground">{b.label}</dt>
                  <dd data-numeric>{b.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <Head n={2}>Schedule of line items</Head>
            {scaffold.clins.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                No line items on the schedule for this file.
              </p>
            ) : (
              <table className="mt-2 w-full text-[13px] leading-[18px]">
                <caption className="sr-only">Line items on this file</caption>
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
                        {c.note ? (
                          <span className="block text-muted-foreground">{c.note}</span>
                        ) : null}
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
            <Head n={3}>{scaffold.sectionK?.heading ?? "Representations and certifications"}</Head>
            {scaffold.sectionK ? (
              <>
                <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
                  {scaffold.sectionK.path_note}
                </p>
                <p className="mt-1 text-[13px]">
                  SAM representations: {scaffold.sectionK.sam_status}
                </p>
                <ul className="mt-2 space-y-1 text-[13px] leading-[18px]">
                  {scaffold.sectionK.checklist.map((row) => (
                    <li key={row.label}>
                      {row.label} — {row.status}
                      {row.note ? <span className="text-muted-foreground"> {row.note}</span> : null}
                    </li>
                  ))}
                </ul>
                {scaffold.sectionK.clauses.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-[13px] leading-[18px]">
                    {scaffold.sectionK.clauses.map((c) => (
                      <li key={c.clause_number}>
                        <span data-numeric>{c.clause_number}</span> {c.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    {scaffold.sectionK.clauses_empty_note}
                  </p>
                )}
                {scaffold.sectionK.notes ? (
                  <p className="mt-2 text-[13px]">{scaffold.sectionK.notes}</p>
                ) : null}
                {scaffold.sectionK.empty_note ? (
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    {scaffold.sectionK.empty_note}
                  </p>
                ) : null}
                <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
                  {scaffold.sectionK.note}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Representations and certifications are not recorded on this file.
              </p>
            )}
          </section>

          <section>
            <Head n={4}>{sf ? "Instructions and evaluation" : "Sections L and M"}</Head>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {scaffold.lm?.chip ?? "L/M are handoff stubs — not the solicitation of record"}
            </p>
            <ul className="mt-2 space-y-1 text-[13px] leading-[18px]">
              {scaffold.instructions.map((line) => (
                <li key={line.text}>
                  {line.text}
                  {line.citation ? (
                    <span className="text-muted-foreground"> {line.citation}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-muted-foreground">
              {scaffold.evaluation.mode === "sole-source"
                ? "Sole source: competitive evaluation factors are not stated."
                : "Evaluation factors stated to offerors."}
            </p>
            <ul className="mt-1 space-y-1 text-[13px] leading-[18px]">
              {scaffold.evaluation.lines.map((line) => (
                <li key={line.text}>
                  {line.text}
                  {line.citation ? (
                    <span className="text-muted-foreground"> {line.citation}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <Head n={5}>Clauses in order, with fill-ins</Head>
            <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">{CLAUSE_FILLIN_NOTE}</p>
            {scaffold.clauses.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                No clauses selected for this file yet.
              </p>
            ) : (
              <table className="mt-2 w-full text-[13px] leading-[18px]">
                <caption className="sr-only">Clauses on this file with their fill-ins</caption>
                <thead>
                  <tr className="border-y border-border text-left">
                    <th scope="col" className="p-2">Clause</th>
                    <th scope="col" className="p-2">Title</th>
                    <th scope="col" className="p-2">Section</th>
                    <th scope="col" className="p-2">Fill-in</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.clauses.map((c) => (
                    <tr key={c.clause_number} className="border-b border-border align-top">
                      <td className="p-2" data-numeric>{c.clause_number}</td>
                      <td className="p-2">
                        {c.title}
                        <span className="block text-muted-foreground">{c.reason}</span>
                      </td>
                      <td className="p-2">{c.section}</td>
                      <td className="p-2 text-muted-foreground">
                        {c.fillIns ? (
                          <ul className="space-y-[2px]">
                            {c.fillIns
                              .split(/;\s*|\n/)
                              .map((part) => part.trim())
                              .filter(Boolean)
                              .map((part) => {
                                const at = part.indexOf(":");
                                const label = at > 0 ? part.slice(0, at) : part;
                                const value = at > 0 ? part.slice(at + 1).trim() : "";
                                const blank = value === "Not recorded";
                                return (
                                  <li key={part}>
                                    <span>{label}</span>
                                    {value ? (
                                      <>
                                        {": "}
                                        <span
                                          className={blank ? "text-[#B45309]" : "text-foreground"}
                                          data-numeric
                                        >
                                          {blank ? "Not recorded — blank" : value}
                                        </span>
                                      </>
                                    ) : null}
                                  </li>
                                );
                              })}
                          </ul>
                        ) : (
                          "No fill-in recorded on the file or in the matrices"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <Head n={6}>{jTitle}</Head>
            {scaffold.attachments.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">{SECTION_J_EMPTY}</p>
            ) : (
              <table className="mt-2 w-full text-[13px] leading-[18px]">
                <caption className="sr-only">Attachments on this file</caption>
                <thead>
                  <tr className="border-y border-border text-left">
                    <th scope="col" className="p-2">NF 1098 tab</th>
                    <th scope="col" className="p-2">Label</th>
                    <th scope="col" className="p-2">File name</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.attachments.map((a) => (
                    <tr
                      key={`${a.nf_1098_tab}-${a.label}-${a.file_name}`}
                      className="border-b border-border align-top"
                    >
                      <td className="p-2" data-numeric>{a.nf_1098_tab}</td>
                      <td className="p-2">{a.label}</td>
                      <td className="p-2 text-muted-foreground">{a.file_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <Head n={7}>CDRL / data requirements</Head>
            {scaffold.cdrl.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">{CDRL_EMPTY}</p>
            ) : (
              <table className="mt-2 w-full text-[13px] leading-[18px]">
                <caption className="sr-only">Data requirements on this file</caption>
                <thead>
                  <tr className="border-y border-border text-left">
                    <th scope="col" className="p-2">Item</th>
                    <th scope="col" className="p-2">Title</th>
                    <th scope="col" className="p-2">Frequency</th>
                    <th scope="col" className="p-2">As-of</th>
                    <th scope="col" className="p-2">Distribution</th>
                    <th scope="col" className="p-2">DRD ref</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.cdrl.map((r) => (
                    <tr key={r.item_number} className="border-b border-border align-top">
                      <td className="p-2" data-numeric>{r.item_number}</td>
                      <td className="p-2">{r.title}</td>
                      <td className="p-2">{r.frequency}</td>
                      <td className="p-2">{r.as_of}</td>
                      <td className="p-2">{r.distribution}</td>
                      <td className="p-2">{r.drd_ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <Head n={8}>Payment milestones — invoice plan</Head>
            <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
              {PAYMENT_PLAN_LABEL}
            </p>
            {scaffold.paymentMilestones.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                {PAYMENT_MILESTONES_EMPTY}
              </p>
            ) : (
              <table className="mt-2 w-full text-[13px] leading-[18px]">
                <caption className="sr-only">Payment milestones on this file</caption>
                <thead>
                  <tr className="border-y border-border text-left">
                    <th scope="col" className="p-2">Event</th>
                    <th scope="col" className="p-2">Due logic</th>
                    <th scope="col" className="p-2">CLIN</th>
                    <th scope="col" className="p-2">Amount</th>
                    <th scope="col" className="p-2">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.paymentMilestones.map((m, i) => (
                    <tr key={`${m.event}-${i}`} className="border-b border-border align-top">
                      <td className="p-2">
                        {m.event}
                        {m.value_note ? (
                          <span className="block text-muted-foreground">{m.value_note}</span>
                        ) : null}
                      </td>
                      <td className="p-2">{m.due_logic}</td>
                      <td className="p-2" data-numeric>
                        {m.clin_number}
                        {m.clin_note ? (
                          <span className="block text-muted-foreground">{m.clin_note}</span>
                        ) : null}
                      </td>

                      <td className="p-2" data-numeric>{m.amount}</td>
                      <td className="p-2" data-numeric>{m.percent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <Head n={9}>Signatures</Head>
            <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
              Every line below is blank on purpose. T-Minus stores no signature and does not write
              to NCMS; the contracting officer signs the award in NCMS, the system of record.
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-[13px] leading-[18px] sm:grid-cols-2">
              {[
                "Contractor signature",
                "Name and title of signer",
                "Date signed",
                "Contracting officer signature",
                "Name of contracting officer",
                "Date of award",
              ].map((label) => (
                <div key={label} className="flex justify-between gap-4 border-b border-border py-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-muted-foreground">
                    {label.startsWith("Date")
                      ? "Not recorded — completed in NCMS"
                      : "Blank — signed in NCMS"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
