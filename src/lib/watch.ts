/**
 * Watch: GAO bid protest decisions, Federal Register documents, PCDs/PICs/PNs
 * from regulatory_refs, and OP notices entered by HQ.
 *
 * Shared shapes and the "newer guidance published" match used by template badges.
 */
import { supabase } from "@/integrations/supabase/client";

export const WATCH_SOURCES = ["GAO", "Federal Register", "PCD/PIC/PN", "OP notice"] as const;
export type WatchSource = (typeof WATCH_SOURCES)[number];

export type WatchItemRow = {
  item_id: string;
  source: string | null;
  external_id: string | null;
  title: string | null;
  decided_or_published_date: string | null;
  outcome_or_type: string | null;
  agency: string | null;
  url: string | null;
  summary: string | null;
  fetched_at: string | null;
  tags: string[] | null;
};

export type RegRefRow = {
  ref_id: string;
  citation: string;
  title: string | null;
  tier: string | null;
  source: string | null;
  effective_date: string | null;
  far_part: string | null;
  nfs_part: string | null;
  url: string | null;
};

/** One row of the feed, whatever table it came from. */
export type FeedItem = {
  id: string;
  source: WatchSource;
  title: string;
  date: string | null;
  outcomeOrType: string;
  summary: string;
  url: string | null;
  tags: string[];
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Accepts 2026-04-27, 4/27/2026, and "April 27, 2026". Returns an ISO date or null. */
export function toISODate(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[1]!.padStart(2, "0")}-${slash[2]!.padStart(2, "0")}`;
  const words = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (words) {
    const month = MONTHS.indexOf(words[1]!.toLowerCase());
    if (month >= 0) return `${words[3]}-${String(month + 1).padStart(2, "0")}-${words[2]!.padStart(2, "0")}`;
  }
  return null;
}

/** FAR and NFS parts named anywhere in a piece of text, as tags such as "FAR 6" and "NFS 1806". */
export function partTags(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  const all = texts.filter(Boolean).join(" ");
  for (const m of all.matchAll(/\bNFS(?:\s+CG)?\s+(?:part\s+)?(18\d{2})/gi)) found.add(`NFS ${m[1]}`);
  for (const m of all.matchAll(/\bFAR\s+(?:part\s+|subpart\s+)?(\d{1,2})(?:\.\d+)?/gi)) found.add(`FAR ${Number(m[1])}`);
  return [...found].sort();
}

export function refTags(ref: RegRefRow): string[] {
  const tags = new Set(partTags(ref.citation, ref.title));
  if (ref.far_part) tags.add(`FAR ${Number(ref.far_part)}`);
  if (ref.nfs_part) tags.add(`NFS ${ref.nfs_part}`);
  if (ref.source) tags.add(ref.source);
  return [...tags];
}

function normalizeSource(value: string | null): WatchSource {
  const s = (value ?? "").toLowerCase();
  if (s.includes("gao")) return "GAO";
  if (s.includes("federal register")) return "Federal Register";
  if (s.includes("pcd") || s.includes("pic") || s.includes("pn")) return "PCD/PIC/PN";
  return "OP notice";
}

export function itemsFromWatchRows(rows: WatchItemRow[]): FeedItem[] {
  return rows.map((r) => ({
    id: r.item_id,
    source: normalizeSource(r.source),
    title: r.title ?? "Untitled item",
    date: toISODate(r.decided_or_published_date),
    outcomeOrType: r.outcome_or_type ?? "—",
    summary: r.summary ?? "",
    url: r.url,
    tags: r.tags ?? [],
  }));
}

export function itemsFromRefs(refs: RegRefRow[]): FeedItem[] {
  return refs
    .filter((r) => ["PCD", "PIC", "PN", "OP", "OP Guide", "Companion Guide"].includes(r.source ?? ""))
    .map((r) => ({
      id: `ref:${r.ref_id}`,
      source: (r.source === "PCD" || r.source === "PIC" || r.source === "PN"
        ? "PCD/PIC/PN"
        : "OP notice") as WatchSource,
      title: `${r.citation} — ${r.title ?? ""}`.replace(/ — $/, ""),
      date: toISODate(r.effective_date),
      outcomeOrType: r.tier === "binding" ? "Binding" : "Guidance",
      summary: r.title ?? "",
      url: r.url,
      tags: refTags(r),
    }));
}

export function sortNewestFirst(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function withinDays(item: FeedItem, days: number, today = new Date()): boolean {
  if (!item.date) return false;
  const ms = today.getTime() - new Date(`${item.date}T00:00:00Z`).getTime();
  return ms >= 0 && ms <= days * 86400000;
}

export async function loadWatchRows(): Promise<WatchItemRow[]> {
  const { data, error } = await supabase
    .from("watch_items")
    .select("*")
    .order("decided_or_published_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WatchItemRow[];
}

export async function loadRegRefs(): Promise<RegRefRow[]> {
  const { data, error } = await supabase
    .from("regulatory_refs")
    .select("ref_id,citation,title,tier,source,effective_date,far_part,nfs_part,url");
  if (error) throw new Error(error.message);
  return (data ?? []) as RegRefRow[];
}

/**
 * A PCD or Federal Register item published after a template's HQ revision date
 * that touches a FAR or NFS part the template cites.
 */
export function newerGuidance(
  citation: string,
  revisionISO: string | null,
  items: FeedItem[],
): FeedItem | null {
  if (!revisionISO) return null;
  const parts = new Set(partTags(citation));
  if (parts.size === 0) return null;
  const matches = items.filter(
    (i) =>
      (i.source === "PCD/PIC/PN" || i.source === "Federal Register") &&
      i.date !== null &&
      i.date > revisionISO &&
      i.tags.some((t) => parts.has(t)),
  );
  return sortNewestFirst(matches)[0] ?? null;
}
