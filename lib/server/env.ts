import "server-only";
import { availability } from "@/config/availability";

/** Server-only configuration. Never import this from a client component. */
export interface ServerEnv {
  provider: "google" | "mock";
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  calendarId?: string;
  busyCalendarIds: string[];
  webhookUrl?: string;
  webhookSecret?: string;
  mondayToken?: string;
  mondayBoardId?: string;
  mondayGroupId?: string;
  mondayApiUrl: string;
  /** Overridable only so tests can point at a fake Google server. */
  googleApiBase: string;
  googleTokenUrl: string;
}

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export function getEnv(): ServerEnv {
  const provider = process.env.CALENDAR_PROVIDER === "mock" ? "mock" : "google";
  const calendarId = clean(process.env.GOOGLE_CALENDAR_ID);
  const extra = (process.env.BUSY_CALENDAR_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // The booking calendar ALWAYS blocks slots, even if BUSY_CALENDAR_IDS omits it.
  const busyCalendarIds = Array.from(
    new Set([...(calendarId ? [calendarId] : []), ...(availability.blockPrimaryCalendar ? ["primary"] : []), ...extra]),
  );

  return {
    provider,
    clientId: clean(process.env.GOOGLE_CLIENT_ID),
    clientSecret: clean(process.env.GOOGLE_CLIENT_SECRET),
    refreshToken: clean(process.env.GOOGLE_REFRESH_TOKEN),
    calendarId,
    busyCalendarIds: provider === "mock" && !calendarId ? ["mock-calendar"] : busyCalendarIds,
    webhookUrl: clean(process.env.BOOKING_WEBHOOK_URL),
    webhookSecret: clean(process.env.BOOKING_WEBHOOK_SECRET),
    mondayToken: clean(process.env.MONDAY_API_TOKEN),
    mondayBoardId: clean(process.env.MONDAY_BOARD_ID),
    mondayGroupId: clean(process.env.MONDAY_GROUP_ID),
    mondayApiUrl: clean(process.env.MONDAY_API_URL) ?? "https://api.monday.com/v2",
    googleApiBase: clean(process.env.GOOGLE_API_BASE_URL) ?? "https://www.googleapis.com/calendar/v3",
    googleTokenUrl: clean(process.env.GOOGLE_TOKEN_URL) ?? "https://oauth2.googleapis.com/token",
  };
}

export function missingGoogleEnv(env: ServerEnv): string[] {
  const missing: string[] = [];
  if (!env.clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!env.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!env.refreshToken) missing.push("GOOGLE_REFRESH_TOKEN");
  if (!env.calendarId) missing.push("GOOGLE_CALENDAR_ID");
  return missing;
}
