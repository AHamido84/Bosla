import { t } from "@/content";
import { tzOffsetMinutes } from "./time";

export function visitorTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(timeZone: string, opts: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(t.intlLocale, { timeZone, ...opts });
    cache.set(key, f);
  }
  return f;
}

/** "الأحد، 23 نوفمبر 2026" */
export const formatLongDate = (iso: string | Date, tz: string) =>
  fmt(tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** "الأحد 23 نوفمبر" */
export const formatDayTitle = (iso: string | Date, tz: string) =>
  fmt(tz, { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

/** "10:30 ص" */
export const formatTime = (iso: string | Date, tz: string) =>
  fmt(tz, { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

/** "نوفمبر 2026" */
export const formatMonth = (year: number, month: number) =>
  fmt("UTC", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 15)));

/** "GMT+3", "GMT+5:30" */
export function gmtOffset(tz: string, at = new Date()): string {
  const off = tzOffsetMinutes(at, tz);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** "Europe/Berlin (GMT+1)" — Latin, unambiguous, matches what the visitor's OS calls it. */
export const timeZoneLabel = (tz: string, at?: Date) => `${tz.replace(/_/g, " ")} (${gmtOffset(tz, at)})`;

export const sameOffset = (a: string, b: string, at: Date) => tzOffsetMinutes(at, a) === tzOffsetMinutes(at, b);

export const formatNumber = (n: number) => new Intl.NumberFormat(t.intlLocale).format(n);
