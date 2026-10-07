// One reading of "what is holding this file", used by the file header, the
// work-queue card and the escalations page so all three say the same thing.
//
// A hold reason that the engine wrote ("Intake: … is missing", a No-go, an
// unvoted review) is recomputed from the record and the stored files every
// time it is read. A reason a person typed is left alone.

import { daysBetween, todayISO } from "@/lib/intake";
import { TEMPLATES } from "@/lib/template-engine";
import { FORM_NAMES, GENERATED_FORM_KEYS } from "@/lib/nf1787";
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

export type Hold = { reason: string; owner: string; doc?: { phase: string; label: string } } | null;

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
    // The generated forms (NF 1787, NF 1787A) file their versions the same
    // way the templates do, so a saved form clears its row everywhere.
    for (const key of GENERATED_FORM_KEYS) {
      if (FORM_NAMES[key] === t.name) keyByTemplateId.set(t.template_id, key);
    }
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

/**
 * A typed hold a person recorded that differs from the cause shown. The shown
 * cause keeps precedence (resolveHold puts the derived cause first); this is
 * only the second line, "Also recorded: ...".
 */
export function alsoRecordedHold(acq: AcqRow, shown: Hold): string | null {
  const reason = String(acq.hold_reason ?? "").trim();
  if (!reason || isDerivedHoldReason(reason) || !shown || shown.reason.trim() === reason) return null;
  const owner = String(acq.hold_owner ?? "").trim();
  return `Also recorded: ${reason}${owner ? ` · ${owner}` : ""}`;
}

/**
 * The record with each file's hold recomputed, for pages that list holds
 * (Escalations and the Digest "Aging holds"), so both read the same cause and
 * owner as the file page. The typed hold, when different, rides along as
 * __also_recorded.
 */
export function withResolvedHolds(
  acqs: AcqRow[],
  plan: PhasePlanRow[],
  attachments: { acquisition_id?: string | null; doc_key: string }[],
  documents: { acquisition_id?: string | null; template_id: string | null }[],
  templates: { template_id: string; name: string }[],
): AcqRow[] {
  return acqs.map((acq) => {
    if (acq.clock_state === "launched" || acq.status === "scrubbed") return acq;
    const cause = holdFromRecord(
      acq,
      plan,
      attachedKeys(attachments, acq.acquisition_id),
      savedDocKeys(documents, templates, acq.acquisition_id),
    );
    return {
      ...acq,
      hold_reason: cause?.reason ?? null,
      hold_owner: cause?.owner ?? null,
      clock_state: cause ? "hold" : acq.clock_state,
      __also_recorded: alsoRecordedHold(acq, cause),
    } as AcqRow;
  });
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
