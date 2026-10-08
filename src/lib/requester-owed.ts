// What a requester owes on a file, read from the record only. Shared by the
// requester portal and the request confirmation page so both say the same.
import type { DeskCard } from "@/lib/desk-data";
import { nf1707SectionProgress } from "@/components/nf1707-intake";

/** Phases after award: an awarded file owes the requester nothing. */
export const POST_AWARD_PHASES = ["Award", "Administration", "Closeout"];

export function isPostAward(card: DeskCard): boolean {
  return Boolean(card.m.awardDate) || POST_AWARD_PHASES.includes(String(card.m.currentPhase ?? ""));
}

export type Owed = { label: string; present: boolean; note: string };

/** What the requester owes, read from the record only. Nothing is invented. */
export function owedRows(card: DeskCard): Owed[] {
  const acq = card.m.acq as Record<string, unknown>;
  const answers = acq['nf1707_answers'];
  // Counted the way the Intake page counts: sections answered of sections shown.
  const progress =
    answers && typeof answers === "object"
      ? nf1707SectionProgress(answers as Record<string, unknown>, acq)
      : { answered: 0, total: 0 };
  const answered = progress.answered;
  const attached = card.attachedKeys;
  return [
    {
      label: "Purchase request number",
      present: Boolean(acq['pr_number']),
      note: acq['pr_number'] ? String(acq['pr_number']) : "Not on the record yet.",
    },
    {
      label: "NF 1707 intake answers",
      present: answered > 0,
      note:
        answered > 0
          ? `${answered} of ${progress.total} ${progress.total === 1 ? "section" : "sections"} answered.`
          : "No answers recorded yet.",
    },
    {
      label: "Statement of work",
      present:
        Boolean(acq['sow_attached']) || attached.has("sow_attached") || attached.has("sow"),
      note: "Recorded on the file by the requesting organization.",
    },
    {
      label: "Independent government cost estimate",
      present:
        Boolean(acq['igce_attached']) ||
        attached.has("igce_attached") ||
        attached.has("igce"),
      note: "Recorded on the file by the requesting organization.",
    },
  ];
}
