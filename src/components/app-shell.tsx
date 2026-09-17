import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { navFor, ROLE_LABELS, SEEDED_USERS, type PersonaRole } from "@/lib/roles";
import { useRole } from "@/components/role-context";
import { Orby } from "@/components/orby";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GlobalSearch } from "@/components/global-search";
import { Nova } from "@/components/nova";
import { PresenterScreensBeat } from "@/components/presenter-screens-beat";
import { usePresenter, setPresenter } from "@/lib/presenter";
import { useTriggerConfig } from "@/lib/use-trigger-config";

import { cn } from "@/lib/utils";
import {
  BarChart3, BookOpenCheck, Building2, Calculator, CalendarClock, ChevronDown,
  CircleCheckBig, ClipboardCheck, Database, FilePlus2, FolderOpen, Gauge, History,
  Inbox, Layers, LayoutTemplate, Megaphone, Newspaper, PanelLeft, Radar, Rocket,
  ScrollText, Send, ShieldAlert, ShieldCheck, SlidersHorizontal, TriangleAlert,
  type LucideIcon,
} from "lucide-react";

const NAV_GROUPS = [
  { label: "Work", items: ["Executive Overview", "Today", "Reviewer inbox", "Requester portal", "Work Queue", "Files", "Intake", "Estimate"] },
  { label: "Documents", items: ["Templates", "Checks", "Deviations"] },
  { label: "Oversight", items: ["Audit Log", "Watch", "Directive compliance", "Clause changes", "Escalations", "Leadership digest", "Reporting views", "Simulate", "Regulatory data intake", "PGPD queue"] },
  { label: "Setup", items: ["Center configuration", "Announcements", "Seed status"] },
] as const;

const NAV_ICONS: Record<string, LucideIcon> = {
  "Executive Overview": LayoutDashboard, Today: Gauge, "Reviewer inbox": ClipboardCheck,
  "Requester portal": FileInput, "Work Queue": BriefcaseBusiness, Files, Intake: FileInput,
  Estimate: Calculator, Templates: ScrollText, Checks: SearchCheck, Deviations: ShieldCheck,
  "Audit Log": FileClock, Watch: Radio, "Directive compliance": ClipboardCheck,
  "Clause changes": BookOpenCheck, Escalations: TriangleAlert, "Leadership digest": Gauge,
  "Reporting views": Gauge, Simulate: Gauge, "Center configuration": Building2,
  Announcements: Megaphone, "Seed status": BellRing, "Regulatory data intake": FileInput,
  "PGPD queue": Files,
};

