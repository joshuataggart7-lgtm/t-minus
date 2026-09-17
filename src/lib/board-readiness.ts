// Board-readiness summary shared by the Evaluation cockpit and briefing book.
// It is a read-only snapshot: no result holds a file or changes a phase, clock,
// required document, or review decision.

import { lmConsistencyCheck, type LmConsistency } from "@/lib/lm-consistency";
import {
  factorHasEvidence,
  type FactorRow,
  type MethodShell,
  type SectionLRow,
  type SectionMRow,
} from "@/lib/solicitation-lm";

export type BoardReadiness = {
  lamp: LmConsistency;
  clarificationCount: number;
  factorCount: number;
  evidenceCount: number;
  competitive: boolean;
  /** Real receipts counted off the record. Null when the count was not read. */
  receiptCount: number | null;
};

export function boardReadiness({
  shell,
  l,
  m,
  factors,
  clarificationCount,
  receiptCount = null,
}: {
  shell: MethodShell | null | undefined;
  l: SectionLRow | null | undefined;
  m: SectionMRow | null | undefined;
  factors: FactorRow[];
  clarificationCount: number;
  receiptCount?: number | null;
}): BoardReadiness {
  return {
    lamp: lmConsistencyCheck({ shell, l, m, factors }),
    clarificationCount,
    factorCount: factors.length,
    evidenceCount: factors.filter(factorHasEvidence).length,
    competitive: shell?.competitive ?? false,
    receiptCount,
  };
}


export function boardReadinessItems(readiness: BoardReadiness): { label: string; value: string }[] {
  return [
    {
      label: "L↔M",
      value:
        readiness.lamp.status === "ok"
          ? "Consistent — no findings"
          : `${readiness.lamp.findings.length} advisory finding${readiness.lamp.findings.length === 1 ? "" : "s"}`,
    },
    {
      label: "Clarifications",
      value:
        readiness.clarificationCount === 0
          ? "None recorded"
          : `${readiness.clarificationCount} recorded`,
    },
    {
      label: "Evaluation evidence",
      value: !readiness.competitive
        ? "Sole-source path"
        : readiness.factorCount === 0
          ? "No factors recorded"
          : `${readiness.evidenceCount} of ${readiness.factorCount} factors noted`,
    },
  ];
}