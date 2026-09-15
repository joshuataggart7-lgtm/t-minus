// One reading of "what is holding this file", used by the file header, the
// work-queue card and the escalations page so all three say the same thing.
//
// A hold reason that the engine wrote ("Intake: … is missing", a No-go, an
// unvoted review) is recomputed from the record and the stored files every
// time it is read. A reason a person typed is left alone.

import { daysBetween, todayISO } from "@/lib/intake";
import { TEMPLATES } from "@/lib/template-engine";
import {
  buildSequence,
  computeHold,
  docRowKey,
  type AcqRow,
  type BoardEntry,
  type PhasePlanRow,
  type PhaseView,
  type RequiredDoc,
} from "@/lib/launch-sequence";

export type Hold = { reason: string; owner: string } | null;

/** The doc keys that have a stored file, for one acquisition. */
export function attachedKeys(
  rows: { acquisition_id?: string | null; doc_key: string }[],
  acquisitionId?: string,
): Set<string> {
  return new Set(
    rows
      .filter((r) => !acquisitionId || r.acquisition_id === acquisitionId)
      .map((r) => r.doc_key),
  );
}

/** The generator keys that have at least one saved version, for one file. */
export function savedDocKeys(
  documents: { acquisition_id?: string | null; template_id: string | null }[],
  templates: { template_id: string; name: string }[],
  acquisitionId?: string,
): Set<string> {
  const keyByTemplateId = new Map<string, string>();
  for (const t of templates) {
    const def = TEMPLATES.find((d) => d.name === t.name);
    if (def) keyByTemplateId.set(t.template_id, def.key);
  }
  const out = new Set<string>();
  for (const d of documents) {
    if (acquisitionId && d.acquisition_id && d.acquisition_id !== acquisitionId) continue;
    const key = d.template_id ? keyByTemplateId.get(d.template_id) : undefined;
    if (key) out.add(key);
  }
  return out;
}

export function keyForDoc(doc: RequiredDoc) {
  return docRowKey(doc);
}

/** Was this reason written by the engine rather than by a person? */
export function isDerivedHoldReason(reason: string | null | undefined): boolean {
  const text = String(reason ?? "").trim();
  if (!text) return false;
  return /is missing$/i.test(text) || /^No-go:/i.test(text) || /has not voted$/i.test(text);
}

/**
 * The hold to show. Derived reasons are recomputed; a typed reason stands.
 */
export function resolveHold(
  acq: AcqRow,
  phases: PhaseView[],
  board: BoardEntry[],
  keys?: Set<string>,
  saved?: Set<string>,
): Hold {
  const computed = computeHold(acq, phases, board, keys, saved);
  if (computed) return computed;
  const recorded = acq.hold_reason ? String(acq.hold_reason) : "";
  if (!recorded || isDerivedHoldReason(recorded)) return null;
  return { reason: recorded, owner: String(acq.hold_owner ?? acq.co_name ?? "Contracting officer") };
}

/** Same reading without a poll board, for pages that only list holds. */
export function holdFromRecord(
  acq: AcqRow,
  plan: PhasePlanRow[],
  keys?: Set<string>,
  saved?: Set<string>,
): Hold {
  const phases = buildSequence(acq, plan, todayISO(), daysBetween, { attachedKeys: keys, savedKeys: saved });
  return resolveHold(acq, phases, [], keys, saved);
}
