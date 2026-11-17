import type { NextRequest } from "next/server";
import { availability } from "@/config/availability";
import { DEFAULT_SESSION_TYPE, getSessionType } from "@/config/sessions";
import type { AvailabilityResponse } from "@/lib/booking-types";
import { getAvailableSlots } from "@/lib/server/availability";
import { CalendarError } from "@/lib/server/calendar";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

const noStore = { "cache-control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const limited = rateLimit(`avail:${clientIp(request)}`, 60, 60_000);
  if (!limited.ok) {
    return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "retry-after": String(limited.retryAfter) } });
  }

  const id = request.nextUrl.searchParams.get("sessionType") ?? DEFAULT_SESSION_TYPE;
  const session = getSessionType(id);
  if (!session) return Response.json({ error: "INVALID" }, { status: 400, headers: noStore });

  try {
    const slots = await getAvailableSlots(session);
    const body: AvailabilityResponse = {
      sessionType: session.id,
      durationMinutes: session.durationMinutes,
      companyTimeZone: availability.timeZone,
      generatedAt: new Date().toISOString(),
      slots,
    };
    return Response.json(body, { headers: noStore });
  } catch (err) {
    console.error("[availability]", err instanceof CalendarError ? `${err.code}: ${err.message}` : err);
    return Response.json({ error: "UNAVAILABLE" }, { status: 503, headers: noStore });
  }
}
