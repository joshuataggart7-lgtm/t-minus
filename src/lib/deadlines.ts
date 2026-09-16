// Deadline calculus. Every date this file owes, computed from the record, with
// the citation behind it and whether the count runs in calendar or business
// days. Where a citation is not verified against the seeded RFO/NFS text, the
// row says so instead of printing a rule nobody can stand behind.

import { cparsView, optionSchedule, postAward, retentionView } from "@/lib/post-award";

type AcqRow = Record<string, unknown> | null | undefined;
type ThresholdRow = { name?: string | null; value?: number | string | null; citation?: string | null; note?: string | null };

export type DeadlineRow = {
  label: string;
  /** The computed date, or null when the record does not carry the start yet. */
  date: string | null;
  /** What the count runs from, in plain words. */
  from: string;
  count: "calendar days" | "business days" | "set by the record";
  citation: string;
  /** False when the rule is shown as a stub pending verification. */
  verified: boolean;
  note?: string;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const addBusinessDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
};

export function deadlineRows(opts: {
  acq: AcqRow;
  awardDate: string | null;
  debriefingDate: string | null;
  thresholds: ThresholdRow[];
  noticePostedDate: string | null;
  quoteDueDate: string | null;
}): DeadlineRow[] {
  const { acq, awardDate, debriefingDate, thresholds, noticePostedDate, quoteDueDate } = opts;
  const rows: DeadlineRow[] = [];
  const method = String(acq?.["acquisition_method"] ?? "");
  const soleSource = /sole source/i.test(method) || /sole source/i.test(String(acq?.["competition"] ?? ""));

  // 1. Synopsis response period. The response date is what the notice itself
  // carries; the minimum period for this method is not verified in the seeded
  // text, so the rule is shown as a stub rather than stated as settled.
  rows.push({
    label: "Synopsis response period",
    date: quoteDueDate ?? null,
    from: noticePostedDate ? `notice posted ${noticePostedDate}` : "the notice is not posted yet",
    count: "set by the record",
    citation: soleSource ? "RFO FAR 5.203; FAR 6.104" : "RFO FAR 5.203",
    verified: false,
    note: "Stub: the response date shown is the one on the notice. The minimum response period for this method is not verified against the seeded RFO text.",
  });

  // 2. Size protest. FAR 19.302(d)(1): five business days after the
  // contracting officer notifies the apparent successful offeror.
  rows.push({
    label: "Size protest window",
    date: awardDate ? addBusinessDays(awardDate, 5) : null,
    from: awardDate ? `notice of the apparent successful offeror, ${awardDate}` : "award is not recorded yet",
    count: "business days",
    citation: "FAR 19.302(d)(1)",
    verified: true,
  });

  // 3. CICA stay. FAR 33.104(c)(1) and 31 U.S.C. 3553(d)(4): a protest filed
  // within ten days of award, or within five days after a required debriefing,
  // suspends performance.
  rows.push({
    label: "CICA stay window, ten days after award",
    date: awardDate ? addDays(awardDate, 10) : null,
    from: awardDate ? `award ${awardDate}` : "award is not recorded yet",
    count: "calendar days",
    citation: "FAR 33.104(c)(1); 31 U.S.C. 3553(d)(4)",
    verified: true,
  });
  rows.push({
    label: "CICA stay window, five days after a required debriefing",
    date: debriefingDate ? addDays(debriefingDate, 5) : null,
    from: debriefingDate ? `debriefing ${debriefingDate}` : "no debriefing date is recorded",
    count: "calendar days",
    citation: "FAR 33.104(c)(1); 31 U.S.C. 3553(d)(4)",
    verified: true,
  });

  // 4. Option preliminary notice, from the 52.217-9 fill-in on the record.
  const options = optionSchedule(acq as never, awardDate);
  const nextOption = options.periods.find((p) => p.noticeDue);
  rows.push({
    label: "Option preliminary notice due",
    date: nextOption?.noticeDue ?? postAward(acq as never).option_notice_date ?? null,
    from: nextOption?.start
      ? `${options.noticeLeadDays} days before the option period starts ${nextOption.start}`
      : "no option period is recorded",
    count: "calendar days",
    citation: "FAR 52.217-9, as filled in on this contract",
    verified: true,
  });

  // 5. CPARS. The threshold row and the 120-day rule already on the file.
  const cpars = cparsView(acq as never, thresholds as never, awardDate);
  rows.push({
    label: "CPARS evaluation due",
    date: cpars.dueDate,
    from: cpars.periodEnd ? `120 days after the evaluation period ends ${cpars.periodEnd}` : "award is not recorded yet",
    count: "calendar days",
    citation: cpars.citation ?? "FAR 42.1502(a); FAR 42.1503(f)",
    verified: true,
    ...(cpars.applies ? {} : { note: "Below the CPARS threshold on this record." }),
  });

  // 6. Retention. Six years after final payment, FAR 4.805.
  const retention = retentionView(thresholds as never, postAward(acq as never).final_payment_date ?? null, awardDate);
  rows.push({
    label: "Contract file retention date",
    date: retention.date,
    from: retention.from ? `${retention.fromLabel}, ${retention.from}` : "final payment is not recorded yet",
    count: "calendar days",
    citation: retention.citation ?? "FAR 4.805",
    verified: true,
  });

  return rows;
}
