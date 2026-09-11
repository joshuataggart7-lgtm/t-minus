/**
 * E23. Public scorecard.
 *
 * Aggregate numbers only, readable without signing in. The handler runs on the
 * server, reads the tables there, and returns counts and medians. It never
 * returns an acquisition id, a title, a requester, a vendor, a dollar amount,
 * or anything else that identifies a file. Groups smaller than the cell floor
 * are folded into "Other" so a single file cannot be read out of a group.
 */

import { createServerFn } from "@tanstack/react-start";

/** Dollar values below this are never published in any form. */
export const VALUE_FLOOR = 1_000_000;
/** A published group needs at least this many records. */
export const CELL_FLOOR = 3;

export type ScorecardGroup = { label: string; count: number; medianDays: number | null };

export type Scorecard = {
  generatedAt: string;
  totalFiles: number;
  medianDaysByCategory: ScorecardGroup[];
  medianDaysOverall: number | null;
  competitionRate: { competed: number; total: number; percent: number | null };
  smallBusinessShare: { setAside: number; total: number; percent: number | null };
  holdsByReason: { reason: string; count: number }[];
  launchedThisQuarter: number;
  quarterLabel: string;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : Math.round((((s[mid - 1] as number) + (s[mid] as number)) / 2));
}

function days(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

function quarterStart(now: Date) {
  const q = Math.floor(now.getUTCMonth() / 3);
  return new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
}

/**
 * Reasons are generalised before they are published, so an operational note
 * never reaches the public page verbatim.
 */
function reasonBucket(raw: string | null): string {
  const r = (raw ?? "").toLowerCase();
  if (!r) return "Reason not recorded";
  if (r.includes("excluded")) return "Vendor exclusion under review";
  if (r.includes("no-go") || r.includes("nogo")) return "A reviewer recorded a No-go";
  if (r.includes("vote") || r.includes("poll")) return "A required review vote is outstanding";
  if (r.includes("igce") || r.includes("sow") || r.includes("document") || r.includes("attach"))
    return "A required document is missing";
  if (r.includes("fund")) return "Funding is not certified";
  return "Other";
}

export const getPublicScorecard = createServerFn({ method: "GET" }).handler(async (): Promise<Scorecard> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("acquisition_facts")
    .select(
      "acquisition_method, competition, set_aside, clock_state, hold_reason, regulatory_baseline_date, target_award_date, need_date",
    );
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  // Days to award: the recorded start of the regulatory clock to the award
  // date, for files that have both dates.
  const withDays = rows.map((r) => ({
    ...r,
    days: days(r.regulatory_baseline_date, r.target_award_date),
  }));

  const byCategory = new Map<string, number[]>();
  for (const r of withDays) {
    if (r.days === null) continue;
    const key = (r.acquisition_method ?? "").trim() || "Other";
    byCategory.set(key, [...(byCategory.get(key) ?? []), r.days]);
  }
  const small: number[] = [];
  const groups: ScorecardGroup[] = [];
  for (const [label, values] of byCategory) {
    if (values.length < CELL_FLOOR) {
      small.push(...values);
      continue;
    }
    groups.push({ label, count: values.length, medianDays: median(values) });
  }
  if (small.length) groups.push({ label: "Other categories combined", count: small.length, medianDays: median(small) });
  groups.sort((a, b) => b.count - a.count);

  const competed = rows.filter((r) => {
    const c = (r.competition ?? "").toLowerCase();
    return Boolean(c) && !c.includes("sole") && !c.includes("other than full");
  }).length;
  const setAside = rows.filter((r) => {
    const s = (r.set_aside ?? "").toLowerCase().trim();
    return Boolean(s) && s !== "none" && s !== "n/a";
  }).length;

  const holds = new Map<string, number>();
  for (const r of rows) {
    if ((r.clock_state ?? "") !== "hold") continue;
    const b = reasonBucket(r.hold_reason);
    holds.set(b, (holds.get(b) ?? 0) + 1);
  }

  const now = new Date();
  const qs = quarterStart(now);
  const launchedThisQuarter = rows.filter((r) => {
    if ((r.clock_state ?? "") !== "launched") return false;
    const d = r.target_award_date ? Date.parse(r.target_award_date + "T00:00:00Z") : NaN;
    return !Number.isNaN(d) && d >= qs.getTime() && d <= now.getTime();
  }).length;

  const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : null);

  return {
    generatedAt: now.toISOString(),
    totalFiles: rows.length,
    medianDaysByCategory: groups,
    medianDaysOverall: median(withDays.map((r) => r.days).filter((d): d is number => d !== null)),
    competitionRate: { competed, total: rows.length, percent: pct(competed, rows.length) },
    smallBusinessShare: { setAside, total: rows.length, percent: pct(setAside, rows.length) },
    holdsByReason: [...holds].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    launchedThisQuarter,
    quarterLabel: `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}`,
  };
});
