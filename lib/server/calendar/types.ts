import type { Interval } from "@/lib/time";

export interface NewEvent {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendee: { email: string; displayName: string };
  colorId: string;
  /** Private extended properties stored on the event (used to count site bookings). */
  privateProps: Record<string, string>;
  requestId: string;
}

export interface CreatedEvent {
  id: string;
  meetLink: string | null;
  htmlLink: string | null;
}

export interface HealthResult {
  ok: boolean;
  checks: Record<string, { ok: boolean; detail?: string }>;
}

export interface CalendarProvider {
  readonly name: "google" | "mock";
  /** Merged busy intervals for the given calendars. Throws on any calendar error. */
  freeBusy(calendarIds: string[], window: Interval): Promise<Interval[]>;
  /** Start times of events created by this site on the booking calendar. */
  siteBookingStarts(window: Interval): Promise<Date[]>;
  insertEvent(event: NewEvent): Promise<CreatedEvent>;
  health(): Promise<HealthResult>;
}

export class CalendarError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "CalendarError";
  }
}
