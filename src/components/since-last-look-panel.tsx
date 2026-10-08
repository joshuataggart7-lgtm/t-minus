import { Link } from "@tanstack/react-router";
import { lookStamp, type SinceChange } from "@/lib/since-last-look";

/** Saves, decisions, holds, and phase moves since the last look from this browser. */
export function SinceLastLookPanel({
  since,
  ready,
  changes,
  heading = "What changed since you last looked",
}: {
  since: string | null;
  ready: boolean;
  changes: SinceChange[];
  heading?: string;
}) {
  return (
    <section id="since-last-look" className="mc-kpanel mb-8" aria-label={heading}>
      <h2 className="mc-kpanel-title">{heading}</h2>
      {!ready ? (
        <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground">Checking the audit log.</p>
      ) : since === null ? (
        <p className="mt-1 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">
          No earlier look is stored on this browser. The next time you open this page, it lists saves, decisions, holds, and phase moves after this visit.
        </p>
      ) : changes.length === 0 ? (
        <p className="mt-1 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">
          Nothing has moved since you last looked ({lookStamp(since)}).
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">
            Since you last looked ({lookStamp(since)}). Nothing here changes a file.
          </p>
          <ul className="mt-4 space-y-3">
            {changes.slice(0, 12).map((change) => (
              <li key={change.id} className="text-[15px] leading-[22px]">
                <Link
                  to="/files/$acquisitionId"
                  params={{ acquisitionId: change.acquisitionId }}
                  hash="since-last-look"
                  className="font-medium text-primary underline"
                  data-numeric
                >
                  {change.acquisitionId}
                </Link>
                {" "}
                <span>{change.sentence}</span>
              </li>
            ))}
          </ul>
          {changes.length > 12 ? (
            <p className="mt-3 text-[15px] leading-[22px] text-muted-foreground" data-numeric>
              {changes.length - 12} more are in the audit trail.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
