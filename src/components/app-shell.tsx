import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EVALUATOR_PATHS, isEvaluatorOnly, SEEDED_USERS } from "@/lib/roles";
import { AccountMenu, DemoBadge } from "@/components/account-menu";
import { sidebarNavGroups } from "@/components/commands/sidebar-nav";
import { useRole } from "@/components/role-context";
import { Orby } from "@/components/orby";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GlobalSearch } from "@/components/global-search";
import { Nova } from "@/components/nova";
import { PresenterScreensBeat } from "@/components/presenter-screens-beat";
import { usePresenter } from "@/lib/presenter";
import { useTriggerConfig } from "@/lib/use-trigger-config";

import { cn } from "@/lib/utils";
import {
  BarChart3, BookOpenCheck, Building2, Calculator, CalendarClock, ChevronDown,
  CircleCheckBig, ClipboardCheck, Database, FilePlus2, FolderOpen, Gauge, History,
  Inbox, Layers, LayoutTemplate, Megaphone, Newspaper, PanelLeft, Radar, Rocket,
  ScrollText, Search, Send, ShieldAlert, ShieldCheck, SlidersHorizontal, TriangleAlert, X,
  type LucideIcon,
} from "lucide-react";

/** Initials for the mobile account button: "J. Rivera (fictional CO)" reads "JR". */
// Icons are chosen so the meaning reads at a glance beside the label.
const NAV_ICONS: Record<string, LucideIcon> = {
  "Executive Overview": Rocket, Today: CalendarClock, "Reviewer inbox": Inbox,
  "Requester portal": Send, "Work Queue": ClipboardCheck, Files: FolderOpen,
  Intake: FilePlus2, Estimate: Calculator, Templates: LayoutTemplate,
  Checks: CircleCheckBig, Deviations: ShieldAlert, "Audit Log": History,
  Watch: Radar, "Directive compliance": ShieldCheck, "Clause changes": BookOpenCheck,
  Escalations: TriangleAlert, "Leadership digest": Newspaper,
  "Reporting views": BarChart3, Simulate: Gauge, "Center configuration": Building2,
  Announcements: Megaphone, "Seed status": Database,
  "Regulatory data intake": ScrollText, "PGPD queue": Layers,
  Configuration: SlidersHorizontal,
};

// Survives route remounts so the click run isn't reset by navigation.
const wordmarkClicks = { current: { count: 0, at: 0, acq: null as string | null } };
// Survives route remounts so drawer navigation can move focus into the new page.
const drawerNavFocus = { pending: false, at: 0 };

/**
 * kit: pages moved onto the design kit (components/ui-mc) use the wide-screen
 * width, up to 1760px, so 1920 screens carry content instead of gutters.
 */
