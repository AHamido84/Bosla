import "server-only";
import { availability } from "@/config/availability";
import { addMinutes, dateKey, type Interval, overlaps, zonedTimeToUtc } from "@/lib/time";
import type { CalendarProvider, CreatedEvent, HealthResult, NewEvent } from "./types";

/**
 * In-memory calendar for local development and demos (CALENDAR_PROVIDER=mock).
 * Seeds a few deterministic "busy" blocks so the UI shows realistic gaps.
 * State lives per server instance and resets on restart.
 */
interface StoredEvent extends Interval {
  id: string;
  site: boolean;
  summary: string;
}

const store: { events: StoredEvent[]; seededFor?: string } = ((
  globalThis as unknown as { __hcMockStore?: { events: StoredEvent[]; seededFor?: string } }
).__hcMockStore ??= { events: [] });

function seed(now: Date) {
  const tz = availability.timeZone;
  const today = dateKey(now, tz);
  if (store.seededFor === today) return;
  store.seededFor = today;
  store.events = store.events.filter((e) => e.site);
  // Every 2nd working day: busy 11:00–12:30; every 3rd day: busy 14:00–15:00.
  for (let i = 1; i <= availability.horizonDays + 1; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const [y, m, dd] = dateKey(d, tz).split("-").map(Number);
    if (i % 2 === 0)
      store.events.push({
        id: `seed-a-${i}`,
        site: false,
        summary: "busy",
        start: zonedTimeToUtc(y, m, dd, 11, 0, tz),
        end: zonedTimeToUtc(y, m, dd, 12, 30, tz),
      });
    if (i % 3 === 0)
      store.events.push({
        id: `seed-b-${i}`,
        site: false,
        summary: "busy",
        start: zonedTimeToUtc(y, m, dd, 14, 0, tz),
        end: zonedTimeToUtc(y, m, dd, 15, 0, tz),
      });
  }
}

const randomMeetCode = () => {
  const a = "abcdefghijkmnopqrstuvwxyz";
  const pick = (n: number) => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join("");
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
};

export class MockCalendarProvider implements CalendarProvider {
  readonly name = "mock" as const;

  async freeBusy(_ids: string[], window: Interval): Promise<Interval[]> {
    seed(new Date());
    return store.events.filter((e) => overlaps(e, window)).map(({ start, end }) => ({ start, end }));
  }

  async siteBookingStarts(window: Interval): Promise<Date[]> {
    return store.events.filter((e) => e.site && overlaps(e, window)).map((e) => e.start);
  }

  async insertEvent(e: NewEvent): Promise<CreatedEvent> {
    await new Promise((r) => setTimeout(r, 400)); // feel like a network call
    const id = `mock-${Date.now().toString(36)}`;
    store.events.push({ id, site: true, summary: e.summary, start: e.start, end: addMinutes(e.end, 0) });
    return { id, meetLink: `https://meet.google.com/${randomMeetCode()}`, htmlLink: null };
  }

  async health(): Promise<HealthResult> {
    return { ok: true, checks: { mock: { ok: true, detail: "CALENDAR_PROVIDER=mock" } } };
  }
}
