export type RoleId = "administrator" | "executive" | "specialist" | "reviewer" | "requester" | "hq";
// The administrator persona is selectable in the Try-the-demo switcher so a
// demo user can land on Today with full privileges without a password.
export type PersonaRole = RoleId;

export type SeededUser = {
  role: PersonaRole;
  name: string;
  title: string;
  email: string;
  center_code: string;
  landing: string;
};

// Six demo personas, one per role. Fictional people. Joshua Taggart leads so
// the administrator is the first option in the Try-the-demo switcher. Christina
// and Roger remain email/password-only and never appear in this list.
export const SEEDED_USERS: SeededUser[] = [
  {
    role: "administrator",
    name: "Joshua Taggart (fictional)",
    title: "Administrator",
    email: "administrator@t-minus.demo",
    center_code: "ARC",
    landing: "/today",
  },
  {
    role: "executive",
    name: "A. Whitfield (fictional)",
    title: "Executive",
    email: "executive@t-minus.demo",
    center_code: "HQ",
    landing: "/",
  },
  {
    role: "specialist",
    name: "J. Rivera (fictional CO)",
    title: "Contracting specialist / officer",
    email: "specialist@t-minus.demo",
    center_code: "ARC",
    landing: "/today",
  },
  {
    role: "reviewer",
    name: "P. Osei (fictional counsel)",
    title: "Reviewer",
    email: "reviewer@t-minus.demo",
    center_code: "GSFC",
    landing: "/reviewer-inbox",
  },
  {
    role: "requester",
    name: "Dr. Elena Marsh (fictional)",
    title: "Requester",
    email: "requester@t-minus.demo",
    center_code: "ARC",
    landing: "/requester",
  },
  {
    role: "hq",
    name: "R. Calder (fictional)",
    title: "HQ",
    email: "hq@t-minus.demo",
    center_code: "HQ",
    landing: "/overview",
  },
];

export const NAV_ITEMS: { to: string; label: string; roles: RoleId[] | "all"; note?: string }[] = [
  { to: "/overview", label: "Executive Overview", roles: "all" },
  { to: "/today", label: "Today", roles: ["specialist"] },
  { to: "/reviewer-inbox", label: "Reviewer inbox", roles: ["reviewer"] },
  { to: "/requester", label: "Requester portal", roles: ["requester"] },
  { to: "/work-queue", label: "Work Queue", roles: ["specialist", "hq"] },
  { to: "/files", label: "Files", roles: "all" },
  { to: "/templates", label: "Templates", roles: ["specialist", "reviewer", "hq"] },
  { to: "/checks", label: "Checks", roles: ["specialist", "reviewer", "hq"] },
  { to: "/audit-log", label: "Audit Log", roles: "all" },
  { to: "/watch", label: "Watch", roles: "all" },
  { to: "/directives", label: "Directive compliance", roles: "all" },
  { to: "/clause-changes", label: "Clause changes", roles: "all" },
  { to: "/escalations", label: "Escalations", roles: "all" },
  { to: "/digest", label: "Leadership digest", roles: "all" },
  { to: "/deviations", label: "Deviations", roles: "all" },
  { to: "/reporting", label: "Reporting views", roles: ["executive", "specialist", "hq"] },
  { to: "/simulate", label: "Simulate", roles: ["executive", "hq"] },
  { to: "/center-config", label: "Center configuration", roles: ["specialist", "hq"] },
  { to: "/reg-intake", label: "Regulatory data intake", roles: ["hq"] },
  { to: "/pgpd-queue", label: "PGPD queue", roles: ["hq"] },
  { to: "/announcements", label: "Announcements", roles: "all" },
  { to: "/intake", label: "Intake", roles: ["specialist", "requester", "hq"] },
  { to: "/estimate", label: "Estimate", roles: ["specialist", "hq"] },
  { to: "/seed-status", label: "Seed status", roles: ["hq"] },
];

// What each role is called on screen and in Center configuration.
export const ROLE_LABELS: Record<RoleId, string> = {
  administrator: "Administrator",
  executive: "Executive",
  specialist: "Contracting",
  reviewer: "Reviewer",
  requester: "Requester",
  hq: "HQ",
};

// The value stored on a profile for each role.
export const PROFILE_ROLE_VALUES: Record<RoleId, string> = {
  administrator: "administrator",
  executive: "executive",
  specialist: "contracting",
  reviewer: "reviewer",
  requester: "requester",
  hq: "hq",
};

export function userForRole(role: RoleId): SeededUser {
  const fallback = SEEDED_USERS[0];
  const matched = SEEDED_USERS.find((u) => u.role === role);
  if (matched) return matched;
  if (fallback) return fallback;
  throw new Error("The seeded demo personas are not available.");
}

export function hasRole(roles: readonly RoleId[], role: RoleId): boolean {
  return roles.includes("administrator") || roles.includes(role);
}

export function hasAnyRole(roles: readonly RoleId[], allowed: readonly RoleId[]): boolean {
  return roles.includes("administrator") || allowed.some((role) => roles.includes(role));
}

export function navFor(roles: readonly RoleId[]) {
  return NAV_ITEMS.filter((i) => i.roles === "all" || hasAnyRole(roles, i.roles));
}
