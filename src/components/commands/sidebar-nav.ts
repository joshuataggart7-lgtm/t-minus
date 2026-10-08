import { navFor, type PersonaRole } from "@/lib/roles";

/** Sidebar groups. Items not listed in a group are never rendered in the sidebar. */
export const NAV_GROUPS = [
  { label: "Work", items: ["Executive Overview", "Today", "Reviewer inbox", "Evaluation workspace", "Requester portal", "Work Queue", "Files", "Intake", "Estimate"] },
  { label: "Documents", items: ["Templates", "Checks", "Deviations"] },
  { label: "Oversight", items: ["Audit Log", "Watch", "Directive compliance", "Clause changes", "Escalations", "Leadership digest", "Reporting views", "Simulate", "Regulatory data intake", "PGPD queue"] },
  { label: "Setup", items: ["Center configuration", "Announcements", "Seed status"] },
] as const;

export type SidebarItem = ReturnType<typeof navFor>[number];

/**
 * The pages each narrower role sees first. Everything else that role could
 * already open stays available under a collapsed "More" group and in the
 * command menu; nothing is removed and no route or permission changes.
 * Executive and Administrator keep the full grouped list. Contracting gets its
 * desk first, with the leadership pages (Executive Overview, Leadership digest,
 * Reporting views) under "More" like every other narrower role.
 */
export const PRIMARY_NAV: Partial<Record<PersonaRole, readonly string[]>> = {
  specialist: [
    "Today", "Work Queue", "Files", "Intake", "Estimate",
    "Templates", "Checks", "Deviations",
    "Audit Log", "Watch", "Directive compliance", "Clause changes", "Escalations",
    "Center configuration", "Announcements",
  ],
  requester: ["Requester portal", "Intake", "Files", "Announcements"],
  reviewer: ["Reviewer inbox", "Files", "Audit Log", "Escalations", "Announcements"],
  evaluator: ["Evaluation workspace", "Announcements"],
  hq: [
    "Executive Overview", "Files", "Escalations", "Leadership digest", "Reporting views",
    "Directive compliance", "Deviations", "Clause changes", "Watch", "Audit Log", "Simulate",
    "Announcements", "Center configuration", "Regulatory data intake", "PGPD queue", "Seed status",
  ],
};

export const MORE_GROUP_LABEL = "More";

function primaryLabels(roles: PersonaRole[]): Set<string> | null {
  if (roles.some((r) => r === "administrator" || r === "executive")) return null;
  const lists = roles.map((r) => PRIMARY_NAV[r]).filter((l): l is readonly string[] => Boolean(l));
  return lists.length ? new Set(lists.flat()) : null;
}

/**
 * The exact groups and items the sidebar renders for these roles and presenter
 * state. Shared by the sidebar and the navigation command provider so they
 * cannot drift. Empty groups are omitted (the sidebar renders nothing for them).
 */
export function sidebarNavGroups(roles: PersonaRole[], presenter: boolean, demo = false) {
  const allItems = navFor(roles);
  // The demo (read-only) session hides Seed status the way presenter mode
  // does. A real HQ sign-in keeps it; the route itself is unchanged.
  const items = presenter
    ? allItems.filter((item) => item.label !== "Seed status" && item.label !== "Simulate")
    : demo
      ? allItems.filter((item) => item.label !== "Seed status")
      : allItems;
  const groups = presenter ? NAV_GROUPS.filter((group) => group.label !== "Setup") : NAV_GROUPS;
  const grouped = groups
    .map((group) => ({
      label: group.label as string,
      items: items.filter((item) => (group.items as readonly string[]).includes(item.label)),
    }))
    .filter((group) => group.items.length > 0);
  const primary = primaryLabels(roles);
  if (!primary) return grouped;
  const more = grouped.flatMap((group) => group.items.filter((item) => !primary.has(item.label)));
  const top = grouped
    .map((group) => ({ label: group.label, items: group.items.filter((item) => primary.has(item.label)) }))
    .filter((group) => group.items.length > 0);
  return more.length ? [...top, { label: MORE_GROUP_LABEL, items: more }] : top;
}
