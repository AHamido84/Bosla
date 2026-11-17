/**
 * Working hours and booking rules. All times are in the company time zone.
 * Edit, commit, redeploy — no other code changes needed.
 */
export interface AvailabilityConfig {
  /** IANA zone of the company. Slots are generated in this zone. */
  timeZone: string;
  /** 0 = Sunday … 6 = Saturday. */
  workingDays: number[];
  /** "HH:mm" in `timeZone`. A session must END by `endTime`. */
  startTime: string;
  endTime: string;
  /** Optional daily breaks, e.g. prayer / lunch: [{ start: "12:00", end: "13:00" }]. */
  breaks: { start: string; end: string }[];
  /** Specific dates with no bookings (holidays), "YYYY-MM-DD" in `timeZone`. */
  blockedDates: string[];
  /** Slots start every N minutes (e.g. 30 → 10:00, 10:30, …). */
  slotIntervalMinutes: number;
  /** Free time kept before AND after every busy block and every session. */
  bufferMinutes: number;
  /** Earliest bookable start = now + this. */
  minNoticeHours: number;
  /** Latest bookable start = now + this. */
  horizonDays: number;
  /** Max sessions booked through the site per day (0 = unlimited). */
  maxSessionsPerDay: number;
}

export const availability: AvailabilityConfig = {
  timeZone: "Asia/Riyadh",
  workingDays: [0, 1, 2, 3, 4], // Sun–Thu
  startTime: "10:00",
  endTime: "17:00",
  breaks: [],
  blockedDates: [],
  slotIntervalMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 12,
  horizonDays: 21,
  maxSessionsPerDay: 4,
};
