import { Link } from "@tanstack/react-router";
import type { SelfCheckFinding } from "@/lib/file-self-check";

/**
 * The contradictions on one file. The link opens the document so a person can
 * save a new version. This panel does not write.
 */
export function FileSelfCheckPanel({
  acquisitionId,
  findings,
}: {
  acquisitionId: string;
  findings: SelfCheckFinding[];
}) {
  return (
    <section id="file-self-check" className="mc-kpanel mb-8" aria-label="This file disagrees with itself">
      <h2 className="mc-kpanel-title">This file disagrees with itself</h2>
      <p className="mt-1 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">
        {findings.length === 0
          ? "Nothing on this file disagrees with the record."
          : "A reviewer would send the packet back for the items below. Nothing here changes the file."}
      </p>
      {findings.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {findings.map((finding) => (
            <li key={finding.id} className="text-[15px] leading-[22px]">
              <span>{finding.sentence}</span>
              {finding.templateKey && finding.route === "document" ? (
                <>
                  {" "}
                  <Link
                    to="/documents/$templateKey/$acquisitionId"
                    params={{ templateKey: finding.templateKey, acquisitionId }}
                    className="text-primary underline"
                  >
                    Make a new version
                  </Link>
                </>
              ) : null}
              {finding.templateKey && finding.route === "form" ? (
                <>
                  {" "}
                  <Link
                    to="/forms/$formKey/$acquisitionId"
                    params={{ formKey: finding.templateKey, acquisitionId }}
                    className="text-primary underline"
                  >
                    Make a new version
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
