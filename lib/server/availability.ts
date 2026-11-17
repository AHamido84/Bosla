import "server-only";
import { availability } from "@/config/availability";
import type { SessionType } from "@/config/sessions";
import { availabilityWindow, generateSlots, type Slot } from "@/lib/slots";
import { getCalendar } from "./calendar";
import { getEnv } from "./env";

/** Live slots for a session type: free/busy across BUSY_CALENDAR_IDS + per-day caps. */
export async function getAvailableSlots(session: SessionType, now = new Date()): Promise<Slot[]> {
  const env = getEnv();
  const calendar = getCalendar();
  const window = availabilityWindow(now, availability);
  // Widen the bookings window to whole days so per-day counts are right.
  const countWindow = { start: new Date(window.start.getTime() - 86400000), end: window.end };

  const [busy, bookedStarts] = await Promise.all([
    calendar.freeBusy(env.busyCalendarIds, window),
    availability.maxSessionsPerDay > 0 ? calendar.siteBookingStarts(countWindow) : Promise.resolve([]),
  ]);

  return generateSlots({
    now,
    config: availability,
    durationMinutes: session.durationMinutes,
    busy,
    bookedStarts,
  });
}