export function AppShell({ children, wide = false, overviewMode = false, kit = false }: { children: ReactNode; wide?: boolean; overviewMode?: boolean; kit?: boolean }) {

  const { role, roles, user, setRole, authMessage, isAnonymous, canSwitchPersona, profile, authState, readOnly } = useRole();
  useTriggerConfig();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Below 640px the header keeps one row: search opens on demand and the
  // account controls live in the account menu.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isDrawerViewport, setIsDrawerViewport] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef(false);
  const [groups, setGroups] = useState<Record<string, boolean>>({ Work: true, Documents: false, Oversight: false, Setup: false });
  useEffect(() => {
    const saved = window.sessionStorage.getItem("tminus-nav-groups");
    if (saved) {
      try { setGroups((current) => ({ ...current, ...JSON.parse(saved) })); } catch { /* keep defaults */ }
    }
  }, []);
  // Groups opened because the current page lives there are held in memory only.
  const [autoOpen, setAutoOpen] = useState<string | null>(null);
  const toggleGroup = (label: string) => {
    const isOpen = Boolean(groups[label]) || autoOpen === label;
    if (autoOpen === label) setAutoOpen(null);
    setGroups((current) => {
      const next = { ...current, [label]: !isOpen };
      window.sessionStorage.setItem("tminus-nav-groups", JSON.stringify(next));
      return next;
    });
  };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const locationHref = useRouterState({ select: (s) => s.location.href });
  const navigate = useNavigate();

  // Demo only: ?as=<role> opens that persona's home. Runs again whenever the
  // address changes, so a link clicked inside the app switches too. Never runs
  // for a real account.
  useEffect(() => {
    if (!canSwitchPersona) return;
    const as = new URL(locationHref, window.location.origin).searchParams.get("as");
    const match = SEEDED_USERS.find((u) => u.role === as);
    if (!match) return;
    setRole(match.role);
    const query = new URL(locationHref, window.location.origin).searchParams;
    if (pathname !== match.landing || query.has("as")) {
      void navigate({ to: match.landing, replace: true });
    }
  }, [canSwitchPersona, locationHref]); // eslint-disable-line react-hooks/exhaustive-deps
  // An evaluator-only session never gets the open-file entry: file pages are
  // outside the evaluation workspace. Everyone else keeps it.
  const openAcquisitionId = isEvaluatorOnly(roles)
    ? null
    : (/^\/(?:files|documents\/[^/]+|forms\/[^/]+)\/([^/]+)/.exec(pathname)?.[1] ?? null);
  const presenter = usePresenter();
  const navGroups = sidebarNavGroups(roles, presenter, readOnly);
  // An evaluator sees the evaluation workspace and announcements only; any
  // other page shows a short notice instead of its content. No search, no
  // assistant. Display boundary for the demo persona; permissions unchanged.
  const evaluatorOnly = isEvaluatorOnly(roles);
  const evaluatorBlocked =
    evaluatorOnly && pathname !== "/about" && !(EVALUATOR_PATHS as readonly string[]).includes(pathname);
  const activeGroupLabel = navGroups.find((group) =>
    group.items.some((item) => pathname === item.to || (item.to === "/overview" && pathname === "/")),
  )?.label;
  const rolesReady = authState === "signed-in" && (isAnonymous || profile !== null);
  useEffect(() => {
    if (rolesReady && activeGroupLabel && !groups[activeGroupLabel]) setAutoOpen(activeGroupLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeGroupLabel, rolesReady]);
  const railCollapsed = collapsed && !isDrawerViewport;
  // A short menu (a narrow persona) shows every group open, so no group
  // heading ever looks empty.
  const shortNav = navGroups.reduce((n, group) => n + group.items.length, 0) <= 6;
  const backgroundInert = drawerOpen && isDrawerViewport;
  const inertProps = backgroundInert ? { inert: true } : {};

  useEffect(() => {
    if (!drawerNavFocus.pending) return;
    const recent = Date.now() - drawerNavFocus.at < 3000;
    drawerNavFocus.pending = false;
    if (!recent) return;
    window.requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>("#main-content");
      const heading = main?.querySelector<HTMLElement>("h1");
      if (heading) {
        if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
        heading.focus();
        return;
      }
      main?.focus();
    });
  }, []);

  const closeDrawer = useCallback(() => {
    restoreFocusRef.current = true;
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (drawerOpen || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, [drawerOpen]);

  // Desktop rail is sticky under the header; the header wraps below xl, so its
  // live height feeds the CSS variable the rail's top/height use.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const setHeaderH = () => {
      document.documentElement.style.setProperty("--app-header-h", `${header.offsetHeight}px`);
    };
    setHeaderH();
    const observer = new ResizeObserver(setHeaderH);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023.98px)");
    const syncViewport = () => {
      setIsDrawerViewport(query.matches);
      if (!query.matches && drawerOpen) closeDrawer();
    };
    syncViewport();
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    if (drawerOpen) closeDrawer();
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeDrawer();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || !isDrawerViewport) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusable = () => Array.from(drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    drawer.addEventListener("keydown", trapFocus);
    return () => drawer.removeEventListener("keydown", trapFocus);
  }, [drawerOpen, isDrawerViewport]);

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
    <div className={cn("min-h-screen bg-canvas text-foreground", overviewMode && "mc-overview-shell")}>
      <a
        {...inertProps}
        href="#main-content"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      <header ref={headerRef} {...inertProps} className="chrome-surface sticky top-0 z-30 grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-chrome-structure px-4 py-2 text-chrome-foreground xl:h-14 xl:grid-cols-[minmax(0,1fr)_minmax(200px,420px)_minmax(0,auto)] xl:py-0 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => isDrawerViewport ? setDrawerOpen((open) => !open) : setCollapsed((c) => !c)}
            aria-label={isDrawerViewport ? (drawerOpen ? "Close navigation" : "Open navigation") : (collapsed ? "Expand navigation" : "Collapse navigation")}
            aria-expanded={isDrawerViewport ? drawerOpen : undefined}
            aria-controls={isDrawerViewport ? "main-navigation" : undefined}
            className="rounded-lg border border-chrome-structure p-2 text-chrome-muted hover:text-chrome-foreground"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>
          <a
            href="/"
            className="flex min-w-0 items-baseline gap-2 border-l-2 border-chrome-structure pl-3"
            onClick={(event) => {
              onWordmarkClick(event);
              if (
                !event.defaultPrevented &&
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                void navigate({ to: "/" });
              }
            }}
          >
            <span className="shrink-0 type-heading font-semibold text-chrome-foreground">T-Minus</span>
            <span className="hidden truncate type-meta text-chrome-muted min-[1440px]:block" title="Mission Acquisition Acceleration">Mission Acquisition Acceleration</span>
          </a>
        </div>
        <div className={cn("app-chrome-search col-span-2 row-start-2 min-w-0 xl:col-span-1 xl:col-start-2 xl:row-start-1", mobileSearchOpen ? "" : "max-sm:hidden")}>{evaluatorOnly ? null : <GlobalSearch />}</div>
        <div className="col-span-2 col-start-1 row-start-3 flex min-w-0 flex-wrap items-center justify-start gap-x-2 gap-y-1 max-sm:col-span-1 max-sm:col-start-2 max-sm:row-start-1 max-sm:flex-nowrap max-sm:justify-end xl:col-span-1 xl:col-start-3 xl:row-start-1 xl:flex-nowrap xl:justify-end min-[1440px]:gap-x-3">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label={mobileSearchOpen ? "Close search" : "Search"}
            aria-expanded={mobileSearchOpen}
            className="grid size-9 place-items-center rounded-lg text-chrome-muted hover:text-chrome-foreground sm:hidden"
          >
            <Search className="size-[18px]" aria-hidden="true" />
          </button>
          {presenter ? null : <AnnouncementBanner />}
          {evaluatorOnly ? null : <div className="contents max-sm:hidden"><Nova acquisitionId={openAcquisitionId} /></div>}
          {isAnonymous ? <DemoBadge /> : null}
          <AccountMenu />
        </div>
      </header>


       <div id="urgent-announcement-slot" {...inertProps} />

      <div className="relative flex max-lg:block">
        {/* The rail's dark column runs the full height of the page, so a long
            page never shows canvas under the sticky navigation. */}
        <div
          aria-hidden="true"
          className={cn(
            "chrome-rail pointer-events-none absolute inset-y-0 left-0 hidden border-r border-chrome-structure lg:block",
            collapsed ? "w-14" : "w-60",
          )}
        />
        {drawerOpen ? (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
            onClick={closeDrawer}
          />
        ) : null}
        <nav
          ref={drawerRef}
          id="main-navigation"
          aria-label="Main"
          aria-hidden={isDrawerViewport && !drawerOpen ? true : undefined}
          className={cn(
            "chrome-rail min-h-[calc(100vh-56px)] shrink-0 border-r border-chrome-structure text-chrome-foreground transition-[width] duration-150 ease-out max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-72 max-lg:max-w-[85vw] max-lg:overflow-y-auto lg:sticky lg:top-[var(--app-header-h,56px)] lg:self-start lg:h-[calc(100vh-var(--app-header-h,56px))] lg:min-h-0 lg:overflow-y-auto",
            !drawerOpen && "max-lg:hidden",
            collapsed ? "lg:w-14" : "lg:w-60",
          )}
        >
          <div className="py-3">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={closeDrawer}
              className="ml-auto mr-3 flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-chrome-structure text-chrome-muted hover:text-chrome-foreground lg:hidden"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            {navGroups.map((group) => {
              const groupItems = group.items;
              const expanded = shortNav || Boolean(groups[group.label]) || autoOpen === group.label;
              return <section key={group.label} className="mb-2">
                {shortNav ? (
                  <p className={cn("px-4 py-2 type-label text-chrome-muted", railCollapsed && "sr-only")}>{group.label}</p>
                ) : (
                  <button type="button" onClick={() => toggleGroup(group.label)} aria-expanded={expanded} className={cn("flex w-full items-center justify-between px-4 py-2 type-label text-chrome-muted", railCollapsed && "sr-only")}>
                    <span>{group.label}</span><ChevronDown className={cn("size-3 transition-transform duration-150", expanded && "rotate-180")} />
                  </button>
                )}
                <ul className={cn(!expanded && "hidden", railCollapsed && "block")}>
                {groupItems.map((item) => {
              const active = pathname === item.to || (item.to === "/overview" && pathname === "/");
              const Icon = NAV_ICONS[item.label] ?? FolderOpen;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    title={item.label}
                    activeOptions={{ exact: true }}
                     aria-current={active ? "page" : undefined}
                     onClick={() => {
                       if (isDrawerViewport && drawerOpen) {
                         if (item.to === pathname) {
                           closeDrawer();
                         } else {
                           restoreFocusRef.current = false;
                           drawerNavFocus.pending = true;
                           drawerNavFocus.at = Date.now();
                         }
                       }
                     }}
                    className={cn(
                      "nav-label group relative flex min-h-10 items-center gap-3 border-l-[3px] px-[13px] py-2 type-meta transition-colors duration-150",
                      active
                        ? "border-accent-cyan bg-[color:color-mix(in_oklab,var(--accent-cyan)_12%,transparent)] font-semibold text-accent-cyan"
                        : "border-transparent text-chrome-muted hover:bg-white/[0.04] hover:text-chrome-foreground",
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", active ? "text-accent-cyan" : "text-chrome-muted group-hover:text-chrome-foreground")} aria-hidden="true" />
                    <span className={cn("truncate", railCollapsed && "sr-only")}>{item.label}</span>
                    {!railCollapsed && item.note ? (
                      <span className="block text-[12px] text-chrome-muted">{item.note}</span>
                    ) : null}
                  </Link>

                </li>
              );
            })}</ul></section>;
            })}
            {openAcquisitionId ? (
              <section className={cn("mx-3 mt-5 border-t border-chrome-structure pt-4", railCollapsed && "mx-0 border-t-0 pt-0")}>
                <p className={cn("px-1 type-label text-chrome-muted", railCollapsed && "sr-only")}>Open file</p>
                <Link
                  to="/files/$acquisitionId"
                  params={{ acquisitionId: openAcquisitionId }}
                   onClick={() => {
                     if (isDrawerViewport && drawerOpen) {
                       if (`/files/${openAcquisitionId}` === pathname) {
                         closeDrawer();
                       } else {
                         restoreFocusRef.current = false;
                         drawerNavFocus.pending = true;
                         drawerNavFocus.at = Date.now();
                       }
                     }
                   }}
                   title={railCollapsed ? openAcquisitionId : undefined}
                     aria-current={openAcquisitionId && /^\/files\/[^/]+$/.test(pathname) ? "page" : openAcquisitionId && /^\/(?:documents|forms)\/[^/]+\/[^/]+$/.test(pathname) ? "true" : undefined}
                   aria-label={railCollapsed ? `Open file ${openAcquisitionId}` : undefined}
                   className={cn(
                     "mt-2 block border-l-2 border-accent-cyan bg-[color:color-mix(in_oklab,var(--accent-cyan)_10%,transparent)] font-medium text-accent-cyan [font-variant-numeric:tabular-nums]",
                     railCollapsed ? "truncate px-1 text-[11px]" : "px-3 py-2 type-meta",
                   )}
                >
                  {openAcquisitionId}
                </Link>
              </section>
            ) : null}
          </div>
        </nav>

        <div {...inertProps} className="min-w-0 flex-1 bg-canvas max-lg:w-full">
          <main
            id="main-content"
            tabIndex={-1}
            key={pathname}
            className={cn("page-fade mx-auto px-4 py-8 sm:px-8", kit ? "max-w-[1760px]" : wide ? "max-w-[1440px]" : "max-w-[1280px]")}
          >
            {authMessage ? (
              <p
                role="status"
                className="mb-6 border-l-2 py-1 pl-3 type-meta"
                style={{ borderColor: "var(--attention)", color: "var(--attention)" }}
              >
                Needs attention: {authMessage}
              </p>
            ) : null}
            <PresenterScreensBeat />
            {evaluatorBlocked ? <EvaluatorBoundary /> : children}
          </main>
        </div>

      </div>

      <footer {...inertProps} className="chrome-surface relative border-t-2 border-chrome-structure px-4 py-4 type-meta text-chrome-foreground sm:px-8">
        Prototype built for NASA by a NASA employee. Not an official NASA system. Viewing as {user.title === user.center_code ? user.title : `${user.title}, ${user.center_code}`}.{" "}
        <Link to="/about" className="text-chrome-foreground underline decoration-chrome-structure underline-offset-4">
          About T-Minus
        </Link>
      </footer>

      {orbyFor ? (
        <Orby key={orbyFor.key} acquisitionId={orbyFor.id} onDone={() => setOrbyFor(null)} />
      ) : null}
    </div>

  );
}

