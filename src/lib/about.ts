import buildNotes from "../../BUILD_NOTES.md?raw";
import { supabase } from "@/integrations/supabase/client";

/**
 * About page data.
 *
 * The feature list is maintained in BUILD_NOTES.md between the
 * feature-status markers and read here at build time. Templates come from the
 * templates table. Data source dates come from the seed and from
 * regulatory_refs. Nothing here is invented at runtime.
 */

export type FeatureStatus = "live" | "next" | "planned" | "not built";

export type Feature = { status: FeatureStatus; name: string; note: string };

export const FEATURE_ORDER: FeatureStatus[] = ["live", "next", "planned", "not built"];

export const FEATURE_HEADING: Record<FeatureStatus, string> = {
  live: "Live now",
  next: "Built next",
  planned: "Planned",
  "not built": "Not built, and not intended to be",
};

/** Reads the maintained list out of BUILD_NOTES.md. */
export function features(): Feature[] {
  const block = /<!-- feature-status:start -->([\s\S]*?)<!-- feature-status:end -->/.exec(buildNotes);
  if (!block) return [];
  const out: Feature[] = [];
  for (const line of (block[1] ?? "").split("\n")) {
    const m = /^-\s*(live|next|planned|not built)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$/.exec(line.trim());
    if (m) out.push({ status: m[1] as FeatureStatus, name: m[2] ?? "", note: m[3] ?? "" });
  }
  return out;
}

export type TemplateRow = {
  template_id: string;
  name: string;
  status: string | null;
  nf_1098_tab: string | null;
  hq_revision_date: string | null;
  governing_citation: string | null;
};

export type RefRow = {
  citation: string;
  title: string | null;
  tier: string | null;
  source: string | null;
  effective_date: string | null;
  url: string | null;
};

/** The dated sources the build was loaded from, as recorded in the seed. */
export const SEED_SOURCES: { name: string; asOf: string }[] = [
  { name: "NFS interim rule", asOf: "July 23, 2026" },
  { name: "NFS Companion Guide", asOf: "August 5, 2026" },
  { name: "PCD 26-03B clause matrix", asOf: "June 25, 2026" },
  { name: "NFS applicability matrix", asOf: "July 23, 2026" },
  { name: "OP template list", asOf: "September 10, 2026" },
  { name: "Thresholds", asOf: "verified September 11, 2026" },
];

/** The external feeds T-Minus reads, all of them server side. */
export const LIVE_FEEDS: { name: string; note: string }[] = [
  { name: "SAM.gov Entity Management", note: "Vendor registration, CAGE, small business status, reps and certs." },
  { name: "SAM.gov Exclusions", note: "Nightly sweep of every vendor on an open file." },
  { name: "SAM.gov Contract Awards", note: "Comparable prior awards and the agency backfill." },
  { name: "GAO recent decisions", note: "Protest decisions on Watch. Decision text is never stored." },
  { name: "Federal Register", note: "FAR and NFS rulemaking on Watch." },
];

export async function loadAboutData() {
  const [tpl, refs] = await Promise.all([
    supabase
      .from("templates")
      .select("template_id,name,status,nf_1098_tab,hq_revision_date,governing_citation")
      .order("name"),
    supabase
      .from("regulatory_refs")
      .select("citation,title,tier,source,effective_date,url")
      .order("effective_date", { ascending: false }),
  ]);
  if (tpl.error) throw new Error(tpl.error.message);
  if (refs.error) throw new Error(refs.error.message);
  return {
    templates: (tpl.data ?? []) as unknown as TemplateRow[],
    refs: (refs.data ?? []) as unknown as RefRow[],
  };
}

/** Live templates first, then everything the list carries but does not render yet. */
export function templateGroups(rows: TemplateRow[]) {
  const isLive = (r: TemplateRow) => /live/i.test(r.status ?? "");
  return { live: rows.filter(isLive), listed: rows.filter((r) => !isLive(r)) };
}

/** The build stamp is set at deploy time in vite.config.ts. */
export function buildStamp(): string {
  const stamp = (globalThis as { __BUILD_STAMP__?: string }).__BUILD_STAMP__;
  const raw = typeof stamp === "string" ? stamp : "";
  if (!raw) return "not recorded";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toUTCString().replace("GMT", "UTC");
}
