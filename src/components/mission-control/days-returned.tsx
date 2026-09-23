import { useMemo } from "react";
import type { AcqMetrics } from "@/lib/metrics";
import { todayISO } from "@/lib/intake";

function quarterStart(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const month = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), month, 1)).toISOString().slice(0, 10);
}

export function DaysReturned({ metrics }: { metrics: AcqMetrics[] }) {
  const summary = useMemo(() => {
    const today = todayISO();
    const start = quarterStart(today);
    const rows = metrics.filter((metric) =>
      metric.clockState === "launched" &&
      metric.acq.target_award_date &&
      String(metric.acq.target_award_date) >= start &&
      String(metric.acq.target_award_date) <= today,
    );
    const centers = new Map<string, number>();
    let total = 0;
    for (const metric of rows) {
      const center = String(metric.acq.center_code ?? "Unassigned");
      centers.set(center, (centers.get(center) ?? 0) + metric.timeSavedDays);
      total += metric.timeSavedDays;
    }
    return { total, rows: [...centers.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [metrics]);

  return (
    <section className="mc-days-returned" aria-labelledby="days-returned-heading">
      <div>
        <p className="mc-label">Mission time</p>
        <h2 id="days-returned-heading" className="mc-heading">Days returned</h2>
        <p className="mc-section-note">Planned minus actual days across completed phases for files launched this quarter.</p>
      </div>
      <div className="mc-return-orbit">
        <div className="mc-return-value" data-numeric>{summary.total}</div>
        <div className="mc-return-caption">{summary.total === 0 ? "No returns recorded" : "days returned to missions"}</div>
      </div>
      <div className="mc-return-centers">
        {summary.rows.length === 0 ? (
          <p><strong>Current quarter</strong><span>No file has launched this quarter.</span></p>
        ) : summary.rows.map(([center, days]) => (
          <p key={center}><strong>{center}</strong><span data-numeric>{Math.abs(days)} {days >= 0 ? "ahead of" : "behind"} plan</span></p>
        ))}
      </div>
    </section>
  );
}