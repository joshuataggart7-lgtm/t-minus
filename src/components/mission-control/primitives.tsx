import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function McPanel({
  children,
  className,
  as = "section",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
} & HTMLAttributes<HTMLElement>) {
  const Component = as;
  return <Component className={cn("mc-panel", className)} {...props}>{children}</Component>;
}

export function McStatBlock({
  label,
  value,
  tone = "cyan",
  index,
  description,
}: {
  label: string;
  value: number;
  tone?: "cyan" | "green" | "amber" | "red";
  index?: string;
  description?: string;
}) {
  return (
    <div className={cn("mc-stat-block", `mc-tone-${tone}`)}>
      <div className="flex items-center gap-3">
        <span className="mc-status-pip" aria-hidden="true" />
        <p className="mc-label">{label}</p>
        <p className="mc-stat-xl" data-numeric>{value}</p>
        {index ? <span className="mc-stat-index" aria-hidden="true">{index}</span> : null}
      </div>
      {description ? <p className="mc-stat-description">{description}</p> : null}
    </div>
  );
}