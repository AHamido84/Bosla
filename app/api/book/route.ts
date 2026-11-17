import { after } from "next/server";
import { getSessionType } from "@/config/sessions";
import { t } from "@/content";
import { validateBooking } from "@/lib/booking-schema";
import type { BookingErrorResponse } from "@/lib/booking-types";
import { createBooking, SlotTakenError } from "@/lib/server/booking";
import { CalendarError } from "@/lib/server/calendar";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { sendBookingWebhook } from "@/lib/server/webhook";

const noStore = { "cache-control": "no-store" };
const fail = (status: number, body: BookingErrorResponse, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...noStore, ...headers } });

export async function POST(request: Request) {
  // 5 booking attempts per IP per 10 minutes.
  const limited = rateLimit(`book:${clientIp(request)}`, 5, 10 * 60_000);
  if (!limited.ok) return fail(429, { error: "RATE_LIMITED" }, { "retry-after": String(limited.retryAfter) });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20_000) return fail(413, { error: "INVALID" });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail(400, { error: "INVALID" });
  }

  // Honeypot: bots fill every field. Pretend nothing happened.
  if (json && typeof json === "object" && "website" in json && (json as { website?: unknown }).website) {
    return fail(400, { error: "INVALID" });
  }

  const parsed = validateBooking(json);
  if (!parsed.success) return fail(422, { error: "INVALID", fields: parsed.errors });
  if (!getSessionType(parsed.data.sessionType)) {
    return fail(422, { error: "INVALID", fields: { sessionType: t.validation.sessionType } });
  }

  try {
    const { summary, webhook } = await createBooking(parsed.data);
    after(() => sendBookingWebhook(webhook));
    return Response.json({ booking: summary }, { status: 201, headers: noStore });
  } catch (err) {
    if (err instanceof SlotTakenError) return fail(409, { error: "SLOT_TAKEN" });
    console.error("[book]", err instanceof CalendarError ? `${err.code}: ${err.message}` : err);
    return fail(503, { error: "UNAVAILABLE" });
  }
}
