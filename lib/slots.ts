import type { AvailabilityConfig } from "@/config/availability";
import {
  addDaysToKey,
  addMinutes,
  dateKey,
  type Interval,
  overlaps,
  parseHHmm,
  weekdayOfKey,
  zonedTimeToUtc,
} from "./time";

export interface Slot {
  /** ISO 8601 UTC */
  start: string;
  end: string;
}

export interface SlotInput {
  now: Date;
  config: AvailabilityConfig;
  durationMinutes: number;
  /** Busy blocks from free/busy (all BUSY_CALENDAR_IDS). */
  busy: Interval[];
  /** Start times of sessions already booked through the site (for maxSessionsPerDay). */
  bookedStarts: Date[];
}

/** Window to query free/busy for, so callers fetch exactly what slot generation needs. */
export function availabilityWindow(now: Date, config: AvailabilityConfig): Interval {
  const start = addMinutes(now, config.minNoticeHours * 60 - config.bufferMinutes);
  const end = addMinutes(now, config.horizonDays * 24 * 60 + 24 * 60);
  return { start, end };
}

/**
 * Pure slot generator. All wall-clock rules are evaluated in `config.timeZone`;
 * the output is UTC instants, so any client can render them in its own zone.
 */
export function generateSlots({ now, config, durationMinutes, busy, bookedStarts }: SlotInput): Slot[] {
  const tz = config.timeZone;
  const earliest = addMinutes(now, config.minNoticeHours * 60);
  const latest = addMinutes(now, config.horizonDays * 24 * 60);
  const start = parseHHmm(config.startTime);
  const end = parseHHmm(config.endTime);

  const perDay = new Map<string, number>();
  for (const s of bookedStarts) {
    const k = dateKey(s, tz);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }

  const slots: Slot[] = [];
  const todayKey = dateKey(now, tz);

  for (let i = 0; i <= config.horizonDays; i++) {
    const key = addDaysToKey(todayKey, i);
    if (!config.workingDays.includes(weekdayOfKey(key))) continue;
    if (config.blockedDates.includes(key)) continue;
    if (config.maxSessionsPerDay > 0 && (perDay.get(key) ?? 0) >= config.maxSessionsPerDay) continue;

    const [y, m, d] = key.split("-").map(Number);
    const dayStart = zonedTimeToUtc(y, m, d, start.hour, start.minute, tz);
    const dayEnd = zonedTimeToUtc(y, m, d, end.hour, end.minute, tz);
    const breaks: Interval[] = config.breaks.map((b) => {
      const bs = parseHHmm(b.start);
      const be = parseHHmm(b.end);
      return {
        start: zonedTimeToUtc(y, m, d, bs.hour, bs.minute, tz),
        end: zonedTimeToUtc(y, m, d, be.hour, be.minute, tz),
      };
    });

    for (
      let t = dayStart;
      addMinutes(t, durationMinutes) <= dayEnd;
      t = addMinutes(t, config.slotIntervalMinutes)
    ) {
      if (t < earliest || t > latest) continue;
      const session: Interval = { start: t, end: addMinutes(t, durationMinutes) };
      if (breaks.some((b) => overlaps(session, b))) continue;
      const padded: Interval = {
        start: addMinutes(session.start, -config.bufferMinutes),
        end: addMinutes(session.end, config.bufferMinutes),
      };
      if (busy.some((b) => overlaps(padded, b))) continue;
      slots.push({ start: session.start.toISOString(), end: session.end.toISOString() });
    }
  }
  return slots;
}
