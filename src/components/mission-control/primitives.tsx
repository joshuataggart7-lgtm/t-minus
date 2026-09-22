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
}: {
  label: string;
  value: number;
  tone?: "cyan" | "green" | "amber" | "red";
}) {
  return (
    <div className={cn("mc-stat-block", `mc-tone-${tone}`)}>
      <p className="mc-stat-xl" data-numeric>{value}</p>
      <p className="mc-label">{label}</p>
    </div>
  );
}

export function McBarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <li className="grid grid-cols-[minmax(7.5rem,0.7fr)_minmax(8rem,2fr)_2rem] items-center gap-3">
      <span className="truncate text-[13px] text-foreground">{label}</span>
      <span className="mc-bar-track" aria-hidden="true">
        <span className="mc-bar-fill" style={{ width: `${percentage}%` }} />
      </span>
      <span className="text-right text-[13px] font-semibold text-foreground" data-numeric>{value}</span>
    </li>
  );
}