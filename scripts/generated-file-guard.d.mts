import type { Plugin } from "vite";
export declare const GUARDED_FILES: Readonly<Record<string, Readonly<Record<string, string>>>>;
export interface GuardResult {
  file: string;
  ok: boolean;
  sha256: string | null;
  label: string | null;
  reason: string | null;
}
export interface GuardReport {
  ok: boolean;
  results: GuardResult[];
}
export declare function sha256(bytes: Uint8Array | string): string;
export declare function checkGeneratedFiles(
  root: string,
  allowlist?: Record<string, Record<string, string>>,
): GuardReport;
export declare function formatReport(report: GuardReport, options?: { production?: boolean }): string;
export declare function generatedFileGuard(options?: {
  allowlist?: Record<string, Record<string, string>>;
  mode?: string;
}): Plugin;
