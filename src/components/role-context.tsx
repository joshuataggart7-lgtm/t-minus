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
  role: RoleId | null;
  roles: RoleId[];
  hasRole: (role: RoleId) => boolean;
  hasAnyRole: (roles: RoleId[]) => boolean;
  user: SeededUser;
  authState: AuthState;
  authMessage: string | null;
  setRole: (r: PersonaRole) => void;
  isAnonymous: boolean;
  readOnly: boolean;
  canSwitchPersona: boolean;
  profile: Profile | null;
  signOut: () => Promise<void>;
};

const DEMO_PERSONA_KEY = "tminus-demo-persona";

function readSavedPersona(): PersonaRole | null {
  try {
    const stores = [window.localStorage, window.sessionStorage];
    for (const store of stores) {
      const saved = store.getItem(DEMO_PERSONA_KEY);
      const match = SEEDED_USERS.find((u) => u.role === saved);
      if (match) return match.role;
    }
  } catch { /* ignore */ }
  return null;
}

function savePersona(r: PersonaRole) {
  try { window.localStorage.setItem(DEMO_PERSONA_KEY, r); } catch { /* ignore */ }
  try { window.sessionStorage.setItem(DEMO_PERSONA_KEY, r); } catch { /* ignore */ }
}

function clearSavedPersona() {
  try { window.localStorage.removeItem(DEMO_PERSONA_KEY); } catch { /* ignore */ }
  try { window.sessionStorage.removeItem(DEMO_PERSONA_KEY); } catch { /* ignore */ }
}

function SessionStatus({ slow }: { slow: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div role="status" aria-live="polite" className="text-[15px] leading-[22px] text-muted-foreground">
        {slow ? (
          <div className="flex flex-col items-start gap-3">
            <p>Your session is taking longer than usual to load.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Reload
            </button>
          </div>
        ) : (
          <p>Loading your session.</p>
        )}
      </div>
    </div>
  );
}

const RoleContext = createContext<RoleContextValue | null>(null);

// A profile role string maps onto one of the prototype roles. An unknown or
// empty value (including 'contracting' and 'co') means no role at all.
function roleFromProfile(value: string | undefined | null): RoleId | null {
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
      return null;
  }
}

// Administrator first, so a multi-role account always reads as the strongest
// role it holds rather than whichever row the database returned first.
const ROLE_ORDER: RoleId[] = ["administrator", "hq", "specialist", "executive", "reviewer", "requester", "evaluator"];

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
  const [personaRestored, setPersonaRestored] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // A signed-in session only ends on a definite sign-out. Token refreshes and
    // client-side navigations must never drop the account back to the sign-in
    // screen or to a blank profile.
    // Demo sessions restore the saved persona in the same step that sets the
    // session, so the first render of the app already uses it.
    const applySession = (next: Session) => {
      if (next.user?.is_anonymous) {
        setPersonaRole(readSavedPersona() ?? "executive");
        setPersonaRestored(true);
      }
      setSession(next);
      setReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (next) {
        applySession(next);
        return;
      }
      if (event === "SIGNED_OUT") {
        clearSavedPersona();
        setPersonaRestored(false);
        setPersonaRole("executive");
        setSession(null);
        setProfile(null);
        setAssignedRoles([]);
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) applySession(data.session);
      else setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAnonymous = Boolean(session?.user?.is_anonymous);

  // Never fall back to rendering the app as Executive: if the session does
  // not resolve, offer a reload instead.
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [ready]);

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
    clearSavedPersona();
    setPersonaRestored(false);
    setProfile(null);
    setAssignedRoles([]);
    setPersonaRole("executive");
  }, []);

  const legacyRole: RoleId | null = profile?.is_admin ? "administrator" : roleFromProfile(profile?.role);
  const signedInRoles = orderRoles(
    profile?.is_admin ? ["administrator" as RoleId, ...assignedRoles] : assignedRoles,
  );
  const roles: RoleId[] = isAnonymous
    ? [personaRole]
    : signedInRoles.length
      ? signedInRoles
      : legacyRole
        ? [legacyRole]
        : [];
  const role: RoleId | null = isAnonymous ? personaRole : roles[0] ?? null;

  const rolesKey = roles.join(",");

  const value = useMemo<RoleContextValue>(() => {
    // A role-less account navigates with the Executive defaults only.
    const seeded = userForRole(role ?? "executive");
    const metadata = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const metaName = typeof metadata['display_name'] === "string" ? metadata['display_name'] : null;
    const user: SeededUser =
      canSwitchPersona || !session
        ? seeded
        : {
            ...seeded,
            name: !profile && !metaName
              ? "Signed-in user"
              : accountName(profile?.display_name ?? metaName, profile?.email ?? session.user.email),
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
        if (canSwitchPersona && SEEDED_USERS.some((u) => u.role === r)) {
          setPersonaRole(r);
          savePersona(r);
        }
      },
      isAnonymous,
      readOnly: isAnonymous,
      canSwitchPersona,
      profile,
      signOut,
    };
  }, [role, rolesKey, roles, session, ready, authMessage, canSwitchPersona, isAnonymous, profile, signOut]);

  return (
    <RoleContext.Provider value={value}>
      {!ready || (isAnonymous && !personaRestored) ? (
        <SessionStatus slow={slow && !ready} />
      ) : !session ? (
        <AuthScreen />
      ) : (
        children
      )}
    </RoleContext.Provider>
  );
}

export function useReadOnly(): boolean {
  return useRole().readOnly;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
