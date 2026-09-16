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
import { hasAnyRole, hasRole, userForRole, SEEDED_USERS, type PersonaRole, type RoleId, type SeededUser } from "@/lib/roles";
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
  roles: RoleId[];
  hasRole: (role: RoleId) => boolean;
  hasAnyRole: (roles: RoleId[]) => boolean;
  user: SeededUser;
  authState: AuthState;
  authMessage: string | null;
  setRole: (r: PersonaRole) => void;
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
      return "hq";
    case "administrator":
    case "admin":
      return "administrator";
    default:
      return "specialist"; // 'co' and anything unknown work the contracting queue
  }
}

// Administrator first, so a multi-role account always reads as the strongest
// role it holds rather than whichever row the database returned first.
const ROLE_ORDER: RoleId[] = ["administrator", "hq", "specialist", "executive", "reviewer", "requester"];

function orderRoles(roles: RoleId[]): RoleId[] {
  const unique = Array.from(new Set(roles));
  return unique.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [personaRole, setPersonaRole] = useState<PersonaRole>("executive");
  const [assignedRoles, setAssignedRoles] = useState<RoleId[]>([]);
  const [roleRevision, setRoleRevision] = useState(0);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    // A signed-in session only ends on a definite sign-out. Token refreshes and
    // client-side navigations must never drop the account back to the sign-in
    // screen or to a blank profile.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (next) {
        setSession(next);
        setReady(true);
        return;
      }
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setAssignedRoles([]);
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession(data.session);
      else setSession((current) => current);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAnonymous = Boolean(session?.user?.is_anonymous);

  useEffect(() => {
    const refreshRoles = () => setRoleRevision((revision) => revision + 1);
    window.addEventListener("tminus:roles-changed", refreshRoles);
    return () => window.removeEventListener("tminus:roles-changed", refreshRoles);
  }, []);

  const userId = session?.user?.id ?? null;

  // Load account defaults. Demo sessions keep their session-only persona and do
  // not need a persisted role membership. A failed read keeps the last known
  // profile and roles in place and tries again, so the header never falls back
  // to a generic account mid-browse.
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    const load = async () => {
      const [profileResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name, role, is_admin, last_center_code, last_organization_code").eq("id", userId).maybeSingle(),
        isAnonymous
          ? Promise.resolve({ data: [], error: null })
          : supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (cancelled) return false;
      if (profileResult.error || rolesResult.error) return false;
      setAuthMessage(null);
      if (profileResult.data) setProfile(profileResult.data as Profile);
      const loaded = ((rolesResult.data ?? []) as { role: RoleId }[]).map((row) => row.role);
      if (isAnonymous || loaded.length) setAssignedRoles(orderRoles(loaded));
      return true;
    };
    void (async () => {
      if (await load()) return;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (cancelled) return;
      if (!(await load()) && !cancelled) {
        setAuthMessage("Your profile did not load. Sign out and back in to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isAnonymous, roleRevision]);

  const canSwitchPersona = isAnonymous;

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAssignedRoles([]);
    setPersonaRole("executive");
  }, []);

  const legacyRole = profile?.is_admin ? "administrator" : roleFromProfile(profile?.role);
  const signedInRoles = orderRoles(
    profile?.is_admin ? ["administrator" as RoleId, ...assignedRoles] : assignedRoles,
  );
  const roles: RoleId[] = isAnonymous ? [personaRole] : signedInRoles.length ? signedInRoles : [legacyRole];
  const role: RoleId = isAnonymous ? personaRole : roles[0] ?? legacyRole;

  const rolesKey = roles.join(",");

  const value = useMemo<RoleContextValue>(() => {
    const seeded = userForRole(role);
    const metadata = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const metaName = typeof metadata['display_name'] === "string" ? metadata['display_name'] : null;
    const user: SeededUser =
      canSwitchPersona || !session
        ? seeded
        : {
            ...seeded,
            name: accountName(profile?.display_name ?? metaName, profile?.email ?? session.user.email),
            email: profile?.email ?? session.user.email ?? seeded.email,
          };
    return {
      role,
      roles,
      hasRole: (candidate) => hasRole(roles, candidate),
      hasAnyRole: (candidates) => hasAnyRole(roles, candidates),
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
  }, [role, rolesKey, roles, session, ready, authMessage, canSwitchPersona, isAnonymous, profile, signOut]);

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
