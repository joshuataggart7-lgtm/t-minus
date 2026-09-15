import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { userForRole, SEEDED_USERS, type RoleId, type SeededUser } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { accountName } from "@/lib/account-name";
import { AuthScreen } from "@/components/auth-screen";

type AuthState = "signed-out" | "signing-in" | "signed-in" | "unavailable";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  is_admin: boolean;
  last_center_code: string | null;
  last_organization_code: string | null;
};

type RoleContextValue = {
  role: RoleId;
  user: SeededUser;
  authState: AuthState;
  authMessage: string | null;
  setRole: (r: RoleId) => void;
  isAnonymous: boolean;
  canSwitchPersona: boolean;
  profile: Profile | null;
  signOut: () => Promise<void>;
};

const RoleContext = createContext<RoleContextValue | null>(null);

// A profile role string maps onto one of the five prototype personas.
function roleFromProfile(value: string | undefined | null): RoleId {
  switch ((value ?? "").toLowerCase()) {
    case "executive":
      return "executive";
    case "reviewer":
      return "reviewer";
    case "requester":
      return "requester";
    case "hq":
    case "admin":
      return "hq";
    default:
      return "specialist"; // 'co' and anything unknown work the contracting queue
  }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [personaRole, setPersonaRole] = useState<RoleId>("executive");
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setProfile(null);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAnonymous = Boolean(session?.user?.is_anonymous);

  // Load defaults for every authenticated session, including an anonymous demo.
  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setProfile(null);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, role, is_admin, last_center_code, last_organization_code")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setAuthMessage("Your profile did not load. Sign out and back in to try again.");
      } else {
        setAuthMessage(null);
        setProfile((data as Profile) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const canSwitchPersona = isAnonymous || Boolean(profile?.is_admin);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPersonaRole("executive");
  }, []);

  const role: RoleId = canSwitchPersona ? personaRole : roleFromProfile(profile?.role);

  const value = useMemo<RoleContextValue>(() => {
    const seeded = userForRole(role);
    const user: SeededUser =
      canSwitchPersona || !session
        ? seeded
        : {
            ...seeded,
            name: accountName(profile?.display_name, profile?.email),
            email: profile?.email ?? seeded.email,
          };
    return {
      role,
      user,
      authState: session ? "signed-in" : ready ? "signed-out" : "signing-in",
      authMessage,
      setRole: (r) => {
        if (canSwitchPersona && SEEDED_USERS.some((u) => u.role === r)) setPersonaRole(r);
      },
      isAnonymous,
      canSwitchPersona,
      profile,
      signOut,
    };
  }, [role, session, ready, authMessage, canSwitchPersona, isAnonymous, profile, signOut]);

  return (
    <RoleContext.Provider value={value}>
      {ready && !session ? <AuthScreen /> : children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
