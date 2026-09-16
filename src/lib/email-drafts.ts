/**
 * Email drafts written from the record. Copy only: T-Minus never sends mail,
 * and nothing here writes to an external system.
 */

export type EmailDraft = {
  key: string;
  label: string;
  to: string;
  subject: string;
  body: string;
  available: boolean;
  unavailableNote?: string;
};

type Facts = Record<string, unknown>;

function str(f: Facts | null, key: string) {
  const v = f?.[key];
  return v === null || v === undefined ? "" : String(v);
}

export function buildEmailDrafts(input: {
  acq: Facts | null;
  coName: string;
  phase: string;
  citation: string;
  missingLabels: { label: string; citation?: string | undefined }[];
  pendingReviewers: { role: string; name: string | null; due: string | null }[];
  vendorOutcome?: { vendor: string; successful: boolean } | null;
}): EmailDraft[] {
  const { acq, coName, phase, citation } = input;
  const id = str(acq, "acquisition_id") || "this acquisition";
  const title = str(acq, "title") || "the requirement";
  const requester = str(acq, "requester_name") || "the requester";
  const need = str(acq, "need_date");
  const target = str(acq, "target_award_date");
  const signOff = `${coName}\nContracting Officer\nT-Minus prototype record ${id}`;

  const owed = input.missingLabels
    .map((m) => `  - ${m.label}${m.citation ? ` (${m.citation})` : ""}`)
    .join("\n");

  const requesterDraft: EmailDraft = {
    key: "requester-nudge",
    label: "Requester nudge",
    to: requester,
    subject: `${id} — items still needed to move ${title}`,
    body: [
      `${requester},`,
      "",
      `${id}, ${title}, is in ${phase}. The file is waiting on the following from your office:`,
      owed || "  - Nothing is outstanding on the record right now.",
      "",
      need ? `The recorded need date is ${need}.` : "",
      target ? `The target award date on the record is ${target}.` : "",
      citation ? `Authority for this phase: ${citation}.` : "",
      "",
      "Please send what you can this week, or tell me what is holding it up so I can record the reason.",
      "",
      signOff,
    ]
      .filter((line) => line !== "")
      .join("\n"),
    available: input.missingLabels.length > 0,
    unavailableNote: "No Required row is outstanding on this phase, so there is nothing to ask the requester for.",
  };

  const reviewerLines = input.pendingReviewers
    .map((r) => `  - ${r.role}${r.name ? `, ${r.name}` : ""}${r.due ? `, due ${r.due}` : ""}`)
    .join("\n");

  const reviewerDraft: EmailDraft = {
    key: "reviewer-nudge",
    label: "Reviewer nudge",
    to: input.pendingReviewers.map((r) => r.name ?? r.role).join("; "),
    subject: `${id} — Go/No-go vote still open`,
    body: [
      "Colleagues,",
      "",
      `${id}, ${title}, has an open poll in ${phase}. These votes are still pending:`,
      reviewerLines || "  - None pending.",
      "",
      target ? `The target award date is ${target}; every day the poll stays open moves that date.` : "",
      citation ? `Authority: ${citation}.` : "",
      "",
      "Please record Go or No-go in T-Minus. A No-go needs a reason so the file carries it.",
      "",
      signOff,
    ]
      .filter((line) => line !== "")
      .join("\n"),
    available: input.pendingReviewers.length > 0,
    unavailableNote: "No poll on this phase is pending, so there is no reviewer to nudge.",
  };

  const outcome = input.vendorOutcome ?? null;
  const vendorDraft: EmailDraft = {
    key: "vendor-notice",
    label: "Vendor notice stub",
    to: outcome?.vendor ?? "",
    subject: `${id} — notice of award decision`,
    body: outcome
      ? [
          `${outcome.vendor},`,
          "",
          outcome.successful
            ? `Your quotation for ${title} under ${id} has been accepted. The contract document of record is written in NCMS; this note is a courtesy only.`
            : `Your quotation for ${title} under ${id} was not selected. The award was made to the quoter whose offer represented the best value to the Government on the recorded evaluation.`,
          "",
          outcome.successful
            ? ""
            : "You may request a brief explanation of the basis for the award decision within three days of this notice (FAR 13.106-3(d)).",
          "",
          "This is a prototype record and not an official NASA notice.",
          "",
          signOff,
        ]
          .filter((line) => line !== "")
          .join("\n")
      : "",
    available: Boolean(outcome),
    unavailableNote: "The evaluation record does not yet name a successful and unsuccessful quoter.",
  };

  return [requesterDraft, reviewerDraft, vendorDraft];
}
