import type { PersonaRole } from "@/lib/roles";

export type CommandContext = {
  roles: PersonaRole[];
  role: PersonaRole;
  pathname: string;
  openAcquisitionId: string | null;
  presenter: boolean;
  navigate: (to: string) => void;
};

export type ShellCommand = {
  id: string;
  label: string;
  group: string;
  keywords?: string[];
  when: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext) => void;
};

export type CommandProvider = {
  id: string;
  label: string;
  group: string;
  when: (ctx: CommandContext) => boolean;
  commands: (ctx: CommandContext) => ShellCommand[];
};

const providers: CommandProvider[] = [];

export function registerCommandProvider(provider: CommandProvider) {
  const i = providers.findIndex((p) => p.id === provider.id);
  if (i >= 0) providers[i] = provider;
  else providers.push(provider);
}

export function listCommandProviders(): readonly CommandProvider[] {
  return providers.slice();
}

export function matchCommands(
  ctx: CommandContext,
  query: string,
  options: { providers?: readonly CommandProvider[]; limit?: number } = {},
): ShellCommand[] {
  const needle = query.trim().toLowerCase();
  const source = options.providers ?? providers;
  const limit = options.limit ?? 8;
  const out: ShellCommand[] = [];
  for (const p of source) {
    if (!p.when(ctx)) continue;
    for (const c of p.commands(ctx)) {
      if (!c.when(ctx)) continue;
      const text = [c.label, ...(c.keywords ?? [])].join(" ").toLowerCase();
      if (needle && !text.includes(needle)) continue;
      out.push(c);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
