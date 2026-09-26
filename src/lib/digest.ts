// The weekly leadership digest. Every figure is computed from the same data the
// Executive Overview reads; nothing in it is written by hand.

import { todayISO } from "@/lib/intake";
import type { AcqMetrics } from "@/lib/metrics";
import type { AgingItem } from "@/lib/aging";

export type DigestSection = { heading: string; lines: string[] };

export type Digest = {
  generatedAt: string;
  weekStart: string;
  weekEnd: string;
  quarterStart: string;
  launchedThisWeek: { id: string; title: string; center: string; date: string; timeSavedDays: number }[];
  atRisk: { id: string; title: string; center: string; blocker: string; owner: string; daysToAward: number | null }[];
  agingHolds: { id: string; center: string; subject: string; owner: string; ageDays: number; thresholdDays: number }[];
  holdsByReasonByCenter: { center: string; reason: string; count: number }[];
  daysReturned: { total: number; byCenter: [string, number][] };
  counts: { running: number; onHold: number; launchedThisQuarter: number; scrubbed: number };
};

/** Monday of the week containing the given day. */
export function weekStartOf(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function quarterStartOf(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1)).toISOString().slice(0, 10);
}

/** Build the digest from the metrics and the aging items. */
export function buildDigest(metrics: AcqMetrics[], aging: AgingItem[], today = todayISO()): Digest {
  const weekStart = weekStartOf(today);
  const qStart = quarterStartOf(today);
  // Recorded award date only (from the Launched audit row); never the target date.
  const awardDate = (m: AcqMetrics) => (m.awardDate ? String(m.awardDate) : null);
  const center = (m: AcqMetrics) => String(m.acq.center_code ?? "Unassigned");

  const launchedThisWeek = metrics
    .filter((m) => {
      const d = awardDate(m);
      return m.clockState === "launched" && d !== null && d >= weekStart && d <= today;
    })
    .map((m) => ({
      id: m.acq.acquisition_id,
      title: String(m.acq.title ?? ""),
      center: center(m),
      date: awardDate(m) ?? "",
      timeSavedDays: m.timeSavedDays,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const atRisk = metrics
    .filter((m) => m.status === "At Risk")
    .map((m) => ({
      id: m.acq.acquisition_id,
      title: String(m.acq.title ?? ""),
      center: center(m),
      blocker: m.blocker,
      owner: m.blockerOwner ?? "Unassigned",
      daysToAward: m.daysToAward,
    }))
    .sort((a, b) => (a.daysToAward ?? 9999) - (b.daysToAward ?? 9999));

  const agingHolds = aging
    .filter((a) => a.aging && a.kind === "hold")
    .map((a) => ({
      id: a.acquisitionId,
      center: a.centerCode,
      subject: a.subject,
      owner: a.owner,
      ageDays: a.ageDays,
      thresholdDays: a.thresholdDays,
    }));

  // Holds by reason within each Center. The reason is trimmed at the first dash,
  // exactly as the Acquisitions tab counts it.
  const holdMap = new Map<string, { center: string; reason: string; count: number }>();
  for (const m of metrics) {
    if (m.clockState !== "hold") continue;
    const reason = (m.hold?.reason ?? String(m.acq.hold_reason ?? "Reason not recorded")).split("—")[0]!.trim();
    const key = `${center(m)}|${reason}`;
    const row = holdMap.get(key) ?? { center: center(m), reason, count: 0 };
    row.count += 1;
    holdMap.set(key, row);
  }
  const holdsByReasonByCenter = [...holdMap.values()].sort(
    (a, b) => a.center.localeCompare(b.center) || b.count - a.count,
  );

  // Days returned to missions: planned minus actual across completed phases,
  // over the files launched this quarter, by Center. Same figure as the tab.
  const launchedThisQuarterRows = metrics.filter((m) => {
    const d = awardDate(m);
    return m.clockState === "launched" && d !== null && d >= qStart && d <= today;
  });
  const returnedMap = new Map<string, number>();
  let total = 0;
  for (const m of launchedThisQuarterRows) {
    returnedMap.set(center(m), (returnedMap.get(center(m)) ?? 0) + m.timeSavedDays);
    total += m.timeSavedDays;
  }

  return {
    generatedAt: new Date().toISOString(),
    weekStart,
    weekEnd: today,
    quarterStart: qStart,
    launchedThisWeek,
    atRisk,
    agingHolds,
    holdsByReasonByCenter,
    daysReturned: {
      total,
      byCenter: [...returnedMap.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    },
    counts: {
      running: metrics.filter((m) => m.clockState === "running").length,
      onHold: metrics.filter((m) => m.clockState === "hold").length,
      launchedThisQuarter: launchedThisQuarterRows.length,
      scrubbed: metrics.filter((m) => m.clockState === "scrubbed").length,
    },
  };
}

/** The digest as plain lines, for the PDF and for the announcement body. */
export function digestSections(d: Digest): DigestSection[] {
  return [
    {
      heading: "Where the work stands",
      lines: [
        `Running: ${d.counts.running}`,
        `On hold: ${d.counts.onHold}`,
        `Launched this quarter: ${d.counts.launchedThisQuarter}`,
        `Scrubbed: ${d.counts.scrubbed}`,
      ],
    },
    {
      heading: "Launched this week",
      lines: d.launchedThisWeek.length
        ? d.launchedThisWeek.map(
            (r) =>
              `${r.id} · ${r.center} · ${r.title} · awarded ${r.date} · ${Math.abs(r.timeSavedDays)} days ${r.timeSavedDays >= 0 ? "ahead of" : "behind"} plan`,
          )
        : ["No file launched this week."],
    },
    {
      heading: "At risk",
      lines: d.atRisk.length
        ? d.atRisk.map(
            (r) =>
              `${r.id} · ${r.center} · ${r.title} · ${r.blocker} · owner ${r.owner} · ${r.daysToAward ?? "—"} days to award`,
          )
        : ["No file is at risk."],
    },
    {
      heading: "Aging holds",
      lines: d.agingHolds.length
        ? d.agingHolds.map(
            (r) =>
              `${r.id} · ${r.center} · ${r.subject} · owner ${r.owner} · ${r.ageDays} days, aging after ${r.thresholdDays}`,
          )
        : ["No hold is past its Center window."],
    },
    {
      heading: "Holds by reason, by Center",
      lines: d.holdsByReasonByCenter.length
        ? d.holdsByReasonByCenter.map((r) => `${r.center} · ${r.reason} · ${r.count}`)
        : ["Nothing is on hold."],
    },
    {
      heading: "Days returned to missions",
      lines: [
        `${d.daysReturned.total} days this quarter, from files launched since ${d.quarterStart}.`,
        ...d.daysReturned.byCenter.map(
          ([c, n]) => `${c} · ${Math.abs(n)} days ${n >= 0 ? "ahead of" : "behind"} plan`,
        ),
        "Method: planned days minus actual days across completed phases.",
      ],
    },
  ];
}

/** The digest as an announcement body: the same lines, nothing editable. */
export function digestAnnouncementBody(d: Digest): string {
  return digestSections(d)
    .map((s) => `${s.heading}\n${s.lines.map((l) => `  ${l}`).join("\n")}`)
    .join("\n\n");
}

/** PDF through the browser print dialog, on white, computed figures only. */
export function exportDigestPdf(d: Digest): boolean {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const title = `Leadership digest, week of ${d.weekStart}`;
  const body = digestSections(d)
    .map(
      (s) =>
        `<section><h2>${esc(s.heading)}</h2>${s.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</section>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #000; background: #fff; font-size: 12pt; line-height: 1.5; }
  header, footer { font-size: 9pt; }
  h1 { font-size: 18pt; } h2 { font-size: 13pt; margin-bottom: 2px; }
  section { margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
  p { margin: 2px 0; }
</style></head><body>
<header>T-Minus leadership digest · ${esc(d.weekStart)} to ${esc(d.weekEnd)} · generated ${esc(d.generatedAt)}</header>
<h1>${esc(title)}</h1>
${body}
<footer><p>Generated from the record. No text in this digest is editable.</p><p>Prototype. Not an official NASA system.</p></footer>
<script>window.onload = function () { window.print(); }<\/script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
