import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type MissionReadiness = "GO" | "WATCH" | "HOLD" | "LAUNCHED";
export type ProvenanceKind = "FACT" | "RULE" | "INFERENCE" | "DRAFT";

const readinessTone: Record<MissionReadiness, "green" | "amber" | "red" | "cyan"> = {
  GO: "green",
  WATCH: "amber",
  HOLD: "red",
  LAUNCHED: "cyan",
};

export function missionReadinessClass(state: MissionReadiness, prefix: string) {
  return `${prefix}-${state.toLowerCase()}`;
}

export function MissionReadinessChip({ state, className }: { state: MissionReadiness; className?: string }) {
  return <span className={cn("mc-state", missionReadinessClass(state, "mc-state"), className)}>{state}</span>;
}

export function ProvenanceChip({ kind, light = false, markerOnly = false }: { kind: ProvenanceKind; light?: boolean; markerOnly?: boolean }) {
  if (markerOnly) return <span aria-hidden="true" />;
  return <span className={cn("mc-recon-chip", light && "is-light")}>{kind}</span>;
}

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
  tone,
  readiness,
  index,
  description,
  pressed,
  onSelect,
}: {
  pressed?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  label: string;
  value: number;
  tone?: "cyan" | "green" | "amber" | "red";
  readiness?: MissionReadiness;
  index?: string;
  description?: string;
}) {
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      {...(onSelect
        ? { type: "button" as const, onClick: onSelect, "aria-pressed": !!pressed, "aria-label": `${label}: ${value}. ${pressed ? "Clear filter" : "Filter acquisitions"}` }
        : {})}
      className={cn("mc-stat-block", `mc-tone-${readiness ? readinessTone[readiness] : tone ?? "cyan"}`, onSelect && "mc-stat-filter")}
    >
      <div className="flex items-center gap-3">
        <span className="mc-status-pip" aria-hidden="true" />
        <p className="mc-label">{label}</p>
        <p className="mc-stat-xl" data-numeric>{value}</p>
        {index ? <span className="mc-stat-index" aria-hidden="true">{index}</span> : null}
      </div>
      {description ? <p className="mc-stat-description">{description}</p> : null}
    </Tag>
  );
}

export function MissionStripTable({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mc-strip-table", className)} role="table" {...props}>{children}</div>;
}

export function GateDisclosureShell({
  blocked = false,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { blocked?: boolean }) {
  return <div className={cn("mc-gate-evidence", blocked && "is-blocked-evidence", className)} {...props}>{children}</div>;
}

export function GateGlance({ children, className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("mc-gate-glance", className)} {...props}>{children}</dl>;
}

export function LeadershipExceptionList({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mc-exception-strips", className)} {...props}>{children}</div>;
}

export function LeadershipExceptionStrip({
  state,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { state: Extract<MissionReadiness, "WATCH" | "HOLD"> }) {
  return <article className={cn("mc-exception-strip", `is-${state.toLowerCase()}`, className)} {...props}>{children}</article>;
}

export function AnalystTableShell({ children, className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="mc-exception-table-wrap">
      <table className={cn("mc-exception-table", className)} {...props}>{children}</table>
    </div>
  );
}