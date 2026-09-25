import { registerCommandProvider } from "./command-registry";
import { sidebarNavGroups } from "./sidebar-nav";

registerCommandProvider({
  id: "navigation",
  label: "Pages",
  group: "Go to",
  when: () => true,
  commands: (ctx) =>
    sidebarNavGroups(ctx.roles, ctx.presenter).flatMap((group) =>
      group.items.map((item) => ({
        id: `nav:${item.to}`,
        label: item.label,
        group: "Go to",
        when: () => true,
        run: (c) => c.navigate(item.to),
      })),
    ),
});

registerCommandProvider({
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
});
