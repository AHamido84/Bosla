/**
 * Minimal, dependency-free time-zone helpers built on Intl.
 * Works for any IANA zone, including ones with DST (Europe/*), even though
 * Asia/Riyadh itself has a fixed +03:00 offset.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) p[part.type] = part.value;
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour === 24 ? 0 : +p.hour,
    minute: +p.minute,
    second: +p.second,
    weekday: WEEKDAYS[p.weekday],
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (Riyadh → +180). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - wholeSeconds) / 60000);
}

/** Convert a wall-clock time in `timeZone` to a UTC instant. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetMinutes(new Date(guess), timeZone);
  let ts = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(ts), timeZone);
  if (off2 !== off1) ts = guess - off2 * 60000;
  return new Date(ts);
}

/** "YYYY-MM-DD" of `date` as seen in `timeZone`. */
export function dateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseHHmm(s: string): { hour: number; minute: number } {
  const [h, m] = s.split(":").map(Number);
  return { hour: h, minute: m };
}

/** Calendar-date arithmetic on a "YYYY-MM-DD" key (time-zone independent). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface Interval {
  start: Date;
  end: Date;
}

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