export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-8 border-b border-border pb-6">
      <span aria-hidden="true" className="mb-3 block h-[3px] w-10 rounded-sm bg-primary" />
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

/**
 * The loading line. With a layout it draws neutral placeholders at the page's
 * real widths instead, and keeps the same words for screen readers only.
 */
export function LoadingNote({ what, layout }: { what: string; layout?: "cards" | "table" }) {
  if (!layout) {
    return (
      <p role="status" className="text-muted-foreground">
        Loading {what}.
      </p>
    );
  }
  return (
    <div className="min-w-0">
      <p role="status" aria-live="polite" className="sr-only">
        Loading {what}.
      </p>
      {layout === "cards" ? (
        <ul aria-hidden="true" className="grid min-w-0 gap-4">
          {[0, 1, 2].map((i) => (
            <li key={i} className="min-w-0 rounded-[var(--mc-radius-control)] border border-border bg-background p-5">
              <span className="block h-4 w-2/5 animate-pulse rounded-sm bg-muted" />
              <span className="mt-3 block h-3 w-4/5 animate-pulse rounded-sm bg-muted" />
              <span className="mt-2 block h-3 w-3/5 animate-pulse rounded-sm bg-muted" />
            </li>
          ))}
        </ul>
      ) : (
        <div aria-hidden="true" className="min-w-0 border-t border-border">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-4 border-b border-border px-3 py-3">
              <span className="block h-3 w-3/4 animate-pulse rounded-sm bg-muted" />
              <span className="block h-3 w-5/6 animate-pulse rounded-sm bg-muted" />
              <span className="block h-3 w-1/2 animate-pulse rounded-sm bg-muted" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The file page frame while the record loads: the ID from the route, a title
 * bar, the summary card with the countdown box outlined, and three collapsed
 * section headers, at the real widths so nothing jumps when data arrives.
 */
export function FilePageSkeleton({ acquisitionId }: { acquisitionId: string }) {
  return (
    <div className="min-w-0">
      <p role="status" aria-live="polite" className="sr-only">
        Loading the acquisition file.
      </p>
      <div className="mb-2 grid min-w-0 gap-6 min-[1440px]:grid-cols-[200px_minmax(0,1fr)] min-[1440px]:gap-8">
        <aside aria-hidden="true" className="hidden min-[1440px]:block">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="mb-3 block h-3 w-3/4 animate-pulse rounded-sm bg-muted" />
          ))}
        </aside>
        <div className="min-w-0">
          <section className="mb-10 min-w-0 rounded-[var(--mc-radius-control)] border border-border bg-background p-7 lg:p-10">
            <div className="grid min-w-0 gap-10 min-[1440px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] min-[1440px]:items-start min-[1440px]:gap-12">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-primary" data-numeric>{acquisitionId}</p>
                <span aria-hidden="true" className="mt-3 block h-7 w-3/4 animate-pulse rounded-sm bg-muted" />
                <span aria-hidden="true" className="mt-3 block h-4 w-1/2 animate-pulse rounded-sm bg-muted" />
                <span aria-hidden="true" className="mt-4 block h-4 w-11/12 animate-pulse rounded-sm bg-muted" />
              </div>
              <div aria-hidden="true" className="min-w-0 border-t border-border pt-7 min-[1440px]:border-l min-[1440px]:border-t-0 min-[1440px]:pl-10 min-[1440px]:pt-0">
                <div className="h-32 min-w-0 rounded-[var(--mc-radius-control)] border border-dashed border-border" />
              </div>
            </div>
          </section>
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden="true" className="mb-3 min-w-0 border-y border-border px-3 py-3">
              <span className="block h-4 w-1/3 animate-pulse rounded-sm bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
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
    <div className="surface-raised rounded-lg border border-border p-6">
      <p className="text-muted-foreground">{note}</p>
    </div>
  );
}

/** What an evaluator sees on any page outside the evaluation workspace. */
function EvaluatorBoundary() {
  return (
    <section className="mc-eval-boundary" aria-labelledby="eval-boundary-title">
      <h1 id="eval-boundary-title" className="mc-page-header-title">
        This page is outside the evaluation workspace
      </h1>
      <p className="max-w-[72ch] text-[15px] leading-[22px]">
        An evaluator sees the quotations assigned for evaluation, the evaluation factors, the worksheet and the status of
        the evaluator statements. Prices, other files and source selection records stay with the contracting officer.
      </p>
      <p className="mt-4">
        <Link to="/evaluator" className="text-primary underline underline-offset-4">
          Go to the evaluation workspace
        </Link>
      </p>
    </section>
  );
}
