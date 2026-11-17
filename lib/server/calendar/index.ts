import "server-only";
import { getEnv, missingGoogleEnv } from "../env";
import { GoogleCalendarProvider } from "./google";
import { MockCalendarProvider } from "./mock";
import { CalendarError, type CalendarProvider } from "./types";

let cached: { key: string; provider: CalendarProvider } | null = null;

/** Returns the configured provider (cached per instance so the access token is reused). */
export function getCalendar(): CalendarProvider {
  const env = getEnv();
  const key = `${env.provider}|${env.clientId}|${env.calendarId}|${env.googleApiBase}`;
  if (cached?.key === key) return cached.provider;

  let provider: CalendarProvider;
  if (env.provider === "mock") {
    provider = new MockCalendarProvider();
  } else {
    const missing = missingGoogleEnv(env);
    if (missing.length) throw new CalendarError(`Missing env: ${missing.join(", ")}`, 503, "not_configured");
    provider = new GoogleCalendarProvider(env);
  }
  cached = { key, provider };
  return provider;
}

export { CalendarError };
