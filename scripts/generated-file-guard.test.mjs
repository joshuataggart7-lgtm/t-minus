// Run: node --test scripts/generated-file-guard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GUARDED_FILES,
  checkGeneratedFiles,
  generatedFileGuard,
  sha256,
} from "./generated-file-guard.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAS = "src/integrations/supabase/previewAuthStorage.ts";
const CLIENT = "src/integrations/supabase/client.ts";
const V1_LINE =
  "      return request('lovable-preview-auth:set', key, value).then(() => undefined);\n";
const V2_BLOCK =
  "      return request('lovable-preview-auth:set', key, value).then((res) => {\n" +
  "        if (res && res.ok && typeof res.value === 'string' && localStorage.getItem(key) === value) {\n" +
  "          if (res.value === '') localStorage.removeItem(key);\n" +
  "          else localStorage.setItem(key, res.value);\n" +
  "        }\n" +
  "      });\n";

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "tminus-guard-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}
const real = (rel) => readFileSync(join(repoRoot, rel), "utf8");
function toV1(text) {
  return text.includes(V1_LINE) ? text : text.replace(V2_BLOCK, V1_LINE);
}
function toV2(text) {
  return toV1(text).replace(V1_LINE, V2_BLOCK);
}

test("the files in this checkout are on the allowlist", () => {
  const report = checkGeneratedFiles(repoRoot);
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
});

test("both known Lovable template versions pass", () => {
  for (const variant of [toV1, toV2]) {
    const body = variant(real(PAS));
    assert.ok(GUARDED_FILES[PAS][sha256(body)], "variant hash must be allowlisted");
    const dir = fixture({ [PAS]: body, [CLIENT]: real(CLIENT) });
    try {
      assert.equal(checkGeneratedFiles(dir).ok, true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  }
});

test("any other content fails (one extra space)", () => {
  const dir = fixture({ [PAS]: real(PAS) + " ", [CLIENT]: real(CLIENT) });
  try {
    const report = checkGeneratedFiles(dir);
    assert.equal(report.ok, false);
    assert.match(report.results.find((r) => r.file === PAS).reason, /not on the allowlist/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("a missing guarded file fails", () => {
  const dir = fixture({ [PAS]: real(PAS) });
  try {
    const report = checkGeneratedFiles(dir);
    assert.equal(report.ok, false);
    assert.equal(report.results.find((r) => r.file === CLIENT).reason, "file missing");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

function runPlugin(root, mode) {
  const plugin = generatedFileGuard();
  const calls = { error: [], warn: [] };
  plugin.configResolved({ root, mode });
  const ctx = {
    error(msg) {
      calls.error.push(msg);
      throw new Error(msg);
    },
    warn(msg) {
      calls.warn.push(msg);
    },
  };
  let threw = false;
  try {
    plugin.buildStart.call(ctx);
  } catch {
    threw = true;
  }
  return { plugin, calls, threw };
}

test("plugin: production build fails on a mismatch", () => {
  const dir = fixture({ [PAS]: real(PAS) + "// tampered\n", [CLIENT]: real(CLIENT) });
  try {
    const { calls, threw } = runPlugin(dir, "production");
    assert.equal(threw, true);
    assert.match(calls.error[0], /GENERATED FILE CHANGED: build blocked/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("plugin: development-mode build only warns", () => {
  const dir = fixture({ [PAS]: real(PAS) + "// tampered\n", [CLIENT]: real(CLIENT) });
  try {
    const { calls, threw } = runPlugin(dir, "development");
    assert.equal(threw, false);
    assert.equal(calls.warn.length, 1);
    assert.match(calls.warn[0], /would block a production build/);
    assert.doesNotMatch(calls.warn[0], /build blocked/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("plugin: never applies to the dev server (Lovable preview)", () => {
  assert.equal(generatedFileGuard().apply, "build");
});

test("plugin: production build passes on the platform v2 file", () => {
  const dir = fixture({ [PAS]: toV2(real(PAS)), [CLIENT]: real(CLIENT) });
  try {
    const { calls, threw } = runPlugin(dir, "production");
    assert.equal(threw, false);
    assert.equal(calls.error.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
