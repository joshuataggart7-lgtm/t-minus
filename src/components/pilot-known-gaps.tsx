// Pilot known gaps.
//
// What a reader should know before they judge the prototype. Short, calm and
// honest: each line is a limit we have not closed, not a feature.

export const PILOT_KNOWN_GAPS: { title: string; body: string }[] = [
  {
    title: "Official form field checks are done by a person",
    body: "Filled previews and PDF exports are for a human field check in desktop Adobe Acrobat Reader. A blank form in Chrome or PDF.js is expected for XFA files. Nothing here is an Adobe verification.",
  },
  {
    title: "No write-back to NCMS",
    body: "T-Minus assembles a local handoff packet. NCMS stays the system of record (NFS 1804.171) and the officer keys the award there.",
  },
  {
    title: "The FPDS sheet is a fill aid",
    body: "It lays out the values in reading order to copy. It is not a submission and T-Minus does not write to FPDS.",
  },
  {
    title: "A security finding is deferred",
    body: "Signed-in users can read staff contact details. It is recorded and open, not fixed, and it is not a demo blocker.",
  },
  {
    title: "Advisories never hold a phase",
    body: "Evaluation board notes, missing NF 1098 tabs and Table 12 fill-in confirmations are advisory. None of them hold a file or block a phase exit.",
  },
];

export function PilotKnownGaps() {
  return (
    <section aria-label="Pilot known gaps" className="mb-10 max-w-[70ch]">
      <h2 className="section-title text-[18px] leading-6 font-medium">Pilot known gaps</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        What this prototype does not do. Read this before the walkthrough.
      </p>
      <dl className="mt-3 space-y-3 border-l-2 border-border pl-3">
        {PILOT_KNOWN_GAPS.map((g) => (
          <div key={g.title}>
            <dt className="text-[15px] font-medium">{g.title}</dt>
            <dd className="text-[13px] leading-[18px] text-muted-foreground">{g.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
