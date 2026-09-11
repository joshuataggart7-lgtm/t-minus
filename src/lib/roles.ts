export type RoleId = "executive" | "specialist" | "reviewer" | "requester" | "hq";

export type SeededUser = {
  role: RoleId;
  name: string;
  title: string;
  email: string;
  center_code: string;
  landing: string;
};

// Five seeded Supabase Auth users, one per role. Fictional people.
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
    landing: "/work-queue",
  },
  {
    role: "reviewer",
    name: "P. Osei (fictional counsel)",
    title: "Reviewer",
    email: "reviewer@t-minus.demo",
    center_code: "GSFC",
    landing: "/work-queue",
  },
  {
    role: "requester",
    name: "Dr. Elena Marsh (fictional)",
    title: "Requester",
    email: "requester@t-minus.demo",
    center_code: "ARC",
    landing: "/work-queue",
  },
  {
    role: "hq",
    name: "R. Calder (fictional)",
    title: "HQ",
    email: "hq@t-minus.demo",
    center_code: "HQ",
    landing: "/",
  },
];

export const NAV_ITEMS: { to: string; label: string; roles: RoleId[] | "all"; note?: string }[] = [
  { to: "/", label: "Executive Overview", roles: "all" },
  { to: "/work-queue", label: "Work Queue", roles: ["specialist", "reviewer", "requester", "hq"] },
  { to: "/files", label: "Files", roles: "all" },
  { to: "/templates", label: "Templates", roles: ["specialist", "reviewer", "hq"] },
  { to: "/checks", label: "Checks", roles: ["specialist", "reviewer", "hq"] },
  { to: "/audit-log", label: "Audit Log", roles: "all" },
  { to: "/watch", label: "Watch", roles: "all" },
  { to: "/directives", label: "Directive compliance", roles: "all" },
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
  { to: "/estimate", label: "Estimate", roles: ["specialist", "hq"], note: "Reserved for B12" },
];

export function userForRole(role: RoleId): SeededUser {
  return SEEDED_USERS.find((u) => u.role === role) ?? SEEDED_USERS[0]!;
}

export function navFor(role: RoleId) {
  return NAV_ITEMS.filter((i) => i.roles === "all" || i.roles.includes(role));
}
