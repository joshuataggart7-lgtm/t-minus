import type { ReactNode } from "react";
import { TableScrollRegion } from "@/components/table-scroll-region";
import { cn } from "@/lib/utils";

export type DataColumn<T> = {
  key: string;
  header: ReactNode;
  /** Label shown beside each value when the table stacks on phones. Defaults to the header when it is text. */
  mobileLabel?: string;
  cell: (row: T, index: number) => ReactNode;
  /** Right aligned with tabular figures. */
  numeric?: boolean;
  nowrap?: boolean;
  /** CSS width for the column, e.g. "8rem". */
  width?: string;
  /** Render this column's cells as row headers (th scope="row"). */
  rowHeader?: boolean;
  className?: string;
};

/**
 * The shared table. Body type (15/22) in cells, label type in the head, numeric
 * alignment, a sticky head when maxHeight is set, a plain empty state, and a stacked
 * card layout on phones. Wraps TableScrollRegion so wide tables still say they scroll.
 */
export function DataTable<T>({
  label,
  caption,
  columns,
  rows,
  rowKey,
  empty,
  rowClassName,
  maxHeight,
  stackOnMobile = true,
  className,
}: {
  /** Accessible name for the scroll region. */
  label: string;
  /** Screen reader caption for the table. */
  caption?: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Shown instead of the table when there are no rows. */
  empty?: ReactNode;
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Caps the height (CSS length) and keeps the head in view while scrolling. */
  maxHeight?: string;
  stackOnMobile?: boolean;
  className?: string;
}) {
  if (rows.length === 0) {
    return empty ? <div className="mc-dt-empty">{empty}</div> : null;
  }
  return (
    <TableScrollRegion
      label={label}
      baseClassName="mc-dt-wrap"
      className={cn(stackOnMobile && "stack", className)}
    >
      <div className={maxHeight ? "mc-dt-scroll" : undefined} style={maxHeight ? { maxHeight } : undefined}>
        <table className={cn("mc-dt", stackOnMobile && "stack")}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(c.numeric && "is-numeric", c.nowrap && "is-nowrap") || undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={rowKey(row, i)} className={rowClassName?.(row, i)}>
                {columns.map((c) => {
                  const dataLabel = c.mobileLabel ?? (typeof c.header === "string" ? c.header : undefined);
                  const cls = cn(c.numeric && "is-numeric", c.nowrap && "is-nowrap", c.className) || undefined;
                  return c.rowHeader ? (
                    <th key={c.key} scope="row" data-label={dataLabel} className={cls}>
                      {c.cell(row, i)}
                    </th>
                  ) : (
                    <td key={c.key} data-label={dataLabel} className={cls}>
                      {c.cell(row, i)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableScrollRegion>
  );
}

/** Placeholder for a cell with no value, in words rather than a dash. */
export function EmptyCell({ children = "Not recorded" }: { children?: ReactNode }) {
  return <span className="mc-dt-empty-cell">{children}</span>;
}
