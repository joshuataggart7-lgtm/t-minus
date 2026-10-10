import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, LogOut, MonitorPlay, UserRound } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRole } from "@/components/role-context";
import { ROLE_LABELS, SEEDED_USERS, type PersonaRole } from "@/lib/roles";
import { usePresenter, setPresenter } from "@/lib/presenter";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split(/[\s.]+/)
    .filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("") || "?"
  ).toUpperCase();
}

const DEMO_BADGE_TIP = "Demo session: view only. Nothing is saved.";

/** The top bar's Demo badge. The tooltip says what a demo session can do. */
export function DemoBadge() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="mc-demo-badge" aria-label={`Demo. ${DEMO_BADGE_TIP}`}>
            <span className="mc-demo-badge-dot" aria-hidden="true" />
            Demo
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          {DEMO_BADGE_TIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * One account menu for the top bar: who you are, your record, the demo persona
 * switch (demo only), Presenter mode (administrators), and Sign out. It replaces
 * the native persona select, the name link, the role chip, the Presenter button,
 * the Sign out link and the small-screen account sheet. Every action is the one
 * those controls already took; nothing new is written.
 */
export function AccountMenu() {
  const { role, roles, user, setRole, isAnonymous, canSwitchPersona, signOut } = useRole();
  const presenter = usePresenter();
  const theme = useTheme();
  const navigate = useNavigate();
  const isAdministrator = roles.includes("administrator");
  const roleLabel = role ? ROLE_LABELS[role] : roles[0] ? ROLE_LABELS[roles[0]] : "Signed in";
  const persona = SEEDED_USERS.find((u) => u.role === role);

  const switchTo = (value: string) => {
    const r = value as PersonaRole;
    if (r === role) return;
    setRole(r);
    const landing = SEEDED_USERS.find((u) => u.role === r)?.landing;
    if (landing) void navigate({ to: landing });
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="mc-account-trigger"
        aria-label={`Account menu. ${user.name}, ${roleLabel}`}
      >
        <span className="mc-account-avatar" aria-hidden="true">
          {initialsOf(user.name)}
        </span>
        <span className="mc-account-who max-sm:hidden">
          <span className="mc-account-name">{user.name}</span>
          <span className="mc-account-role">
            {roleLabel}
            {!canSwitchPersona && roles.length > 1 ? ` +${roles.length - 1}` : ""}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-70 max-sm:hidden" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="mc-account-menu"
      >
        <div className="mc-account-head">
          <span className="mc-account-avatar is-lg" aria-hidden="true">
            {initialsOf(user.name)}
          </span>
          <span className="min-w-0">
            <span className="mc-account-head-name">{user.name}</span>
            <span className="mc-account-head-role">
              {canSwitchPersona && persona
                ? persona.title
                : roles.map((r) => ROLE_LABELS[r]).join(", ")}
            </span>
          </span>
        </div>
        <DropdownMenuItem
          className="mc-account-item"
          onSelect={() => void navigate({ to: "/center-config", hash: "my-record" })}
        >
          <UserRound className="size-4" aria-hidden="true" />
          My record
        </DropdownMenuItem>

        {canSwitchPersona ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="mc-account-label">View the demo as</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={role ?? ""} onValueChange={switchTo}>
              {SEEDED_USERS.map((u) => (
                <DropdownMenuPrimitive.RadioItem
                  key={u.role}
                  value={u.role}
                  className="mc-account-radio"
                >
                  <span className="mc-account-radio-mark" aria-hidden="true">
                    <DropdownMenuPrimitive.ItemIndicator>
                      <Check className="size-4" />
                    </DropdownMenuPrimitive.ItemIndicator>
                  </span>
                  <span className="min-w-0">
                    <span className="mc-account-radio-role">{ROLE_LABELS[u.role]}</span>
                    <span className="mc-account-radio-who">{u.name}</span>
                  </span>
                </DropdownMenuPrimitive.RadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        {isAdministrator ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={cn("mc-account-item", presenter && "is-on")}
              role="menuitemcheckbox"
              aria-checked={presenter}
              onSelect={() => setPresenter(!presenter)}
            >
              <MonitorPlay className="size-4" aria-hidden="true" />
              Presenter mode
              <span className="mc-account-state">{presenter ? "On" : "Off"}</span>
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="mc-account-label">Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {(
            [
              ["night", "Night", "Dark deck. The default."],
              ["day", "Day", "Light surfaces."],
            ] as const
          ).map(([value, name, note]) => (
            <DropdownMenuPrimitive.RadioItem key={value} value={value} className="mc-account-radio">
              <span className="mc-account-radio-mark" aria-hidden="true">
                <DropdownMenuPrimitive.ItemIndicator>
                  <Check className="size-4" />
                </DropdownMenuPrimitive.ItemIndicator>
              </span>
              <span className="min-w-0">
                <span className="mc-account-radio-role">{name}</span>
                <span className="mc-account-radio-who">{note}</span>
              </span>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {isAnonymous ? <p className="mc-account-note">{DEMO_BADGE_TIP}</p> : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem className="mc-account-item" onSelect={() => void signOut()}>
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
