// The regulation sidebar reads regulatory_refs and thresholds. Nothing is
// generated here: rows are selected by the phase they name, by the FAR or NFS
// part the phase cites, and by the thresholds that bear on the record.

import { supabase } from "@/integrations/supabase/client";
import { PHASE_CITATIONS } from "@/lib/launch-sequence";

export type RegRefRow = {
  ref_id: string;
  citation: string | null;
  title: string | null;
  tier: string | null;
  source: string | null;
  effective_date: string | null;
  far_part: string | null;
  nfs_part: string | null;
  url: string | null;
  applies_to_phase: string | null;
};

export type ThresholdRow = {
  threshold_id?: string;
  name: string | null;
  value: number | string | null;
  citation: string | null;
  effective_date?: string | null;
  superseded_date?: string | null;
  tier: string | null;
  note: string | null;
};

export async function loadRegulationRefs(): Promise<RegRefRow[]> {
  const { data, error } = await supabase
    .from("regulatory_refs")
    .select("ref_id,citation,title,tier,source,effective_date,far_part,nfs_part,url,applies_to_phase");
  if (error) throw new Error(error.message);
  return (data ?? []) as RegRefRow[];
}

/** "binding" or "guidance" for the label, from the tier text on the row. */
export function tierLabel(tier: string | null | undefined): "binding" | "guidance" {
  return /guidance|companion|pic\b|pn\b/i.test(String(tier ?? "")) ? "guidance" : "binding";
}

export function refDate(value: string | null | undefined): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

export function formatRefDate(value: string | null | undefined): string {
  if (!value) return "No effective date recorded";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return value;
  return new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** FAR and NFS part numbers a phase cites, taken from the phase citation row. */
export function partsForPhase(phase: string): { far: string[]; nfs: string[] } {
  const citation = PHASE_CITATIONS[phase] ?? "";
  const far = new Set<string>();
  const nfs = new Set<string>();
  for (const m of citation.matchAll(/FAR\s+(\d{1,2})(?:\.\d|\b)/gi)) far.add(m[1]!);
  for (const m of citation.matchAll(/NFS(?:\s+CG)?\s+(\d{4})/gi)) nfs.add(m[1]!);
  for (const m of citation.matchAll(/\b(18\d{2})\./g)) nfs.add(m[1]!);
  return { far: [...far], nfs: [...nfs] };
}

export type RefScope = "phase" | "part" | "all";

export type SidebarRef = RegRefRow & { scope: RefScope };

/** The regulatory_refs rows that apply to a phase, newest first. */
export function refsForPhase(rows: RegRefRow[], phase: string): SidebarRef[] {
  const { far, nfs } = partsForPhase(phase);
  const wanted = phase.toLowerCase();
  const out: SidebarRef[] = [];
  for (const r of rows) {
    const named = String(r.applies_to_phase ?? "")
      .split(";")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    let scope: RefScope | null = null;
    if (named.includes(wanted)) scope = "phase";
    else if (named.includes("all") || named.length === 0) scope = "all";
    if (
      (r.far_part && far.includes(String(r.far_part).trim())) ||
      (r.nfs_part && nfs.includes(String(r.nfs_part).trim()))
    ) {
      scope = scope === "phase" ? "phase" : "part";
    }
    if (scope) out.push({ ...r, scope });
  }
  const rank: Record<RefScope, number> = { phase: 0, part: 1, all: 2 };
  return out.sort(
    (a, b) => rank[a.scope] - rank[b.scope] || refDate(b.effective_date) - refDate(a.effective_date),
  );
}

/** Thresholds every file shows, whatever the phase. */
const CORE_THRESHOLDS = /micro-purchase|simplified acquisition threshold|commercial simplified procedures ceiling/i;

/** Thresholds a phase bears on, matched on the threshold name and citation. */
const PHASE_THRESHOLDS: Record<string, RegExp> = {
  Intake: /acquisition forecast|micro-purchase|simplified acquisition/i,
  "Market Research": /simplified acquisition|small business|sources sought/i,
  JOFOC: /jofoc/i,
  Synopsis: /justification posting|simplified acquisition/i,
  "Solicitation/Quote": /commercial simplified|simplified acquisition/i,
  "Technical Evaluation": /simplified acquisition/i,
  "Price Reasonableness": /certified cost or pricing/i,
  "Responsibility Check": /integrity|responsib|exclusion/i,
  "Go/No-go Poll": /anosca|notification of procurement action|npa|announcement/i,
  Award: /justification posting|cica|protest|anosca|notification of procurement action/i,
  "FPDS-NG Report": /reporting|simplified acquisition/i,
  Administration: /cpars|past performance/i,
  Closeout: /closeout|retention|cpars/i,
};

export type SidebarThreshold = ThresholdRow & { numeric: number | null };

/** Thresholds that apply to this acquisition at this phase. Superseded rows
 *  are left out; conflict notes stay on the row and are shown as written. */
export function thresholdsForPhase(rows: ThresholdRow[], phase: string): SidebarThreshold[] {
  const test = PHASE_THRESHOLDS[phase];
  return rows
    .filter((t) => !t.superseded_date)
    .filter((t) => {
      const name = t.name ?? "";
      const hay = `${name} ${t.citation ?? ""}`;
      return CORE_THRESHOLDS.test(name) || (test ? test.test(hay) : false);
    })
    .map((t) => {
      const n = t.value === null || t.value === undefined ? null : Number(t.value);
      return { ...t, numeric: Number.isFinite(n as number) ? (n as number) : null };
    })
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}
