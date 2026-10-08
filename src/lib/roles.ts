export type RoleId = "administrator" | "executive" | "specialist" | "reviewer" | "requester" | "hq" | "evaluator";
// Demo personas cover six roles; there is no administrator demo persona.
// The evaluator is a demo persona only: no profile value maps to it and it is
// never offered as an assignable role.
export type PersonaRole = RoleId;

export type SeededUser = {
  role: PersonaRole;
  name: string;
  title: string;
  email: string;
  center_code: string;
  landing: string;
};

// Display defaults for a signed-in real administrator. Not a demo persona and
// never selectable in Try the demo; the account's own name comes from its profile.
export const ADMINISTRATOR_DEFAULTS: SeededUser = {
  role: "administrator",
  name: "Administrator",
  title: "Administrator",
  email: "",
  center_code: "ARC",
  landing: "/today",
};

// Five demo personas, one per non-administrator role. Fictional people.
// Christina and Roger remain email/password-only and never appear in this list.
export const SEEDED_USERS: SeededUser[] = [
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
    center_code: "ARC",
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
  {
    role: "evaluator",
    name: "L. Park (fictional COR)",
    title: "Technical evaluator",
    email: "evaluator@t-minus.demo",
    center_code: "ARC",
    landing: "/evaluator",
  },
];

export const NAV_ITEMS: { to: string; label: string; roles: RoleId[] | "all"; note?: string }[] = [
  { to: "/overview", label: "Executive Overview", roles: "all" },
  { to: "/today", label: "Today", roles: ["specialist"] },
  { to: "/reviewer-inbox", label: "Reviewer inbox", roles: ["reviewer"] },
  { to: "/evaluator", label: "Evaluation workspace", roles: ["evaluator"] },
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
  evaluator: "Evaluator",
};

// The value stored on a profile for each role.
export const PROFILE_ROLE_VALUES: Record<RoleId, string> = {
  administrator: "administrator",
  executive: "executive",
  specialist: "contracting",
  reviewer: "reviewer",
  requester: "requester",
  hq: "hq",
  evaluator: "evaluator",
};

export function userForRole(role: RoleId): SeededUser {
  if (role === "administrator") return ADMINISTRATOR_DEFAULTS;
  const matched = SEEDED_USERS.find((u) => u.role === role) ?? SEEDED_USERS.find((u) => u.role === "executive");
  if (matched) return matched;
  throw new Error("The seeded demo personas are not available.");
}

export function hasRole(roles: readonly RoleId[], role: RoleId): boolean {
  return roles.includes("administrator") || roles.includes(role);
}

export function hasAnyRole(roles: readonly RoleId[], allowed: readonly RoleId[]): boolean {
  return roles.includes("administrator") || allowed.some((role) => roles.includes(role));
}

/** Pages an evaluator-only session may open. Everything else in the file is outside an evaluator's need to know. */
export const EVALUATOR_PATHS = ["/evaluator", "/announcements"] as const;

/** True when every role held is the evaluator role (the evaluator demo persona). */
export function isEvaluatorOnly(roles: readonly RoleId[]): boolean {
  return roles.length > 0 && roles.every((r) => r === "evaluator");
}

export function navFor(roles: readonly RoleId[]) {
  if (isEvaluatorOnly(roles)) {
    return NAV_ITEMS.filter((i) => (EVALUATOR_PATHS as readonly string[]).includes(i.to));
  }
  return NAV_ITEMS.filter((i) => i.roles === "all" || hasAnyRole(roles, i.roles));
}
