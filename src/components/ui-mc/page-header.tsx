import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kit page header. Keeps the page h1 (the shell moves focus to "#main-content h1"
 * after navigation), the short navy rule, an optional eyebrow and scope chip, a lead,
 * and an actions slot on the right. The older PageHeader in app-shell stays for pages
 * not yet moved to the kit.
 */
export function McPageHeader({
  title,
  lead,
  eyebrow,
  scope,
  actions,
  className,
}: {
  title: string;
  lead?: ReactNode;
  /** Small uppercase line above the title, e.g. the nav group. */
  eyebrow?: string;
  /** A short scope word shown next to the eyebrow, e.g. "All centers". */
  scope?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mc-page-header", className)}>
      <div className="mc-page-header-row">
        <div className="min-w-0">
          <span aria-hidden="true" className="mc-page-header-rule" />
          {eyebrow || scope ? (
            <p className="mc-page-header-eyebrow">
              {eyebrow ? <span className="type-label">{eyebrow}</span> : null}
              {scope ? <span className="mc-page-header-scope">{scope}</span> : null}
            </p>
          ) : null}
          <h1 className="mc-page-header-title">{title}</h1>
          {lead ? <p className="mc-page-header-lead">{lead}</p> : null}
        </div>
        {actions ? <div className="mc-page-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
