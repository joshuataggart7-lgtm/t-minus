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
  /** Method label and evaluation voice come from the same shell as Sections L and M. */
  methodLabel: string;
  methodVoice: string;
  /** Real receipts counted off the record. Null when the count was not read. */
  receiptCount: number | null;
};

function boardMethodVoice(shell: MethodShell | null | undefined): {
  methodLabel: string;
  methodVoice: string;
} {
  if (!shell) {
    return {
      methodLabel: "Method not recorded",
      methodVoice: "Evaluation path not recorded",
    };
  }
  const format = shell.path === "sf1449" ? "SF 1449 / Part 12–13" : "UCF / Part 15";
  if (!shell.competitive) {
    return {
      methodLabel: `${format} · sole source`,
      methodVoice:
        "Single-proposal technical evaluation; a competitive factor map is not the path.",
    };
  }
  return {
    methodLabel: `${format} · competitive`,
    methodVoice:
      shell.partFamily === "15"
        ? "Proposals · Section L–M evaluation"
        : "Quotations · commercial streamlined evaluation",
  };
}

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
  const method = boardMethodVoice(shell);
  return {
    lamp: lmConsistencyCheck({ shell, l, m, factors }),
    clarificationCount,
    factorCount: factors.length,
    evidenceCount: factors.filter(factorHasEvidence).length,
    competitive: shell?.competitive ?? false,
    methodLabel: method.methodLabel,
    methodVoice: method.methodVoice,
    receiptCount,
  };
}


export function boardReadinessItems(readiness: BoardReadiness): { label: string; value: string }[] {
  const items = [
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
      label: "Evaluation factors",
      value: !readiness.competitive
        ? "Not used on this sole-source path"
        : readiness.factorCount === 0
          ? "None recorded"
          : `${readiness.factorCount} recorded`,
    },
    {
      label: "Evaluation evidence",
      value: !readiness.competitive
        ? "Single-proposal evaluation; competitive evidence map not used"
        : readiness.factorCount === 0
          ? "None recorded — no factors to map"
          : readiness.evidenceCount === 0
            ? "None recorded"
            : `${readiness.evidenceCount} of ${readiness.factorCount} factors noted`,
    },
  ];
  // Receipts are counted off the record only. No count read, no line.
  if (readiness.receiptCount !== null) {
    items.push({
      label: "Read receipts",
      value:
        readiness.receiptCount === 0
          ? "None yet — per-document status below"
          : `${readiness.receiptCount} recorded`,
    });
  }
  return items;
}
