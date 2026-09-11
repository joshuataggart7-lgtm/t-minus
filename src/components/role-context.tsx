import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { userForRole, SEEDED_USERS, type RoleId, type SeededUser } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type AuthState = "signed-out" | "signing-in" | "signed-in" | "unavailable";

type RoleContextValue = {
  role: RoleId;
  user: SeededUser;
  authState: AuthState;
  authMessage: string | null;
  setRole: (r: RoleId) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

// Shared demo password for the five seeded prototype accounts.
const DEMO_PASSWORD = "t-minus-demo-2027";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<RoleId>("executive");
  const [authState, setAuthState] = useState<AuthState>("signed-out");
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Sign in as the seeded user for the selected role. The role toggle is a
  // real session switch, not a client-side flag.
  useEffect(() => {
    let cancelled = false;
    const seeded = userForRole(role);
    setAuthState("signing-in");
    void (async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: seeded.email,
        password: DEMO_PASSWORD,
      });
      if (cancelled) return;
      if (error) {
        setAuthState("unavailable");
        setAuthMessage(
          "The seeded accounts are not signed in yet. Run the seed script, then reload. Open Seed status for row counts.",
        );
      } else {
        setAuthState("signed-in");
        setAuthMessage(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      user: userForRole(role),
      authState,
      authMessage,
      setRole: (r) => {
        if (SEEDED_USERS.some((u) => u.role === r)) setRoleState(r);
      },
    }),
    [role, authState, authMessage],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
