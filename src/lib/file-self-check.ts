/**
 * Contradictions the record can prove. Read only: nothing here writes, and a
 * missing fact is not treated as a contradiction.
 */
import { supabase } from "@/integrations/supabase/client";
import { staleCitationsIn } from "@/lib/citation-corrections";
import { FORM_NAMES, GENERATED_FORM_KEYS } from "@/lib/nf1787";
import { TEMPLATES } from "@/lib/template-engine";
import {
  docRowKey,
  docSatisfied,
  phaseLabel,
  type AcqRow,
  type PhaseView,
} from "@/lib/launch-sequence";

export type CheckDoc = {
  templateKey: string | null;
  /** "form" opens the form route; "document" opens the document route. */
  route: "document" | "form" | null;
  name: string;
  version: number;
  values: unknown;
};

export type HourLine = {
  quantity: number | null;
  unit: string | null;
  description: string;
};

export type SelfCheckFinding = {
  id: string;
  kind: "phase" | "posting" | "hours" | "guidance" | "hold" | "cite";
  sentence: string;
  templateKey: string | null;
  route: "document" | "form" | null;
};


function lowerItem(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

const POSTING_FIELDS = ["publication_date", "posted_date", "original_posted_date"];
const GUIDANCE = /Drafted from the record, confirm|Draft, confirm|Change (?:this|it) to a best value tradeoff/i;

function textOf(values: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(values);
  return parts.join("\n");
}

function stringFields(values: unknown): Record<string, string> {
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function latestOf(docs: CheckDoc[]): CheckDoc[] {
  const best = new Map<string, CheckDoc>();
  for (const doc of docs) {
    const key = doc.templateKey ?? doc.name;
    const prev = best.get(key);
    if (!prev || doc.version >= prev.version) best.set(key, doc);
  }
  return [...best.values()];
}

function citeLead(found: string): string {
  if (found.length <= 140) return found;
  return found.match(/(?:RFO\s+)?(?:FAR|NFS)\s+[0-9][0-9A-Za-z.()\-]*/)?.[0] ?? `${found.slice(0, 80).trim()}…`;
}

function hourQuantities(hours: HourLine[]): number[] {
  const out: number[] = [];
  for (const line of hours) {
    if (line.quantity === null || !Number.isFinite(line.quantity)) continue;
    const unit = `${line.unit ?? ""} ${line.description}`;
    if (!/hour|\bhr\b|\blh\b/i.test(unit)) continue;
    out.push(line.quantity);
  }
  return out;
}

export function fileSelfCheck(input: {
  acq: AcqRow;
  phases: PhaseView[];
  attachedKeys?: Set<string>;
  savedKeys?: Set<string>;
  /** Omit to skip checks that need saved document text. */
  documents?: CheckDoc[];
  hours?: HourLine[];
}): SelfCheckFinding[] {
  const findings: SelfCheckFinding[] = [];
  const clock = String(input.acq.clock_state ?? "").toLowerCase();
  const seen = new Set<string>();
  const add = (finding: SelfCheckFinding) => {
    if (seen.has(finding.id)) return;
    seen.add(finding.id);
    findings.push(finding);
  };

  for (const phase of input.phases) {
    if (phase.status !== "complete") continue;
    for (const doc of phase.docs) {
      if (doc.optional) continue;
      if ((doc.dueAfterAward || doc.mayFollowAward) && clock !== "launched") continue;
      const hasFile = input.attachedKeys ? input.attachedKeys.has(docRowKey(doc)) : undefined;
      if (docSatisfied(doc, input.acq, hasFile, input.savedKeys) !== false) continue;
      const name = phaseLabel(phase);
      add({
        id: `phase:${phase.phase}:${doc.label}`,
        kind: "phase",
        sentence: `${name} is marked complete, and ${lowerItem(doc.label)} is still required.`,
        templateKey: null,
        route: null,
      });
    }
  }

  if (String(input.acq.clock_state ?? "").trim().toLowerCase() === "hold" && !String(input.acq.hold_reason ?? "").trim()) {
    add({
      id: "hold",
      kind: "hold",
      sentence: "This file is marked on hold, and no cause is stated.",
      templateKey: null,
      route: null,
    });
  }

  const documents = input.documents;
  if (!documents) return findings;

  const synopsis = input.phases.find((phase) => phase.phase === "Synopsis" && phase.status === "complete");
  if (synopsis) {
    const posted = documents.some((doc) => {
      const fields = stringFields(doc.values);
      return POSTING_FIELDS.some((key) => String(fields[key] ?? "").trim());
    });
    if (!posted) {
      add({
        id: "posting",
        kind: "posting",
        sentence: "Synopsis is marked complete, and no posting date is recorded.",
        templateKey: null,
        route: null,
      });
    }
  }

  const recordedHours = hourQuantities(input.hours ?? []);
  for (const doc of latestOf(documents)) {
    const text = textOf(doc.values);
    if (!text.trim()) continue;
    if (GUIDANCE.test(text)) {
      add({
        id: `guidance:${doc.templateKey ?? doc.name}`,
        kind: "guidance",
        sentence: `${doc.name} still contains generator guidance ("Drafted from the record, confirm.").`,
        templateKey: doc.templateKey,
        route: doc.route,
      });
    }
    for (const cite of staleCitationsIn(text)) {
      add({
        id: `cite:${doc.templateKey ?? doc.name}:${cite.found}`,
        kind: "cite",
        sentence: `${doc.name} cites ${citeLead(cite.found)} (now ${cite.now}).`,
        templateKey: doc.templateKey,
        route: doc.route,
      });
    }
    if (recordedHours.length) {
      const mentioned = new Set<number>();
      for (const match of text.matchAll(/(\d{1,5})\s+(?:flight\s+)?hours\b/gi)) {
        mentioned.add(Number(match[1]));
      }
      for (const n of mentioned) {
        if (recordedHours.includes(n)) continue;
        const listed = [...new Set(recordedHours)].join(" and ");
        add({
          id: `hours:${doc.templateKey ?? doc.name}:${n}`,
          kind: "hours",
          sentence: `${doc.name} says ${n} hours. The schedule records ${listed} hours.`,
          templateKey: doc.templateKey,
          route: doc.route,
        });
      }
    }
  }

  return findings;
}

/** Template id to the route key the file page already uses for saved versions. */
export function routeKeyForTemplate(templateId: string, name: string): { key: string; route: "document" | "form" } | null {
  const def = TEMPLATES.find((item) => item.name === name);
  if (def) return { key: def.key, route: "document" };
  for (const key of GENERATED_FORM_KEYS) {
    if (FORM_NAMES[key] === name) return { key, route: "form" };
  }
  if (TEMPLATES.some((item) => item.key === templateId)) return { key: templateId, route: "document" };
  return null;
}

export function checkDocsFrom(
  documents: { template_id: string | null; version: number | null; field_values: unknown }[],
  templates: { template_id: string; name: string }[],
): CheckDoc[] {
  const names = new Map(templates.map((item) => [item.template_id, item.name]));
  return documents.map((doc) => {
    const name = (doc.template_id && names.get(doc.template_id)) || "Saved document";
    const routed = doc.template_id ? routeKeyForTemplate(doc.template_id, name) : null;
    return {
      templateKey: routed?.key ?? null,
      route: routed?.route ?? null,
      name,
      version: Number(doc.version ?? 1),
      values: doc.field_values,
    };
  });
}

/** Read-only document text and schedule quantities for the files on screen. */
export async function loadSelfCheckSources(acquisitionIds: string[]): Promise<{
  documents: { acquisition_id: string | null; template_id: string | null; version: number | null; field_values: unknown }[];
  clins: { acquisition_id: string; quantity: number | null; unit_of_issue: string | null; description: string }[];
  templates: { template_id: string; name: string }[];
}> {
  if (acquisitionIds.length === 0) return { documents: [], clins: [], templates: [] };
  const [docs, clins, templates] = await Promise.all([
    supabase.from("documents").select("acquisition_id,template_id,version,field_values").in("acquisition_id", acquisitionIds),
    supabase.from("acquisition_clins").select("acquisition_id,quantity,unit_of_issue,description").in("acquisition_id", acquisitionIds),
    supabase.from("templates").select("template_id,name"),
  ]);
  if (docs.error) throw new Error(docs.error.message);
  if (clins.error) throw new Error(clins.error.message);
  if (templates.error) throw new Error(templates.error.message);
  return {
    documents: docs.data ?? [],
    clins: (clins.data ?? []) as { acquisition_id: string; quantity: number | null; unit_of_issue: string | null; description: string }[],
    templates: templates.data ?? [],
  };
}
