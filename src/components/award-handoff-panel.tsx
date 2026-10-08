import { TableScrollRegion } from "@/components/table-scroll-region";
import { CLAUSE_FILLIN_NOTE } from "@/lib/clause-fillins";
// Award handoff.
//
// One place an officer reads top to bottom and keys into NCMS. Nothing here is
// new: every block is the same data the local handoff packet carries, in the
// same order — header blocks, the line-item schedule, instructions and
// evaluation, the ordered clauses with their fill-ins, the attachments, the
// data requirements, and an unsigned signature block. Signatures are never
// invented; the contracting officer signs in NCMS, which stays the system of
// record (NFS CG 1804.11(b)). T-Minus does not write to NCMS.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { StatusMark } from "@/components/app-shell";
import { StatusChip, toneForStatus, type StatusTone } from "@/components/ui-mc";
import type { FormatScaffold } from "@/lib/format-scaffold";
import { SECTION_J_EMPTY } from "@/lib/section-j";
import { CDRL_EMPTY, CDRL_EMPTY_NOTE, CDRL_LABEL, cdrlPackNotes } from "@/lib/cdrl";
import {
  PAYMENT_MILESTONES_EMPTY,
  PAYMENT_MILESTONES_EMPTY_NOTE,
  PAYMENT_PLAN_LABEL,
  paymentPlanNotes,
} from "@/lib/payment-milestones";

const NCMS_CHIP = "NCMS is the system of record. T-Minus does not write to NCMS.";

function Head({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h5 className="mc-pa-h">
      <span className="mc-pa-n" data-numeric aria-hidden="true">
        {n}
      </span>
      <span className="mc-req-h">
        <span className="sr-only">{n}. </span>
        {children}
      </span>
    </h5>
  );
}

/** Tone for a representations checklist status word; the word itself is always shown. */
function kStatusTone(status: string): StatusTone {
  if (/\bnot\b|missing|expired|open|blank/i.test(status)) return "attention";
  return toneForStatus(status, /recorded|active|current|complete|on file|yes/i.test(status) ? "ontrack" : "info");
}

/** One fill-in value: recorded values read as data, blanks are marked. */
function FillIn({ part }: { part: string }) {
  const at = part.indexOf(":");
  const label = at > 0 ? part.slice(0, at) : part;
  const value = at > 0 ? part.slice(at + 1).trim() : "";
  const blank = value === "Not recorded";
  return (
    <li>
      <span>{label}</span>
      {value ? (
        <>
          {": "}
          {blank ? (
            <StatusMark color="var(--attention)" className="tabular-nums">
              Not recorded, blank
            </StatusMark>
          ) : (
            <span className="text-foreground" data-numeric>{value}</span>
          )}
        </>
      ) : null}
    </li>
  );
}

