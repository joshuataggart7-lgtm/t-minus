import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Main column plus a right-side details panel. Side by side on wide screens (1280px
 * and up, panel sticky), stacked below the main column otherwise.
 */
export function WithDetailsPanel({
  children,
  panel,
  panelLabel = "Details",
  className,
}: {
  children: ReactNode;
  panel: ReactNode;
  panelLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("mc-with-details", className)}>
      <div className="min-w-0">{children}</div>
      <aside className="mc-details-panel" aria-label={panelLabel}>
        {panel}
      </aside>
    </div>
  );
}

export function DetailsSection({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="mc-details-section" id={id} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function DetailsList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="mc-details-list">
      {items.map((it) => (
        <div key={it.term}>
          <dt>{it.term}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
