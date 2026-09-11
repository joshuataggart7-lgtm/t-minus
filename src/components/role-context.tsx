import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { userForRole, type RoleId, type SeededUser } from "@/lib/roles";

type RoleContextValue = { role: RoleId; user: SeededUser; setRole: (r: RoleId) => void };

const RoleContext = createContext<RoleContextValue | null>(null);
const STORAGE_KEY = "t-minus.role";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<RoleId>("executive");

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY) as RoleId | null;
    if (saved) setRoleState(saved);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      user: userForRole(role),
      setRole: (r) => {
        setRoleState(r);
        window.sessionStorage.setItem(STORAGE_KEY, r);
      },
    }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
