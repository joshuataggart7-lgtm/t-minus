import { navFor, type PersonaRole } from "@/lib/roles";

/** Sidebar groups. Items not listed in a group are never rendered in the sidebar. */
export const NAV_GROUPS = [
  { label: "Work", items: ["Executive Overview", "Today", "Reviewer inbox", "Requester portal", "Work Queue", "Files", "Intake", "Estimate"] },
  { label: "Documents", items: ["Templates", "Checks", "Deviations"] },
  { label: "Oversight", items: ["Audit Log", "Watch", "Directive compliance", "Clause changes", "Escalations", "Leadership digest", "Reporting views", "Simulate", "Regulatory data intake", "PGPD queue"] },
  { label: "Setup", items: ["Center configuration", "Announcements", "Seed status"] },
] as const;

export type SidebarItem = ReturnType<typeof navFor>[number];

/**
 * The exact groups and items the sidebar renders for these roles and presenter
 * state. Shared by the sidebar and the navigation command provider so they
 * cannot drift. Empty groups are omitted (the sidebar renders nothing for them).
 */
export function sidebarNavGroups(roles: PersonaRole[], presenter: boolean) {
  const allItems = navFor(roles);
  const items = presenter
    ? allItems.filter((item) => item.label !== "Seed status" && item.label !== "Simulate")
    : allItems;
  const groups = presenter ? NAV_GROUPS.filter((group) => group.label !== "Setup") : NAV_GROUPS;
  return groups
    .map((group) => ({
      label: group.label,
      items: items.filter((item) => (group.items as readonly string[]).includes(item.label)),
    }))
    .filter((group) => group.items.length > 0);
}
