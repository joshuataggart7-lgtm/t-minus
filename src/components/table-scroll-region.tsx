import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TableScrollRegion({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const measure = () => setOverflows(region.scrollWidth > region.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    const table = region.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [children]);

  return (
    <>
      <div
        ref={regionRef}
        role="region"
        tabIndex={0}
        aria-label={label}
        className={cn("mc-work-table-wrap", className)}
      >
        {children}
      </div>
      {overflows ? (
        <p className="mt-2 text-[13px] leading-[18px] text-muted-foreground xl:hidden">
          Scroll sideways to see every column.
        </p>
      ) : null}
    </>
  );
}