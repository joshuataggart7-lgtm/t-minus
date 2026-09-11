import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { navFor, SEEDED_USERS, type RoleId } from "@/lib/roles";
import { useRole } from "@/components/role-context";
import { cn } from "@/lib/utils";
import { PanelLeft } from "lucide-react";

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { role, user, setRole } = useRole();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = navFor(role);

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <header className="flex items-center justify-between gap-6 border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>
          <Link to="/" className="block">
            <span className="block text-[18px] leading-6 font-semibold text-foreground">
              T-Minus
            </span>
            <span className="block text-[13px] leading-4 text-muted-foreground">
              Mission Acquisition Acceleration
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="role-toggle" className="text-[13px] text-muted-foreground">
            Signed in as
          </label>
          <select
            id="role-toggle"
            value={role}
            onChange={(e) => setRole(e.target.value as RoleId)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
          >
            {SEEDED_USERS.map((u) => (
              <option key={u.role} value={u.role}>
                {u.title} — {u.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex">
        <nav
          aria-label="Main"
          className={cn(
            "shrink-0 border-r border-border bg-background",
            collapsed ? "w-14" : "w-60",
          )}
        >
          <ul className="py-3">
            {items.map((item) => {
              const active = pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    title={item.label}
                    className={cn(
                      "block truncate px-4 py-2 text-[14px]",
                      active
                        ? "border-l-2 border-primary bg-canvas font-medium text-foreground"
                        : "border-l-2 border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {collapsed ? item.label.slice(0, 1) : item.label}
                    {!collapsed && item.note ? (
                      <span className="block text-[12px] text-muted-foreground">{item.note}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <main className={cn("px-8 py-8", wide ? "max-w-[1440px]" : "max-w-[1280px]")}>
            {children}
          </main>
          <footer className="px-8 pb-8 text-[13px] text-muted-foreground">
            Prototype. Not an official NASA system. Viewing as {user.title}, {user.center_code}.
          </footer>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-8">
      <h1 className="page-title">{title}</h1>
      {lead ? <p className="mt-2 max-w-[70ch] text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

export function Placeholder({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-6">
      <p className="text-muted-foreground">{note}</p>
    </div>
  );
}
