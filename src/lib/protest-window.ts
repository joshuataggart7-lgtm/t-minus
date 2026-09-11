/**
 * Protest window clock.
 *
 * After a file reaches Launched, the Award phase shows two deadlines:
 *   - the GAO filing deadline (4 CFR 21.2)
 *   - the CICA stay deadline (31 U.S.C. 3553(d)(4); RFO FAR 33.104)
 *
 * The day counts are read from the thresholds table, never hard-coded. The
 * only inputs are the award date and the debriefing date the contracting
 * officer enters.
 */

export type ThresholdRow = {
  name: string;
  value: number | null;
  citation: string | null;
  note?: string | null;
};

export type ProtestDeadline = {
  key: "gao" | "cica";
  label: string;
  /** The threshold row's own name, so the reader can trace it. */
  basis: string;
  days: number | null;
  date: string | null;
  daysRemaining: number | null;
  citation: string | null;
  note: string | null;
  measuredFrom: string;
};

const MATCH = {
  gaoFiling: /gao protest filing/i,
  cicaAward: /cica stay.*after award/i,
  cicaDebrief: /cica stay.*debriefing/i,
};

function find(thresholds: ThresholdRow[], re: RegExp) {
  return thresholds.find((t) => re.test(t.name ?? "")) ?? null;
}

export function addCalendarDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function between(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * GAO filing: 10 days after the basis is known, or 10 days after a required
 * debriefing when one was held. CICA stay: notice to GAO within 10 days after
 * award, or 5 days after a required, requested debriefing — whichever the
 * debriefing date produces, since the shorter debriefing rule controls once a
 * debriefing has taken place.
 */
export function protestWindow(
  awardDate: string | null,
  debriefingDate: string | null,
  thresholds: ThresholdRow[],
  todayISO: string,
): ProtestDeadline[] {
  const gao = find(thresholds, MATCH.gaoFiling);
  const cicaAward = find(thresholds, MATCH.cicaAward);
  const cicaDebrief = find(thresholds, MATCH.cicaDebrief);

  const gaoAnchor = debriefingDate ?? awardDate;
  const gaoRow = gao;
  const cicaRow = debriefingDate ? cicaDebrief : cicaAward;
  const cicaAnchor = debriefingDate ?? awardDate;

  function build(
    key: ProtestDeadline["key"],
    label: string,
    row: ThresholdRow | null,
    anchor: string | null,
    measuredFrom: string,
  ): ProtestDeadline {
    const days = row?.value ?? null;
    const date = anchor !== null && days !== null ? addCalendarDays(anchor, days) : null;
    return {
      key,
      label,
      basis: row?.name ?? "Threshold not loaded",
      days,
      date,
      daysRemaining: date ? between(todayISO, date) : null,
      citation: row?.citation ?? null,
      note: row?.note ?? null,
      measuredFrom,
    };
  }

  return [
    build(
      "gao",
      "GAO filing deadline",
      gaoRow,
      gaoAnchor,
      debriefingDate ? "the required debriefing" : "the date the basis was known (award date)",
    ),
    build(
      "cica",
      "CICA stay deadline",
      cicaRow,
      cicaAnchor,
      debriefingDate ? "the required, requested debriefing" : "the award date",
    ),
  ];
}
