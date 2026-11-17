import "server-only";
import type { ServerEnv } from "../env";
import type { Interval } from "@/lib/time";
import {
  CalendarError,
  type CalendarProvider,
  type CreatedEvent,
  type HealthResult,
  type NewEvent,
} from "./types";

/**
 * Google Calendar REST client (OAuth 2.0 refresh-token flow).
 * Uses plain fetch — no googleapis SDK — to keep the serverless bundle small.
 * Scopes required: calendar.events + calendar.freebusy.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google" as const;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private env: ServerEnv) {}

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) return this.token.value;
    const res = await fetch(this.env.googleTokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.env.clientId!,
        client_secret: this.env.clientSecret!,
        refresh_token: this.env.refreshToken!,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      // invalid_grant = token revoked/expired (e.g. consent screen still in "Testing").
      throw new CalendarError(
        `Token refresh failed: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim(),
        res.status,
        json.error ?? "token_error",
      );
    }
    this.token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.accessToken();
    const res = await fetch(`${this.env.googleApiBase}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
      throw new CalendarError(
        `Google Calendar API ${res.status}: ${body.error?.message ?? res.statusText}`,
        res.status,
        body.error?.status,
      );
    }
    return (await res.json()) as T;
  }

  async freeBusy(calendarIds: string[], window: Interval): Promise<Interval[]> {
    type FB = {
      calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }>;
    };
    const data = await this.api<FB>("/freeBusy", {
      method: "POST",
      body: JSON.stringify({
        timeMin: window.start.toISOString(),
        timeMax: window.end.toISOString(),
        timeZone: "UTC",
        items: calendarIds.map((id) => ({ id })),
      }),
    });
    const busy: Interval[] = [];
    for (const id of calendarIds) {
      const cal = data.calendars?.[id];
      if (!cal || cal.errors?.length) {
        // Fail closed: if we cannot see a calendar we must not offer its time as free.
        throw new CalendarError(
          `Free/busy unavailable for a configured calendar (${cal?.errors?.[0]?.reason ?? "missing"})`,
          502,
          cal?.errors?.[0]?.reason ?? "notFound",
        );
      }
      for (const b of cal.busy ?? []) busy.push({ start: new Date(b.start), end: new Date(b.end) });
    }
    return busy;
  }

  async siteBookingStarts(window: Interval): Promise<Date[]> {
    const params = new URLSearchParams({
      timeMin: window.start.toISOString(),
      timeMax: window.end.toISOString(),
      singleEvents: "true",
      maxResults: "250",
      privateExtendedProperty: "hcBooking=1",
      fields: "items(start,status)",
    });
    type List = { items?: { status?: string; start?: { dateTime?: string } }[] };
    const data = await this.api<List>(
      `/calendars/${encodeURIComponent(this.env.calendarId!)}/events?${params}`,
    );
    return (data.items ?? [])
      .filter((e) => e.status !== "cancelled" && e.start?.dateTime)
      .map((e) => new Date(e.start!.dateTime!));
  }

  async insertEvent(e: NewEvent): Promise<CreatedEvent> {
    type Ev = {
      id: string;
      htmlLink?: string;
      hangoutLink?: string;
      conferenceData?: {
        createRequest?: { status?: { statusCode?: string } };
        entryPoints?: { entryPointType: string; uri: string }[];
      };
    };
    const calendarPath = `/calendars/${encodeURIComponent(this.env.calendarId!)}/events`;
    const created = await this.api<Ev>(`${calendarPath}?conferenceDataVersion=1&sendUpdates=all`, {
      method: "POST",
      body: JSON.stringify({
        summary: e.summary,
        description: e.description,
        start: { dateTime: e.start.toISOString(), timeZone: e.timeZone },
        end: { dateTime: e.end.toISOString(), timeZone: e.timeZone },
        attendees: [{ email: e.attendee.email, displayName: e.attendee.displayName }],
        colorId: e.colorId,
        guestsCanInviteOthers: false,
        guestsCanSeeOtherGuests: false,
        extendedProperties: { private: e.privateProps },
        reminders: { useDefault: true },
        conferenceData: {
          createRequest: { requestId: e.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    });

    const meetOf = (ev: Ev) =>
      ev.hangoutLink ?? ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? null;

    let meetLink = meetOf(created);
    // Meet creation is usually synchronous, but Google may return "pending" — poll briefly.
    for (let i = 0; !meetLink && i < 3; i++) {
      if (created.conferenceData?.createRequest?.status?.statusCode === "failure") break;
      await new Promise((r) => setTimeout(r, 700));
      const again = await this.api<Ev>(
        `${calendarPath}/${encodeURIComponent(created.id)}?fields=hangoutLink,conferenceData`,
      );
      meetLink = meetOf(again);
    }
    return { id: created.id, meetLink, htmlLink: created.htmlLink ?? null };
  }

  async health(): Promise<HealthResult> {
    const checks: HealthResult["checks"] = {};
    try {
      await this.accessToken();
      checks.token = { ok: true };
    } catch (err) {
      checks.token = { ok: false, detail: (err as CalendarError).code ?? "token_error" };
      return { ok: false, checks };
    }
    const now = new Date();
    const window = { start: now, end: new Date(now.getTime() + 60_000) };
    // Probe each calendar individually; report only ok/error, never busy data.
    const ids = this.env.busyCalendarIds;
    for (const id of ids) {
      const label = id === this.env.calendarId ? "bookingCalendar" : `calendar:${maskId(id)}`;
      try {
        await this.freeBusy([id], window);
        checks[label] = { ok: true };
      } catch (err) {
        console.error(`[health] ${label}:`, (err as Error).message);
        checks[label] = { ok: false, detail: (err as CalendarError).code ?? "error" };
      }
    }
    // Can this token create events on the booking calendar? Ask only for the token's access
    // role (no event data). Needs the calendar.events scope and owner/writer access.
    try {
      const { accessRole } = await this.api<{ accessRole?: string }>(
        `/calendars/${encodeURIComponent(this.env.calendarId!)}/events?maxResults=1&fields=accessRole`,
      );
      checks.bookingCalendarWrite =
        accessRole === "owner" || accessRole === "writer"
          ? { ok: true }
          : { ok: false, detail: `access_role_${accessRole ?? "unknown"}` };
    } catch (err) {
      const e = err as CalendarError;
      console.error("[health] bookingCalendarWrite:", e.message);
      const scope = /insufficient authentication scopes/i.test(e.message);
      checks.bookingCalendarWrite = { ok: false, detail: scope ? "missing_scope_calendar.events" : (e.code ?? "error") };
    }
    return { ok: Object.values(checks).every((c) => c.ok), checks };
  }
}

/** "abcdef123@group.calendar.google.com" → "abc…@group.calendar.google.com" */
export function maskId(id: string) {
  const [local, domain] = id.split("@");
  if (!domain) return id === "primary" ? "primary" : `${id.slice(0, 3)}…`;
  return `${local.slice(0, 3)}…@${domain}`;
}
