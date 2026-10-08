import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useRole } from "@/components/role-context";

export const LOCK_HINT_TEXT = "View only in the demo. Sign in to make changes.";

/** True in the read-only demo session. UI only: server writes refuse on their own. */
export function useDemoLocked(): boolean {
  return useRole().readOnly;
}

/**
 * Disables every native control inside while the demo is locked, without
 * changing layout (the fieldset renders as display: contents).
 */
export function DemoFieldset({ children, locked }: { children: ReactNode; locked?: boolean }) {
  const demo = useDemoLocked();
  const isLocked = locked ?? demo;
  return (
    <fieldset disabled={isLocked} aria-disabled={isLocked || undefined} className="contents">
      {children}
    </fieldset>
  );
}

/** One muted line per locked region, never per control. */
export function LockHint({ className = "", lead }: { className?: string; lead?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-[13px] text-muted-foreground ${className}`}>
      <Lock className="size-[14px] shrink-0" aria-hidden="true" />
      <span>{lead ? `${lead} ${LOCK_HINT_TEXT}` : LOCK_HINT_TEXT}</span>
    </p>
  );
}
