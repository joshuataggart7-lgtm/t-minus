import type { CommandProvider } from "./command-registry";
import { sidebarNavGroups } from "./sidebar-nav";

const navigationProvider: CommandProvider = {
  id: "navigation",
  label: "Pages",
  group: "Pages",
  when: () => true,
  commands: (ctx) =>
    sidebarNavGroups(ctx.roles, ctx.presenter).flatMap((group) =>
      group.items.map((item) => ({
        id: `nav:${item.to}`,
        label: `Go to ${item.label}`,
        group: "Pages",
        keywords: [item.label, `go to ${item.label}`],
        when: () => true,
        run: (c) => c.navigate(item.to),
      })),
    ),
};

const openFileProvider: CommandProvider = {
  id: "open-file",
  label: "Current file",
  group: "Current file",
  when: (ctx) => Boolean(ctx.openAcquisitionId),
  commands: (ctx) =>
    ctx.openAcquisitionId
      ? [
          {
            id: `open-file:${ctx.openAcquisitionId}`,
            label: `Open file ${ctx.openAcquisitionId}`,
            group: "Current file",
            when: (c) => Boolean(c.openAcquisitionId),
            run: (c) => c.navigate(`/files/${c.openAcquisitionId}`),
          },
        ]
      : [],
};

export const SHELL_COMMAND_PROVIDERS: CommandProvider[] = [navigationProvider, openFileProvider];
