// L↔M consistency lamp — advisory only.
//
// This reads what the officer saved on Sections L and M and says, in plain
// words, where the two look like they are describing different awards. It is
// never a gate: nothing here holds a file, blocks a phase exit, changes a
// clock, or adds a required document. No authority text is invented.

import type { FactorRow, MethodShell, SectionLRow, SectionMRow } from "@/lib/solicitation-lm";

export type LmConsistency = {
  status: "ok" | "advisory";
  findings: string[];
};

export const LM_LAMP_LABEL = "Advisory — does not hold the file.";
export const LM_LAMP_OK = "L and M look consistent on the record.";

const lTextOf = (l: SectionLRow | null | undefined): string =>
  [l?.volumes, l?.page_limit, l?.submission_instructions, l?.response_due_note]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" \n ");

const factorText = (factors: FactorRow[]): string =>
  factors
    .map((f) => [f.name, f.relative_importance, f.description].map((v) => (v ?? "").trim()).join(" "))
    .join(" \n ");

const LPTA_WORDS = /lowest price technically acceptable|\blpta\b/i;
const TRADEOFF_WORDS = /best value|trade[- ]?off|comparative assessment|most advantageous/i;

/**
 * Soft read of Sections L and M against each other. Empty content is never a
 * finding: a file that has not been authored yet is simply quiet.
 */
export function lmConsistencyCheck({
  shell,
  l,
  m,
  factors,
}: {
  shell: MethodShell | null | undefined;
  l: SectionLRow | null | undefined;
  m: SectionMRow | null | undefined;
  factors: FactorRow[];
}): LmConsistency {
  const findings: string[] = [];
  if (!shell) return { status: "ok", findings: [] };

  const lText = lTextOf(l);
  const mText = [(m?.notes ?? "").trim(), factorText(factors)].filter(Boolean).join(" \n ");
  const anyContent = Boolean(lText || mText || factors.length > 0);

  if (!shell.competitive) {
    if (
      TRADEOFF_WORDS.test(lText) ||
      TRADEOFF_WORDS.test(mText) ||
      LPTA_WORDS.test(lText) ||
      LPTA_WORDS.test(mText) ||
      factors.length > 0
    ) {
      findings.push(
        "This file is sole-source on the record, but competitive evaluation language is saved on L or M. Competitive factors are not the path here; the technical evaluation of the single proposal and the price negotiation memorandum carry the finding.",
      );
    }
    return { status: findings.length ? "advisory" : "ok", findings };
  }

  const lpta = Boolean(m?.lpta);

  if (lpta && TRADEOFF_WORDS.test(lText) && !LPTA_WORDS.test(lText)) {
    findings.push(
      "Section M is set to lowest price technically acceptable, but the instructions in Section L read like a best-value tradeoff. One of the two is describing a different award.",
    );
  }

  if (!lpta && LPTA_WORDS.test(lText) && !TRADEOFF_WORDS.test(lText)) {
    findings.push(
      "Section L asks offerors for a lowest price technically acceptable submission, but Section M is not set to that basis. Confirm which basis the notice will carry.",
    );
  }

  if (lpta && factors.length > 0 && TRADEOFF_WORDS.test(factorText(factors))) {
    findings.push(
      "Section M is lowest price technically acceptable, but a recorded factor is written in best-value words. On this basis, technical acceptability and price carry the award.",
    );
  }

  if (!lpta && factors.length > 0 && LPTA_WORDS.test(factorText(factors))) {
    findings.push(
      "Section M is on a best-value basis, but a recorded factor reads as lowest price technically acceptable only. Confirm the relative importance the factors are meant to carry.",
    );
  }

  if (!lpta && anyContent && factors.length === 0) {
    findings.push(
      "Section M is on a best-value basis with no factors recorded yet. Factors and their relative importance are stated to offerors before the notice is posted.",
    );
  }

  return { status: findings.length ? "advisory" : "ok", findings };
}
