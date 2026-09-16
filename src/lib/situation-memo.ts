// Situation / unexpected-event memo. A shell built from facts already on the
// record. No FAR text is invented; where a citation would be needed the line
// reads RFO-pending so the CO supplies it.

export type SituationEvent = {
  key: string;
  label: string;
  /** what the memo says the event is, in plain words */
  opening: string;
  /** citation line, honest when nothing is confirmed on the record */
  citation: string;
};

export const SITUATION_EVENTS: SituationEvent[] = [
  {
    key: "gfp",
    label: "Government property incident or damage",
    opening: "A government property incident was reported on this acquisition.",
    citation: "Government property citation: RFO-pending, confirm before signature.",
  },
  {
    key: "iaa",
    label: "Interagency agreement mishap",
    opening: "An issue arose under the interagency agreement supporting this acquisition.",
    citation: "Interagency authority citation: RFO-pending, confirm before signature.",
  },
  {
    key: "stop_work",
    label: "Stop-work or delay notice",
    opening: "A stop-work or delay condition was identified on this acquisition.",
    citation: "Stop-work clause citation: RFO-pending, confirm from the clause list on this file.",
  },
  {
    key: "protest",
    label: "Protest or stay",
    opening: "A protest was reported against this acquisition.",
    citation: "Protest and stay citation: RFO-pending, confirm before signature.",
  },
  {
    key: "other",
    label: "Other (blank narrative)",
    opening: "An unexpected event occurred on this acquisition.",
    citation: "Citation: RFO-pending, confirm before signature.",
  },
];

export const SITUATION_EMPTY = "No situation memo started.";

export function situationMemo(
  event: SituationEvent,
  acq: Record<string, unknown> | null | undefined,
): string {
  const val = (k: string) => {
    const v = acq?.[k];
    const s = v === null || v === undefined ? "" : String(v).trim();
    return s || "Not recorded";
  };
  const id = val("acquisition_id");
  const lines = [
    `Memorandum to file: ${event.label.toLowerCase()}, ${id}.`,
    "",
    `Acquisition: ${id}, ${val("title")}.`,
    `Contracting officer: ${val("contracting_officer")}.`,
    `Center: ${val("center_code")}.`,
    `Phase at the time of this memorandum: ${val("current_phase")}.`,
    `Contractor or vendor on the record: ${val("awarded_vendor_name")}.`,
    "",
    event.opening,
    "",
    "Narrative: [describe what happened, when it was learned, and who was notified].",
    "Effect on the schedule: [describe the effect on the target award or delivery date].",
    "Action taken: [describe the action taken and the action still required].",
    "",
    event.citation,
    "",
    "Generated from the T-Minus record. Facts not on the record read Not recorded.",
    "T-Minus does not write to any external system.",
  ];
  return lines.join("\n");
}
