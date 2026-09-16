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

/** Is this record on the simplified / commercial path? Same rule the memos use. */
function simplified(acq: Facts | null): boolean {
  const method = `${str(acq, "acquisition_method")} ${str(acq, "contract_format")}`;
  if (/part\s*15|15\.\d/i.test(method) && !/13\.5|13\b|simplified/i.test(method)) return false;
  return /13\.5|\b13\b|\b12\b|simplified|commercial/i.test(method);
}

/**
 * The citations an email from this file may carry, kept honest in one place.
 * Simplified and commercial files never borrow Part 15 negotiated citations.
 */
export function emailCiteForMethod(acq: Facts | null): {
  unsuccessful: string;
  priceReasonableness: string;
  methodLabel: string;
} {
  return simplified(acq)
    ? {
        unsuccessful: "FAR 13.106-3(d)",
        priceReasonableness: "FAR 13.106-3",
        methodLabel: "simplified commercial procedures",
      }
      : {
        unsuccessful: "FAR 15.506(a)",
        priceReasonableness: "FAR 15.404-1",
        methodLabel: "negotiated procedures",
      };
}


/** Does the record show an independent government cost estimate on the file? */
function igceOutstanding(acq: Facts | null, missing: { label: string }[]): boolean {
  if (acq?.["igce_attached"] === true) return false;
  if (acq?.["igce_attached"] === false) return true;
  return missing.some((m) => /igce|independent government (cost )?estimate/i.test(m.label));
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
  const cites = emailCiteForMethod(acq);
  const signOff = `${coName}\nContracting Officer\nT-Minus prototype record ${id}`;

  // The estimate leads the list when it is the row holding the file up.
  const igceFirst = [...input.missingLabels].sort((a, b) => {
    const ia = /igce|independent government (cost )?estimate/i.test(a.label) ? 0 : 1;
    const ib = /igce|independent government (cost )?estimate/i.test(b.label) ? 0 : 1;
    return ia - ib;
  });

  const owed = igceFirst
    .map((m) => `  - ${m.label}${m.citation ? ` (${m.citation})` : ""}`)
    .join("\n");

  const igceRow = input.missingLabels.find((m) =>
    /igce|independent government (cost )?estimate/i.test(m.label),
  );
  const igceOwed = igceOutstanding(acq, input.missingLabels);

  const igceDraft: EmailDraft = {
    key: "requester-igce",
    label: "Requester — missing IGCE",
    to: requester,
    subject: `${id} — independent government cost estimate still needed`,
    body: [
      `${requester},`,
      "",
      `${id}, ${title}, is in ${phase} and the file does not carry an independent government cost estimate.`,
      "I cannot record a price reasonableness determination without it.",
      "",
      need ? `Recorded need date: ${need}.` : "Need date: not recorded on the file.",
      target ? `Target award date on the record: ${target}.` : "Target award date: not recorded on the file.",
      `This buy is being run under ${cites.methodLabel}; price reasonableness is determined under ${cites.priceReasonableness}.`,
      igceRow?.citation ? `The Required row on the file cites ${igceRow.citation}.` : "",
      "",
      "Please send the estimate with the basis you used, or tell me what is holding it up so I can record the reason.",
      "",
      signOff,
    ]
      .filter((line) => line !== "")
      .join("\n"),
    available: igceOwed,
    unavailableNote:
      acq?.["igce_attached"] === true
        ? "The record already shows an independent government cost estimate on this file, so there is nothing to ask for."
        : "No outstanding IGCE row is recorded on this phase.",
  };


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
            : simplified(acq)
              ? `You may request a brief explanation of the basis for the award decision within three days of this notice (${cites.unsuccessful}).`
              : `You may request a debriefing within three days of this notice (${cites.unsuccessful}).`,
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

  return igceOwed
    ? [igceDraft, requesterDraft, reviewerDraft, vendorDraft]
    : [requesterDraft, igceDraft, reviewerDraft, vendorDraft];

}
