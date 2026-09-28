import { useRole } from "@/components/role-context";

/** UI-only write gate: real Contracting or HQ roles, never an anonymous session. */
export function useCanWrite(): boolean {
  const { hasAnyRole, isAnonymous } = useRole();
  return hasAnyRole(["specialist", "hq"]) && !isAnonymous;
}
