import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useState, type ReactNode } from "react";
import { navFor, ROLE_LABELS, SEEDED_USERS, type RoleId } from "@/lib/roles";
import { useRole } from "@/components/role-context";
import { Orby } from "@/components/orby";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GlobalSearch } from "@/components/global-search";
import { AskTMinus } from "@/components/ask-tminus";

import { cn } from "@/lib/utils";
import { PanelLeft } from "lucide-react";

// Survives route remounts so the click run isn't reset by navigation.
const wordmarkClicks = { current: { count: 0, at: 0, acq: null as string | null } };

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {

  const { role, user, setRole, authMessage, isAnonymous, canSwitchPersona, signOut } = useRole();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = navFor(role);

  // Easter egg: five clicks in a row on the wordmark summon Orby once.
  const [orbyFor, setOrbyFor] = useState<{ id: string | null; key: number } | null>(null);
  const clicks = wordmarkClicks;

  const onWordmarkClick = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      const s = clicks.current;
      if (now - s.at > 700) {
        s.count = 0;
        s.acq = /^\/files\/([^/]+)/.exec(pathname)?.[1] ?? null;
      }
      s.at = now;
      s.count += 1;
      if (s.count > 1) e.preventDefault();
      if (s.count >= 5) {
        s.count = 0;
        setOrbyFor({ id: s.acq, key: now });
      }
    },
    [pathname],
  );


  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background px-4 py-3 sm:px-6">

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>
          <Link to="/" className="block" onClick={onWordmarkClick}>
            <span className="block text-[18px] leading-6 font-semibold text-foreground">
              T-Minus
            </span>
            <span className="block text-[13px] leading-4 text-muted-foreground">
              Mission Acquisition Acceleration
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <GlobalSearch />
          <AskTMinus />
          {isAnonymous ? (
            <span className="rounded-lg border border-border px-2 py-1 text-[13px] text-muted-foreground">
              Demo
            </span>
          ) : null}
          {canSwitchPersona ? (
            <>
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
            </>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              {user.name} — {ROLE_LABELS[role]}
            </span>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      <AnnouncementBanner />


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
                    {collapsed ? (
                      <>
                        <span aria-hidden="true">{item.label.slice(0, 1)}</span>
                        <span className="sr-only">{item.label}</span>
                      </>
                    ) : (
                      item.label
                    )}
                    {!collapsed && item.note ? (
                      <span className="block text-[12px] text-muted-foreground">{item.note}</span>
                    ) : null}
                  </Link>

                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Link
              to="/seed-status"
              title="Seed status"
              className="block truncate text-[13px] text-muted-foreground hover:text-foreground"
            >
              {collapsed ? (
                <>
                  <span aria-hidden="true">S</span>
                  <span className="sr-only">Seed status</span>
                </>
              ) : (
                "Seed status"
              )}
            </Link>
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <main
            id="main-content"
            tabIndex={-1}
            className={cn("px-4 py-8 sm:px-8", wide ? "max-w-[1440px]" : "max-w-[1280px]")}
          >
            {authMessage ? (
              <p
                role="status"
                className="mb-6 border-l-2 py-1 pl-3 text-[13px]"
                style={{ borderColor: "var(--attention)", color: "var(--attention)" }}
              >
                Needs attention: {authMessage}
              </p>
            ) : null}
            {children}
          </main>
          <footer className="px-4 pb-8 text-[13px] text-muted-foreground sm:px-8">
            Prototype. Not an official NASA system. Viewing as {user.title}, {user.center_code}.{" "}
            <Link to="/about" className="text-primary">
              About T-Minus
            </Link>
          </footer>
        </div>

      </div>

      {orbyFor ? (
        <Orby key={orbyFor.key} acquisitionId={orbyFor.id} onDone={() => setOrbyFor(null)} />
      ) : null}
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

/**
 * A status word paired with its colour as a marker, never colour alone.
 * The word itself stays in the text colour so every label clears 4.5:1;
 * the marker carries the palette colour and clears 3:1 as a graphic.
 */
export function StatusMark({
  color,
  children,
  className,
}: {
  color: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-2 text-foreground", className)}>
      <span
        aria-hidden="true"
        className="inline-block size-2 shrink-0 translate-y-[-1px] rounded-[2px]"
        style={{ background: color }}
      />
      <span>{children}</span>
    </span>
  );
}

export function LoadingNote({ what }: { what: string }) {
  return (
    <p role="status" className="text-muted-foreground">
      Loading {what}.
    </p>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="max-w-[80ch] border-l-2 py-1 pl-3" style={{ borderColor: "var(--atrisk)" }}>
      {message}
    </p>
  );
}

export function EmptyState({
  sentence,
  action,
}: {
  sentence: string;
  action?: ReactNode;
}) {
  return (
    <div className="max-w-[70ch]">
      <p className="text-muted-foreground">{sentence}</p>
      {action ? <div className="mt-4">{action}</div> : null}
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
