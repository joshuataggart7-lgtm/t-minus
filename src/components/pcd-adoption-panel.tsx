import {
  PCD_2603B_NOTE,
  RFO_ADOPTION_NOT_RECORDED,
  RFO_SOURCE_URL,
  deviationStatusLine,
  type DeviationSummary,
} from "@/lib/pcd-adoption";

/**
 * Regulatory baseline & deviations (advisory). Reads only what the record
 * already holds: the baseline date on the file and any linked deviation
 * requests. It never claims an RFO or Interim NFS adoption status — that
 * fact is not recorded in T-Minus — and it never holds a file or blocks a
 * phase exit.
 */
export function PcdAdoptionPanel({
  baselineDate,
  deviations,
}: {
  baselineDate: string | null;
  deviations: DeviationSummary[];
}) {
  return (
    <section aria-label="Regulatory baseline and deviations" className="mt-6 max-w-[80ch] border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[18px] font-medium leading-[24px]">Regulatory baseline &amp; deviations</h3>
        <span className="text-[13px] text-muted-foreground">Advisory — never holds the file or blocks a phase exit.</span>
      </div>

      <dl className="mt-3 text-[13px] leading-[18px]">
        <div className="flex flex-wrap gap-x-2 border-t border-border py-2">
          <dt className="font-medium">Regulatory baseline date on this file</dt>
          <dd className="text-muted-foreground" data-numeric>{baselineDate ?? "Not recorded"}</dd>
        </div>
      </dl>

      <div className="border-t border-border py-2">
        <p className="text-[13px] font-medium leading-[18px]">Deviation requests on this file</p>
        {deviations.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted-foreground">No deviation request is on this file.</p>
        ) : (
          <ul className="mt-1 list-none space-y-1">
            {deviations.map((d) => (
              <li key={d.deviation_id} className="text-[13px] leading-[18px] text-muted-foreground">
                <span className="text-foreground">{d.title}.</span> {deviationStatusLine(d)}.
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border pt-2 text-[13px] leading-[18px] text-muted-foreground">
        <p>
          {RFO_ADOPTION_NOT_RECORDED}{" "}
          <a
            href={RFO_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Official RFO source at acquisition.gov/far-overhaul
          </a>
          .
        </p>
        <p className="mt-1">{PCD_2603B_NOTE}</p>
      </div>
    </section>
  );
}