// Survives route remounts so the click run isn't reset by navigation.
const wordmarkClicks = { current: { count: 0, at: 0, acq: null as string | null } };

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {

  const { role, roles, user, setRole, authMessage, isAnonymous, canSwitchPersona, signOut } = useRole();
  useTriggerConfig();
  const [collapsed, setCollapsed] = useState(false);
  const [groups, setGroups] = useState<Record<string, boolean>>({ Work: true, Documents: false, Oversight: false, Setup: false });
  useEffect(() => {
    const saved = window.sessionStorage.getItem("tminus-nav-groups");
    if (saved) {
      try { setGroups((current) => ({ ...current, ...JSON.parse(saved) })); } catch { /* keep defaults */ }
    }
  }, []);
  const toggleGroup = (label: string) => setGroups((current) => {
    const next = { ...current, [label]: !current[label] };
    window.sessionStorage.setItem("tminus-nav-groups", JSON.stringify(next));
    return next;
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const openAcquisitionId = /^\/(?:files|documents\/[^/]+|forms\/[^/]+)\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const presenter = usePresenter();
  const isAdministrator = roles.includes("administrator");
  const allItems = navFor(roles);
  const items = presenter
    ? allItems.filter((item) => item.label !== "Seed status" && item.label !== "Simulate")
    : allItems;
  const navGroups = presenter ? NAV_GROUPS.filter((group) => group.label !== "Setup") : NAV_GROUPS;

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
      <header className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-chrome-structure bg-chrome px-4 py-2 text-chrome-foreground md:h-14 md:grid-cols-[minmax(0,1fr)_minmax(200px,420px)_minmax(0,auto)] md:py-0 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="rounded-lg border border-chrome-structure p-2 text-chrome-muted hover:text-chrome-foreground"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>
          <Link to="/" className="flex min-w-0 items-baseline gap-2 border-l-2 border-chrome-structure pl-3" onClick={onWordmarkClick}>
            <span className="shrink-0 text-[18px] leading-6 font-semibold text-chrome-foreground">T-Minus</span>
            <span className="hidden truncate text-[13px] text-chrome-muted xl:block">Mission Acquisition Acceleration</span>
          </Link>
        </div>
        <div className="app-chrome-search col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1"><GlobalSearch /></div>
        <div className="col-span-2 col-start-1 row-start-3 flex min-w-0 flex-wrap items-center justify-start gap-x-3 gap-y-1 md:col-span-1 md:col-start-3 md:row-start-1 md:flex-nowrap md:justify-end">
          {presenter ? null : <AnnouncementBanner />}
          <Nova acquisitionId={openAcquisitionId} />
          {isAdministrator ? (
            <button
              type="button"
              onClick={() => setPresenter(!presenter)}
              aria-pressed={presenter}
              className={cn(
                "shrink-0 rounded-lg border border-chrome-structure px-3 py-1.5 text-[13px]",
                presenter ? "text-chrome-foreground" : "text-chrome-muted",
              )}
            >
              Presenter
            </button>
          ) : null}
          {isAnonymous ? (
            <span className="rounded-lg border border-chrome-structure px-2 py-1 text-[13px] text-chrome-muted">
              Demo
            </span>
          ) : null}
          {canSwitchPersona ? (
            <>
              <label htmlFor="role-toggle" className="sr-only">Signed in as</label>
              <select
                id="role-toggle"
                value={role}
                 onChange={(e) => setRole(e.target.value as PersonaRole)}
                className="max-w-56 rounded-lg border border-chrome-structure bg-chrome px-3 py-2 text-[13px] text-chrome-foreground"
              >
                {SEEDED_USERS.map((u) => (
                  <option key={u.role} value={u.role}>
                    {u.title} — {u.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/center-config"
              hash="my-record"
              className="shrink-0 max-w-40 truncate text-[13px] text-chrome-foreground hover:text-chrome-foreground"
              title="Open my record"
            >
              {user.name}
            </Link>
            <span
              className="flex min-w-0 items-center gap-1 overflow-hidden"
              title={roles.map((assignedRole) => ROLE_LABELS[assignedRole]).join(", ")}
            >
              {roles.slice(0, 1).map((assignedRole) => (
                <span key={assignedRole} className="shrink-0 rounded-lg border border-chrome-structure px-2 py-0.5 text-[11px] text-chrome-muted">
                  {ROLE_LABELS[assignedRole]}
                </span>
              ))}
              {roles.length > 1 ? (
                <span className="shrink-0 rounded-lg border border-chrome-structure px-2 py-0.5 text-[11px] text-chrome-muted" data-numeric>
                  +{roles.length - 1}
                </span>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="shrink-0 text-[13px] text-chrome-foreground hover:text-chrome-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      <div id="urgent-announcement-slot" />

      <div className="flex">
        <nav
          aria-label="Main"
          className={cn(
            "min-h-[calc(100vh-56px)] shrink-0 border-r border-chrome-structure bg-chrome text-chrome-foreground transition-[width] duration-150 ease-out max-[1099px]:w-14",
            collapsed ? "w-14" : "w-60",
          )}
        >
          <div className="py-3">
            {navGroups.map((group) => {
              const groupItems = items.filter((item) => group.items.includes(item.label as never));
              if (!groupItems.length) return null;
              const expanded = groups[group.label] ?? false;
              return <section key={group.label} className="mb-2">
                <button type="button" onClick={() => toggleGroup(group.label)} aria-expanded={expanded} className="flex w-full items-center justify-between px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-chrome-muted max-[1099px]:sr-only">
                  <span>{group.label}</span><ChevronDown className={cn("size-3 transition-transform duration-150", expanded && "rotate-180")} />
                </button>
                <ul className={cn(!expanded && "hidden", "max-[1099px]:block")}>
                {groupItems.map((item) => {
              const active = pathname === item.to;
              const Icon = NAV_ICONS[item.label] ?? Files;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    title={item.label}
                    className={cn(
                      "flex min-h-10 items-center gap-3 border-l-[3px] px-[13px] py-2 text-[13px] transition-colors duration-150",
                      active
                        ? "border-accent-cyan font-medium text-accent-cyan"
                        : "border-transparent text-chrome-muted hover:text-chrome-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className={cn("truncate max-[1099px]:sr-only", collapsed && "sr-only")}>{item.label}</span>
                    {!collapsed && item.note ? (
                      <span className="block text-[12px] text-chrome-muted">{item.note}</span>
                    ) : null}
                  </Link>

                </li>
              );
            })}</ul></section>;
            })}
            {openAcquisitionId ? (
              <section className={cn("mx-3 mt-5 border-t border-chrome-structure pt-4", collapsed && "mx-0 border-t-0 pt-0 max-[1099px]:hidden")}>
                <p className="px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-chrome-muted">Open file</p>
                <Link
                  to="/files/$acquisitionId"
                  params={{ acquisitionId: openAcquisitionId }}
                  className="mt-2 block border-l-2 border-accent-cyan px-3 py-2 text-[13px] font-medium text-accent-cyan"
                >
                  {openAcquisitionId}
                </Link>
              </section>
            ) : null}
          </div>
        </nav>

        <div className="min-w-0 flex-1 bg-canvas">
          <main
            id="main-content"
            tabIndex={-1}
            key={pathname}
            className={cn("page-fade mx-auto px-4 py-8 sm:px-8", wide ? "max-w-[1440px]" : "max-w-[1280px]")}
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
            <PresenterScreensBeat />
            {children}
          </main>
          <footer className="border-t border-chrome-structure bg-chrome px-4 py-4 text-[13px] text-chrome-foreground sm:px-8">
            Prototype. Not an official NASA system. Viewing as {user.title}, {user.center_code}.{" "}
            <Link to="/about" className="text-chrome-foreground underline decoration-chrome-structure underline-offset-4">
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
    <div className="mb-8 border-b border-border pb-6">
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
