// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { generatedFileGuard } from "./scripts/generated-file-guard.mjs";

export default defineConfig({
  // Build stamp: evaluated when the deploy builds, shown on the About page.
  vite: { define: { __BUILD_STAMP__: JSON.stringify(new Date().toISOString()) } },
  // Fails the production build if a Lovable-generated Supabase file is not a reviewed version.
  // Build-only (apply: "build"); the Lovable preview dev server never runs it.
  plugins: [generatedFileGuard()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