export function AwardHandoffPanel({
  scaffold,
  defaultOpen = false,
  acquisitionId,
  suggestedForm,
  assemblyCounts,
  regionContext,
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
  regionContext?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!scaffold) return null;

  const sf = scaffold.mode === "sf1449";
  const jTitle = sf ? "Attachments" : "Section J: List of attachments";

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
    clins.length > 0
      ? `Schedule: ${clins.length} line items`
      : "Schedule: no line items recorded yet",
    clauses.length > 0
      ? `Clauses: ${clauses.length} selected; ${clausesWithBlanks} with a Not recorded fill-in`
      : "Clauses: none selected yet",
    lmLines > 0
      ? `${sf ? "Instructions and evaluation" : "Sections L and M"}: ${lmLines} lines recorded`
      : `${sf ? "Instructions and evaluation" : "Sections L and M"}: nothing recorded yet`,
    scaffold.sectionK
      ? `Representations and certifications: ${kRows} checklist rows · SAM ${scaffold.sectionK.sam_status}`
      : "Representations and certifications: not recorded",
    attachments.length > 0
      ? `Attachments: ${attachments.length}`
      : `Attachments: ${SECTION_J_EMPTY}`,
    cdrl.length > 0
      ? `${CDRL_LABEL}: ${cdrl.length} items`
      : `${CDRL_LABEL}: ${CDRL_EMPTY}`,
    payments.length > 0
      ? `Payment milestones: ${payments.length}`
      : `Payment milestones: ${PAYMENT_MILESTONES_EMPTY}`,
    "Signatures: blank on purpose, signed in NCMS",
  ];
  if (assemblyCounts) {
    readiness.push(
      `NF 1098: ${assemblyCounts.presentTabs} tabs present · ${assemblyCounts.missingTabs} required tabs missing`,
      `Enclosures: ${assemblyCounts.recorded} recorded · ${assemblyCounts.notRecorded} not recorded`,
    );
  }
  const allEnclosuresEmpty =
    clins.length === 0 && attachments.length === 0 && cdrl.length === 0 && payments.length === 0;

  const coverBlank = notRecorded;
  return (
    <div className="mc-kpanel mc-pa mt-4">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
          <h4 className="mc-kpanel-title">Award handoff</h4>
          <p className="mc-pa-sub">
            The handoff packet in reading order: {scaffold.formatLabel}.{" "}
            {scaffold.lm?.methodLabel ?? "Acquisition method not recorded"}. The downloaded packet
            carries the same content.
          </p>
        </div>
        <div className="mc-kpanel-status">
          <StatusChip label="Keyed into NCMS" tone="info" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mc-pa-link"
            aria-expanded={open}
          >
            {open ? "Close the Award handoff" : "Open the Award handoff"}
          </button>
        </div>
      </div>

      <div className="mc-pa-stats" role="list" aria-label="Handoff packet counts">
        <div role="listitem" className={coverBlank > 0 ? "is-attention" : "is-ontrack"}>
          <strong data-numeric>{blocks.length - coverBlank} of {blocks.length}</strong>
          <span>cover fields recorded</span>
        </div>
        <div role="listitem" className={clins.length > 0 ? "is-ontrack" : "is-attention"}>
          <strong data-numeric>{clins.length}</strong>
          <span>line items on the schedule</span>
        </div>
        <div role="listitem" className={clauses.length === 0 || clausesWithBlanks > 0 ? "is-attention" : "is-ontrack"}>
          <strong data-numeric>{clauses.length}</strong>
          <span>
            clauses selected
            {clauses.length > 0 ? `, ${clausesWithBlanks} with a blank fill-in` : ""}
          </span>
        </div>
      </div>

      {suggestedForm && acquisitionId ? (
        <p className="mc-pa-text mt-4">
          <Link
            to="/forms/$formKey/$acquisitionId"
            params={{ formKey: suggestedForm.key, acquisitionId }}
            className="mc-pa-link"
          >
            Fill the {suggestedForm.name}
          </Link>{" "}
          <span className="mc-req-meta inline">
            {suggestedForm.why} Other official forms stay open on this file.
          </span>
        </p>
      ) : null}
      <p className="mc-pa-sub mt-2">
        {suggestedForm && acquisitionId
          ? "The filled preview and PDF export are for a human field check in desktop Adobe Acrobat Reader; a blank form in Chrome or PDF.js is expected for this kind of form. This is guidance, not an Adobe verification."
          : "No official form is suggested from this record. Any form you open here exports for a human field check in desktop Adobe Acrobat Reader; a blank form in Chrome or PDF.js is expected for this kind of form. This is guidance, not an Adobe verification."}
      </p>
      <p className="mc-pa-sub mt-1">{NCMS_CHIP}</p>

      {open ? (
        <div className="mt-2">
          <section aria-label="Packet completeness" className="mc-kpanel-section break-inside-avoid">
            <div className="mc-pa-h">
              <h5 className="mc-req-h">Packet completeness</h5>
              <StatusChip label="Advisory" tone="neutral" />
            </div>
            <ul className="mc-pa-list is-meta">
              {readiness.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {allEnclosuresEmpty ? (
                <li>
                  Nothing is recorded under the schedule, attachments, data requirements, or payment
                  milestones yet. That is normal until the office records it; the packet prints the
                  cover blocks only.
                </li>
              ) : null}
              <li>Advisory only; nothing here holds the file or blocks a phase exit.</li>
              <li>
                Counts read the record as it stands. No form on this file is Adobe verified; a
                person checks the fields in desktop Adobe Acrobat Reader.
              </li>
            </ul>
          </section>

          <section className="mc-kpanel-section">
            <Head n={1}>{sf ? "SF 1449 blocks" : "Uniform Contract Format: cover blocks"}</Head>
            <p className="mc-pa-sub">{scaffold.formatSource}</p>
            <dl className="mc-pa-facts is-2 mt-2">
              {scaffold.blocks.map((b) => (
                <div key={b.label}>
                  <dt>{b.label}</dt>
                  <dd className={b.value === "Not recorded" ? "is-blank" : undefined} data-numeric>{b.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mc-kpanel-section">
            <Head n={2}>Schedule of line items</Head>
            {scaffold.clins.length === 0 ? (
              <p className="mc-req-fallback">
                No line items on the schedule for this file.
              </p>
            ) : (
              <TableScrollRegion baseClassName="mc-dt-wrap mt-2" className="stack" label={regionContext ? `Handoff line items table, ${regionContext}` : "Handoff line items table"}>
<table className="mc-dt stack">
                <caption className="sr-only">Line items on this file</caption>
                <thead>
                  <tr>
                    <th scope="col" className="is-nowrap">CLIN</th>
                    <th scope="col">Description</th>
                    <th scope="col" className="is-numeric">Quantity</th>
                    <th scope="col">Unit</th>
                    <th scope="col" className="is-numeric">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.clins.map((c) => (
                    <tr key={c.clin}>
                      <td data-label="CLIN" className="is-nowrap" data-numeric>{c.clin}</td>
                      <td data-label="Description">
                        {c.description}
                        {c.note ? (
                          <span className="mc-req-meta">{c.note}</span>
                        ) : null}
                      </td>
                      <td data-label="Quantity" className="is-numeric">{c.quantity}</td>
                      <td data-label="Unit">{c.unit}</td>
                      <td data-label="Amount" className="is-numeric">{c.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
</TableScrollRegion>
            )}
          </section>

          <section className="mc-kpanel-section">
            <Head n={3}>{scaffold.sectionK?.heading ?? "Representations and certifications"}</Head>
            {scaffold.sectionK ? (
              <>
                <p className="mc-pa-sub">{scaffold.sectionK.path_note}</p>
                <p className="mc-pa-text mt-2">
                  SAM representations: {scaffold.sectionK.sam_status}
                </p>
                <ul className="mc-pa-check mt-2">
                  {scaffold.sectionK.checklist.map((row) => (
                    <li key={row.label} className="is-neutral">
                      <span className="mc-pa-check-main">
                        <span>{row.label}</span>
                      </span>
                      <StatusChip label={row.status} tone={kStatusTone(row.status)} />
                      {row.note ? <span className="mc-pa-check-note">{row.note}</span> : null}
                    </li>
                  ))}
                </ul>
                {scaffold.sectionK.clauses.length > 0 ? (
                  <ul className="mc-pa-list mt-3">
                    {scaffold.sectionK.clauses.map((c) => (
                      <li key={c.clause_number}>
                        <span data-numeric>{c.clause_number}</span> {c.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mc-pa-sub mt-2">{scaffold.sectionK.clauses_empty_note}</p>
                )}
                {scaffold.sectionK.notes ? (
                  <p className="mc-pa-text mt-2">{scaffold.sectionK.notes}</p>
                ) : null}
                {scaffold.sectionK.empty_note ? (
                  <p className="mc-pa-sub mt-2">{scaffold.sectionK.empty_note}</p>
                ) : null}
                <p className="mc-pa-sub mt-2">{scaffold.sectionK.note}</p>
              </>
            ) : (
              <p className="mc-req-fallback">
                Representations and certifications are not recorded on this file.
              </p>
            )}
          </section>

          <section className="mc-kpanel-section">
            <Head n={4}>{sf ? "Instructions and evaluation" : "Sections L and M"}</Head>
            <p className="mc-pa-sub">
              {scaffold.lm?.chip ?? "L/M are handoff stubs, not the solicitation of record"}
            </p>
            <ul className="mc-pa-list mt-2">
              {scaffold.instructions.map((line) => (
                <li key={line.text}>
                  {line.text}
                  {line.citation ? (
                    <span className="text-muted-foreground"> {line.citation}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mc-pa-sub mt-3">
              {scaffold.evaluation.mode === "sole-source"
                ? "Sole source: competitive evaluation factors are not stated."
                : "Evaluation factors stated to offerors."}
            </p>
            <ul className="mc-pa-list mt-1">
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

          <section className="mc-kpanel-section">
            <Head n={5}>Clauses in order, with fill-ins</Head>
            <p className="mc-pa-sub">{CLAUSE_FILLIN_NOTE}</p>
            {scaffold.clauses.length === 0 ? (
              <p className="mc-req-fallback mt-2">
                No clauses selected for this file yet.
              </p>
            ) : (
              <TableScrollRegion baseClassName="mc-dt-wrap mt-2" className="stack" label={regionContext ? `Handoff clauses table, ${regionContext}` : "Handoff clauses table"}>
<table className="mc-dt stack">
                <caption className="sr-only">Clauses on this file with their fill-ins</caption>
                <thead>
                  <tr>
                    <th scope="col" className="is-nowrap">Clause</th>
                    <th scope="col">Title</th>
                    <th scope="col">Section</th>
                    <th scope="col">Fill-in</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.clauses.map((c) => (
                    <tr key={c.clause_number}>
                      <td data-label="Clause" className="is-nowrap" data-numeric>{c.clause_number}</td>
                      <td data-label="Title">
                        {c.title}
                        <span className="mc-req-meta">{c.reason}</span>
                      </td>
                      <td data-label="Section">{c.section}</td>
                      <td data-label="Fill-in" className="text-muted-foreground">
                        {c.fillIns ? (
                          <ul className="space-y-[2px]">
                            {c.fillIns
                              .split(/;\s*|\n/)
                              .map((part) => part.trim())
                              .filter(Boolean)
                              .map((part) => (
                                <FillIn key={part} part={part} />
                              ))}
                          </ul>
                        ) : (
                          "No fill-in recorded on the file or in the matrices"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
</TableScrollRegion>
            )}
          </section>

          <section className="mc-kpanel-section">
            <Head n={6}>{jTitle}</Head>
            {scaffold.attachments.length === 0 ? (
              <p className="mc-req-fallback">{SECTION_J_EMPTY}</p>
            ) : (
              <TableScrollRegion baseClassName="mc-dt-wrap mt-2" className="stack" label={regionContext ? `Handoff attachments table, ${regionContext}` : "Handoff attachments table"}>
<table className="mc-dt stack">
                <caption className="sr-only">Attachments on this file</caption>
                <thead>
                  <tr>
                    <th scope="col" className="is-nowrap">NF 1098 tab</th>
                    <th scope="col">Label</th>
                    <th scope="col">File name</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.attachments.map((a, i) => (
                    <tr key={`${a.nf_1098_tab}-${a.label}-${a.file_name}-${i}`}>
                      <td data-label="NF 1098 tab" className="is-nowrap" data-numeric>
                        {a.nf_1098_tab === "\u2014" ? <span className="text-muted-foreground">Not recorded</span> : a.nf_1098_tab}
                      </td>
                      <td data-label="Label">{a.label}</td>
                      <td data-label="File name" className="text-muted-foreground [overflow-wrap:anywhere]">{a.file_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
</TableScrollRegion>
            )}
          </section>

          <section className="mc-kpanel-section">
            <Head n={7}>{CDRL_LABEL}</Head>
            <p className="mc-pa-sub">
              Data requirements on this file. Listed beside the document attachments in section 6,
              not among them.
            </p>
            {cdrl.length === 0 ? (
              <p className="mc-req-fallback mt-2">
                {CDRL_EMPTY} {CDRL_EMPTY_NOTE}
              </p>
            ) : (
              <TableScrollRegion baseClassName="mc-dt-wrap mt-2" className="stack" label={regionContext ? `Handoff data requirements table, ${regionContext}` : "Handoff data requirements table"}>
<table className="mc-dt stack">
                <caption className="sr-only">Data requirements on this file</caption>
                <thead>
                  <tr>
                    <th scope="col" className="is-nowrap">Item</th>
                    <th scope="col">Title</th>
                    <th scope="col">Frequency</th>
                    <th scope="col">As-of</th>
                    <th scope="col">Distribution</th>
                    <th scope="col">DRD ref</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.cdrl.map((r) => (
                    <tr key={r.item_number}>
                      <td data-label="Item" className="is-nowrap" data-numeric>{r.item_number}</td>
                      <td data-label="Title">{r.title}</td>
                      <td data-label="Frequency">{r.frequency}</td>
                      <td data-label="As-of">{r.as_of}</td>
                      <td data-label="Distribution">{r.distribution}</td>
                      <td data-label="DRD ref">{r.drd_ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
</TableScrollRegion>
            )}
            {cdrlPackNotes(cdrl).map((n) => (
              <p key={n} className="mc-pa-sub mt-1">
                {n}
              </p>
            ))}
          </section>

          <section className="mc-kpanel-section">
            <Head n={8}>Payment milestones: invoice plan</Head>
            <p className="mc-pa-sub">{PAYMENT_PLAN_LABEL}</p>
            {scaffold.paymentMilestones.length === 0 ? (
              <p className="mc-req-fallback mt-2">
                {PAYMENT_MILESTONES_EMPTY} {PAYMENT_MILESTONES_EMPTY_NOTE}
              </p>
            ) : (
              <TableScrollRegion baseClassName="mc-dt-wrap mt-2" className="stack" label={regionContext ? `Handoff payment milestones table, ${regionContext}` : "Handoff payment milestones table"}>
<table className="mc-dt stack">
                <caption className="sr-only">Payment milestones on this file</caption>
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Due logic</th>
                    <th scope="col" className="is-nowrap">CLIN</th>
                    <th scope="col" className="is-numeric">Amount</th>
                    <th scope="col" className="is-numeric">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {scaffold.paymentMilestones.map((m, i) => (
                    <tr key={`${m.event}-${i}`}>
                      <td data-label="Event">
                        {m.event}
                        {m.value_note ? (
                          <span className="mc-req-meta">{m.value_note}</span>
                        ) : null}
                      </td>
                      <td data-label="Due logic">{m.due_logic}</td>
                      <td data-label="CLIN" data-numeric>
                        {m.clin_number}
                        {m.clin_note ? (
                          <span className="mc-req-meta">{m.clin_note}</span>
                        ) : null}
                      </td>
                      <td data-label="Amount" className="is-numeric">{m.amount}</td>
                      <td data-label="Percent" className="is-numeric">{m.percent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
</TableScrollRegion>
            )}
            {paymentPlanNotes(scaffold.paymentMilestones).map((n) => (
              <p key={n} className="mc-pa-sub mt-1">
                {n}
              </p>
            ))}
          </section>

          <section className="mc-kpanel-section">
            <Head n={9}>Signatures</Head>
            <p className="mc-pa-sub">
              Every line below is blank on purpose. T-Minus stores no signature and does not write
              to NCMS; the contracting officer signs the award in NCMS, the system of record.
            </p>
            <dl className="mc-pa-facts is-2 mt-2">
              {[
                "Contractor signature",
                "Name and title of signer",
                "Date signed",
                "Contracting officer signature",
                "Name of contracting officer",
                "Date of award",
              ].map((label) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className="is-blank">
                    {label.startsWith("Date")
                      ? "Not recorded, completed in NCMS"
                      : "Blank, signed in NCMS"}
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
