/**
 * Calendar dates on the America/Chicago clock. Countdown days are counted
 * between calendar dates with integer day numbers, so neither the UTC
 * rollover nor a DST change can move a T−/T+ figure.
 */

const CT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partsCT(d: Date): string {
  const p = CT.formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's America/Chicago calendar date, YYYY-MM-DD. */
export function todayCT(now: Date = new Date()): string {
  return partsCT(now);
}

/** America/Chicago calendar date of a timestamp; a bare YYYY-MM-DD passes through. */
export function dateCT(timestamp: string): string | null {
  const s = String(timestamp ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return partsCT(d);
}

/** Days-from-civil (Howard Hinnant): integer day number of a proleptic Gregorian date. */
function dayNumber(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z0: number): string {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

function parseISODate(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "").trim());
  if (!m) return NaN;
  return dayNumber(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Calendar days from one YYYY-MM-DD to another. */
export function calendarDaysBetween(fromISO: string, toISO: string): number {
  return parseISODate(toISO) - parseISODate(fromISO);
}

/** YYYY-MM-DD plus a whole number of calendar days. */
export function addCalendarDays(iso: string, days: number): string {
  return civilFromDays(parseISODate(iso) + Math.trunc(days));
}
