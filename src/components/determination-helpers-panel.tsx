// Plain-language determination helpers: commerciality, competition, price
// reasonableness. Advisory only — never holds the file or blocks a phase exit.

import { Link } from "@tanstack/react-router";
import { ShowTheText } from "@/components/show-the-text";
import { determinationHelpers } from "@/lib/determination-helpers";

export function DeterminationHelpersPanel({
  acq,
  acquisitionId,
}: {
  acq: Record<string, unknown> | null | undefined;
  acquisitionId: string;
}) {
  const helpers = determinationHelpers(acq);
  return (
    <section aria-label="Determination helpers" className="mt-6 max-w-[80ch] border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[18px] font-medium leading-[24px]">Determination helpers</h3>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      {helpers.length === 0 ? (
        <p className="mt-3 text-[13px] leading-[18px] text-muted-foreground">
          This file is not loaded, so no determination helper is shown.
        </p>
      ) : (
        <ul className="mt-3 list-none">
          {helpers.map((h) => (
            <li key={h.key} className="border-t border-border py-3 text-[13px] leading-[18px]">
              <p className="font-medium">{h.title}</p>
              <p className="mt-1 text-muted-foreground">{h.plain}</p>
              <p className="mt-1 text-muted-foreground">{h.citation}</p>
              <ShowTheText citation={h.citation} />
              {h.templateKey ? (
                <p className="mt-1">
                  <Link
                    to="/documents/$templateKey/$acquisitionId"
                    params={{ templateKey: h.templateKey, acquisitionId }}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Open the {h.templateLabel} on this file
                  </Link>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-border pt-2 text-[13px] leading-[18px] text-muted-foreground">
        No determination text is generated here. The contracting officer writes the determination; T-Minus only shows
        what this record already holds.
      </p>
    </section>
  );
}
