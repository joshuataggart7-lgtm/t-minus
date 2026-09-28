// T-Minus build guard for Lovable-generated Supabase integration files.
//
// Lovable's platform rewrites src/integrations/supabase/previewAuthStorage.ts
// to its current template at the start of agent turns. This guard makes the
// production build FAIL unless every guarded file is byte-identical to a
// reviewed, allowlisted version (SHA-256 of the raw bytes).
//
// - Runs only for `vite build` (apply: "build"); the Lovable preview dev server
//   (`vite dev`) never loads it, so preview keeps working.
// - mode "production" (the publish build): mismatch => build error.
//   Any other mode (e.g. `vite build --mode development`): mismatch => warning.
// - To accept a new platform version: review the diff, then add its SHA-256
//   and a one-line label below in a separate, CoS/Josh-approved send.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const GUARDED_FILES = Object.freeze({
  "src/integrations/supabase/previewAuthStorage.ts": Object.freeze({
    "634c0f279327b7c79f6e38b54b7ab4ae3737f0d6c3a660d8ac02a9659be48a0f":
      "Lovable template v1 (git blob c335f2ba): setItem ends .then(() => undefined)",
    c11f61a80071f876a237b06f902f5e278283044e7202d28b33b8341b9fceafa2:
      "Lovable template v2 (git blob 98c7cb6f): setItem adopts the editor broker reply; platform auto-commit since 25 Sep 2026",
  }),
  "src/integrations/supabase/client.ts": Object.freeze({
    "73d6ad070395aa318e2667a7194b63008399a2a1f86664c8a62633b357296d6b":
      "Lovable generated client (git blob 3f8bc8f9), unchanged since 11 Sep 2026",
  }),
});

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function checkGeneratedFiles(root, allowlist = GUARDED_FILES) {
  const results = Object.entries(allowlist).map(([file, allowed]) => {
    const abs = resolve(root, file);
    if (!existsSync(abs))
      return { file, ok: false, sha256: null, label: null, reason: "file missing" };
    const hash = sha256(readFileSync(abs));
    const label = Object.prototype.hasOwnProperty.call(allowed, hash) ? allowed[hash] : null;
    return {
      file,
      ok: label !== null,
      sha256: hash,
      label,
      reason: label ? null : "SHA-256 not on the allowlist",
    };
  });
  return { ok: results.every((r) => r.ok), results };
}

export function formatReport(report) {
  const lines = report.results.map((r) =>
    r.ok
      ? `  OK   ${r.file}  ${r.sha256.slice(0, 12)}…  (${r.label})`
      : `  FAIL ${r.file}  ${r.sha256 ?? "-"}  (${r.reason})`,
  );
  return [
    report.ok
      ? "[tminus-generated-file-guard] generated files match the allowlist"
      : "[tminus-generated-file-guard] GENERATED FILE CHANGED: build blocked. " +
        "A Lovable-generated integration file is not a reviewed version. Do not publish. " +
        "Restore the file from the last accepted tip, or review the diff and add its SHA-256 to scripts/generated-file-guard.mjs in an approved send.",
    ...lines,
  ].join("\n");
}

export function generatedFileGuard(options = {}) {
  const allowlist = options.allowlist ?? GUARDED_FILES;
  let root = process.cwd();
  let failHard = true;
  let report = null;
  return {
    name: "tminus-generated-file-guard",
    apply: "build",
    enforce: "pre",
    configResolved(config) {
      root = config.root ?? root;
      failHard = (options.mode ?? config.mode) === "production";
    },
    buildStart() {
      report = checkGeneratedFiles(root, allowlist);
      const text = formatReport(report);
      if (report.ok) {
        console.log(text);
      } else if (failHard) {
        this.error(text);
      } else {
        this.warn(text);
      }
    },
    generateBundle() {
      // Publish a small manifest with the client assets so post-deploy QA can
      // confirm which reviewed versions were built. Client environment only.
      const envName = this.environment?.name;
      if (!report || (envName && envName !== "client")) return;
      this.emitFile({
        type: "asset",
        fileName: "tminus-integrity.json",
        source: JSON.stringify(
          {
            guard: "tminus-generated-file-guard",
            ok: report.ok,
            files: report.results.map(({ file, sha256: h, label }) => ({ file, sha256: h, label })),
          },
          null,
          2,
        ),
      });
    },
  };
}
